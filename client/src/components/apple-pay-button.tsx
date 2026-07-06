/**
 * ApplePayButton — Native Apple Pay button backed by Geidea Direct API.
 *
 * Flow:
 *  1. Detect Apple Pay availability (Safari only).
 *  2. On button click → create ApplePaySession (MUST be synchronous from user gesture).
 *  3. onvalidatemerchant  → POST /api/payments/apple-pay/validate-merchant
 *  4. onpaymentauthorized → POST /api/payments/apple-pay/process
 *  5. Call onSuccess(transactionId) or onError(message).
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

// ── Type declarations for Apple Pay JS API ──────────────────────────────────
declare global {
  interface Window {
    ApplePaySession?: {
      new (version: number, request: ApplePayPaymentRequest): ApplePaySessionInstance;
      canMakePayments(): boolean;
      canMakePaymentsWithActiveCard(merchantIdentifier: string): Promise<boolean>;
      readonly STATUS_SUCCESS: number;
      readonly STATUS_FAILURE: number;
    };
  }
}

interface ApplePayPaymentRequest {
  countryCode: string;
  currencyCode: string;
  merchantCapabilities: string[];
  supportedNetworks: string[];
  total: { label: string; amount: string };
}

interface ApplePaySessionInstance {
  onvalidatemerchant: ((event: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((event: { payment: { token: any; billingContact?: any } }) => void) | null;
  oncancel: ((event: any) => void) | null;
  begin(): void;
  abort(): void;
  completeMerchantValidation(merchantSession: any): void;
  completePayment(status: number): void;
}

// ────────────────────────────────────────────────────────────────────────────

export interface ApplePayButtonProps {
  /** Total amount to charge */
  amount: number;
  /** ISO 4217 currency code, defaults to SAR */
  currency?: string;
  /** Merchant-side order reference (used as merchantReferenceId in Geidea) */
  orderRef: string;
  /** Optional customer data forwarded to the backend */
  customerName?: string;
  customerPhone?: string;
  /** Called with the Geidea transactionId on successful payment */
  onSuccess: (transactionId: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
  /** Extra CSS classes */
  className?: string;
  /** Label shown inside the Apple Pay button (defaults to the amount) */
  displayLabel?: string;
}

export default function ApplePayButton({
  amount,
  currency = "SAR",
  orderRef,
  customerName,
  customerPhone,
  onSuccess,
  onError,
  onCancel,
  className = "",
  displayLabel,
}: ApplePayButtonProps) {
  const tc = useTranslate();
  const [available, setAvailable] = useState<boolean | null>(null); // null = checking
  const [processing, setProcessing] = useState(false);
  const sessionRef = useRef<ApplePaySessionInstance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ApplePaySession) {
      setAvailable(false);
      return;
    }
    try {
      setAvailable(window.ApplePaySession.canMakePayments());
    } catch {
      setAvailable(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!window.ApplePaySession || !available || processing) return;

    // ── MUST create session synchronously inside user-gesture handler ──────
    const ApplePaySession = window.ApplePaySession;
    const paymentRequest: ApplePayPaymentRequest = {
      countryCode: "SA",
      currencyCode: currency,
      merchantCapabilities: ["supports3DS"],
      supportedNetworks: ["visa", "masterCard", "mada"],
      total: {
        label: displayLabel || "CLUNY CAFE",
        amount: Number(amount).toFixed(2),
      },
    };

    let session: ApplePaySessionInstance;
    try {
      session = new ApplePaySession(3, paymentRequest);
    } catch (err: any) {
      onError(err?.message || "فشل تشغيل Apple Pay");
      return;
    }

    sessionRef.current = session;
    setProcessing(true);

    // ── Step 1: Merchant validation ─────────────────────────────────────────
    session.onvalidatemerchant = async (event) => {
      try {
        const res = await fetch("/api/payments/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            validationUrl: event.validationURL,
            amount,
            currency,
            orderRef,
            customerName,
            customerPhone,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.merchantSession) {
          throw new Error(
            data.error ||
              tc(
                "فشل التحقق من هوية المتجر مع Apple",
                "Merchant validation with Apple failed"
              )
          );
        }
        session.completeMerchantValidation(data.merchantSession);
      } catch (err: any) {
        console.error("[ApplePay] validate-merchant error:", err);
        session.abort();
        setProcessing(false);
        onError(
          err?.message ||
            tc(
              "تعذّر التحقق من هوية المتجر",
              "Could not verify merchant identity"
            )
        );
      }
    };

    // ── Step 2: Payment authorised ──────────────────────────────────────────
    session.onpaymentauthorized = async (event) => {
      try {
        const res = await fetch("/api/payments/apple-pay/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentToken: event.payment.token,
            orderData: {
              totalAmount: amount,
              currency,
              orderRef,
            },
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          session.completePayment(ApplePaySession.STATUS_FAILURE);
          setProcessing(false);
          onError(
            data.error ||
              tc("فشل معالجة دفع Apple Pay", "Apple Pay payment failed")
          );
          return;
        }

        session.completePayment(ApplePaySession.STATUS_SUCCESS);
        setProcessing(false);
        onSuccess(data.transactionId || orderRef);
      } catch (err: any) {
        console.error("[ApplePay] process error:", err);
        session.completePayment(ApplePaySession.STATUS_FAILURE);
        setProcessing(false);
        onError(
          err?.message ||
            tc("خطأ في معالجة دفع Apple Pay", "Apple Pay processing error")
        );
      }
    };

    // ── Session cancelled by user ───────────────────────────────────────────
    session.oncancel = () => {
      setProcessing(false);
      onCancel();
    };

    session.begin();
  }, [
    available,
    processing,
    amount,
    currency,
    orderRef,
    customerName,
    customerPhone,
    displayLabel,
    onSuccess,
    onError,
    onCancel,
    tc,
  ]);

  // Not on Safari / Apple Pay not available — render nothing
  if (available === false) return null;
  // Still checking (brief flash of null is fine on Safari)
  if (available === null) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={processing}
      className={`relative w-full h-12 rounded-xl bg-black text-white flex items-center justify-center gap-2 
        transition-all duration-150 
        hover:bg-[#1c1c1e] active:scale-[0.98] 
        disabled:opacity-60 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${className}`}
      aria-label={tc("الدفع بـ Apple Pay", "Pay with Apple Pay")}
      data-testid="button-apple-pay"
    >
      {processing ? (
        <Loader2 className="w-5 h-5 animate-spin text-white" />
      ) : (
        <>
          {/* Apple logo */}
          <svg viewBox="0 0 20 24" className="h-5 w-auto fill-white flex-shrink-0">
            <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z" />
          </svg>
          <span className="font-semibold text-sm tracking-tight">Pay</span>
        </>
      )}
    </button>
  );
}

import { useState, useEffect, useRef } from "react";
import { Loader2, ShieldCheck, X, CheckCircle2, XCircle, CreditCard, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
import { isCapacitorNative } from "@/lib/server-url";

/**
 * Detects iOS Safari running as a web browser (NOT Capacitor native).
 * Apple Pay CANNOT be triggered from inside an iframe in iOS Safari —
 * it requires a top-level browsing context. Use full-page redirect instead.
 */
function isIOSSafariWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isCapacitorNative()) return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMacWithApplePay = /Macintosh/i.test(ua) && !!(window as any).ApplePaySession;
  const isSafariBased = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return (isIOS || isMacWithApplePay) && isSafariBased;
}

interface PaymobCheckoutProps {
  orderNumber: string;
  amount: number;
  checkoutUrl: string;
  publicKey?: string;
  clientSecret?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type PaymobState = "loading" | "ready" | "processing" | "verifying" | "success" | "error";

export default function PaymobCheckout({
  orderNumber,
  amount,
  checkoutUrl,
  onSuccess,
  onError,
  onCancel,
}: PaymobCheckoutProps) {
  const tc = useTranslate();
  const [state, setState] = useState<PaymobState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const successTriggered = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (checkoutUrl) {
      if (isCapacitorNative()) {
        // Capacitor: show button immediately
        setState("ready");
        const t = setTimeout(() => setVisible(true), 30);
        return () => clearTimeout(t);
      } else {
        // Web / iOS Safari redirect mode: set visible first, then "ready" after animation
        const t1 = setTimeout(() => setVisible(true), 30);
        const t2 = setTimeout(() => setState("ready"), 350);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    }
  }, [checkoutUrl]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const triggerSuccess = () => {
    if (successTriggered.current) return;
    successTriggered.current = true;
    stopPolling();
    setConfirmCancel(false);
    setState("success");
    setTimeout(() => {
      setVisible(false);
      setTimeout(onSuccess, 400);
    }, 1800);
  };

  const triggerError = (msg: string) => {
    stopPolling();
    setErrorMessage(msg);
    setState("error");
    onError(msg);
  };

  const verifyPaymentStatus = async (retries = 8, delayMs = 1500): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(`/api/payments/order-status/${encodeURIComponent(orderNumber)}`);
        const data = await res.json();
        if (data.paid === true) return true;
      } catch {}
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
  };

  const handleCloseAttempt = async () => {
    if (state === "success" || state === "processing" || state === "verifying") return;
    setState("verifying");
    setConfirmCancel(false);
    await new Promise(r => setTimeout(r, 1000));
    const paid = await verifyPaymentStatus();
    if (paid) {
      triggerSuccess();
    } else {
      setState("ready");
      setConfirmCancel(true);
    }
  };

  const handleForceClose = () => {
    stopPolling();
    setVisible(false);
    setTimeout(onCancel, 350);
  };

  // ── Capacitor in-app browser (SFSafariViewController on iOS) ───────────────
  const openCapacitorBrowser = async () => {
    try {
      const { Browser } = await import(/* @vite-ignore */ "@capacitor/browser");

      setState("processing");

      // Helper: check payment status once
      const checkOnce = async (): Promise<boolean> => {
        try {
          const res = await fetch(`/api/payments/order-status/${encodeURIComponent(orderNumber)}`);
          const data = await res.json();
          return data.paid === true;
        } catch {
          return false;
        }
      };

      // Background polling every 2.5s — catches webhook-confirmed payments
      pollRef.current = setInterval(async () => {
        const paid = await checkOnce();
        if (paid) {
          await Browser.close();
          triggerSuccess();
        }
      }, 2500);

      // browserPageLoaded fires when any page loads inside SFSafariViewController.
      // After PayMob payment completes it redirects to our /payment-return-iframe —
      // that navigation triggers this event. We do an immediate check and auto-close.
      const pageLoadedHandle = await Browser.addListener("browserPageLoaded", async () => {
        const paid = await checkOnce();
        if (paid) {
          pageLoadedHandle.remove();
          stopPolling();
          await Browser.close();
          triggerSuccess();
        }
      });

      // Listen for when the user manually closes the in-app browser
      const listenerHandle = await Browser.addListener("browserFinished", async () => {
        listenerHandle.remove();
        pageLoadedHandle.remove();
        stopPolling();
        setState("verifying");

        // Step 1: check order DB status (works if webhook already confirmed)
        const paid = await verifyPaymentStatus(4, 1500);
        if (paid) { triggerSuccess(); return; }

        // Step 2: try PayMob SA intention API directly (works even without webhook)
        try {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'paymob', sessionId: orderNumber }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.verified) {
            // Attempt to create the order from sessionStorage
            const pendingRaw = sessionStorage.getItem('pendingOrderData');
            if (pendingRaw) {
              try {
                const orderData = JSON.parse(pendingRaw);
                const createRes = await fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...orderData,
                    paymentStatus: 'paid',
                    status: 'payment_confirmed',
                    paymentTransactionId: verifyData.transactionId || orderNumber,
                    paymentReference: `PAYMOB-${verifyData.transactionId || orderNumber}`,
                  }),
                  credentials: 'include',
                });
                if (createRes.ok) {
                  sessionStorage.removeItem('pendingOrderData');
                  sessionStorage.removeItem('paymentProvider');
                }
              } catch {}
            }
            triggerSuccess();
            return;
          }
        } catch {}

        setState("ready");
        setConfirmCancel(true);
      });

      await Browser.open({
        url: checkoutUrl,
        toolbarColor: "#0d0d0d",
        presentationStyle: "popover",
      });
    } catch (err: any) {
      // Fallback: open in default external browser if plugin fails
      window.open(checkoutUrl, "_blank");
      setState("ready");
    }
  };

  // ── postMessage handler for web iframe ─────────────────────────────────────
  useEffect(() => {
    if (isCapacitorNative()) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (typeof data !== "object" || data === null) return;
        if (
          data.type === "PAYMOB_SUCCESS" ||
          data.success === true ||
          data.payment_status === "PAID" ||
          data.status === "success"
        ) {
          triggerSuccess();
        } else if (data.type === "PAYMOB_ERROR" || data.success === false || data.type === "PAYMOB_PENDING") {
          const msg = data.message || tc("فشلت عملية الدفع. يرجى المحاولة مرة أخرى.", "Payment failed. Please try again.");
          setState("verifying");
          (async () => {
            const paid = await verifyPaymentStatus(10, 1200);
            if (paid) {
              triggerSuccess();
            } else if (data.type === "PAYMOB_PENDING") {
              setState("ready");
            } else {
              triggerError(msg);
            }
          })();
        } else if (data.type === "PAYMOB_CANCEL") {
          handleCloseAttempt();
        }
      } catch {}
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), []);

  const handleIframeLoad = () => {
    if (state === "loading") setState("ready");
    try {
      const loc = iframeRef.current?.contentWindow?.location?.href;
      if (loc && (
        loc.includes("payment-return-iframe") ||
        loc.includes("payment-return?") ||
        (loc.includes("provider=paymob") && (loc.includes("success=") || loc.includes("pending="))) ||
        (loc.includes("/checkout") && loc.includes("success="))
      )) {
        const url = new URL(loc);
        const success = url.searchParams.get("success");
        const pending = url.searchParams.get("pending");
        if (success === "true" && pending !== "true") {
          triggerSuccess();
        } else if (success === "false" || success === null) {
          setState("verifying");
          (async () => {
            const paid = await verifyPaymentStatus(10, 1200);
            if (paid) triggerSuccess();
            else if (success === "false") triggerError(tc("لم تكتمل عملية الدفع. يرجى المحاولة مرة أخرى.", "Payment was not completed. Please try again."));
            else setState("ready");
          })();
        }
      }
    } catch {}
  };

  // ── Capacitor mode: show a "Pay Now" button that opens in-app browser ──────
  if (isCapacitorNative()) {
    return (
      <div
        className="fixed inset-0 z-[999] flex flex-col justify-end"
        dir="rtl"
        style={{ pointerEvents: "all" }}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
          onClick={state === "ready" ? () => handleCloseAttempt() : undefined}
        />

        <div
          className="relative bg-background rounded-t-[28px] shadow-2xl transition-transform duration-400 ease-out"
          style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">{tc("أكمل الدفع الآن", "Complete Payment")}</p>
                <p className="text-xs text-muted-foreground">{tc("بوابة PayMob المعتمدة في السعودية", "PayMob certified gateway")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[11px] text-muted-foreground leading-none">{tc("الإجمالي", "Total")}</span>
                <span className="font-black text-base text-primary leading-tight">
                  {amount.toFixed(2)} <SarIcon size={12} />
                </span>
              </div>
              {(state === "ready" || state === "error") && (
                <button
                  onClick={handleForceClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  data-testid="button-paymob-close"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="px-5 py-6 space-y-4">
            {state === "ready" && (
              <>
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  {tc(
                    "سيتم فتح صفحة الدفع الآمنة داخل التطبيق. أدخل بيانات بطاقتك وأكمل الدفع.",
                    "The secure payment page will open inside the app. Enter your card details and complete the payment."
                  )}
                </p>
                <Button
                  className="w-full h-12 gap-2 font-bold text-base"
                  onClick={openCapacitorBrowser}
                  data-testid="button-paymob-open"
                >
                  <CreditCard className="w-5 h-5" />
                  {tc("ادفع الآن", "Pay Now")}
                </Button>
              </>
            )}

            {state === "processing" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-semibold">{tc("صفحة الدفع مفتوحة", "Payment page is open")}</p>
                <p className="text-xs text-muted-foreground">{tc("أكمل الدفع في النافذة أعلاه", "Complete payment in the window above")}</p>
              </div>
            )}

            {state === "verifying" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-semibold">{tc("جارٍ التحقق من الدفع...", "Verifying payment...")}</p>
                <p className="text-xs text-muted-foreground">{tc("يرجى الانتظار", "Please wait")}</p>
              </div>
            )}

            {state === "success" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="w-14 h-14 text-green-600" />
                <p className="font-bold text-lg text-green-700">{tc("تم الدفع بنجاح!", "Payment Successful!")}</p>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <XCircle className="w-14 h-14 text-red-500" />
                <p className="font-bold text-red-600">{tc("فشلت عملية الدفع", "Payment Failed")}</p>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" onClick={handleForceClose} className="flex-1">{tc("إلغاء", "Cancel")}</Button>
                  <Button onClick={() => setState("ready")} className="flex-1">{tc("إعادة المحاولة", "Try Again")}</Button>
                </div>
              </div>
            )}

            {confirmCancel && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <AlertCircle className="w-12 h-12 text-amber-500" />
                <p className="font-bold">{tc("هل تريد إلغاء الدفع؟", "Cancel payment?")}</p>
                <p className="text-sm text-muted-foreground">
                  {tc('إذا أكملت الدفع بالفعل، سيظهر طلبك في "طلباتي" قريباً.', 'If you already paid, your order will appear in "My Orders" shortly.')}
                </p>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" onClick={() => { setConfirmCancel(false); setState("ready"); }} className="flex-1">
                    {tc("العودة للدفع", "Back")}
                  </Button>
                  <Button variant="destructive" onClick={handleForceClose} className="flex-1">
                    {tc("إلغاء الدفع", "Cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-5 pt-1">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="w-3 h-3 text-green-500" />
              <span>{tc("جميع المعاملات مشفرة — مدى · فيزا · ماستركارد", "All transactions encrypted — Mada · Visa · Mastercard")}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS Safari web mode: full-page redirect (Apple Pay can't work in iframe) ─
  if (isIOSSafariWeb()) {
    return (
      <div
        className="fixed inset-0 z-[999] flex flex-col justify-end"
        dir="rtl"
        style={{ pointerEvents: "all" }}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
          onClick={state === "ready" ? () => handleCloseAttempt() : undefined}
        />

        <div
          className="relative bg-background rounded-t-[28px] shadow-2xl transition-transform duration-400 ease-out"
          style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">{tc("أكمل الدفع الآن", "Complete Payment")}</p>
                <p className="text-xs text-muted-foreground">{tc("بوابة PayMob المعتمدة في السعودية", "PayMob certified gateway")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[11px] text-muted-foreground leading-none">{tc("الإجمالي", "Total")}</span>
                <span className="font-black text-base text-primary leading-tight">
                  {amount.toFixed(2)} <SarIcon size={12} />
                </span>
              </div>
              {(state === "ready" || state === "error") && (
                <button
                  onClick={handleForceClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  data-testid="button-paymob-ios-close"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="px-5 py-6 space-y-4">
            {state === "ready" && (
              <>
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  {tc(
                    "سيتم فتح صفحة الدفع الآمنة. يمكنك الدفع بـ Apple Pay أو البطاقة.",
                    "The secure payment page will open. You can pay with Apple Pay or card."
                  )}
                </p>
                <Button
                  className="w-full h-12 gap-2 font-bold text-base"
                  onClick={() => {
                    setState("processing");
                    window.location.href = checkoutUrl;
                  }}
                  data-testid="button-paymob-ios-redirect"
                >
                  <ExternalLink className="w-5 h-5" />
                  {tc("ادفع الآن", "Pay Now")}
                </Button>
              </>
            )}

            {state === "processing" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-semibold">{tc("جارٍ الانتقال لصفحة الدفع...", "Redirecting to payment page...")}</p>
              </div>
            )}

            {state === "verifying" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-semibold">{tc("جارٍ التحقق من الدفع...", "Verifying payment...")}</p>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <XCircle className="w-14 h-14 text-red-500" />
                <p className="font-bold text-red-600">{tc("فشلت عملية الدفع", "Payment Failed")}</p>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" onClick={handleForceClose} className="flex-1">{tc("إلغاء", "Cancel")}</Button>
                  <Button onClick={() => setState("ready")} className="flex-1">{tc("إعادة المحاولة", "Try Again")}</Button>
                </div>
              </div>
            )}

            {confirmCancel && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <AlertCircle className="w-12 h-12 text-amber-500" />
                <p className="font-bold">{tc("هل تريد إلغاء الدفع؟", "Cancel payment?")}</p>
                <p className="text-sm text-muted-foreground">
                  {tc('إذا أكملت الدفع، سيظهر طلبك في "طلباتي" قريباً.', 'If you already paid, your order will appear in "My Orders" shortly.')}
                </p>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" onClick={() => { setConfirmCancel(false); setState("ready"); }} className="flex-1">
                    {tc("العودة", "Back")}
                  </Button>
                  <Button variant="destructive" onClick={handleForceClose} className="flex-1">
                    {tc("إلغاء الدفع", "Cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-5 pt-1">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="w-3 h-3 text-green-500" />
              <span>{tc("مدى · فيزا · ماستركارد · Apple Pay", "Mada · Visa · Mastercard · Apple Pay")}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Web browser mode: redirect-based checkout (no iframe) ─────────────────
  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col justify-end"
      dir="rtl"
      style={{ pointerEvents: "all" }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={state === "ready" || state === "error" ? () => handleCloseAttempt() : undefined}
      />

      <div
        className="relative bg-background rounded-t-[28px] shadow-2xl transition-transform duration-400 ease-out"
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{tc("أكمل الدفع الآن", "Complete Payment")}</p>
              <p className="text-xs text-muted-foreground">{tc("بوابة PayMob المعتمدة في السعودية", "PayMob certified gateway")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[11px] text-muted-foreground leading-none">{tc("الإجمالي", "Total")}</span>
              <span className="font-black text-base text-primary leading-tight">
                {amount.toFixed(2)} <SarIcon size={12} />
              </span>
            </div>
            {(state === "ready" || state === "error") && (
              <button
                onClick={handleForceClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                data-testid="button-paymob-web-close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-6 space-y-4">
          {state === "ready" && (
            <>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                {tc(
                  "سيتم فتح صفحة الدفع الآمنة. أدخل بيانات بطاقتك وأكمل الدفع.",
                  "The secure payment page will open. Enter your card details and complete the payment."
                )}
              </p>
              <Button
                className="w-full h-12 gap-2 font-bold text-base"
                onClick={() => {
                  setState("processing");
                  window.location.href = checkoutUrl;
                }}
                data-testid="button-paymob-web-redirect"
              >
                <CreditCard className="w-5 h-5" />
                {tc("ادفع الآن", "Pay Now")}
              </Button>
            </>
          )}

          {(state === "loading" || state === "processing") && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-semibold">{tc("جارٍ الانتقال لصفحة الدفع...", "Redirecting to payment page...")}</p>
            </div>
          )}

          {state === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-semibold">{tc("جارٍ التحقق من الدفع...", "Verifying payment...")}</p>
              <p className="text-xs text-muted-foreground">{tc("يرجى الانتظار", "Please wait")}</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-14 h-14 text-green-600" />
              <p className="font-bold text-lg text-green-700">{tc("تم الدفع بنجاح!", "Payment Successful!")}</p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <XCircle className="w-14 h-14 text-red-500" />
              <p className="font-bold text-red-600">{tc("فشلت عملية الدفع", "Payment Failed")}</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={handleForceClose} className="flex-1">{tc("إلغاء", "Cancel")}</Button>
                <Button onClick={() => setState("ready")} className="flex-1">{tc("إعادة المحاولة", "Try Again")}</Button>
              </div>
            </div>
          )}

          {confirmCancel && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <AlertCircle className="w-12 h-12 text-amber-500" />
              <p className="font-bold">{tc("هل تريد إلغاء الدفع؟", "Cancel payment?")}</p>
              <p className="text-sm text-muted-foreground">
                {tc('إذا أكملت الدفع بالفعل، سيظهر طلبك في "طلباتي" قريباً.', 'If you already paid, your order will appear in "My Orders" shortly.')}
              </p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => { setConfirmCancel(false); setState("ready"); }} className="flex-1">
                  {tc("العودة للدفع", "Back")}
                </Button>
                <Button variant="destructive" onClick={handleForceClose} className="flex-1">
                  {tc("إلغاء الدفع", "Cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-5 pt-1">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3 h-3 text-green-500" />
            <span>{tc("جميع المعاملات مشفرة — مدى · فيزا · ماستركارد · Apple Pay", "All transactions encrypted — Mada · Visa · Mastercard · Apple Pay")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

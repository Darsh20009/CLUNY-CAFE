import { useEffect, useRef, useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2, ShoppingBag, Smartphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCapacitorNative } from "@/lib/platform";
import { useCustomer } from "@/contexts/CustomerContext";

type PaymentStatus = "loading" | "success" | "failed" | "pending";

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

export default function PaymentReturnPage() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const { setCustomer } = useCustomer();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [displayOrderNumber, setDisplayOrderNumber] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const retryCount = useRef(0);
  const maxRetries = 8;
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const paymentToken  = params.get("pt");
    const paymobSuccess = params.get("success");
    const paymobPending = params.get("pending");
    const paymobTxId    = params.get("id");
    const provider      = params.get("provider") || "paymob";
    const session       = params.get("session");

    const geideaResponseCode  = params.get("geideaResponseCode")  || params.get("responseCode");
    const geideaStatus        = params.get("geideaStatus")        || params.get("status");
    const geideaOrderId       = params.get("geideaOrderId")       || params.get("orderId");
    const geideaMerchantRefId = params.get("geideaMerchantRefId") || params.get("merchantReferenceId");
    const geideaAmount        = params.get("geideaAmount")        || params.get("amount");
    const geideaCurrency      = params.get("geideaCurrency")      || params.get("currency");
    const geideaSignature     = params.get("geideaSignature")     || params.get("signature");

    // ── Geidea path (unchanged) ──────────────────────────────────────────────
    const hasGeideaParams = !!(geideaResponseCode || geideaOrderId || geideaStatus);
    if (hasGeideaParams) {
      (async () => {
        try {
          const body: any = {
            provider,
            sessionId: geideaOrderId || geideaMerchantRefId || session,
            geideaResponseCode, geideaStatus, geideaOrderId,
            geideaMerchantRefId, geideaAmount, geideaCurrency, geideaSignature,
          };
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          const isPaidByCode = geideaResponseCode === "000" || geideaStatus === "Success" || geideaStatus === "succeeded";
          if (data.verified || isPaidByCode) {
            const raw = sessionStorage.getItem("pendingOrderData");
            if (raw) {
              try {
                const orderData = JSON.parse(raw);
                const createRes = await fetch("/api/orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...orderData, paymentStatus: "paid", status: "pending" }),
                  credentials: "include",
                });
                if (createRes.ok) {
                  const created = await createRes.json();
                  setDisplayOrderNumber(created.orderNumber ?? null);
                }
                sessionStorage.removeItem("pendingOrderData");
              } catch { /* non-critical */ }
            }
            setStatus("success");
            setMessage(tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you."));
            try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", session }, "*"); } catch {}
            if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 2500);
          } else {
            setStatus("failed");
            setMessage(tc("لم تتم عملية الدفع. يرجى المحاولة مرة أخرى.", "Payment was not completed. Please try again."));
            try { window.parent.postMessage({ type: "PAYMOB_ERROR", status: "failed" }, "*"); } catch {}
          }
        } catch {
          setStatus("failed");
          setMessage(tc("حدث خطأ أثناء التحقق من الدفع.", "An error occurred while verifying payment."));
        }
      })();
      return;
    }

    // ── PayMob path ──────────────────────────────────────────────────────────

    // Explicitly failed — no need to verify
    if (paymobSuccess === "false") {
      setStatus("failed");
      setMessage(tc("لم تتم عملية الدفع. يرجى المحاولة مرة أخرى.", "Payment was not completed. Please try again."));
      try { window.parent.postMessage({ type: "PAYMOB_ERROR", status: "failed", session }, "*"); } catch {}
      return;
    }

    // No PayMob signal at all and no token — nothing to do
    const hasAnyPaymobSignal = paymobSuccess !== null || session !== null || paymentToken !== null;
    if (!hasAnyPaymobSignal) {
      setStatus("pending");
      setMessage(tc("جاري التحقق من حالة الدفع...", "Checking payment status..."));
      return;
    }

    // ── Attempt confirm via server-side token (primary path) ─────────────────
    setMessage(tc("جاري تأكيد طلبك...", "Confirming your order..."));

    const attemptConfirm = async () => {
      // ── PRIMARY: token-based atomic confirm ──────────────────────────────
      if (paymentToken) {
        try {
          const confirmRes = await fetch("/api/payments/confirm-payment-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: paymentToken, paymobTxId, paymobSuccess, session }),
            credentials: "include",
          });
          const confirmData = await confirmRes.json();

          if (confirmRes.ok && confirmData.success) {
            const orderNum = confirmData.orderNumber ?? null;
            if (orderNum) localStorage.setItem("br-active-order", orderNum);

            if (confirmData.customer) {
              setCustomer(confirmData.customer);
              try { localStorage.setItem("customer", JSON.stringify(confirmData.customer)); } catch {}
            }

            sessionStorage.removeItem("pendingOrderData");
            sessionStorage.removeItem("paymentProvider");
            sessionStorage.removeItem("paymentSessionToken");

            setDisplayOrderNumber(orderNum);
            setStatus("success");
            setMessage(
              confirmData.alreadyConfirmed
                ? tc("طلبك مؤكد بالفعل! شكراً لك.", "Your order is already confirmed! Thank you.")
                : tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you.")
            );
            try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", orderNumber: orderNum }, "*"); } catch {}
            if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 3000);
            return;
          }

          // Token already used (idempotency edge case)
          if (confirmData.alreadyUsed) {
            setStatus("success");
            setMessage(tc("تمت عملية الدفع بنجاح! طلبك تم تأكيده.", "Payment successful! Your order is confirmed."));
            if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 3000);
            return;
          }

          // Payment failed per PayMob API check
          if (confirmData.paymentFailed) {
            setStatus("failed");
            setMessage(tc("لم تتم عملية الدفع. يرجى المحاولة مرة أخرى.", "Payment was not completed. Please try again."));
            return;
          }

          // Payment still processing — retry with backoff
          if (confirmData.waiting) {
            retryCount.current++;
            if (retryCount.current < maxRetries) {
              const delay = Math.min(3000 * retryCount.current, 15000);
              setStatus("pending");
              setMessage(tc(`الدفع قيد المعالجة، جاري إعادة التحقق... (${retryCount.current}/${maxRetries})`, `Payment processing, retrying... (${retryCount.current}/${maxRetries})`));
              retryTimer.current = setTimeout(attemptConfirm, delay);
            } else {
              setStatus("pending");
              setMessage(tc("الدفع قيد المعالجة. تحقق من طلباتك لاحقاً أو تواصل مع الدعم.", "Payment processing. Check your orders later or contact support."));
            }
            return;
          }
        } catch {
          // Network error — fall through to sessionStorage
        }
      }

      // ── FALLBACK: sessionStorage (same-browser context) ──────────────────
      try {
        const raw = sessionStorage.getItem("pendingOrderData");
        if (raw) {
          const orderData = JSON.parse(raw);
          const createRes = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...orderData,
              paymentStatus: "paid",
              status: "pending",
              ...(paymobTxId ? { paymentTransactionId: paymobTxId } : {}),
            }),
            credentials: "include",
          });
          if (createRes.ok) {
            const created = await createRes.json();
            const orderNum = created.orderNumber ?? null;
            if (orderNum) localStorage.setItem("br-active-order", orderNum);
            sessionStorage.removeItem("pendingOrderData");
            sessionStorage.removeItem("paymentProvider");
            sessionStorage.removeItem("paymentSessionToken");
            setDisplayOrderNumber(orderNum);
            setStatus("success");
            setMessage(tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you."));
            try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", orderNumber: orderNum, session }, "*"); } catch {}
            if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 3000);
            return;
          }
        }
      } catch { /* ignore */ }

      // ── Final fallback ────────────────────────────────────────────────────
      if (paymobPending === "true") {
        setStatus("pending");
        setMessage(tc("الدفع قيد المعالجة، سيتم إشعارك عند التأكيد.", "Payment processing, you'll be notified on confirmation."));
        return;
      }

      setStatus("failed");
      setMessage(tc("تم الدفع لكن حدث خطأ في تأكيد الطلب. يرجى التواصل مع الدعم.", "Payment received but order confirmation failed. Please contact support."));
    };

    attemptConfirm();

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  // ── Iframe mode (minimal) ────────────────────────────────────────────────────
  if (isInIframe()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4">
          {status === "loading"  && <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />}
          {status === "success"  && <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />}
          {status === "failed"   && <XCircle className="w-12 h-12 text-red-500 mx-auto" />}
          {status === "pending"  && <Loader2 className="w-12 h-12 animate-spin text-yellow-500 mx-auto" />}
          <p className="text-sm font-medium">{message || tc("جاري معالجة الدفع...", "Processing payment...")}</p>
        </div>
      </div>
    );
  }

  // ── Full-page mode ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-6">

          {status === "loading" && (
            <>
              <Loader2 className="w-20 h-20 animate-spin text-primary mx-auto" />
              <h1 className="text-2xl font-bold">{tc("جاري تأكيد طلبك...", "Confirming your order...")}</h1>
              <p className="text-muted-foreground">{message || tc("يرجى الانتظار لحظة", "Please wait a moment")}</p>
              <p className="text-xs text-muted-foreground">{tc("لا تغلق هذه الصفحة", "Do not close this page")}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-24 h-24 text-green-500 mx-auto animate-in zoom-in duration-500" />
              <h1 className="text-3xl font-bold text-green-600">{tc("تم الدفع بنجاح! 🎉", "Payment Successful! 🎉")}</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              {displayOrderNumber && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-5">
                  <p className="text-sm text-muted-foreground mb-1">{tc("رقم طلبك", "Your order number")}</p>
                  <p className="text-3xl font-bold font-mono text-green-700 dark:text-green-400">#{displayOrderNumber}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground animate-pulse">
                {tc("سيتم تحويلك لمتابعة طلبك...", "Redirecting to track your order...")}
              </p>
              {isCapacitorNative() ? (
                <Button size="lg" className="w-full" onClick={() => navigate("/my-orders")} data-testid="button-return-app">
                  <Smartphone className="w-5 h-5 ml-2" />
                  {tc("العودة للتطبيق", "Return To App")}
                </Button>
              ) : (
                <Button size="lg" className="w-full" onClick={() => navigate("/my-orders")} data-testid="button-view-order">
                  <ShoppingBag className="w-5 h-5 ml-2" />
                  {tc("متابعة طلبي", "Track My Order")}
                </Button>
              )}
            </>
          )}

          {status === "failed" && (
            <>
              <XCircle className="w-24 h-24 text-red-500 mx-auto animate-in zoom-in duration-500" />
              <h1 className="text-3xl font-bold text-red-600">{tc("لم يتم الدفع", "Payment Not Completed")}</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              <div className="flex flex-col gap-3">
                <Button size="lg" className="w-full gap-2" onClick={() => navigate("/checkout")} data-testid="button-retry-payment">
                  <RefreshCw className="w-4 h-4" />
                  {tc("إعادة المحاولة", "Try Again")}
                </Button>
                <Button size="lg" variant="outline" className="w-full" onClick={() => navigate("/menu")} data-testid="button-back-menu">
                  {tc("العودة للقائمة", "Back to Menu")}
                </Button>
              </div>
            </>
          )}

          {status === "pending" && (
            <>
              <Loader2 className="w-20 h-20 text-yellow-500 mx-auto animate-spin" />
              <h1 className="text-3xl font-bold text-yellow-600">{tc("جاري المعالجة", "Processing")}</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              <Button size="lg" variant="outline" className="w-full" onClick={() => navigate("/my-orders")} data-testid="button-check-order">
                {tc("التحقق من حالة الطلب", "Check Order Status")}
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {tc("مدعوم بواسطة PayMob — بوابة الدفع المعتمدة في السعودية", "Powered by PayMob — Certified Saudi Payment Gateway")}
        </p>
      </div>
    </div>
  );
}

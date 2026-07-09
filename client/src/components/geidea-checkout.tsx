import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, CheckCircle, XCircle, RefreshCw, FlaskConical, X, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/lib/useTranslate";

interface GeideaCheckoutProps {
  orderNumber: string;
  amount: number;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  paymentMethod?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type Stage = "loading" | "ready" | "iframe" | "success" | "error";

export default function GeideaCheckoutWidget({
  orderNumber,
  amount,
  customerPhone,
  customerEmail,
  customerName,
  paymentMethod,
  onSuccess,
  onError,
  onCancel,
}: GeideaCheckoutProps) {
  const tc = useTranslate();
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [hppUrl, setHppUrl] = useState("");
  const mountedRef = useRef(true);

  const { data: payCfg } = useQuery<{ paymentTestMode: boolean; provider: string; geideaConfigured: boolean }>({
    queryKey: ["/api/payments/config"],
    staleTime: 30000,
  });

  const isTestMode = !!payCfg?.paymentTestMode;

  const fetchSession = async () => {
    if (!mountedRef.current) return;
    setStage("loading");
    setErrorMsg("");

    if (isTestMode) {
      if (mountedRef.current) setStage("ready");
      return;
    }

    try {
      const returnUrl = `${window.location.origin}/payment-return?provider=geidea&orderNumber=${encodeURIComponent(orderNumber)}`;
      const res = await fetch("/api/payments/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderNumber,
          amount,
          currency: "SAR",
          customerName,
          customerPhone,
          customerEmail,
          returnUrl,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.details || data.error || "فشل إنشاء جلسة الدفع");
      }

      if (mountedRef.current) {
        setHppUrl(data.redirectUrl);
        setStage("ready");
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err.message || tc("تعذّر الاتصال ببوابة الدفع.", "Could not connect to payment gateway.");
      setErrorMsg(msg);
      setStage("error");
      onError(msg);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (payCfg !== undefined) fetchSession();
    return () => { mountedRef.current = false; };
  }, [payCfg]);

  const handleTestPay = async () => {
    setStage("loading");
    try {
      const res = await fetch("/api/payments/simulate-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, amount, currency: "SAR" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (mountedRef.current) setStage("success");
        onSuccess();
      } else {
        throw new Error(data.error || "sim_failed");
      }
    } catch {
      if (mountedRef.current) {
        setStage("error");
        setErrorMsg(tc("فشل في محاكاة الدفع.", "Payment simulation failed."));
      }
    }
  };

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const iframe = e.currentTarget;
      const loc = iframe.contentWindow?.location;
      if (!loc) return;
      const href = loc.href;
      if (!href || href === "about:blank") return;
      if (href.includes("/payment-return")) {
        const params = new URLSearchParams(loc.search);
        const responseCode = params.get("geideaResponseCode") || params.get("responseCode") || params.get("Response") || "";
        const status = params.get("geideaStatus") || params.get("status") || params.get("Status") || "";
        if (mountedRef.current) {
          if (responseCode === "000" || status.toLowerCase() === "success" || status.toLowerCase() === "paid") {
            setStage("success");
            onSuccess();
          } else if (status.toLowerCase() === "cancel" || status.toLowerCase() === "cancelled") {
            setStage("ready");
            onCancel();
          } else {
            const msg = responseCode
              ? tc(`تم رفض الدفع (كود: ${responseCode})`, `Payment declined (code: ${responseCode})`)
              : tc("تعذّر إتمام الدفع", "Payment failed");
            setErrorMsg(msg);
            setStage("error");
            onError(msg);
          }
        }
      }
    } catch { }
  };

  if (stage === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
        <CheckCircle className="w-14 h-14 text-green-500" />
        <div className="text-center">
          <p className="font-bold text-xl text-green-700 dark:text-green-400">{tc("تم الدفع بنجاح!", "Payment Successful!")}</p>
          {isTestMode && <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded">⚗️ {tc("وضع الاختبار — لم يُخصم مبلغ حقيقي", "Test mode — no real amount was charged")}</p>}
          <p className="text-sm text-muted-foreground mt-1">{tc("جاري معالجة طلبك...", "Processing your order...")}</p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
        <XCircle className="w-12 h-12 text-red-500" />
        <div className="text-center space-y-1">
          <p className="font-bold text-lg text-red-700 dark:text-red-400">{tc("تعذّر إتمام الدفع", "Payment Failed")}</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
        <Button variant="outline" onClick={() => { setStage("loading"); fetchSession(); }} className="mt-2 gap-2" data-testid="button-retry-geidea">
          <RefreshCw className="w-4 h-4" />
          {tc("حاول مرة أخرى", "Try Again")}
        </Button>
      </div>
    );
  }

  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 bg-primary/5 rounded-xl border border-primary/20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="font-semibold text-foreground">{tc("جاري تجهيز بوابة الدفع...", "Preparing payment gateway...")}</p>
        <p className="text-xs text-muted-foreground">{tc("يرجى الانتظار لحظة", "Please wait a moment")}</p>
      </div>
    );
  }

  return (
    <>
      {/* Trigger card shown in the checkout dialog */}
      <div className="flex flex-col items-center justify-center gap-4 p-8 bg-primary/5 rounded-xl border border-primary/20">
        <CreditCard className="w-10 h-10 text-primary" />
        <div className="text-center space-y-2">
          <p className="font-semibold text-foreground text-lg">{tc("بوابة الدفع جاهزة", "Payment Gateway Ready")}</p>
          <p className="text-sm text-muted-foreground">{tc("اضغط الزر أدناه لفتح صفحة الدفع", "Press the button below to open the payment page")}</p>
        </div>
        {isTestMode ? (
          <Button size="lg" onClick={handleTestPay} className="gap-2 w-full max-w-xs" data-testid="button-open-geidea">
            <FlaskConical className="w-4 h-4" />
            {tc("محاكاة الدفع (وضع الاختبار)", "Simulate Payment (Test Mode)")}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => setStage("iframe")}
            className="gap-2 w-full max-w-xs"
            data-testid="button-open-geidea"
          >
            <CreditCard className="w-4 h-4" />
            {tc("ادفع الآن", "Pay Now")}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">🔒 {tc("دفع آمن ومشفّر بواسطة Geidea", "Secure encrypted payment by Geidea")}</p>
      </div>

      {/* Bottom Sheet */}
      {stage === "iframe" && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end" data-testid="geidea-bottom-sheet">
          {/* Dark overlay — click to cancel */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{ animation: "fadeIn 0.2s ease" }}
            onClick={() => { setStage("ready"); onCancel(); }}
          />

          {/* Sheet itself */}
          <div
            className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl flex flex-col"
            style={{
              height: "90vh",
              animation: "slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {/* Handle + header */}
            <div className="flex flex-col items-center pt-3 pb-2 px-4 shrink-0 border-b border-gray-100 dark:border-zinc-800">
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-600 mb-3" />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔒</span>
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                      {tc("الدفع الآمن", "Secure Payment")}
                    </p>
                    <p className="text-xs text-gray-400">{tc("مدعوم من Geidea", "Powered by Geidea")}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setStage("ready"); onCancel(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  data-testid="button-close-geidea-sheet"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* iframe */}
            <iframe
              src={hppUrl}
              className="flex-1 w-full border-none"
              title="Geidea Payment"
              allow="payment *; camera *"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation allow-top-navigation-by-user-activation allow-modals"
              onLoad={handleIframeLoad}
              data-testid="iframe-geidea-hpp"
            />
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to   { transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

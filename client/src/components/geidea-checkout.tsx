import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, CheckCircle, XCircle, RefreshCw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/lib/useTranslate";

const HPP_BASE = "https://www.ksamerchant.geidea.net/hpp/";

interface GeideaSessionConfig {
  merchantPublicKey: string;
  orderAmount: string;
  orderCurrency: string;
  merchantReferenceId: string;
  callbackUrl: string;
  signature: string;
  timestamp: string;
}

interface GeideaCheckoutProps {
  orderNumber: string;
  amount: number;
  customerPhone?: string;
  customerEmail?: string;
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

  const fetchConfig = async () => {
    if (!mountedRef.current) return;
    setStage("loading");
    setErrorMsg("");

    if (isTestMode) {
      if (mountedRef.current) setStage("ready");
      return;
    }

    try {
      const callbackUrl = `${window.location.origin}/api/payments/geidea/callback`;
      const res = await fetch("/api/payments/geidea/session-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "SAR",
          merchantReferenceId: orderNumber,
          callbackUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "config_failed");
      }
      const cfg: GeideaSessionConfig = await res.json();
      const returnUrl = `${window.location.origin}/payment-return`;
      const params = new URLSearchParams({
        merchantPublicKey: cfg.merchantPublicKey,
        orderAmount: cfg.orderAmount,
        orderCurrency: cfg.orderCurrency,
        merchantReferenceId: cfg.merchantReferenceId,
        timestamp: cfg.timestamp,
        signature: cfg.signature,
        callbackUrl: cfg.callbackUrl || callbackUrl,
        returnUrl,
        language: "ar",
        showEmail: "false",
        showPhone: "false",
      });
      if (customerEmail) params.set("customerEmail", customerEmail);
      if (customerPhone) {
        const clean = customerPhone.replace(/^\+966/, "").replace(/^966/, "").replace(/^0/, "");
        params.set("customerPhone", clean);
        params.set("customerMobileCountryCode", "966");
      }
      if (mountedRef.current) {
        setHppUrl(`${HPP_BASE}?${params.toString()}`);
        setStage("ready");
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = tc("تعذّر الاتصال ببوابة الدفع. تحقق من إعدادات Geidea.", "Could not connect to payment gateway. Check Geidea settings.");
      setErrorMsg(msg);
      setStage("error");
      onError(msg);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (payCfg !== undefined) fetchConfig();
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
        const responseCode = params.get("responseCode") || params.get("Response") || "";
        const status = params.get("status") || params.get("Status") || "";
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
    } catch {
    }
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
        <Button variant="outline" onClick={() => { setStage("loading"); fetchConfig(); }} className="mt-2 gap-2" data-testid="button-retry-geidea">
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

  if (stage === "iframe") {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col" data-testid="geidea-iframe-overlay">
        <div className="flex items-center justify-between px-4 py-2 bg-primary text-white text-sm font-semibold shrink-0">
          <span>🔒 {tc("الدفع الآمن — Geidea", "Secure Payment — Geidea")}</span>
          <button
            onClick={() => { setStage("ready"); onCancel(); }}
            className="text-white/80 hover:text-white text-lg font-bold leading-none px-2"
            data-testid="button-close-geidea-iframe"
          >
            ✕
          </button>
        </div>
        <iframe
          src={hppUrl}
          className="flex-1 w-full border-none"
          title="Geidea Payment"
          allow="payment *"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
          onLoad={handleIframeLoad}
          data-testid="iframe-geidea-hpp"
        />
      </div>
    );
  }

  return (
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
  );
}

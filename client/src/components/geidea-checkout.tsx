import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard, CheckCircle, AlertCircle, ShieldCheck,
  FlaskConical, RefreshCw, Lock, Wifi, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface GeideaCheckoutProps {
  orderNumber: string;
  amount: number;
  customerPhone?: string;
  customerEmail?: string;
  containerId: string;
  onSuccess: (data?: any) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type PayState = "idle" | "loading-sdk" | "creating-session" | "paying" | "success" | "error" | "simulating";

declare global {
  interface Window {
    GeideaCheckout: new (
      onSuccess: (data: any) => void,
      onError: (data: any) => void,
      onCancel: (data?: any) => void
    ) => { startPayment: (sessionId: string, locale?: string | null, containerId?: string) => void };
    _geideaSdkLoaded?: boolean;
  }
}

async function loadGeideaSDK(): Promise<void> {
  if (window._geideaSdkLoaded && typeof window.GeideaCheckout !== "undefined") return;
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("geidea-sdk-script");
    if (existing) {
      if (typeof window.GeideaCheckout !== "undefined") {
        window._geideaSdkLoaded = true;
        resolve();
      } else {
        existing.addEventListener("load", () => { window._geideaSdkLoaded = true; resolve(); });
        existing.addEventListener("error", reject);
      }
      return;
    }
    const script = document.createElement("script");
    script.id = "geidea-sdk-script";
    script.src = "/geideaCheckout.min.js";
    script.onload = () => { window._geideaSdkLoaded = true; resolve(); };
    script.onerror = () => {
      const s2 = document.createElement("script");
      s2.src = "https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js";
      s2.onload = () => { window._geideaSdkLoaded = true; resolve(); };
      s2.onerror = () => reject(new Error("Failed to load Geidea SDK"));
      document.head.appendChild(s2);
    };
    document.head.appendChild(script);
  });
}

export default function GeideaCheckoutWidget({
  orderNumber,
  amount,
  customerPhone,
  customerEmail,
  containerId,
  onSuccess,
  onError,
  onCancel,
}: GeideaCheckoutProps) {
  const [state, setState] = useState<PayState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const mountedRef = useRef(true);

  const { data: payCfg } = useQuery<{
    paymentTestMode: boolean;
    provider: string;
    geideaConfigured: boolean;
  }>({
    queryKey: ["/api/payments/config"],
    staleTime: 30000,
  });

  const isTestMode = !!payCfg?.paymentTestMode;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleSimulate = useCallback(async () => {
    if (!mountedRef.current) return;
    setState("simulating");
    try {
      const res = await fetch("/api/payments/sdk-fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, amount, currency: "SAR" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (mountedRef.current) setState("success");
        onSuccess();
      } else {
        throw new Error(data.error || "simulation_failed");
      }
    } catch {
      if (mountedRef.current) {
        setState("error");
        setErrorMsg("فشل في محاكاة الدفع. حاول مرة أخرى.");
      }
    }
  }, [orderNumber, amount, onSuccess]);

  const startDropIn = useCallback(async () => {
    if (isTestMode) { await handleSimulate(); return; }
    if (!mountedRef.current) return;

    try {
      setState("loading-sdk");
      await loadGeideaSDK();
      if (!mountedRef.current) return;

      setState("creating-session");
      const returnUrl = `${window.location.origin}/payment-return?orderNumber=${encodeURIComponent(orderNumber)}`;
      const initRes = await fetch("/api/payments/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          orderId: orderNumber,
          currency: "SAR",
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
          returnUrl,
        }),
      });

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        if (mountedRef.current) {
          setState("error");
          setErrorMsg(err.details || err.error || "فشل في إنشاء جلسة الدفع");
        }
        return;
      }

      const initData = await initRes.json();
      if (!mountedRef.current) return;

      const sessionId = initData.sessionId;
      if (!sessionId) {
        setState("error");
        setErrorMsg("لم يتم الحصول على رقم جلسة الدفع");
        return;
      }

      setState("paying");

      const payment = new window.GeideaCheckout(
        (data: any) => {
          if (!mountedRef.current) return;
          setState("success");
          onSuccess(data);
        },
        (data: any) => {
          if (!mountedRef.current) return;
          const msg =
            data?.detailedResponseMessage ||
            data?.responseMessage ||
            "حدث خطأ في الدفع";
          setState("error");
          setErrorMsg(msg);
          onError(msg);
        },
        (data?: any) => {
          if (!mountedRef.current) return;
          setState("idle");
          onCancel();
        }
      );

      // Drop-in mode: embed inside the div with the given containerId
      payment.startPayment(sessionId, null, containerId);

    } catch (err: any) {
      if (!mountedRef.current) return;
      setState("error");
      setErrorMsg(err.message || "تعذّر الاتصال بخدمة الدفع");
    }
  }, [isTestMode, handleSimulate, orderNumber, amount, customerEmail, customerPhone, containerId, onSuccess, onError, onCancel]);

  // Auto-start drop-in on mount
  useEffect(() => {
    if (state === "idle" && orderNumber && amount > 0) {
      startDropIn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Success state (brief flash before parent handles it) ─────────
  if (state === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <p className="font-bold text-green-700">تم الدفع بنجاح! جاري معالجة طلبك...</p>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-bold text-base">تعذّر إتمام الدفع</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{errorMsg}</p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button onClick={startDropIn} className="gap-2 w-full" data-testid="button-retry-geidea">
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} className="w-full text-xs text-muted-foreground">
            إلغاء
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading / preparing ──────────────────────────────────────────
  if (state === "loading-sdk" || state === "creating-session" || state === "simulating") {
    const msg =
      state === "loading-sdk" ? "جاري تحميل بوابة الدفع..." :
      state === "simulating" ? "جاري محاكاة الدفع التجريبي..." :
      "جاري تحضير نموذج الدفع...";
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <CreditCard className="absolute inset-0 m-auto w-6 h-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{msg}</p>
      </div>
    );
  }

  // ── Paying: Geidea drop-in iframe renders inside the container div ─
  // We just return null here — the Geidea iframe is injected into the containerId div
  if (state === "paying") {
    return null;
  }

  // ── Idle fallback (shouldn't normally show) ──────────────────────
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Button onClick={startDropIn} size="lg" className="gap-2 w-full h-14 text-base font-bold" data-testid="button-open-geidea">
        <CreditCard className="w-5 h-5" />
        ادفع الآن
      </Button>
    </div>
  );
}

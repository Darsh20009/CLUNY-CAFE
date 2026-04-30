import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    GeideaExpressCheckout?: new () => {
      create: (config: {
        sessionId: string;
        onSuccess: (data: any) => void;
        onError: (data: any) => void;
        onCancel: (data?: any) => void;
      }) => Promise<{ mount: (selector: string) => void }>;
    };
    _geideaExpressSdkLoaded?: boolean;
  }
}

const SDK_URL = "https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js";

function loadGeideaExpressSDK(): Promise<void> {
  if (typeof window.GeideaExpressCheckout !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("geidea-sdk-script");
    if (existing) {
      if (typeof window.GeideaExpressCheckout !== "undefined") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Geidea SDK")));
      return;
    }
    const script = document.createElement("script");
    script.id = "geidea-sdk-script";
    script.src = SDK_URL;
    // Per Geidea docs: NO defer / NO async on Express Checkout SDK.
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Geidea SDK"));
    document.head.appendChild(script);
  });
}

interface ExpressCheckoutWalletProps {
  amount: number;
  orderId?: string;
  wallet?: "apple-pay" | "google-pay" | "samsung-pay";
  label?: string;
  customerEmail?: string;
  customerPhone?: string;
  containerId: string;
  onSuccess: (data: any) => void;
  onError: (message: string) => void;
  onCancel?: () => void;
}

export default function ExpressCheckoutWallet({
  amount,
  orderId,
  wallet = "apple-pay",
  label,
  customerEmail,
  customerPhone,
  containerId,
  onSuccess,
  onError,
  onCancel,
}: ExpressCheckoutWalletProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    let cancelled = false;

    const init = async () => {
      try {
        // Run SDK load + session creation in parallel.
        const [, sessionRes] = await Promise.all([
          loadGeideaExpressSDK(),
          fetch("/api/payments/express-checkout/init-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount,
              orderId,
              wallet,
              label,
              currency: "SAR",
              customerEmail,
              customerPhone,
              returnUrl: `${window.location.origin}/payment-return?orderNumber=${encodeURIComponent(orderId || "")}`,
            }),
          }),
        ]);
        if (cancelled) return;

        const sessionData = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok || !sessionData.sessionId) {
          throw new Error(sessionData.error || "تعذّر إنشاء جلسة الدفع");
        }

        if (typeof window.GeideaExpressCheckout === "undefined") {
          throw new Error("لم يتم تحميل مكتبة Geidea بشكل صحيح");
        }

        const api = new window.GeideaExpressCheckout();
        const expressCheckout = await api.create({
          sessionId: sessionData.sessionId,
          onSuccess: (data: any) => {
            if (data?.responseCode === "000" || data?.detailedResponseCode === "000") {
              onSuccess(data);
            } else {
              onError(data?.detailedResponseMessage || data?.responseMessage || "فشل الدفع");
            }
          },
          onError: (data: any) => {
            const msg = data?.detailedResponseMessage || data?.responseMessage || "فشل الدفع";
            onError(msg);
          },
          onCancel: () => {
            if (onCancel) onCancel();
          },
        });

        if (cancelled) return;
        expressCheckout.mount(`#${containerId}`);
        setState("ready");
      } catch (err: any) {
        if (cancelled) return;
        setErrorMsg(err.message || "خطأ غير متوقع");
        setState("error");
      }
    };

    init();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full">
      {state === "loading" && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground" data-testid="status-express-checkout-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري تحضير الدفع السريع...
        </div>
      )}
      {state === "error" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900" data-testid="status-express-checkout-error">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{errorMsg}</div>
        </div>
      )}
      {/* Geidea SDK mounts the wallet button(s) inside this container */}
      <div
        id={containerId}
        data-testid={`container-express-checkout-${wallet}`}
        style={{ width: "100%", minHeight: state === "ready" ? "48px" : "0" }}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    GeideaExpressCheckout?: new () => {
      create: (config: {
        sessionId: string;
        appearance?: any;
        styles?: any;
        onSuccess: (data: any) => void;
        onError: (data: any) => void;
        onCancel: (data?: any) => void;
      }) => Promise<{ mount: (selector: string) => void }>;
    };
    _geideaExpressSdkLoaded?: boolean;
  }
}

const SDK_URL = "https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js";

// ── Default appearance the Geidea SDK expects on session responses ──
// The SDK destructures `session.appearance.styles` and `session.appearance.uiMode`.
// When the session is created without an explicit appearance config, Geidea returns
// `appearance: null`, and the SDK then crashes with:
//   "Cannot read properties of undefined (reading 'headerColor')"
// To work around this, we intercept the XHR call to the session GET endpoint and
// inject a default appearance object before the SDK reads it.
const DEFAULT_APPEARANCE = {
  styles: {
    headerColor: "#000000",
    accentColor: "#000000",
    accentTextColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
    backgroundTextColor: "#232323",
    fontFamily: "inherit",
    hppColor: "#FFFFFF",
    fieldColor: "#F2F2F2",
    textColor: "#283B54",
    borderRadius: 8,
  },
  uiMode: "Light",
  showEmail: false,
  showPhone: false,
  showAddress: false,
  receiptPage: false,
  merchant: { name: "CLUNY CAFE", logoUrl: "" },
};

function installGeideaSessionPatch() {
  if ((window as any)._geideaSessionPatchInstalled) return;
  (window as any)._geideaSessionPatchInstalled = true;

  const OrigXHR = window.XMLHttpRequest;
  const origDescriptor = Object.getOwnPropertyDescriptor(OrigXHR.prototype, "responseText");
  const origResponseDescriptor = Object.getOwnPropertyDescriptor(OrigXHR.prototype, "response");
  if (!origDescriptor?.get) return; // unsupported environment, give up silently

  class PatchedXHR extends OrigXHR {
    private _patchUrl = "";
    private _cachedText: string | null = null;
    constructor() {
      super();
      const self = this;
      Object.defineProperty(self, "responseText", {
        configurable: true,
        get() {
          return self._readPatched(origDescriptor!.get!.call(self));
        },
      });
      if (origResponseDescriptor?.get) {
        Object.defineProperty(self, "response", {
          configurable: true,
          get() {
            const raw = origResponseDescriptor!.get!.call(self);
            if (typeof raw !== "string") return raw;
            return self._readPatched(raw);
          },
        });
      }
    }
    private _readPatched(raw: any): any {
      if (this._cachedText !== null) return this._cachedText;
      if (this.readyState !== 4) return raw;
      if (!/\/payment-intent\/api\/v\d+\/session\//.test(this._patchUrl)) return raw;
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (data?.session && data.session.appearance == null) {
          data.session.appearance = DEFAULT_APPEARANCE;
          this._cachedText = JSON.stringify(data);
          return this._cachedText;
        }
      } catch {}
      return raw;
    }
    open(method: string, url: string, ...rest: any[]): void {
      this._patchUrl = url;
      // @ts-ignore - forward all args
      return super.open(method, url, ...rest);
    }
  }
  window.XMLHttpRequest = PatchedXHR as any;
}

function loadGeideaExpressSDK(): Promise<void> {
  installGeideaSessionPatch();
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

        // Intercept SDK's console.error + console.log so we can capture the underlying
        // "Failed to load wallet information" error AND any network errors logged by bt().
        let sdkInternalError: any = null;
        const originalConsoleError = console.error;
        const originalConsoleLog = console.log;
        const captureSdkError = (label: string, args: any[]) => {
          try {
            const payload = args?.[1] ?? args?.[0];
            sdkInternalError = sdkInternalError || payload;
            const msg = (() => {
              try {
                if (payload?.message) return payload.message;
                if (typeof payload === "string") return payload;
                return JSON.stringify(payload).substring(0, 400);
              } catch {
                return String(payload);
              }
            })();
            originalConsoleLog.call(console, `[ExpressCheckout][${label}]`, msg);
          } catch {}
        };
        console.error = (...args: any[]) => {
          const first = args?.[0];
          if (typeof first === "string" && first.includes("Failed to load wallet information")) {
            captureSdkError("WALLET-FAIL", args);
          }
          originalConsoleError.apply(console, args);
        };
        console.log = (...args: any[]) => {
          // bt() rejection in SDK does `console.log(e)` with the error object
          const first = args?.[0];
          if (
            first &&
            typeof first === "object" &&
            (first.detailedResponseCode || first.responseCode || first.detailedResponseMessage)
          ) {
            captureSdkError("NETWORK", args);
          }
          originalConsoleLog.apply(console, args);
        };

        const restoreLoggers = () => {
          console.error = originalConsoleError;
          console.log = originalConsoleLog;
        };

        let expressCheckout: { mount: (selector: string) => void } | null = null;
        try {
          const api = new window.GeideaExpressCheckout();
          expressCheckout = await api.create({
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
        } catch (sdkErr: any) {
          restoreLoggers();
          const detail = sdkInternalError
            ? sdkInternalError?.detailedResponseMessage ||
              sdkInternalError?.responseMessage ||
              sdkInternalError?.message ||
              JSON.stringify(sdkInternalError).substring(0, 300)
            : sdkErr?.message || String(sdkErr);
          throw new Error(`[Geidea] ${detail}`);
        }
        restoreLoggers();

        if (cancelled || !expressCheckout) return;
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

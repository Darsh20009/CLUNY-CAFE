import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    ApplePaySession?: any;
  }
}

interface ApplePayNativeProps {
  amount: number;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
  onSuccess: (transactionId?: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type State = "idle" | "loading" | "processing" | "success" | "error" | "unsupported";

function isApplePaySupported(): boolean {
  try {
    return !!(
      typeof window !== "undefined" &&
      window.ApplePaySession &&
      window.ApplePaySession.canMakePayments()
    );
  } catch {
    return false;
  }
}

export default function ApplePayNative({
  amount,
  orderId,
  customerEmail,
  customerPhone,
  onSuccess,
  onError,
  onCancel,
}: ApplePayNativeProps) {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!isApplePaySupported()) {
      setState("unsupported");
    }
    return () => { mountedRef.current = false; };
  }, []);

  const { data: merchantData } = useQuery<{ merchantId: string }>({
    queryKey: ["/api/payments/apple-pay/merchant-id"],
    staleTime: 60000,
  });

  const startApplePay = useCallback(async () => {
    if (!isApplePaySupported()) {
      setState("unsupported");
      return;
    }

    const merchantId = merchantData?.merchantId || "merchant.net.geidea.ksamerchant";

    const paymentRequest = {
      countryCode: "SA",
      currencyCode: "SAR",
      supportedNetworks: ["visa", "masterCard", "mada"],
      merchantCapabilities: ["supports3DS"],
      total: {
        label: "CLUNY CAFE",
        amount: Number(amount).toFixed(2),
        type: "final",
      },
    };

    let session: any;
    try {
      session = new window.ApplePaySession!(3, paymentRequest);
    } catch (e: any) {
      setState("error");
      setErrorMsg("تعذّر فتح نافذة Apple Pay. تأكد من أن جهازك يدعم Apple Pay.");
      return;
    }

    setState("loading");

    session.onvalidatemerchant = async (event: any) => {
      try {
        const res = await fetch("/api/payments/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validationURL: event.validationURL }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "فشل التحقق من التاجر");
        }
        const merchantSession = await res.json();
        session.completeMerchantValidation(merchantSession);
      } catch (err: any) {
        console.error("[Apple Pay] validatemerchant error:", err);
        session.abort();
        if (mountedRef.current) {
          setState("error");
          setErrorMsg(err.message || "فشل التحقق من بيانات التاجر");
          onError(err.message || "فشل التحقق من بيانات التاجر");
        }
      }
    };

    session.onpaymentmethodselected = (event: any) => {
      session.completePaymentMethodSelection({
        newTotal: {
          label: "CLUNY CAFE",
          amount: Number(amount).toFixed(2),
          type: "final",
        },
      });
    };

    session.onpaymentauthorized = async (event: any) => {
      if (mountedRef.current) setState("processing");
      try {
        const res = await fetch("/api/payments/apple-pay/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applePayToken: event.payment.token,
            amount,
            currency: "SAR",
            orderId,
            customerEmail,
            customerPhone,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "فشلت عملية الدفع");
        }
        session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
        if (mountedRef.current) {
          setState("success");
          onSuccess(data.transactionId);
        }
      } catch (err: any) {
        session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        if (mountedRef.current) {
          setState("error");
          setErrorMsg(err.message || "فشلت عملية الدفع");
          onError(err.message || "فشلت عملية الدفع");
        }
      }
    };

    session.oncancel = () => {
      if (mountedRef.current) {
        setState("idle");
        onCancel();
      }
    };

    try {
      session.begin();
    } catch (e: any) {
      setState("error");
      setErrorMsg("تعذّر بدء جلسة Apple Pay");
    }
  }, [amount, orderId, customerEmail, customerPhone, merchantData, onSuccess, onError, onCancel]);

  if (state === "unsupported") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <div>
          <p className="font-bold text-sm">Apple Pay غير متاح</p>
          <p className="text-xs text-muted-foreground mt-1">
            يرجى فتح هذه الصفحة على Safari من جهاز Apple مع بطاقة مضافة في Wallet
          </p>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <p className="font-bold text-green-700">تم الدفع بنجاح!</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-bold">تعذّر إتمام الدفع</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
        <Button onClick={startApplePay} className="gap-2 w-full" data-testid="button-retry-applepay">
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (state === "loading" || state === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-black/10" />
          <div className="absolute inset-0 rounded-full border-4 border-black border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {state === "loading" ? "جاري تجهيز Apple Pay..." : "جاري معالجة الدفع..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4">
      <p className="text-sm text-muted-foreground text-center">
        المبلغ المطلوب: <span className="font-bold text-foreground">{Number(amount).toFixed(2)} ر.س</span>
      </p>
      <button
        onClick={startApplePay}
        data-testid="button-apple-pay-native"
        className="w-full h-14 rounded-xl bg-black text-white flex items-center justify-center gap-2 text-lg font-semibold hover:bg-black/90 active:scale-[0.98] transition-all duration-150 shadow-lg"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
      >
        <svg viewBox="0 0 165.521 128" className="h-8 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M150.698 0H14.823C6.634 0 0 6.634 0 14.823v98.354C0 121.366 6.634 128 14.823 128h135.875c8.189 0 14.823-6.634 14.823-14.823V14.823C165.521 6.634 158.887 0 150.698 0zm-78.48 100.219c-10.136 0-17.738-6.935-17.738-6.935s-4.558 6.935-11.942 6.935c-3.944 0-7.11-1.385-9.416-3.804-3.249-3.386-4.748-8.76-4.748-16.597 0-7.951 1.614-13.459 4.938-16.77a13.31 13.31 0 0 1 9.378-3.842c3.288 0 5.632.654 7.569 1.997 1.671 1.154 3.019 2.729 4.082 4.673l.192-5.88h9.607v40.224H52.74v-4.787c-1.881 3.38-5.785 5.786-10.521 5.786zm-28.57-19.492c0 5.556 1.882 8.952 5.978 8.952 4.096 0 6.015-3.433 6.015-8.952 0-5.519-1.919-8.952-6.015-8.952-4.096 0-5.978 3.396-5.978 8.952zm67.37 19.492c-3.288 0-5.632-.692-7.606-2.035-1.67-1.154-3.019-2.729-4.082-4.672l-.192 5.88H89.53V59.167h9.608v5.017c1.919-3.38 5.785-5.786 10.483-5.786 3.289 0 6.322 1.115 8.627 3.49 3.249 3.386 4.748 8.683 4.748 16.636 0 7.952-1.614 13.326-4.939 16.674a13.203 13.203 0 0 1-9.34 3.804l.001.735zm-5.44-10.54c4.096 0 5.978-3.395 5.978-8.951 0-5.557-1.882-8.953-5.978-8.953s-6.015 3.434-6.015 8.953c0 5.518 1.919 8.951 6.015 8.951zm-24.818 9.804h-9.607V27.78h9.607v72.443z"/>
        </svg>
        <span>Pay</span>
      </button>
      <p className="text-xs text-muted-foreground text-center">
        الدفع الآمن عبر Apple Pay بـ Face ID أو Touch ID
      </p>
    </div>
  );
}

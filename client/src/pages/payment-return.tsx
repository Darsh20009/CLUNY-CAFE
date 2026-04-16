import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentStatus = "loading" | "success" | "failed" | "pending";

export default function PaymentReturnPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const orderNum = params.get("orderNumber");
    const provider = params.get("provider") || "geidea";

    // Geidea passes these params when redirecting back
    const geideaResponseCode = params.get("geideaResponseCode") || params.get("responseCode");
    const geideaStatus = params.get("geideaStatus") || params.get("status");
    const geideaOrderId = params.get("geideaOrderId") || params.get("orderId");
    const geideaMerchantRefId = params.get("geideaMerchantRefId") || params.get("merchantReferenceId");
    const geideaAmount = params.get("geideaAmount") || params.get("amount");
    const geideaCurrency = params.get("geideaCurrency") || params.get("currency");
    const geideaSignature = params.get("geideaSignature") || params.get("signature");

    setOrderNumber(orderNum);

    const verifyPayment = async () => {
      try {
        const body: any = {
          provider,
          sessionId: geideaOrderId || geideaMerchantRefId,
        };

        if (geideaResponseCode !== null) {
          body.geideaResponseCode = geideaResponseCode;
          body.geideaStatus = geideaStatus;
          body.geideaOrderId = geideaOrderId;
          body.geideaMerchantRefId = geideaMerchantRefId;
          body.geideaAmount = geideaAmount;
          body.geideaCurrency = geideaCurrency;
          body.geideaSignature = geideaSignature;
        }

        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (data.verified) {
          if (orderNum) {
            await fetch("/api/payments/confirm-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderNumber: orderNum }),
            }).catch(() => {});
          }
          setStatus("success");
          setMessage("تمت عملية الدفع بنجاح! شكراً لك.");
        } else {
          // Check responseCode directly as fallback
          const isPaidByCode = geideaResponseCode === "000" ||
            geideaStatus === "Success" ||
            geideaStatus === "succeeded";

          if (isPaidByCode) {
            setStatus("success");
            setMessage("تمت عملية الدفع بنجاح! شكراً لك.");
          } else if (geideaResponseCode !== null) {
            setStatus("failed");
            setMessage("لم تتم عملية الدفع. يرجى المحاولة مرة أخرى.");
          } else {
            setStatus("pending");
            setMessage("جاري التحقق من حالة الدفع...");
          }
        }
      } catch (err) {
        console.error("[PaymentReturn] Verify error:", err);
        // If we have a response code, use it directly
        if (geideaResponseCode === "000" || geideaStatus === "Success") {
          setStatus("success");
          setMessage("تمت عملية الدفع بنجاح! شكراً لك.");
        } else {
          setStatus("failed");
          setMessage("حدث خطأ أثناء التحقق من الدفع.");
        }
      }
    };

    verifyPayment();
  }, []);

  const handleGoToOrders = () => {
    if (orderNumber) {
      navigate(`/tracking?order=${orderNumber}`);
    } else {
      navigate("/my-orders");
    }
  };

  const handleRetry = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <Coffee className="w-16 h-16 text-primary" />
          </div>
        </div>

        <div className="space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
              <h1 className="text-2xl font-bold">جاري التحقق من الدفع...</h1>
              <p className="text-muted-foreground">يرجى الانتظار، لا تغلق هذه الصفحة</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center">
                <CheckCircle className="w-20 h-20 text-green-500 animate-in zoom-in duration-500" />
              </div>
              <h1 className="text-3xl font-bold text-green-600">تم الدفع بنجاح!</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              {orderNumber && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">رقم الطلب</p>
                  <p className="text-xl font-bold font-mono text-green-700 dark:text-green-400">#{orderNumber}</p>
                </div>
              )}
              <Button
                size="lg"
                className="w-full"
                onClick={handleGoToOrders}
                data-testid="button-view-order"
              >
                تتبع طلبك
              </Button>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="flex justify-center">
                <XCircle className="w-20 h-20 text-red-500 animate-in zoom-in duration-500" />
              </div>
              <h1 className="text-3xl font-bold text-red-600">فشل الدفع</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleRetry}
                  data-testid="button-retry-payment"
                >
                  إعادة المحاولة
                </Button>
              </div>
            </>
          )}

          {status === "pending" && (
            <>
              <div className="flex justify-center">
                <Loader2 className="w-20 h-20 text-yellow-500 animate-spin" />
              </div>
              <h1 className="text-3xl font-bold text-yellow-600">جاري المعالجة</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleGoToOrders}
                data-testid="button-check-order"
              >
                التحقق من حالة الطلب
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          مدعوم بواسطة Geidea Payment Gateway
        </p>
      </div>
    </div>
  );
}

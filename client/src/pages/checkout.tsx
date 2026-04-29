import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useCartStore } from "@/lib/cart-store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PaymentMethods from "@/components/payment-methods";
import GeideaCheckoutWidget, { preloadGeideaSDK } from "@/components/geidea-checkout";
import { customerStorage } from "@/lib/customer-storage";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLoyaltyCard } from "@/hooks/useLoyaltyCard";
import LoyaltyCardComponent from "@/components/loyalty-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { User, Gift, CheckCircle, Sparkles, Loader2, Ticket, Tag, Wrench, Coffee, Award, CreditCard, Star, Coins, X, ChevronLeft, ShieldCheck, Lock, Printer, MapPin, Navigation, ClipboardList, Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PaymentMethodInfo, PaymentMethod } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import { downloadInvoicePDF } from "@/lib/print-utils";


function LoyaltyCheckoutCard({
  loyaltyCard,
  loyaltyPoints,
  pointsPerSar,
  minPointsForRedemption,
  pointsToRedeem,
  onApplyPoints,
  onCancelPoints,
  baseTotal,
}: {
  loyaltyCard: any;
  loyaltyPoints: number;
  pointsPerSar: number;
  minPointsForRedemption: number;
  pointsToRedeem: number;
  onApplyPoints: (pts: number) => void;
  onCancelPoints: () => void;
  baseTotal: number;
}) {
  const isApplied = pointsToRedeem > 0;
  const totalPointsValue = parseFloat((loyaltyPoints / pointsPerSar).toFixed(2));
  const appliedDiscount = parseFloat((pointsToRedeem / pointsPerSar).toFixed(2));

  const canRedeem = loyaltyPoints >= minPointsForRedemption;
  // Cap max redeemable points at what's needed to cover the order (no wasteful over-redemption)
  const maxRedeemable = Math.min(loyaltyPoints, Math.ceil(baseTotal * pointsPerSar));
  const [inputVal, setInputVal] = useState(() =>
    canRedeem ? Math.min(minPointsForRedemption, maxRedeemable) : 0
  );

  return (
    <div className="space-y-3" data-testid="loyalty-checkout-section">
      {/* Card — new design */}
      <LoyaltyCardComponent card={loyaltyCard} compact={true} showActions={false} />

      {/* Applied state */}
      {isApplied && (
        <div className="flex items-center justify-between gap-3 bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-xl p-3" data-testid="points-applied-banner">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 flex-1 min-w-0">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">تم تطبيق خصم النقاط ✓</p>
              <p className="text-xs opacity-80">
                {pointsToRedeem.toLocaleString()} نقطة = <span className="font-black">{appliedDiscount.toFixed(2)} ريال</span> خصم
                {appliedDiscount >= baseTotal && <span className="text-green-600 font-bold mr-1">· يغطي المبلغ كاملاً!</span>}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700 h-7 px-2 text-xs flex-shrink-0 gap-1"
            onClick={onCancelPoints}
            data-testid="button-cancel-points"
          >
            <X className="w-3 h-3" />
            إلغاء
          </Button>
        </div>
      )}

      {/* Redemption UI */}
      {!isApplied && canRedeem && (
        <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-4 space-y-3 bg-amber-50/50 dark:bg-amber-900/10" data-testid="points-redeem-section">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">استخدم نقاطك كخصم</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={minPointsForRedemption}
                max={maxRedeemable}
                step={Math.max(1, Math.floor(maxRedeemable / 100))}
                value={Math.min(inputVal, maxRedeemable)}
                onChange={e => setInputVal(Number(e.target.value))}
                className="flex-1 accent-amber-500"
                data-testid="slider-points"
              />
              <div className="text-right min-w-[80px]">
                <p className="text-sm font-black text-amber-700 dark:text-amber-400">{inputVal.toLocaleString()}</p>
                <p className="text-[10px] text-amber-600/70">نقطة</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">{minPointsForRedemption} (الحد الأدنى)</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                = {parseFloat((Math.min(inputVal, maxRedeemable) / pointsPerSar).toFixed(2)).toFixed(2)} ريال خصم
              </span>
            </div>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold h-10 gap-2"
            onClick={() => onApplyPoints(Math.min(inputVal, maxRedeemable))}
            data-testid="button-apply-points"
          >
            <Coins className="w-4 h-4" />
            طبّق خصم {parseFloat((Math.min(inputVal, maxRedeemable) / pointsPerSar).toFixed(2)).toFixed(2)} ريال
          </Button>
        </div>
      )}

      {!isApplied && !canRedeem && loyaltyPoints > 0 && (
        <div className="text-center px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            تحتاج {(minPointsForRedemption - loyaltyPoints).toLocaleString()} نقطة إضافية للاستبدال
          </p>
          <p className="text-[10px] text-amber-600/70 mt-0.5">الحد الأدنى: {minPointsForRedemption} نقطة</p>
        </div>
      )}

      {!isApplied && loyaltyPoints === 0 && (
        <div className="text-center px-3 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/50">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">🎯 اكسب نقاطك عند إتمام طلبك!</p>
          <p className="text-[11px] text-amber-600/70 mt-1">
            ابدأ باكتساب {minPointsForRedemption} نقطة للحصول على أول خصم بقيمة {(minPointsForRedemption / pointsPerSar).toFixed(2)} ريال
          </p>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { cartItems, clearCart, getFinalTotal, deliveryInfo } = useCartStore();
  const { toast } = useToast();
  const isAr = i18n.language === 'ar';

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashDistanceError, setCashDistanceError] = useState<string | null>(null);
  const [cashDistanceChecking, setCashDistanceChecking] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showInlineGeidea, setShowInlineGeidea] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  useEffect(() => {
    try { setApplePayAvailable(!!(window as any).ApplePaySession?.canMakePayments()); } catch {}
    // Warm up the Geidea SDK in the background so the card-payment flow
    // doesn't pay the script-download cost when the user clicks "Card".
    preloadGeideaSDK();
  }, []);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [showSuccessPage, setShowSuccessPage] = useState(false);
  const [copiedOrderNum, setCopiedOrderNum] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [wantToRegister, setWantToRegister] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{code: string, percentage: number, isOffer?: boolean} | null>(null);
  const [showCouponSuggestions, setShowCouponSuggestions] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const { card: loyaltyCard, refetch: refetchLoyaltyCard } = useLoyaltyCard();

  const { data: loyaltySettings } = useQuery<any>({
    queryKey: ["/api/public/loyalty-settings"],
    staleTime: 60000,
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    staleTime: 300000,
  });

  const pointsPerSar: number = loyaltySettings?.pointsPerSar ?? 50;
  const minPointsForRedemption: number = loyaltySettings?.minPointsForRedemption ?? 100;
  const loyaltyPoints: number = loyaltyCard?.points || 0;

  const getServiceFee = () => 0;

  const getBaseTotal = () => {
    let total = getFinalTotal();
    if (appliedDiscount) {
      total = total * (1 - appliedDiscount.percentage / 100);
    }
    return Math.max(0, total);
  };

  const usePointsAsDiscount = pointsToRedeem > 0;
  const pointsDiscountSAR = pointsToRedeem > 0
    ? parseFloat((pointsToRedeem / pointsPerSar).toFixed(2))
    : 0;

  const getFinalTotalWithPoints = () => {
    const base = getBaseTotal();
    if (usePointsAsDiscount && pointsDiscountSAR > 0) {
      return Math.max(0, base - pointsDiscountSAR);
    }
    return base;
  };
  const [isRegistering, setIsRegistering] = useState(false);
  const { customer, setCustomer } = useCustomer();
  const isGuestMode = !customer && customerStorage.isGuestMode();

  useEffect(() => {
    if (customer) {
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone);
      if (customer.email) setCustomerEmail(customer.email);
    } else {
      const guestInfo = customerStorage.getGuestInfo();
      if (guestInfo) {
        setCustomerName(guestInfo.name);
        setCustomerPhone(guestInfo.phone);
      }
    }
  }, [customer]);

  // Reset payment method if invalid selection
  useEffect(() => {
    if (selectedPaymentMethod === 'qahwa-card') {
      setSelectedPaymentMethod(null);
    }
  }, [selectedPaymentMethod]);

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const pendingGeideaOrderData = useRef<any>(null);
  const geideaOrderNum = useRef<string>("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentCallback = urlParams.get('payment') === 'callback';

    // Also detect Geidea's own callback params (they redirect directly with these params)
    const geideaResponseCode = urlParams.get('responseCode') || urlParams.get('Response') || urlParams.get('response_code');
    const geideaOrderId = urlParams.get('orderId') || urlParams.get('order_id');
    const geideaStatus = urlParams.get('status') || urlParams.get('Status');
    const geideaSignature = urlParams.get('signature') || urlParams.get('Signature');
    const geideaAmount = urlParams.get('amount') || urlParams.get('Amount') || urlParams.get('orderAmount');
    const geideaCurrency = urlParams.get('currency') || urlParams.get('Currency');
    const geideaMerchantRefId = urlParams.get('merchantReferenceId') || urlParams.get('MerchantReferenceId');

    const hasGeideaParams = !!(geideaResponseCode || geideaOrderId || geideaStatus);

    // Detect Paymob callback params
    const paymobProvider = urlParams.get('provider');
    const paymobSuccess = urlParams.get('success');
    const paymobTransactionId = urlParams.get('id');
    const paymobPending = urlParams.get('pending');
    const hasPaymobParams = paymobProvider === 'paymob' && paymobSuccess !== null;

    if (isPaymentCallback || hasGeideaParams || hasPaymobParams) {
      const storedOrderData = sessionStorage.getItem('pendingOrderData');
      const storedSessionId = sessionStorage.getItem('paymentSessionId');
      const storedProvider = sessionStorage.getItem('paymentProvider');

      if (storedOrderData && (storedSessionId || hasGeideaParams || hasPaymobParams)) {
        setIsVerifyingPayment(true);
        (async () => {
          try {
            const verifyPayload: Record<string, any> = {
              sessionId: storedSessionId,
              provider: storedProvider || paymobProvider,
            };

            // Pass Geidea's callback parameters for faster/more accurate verification
            if (hasGeideaParams) {
              if (geideaResponseCode) verifyPayload.geideaResponseCode = geideaResponseCode;
              if (geideaOrderId) verifyPayload.geideaOrderId = geideaOrderId;
              if (geideaStatus) verifyPayload.geideaStatus = geideaStatus;
              if (geideaSignature) verifyPayload.geideaSignature = geideaSignature;
              if (geideaAmount) verifyPayload.geideaAmount = geideaAmount;
              if (geideaCurrency) verifyPayload.geideaCurrency = geideaCurrency;
              if (geideaMerchantRefId) verifyPayload.geideaMerchantRefId = geideaMerchantRefId;
            }

            // Pass Paymob callback parameters
            if (hasPaymobParams) {
              verifyPayload.paymobSuccess = paymobSuccess;
              verifyPayload.paymobTransactionId = paymobTransactionId;
              verifyPayload.paymobPending = paymobPending;
            }

            const verifyRes = await apiRequest("POST", "/api/payments/verify", verifyPayload);
            const verifyData = await verifyRes.json();

            sessionStorage.removeItem('pendingOrderData');
            sessionStorage.removeItem('paymentSessionId');
            sessionStorage.removeItem('paymentProvider');

            if (verifyData.verified) {
              const orderData = JSON.parse(storedOrderData);
              orderData.paymentStatus = 'paid';
              orderData.transactionId = verifyData.transactionId || geideaOrderId || paymobTransactionId;
              createOrderMutation.mutate(orderData);
            } else {
              toast({
                variant: "destructive",
                title: t("checkout.payment_failed"),
                description: verifyData.error || t("checkout.payment_verification_failed"),
              });
            }
          } catch {
            sessionStorage.removeItem('pendingOrderData');
            sessionStorage.removeItem('paymentSessionId');
            sessionStorage.removeItem('paymentProvider');
            toast({ variant: "destructive", title: t("checkout.error"), description: t("checkout.payment_status_check_failed") });
          } finally {
            setIsVerifyingPayment(false);
          }
        })();
      }
      window.history.replaceState({}, '', '/checkout');
    }
  }, []);

  useEffect(() => {
    const activeOffer = customerStorage.getActiveOffer();
    if (activeOffer && activeOffer.discount > 0 && !appliedDiscount) {
      const discountPercentage = activeOffer.type === 'loyalty' 
        ? 0 
        : activeOffer.discount;
      
      if (discountPercentage > 0) {
        setAppliedDiscount({
          code: activeOffer.title,
          percentage: discountPercentage,
          isOffer: true
        });
        toast({
          title: t("points.offer_applied"),
          description: `${activeOffer.title} - ${t("points.discount")} ${discountPercentage}%`,
        });
      }
    }
  }, []);

  const { data: paymentMethods = [] } = useQuery<PaymentMethodInfo[]>({
    queryKey: ["/api/payment-methods"],
    queryFn: async () => {
      const res = await fetch(`/api/payment-methods`);
      return res.json();
    }
  });

  const cashMethod = paymentMethods.find(m => m.id === 'cash');

  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    if (selectedPaymentMethod !== 'cash') {
      setCashDistanceError(null);
      return;
    }
    const maxDist = cashMethod?.cashMaxDistance || 0;
    const storeLoc = cashMethod?.storeLocation;
    if (!maxDist || maxDist <= 0 || !storeLoc?.lat || !storeLoc?.lng) {
      setCashDistanceError(null);
      return;
    }
    if (!navigator.geolocation) {
      setCashDistanceError('متصفحك لا يدعم تحديد الموقع، لا يمكن التحقق من المسافة للدفع نقداً');
      return;
    }
    setCashDistanceChecking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, storeLoc.lat!, storeLoc.lng!);
        setCashDistanceChecking(false);
        if (dist > maxDist) {
          setCashDistanceError(`أنت بعيد عن المتجر (${Math.round(dist)} متر). الدفع نقداً متاح فقط ضمن ${maxDist} متر من المتجر.`);
        } else {
          setCashDistanceError(null);
        }
      },
      () => {
        setCashDistanceChecking(false);
        setCashDistanceError('تعذّر تحديد موقعك. الرجاء السماح بالوصول للموقع للدفع نقداً.');
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [selectedPaymentMethod, cashMethod]);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      if (!response.ok) {
        const error = await response.json();
        const msg = error.details ? `${error.error}: ${error.details}` : (error.error || "فشل إنشاء الطلب");
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: async (data) => {
      if (usePointsAsDiscount) {
        try { await refetchLoyaltyCard(); } catch {}
      }
      setOrderDetails(data);
      clearCart();
      customerStorage.clearActiveOffer();
      setShowSuccessPage(true);
      setPointsToRedeem(0);
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/cards/phone"] });
      refetchLoyaltyCard();
      const displayNum = data.orderNumber;
      toast({ title: t("checkout.order_success"), description: `${t("tracking.order_number")}: ${displayNum}` });
    },
    onError: (error) => toast({ variant: "destructive", title: t("checkout.order_error"), description: error.message }),
  });

  const { data: coupons = [] } = useQuery<any[]>({
    queryKey: ["/api/discount-codes"],
  });

  const safeCoupons = Array.isArray(coupons) ? coupons.filter(c => c && c.code && typeof c.code === 'string') : [];

  const handleValidateDiscount = async (codeOverride?: string) => {
    const codeToUse = codeOverride || discountCode.trim();
    if (!codeToUse) return;
    
    setIsValidatingDiscount(true);
    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: codeToUse, 
          customerId: customer?.id,
          amount: getFinalTotal()
        }),
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setAppliedDiscount({ code: data.code, percentage: data.discountPercentage });
        setDiscountCode(data.code);
        setShowCouponSuggestions(false);
        toast({
          title: t("checkout.coupon_applied"),
          description: `${t("checkout.discount")}: ${data.discountPercentage}%`,
        });
      } else {
        setAppliedDiscount(null);
        toast({ 
          variant: "destructive", 
          title: t("checkout.invalid_discount"),
          description: data.error || data.message
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: t("checkout.error") });
    } finally { setIsValidatingDiscount(false); }
  };

  const beginApplePaySession = () => {
    // NOTE: This function MUST remain synchronous (no await before begin()).
    // Apple Pay requires apSession.begin() to be called within the same user-gesture
    // call stack (the click event). Any async/await before begin() causes Safari to
    // silently reject the session with InvalidAccessError.
    if (!customerName.trim()) {
      toast({ variant: "destructive", title: t("checkout.enter_customer_name") });
      return;
    }
    if (!(window as any).ApplePaySession?.canMakePayments()) {
      toast({ variant: "destructive", title: "Apple Pay غير متاح", description: "يرجى استخدام Safari على جهاز Apple مع بطاقة في Wallet" });
      return;
    }
    const apAmount = getFinalTotalWithPoints();
    const apOrderId = `CLN-${Date.now()}`;

    // geideaSessionId is populated during onvalidatemerchant (in parallel with merchant validation)
    // so it is ready by the time onpaymentauthorized fires.
    let geideaSessionId: string | null = null;

    let apSession: any;
    try {
      apSession = new (window as any).ApplePaySession(3, {
        countryCode: "SA", currencyCode: "SAR",
        supportedNetworks: ["visa", "masterCard", "mada"],
        merchantCapabilities: ["supports3DS"],
        total: { label: "CLUNY CAFE", amount: apAmount.toFixed(2), type: "final" },
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذّر فتح Apple Pay", description: e.message });
      return;
    }

    apSession.onvalidatemerchant = async (event: any) => {
      try {
        // Geidea Direct Apple Pay flow REQUIRES an active sessionId before
        // calling merchant-session, so we must run these sequentially:
        // 1) init-session → get Geidea sessionId
        // 2) validate-merchant → pass sessionId so Geidea authorizes the call
        const initRes = await fetch("/api/payments/apple-pay/init-session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: apAmount, currency: "SAR", orderId: apOrderId,
            customerEmail: customerEmail || customer?.email,
            customerPhone: customerPhone || customer?.phone,
          }),
        });
        const initData = await initRes.json().catch(() => ({}));
        if (!initRes.ok || !initData?.sessionId) {
          throw new Error(initData?.error || "فشل إنشاء جلسة الدفع");
        }
        geideaSessionId = initData.sessionId;

        const validRes = await fetch("/api/payments/apple-pay/validate-merchant", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validationURL: event.validationURL, sessionId: geideaSessionId }),
        });
        const validData = await validRes.json().catch(() => ({}));
        if (!validRes.ok) throw new Error(validData.error || "فشل التحقق من التاجر");
        apSession.completeMerchantValidation(validData);
      } catch (err: any) {
        apSession.abort();
        toast({ variant: "destructive", title: "خطأ في Apple Pay", description: err.message, duration: 8000 });
      }
    };
    apSession.onpaymentmethodselected = () => {
      apSession.completePaymentMethodSelection({ newTotal: { label: "CLUNY CAFE", amount: apAmount.toFixed(2), type: "final" } });
    };
    apSession.onpaymentauthorized = async (event: any) => {
      try {
        const payRes = await fetch("/api/payments/apple-pay/process", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applePayToken: event.payment.token, amount: apAmount, currency: "SAR",
            orderId: apOrderId, geideaSessionId,
            customerEmail: customerEmail || customer?.email,
            customerPhone: customerPhone || customer?.phone,
          }),
        });
        const payData = await payRes.json();
        if (!payRes.ok || !payData.success) throw new Error(payData.error || "فشل الدفع");
        apSession.completePayment((window as any).ApplePaySession.STATUS_SUCCESS);
        createOrderMutation.mutate({
          customerId: customer?.id, customerName, customerPhone, customerEmail,
          items: cartItems.map(i => {
            const inlineAddons = (i as any).selectedItemAddons || [];
            const addonsExtra = inlineAddons.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
            return { coffeeItemId: i.coffeeItemId, quantity: i.quantity, price: (i.coffeeItem?.price || 0) + addonsExtra, nameAr: i.coffeeItem?.nameAr || "", nameEn: i.coffeeItem?.nameEn || "", customization: inlineAddons.length > 0 ? { selectedItemAddons: inlineAddons } : undefined };
          }),
          totalAmount: apAmount, serviceFee: getServiceFee(), paymentMethod: 'apple_pay' as any, status: 'payment_confirmed', paymentStatus: 'paid',
          paymentReference: apOrderId, paymentSessionId: payData.transactionId,
          branchId: deliveryInfo?.branchId || "default",
          orderType: deliveryInfo?.type === 'car-pickup' ? 'car_pickup' : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup' : (deliveryInfo?.type === 'pickup' && deliveryInfo?.dineIn ? 'dine-in' : 'regular'),
          deliveryType: deliveryInfo?.type === 'car-pickup' ? 'car_pickup' : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup' : deliveryInfo?.type || 'pickup',
          customerNotes, discountCode: appliedDiscount?.code,
          pointsRedeemed: usePointsAsDiscount ? pointsToRedeem : 0,
          pointsValue: usePointsAsDiscount ? Math.min(pointsDiscountSAR, getBaseTotal()) : 0,
          bypassPointsVerification: true,
          ...(deliveryInfo?.type === 'car-pickup' && deliveryInfo?.carInfo ? { carType: deliveryInfo.carInfo.carType, carColor: deliveryInfo.carInfo.carColor, plateNumber: deliveryInfo.carInfo.plateNumber } : {}),
          ...(deliveryInfo?.scheduledPickupTime ? { scheduledPickupTime: deliveryInfo.scheduledPickupTime, arrivalTime: deliveryInfo.scheduledPickupTime } : {}),
          channel: "online",
        });
      } catch (err: any) {
        apSession.completePayment((window as any).ApplePaySession.STATUS_FAILURE);
        toast({ variant: "destructive", title: "فشل الدفع", description: err.message });
      }
    };
    apSession.oncancel = () => toast({ title: "تم إلغاء الدفع", description: "يمكنك المحاولة مرة أخرى" });
    apSession.begin();
  };

  const handleProceedPayment = () => {
    // If total is 0 (from points or 100% coupon), no payment method needed
    if (getFinalTotalWithPoints() <= 0) {
      if (!customerName.trim()) {
        toast({ variant: "destructive", title: t("checkout.enter_customer_name") });
        return;
      }
      const freeMethod = usePointsAsDiscount ? 'loyalty_points' : (selectedPaymentMethod || 'coupon');
      confirmAndCreateOrder(freeMethod as any);
      return;
    }
    if (!selectedPaymentMethod) {
      toast({ variant: "destructive", title: t("checkout.select_payment") });
      return;
    }
    if (selectedPaymentMethod === 'cash' && cashDistanceError) {
      toast({ variant: "destructive", title: 'الدفع نقداً غير متاح', description: cashDistanceError });
      return;
    }
    if (selectedPaymentMethod === 'cash' && cashDistanceChecking) {
      toast({ variant: "destructive", title: 'جاري التحقق من موقعك...', description: 'الرجاء الانتظار' });
      return;
    }
    if (!customerName.trim()) {
      toast({ variant: "destructive", title: t("checkout.enter_customer_name") });
      return;
    }
    // For online payments: skip confirmation dialog and go to Geidea HPP
    if (selectedPaymentMethod === 'apple_pay' || isOnlinePaymentMethod(selectedPaymentMethod)) {
      confirmAndCreateOrder();
      return;
    }
    setShowConfirmation(true);
  };

  const isOnlinePaymentMethod = (method: string | null) => {
    if (!method) return false;
    const onlineMethods = ['neoleap', 'geidea', 'neoleap-apple-pay', 'apple_pay', 'bank_card', 'paymob-card', 'paymob-wallet'];
    return onlineMethods.includes(method);
  };

  const confirmAndCreateOrder = async (overridePaymentMethod?: string) => {
    const payMethod = (overridePaymentMethod || selectedPaymentMethod) as PaymentMethod;
    const isFreeByPoints = payMethod === ('loyalty_points' as any) || (payMethod as any) === 'coupon' || getFinalTotalWithPoints() <= 0;
    let finalTotal = isFreeByPoints ? 0 : getFinalTotalWithPoints();

    if (payMethod === ('wallet' as any) && (customer?.walletBalance || 0) < finalTotal) {
      toast({ variant: "destructive", title: t("points.insufficient_wallet") });
      return;
    }

    let activeCustomerId = customer?.id;
    if (!activeCustomerId && wantToRegister) {
      setIsRegistering(true);
      const regRes = await fetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customerName, phone: customerPhone, email: customerEmail, password: customerPassword })
      });
      if (regRes.ok) {
        const newC = await regRes.json();
        activeCustomerId = newC.id;
        setCustomer(newC);
      }
      setIsRegistering(false);
    }

    const orderData = {
      customerId: activeCustomerId,
      customerName: customerName,
      customerPhone: customerPhone,
      customerEmail: customerEmail,
      items: cartItems.map(i => {
        const inlineAddons = (i as any).selectedItemAddons || [];
        const addonsExtra = inlineAddons.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
        return {
          coffeeItemId: i.coffeeItemId,
          quantity: i.quantity,
          price: (i.coffeeItem?.price || 0) + addonsExtra,
          nameAr: i.coffeeItem?.nameAr || "",
          nameEn: i.coffeeItem?.nameEn || "",
          customization: inlineAddons.length > 0 ? { selectedItemAddons: inlineAddons } : undefined,
        };
      }),
      totalAmount: finalTotal,
      serviceFee: isFreeByPoints ? 0 : getServiceFee(),
      paymentMethod: isFreeByPoints
        ? (payMethod === ('loyalty_points' as any) ? ('loyalty_points' as any) : ('coupon' as any))
        : payMethod,
      status: isFreeByPoints ? "payment_confirmed" : "pending",
      paymentStatus: isFreeByPoints ? 'paid' : undefined,
      branchId: deliveryInfo?.branchId || "default",
      orderType: deliveryInfo?.type === 'car-pickup' ? 'car_pickup' : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup' : (deliveryInfo?.type === 'pickup' && deliveryInfo?.dineIn ? 'dine-in' : 'regular'),
      deliveryType: deliveryInfo?.type === 'car-pickup' ? 'car_pickup' : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup' : deliveryInfo?.type || 'pickup',
      customerNotes: customerNotes,
      discountCode: appliedDiscount?.code,
      pointsRedeemed: usePointsAsDiscount
        ? Math.min(Math.ceil(getBaseTotal() * pointsPerSar), loyaltyPoints)
        : 0,
      pointsValue: usePointsAsDiscount
        ? Math.min(pointsDiscountSAR, getBaseTotal())
        : 0,
      bypassPointsVerification: true,
      ...(deliveryInfo?.type === 'car-pickup' && deliveryInfo?.carInfo ? {
        carType: deliveryInfo.carInfo.carType,
        carColor: deliveryInfo.carInfo.carColor,
        plateNumber: deliveryInfo.carInfo.plateNumber,
      } : {}),
      ...(deliveryInfo?.scheduledPickupTime ? {
        scheduledPickupTime: deliveryInfo.scheduledPickupTime,
        arrivalTime: deliveryInfo.scheduledPickupTime,
      } : {}),
      channel: "online",
    };

    if (isOnlinePaymentMethod(payMethod)) {
      pendingGeideaOrderData.current = orderData;
      geideaOrderNum.current = `CLN-${Date.now()}`;
      setShowConfirmation(false);
      setShowInlineGeidea(true);
      return;
    }

    createOrderMutation.mutate(orderData);
  };

  if (isVerifyingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#21302f]" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-sm w-full bg-white rounded-3xl p-10 shadow-2xl text-center space-y-6">
          <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
          <h2 className="text-2xl font-bold">{t("checkout.verifying_payment")}</h2>
          <p className="text-muted-foreground text-sm">{t("checkout.verifying_payment_desc")}</p>
        </div>
      </div>
    );
  }

  if (showSuccessPage) {
    const orderBranch = branches.find((b: any) => b.id === orderDetails?.branchId);
    const branchLat = orderBranch?.location?.lat;
    const branchLng = orderBranch?.location?.lng;
    const branchAddress = orderBranch?.address || "";

    // Build Google Maps URL:
    // 1. Use admin-pasted Google Maps link if available (most accurate)
    // 2. Fall back to address text search
    // 3. Last resort: GPS coordinates
    const mapsUrl = (() => {
      if (orderBranch?.mapUrl) {
        return orderBranch.mapUrl;
      }
      if (branchAddress) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(branchAddress)}`;
      }
      if (branchLat && branchLng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${branchLat},${branchLng}`;
      }
      return null;
    })();

    const handleCopyOrder = () => {
      navigator.clipboard.writeText(orderDetails?.orderNumber || "");
      setCopiedOrderNum(true);
      setTimeout(() => setCopiedOrderNum(false), 2000);
    };

    const handlePrintInvoice = async () => {
      if (isPdfLoading) return;
      setIsPdfLoading(true);
      try {
        const paymentLabel =
          orderDetails?.paymentMethod === "geidea" ? "بطاقة إلكترونية" :
          orderDetails?.paymentMethod === "cash" ? "نقداً" :
          orderDetails?.paymentMethod === "loyalty_points" ? "نقاط الولاء" :
          orderDetails?.paymentMethod === "coupon" ? "كوبون خصم" :
          orderDetails?.paymentMethod || "نقداً";
        await downloadInvoicePDF({
          orderNumber: orderDetails?.orderNumber || "",
          customerName: orderDetails?.customerName || customerName || "",
          customerPhone: orderDetails?.customerPhone || customerPhone || "",
          items: (orderDetails?.items || []).map((item: any) => ({
            coffeeItem: {
              nameAr: item.nameAr || item.coffeeItem?.nameAr || "",
              nameEn: item.nameEn || item.coffeeItem?.nameEn || "",
              price: String(item.price || item.coffeeItem?.price || 0),
            },
            quantity: item.quantity,
          })),
          subtotal: String(orderDetails?.totalAmount || 0),
          total: String(orderDetails?.totalAmount || 0),
          paymentMethod: paymentLabel,
          date: new Date().toISOString(),
          branchName: isAr ? (orderBranch?.nameAr || "كلوني كافيه") : (orderBranch?.nameEn || "Cluny Cafe"),
          branchAddress: orderBranch?.address || "",
        });
      } catch (err) {
        toast({ variant: "destructive", title: "تعذّر تحميل الفاتورة", description: "يرجى المحاولة مرة أخرى" });
      } finally {
        setIsPdfLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a2c1a] via-[#21302f] to-[#1a2c1a] flex flex-col items-center justify-start pt-8 pb-16 px-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-md space-y-4">

          {/* Success header card */}
          <div className="bg-white dark:bg-card rounded-3xl p-6 shadow-2xl text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-foreground">تم استلام طلبك!</h2>
            <p className="text-muted-foreground text-sm">شكراً لك — طلبك قيد التحضير الآن</p>

            {/* Order number */}
            <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-0.5">رقم الطلب</p>
                <p className="text-2xl font-black font-mono text-green-700 dark:text-green-400" data-testid="text-order-number">
                  {orderDetails?.orderNumber}
                </p>
              </div>
              <button
                onClick={handleCopyOrder}
                className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center hover:bg-green-200 dark:hover:bg-green-800 transition"
                data-testid="button-copy-order-number"
              >
                {copiedOrderNum ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4 text-green-700" />}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setLocation(`/tracking?order=${orderDetails?.orderNumber}`)}
              className="bg-white dark:bg-card rounded-2xl p-4 shadow-md flex flex-col items-center gap-2 hover:shadow-lg transition"
              data-testid="button-track-order"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-center text-foreground">تتبع الطلب</span>
            </button>

            <button
              onClick={handlePrintInvoice}
              disabled={isPdfLoading}
              className="bg-white dark:bg-card rounded-2xl p-4 shadow-md flex flex-col items-center gap-2 hover:shadow-lg transition disabled:opacity-60"
              data-testid="button-print-invoice"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                {isPdfLoading ? <Loader2 className="w-6 h-6 text-amber-600 animate-spin" /> : <Printer className="w-6 h-6 text-amber-600" />}
              </div>
              <span className="text-xs font-bold text-center text-foreground">{isPdfLoading ? 'جاري التحميل...' : 'تنزيل الفاتورة'}</span>
            </button>

            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-card rounded-2xl p-4 shadow-md flex flex-col items-center gap-2 hover:shadow-lg transition"
                data-testid="button-directions"
              >
                <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-red-600" />
                </div>
                <span className="text-xs font-bold text-center text-foreground">الاتجاهات</span>
              </a>
            ) : (
              <button
                onClick={() => setLocation("/menu")}
                className="bg-white dark:bg-card rounded-2xl p-4 shadow-md flex flex-col items-center gap-2 hover:shadow-lg transition"
                data-testid="button-back-menu"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Coffee className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-bold text-center text-foreground">القائمة</span>
              </button>
            )}
          </div>

          {/* Branch directions card */}
          {orderBranch && (
            <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-md" dir="rtl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">{isAr ? orderBranch.nameAr : (orderBranch.nameEn || orderBranch.nameAr)}</p>
                  {orderBranch.address && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{orderBranch.address}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                      توجّه للفرع برقم: {orderDetails?.orderNumber}
                    </span>
                  </div>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-bold text-blue-600 hover:underline"
                    data-testid="link-maps"
                  >
                    خريطة
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Order items summary */}
          {orderDetails?.items?.length > 0 && (
            <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-md" dir="rtl">
              <p className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-primary" /> ملخص الطلب
              </p>
              <div className="space-y-2">
                {orderDetails.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm gap-2">
                    <span className="text-foreground">{isAr ? (item.nameAr || item.coffeeItem?.nameAr) : (item.nameEn || item.coffeeItem?.nameEn || item.nameAr || item.coffeeItem?.nameAr)} × {item.quantity}</span>
                    <span className="font-semibold text-muted-foreground">{((item.price || item.coffeeItem?.price || 0) * item.quantity).toFixed(2)} ر.س</span>
                  </div>
                ))}
                <div className="pt-2 border-t flex justify-between font-black text-base">
                  <span>الإجمالي</span>
                  <span className="text-primary">{Number(orderDetails?.totalAmount || 0).toFixed(2)} ر.س</span>
                </div>
              </div>
            </div>
          )}

          {/* Guest registration prompt */}
          {isGuestMode && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4" dir="rtl">
              <p className="font-bold text-amber-900 dark:text-amber-300 text-sm">⭐ احصل على نقاط ولاء مع كل طلب</p>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-1 leading-relaxed">
                سجّل بنفس رقم جوالك ويتم ربط طلباتك تلقائياً
              </p>
              <Button
                onClick={() => setLocation("/auth")}
                className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 text-sm"
                data-testid="button-register-after-order"
              >
                سجّل الآن — مجاناً
              </Button>
            </div>
          )}

          {/* Back to menu */}
          <Button
            onClick={() => setLocation("/menu")}
            variant="outline"
            className="w-full h-12 border-white/30 text-white hover:bg-white/10 bg-white/5"
            data-testid="button-back-to-menu"
          >
            <Coffee className="w-4 h-4 ml-2" />
            {t("cart.continue_shopping")}
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen py-12 bg-[#21302f]" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white text-center mb-8">{t("nav.checkout")}</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader><CardTitle>{t("checkout.order_summary")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center gap-2 text-sm" data-testid={`cart-item-${index}`}>
                    <span>{isAr ? item.coffeeItem?.nameAr : item.coffeeItem?.nameEn} × {item.quantity}</span>
                    <span className="font-bold">{((item.coffeeItem?.price || 0) * item.quantity).toFixed(2)} <SarIcon /></span>
                  </div>
                ))}
                {appliedDiscount && (
                  <div className="flex justify-between items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded">
                    <span>{t("points.discount")} ({appliedDiscount.percentage}%)</span>
                    <span>-{(getFinalTotal() * appliedDiscount.percentage / 100).toFixed(2)} <SarIcon /></span>
                  </div>
                )}
                {usePointsAsDiscount && pointsDiscountSAR > 0 && (
                  <div className="flex justify-between items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 rounded">
                    <span className="flex items-center gap-1.5">⭐ خصم النقاط ({pointsToRedeem.toLocaleString()} نقطة)</span>
                    <span className="font-bold">-{Math.min(pointsDiscountSAR, getBaseTotal()).toFixed(2)} <SarIcon /></span>
                  </div>
                )}
                <div className="pt-4 border-t font-bold text-xl flex justify-between gap-2">
                  <span>{t("cart.total")}:</span>
                  <span className={usePointsAsDiscount && getFinalTotalWithPoints() === 0 ? 'text-green-600' : 'text-primary'}>
                    {getFinalTotalWithPoints().toFixed(2)} <SarIcon />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {customer ? (
                  <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-accent" />
                      <div>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone}</p>
                      </div>
                    </div>
                  </div>
                ) : isGuestMode ? (
                  <div className="space-y-3">
                    <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">{customerName}</p>
                          <p className="text-sm text-muted-foreground">{customerPhone}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLocation("/customer-login")}
                        className="text-xs text-accent hover:underline"
                        data-testid="link-change-guest"
                      >
                        تغيير
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-xs text-amber-800 dark:text-amber-300">سجّل الآن واحصل على نقاط ولاء وتتبع طلباتك</p>
                      <button
                        type="button"
                        onClick={() => setLocation("/auth")}
                        className="text-xs font-bold text-accent hover:underline whitespace-nowrap mr-2"
                        data-testid="link-register-now"
                      >
                        تسجيل ←
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t("checkout.full_name")} data-testid="input-customer-name" />
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder={t("checkout.phone")} data-testid="input-customer-phone" />
                    <div className="flex items-center gap-2">
                      <Checkbox id="register" checked={wantToRegister} onCheckedChange={checked => setWantToRegister(!!checked)} data-testid="checkbox-register" />
                      <Label htmlFor="register">{t("checkout.want_to_register")}</Label>
                    </div>
                  </div>
                )}

                {/* When total is 0 (from points or 100% coupon): show free banner, hide payment methods */}
                {getFinalTotalWithPoints() <= 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-700 rounded-xl" data-testid="banner-free-by-points">
                    <div className="text-2xl">🎉</div>
                    <div>
                      <p className="font-bold text-green-800 dark:text-green-300">طلبك مجاني بالكامل!</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {usePointsAsDiscount ? 'نقاطك تغطي المبلغ كاملاً' : 'الكوبون يغطي المبلغ كاملاً'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <PaymentMethods
                    paymentMethods={paymentMethods.filter(m => m.id !== 'qahwa-card')}
                    selectedMethod={selectedPaymentMethod}
                    onSelectMethod={setSelectedPaymentMethod}
                  />
                )}

                {selectedPaymentMethod === 'cash' && cashDistanceChecking && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-sm" data-testid="status-cash-distance-checking">
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    <span>جاري التحقق من موقعك للدفع نقداً...</span>
                  </div>
                )}

                {selectedPaymentMethod === 'cash' && !cashDistanceChecking && cashDistanceError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm" data-testid="status-cash-distance-error">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <span>{cashDistanceError}</span>
                  </div>
                )}

                {appliedDiscount?.isOffer && (
                  <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800 dark:text-green-300">{appliedDiscount.code}</p>
                          <p className="text-sm text-green-600">{t("points.discount")} {appliedDiscount.percentage}% {t("points.applied")}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setAppliedDiscount(null);
                          customerStorage.clearActiveOffer();
                        }}
                        className="text-red-500"
                        data-testid="button-remove-offer"
                      >
                        {t("points.remove")}
                      </Button>
                    </div>
                  </div>
                )}

                <ErrorBoundary fallback={
                  <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-orange-400" />
                      <Label className="font-semibold text-muted-foreground">{t("checkout.have_discount")}</Label>
                    </div>
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">
                      <Wrench className="w-3 h-3" />
                      قيد التطوير
                    </Badge>
                  </div>
                }>
                <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/30 space-y-4">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-orange-600" />
                    <Label className="font-semibold">{t("checkout.have_discount")}</Label>
                  </div>

                  {/* Available coupon codes */}
                  {safeCoupons.length > 0 && !appliedDiscount && !usePointsAsDiscount && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5" />
                        {t("checkout.available_coupons")}
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {safeCoupons.map((coupon) => (
                          <button
                            key={coupon.id || coupon._id || coupon.code}
                            onClick={() => {
                              setDiscountCode(coupon.code);
                              handleValidateDiscount(coupon.code);
                            }}
                            data-testid={`button-coupon-${coupon.code}`}
                            className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all group min-w-[100px]"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Tag className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-mono font-black text-xs tracking-wider text-foreground">{coupon.code}</span>
                            <Badge className="bg-primary text-white border-0 font-black text-[10px] px-1.5 py-0">
                              -{coupon.discountPercentage}%
                            </Badge>
                            {coupon.reason && (
                              <span className="text-[9px] text-muted-foreground text-center line-clamp-1 max-w-[90px]">{coupon.reason}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coupon code input — disabled when using points */}
                  {!usePointsAsDiscount && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          value={discountCode}
                          onChange={e => setDiscountCode(e.target.value)}
                          placeholder={t("checkout.enter_discount")}
                          disabled={!!appliedDiscount}
                          className="bg-white dark:bg-background"
                          data-testid="input-discount-code"
                        />
                        <Button
                          onClick={() => handleValidateDiscount()}
                          disabled={!!appliedDiscount || isValidatingDiscount}
                          data-testid="button-apply-discount"
                        >
                          {isValidatingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : t("checkout.apply")}
                        </Button>
                      </div>
                      {appliedDiscount && !appliedDiscount.isOffer && (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-green-600">{t("points.applied")}: {appliedDiscount.code} ({appliedDiscount.percentage}%)</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-red-500 hover:text-red-700 p-0"
                            onClick={() => { setAppliedDiscount(null); setDiscountCode(""); }}
                          >
                            {t("common.remove") || "إزالة"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </ErrorBoundary>

                {customer && loyaltyCard && (
                  <LoyaltyCheckoutCard
                    loyaltyCard={loyaltyCard}
                    loyaltyPoints={loyaltyPoints}
                    pointsPerSar={pointsPerSar}
                    minPointsForRedemption={minPointsForRedemption}
                    pointsToRedeem={pointsToRedeem}
                    onApplyPoints={(pts) => {
                      setPointsToRedeem(pts);
                      setAppliedDiscount(null);
                      setDiscountCode("");
                    }}
                    onCancelPoints={() => setPointsToRedeem(0)}
                    baseTotal={getBaseTotal()}
                  />
                )}

                <Button
                  onClick={handleProceedPayment}
                  className={`w-full h-14 text-lg ${getFinalTotalWithPoints() <= 0 ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  data-testid="button-proceed-payment"
                  disabled={
                    getFinalTotalWithPoints() > 0 && (
                      (selectedPaymentMethod === 'cash' && !!cashDistanceError) ||
                      (selectedPaymentMethod === 'cash' && cashDistanceChecking)
                    )
                  }
                >
                  {getFinalTotalWithPoints() <= 0 ? (
                    <>🎉 تأكيد الطلب مجاناً</>
                  ) : selectedPaymentMethod === 'cash' && cashDistanceChecking ? (
                    <><Loader2 className="w-5 h-5 animate-spin ml-2" />جاري التحقق من الموقع...</>
                  ) : isOnlinePaymentMethod(selectedPaymentMethod) ? (
                    <><CreditCard className="w-5 h-5 ml-2" />ادفع الآن</>
                  ) : t("checkout.confirm_order")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Geidea Drop-in Payment Page ────────────────────────────── */}
      {showInlineGeidea && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur sticky top-0">
            <button
              onClick={() => {
                setShowInlineGeidea(false);
                toast({ title: "تم إلغاء الدفع", description: "يمكنك المحاولة مرة أخرى" });
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition"
              data-testid="button-cancel-geidea"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 text-center">
              <p className="font-bold text-base">الدفع الآمن</p>
              <p className="text-xs text-muted-foreground">
                المبلغ: {pendingGeideaOrderData.current?.totalAmount?.toFixed(2)} ر.س
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <ShieldCheck className="w-4 h-4" />
              <span>آمن</span>
            </div>
          </div>

          {/* Drop-in container: Geidea injects its iframe here */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <GeideaCheckoutWidget
              orderNumber={geideaOrderNum.current}
              amount={pendingGeideaOrderData.current?.totalAmount || 0}
              customerPhone={pendingGeideaOrderData.current?.customerPhone}
              customerEmail={pendingGeideaOrderData.current?.customerEmail}
              containerId="geidea-dropin-container"
              onSuccess={async (data) => {
                const od = pendingGeideaOrderData.current;
                const confirmedOrder = {
                  ...od,
                  status: 'payment_confirmed',
                  paymentStatus: 'paid',
                  paymentReference: geideaOrderNum.current,
                  paymentSessionId: data?.session?.id || data?.orderId || undefined,
                };
                setShowInlineGeidea(false);
                createOrderMutation.mutate(confirmedOrder);
              }}
              onError={(msg) => {
                setShowInlineGeidea(false);
                toast({ variant: "destructive", title: t("checkout.payment_error"), description: msg });
              }}
              onCancel={() => {
                setShowInlineGeidea(false);
                toast({ title: "تم إلغاء الدفع", description: "يمكنك المحاولة مرة أخرى" });
              }}
            />
            <div id="geidea-dropin-container" className="min-h-[500px] w-full" />
          </div>

          {/* Footer security row */}
          <div className="flex items-center justify-center gap-4 py-3 border-t text-xs text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-1"><Lock className="w-3 h-3" /><span>SSL مشفّر</span></div>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <div className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /><span>3D Secure</span></div>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="font-semibold text-[#c8a97e]">GEIDEA</span>
          </div>
        </div>
      )}

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t("checkout.confirm_title")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-2">
            <p className="text-lg">{t("checkout.confirm_question")}</p>
            {usePointsAsDiscount && pointsDiscountSAR > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">قبل الخصم: {getBaseTotal().toFixed(2)} <SarIcon /></p>
                <p className="text-sm text-amber-600 font-semibold">⭐ خصم النقاط: -{Math.min(pointsDiscountSAR, getBaseTotal()).toFixed(2)} <SarIcon /></p>
                <p className="text-3xl font-black text-primary">{getFinalTotalWithPoints().toFixed(2)} <SarIcon /></p>
                {getFinalTotalWithPoints() === 0 && <p className="text-sm text-green-600 font-bold">🎉 نقاطك تغطي المبلغ كاملاً!</p>}
              </>
            ) : (
              <p className="text-2xl font-bold text-primary">{getFinalTotalWithPoints().toFixed(2)} <SarIcon /></p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmation(false)} className="flex-1" data-testid="button-cancel-order">{t("points.cancel")}</Button>
            <Button onClick={confirmAndCreateOrder} className="flex-1 bg-green-600" data-testid="button-confirm-order">{t("checkout.confirm_pay")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

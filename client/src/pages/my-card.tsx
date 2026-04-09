import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Gift, QrCode, ChevronRight, TrendingUp,
  ArrowDownRight, ArrowUpRight, Clock, SendHorizonal, Loader2
} from "lucide-react";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLocation } from "wouter";
import { CustomerLayout } from "@/components/layouts/CustomerLayout";
import QRCodeLib from "qrcode";
import LoyaltyCardComponent from "@/components/loyalty-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

function isAppleDevice() {
  return /iPad|iPhone|iPod|Mac/.test(navigator.userAgent);
}

export default function MyCardPage() {
  const { customer } = useCustomer();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [showQr, setShowQr] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferPhone, setTransferPhone] = useState("");
  const [transferPoints, setTransferPoints] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [appleDevice] = useState(() => isAppleDevice());

  const { data: loyaltyCards = [], isLoading: loadingCards } = useQuery<any[]>({
    queryKey: ["/api/customer/loyalty-cards"],
    enabled: !!customer,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery<any[]>({
    queryKey: ["/api/customer/loyalty-transactions"],
    enabled: !!customer,
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/loyalty-settings"],
  });

  const card = loyaltyCards[0];
  const points = card?.points ?? 0;
  const pointsValueInSar: number = settings?.pointsValueInSar ?? 0.02;
  const pointsPerSar: number = settings?.pointsPerSar ?? 50;
  const minPointsForRedemption: number = settings?.minPointsForRedemption ?? 100;
  const pointsEarnedPerItem: number = settings?.pointsEarnedPerItem ?? 10;
  const sarValue = (points * pointsValueInSar).toFixed(2);

  useEffect(() => {
    const qrData = card?.qrToken || card?.cardNumber;
    if (!qrData) return;
    QRCodeLib.toDataURL(qrData, {
      width: 220, margin: 2,
      color: { dark: "#1a3a2a", light: "#ffffff" }
    }).then(setQrCodeUrl).catch(console.error);
  }, [card?.qrToken, card?.cardNumber]);

  const transferMutation = useMutation({
    mutationFn: async (data: { recipientPhone: string; points: number }) => {
      const res = await apiRequest("POST", "/api/customer/transfer-points", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "تم تحويل النقاط",
        description: `تم تحويل ${transferPoints} نقطة إلى ${data.recipientName || transferPhone} بنجاح`,
      });
      setShowTransfer(false);
      setTransferPhone("");
      setTransferPoints("");
      queryClient.invalidateQueries({ queryKey: ["/api/customer/loyalty-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/loyalty-transactions"] });
    },
    onError: (err: any) => {
      const msg = err?.message || "فشل في تحويل النقاط";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const handleAddToWallet = async () => {
    try {
      setWalletLoading(true);

      if (!customer?.phone) {
        throw new Error("يرجى تسجيل الدخول أولاً");
      }

      const phone = customer.phone.replace(/\D/g, '').slice(-9);
      const res = await fetch(`/api/customer/apple-wallet-pass?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "فشل إنشاء البطاقة");
      }
      const blob = await res.blob();
      if (blob.size < 100) {
        throw new Error("البطاقة غير صالحة، يرجى المحاولة مرة أخرى");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cluny-loyalty.pkpass";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "✅ تمت الإضافة",
        description: "تم تحميل البطاقة — افتح الملف لإضافتها إلى Apple Wallet",
      });
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "فشل إنشاء بطاقة المحفظة", variant: "destructive" });
    } finally {
      setWalletLoading(false);
    }
  };

  const handleTransfer = () => {
    const pts = parseInt(transferPoints);
    if (!transferPhone || isNaN(pts) || pts <= 0) {
      toast({ title: "بيانات ناقصة", description: "أدخل رقم الجوال وعدد النقاط", variant: "destructive" });
      return;
    }
    if (pts > points) {
      toast({ title: "نقاط غير كافية", description: `رصيدك الحالي ${points} نقطة فقط`, variant: "destructive" });
      return;
    }
    if (pts < 1) {
      toast({ title: "عدد غير صالح", description: "أدخل عدداً موجباً من النقاط", variant: "destructive" });
      return;
    }
    transferMutation.mutate({ recipientPhone: transferPhone, points: pts });
  };

  if (!customer) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8" dir="rtl">
          <Gift className="w-16 h-16 text-primary opacity-40" />
          <p className="text-lg font-bold text-center">يجب تسجيل الدخول لعرض بطاقة الولاء</p>
          <Button onClick={() => setLocation("/auth")} data-testid="button-login">تسجيل الدخول</Button>
        </div>
      </CustomerLayout>
    );
  }

  if (loadingCards) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">جاري تحميل بطاقتك...</p>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container max-w-lg mx-auto px-4 py-6 pb-28 space-y-5" dir="rtl">

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
            <ChevronRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-black text-primary">بطاقة كلوني</h1>
        </div>

        {card ? (
          <LoyaltyCardComponent card={card} showActions={true} />
        ) : (
          <div className="rounded-2xl bg-muted border-2 border-dashed border-muted-foreground/20 p-8 text-center space-y-2">
            <Gift className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">لا توجد بطاقة مرتبطة بحسابك بعد</p>
          </div>
        )}

        {/* Action buttons row */}
        {card && (
          <div className="grid grid-cols-2 gap-3">
            {qrCodeUrl && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowQr(true)}
                data-testid="button-show-qr"
              >
                <QrCode className="w-4 h-4" />
                رمز QR
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowTransfer(true)}
              data-testid="button-transfer-points"
            >
              <SendHorizonal className="w-4 h-4" />
              تحويل النقاط
            </Button>
          </div>
        )}

        {/* Apple Wallet button - shown on all devices for testing, production: appleDevice && card */}
        {card && (
          <button
            onClick={handleAddToWallet}
            disabled={walletLoading}
            data-testid="button-add-to-wallet"
            className="w-full flex items-center justify-center gap-2 rounded-xl overflow-hidden disabled:opacity-60"
            style={{ background: "none", border: "none", padding: 0, cursor: walletLoading ? "not-allowed" : "pointer" }}
          >
            {walletLoading ? (
              <div className="flex items-center justify-center gap-2 bg-black text-white rounded-xl px-5 py-3 w-full">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">جاري الإنشاء...</span>
              </div>
            ) : (
              <img
                src="https://apple.com/v/apple-pay/q/images/overview/apple_wallet_badge__fv99ypiqzuau_large.png"
                alt="Add to Apple Wallet"
                className="h-12 object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            )}
            <div
              className="hidden items-center justify-center gap-2 bg-black text-white rounded-xl px-5 py-3 w-full"
            >
              <svg viewBox="0 0 32 32" className="w-5 h-5 fill-white"><path d="M20.5 10.4c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.7.8-3.6 1.8-.8.9-1.5 2.4-1.3 3.7 1.4.1 2.8-.6 3.7-1.7zm1.2 2.1c-2.1-.1-3.9 1.2-4.9 1.2-1 0-2.6-1.1-4.3-1.1-2.2 0-4.2 1.3-5.4 3.3-2.3 4-.6 10 1.6 13.2 1.1 1.6 2.4 3.3 4.1 3.2 1.6-.1 2.2-1 4.2-1s2.5.9 4.2.9c1.8 0 2.9-1.6 4-3.2 1.2-1.8 1.7-3.6 1.8-3.7-.1 0-3.4-1.3-3.4-5.1 0-3.2 2.6-4.7 2.7-4.8-1.5-2.1-3.8-2.4-4.6-2.9z"/></svg>
              <span className="text-sm font-semibold">Add to Apple Wallet</span>
            </div>
          </button>
        )}

        {/* Points progress toward min redemption */}
        {card && points < minPointsForRedemption && (
          <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-3" data-testid="redemption-progress">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="font-bold">التقدم نحو أول استرداد</span>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                  style={{ width: `${Math.min(100, Math.round((points / minPointsForRedemption) * 100))}%` }}
                  data-testid="redemption-progress-bar"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {points} / {minPointsForRedemption} نقطة — تحتاج {minPointsForRedemption - points} نقطة إضافية للاسترداد
              </p>
            </div>
          </div>
        )}

        {/* How to earn */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4" data-testid="how-to-earn">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-amber-900 dark:text-amber-200">كيفية كسب النقاط واستخدامها</span>
          </div>
          <div className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
            <p>• {pointsEarnedPerItem} نقطة لكل منتج سعره أكثر من ريال واحد</p>
            <p>• {pointsPerSar} نقطة = ريال واحد خصم</p>
            <p>• الحد الأدنى للاسترداد: {minPointsForRedemption} نقطة (= {(minPointsForRedemption * pointsValueInSar).toFixed(2)} ريال)</p>
            <p>• يمكنك استخدام نقاطك عند الدفع في الكاشير أو الموقع</p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="space-y-3" data-testid="transactions-section">
          <h3 className="font-bold text-lg">آخر العمليات</h3>
          {loadingTx ? (
            <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Clock className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">لا توجد عمليات سابقة</p>
            </div>
          ) : (
            transactions.slice(0, 10).map((tx: any, i: number) => {
              const isEarn = tx.type === 'earn' || tx.type === 'transfer_in';
              const isRedeem = tx.type === 'redeem' || tx.type === 'transfer_out';
              return (
                <div
                  key={tx.id || i}
                  className="flex items-center justify-between bg-card rounded-xl border px-4 py-3"
                  data-testid={`transaction-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      isEarn ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                      isRedeem ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                      "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                    }`}>
                      {isEarn ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {tx.descriptionAr || (isEarn ? "كسب نقاط" : isRedeem ? "استرداد نقاط" : "عملية")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("ar-SA") : ""}
                      </p>
                    </div>
                  </div>
                  {(tx.points !== undefined && tx.points !== 0) && (
                    <span className={`font-bold text-sm ${isEarn ? "text-green-600" : "text-red-600"}`}>
                      {isEarn ? "+" : "-"}{Math.abs(tx.points)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="max-w-xs text-center" dir="rtl" data-testid="dialog-qr">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" />
              رمز بطاقتك
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 gap-4">
            <p className="text-sm text-muted-foreground">اعرض هذا الرمز للكاشير لكسب النقاط</p>
            {qrCodeUrl && (
              <div className="bg-white p-3 rounded-2xl shadow-lg">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" data-testid="img-qr" />
              </div>
            )}
            <p className="font-mono text-xs text-muted-foreground" data-testid="text-card-num-qr">
              {card?.cardNumber || ""}
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowQr(false)} className="w-full" data-testid="button-close-qr">
            إغلاق
          </Button>
        </DialogContent>
      </Dialog>

      {/* Transfer Points Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="max-w-sm" dir="rtl" data-testid="dialog-transfer">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SendHorizonal className="w-5 h-5 text-primary" />
              تحويل النقاط
            </DialogTitle>
            <DialogDescription>
              حوّل نقاطك إلى حساب عميل آخر في كلوني. رصيدك الحالي: <strong>{points.toLocaleString()} نقطة</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="transfer-phone">رقم جوال المستلم</Label>
              <Input
                id="transfer-phone"
                type="tel"
                inputMode="numeric"
                placeholder="05XXXXXXXX"
                value={transferPhone}
                onChange={(e) => setTransferPhone(e.target.value)}
                dir="ltr"
                data-testid="input-transfer-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-pts">عدد النقاط</Label>
              <Input
                id="transfer-pts"
                type="number"
                min={1}
                max={points}
                placeholder={`أقصى ${points}`}
                value={transferPoints}
                onChange={(e) => setTransferPoints(e.target.value)}
                data-testid="input-transfer-points"
              />
              {transferPoints && !isNaN(parseInt(transferPoints)) && (
                <p className="text-xs text-muted-foreground">
                  = {(parseInt(transferPoints) * pointsValueInSar).toFixed(2)} ريال
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
              className="flex-1 gap-2"
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SendHorizonal className="w-4 h-4" />
              )}
              تأكيد التحويل
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowTransfer(false); setTransferPhone(""); setTransferPoints(""); }}
              data-testid="button-cancel-transfer"
            >
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee, User, Phone, Zap, Star, ChevronRight } from "lucide-react";
import { customerStorage } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";

type Mode = 'choice' | 'quick';

export default function CustomerLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('choice');
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "CLUNY CAFE — ادخل الآن";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'تسجيل دخول عملاء CLUNY CAFE — سجّل أو اطلب بسرعة');
  }, []);

  const handleQuickOrder = () => {
    const trimName = name.trim();
    const trimPhone = phone.trim().replace(/\s/g, '');

    if (!trimName || trimName.length < 2) {
      toast({ variant: "destructive", title: "الاسم مطلوب", description: "أدخل اسمك (حرفان على الأقل)" });
      return;
    }
    if (!trimPhone || trimPhone.length !== 9 || !trimPhone.startsWith('5')) {
      toast({ variant: "destructive", title: "رقم الجوال غير صحيح", description: "أدخل 9 أرقام تبدأ بـ 5" });
      return;
    }

    setLoading(true);
    customerStorage.setGuestInfo(trimName, trimPhone);
    customerStorage.setGuestMode(true);
    toast({ title: "أهلاً " + trimName + " 👋", description: "اختر مشروبك وأكمل الطلب" });
    setLocation("/menu");
  };

  if (mode === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Coffee className="w-12 h-12 text-accent" />
            <h1 className="text-4xl font-bold font-playfair text-foreground">CLUNY CAFE</h1>
          </div>
          <p className="text-muted-foreground text-lg font-cairo">لكل لحظة قهوة ، لحظة نجاح</p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <Card className="bg-card border-border/50 backdrop-blur shadow-lg">
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-2xl text-foreground font-playfair">مرحباً بك</CardTitle>
              <CardDescription className="text-muted-foreground">اختر طريقة المتابعة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => setLocation("/auth")}
                className="w-full h-14 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground text-base font-semibold"
                data-testid="button-login"
              >
                <User className="ml-2 w-5 h-5" />
                <div className="text-right flex-1">
                  <div>تسجيل الدخول / حساب جديد</div>
                  <div className="text-xs opacity-80 font-normal">احصل على بطاقة ولاء ونقاط مكافآت</div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-60" />
              </Button>

              <div className="relative flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">أو</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button
                onClick={() => setMode('quick')}
                variant="outline"
                className="w-full h-14 border-primary/30 text-foreground hover:bg-primary/5 text-base"
                data-testid="button-quick-order"
              >
                <Zap className="ml-2 w-5 h-5 text-accent" />
                <div className="text-right flex-1">
                  <div>طلب سريع بدون تسجيل</div>
                  <div className="text-xs text-muted-foreground font-normal">اسمك ورقمك فقط • الدفع بالبطاقة</div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-2 text-center">
            <Star className="w-4 h-4 text-accent" />
            <p className="text-muted-foreground text-sm font-cairo">
              التسجيل يتيح لك: بطاقة ولاء • نقاط مكافآت • متابعة طلباتك
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex flex-col items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md bg-card border-border/50 backdrop-blur shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="w-7 h-7 text-accent" />
            <CardTitle className="text-2xl text-foreground font-playfair">طلب سريع</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            أدخل اسمك ورقمك لمتابعة الطلب
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="quick-name" className="text-foreground mb-1.5 block">الاسم</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="quick-name"
                type="text"
                placeholder="اسمك الكريم"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickOrder()}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 pr-10"
                data-testid="input-quick-name"
                autoFocus
              />
            </div>
          </div>

          <div>
            <Label htmlFor="quick-phone" className="text-foreground mb-1.5 block">رقم الجوال (9 أرقام تبدأ بـ 5)</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">+966</div>
              <Input
                id="quick-phone"
                type="tel"
                placeholder="5xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickOrder()}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 pr-10 pl-14"
                data-testid="input-quick-phone"
              />
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-0.5">💡 ملاحظة</p>
            <p>الطلب السريع لا يشمل نقاط الولاء. يمكنك التسجيل لاحقاً بنفس رقم الجوال وسيتم ربط طلباتك تلقائياً.</p>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              onClick={handleQuickOrder}
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground font-semibold"
              data-testid="button-confirm-quick"
            >
              <Zap className="w-4 h-4 ml-2" />
              متابعة للقائمة
            </Button>

            <Button
              onClick={() => setMode('choice')}
              variant="ghost"
              className="w-full text-foreground/70 hover:text-foreground hover:bg-primary/10"
              data-testid="button-back-quick"
            >
              رجوع
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Zap, ArrowRight, User, Phone, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { customerStorage } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCustomer } from "@/contexts/CustomerContext";

interface QuickCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: () => void;
}

type Step = "choose" | "quick" | "login" | "register";

export default function QuickCheckoutDialog({ open, onOpenChange, onProceed }: QuickCheckoutDialogProps) {
  const { toast } = useToast();
  const { setCustomer } = useCustomer();
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep("choose");
    setName("");
    setPhone("");
    setIdentifier("");
    setPassword("");
    setEmail("");
    setShowPassword(false);
    setLoading(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleQuickContinue = () => {
    const cleanedPhone = phone.replace(/\D/g, "");
    if (!name.trim()) {
      toast({ variant: "destructive", title: "يرجى إدخال الاسم" });
      return;
    }
    if (cleanedPhone.length < 9) {
      toast({ variant: "destructive", title: "يرجى إدخال رقم جوال صحيح" });
      return;
    }
    customerStorage.setGuestMode(true);
    customerStorage.setGuestInfo(name.trim(), cleanedPhone);
    onOpenChange(false);
    onProceed();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.replace(/\s/g, "").trim();
    if (!cleanId) {
      toast({ variant: "destructive", title: "يرجى إدخال رقم الجوال أو البريد" });
      return;
    }
    if (!password || password.length < 4) {
      toast({ variant: "destructive", title: "كلمة المرور قصيرة جداً" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/login", {
        identifier: cleanId,
        password,
      });
      const customer = await res.json();
      setCustomer(customer);
      toast({ title: `أهلاً ${customer.name}!`, description: "تم تسجيل الدخول بنجاح" });
      onOpenChange(false);
      onProceed();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الدخول",
        description: err?.message || "تعذّر تسجيل الدخول",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = phone.replace(/\D/g, "");
    if (!name.trim()) {
      toast({ variant: "destructive", title: "يرجى إدخال الاسم" });
      return;
    }
    if (cleanedPhone.length < 9) {
      toast({ variant: "destructive", title: "يرجى إدخال رقم جوال صحيح" });
      return;
    }
    if (!password || password.length < 4) {
      toast({ variant: "destructive", title: "كلمة المرور يجب أن تكون 4 أحرف على الأقل" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/register", {
        name: name.trim(),
        phone: cleanedPhone,
        email: email.trim() || undefined,
        password,
      });
      const customer = await res.json();
      setCustomer(customer);
      toast({ title: `أهلاً ${customer.name}!`, description: "تم إنشاء حسابك بنجاح" });
      onOpenChange(false);
      onProceed();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في إنشاء الحساب",
        description: err?.message || "تعذّر إنشاء الحساب",
      });
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Step, string> = {
    choose: "كيف تريد إكمال الطلب؟",
    quick: "دفع سريع",
    login: "تسجيل الدخول",
    register: "حساب جديد",
  };

  const descriptions: Record<Step, string> = {
    choose: "اختر الطريقة الأنسب لك",
    quick: "أدخل اسمك ورقم جوالك للمتابعة",
    login: "سجّل دخولك للحصول على نقاط الولاء",
    register: "أنشئ حساباً واكسب النقاط مع كل طلب",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl" data-testid="dialog-quick-checkout">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">{titles[step]}</DialogTitle>
          <DialogDescription className="text-center text-sm">{descriptions[step]}</DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-3 mt-2">
            <button
              onClick={() => setStep("login")}
              data-testid="button-choose-login"
              className="w-full p-4 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 transition-all text-right group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">سجّل الدخول واكسب النقاط</p>
                  <p className="text-xs text-muted-foreground mt-0.5">احصل على نقاط ولاء مع كل طلب</p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary opacity-50 group-hover:opacity-100 transition" />
              </div>
            </button>

            <button
              onClick={() => setStep("quick")}
              data-testid="button-choose-quick"
              className="w-full p-4 rounded-2xl border-2 border-border hover:border-foreground/30 bg-card hover:bg-muted/30 transition-all text-right group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">دفع سريع بدون تسجيل</p>
                  <p className="text-xs text-muted-foreground mt-0.5">فقط رقم الجوال والاسم</p>
                </div>
                <ArrowRight className="w-5 h-5 text-foreground/40 group-hover:text-foreground transition" />
              </div>
            </button>
          </div>
        )}

        {step === "quick" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="quick-name" className="text-sm font-semibold">
                <User className="w-4 h-4 inline ml-1" /> الاسم
              </Label>
              <Input
                id="quick-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك الكامل"
                className="h-12"
                data-testid="input-quick-name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-phone" className="text-sm font-semibold">
                <Phone className="w-4 h-4 inline ml-1" /> رقم الجوال
              </Label>
              <Input
                id="quick-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="h-12 text-right"
                data-testid="input-quick-phone"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("choose")}
                className="flex-1 h-12"
                data-testid="button-quick-back"
              >
                رجوع
              </Button>
              <Button
                onClick={handleQuickContinue}
                className="flex-1 h-12 bg-primary text-white font-bold"
                data-testid="button-quick-continue"
              >
                متابعة الدفع
              </Button>
            </div>
          </div>
        )}

        {step === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="login-id" className="text-sm font-semibold">
                <Phone className="w-4 h-4 inline ml-1" /> رقم الجوال أو البريد
              </Label>
              <Input
                id="login-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="05xxxxxxxx أو email@example.com"
                dir="ltr"
                className="h-12 text-right"
                data-testid="input-login-identifier"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-pass" className="text-sm font-semibold">
                <Lock className="w-4 h-4 inline ml-1" /> كلمة المرور
              </Label>
              <div className="relative">
                <Input
                  id="login-pass"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="h-12 pl-10"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep("register")}
              className="text-xs text-primary hover:underline w-full text-center"
              data-testid="button-switch-to-register"
            >
              ليس لديك حساب؟ أنشئ حساب جديد
            </button>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("choose")}
                className="flex-1 h-12"
                disabled={loading}
                data-testid="button-login-back"
              >
                رجوع
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-12 bg-primary text-white font-bold"
                data-testid="button-login-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تسجيل الدخول"}
              </Button>
            </div>
          </form>
        )}

        {step === "register" && (
          <form onSubmit={handleRegister} className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label htmlFor="reg-name" className="text-sm font-semibold">
                <User className="w-4 h-4 inline ml-1" /> الاسم
              </Label>
              <Input
                id="reg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك الكامل"
                className="h-12"
                data-testid="input-register-name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-phone" className="text-sm font-semibold">
                <Phone className="w-4 h-4 inline ml-1" /> رقم الجوال
              </Label>
              <Input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="h-12 text-right"
                data-testid="input-register-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email" className="text-sm font-semibold">البريد الإلكتروني (اختياري)</Label>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className="h-12 text-right"
                data-testid="input-register-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-pass" className="text-sm font-semibold">
                <Lock className="w-4 h-4 inline ml-1" /> كلمة المرور
              </Label>
              <Input
                id="reg-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="٤ أحرف على الأقل"
                className="h-12"
                data-testid="input-register-password"
              />
            </div>

            <button
              type="button"
              onClick={() => setStep("login")}
              className="text-xs text-primary hover:underline w-full text-center"
              data-testid="button-switch-to-login"
            >
              لديك حساب؟ سجّل الدخول
            </button>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("choose")}
                className="flex-1 h-12"
                disabled={loading}
                data-testid="button-register-back"
              >
                رجوع
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-12 bg-primary text-white font-bold"
                data-testid="button-register-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء الحساب"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

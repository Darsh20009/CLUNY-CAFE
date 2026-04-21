import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Zap, ArrowRight, User, Phone } from "lucide-react";
import { useLocation } from "wouter";
import { customerStorage } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";

interface QuickCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: () => void;
}

export default function QuickCheckoutDialog({ open, onOpenChange, onProceed }: QuickCheckoutDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"choose" | "quick">("choose");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const reset = () => {
    setStep("choose");
    setName("");
    setPhone("");
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleLogin = () => {
    sessionStorage.setItem("auth-return-to", "/checkout");
    onOpenChange(false);
    setLocation("/auth");
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl" data-testid="dialog-quick-checkout">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">
            {step === "choose" ? "كيف تريد إكمال الطلب؟" : "دفع سريع"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {step === "choose"
              ? "اختر الطريقة الأنسب لك"
              : "أدخل اسمك ورقم جوالك للمتابعة"}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="space-y-3 mt-2">
            <button
              onClick={handleLogin}
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
        ) : (
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
      </DialogContent>
    </Dialog>
  );
}

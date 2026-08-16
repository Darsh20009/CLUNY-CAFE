import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AtSign, Lock, Mail, Eye, EyeOff, Loader2, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";
import clunyLogoStaff from "@assets/cluny-logo-customer.png";

type Step = "username" | "otp" | "password";

export default function EmployeeForgotPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();

  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [resolvedUsername, setResolvedUsername] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const stepConfig = {
    username: { num: 1, label: tc("اسم المستخدم", "Username") },
    otp:      { num: 2, label: tc("رمز التحقق", "Verification Code") },
    password: { num: 3, label: tc("كلمة المرور الجديدة", "New Password") },
  };

  // Step 1 → Send OTP
  const sendOtpMutation = useMutation({
    mutationFn: async (uname: string) => {
      const res = await fetch("/api/employees/send-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || tc("فشل إرسال الرمز", "Failed to send code"));
      return data;
    },
    onSuccess: (data) => {
      setMaskedEmail(data.maskedEmail || "");
      setResolvedUsername(data.username || username);
      setError("");
      setStep("otp");
    },
    onError: (err: any) => setError(err?.message || tc("حدث خطأ", "An error occurred")),
  });

  // Step 3 → Verify OTP + reset password
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/employees/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resolvedUsername, otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || tc("فشل تغيير كلمة المرور", "Failed to change password"));
      return data;
    },
    onSuccess: () => {
      toast({
        title: tc("تم بنجاح!", "Success!"),
        description: tc("تم تغيير كلمة المرور. سيتم تحويلك لتسجيل الدخول", "Password changed. Redirecting..."),
      });
      setTimeout(() => navigate("/employee/login"), 2000);
    },
    onError: (err: any) => setError(err?.message || tc("حدث خطأ", "An error occurred")),
  });

  const handleUsernameNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError(tc("الرجاء إدخال اسم المستخدم", "Please enter your username")); return; }
    sendOtpMutation.mutate(username.trim());
  };

  const handleOtpNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp.trim() || otp.trim().length < 6) {
      setError(tc("الرجاء إدخال رمز التحقق المكون من 6 أرقام", "Please enter the 6-digit code"));
      return;
    }
    setStep("password");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newPassword || newPassword.length < 4) {
      setError(tc("كلمة المرور يجب أن تكون 4 أحرف على الأقل", "Password must be at least 4 characters"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tc("كلمة المرور غير متطابقة", "Passwords do not match"));
      return;
    }
    resetMutation.mutate();
  };

  const goBack = () => {
    setError("");
    if (step === "otp") setStep("username");
    else if (step === "password") setStep("otp");
    else navigate("/employee/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-40 h-28 mb-4">
            <img src={clunyLogoStaff} alt="CLUNY SYSTEMS" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 font-playfair">CLUNY SYSTEMS</h1>
          <p className="text-muted-foreground font-cairo">{tc("استعادة كلمة المرور", "Password Recovery")}</p>
        </div>

        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center font-playfair text-foreground">
              {tc("نسيت كلمة المرور؟", "Forgot Password?")}
            </CardTitle>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 pt-2" dir="ltr">
              {(["username", "otp", "password"] as Step[]).map((s, i) => {
                const isDone = stepConfig[step].num > i + 1;
                const isActive = step === s;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
                      ${isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    {i < 2 && <div className={`w-8 h-0.5 ${isDone ? "bg-primary" : "bg-muted"}`} />}
                  </div>
                );
              })}
            </div>
            <CardDescription className="text-center text-xs text-muted-foreground pt-1">
              {tc("الخطوة", "Step")} {stepConfig[step].num} {tc("من", "of")} 3 — {stepConfig[step].label}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Step 1: Username */}
            {step === "username" && (
              <form onSubmit={handleUsernameNext} className="space-y-4">
                <div className="relative">
                  <AtSign className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type="text"
                    placeholder={tc("اسم المستخدم أو البريد الإلكتروني", "Username or Email")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10 bg-background border-border"
                    data-testid="input-username"
                    autoFocus
                    autoComplete="username"
                    disabled={sendOtpMutation.isPending}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {tc("سيتم إرسال رمز التحقق إلى بريدك الإلكتروني المسجل", "A verification code will be sent to your registered email")}
                </p>
                {error && <p className="text-destructive text-sm text-right">{error}</p>}
                <Button type="submit" disabled={sendOtpMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold" data-testid="button-next">
                  {sendOtpMutation.isPending
                    ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />{tc("جاري الإرسال...", "Sending...")}</>
                    : <><ArrowRight className="w-4 h-4 mr-2" />{tc("إرسال رمز التحقق", "Send Verification Code")}</>
                  }
                </Button>
                <Button type="button" variant="ghost" onClick={goBack} className="w-full text-muted-foreground">
                  {tc("العودة لتسجيل الدخول", "Back to Login")}
                </Button>
              </form>
            )}

            {/* Step 2: Email OTP */}
            {step === "otp" && (
              <form onSubmit={handleOtpNext} className="space-y-4">
                <div className="bg-primary/5 rounded-lg px-4 py-3 text-sm flex items-start gap-3 border border-primary/20">
                  <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">{tc("تم الإرسال!", "Sent!")}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {tc("أُرسل رمز التحقق إلى", "Code sent to")}: <span className="font-medium text-primary">{maskedEmail}</span>
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={tc("أدخل الرمز المكون من 6 أرقام", "Enter 6-digit code")}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center tracking-[0.5em] text-2xl font-bold bg-background border-border h-14"
                    data-testid="input-otp"
                    autoFocus
                    maxLength={6}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {tc("الرمز صالح لمدة 10 دقائق", "Code valid for 10 minutes")}
                </p>

                {error && <p className="text-destructive text-sm text-right">{error}</p>}

                <Button
                  type="submit"
                  disabled={otp.length < 6}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  data-testid="button-verify-otp"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {tc("التحقق والمتابعة", "Verify & Continue")}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => sendOtpMutation.mutate(username.trim())}
                  disabled={sendOtpMutation.isPending}
                  className="w-full text-muted-foreground text-sm"
                  data-testid="button-resend"
                >
                  {sendOtpMutation.isPending
                    ? <><Loader2 className="ml-2 h-3 w-3 animate-spin" />{tc("جاري الإعادة...", "Resending...")}</>
                    : <><RefreshCw className="w-3 h-3 mr-2" />{tc("إعادة إرسال الرمز", "Resend Code")}</>
                  }
                </Button>

                <Button type="button" variant="ghost" onClick={goBack} className="w-full text-muted-foreground">
                  {tc("رجوع", "Back")}
                </Button>
              </form>
            )}

            {/* Step 3: New password */}
            {step === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm flex items-center gap-2 border border-border">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">{tc("تم التحقق من الهوية", "Identity verified")}</span>
                  <span className="font-medium text-foreground mr-auto">{resolvedUsername}</span>
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder={tc("كلمة المرور الجديدة", "New password")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10 pl-10 bg-background border-border"
                    data-testid="input-new-password"
                    autoFocus
                    autoComplete="new-password"
                    disabled={resetMutation.isPending}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute left-3 top-3 text-primary hover:text-primary/80">
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={tc("تأكيد كلمة المرور", "Confirm password")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10 pl-10 bg-background border-border"
                    data-testid="input-confirm-password"
                    autoComplete="new-password"
                    disabled={resetMutation.isPending}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-3 text-primary hover:text-primary/80">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {tc("كلمة المرور يجب أن تكون 4 أحرف على الأقل", "Password must be at least 4 characters")}
                </p>

                {error && <p className="text-destructive text-sm text-right">{error}</p>}

                <Button
                  type="submit"
                  disabled={resetMutation.isPending}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground font-bold"
                  data-testid="button-reset"
                >
                  {resetMutation.isPending
                    ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />{tc("جاري الحفظ...", "Saving...")}</>
                    : tc("حفظ كلمة المرور الجديدة", "Save New Password")
                  }
                </Button>
                <Button type="button" variant="ghost" onClick={goBack} className="w-full text-muted-foreground">
                  {tc("رجوع", "Back")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

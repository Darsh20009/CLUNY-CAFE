import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneInput } from "@/components/phone-input";
import { Coffee, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
 const [, navigate] = useLocation();
 const { toast } = useToast();
 const [email, setEmail] = useState("");
 const [phone, setPhone] = useState("");
 const [newPassword, setNewPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showNewPassword, setShowNewPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [step, setStep] = useState<'email' | 'phone' | 'password'>('email');
 const [verifiedEmail, setVerifiedEmail] = useState("");

 // Set SEO metadata
 useEffect(() => {
   document.title = "نسيت كلمة المرور - CLUNY CAFE | إعادة تعيين";
   const metaDesc = document.querySelector('meta[name="description"]');
   if (metaDesc) metaDesc.setAttribute('content', 'نسيت كلمة المرور؟ أعد تعيين كلمة مرورك على CLUNY CAFE بسهولة');
 }, []);

 const handleEmailSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
 toast({
 title: "خطأ",
 description: "البريد الإلكتروني غير صحيح",
 variant: "destructive"
 });
 return;
 }

 setLoading(true);

 try {
 const response = await apiRequest("POST", "/api/customers/check-email", { email });
 const data = await response.json();
 
 if (data.exists) {
 setVerifiedEmail(email);
 setStep('phone');
 toast({
 title: "البريد موجود",
 description: "الآن أدخل رقم الجوال المرتبط بهذا البريد",
 });
 } else {
 toast({
 title: "خطأ",
 description: "البريد الإلكتروني غير مسجل لدينا",
 variant: "destructive"
 });
 }
 } catch (error: any) {
 console.error("Check email error:", error);
 toast({
 title: "خطأ",
 description: error.message || "حدث خطأ أثناء التحقق من البريد",
 variant: "destructive"
 });
 } finally {
 setLoading(false);
 }
 };

 const handlePhoneSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 const cleanPhone = phone.trim().replace(/\s/g, '');
 if (!cleanPhone || !/^5\d{8}$/.test(cleanPhone)) {
 toast({
 title: "خطأ",
 description: "رقم الجوال يجب أن يبدأ بـ 5 ويتكون من 9 أرقام (مثال: 512345678)",
 variant: "destructive"
 });
 return;
 }

 setLoading(true);

 try {
 const response = await apiRequest("POST", "/api/customers/verify-phone-email", { 
 email: verifiedEmail, 
 phone: cleanPhone 
 });
 const data = await response.json();
 
 if (data.valid) {
 setStep('password');
 toast({
 title: "تم التحقق",
 description: "الآن أدخل كلمة المرور الجديدة ",
 });
 } else {
 toast({
 title: "خطأ",
 description: "رقم الجوال غير مطابق للبريد الإلكتروني",
 variant: "destructive"
 });
 }
 } catch (error: any) {
 console.error("Verify phone error:", error);
 toast({
 title: "خطأ",
 description: error.message || "حدث خطأ أثناء التحقق من رقم الجوال",
 variant: "destructive"
 });
 } finally {
 setLoading(false);
 }
 };

 const handlePasswordSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!newPassword || newPassword.length < 4) {
 toast({
 title: "خطأ",
 description: "كلمة المرور يجب أن تكون على الأقل 4 أحرف",
 variant: "destructive"
 });
 return;
 }

 if (newPassword !== confirmPassword) {
 toast({
 title: "خطأ",
 description: "كلمة المرور غير متطابقة",
 variant: "destructive"
 });
 return;
 }

 setLoading(true);

 const cleanPhone = phone.trim().replace(/\s/g, '');
 try {
 await apiRequest("POST", "/api/customers/reset-password-direct", {
 email: verifiedEmail,
 phone: cleanPhone,
 newPassword
 });
 
 toast({
 title: "تم بنجاح!",
 description: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن",
 });
 
 setTimeout(() => navigate("/auth"), 1500);
 } catch (error: any) {
 console.error("Reset password error:", error);
 toast({
 title: "خطأ",
 description: error.message || "حدث خطأ أثناء تغيير كلمة المرور",
 variant: "destructive"
 });
 } finally {
 setLoading(false);
 }
 };

 return (
 <div 
 className="min-h-screen flex items-center justify-center p-4"
 style={{
 background: "linear-gradient(135deg, hsl(165, 15%, 97%) 0%, hsl(165, 12%, 88%) 50%, hsl(165, 15%, 97%) 100%)",
 }}
 dir="rtl"
 >
 <Card className="w-full max-w-md border-primary/30 bg-card backdrop-blur shadow-xl">
 <CardHeader className="space-y-3 text-center pb-6">
 <div className="flex justify-center">
 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
 <Coffee className="w-10 h-10 text-white" />
 </div>
 </div>
 <CardTitle className="text-3xl font-bold text-foreground">
 {step === 'email' && 'نسيت كلمة المرور؟'}
 {step === 'phone' && 'تحقق من رقم الجوال'}
 {step === 'password' && 'كلمة المرور الجديدة '}
 </CardTitle>
 <CardDescription className="text-muted-foreground text-lg">
 {step === 'email' && 'أدخل بريدك الإلكتروني لإعادةتعيين كلمة المرور'}
 {step === 'phone' && 'أدخل رقم الجوال المرتبط بالبريد الإلكتروني'}
 {step === 'password' && 'أدخل كلمة المرور الجديدة وقم بتأكيدها'}
 </CardDescription>
 </CardHeader>

 <CardContent className="space-y-6">
 {step === 'email' && (
 <form onSubmit={handleEmailSubmit} className="space-y-5">
 <div className="space-y-2">
 <Label htmlFor="email" className="text-foreground flex items-center gap-2">
 <Mail className="w-4 h-4" />
 البريد الإلكتروني
 </Label>
 <Input
 id="email"
 type="email"
 placeholder="example@email.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/30"
 dir="ltr"
 data-testid="input-email"
 required
 />
 <p className="text-xs text-muted-foreground mt-1">
 أدخل البريد الإلكتروني الذي استخدمته عند إنشاء الحساب
 </p>
 </div>

 <Button
 type="submit"
 disabled={loading}
 className="w-full h-12 text-lg font-bold bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground shadow-lg shadow-accent/30 transition-all duration-300"
 data-testid="button-submit"
 >
 {loading ? (
 <div className="flex items-center gap-2">
 <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
 <span>جارٍ التحقق...</span>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <span>التالي</span>
 <ArrowRight className="w-5 h-5" />
 </div>
 )}
 </Button>
 </form>
 )}

 {step === 'phone' && (
 <form onSubmit={handlePhoneSubmit} className="space-y-5">
 <div className="space-y-2">
 <Label htmlFor="phone" className="text-foreground">رقم الجوال</Label>
 <PhoneInput
 id="phone"
 value={phone}
 onChange={(e) => setPhone(e)}
 placeholder="5xxxxxxxx"
 data-testid="input-phone"
 required
 />
 <p className="text-xs text-muted-foreground mt-1">
 أدخل رقم الجوال بدون الصفر (9 أرقام تبدأ بـ 5)
 </p>
 </div>

 <Button
 type="submit"
 disabled={loading}
 className="w-full h-12 text-lg font-bold bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground shadow-lg shadow-accent/30 transition-all duration-300"
 data-testid="button-verify-phone"
 >
 {loading ? (
 <div className="flex items-center gap-2">
 <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
 <span>جارٍ التحقق...</span>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <span>التحقق</span>
 <ArrowRight className="w-5 h-5" />
 </div>
 )}
 </Button>
 </form>
 )}

 {step === 'password' && (
 <form onSubmit={handlePasswordSubmit} className="space-y-5">
 <div className="space-y-2">
 <Label htmlFor="newPassword" className="text-foreground">كلمة المرور الجديدة </Label>
 <div className="relative">
 <Input
 id="newPassword"
 type={showNewPassword ? "text" : "password"}
 placeholder="أدخل كلمة المرور الجديدة "
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/30 pl-10"
 data-testid="input-new-password"
 required
 />
 <button
 type="button"
 onClick={() => setShowNewPassword(!showNewPassword)}
 className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
 data-testid="button-toggle-new-password"
 >
 {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="confirmPassword" className="text-foreground">تأكيد كلمة المرور</Label>
 <div className="relative">
 <Input
 id="confirmPassword"
 type={showConfirmPassword ? "text" : "password"}
 placeholder="أدخل كلمة المرور مرة أخرى"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/30 pl-10"
 data-testid="input-confirm-password"
 required
 />
 <button
 type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
 data-testid="button-toggle-confirm-password"
 >
 {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 كلمة المرور يجب أن تكون 4 أحرف على الأقل
 </p>
 </div>

 <Button
 type="submit"
 disabled={loading}
 className="w-full h-12 text-lg font-bold bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground shadow-lg shadow-accent/30 transition-all duration-300"
 data-testid="button-reset-password"
 >
 {loading ? (
 <div className="flex items-center gap-2">
 <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
 <span>جارٍ التغيير...</span>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <span>تغيير كلمة المرور</span>
 <ArrowRight className="w-5 h-5" />
 </div>
 )}
 </Button>
 </form>
 )}

 <div className="pt-4 text-center space-y-2">
 <button
 type="button"
 onClick={() => navigate("/auth")}
 className="text-muted-foreground hover:text-foreground transition-colors text-sm underline-offset-4 hover:underline"
 data-testid="link-back"
 >
 العودةلتسجيل الدخول
 </button>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}

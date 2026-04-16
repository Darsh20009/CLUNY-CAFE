import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
 const [, navigate] = useLocation();
 const { toast } = useToast();
 const [newPassword, setNewPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showNewPassword, setShowNewPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [verifying, setVerifying] = useState(true);
 const [tokenValid, setTokenValid] = useState(false);
 const [resetSuccess, setResetSuccess] = useState(false);
 const [token, setToken] = useState("");

 // Set SEO metadata
 useEffect(() => {
   document.title = "إعادة تعيين كلمة المرور - CLUNY CAFE";
   const metaDesc = document.querySelector('meta[name="description"]');
   if (metaDesc) metaDesc.setAttribute('content', 'إعادة تعيين كلمة المرور على CLUNY CAFE - أدخل كلمة مرور جديدة آمنة');
 }, []);

 useEffect(() => {
 const params = new URLSearchParams(window.location.search);
 const resetToken = params.get("token");
 
 if (!resetToken) {
 toast({
 title: "خطأ",
 description: "رابط إعادة التعيين غير صالح",
 variant: "destructive"
 });
 navigate("/auth");
 return;
 }

 setToken(resetToken);
 verifyToken(resetToken);
 }, []);

 const verifyToken = async (resetToken: string) => {
 setVerifying(true);
 try {
 const res = await apiRequest("POST", "/api/customers/verify-reset-token", { 
 token: resetToken 
 });
 const data = await res.json();
 
 if (data.valid) {
 setTokenValid(true);
 } else {
 toast({
 title: "خطأ",
 description: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية ",
 variant: "destructive"
 });
 setTimeout(() => navigate("/forgot-password"), 2000);
 }
 } catch (error: any) {
 console.error("Token verification error:", error);
 toast({
 title: "خطأ",
 description: error.message || "رابط إعادة التعيين غير صالح",
 variant: "destructive"
 });
 setTimeout(() => navigate("/forgot-password"), 2000);
 } finally {
 setVerifying(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
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

 try {
 await apiRequest("POST", "/api/customers/reset-password", {
 token,
 newPassword
 });
 
 setResetSuccess(true);
 toast({
 title: "نجح!",
 description: "تم تغيير كلمة المرور بنجاح",
 });

 setTimeout(() => navigate("/auth"), 3000);
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

 if (verifying) {
 return (
 <div 
 className="min-h-screen flex items-center justify-center p-4"
 style={{
 background: "linear-gradient(135deg, hsl(165, 15%, 97%) 0%, hsl(165, 12%, 88%) 50%, hsl(165, 15%, 97%) 100%)",
 }}
 dir="rtl"
 >
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
 <p className="text-foreground">جارٍ التحقق من الرابط...</p>
 </div>
 </div>
 );
 }

 if (!tokenValid) {
 return null;
 }

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
 {resetSuccess ? (
 <CheckCircle className="w-10 h-10 text-white" />
 ) : (
 <Coffee className="w-10 h-10 text-white" />
 )}
 </div>
 </div>
 <CardTitle className="text-3xl font-bold text-foreground">
 {resetSuccess ? "تم التغيير بنجاح!" : "إعادةتعيين كلمة المرور"}
 </CardTitle>
 <CardDescription className="text-muted-foreground text-lg">
 {resetSuccess ? "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة " : "أدخل كلمة المرور الجديدة "}
 </CardDescription>
 </CardHeader>

 <CardContent className="space-y-6">
 {!resetSuccess ? (
 <form onSubmit={handleSubmit} className="space-y-5">
 <div className="space-y-2">
 <Label htmlFor="new-password" className="text-foreground flex items-center gap-2">
 <Lock className="w-4 h-4" />
 كلمة المرور الجديدة 
 </Label>
 <div className="relative">
 <Input
 id="new-password"
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
 <Label htmlFor="confirm-password" className="text-foreground flex items-center gap-2">
 <Lock className="w-4 h-4" />
 تأكيد كلمة المرور
 </Label>
 <div className="relative">
 <Input
 id="confirm-password"
 type={showConfirmPassword ? "text" : "password"}
 placeholder="أعد إدخال كلمة المرور"
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
 كلمة المرور يجب أن تكون على الأقل 4 أحرف
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
 <span>جارٍ التغيير...</span>
 </div>
 ) : (
 "تغيير كلمة المرور"
 )}
 </Button>
 </form>
 ) : (
 <div className="space-y-4 text-center">
 <div className="p-4 rounded-lg bg-green-900/20 border border-green-700/30">
 <p className="text-green-300 text-sm">
 تم تغيير كلمة المرور بنجاح! سيتم تحويلك لصفحة تسجيل الدخول...
 </p>
 </div>
 <Button
 onClick={() => navigate("/auth")}
 className="w-full bg-primary hover:bg-primary"
 data-testid="button-go-to-login"
 >
 الذهاب لتسجيل الدخول
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ManagerForgotPassword() {
 const [, navigate] = useLocation();
 const { toast } = useToast();
 const [username, setUsername] = useState("");
 const [newPassword, setNewPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showNewPassword, setShowNewPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [step, setStep] = useState<'username' | 'password'>('username');

 const handleUsernameSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!username || username.trim().length < 2) {
 toast({
 title: "خطأ",
 description: "يرجى إدخال اسم المستخدم",
 variant: "destructive"
 });
 return;
 }

 setStep('password');
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

 try {
 const response = await fetch("/api/employees/reset-password-by-username", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ username, newPassword })
 });

 if (!response.ok) {
 throw new Error("فشل تغيير كلمة المرور");
 }

 toast({
 title: "نجح!",
 description: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن",
 });

 setTimeout(() => navigate("/manager/login"), 2000);
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
 background: "linear-gradient(135deg, #1a1410 0%, #2d1810 50%, #1a1410 100%)",
 }}
 dir="rtl"
 >
 <Card className="w-full max-w-md border-purple-900/30 bg-gradient-to-br from-stone-900/95 to-stone-950/95 backdrop-blur shadow-2xl">
 <CardHeader className="space-y-3 text-center pb-6">
 <div className="flex justify-center">
 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg shadow-purple-900/50">
 <Shield className="w-10 h-10 text-white" />
 </div>
 </div>
 <CardTitle className="text-3xl font-bold text-purple-100">
 نسيت كلمة المرور؟
 </CardTitle>
 <CardDescription className="text-purple-200/70 text-lg">
 {step === 'username' && 'أدخل اسم المستخدم لتغيير كلمة المرور'}
 {step === 'password' && 'أدخل كلمة المرور الجديدة'}
 </CardDescription>
 </CardHeader>

 <CardContent className="space-y-6">
 {step === 'username' && (
 <form onSubmit={handleUsernameSubmit} className="space-y-5">
 <div className="space-y-2">
 <Label htmlFor="username" className="text-purple-100">اسم المستخدم</Label>
 <Input
 id="username"
 type="text"
 placeholder="أدخل اسم المستخدم الخاص بك"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 className="bg-stone-800/50 border-purple-900/50 text-purple-50 placeholder:text-purple-200/40 focus:border-purple-600 focus:ring-purple-600/30"
 data-testid="input-username"
 required
 />
 </div>

 <Button
 type="submit"
 className="w-full h-12 text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-900/50 transition-all duration-300 hover:scale-[1.02]"
 data-testid="button-submit"
 >
 <div className="flex items-center gap-2">
 <span>التالي</span>
 <ArrowRight className="w-5 h-5" />
 </div>
 </Button>
 </form>
 )}

 {step === 'password' && (
 <form onSubmit={handlePasswordSubmit} className="space-y-5">
 <div className="space-y-2">
 <Label htmlFor="newPassword" className="text-purple-100">كلمة المرور الجديدة</Label>
 <div className="relative">
 <Input
 id="newPassword"
 type={showNewPassword ? "text" : "password"}
 placeholder="أدخل كلمة المرور الجديدة"
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 className="bg-stone-800/50 border-purple-900/50 text-purple-50 placeholder:text-purple-200/40 focus:border-purple-600 focus:ring-purple-600/30 pl-10"
 data-testid="input-new-password"
 required
 />
 <button
 type="button"
 onClick={() => setShowNewPassword(!showNewPassword)}
 className="absolute left-3 top-2.5 text-purple-400 hover:text-purple-300"
 data-testid="button-toggle-new-password"
 >
 {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="confirmPassword" className="text-purple-100">تأكيد كلمة المرور</Label>
 <div className="relative">
 <Input
 id="confirmPassword"
 type={showConfirmPassword ? "text" : "password"}
 placeholder="أعد إدخال كلمة المرور"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 className="bg-stone-800/50 border-purple-900/50 text-purple-50 placeholder:text-purple-200/40 focus:border-purple-600 focus:ring-purple-600/30 pl-10"
 data-testid="input-confirm-password"
 required
 />
 <button
 type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className="absolute left-3 top-2.5 text-purple-400 hover:text-purple-300"
 data-testid="button-toggle-confirm-password"
 >
 {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 <p className="text-xs text-purple-200/50 mt-1">
 كلمة المرور يجب أن تكون على الأقل 4 أحرف
 </p>
 </div>

 <Button
 type="submit"
 disabled={loading}
 className="w-full h-12 text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-900/50 transition-all duration-300 hover:scale-[1.02]"
 data-testid="button-reset-password"
 >
 {loading ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
 </Button>
 </form>
 )}

 <div className="pt-4 text-center">
 <button
 type="button"
 onClick={() => {
 if (step === 'password') {
 setStep('username');
 setNewPassword("");
 setConfirmPassword("");
 } else {
 navigate("/manager");
 }
 }}
 className="text-purple-500 hover:text-purple-400 text-sm"
 data-testid="button-back"
 >
 {step === 'password' ? "رجوع" : "العودة لتسجيل الدخول"}
 </button>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}

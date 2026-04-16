import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/phone-input";
import { useToast } from "@/hooks/use-toast";
import { Coffee, UserPlus, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function EmployeeActivation() {
 const [, setLocation] = useLocation();
 const { toast } = useToast();
 const [isLoading, setIsLoading] = useState(false);
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [phone, setPhone] = useState("");
 const [fullName, setFullName] = useState("");
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 setIsLoading(true);

 if (password !== confirmPassword) {
 toast({
 variant: "destructive",
 title: "خطأ",
 description: "كلمات المرور غير متطابقة",
 });
 setIsLoading(false);
 return;
 }

 if (password.length < 4) {
 toast({
 variant: "destructive",
 title: "خطأ",
 description: "كلمة المرور يجب أن تكون على الأقل 4 أحرف",
 });
 setIsLoading(false);
 return;
 }

 try {
 const res = await apiRequest("POST", "/api/employees/activate", { phone, fullName, password });
 const response = await res.json();

 localStorage.setItem("currentEmployee", JSON.stringify(response));
 
 toast({
 title: "تم التفعيل بنجاح",
 description: "مرحباً بك! تم تفعيل حسابك بنجاح",
 });

 setLocation("/employee/dashboard");
 } catch (error: any) {
 toast({
 variant: "destructive",
 title: "فشل التفعيل",
 description: error.message || "حدث خطأ أثناء تفعيل الحساب. تأكد من رقم الهاتف والاسم.",
 });
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
 <Card className="w-full max-w-md bg-gradient-to-br from-background to-background border-primary/20">
 <CardHeader className="space-y-4">
 <div className="flex justify-center">
 <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center">
 <Coffee className="w-8 h-8 text-white" />
 </div>
 </div>
 <div className="text-center">
 <CardTitle className="text-2xl font-bold text-accent">تفعيل حساب موظف جديد</CardTitle>
 <CardDescription className="text-gray-400 mt-2">
 أدخل بياناتك التي سجلها المدير لإنشاء كلمة المرور الخاصةبك
 </CardDescription>
 </div>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <Label htmlFor="fullName" className="text-gray-300">
 الاسم الكامل
 </Label>
 <Input
 id="fullName"
 value={fullName}
 onChange={(e) => setFullName(e.target.value)}
 required
 placeholder="أدخل اسمك الكامل كما سجله المدير"
 className="bg-[#1a1410] border-primary/30 text-white placeholder:text-gray-500"
 data-testid="input-fullname"
 />
 <p className="text-xs text-gray-400 mt-1">يجب أن يطابق الاسم المسجل لدى المدير</p>
 </div>

 <div>
 <Label htmlFor="phone" className="text-gray-300">
 رقم الهاتف
 </Label>
 <PhoneInput
 id="phone"
 value={phone}
 onChange={(e) => setPhone(e)}
 placeholder="5xxxxxxxx"
 data-testid="input-phone"
 required
 />
 <p className="text-xs text-gray-400 mt-1">رقم الهاتف المسجل لدى المدير</p>
 </div>

 <div className="border-t border-primary/20 pt-4">
 <div className="mb-4">
 <Label htmlFor="password" className="text-gray-300">
 كلمة المرور الجديدة 
 </Label>
 <div className="relative">
 <Input
 id="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 type={showPassword ? "text" : "password"}
 required
 minLength={4}
 placeholder="أدخل كلمة مرور قوية"
 className="bg-[#1a1410] border-primary/30 text-white placeholder:text-gray-500 pl-10"
 data-testid="input-password"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute left-3 top-3 text-accent hover:text-accent"
 >
 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>

 <div>
 <Label htmlFor="confirmPassword" className="text-gray-300">
 تأكيد كلمة المرور
 </Label>
 <div className="relative">
 <Input
 id="confirmPassword"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 type={showConfirmPassword ? "text" : "password"}
 required
 minLength={4}
 placeholder="أعد إدخال كلمة المرور"
 className="bg-[#1a1410] border-primary/30 text-white placeholder:text-gray-500 pl-10"
 data-testid="input-confirm-password"
 />
 <button
 type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className="absolute left-3 top-3 text-accent hover:text-accent"
 >
 {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>
 </div>

 <div className="bg-background0/10 border border-primary/30 rounded-lg p-4">
 <div className="flex items-start gap-2">
 <UserPlus className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
 <div className="text-sm text-accent/90">
 <p className="font-semibold mb-1">تعليمات مهمة:</p>
 <ul className="list-disc list-inside space-y-1">
 <li>تأكد من إدخال رقم الهاتف والاسم المسجلين لدى المدير بدقة</li>
 <li>اختر كلمة مرور قويةلا تقل عن 4 أحرف</li>
 <li>احفظ كلمة المرور في مكان آمن</li>
 </ul>
 </div>
 </div>
 </div>

 <Button
 type="submit"
 disabled={isLoading}
 className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white"
 data-testid="button-activate"
 >
 {isLoading ? "جاري التفعيل..." : "تفعيل الحساب"}
 </Button>

 <div className="text-center">
 <Button
 type="button"
 variant="ghost"
 onClick={() => setLocation("/employee/login")}
 className="text-accent hover:text-accent"
 data-testid="button-back-to-login"
 >
 العودةإلى تسجيل الدخول
 </Button>
 </div>
 </form>
 </CardContent>
 </Card>
 </div>
 );
}

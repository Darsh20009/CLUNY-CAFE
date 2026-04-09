import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import type { Employee } from "@shared/schema";
import clunyLogoStaff from "@assets/cluny-logo-staff.png";

export default function ManagerLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch("/api/employees/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      return response.json() as Promise<Employee>;
    },
    onSuccess: (employee: any) => {
      if (employee.role !== "manager" && employee.role !== "admin") {
        setError("هذا الحساب ليس حساب مدير");
        setPassword("");
        return;
      }

      if (employee.restoreKey) {
        localStorage.setItem("cluny-restore-key", employee.restoreKey);
        delete employee.restoreKey;
      }
      localStorage.setItem("currentEmployee", JSON.stringify(employee));
      setLocation("/manager/dashboard");
    },
    onError: () => {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة ");
      setPassword("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    loginMutation.mutate({ username, password });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-40 h-28 mb-4">
            <img src={clunyLogoStaff} alt="CLUNY SYSTEMS" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold font-playfair text-foreground mb-2">CLUNY CAFE</h1>
          <p className="text-muted-foreground font-cairo">تسجيل دخول المدير</p>
        </div>

        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center font-playfair text-foreground">
              لوحة تحكم المدير
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              أدخل بيانات حساب المدير للوصول
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="اسم المستخدم"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10"
                    data-testid="input-username"
                    autoComplete="username"
                    autoFocus
                    disabled={loginMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10"
                    data-testid="input-password"
                    autoComplete="current-password"
                    disabled={loginMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setLocation("/manager/forgot-password")}
                    className="text-xs text-primary hover:text-primary/80 underline"
                    data-testid="link-forgot-password"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                {error && (
                  <p className="text-destructive text-sm text-right" data-testid="text-error">
                    {error}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground font-semibold"
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  "دخول"
                )}
              </Button>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground text-center mb-2">موظف عادي؟</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/employee/login")}
                  className="w-full"
                  data-testid="button-employee-login"
                >
                  تسجيل دخول الموظف
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="link-back"
          >
            رجوع
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function EmployeeGateway() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Set SEO metadata
  useEffect(() => {
    document.title = "بوابة الموظفين - CLUNY CAFE | نظام الإدارة";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'بوابة دخول الموظفين لنظام إدارة CLUNY CAFE - نظام متكامل لإدارة الطلبات والمبيعات');
  }, []);

  useEffect(() => {
    const gatewayPassed = localStorage.getItem("cluny-gateway-passed");
    if (gatewayPassed === "true") {
      setLocation("/employee/login");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === "c2030") {
      localStorage.setItem("cluny-gateway-passed", "true");
      setLocation("/employee/login");
    } else {
      setError("كلمة المرور غير صحيحة ");
      setPassword("");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 font-playfair">CLUNY SYSTEMS</h1>
          <p className="text-muted-foreground font-cairo">بوابة الموظفين</p>
        </div>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-primary font-playfair">
              دخول الموظفين
            </CardTitle>
            <CardDescription className="text-center font-cairo">
              أدخل كلمة المرور العامة للوصول
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="كلمة المرور العامة"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10 text-right bg-background border-border"
                    data-testid="input-gateway-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-primary hover:text-primary/80"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                data-testid="button-gateway-submit"
              >
                دخول
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="text-primary hover:text-primary/80"
            data-testid="link-back-home"
          >
            العودة للصفحة الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}

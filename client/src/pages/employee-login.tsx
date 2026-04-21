import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Loader2, Eye, EyeOff, QrCode, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import { Html5QrcodeScanner } from "html5-qrcode";
import clunyLogoStaff from "@assets/cluny-logo-staff.png";

function getDashboardForRole(role?: string): string {
  if (role === "admin" || role === "owner") return "/admin/dashboard";
  if (role === "manager") return "/manager/dashboard";
  return "/employee/dashboard";
}

export default function EmployeeLogin() {
  const [location, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);

  const [rememberMe, setRememberMe] = useState(true);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    document.title = "تسجيل دخول الموظفين - CLUNY SYSTEMS";

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Auto-login if session exists
    const stored = localStorage.getItem("currentEmployee");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
           window.location.href = getDashboardForRole(parsed.role);
           return;
        }
      } catch (e) { console.warn('[EmployeeLogin] Failed to parse stored employee:', e); }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username?: string; employeeId?: string; password?: string }) => {
      const isQRLogin = !!credentials.employeeId && !credentials.password;
      const endpoint = isQRLogin ? "/api/employees/login-qr" : "/api/employees/login";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "فشل تسجيل الدخول");
      }
      
      return data as Employee;
    },
    onSuccess: (employee: any) => {
      if (employee.restoreKey) {
        localStorage.setItem("cluny-restore-key", employee.restoreKey);
        delete employee.restoreKey;
      }
      localStorage.setItem("currentEmployee", JSON.stringify(employee));
      window.location.href = getDashboardForRole(employee.role);
    },
    onError: (err: any) => {
      setError(err?.message || "بيانات تسجيل الدخول غير صحيحة");
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

    const normalizedUsername = username.trim().toLowerCase();
    loginMutation.mutate({ username: normalizedUsername, password });
  };

  useEffect(() => {
    if (!showQRScanner) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        try {
          const scannedId = decodedText.trim();
          if (scannedId) {
            setError("");
            scanner.clear();
            setShowQRScanner(false);
            
            loginMutation.mutate({ employeeId: scannedId });
          } else {
            setError("صيغة الباركود غير صحيحة");
          }
        } catch (err) {
          setError("خطأ في قراءة الباركود");
        }
      },
      (error) => {
        console.debug("QR scan error:", error);
      }
    );

    qrScannerRef.current = scanner;

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(() => {});
      }
    };
  }, [showQRScanner, loginMutation]);

  const handleToggleQRScanner = () => {
    setError("");
    setShowQRScanner(!showQRScanner);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-40 h-28 mb-4">
            <img src={clunyLogoStaff} alt="CLUNY SYSTEMS" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 font-playfair">CLUNY SYSTEMS</h1>
          <p className="text-muted-foreground font-cairo">تسجيل دخول الموظف</p>
        </div>

        {showQRScanner ? (
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-center font-playfair text-accent">
                مسح بطاقة الموظف
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                وجه الكاميرا نحو QR الكود الموجود على بطاقتك
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div id="qr-reader" className="w-full overflow-hidden rounded-md border border-border" />
              {error && (
                <p className="text-destructive text-sm text-center" data-testid="text-qr-error">
                  {error}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleToggleQRScanner}
                className="w-full border-primary/20 text-primary"
                data-testid="button-cancel-qr"
              >
                إلغاء
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-center font-playfair text-foreground">
                تسجيل الدخول
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                أدخل بيانات حسابك للوصول
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute right-3 top-3 h-5 w-5 text-primary" />
                    <Input
                      type="text"
                      placeholder="اسم المستخدم"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pr-10 bg-background border-border"
                      data-testid="input-username"
                      autoFocus
                      disabled={loginMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 pl-10 bg-background border-border"
                      data-testid="input-password"
                      disabled={loginMutation.isPending}
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
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setLocation("/employee/forgot-password")}
                      className="text-xs text-accent hover:text-accent/80 underline"
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
                
                <div className="flex items-center space-x-2 space-x-reverse mb-4">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="remember-me" className="text-sm text-muted-foreground mr-2">تذكرني</label>
                </div>
                
                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground font-bold"
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

                <div className="pt-4 border-t border-border space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleToggleQRScanner}
                    className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                    data-testid="button-scan-qr"
                  >
                    <QrCode className="w-4 h-4 ml-2" />
                    مسح بطاقة الموظف
                  </Button>

                  <p className="text-sm text-muted-foreground text-center">موظف جديد؟</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/employee/activate")}
                    className="w-full border-primary/20 text-primary"
                    data-testid="button-activate"
                  >
                    تفعيل حساب جديد
                  </Button>

                  <div className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        const manifestTag = document.getElementById('main-manifest') as HTMLLinkElement;
                        if (manifestTag) manifestTag.href = '/employee-manifest.json';
                        
                        // Force update for some browsers
                        const newManifest = manifestTag.cloneNode(true) as HTMLLinkElement;
                        newManifest.href = '/employee-manifest.json?v=' + Date.now();
                        manifestTag.parentNode?.replaceChild(newManifest, manifestTag);

                        if (deferredPrompt) {
                          deferredPrompt.prompt();
                          const { outcome } = await deferredPrompt.userChoice;
                          if (outcome === 'accepted') {
                            setDeferredPrompt(null);
                          }
                        } else {
                          const ua = navigator.userAgent.toLowerCase();
                          if (/iphone|ipad|ipod/.test(ua)) {
                            alert("لتثبيت النظام على iPhone: اضغط على زر 'مشاركة' ثم 'إضافة إلى الشاشة الرئيسية'");
                          } else {
                            alert("لتثبيت النظام: اضغط على القائمة (⋮) ثم 'تثبيت التطبيق'");
                          }
                        }
                      }}
                      className="w-full text-primary font-bold hover:bg-primary/5"
                    >
                      <Download className="ml-2 h-4 w-4" />
                      تحميل نظام الموظفين
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/employee/gateway")}
            className="text-primary hover:text-primary/80"
            data-testid="link-back"
          >
            رجوع
          </Button>
        </div>
      </div>
    </div>
  );
}
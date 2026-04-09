import { useLocation } from "wouter";
import { ShieldX, Home, ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-4 w-fit">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">غير مصرح</CardTitle>
          <CardDescription className="text-base">
            ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع المدير أو تسجيل الدخول بحساب مختلف.
          </p>
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => setLocation("/")}
              className="w-full"
              data-testid="button-home"
            >
              <Home className="h-4 w-4 ml-2" />
              العودة للرئيسية
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full"
              data-testid="button-back"
            >
              <ArrowRight className="h-4 w-4 ml-2" />
              العودة للصفحة السابقة
            </Button>

            <div className="flex gap-2">
              <Button 
                variant="ghost"
                onClick={() => setLocation("/employee/gateway")}
                className="flex-1"
                data-testid="button-employee-login"
              >
                <LogIn className="h-4 w-4 ml-2" />
                دخول الموظفين
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setLocation("/manager/login")}
                className="flex-1"
                data-testid="button-manager-login"
              >
                <LogIn className="h-4 w-4 ml-2" />
                دخول المديرين
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle2, Loader2, Mail, Send, Wifi, XCircle,
  Server, RefreshCcw, FileBarChart, ShoppingBag, UserPlus, KeyRound, AlertTriangle,
} from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

type HealthData = { healthy: boolean; message: string; host?: string; user?: string };

const AUTO_EMAIL_TYPES = [
  {
    icon: ShoppingBag,
    titleAr: "إشعارات الطلبات للعميل",
    descAr: "عند إنشاء طلب جديد أو تغيير حالته (قيد التحضير، جاهز، مكتمل، ملغي)",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: FileBarChart,
    titleAr: "تقرير يومي للأدمن",
    descAr: "يُرسل تلقائياً كل ليلة — يشمل عدد الطلبات، الإيرادات، الأكثر مبيعاً، وتنبيهات المخزون",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    icon: FileBarChart,
    titleAr: "تقرير أسبوعي للأدمن",
    descAr: "يُرسل تلقائياً كل جمعة — ملخص 7 أيام مع المتوسط اليومي والأكثر مبيعاً",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    icon: UserPlus,
    titleAr: "ترحيب الموظف الجديد",
    descAr: "يُرسل تلقائياً عند إنشاء حساب موظف — يتضمن اسم المستخدم وكلمة المرور ورابط الدخول",
    color: "text-teal-600",
    bg: "bg-teal-50",
  },
  {
    icon: KeyRound,
    titleAr: "نسيت كلمة المرور (OTP)",
    descAr: "عند طلب إعادة تعيين كلمة المرور — رمز 6 أرقام صالح 10 دقائق",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

export default function AdminEmail() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: customers, isLoading: customersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/customers-list"],
  });

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthData>({
    queryKey: ["/api/email/health"],
    retry: false,
    staleTime: 60_000,
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/test", { to: testTo.trim() || undefined });
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult({ ok: data.sent, msg: data.message || "" });
      toast({
        title: data.sent ? "✅ تم الإرسال" : "❌ فشل الإرسال",
        description: data.message,
        variant: data.sent ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      const msg = error.message || "خطأ في الاتصال";
      setTestResult({ ok: false, msg });
      toast({ title: "❌ خطأ", description: msg, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/reset-transporter", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.healthy ? "✅ تمت إعادة الاتصال" : "⚠️ إعادة الاتصال فشلت",
        description: data.message,
      });
      refetchHealth();
    },
  });

  const dailyReportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/trigger-daily-report", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "✅ تم إرسال التقرير اليومي" : "❌ فشل الإرسال",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { customerId: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-email", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم الإرسال بنجاح", description: "تم إرسال البريد للعميل." });
      setSubject(""); setMessage(""); setSelectedCustomerId("");
    },
    onError: (error: Error) => {
      toast({ title: "❌ فشل الإرسال", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5" dir="rtl">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">البريد الإلكتروني</h1>
          <p className="text-sm text-muted-foreground">إدارة الإشعارات البريدية ومراقبة اتصال cPanel SMTP</p>
        </div>
      </div>

      {/* ─── SMTP Status Card ─── */}
      <Card className={`border-2 ${health?.healthy ? "border-green-200 bg-green-50/30" : healthLoading ? "border-muted" : "border-red-200 bg-red-50/30"}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            حالة اتصال cPanel SMTP
            {healthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-auto" />
            ) : health?.healthy ? (
              <Badge className="mr-auto bg-green-600 hover:bg-green-600 text-white text-xs">متصل ✅</Badge>
            ) : (
              <Badge variant="destructive" className="mr-auto text-xs">غير متصل ❌</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-background/80 border p-3 space-y-2 text-xs" dir="ltr">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Host</span>
              <Badge variant="outline" className="font-mono">server222.web-hosting.com:465</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Sender</span>
              <Badge variant="outline" className="font-mono">info@qirox.online</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Security</span>
              <Badge variant="outline" className="font-mono">SSL/TLS port 465</Badge>
            </div>
            {health?.message && (
              <div className="flex justify-between items-center pt-1 border-t">
                <span className="text-muted-foreground font-medium">Status</span>
                <span className={`text-xs font-medium ${health.healthy ? "text-green-700" : "text-red-700"}`}>
                  {health.message}
                </span>
              </div>
            )}
          </div>

          {!health?.healthy && !healthLoading && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                تحقق من أن <strong>SMTP_PASS</strong> مضبوط بشكل صحيح في متغيرات البيئة (Secrets). يمكنك إعادة تهيئة الاتصال بالزر أدناه.
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { refetchHealth(); resetMutation.mutate(); }}
              disabled={resetMutation.isPending}
              className="gap-1.5 text-xs"
              data-testid="button-reset-smtp"
            >
              {resetMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              إعادة تهيئة الاتصال
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchHealth()}
              disabled={healthLoading}
              className="gap-1.5 text-xs"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${healthLoading ? "animate-spin" : ""}`} />
              تحديث الحالة
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Test Email ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="h-4 w-4 text-primary" />
            إرسال بريد تجريبي
          </CardTitle>
          <CardDescription className="text-xs">
            تحقق من عمل الاتصال بإرسال رسالة اختبار إلى بريدك الإلكتروني
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="البريد المستلم للاختبار"
              value={testTo}
              onChange={(e) => { setTestTo(e.target.value); setTestResult(null); }}
              data-testid="input-test-email-to"
              className="flex-1 text-sm"
              dir="ltr"
            />
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testTo.trim()}
              data-testid="button-send-test-email"
              className="gap-2 shrink-0"
              size="sm"
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              اختبار
            </Button>
          </div>

          {testResult && (
            <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
              testResult.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
            }`} data-testid="status-test-email-result">
              {testResult.ok
                ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                : <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
              <span className="text-sm">{testResult.msg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Quick Actions ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileBarChart className="h-4 w-4 text-primary" />
            إجراءات سريعة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full gap-2 justify-start text-sm"
            onClick={() => dailyReportMutation.mutate()}
            disabled={dailyReportMutation.isPending}
            data-testid="button-trigger-daily-report"
          >
            {dailyReportMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileBarChart className="h-4 w-4 text-green-600" />}
            إرسال التقرير اليومي الآن إلى الأدمن
          </Button>
        </CardContent>
      </Card>

      {/* ─── Automatic Emails Info ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">البريد التلقائي المرتبط بالنظام</CardTitle>
          <CardDescription className="text-xs">هذه الأنواع تُرسل تلقائياً دون تدخل يدوي</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {AUTO_EMAIL_TYPES.map((type, i) => {
            const Icon = type.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${type.bg}`}>
                <div className={`p-1.5 rounded-md bg-white/70 shrink-0 ${type.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${type.color}`}>{type.titleAr}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{type.descAr}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-auto shrink-0 mt-0.5" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Separator />

      {/* ─── Send to Customer ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-primary" />
            إرسال رسالة مخصصة للعميل
          </CardTitle>
          <CardDescription className="text-xs">
            أرسل رسائل أو عروض ترويجية لعملائك المسجلين
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">اختر العميل</label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger data-testid="select-customer-email" className="text-sm">
                <SelectValue placeholder={customersLoading ? "جاري التحميل..." : "اختر عميلاً..."} />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">الموضوع</label>
            <Input
              placeholder="موضوع الرسالة"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-email-subject"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">الرسالة</label>
            <Textarea
              placeholder="اكتب رسالتك هنا..."
              className="min-h-[120px] text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="textarea-email-message"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={() => sendMutation.mutate({ customerId: selectedCustomerId, subject, message })}
            disabled={sendMutation.isPending || !selectedCustomerId || !subject || !message}
            data-testid="button-send-customer-email"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            إرسال
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

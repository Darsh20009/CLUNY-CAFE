import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Loader2, Mail, Send, Wifi, XCircle } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

export default function AdminEmail() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: customers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/customers-list"],
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { customerId: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-email", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: tc("تم الإرسال بنجاح", "Sent Successfully"),
        description: tc("تم إرسال البريد الإلكتروني للعميل بنجاح.", "Email sent to customer successfully."),
      });
      setSubject("");
      setMessage("");
      setSelectedCustomerId("");
    },
    onError: (error: Error) => {
      toast({
        title: tc("فشل الإرسال", "Send Failed"),
        description: error.message || tc("حدث خطأ أثناء إرسال البريد الإلكتروني.", "An error occurred while sending the email."),
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/test-email", {
        to: testTo.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult({ ok: data.success, msg: data.message || data.error || "" });
      toast({
        title: data.success
          ? tc("✅ تم إرسال البريد التجريبي", "✅ Test Email Sent")
          : tc("❌ فشل الإرسال", "❌ Send Failed"),
        description: data.message || data.error,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      const msg = error.message || tc("حدث خطأ في الاتصال", "Connection error");
      setTestResult({ ok: false, msg });
      toast({ title: tc("❌ خطأ", "❌ Error"), description: msg, variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!selectedCustomerId || !subject || !message) {
      toast({
        title: tc("تنبيه", "Notice"),
        description: tc("يرجى ملء جميع الحقول المطلوبة.", "Please fill in all required fields."),
        variant: "destructive",
      });
      return;
    }
    sendMutation.mutate({ customerId: selectedCustomerId, subject, message });
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">

      {/* ─── Test Email Card ─── */}
      <Card className="border-2 border-dashed border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wifi className="h-5 w-5 text-primary" />
            {tc("اختبار اتصال البريد الإلكتروني", "Test Email Connection")}
          </CardTitle>
          <CardDescription>
            {tc(
              "أرسل بريداً تجريبياً للتحقق من صحة إعدادات SMTP.",
              "Send a test email to verify SMTP settings are working."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={tc("البريد المستلم (اختياري)", "Recipient email (optional)")}
              value={testTo}
              onChange={(e) => { setTestTo(e.target.value); setTestResult(null); }}
              data-testid="input-test-email-to"
              className="flex-1"
              dir="ltr"
            />
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-send-test-email"
              className="gap-2 shrink-0"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {tc("إرسال تجريبي", "Send Test")}
            </Button>
          </div>

          {testResult && (
            <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
              testResult.ok
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`} data-testid="status-test-email-result">
              {testResult.ok
                ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                : <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs text-muted-foreground" dir="ltr">
            <div className="flex justify-between">
              <span className="font-medium">Host</span>
              <Badge variant="outline" className="font-mono text-xs">server222.web-hosting.com:465</Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">From</span>
              <Badge variant="outline" className="font-mono text-xs">info@qirox.online</Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Security</span>
              <Badge variant="outline" className="font-mono text-xs">SSL/TLS</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Send to Customer Card ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            {tc("إرسال بريد إلكتروني للعملاء", "Send Email to Customers")}
          </CardTitle>
          <CardDescription>
            {tc("أرسل رسائل مخصصة أو عروض ترويجية لعملائك المسجلين.", "Send personalized messages or promotions to your registered customers.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{tc("اختر العميل", "Select Customer")}</label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger data-testid="select-customer-email">
                <SelectValue placeholder={isLoading ? tc("جاري التحميل...", "Loading...") : tc("اختر عميلاً", "Select a customer")} />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer: any) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tc("الموضوع", "Subject")}</label>
            <Input
              placeholder={tc("أدخل موضوع الرسالة", "Enter email subject")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-email-subject"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tc("الرسالة", "Message")}</label>
            <Textarea
              placeholder={tc("اكتب رسالتك هنا...", "Write your message here...")}
              className="min-h-[150px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="textarea-email-message"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSend}
            disabled={sendMutation.isPending}
            data-testid="button-send-customer-email"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {tc("إرسال البريد الإلكتروني", "Send Email")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

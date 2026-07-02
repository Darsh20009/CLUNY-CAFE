import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Loader2, CheckCircle2, X, User } from "lucide-react";

export default function EmailComposerWidget() {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/send-direct", {
        to: to.trim(),
        recipientName: recipientName.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل الإرسال");
      }
      return res.json();
    },
    onSuccess: () => {
      setSent(true);
      toast({ title: "✅ تم الإرسال", description: `البريد أُرسل إلى ${to}` });
    },
    onError: (err: any) => {
      toast({ title: "❌ فشل الإرسال", description: err.message, variant: "destructive" });
    },
  });

  const handleReset = () => {
    setTo("");
    setRecipientName("");
    setSubject("");
    setMessage("");
    setSent(false);
  };

  const isValid = to.trim() && subject.trim() && message.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  return (
    <Card className="border border-border bg-card" dir="rtl">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm text-foreground flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          إرسال بريد إلكتروني
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {sent ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">تم إرسال البريد بنجاح</p>
            <p className="text-xs text-muted-foreground">{to}</p>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 mt-1">
              <X className="w-3.5 h-3.5" />
              إرسال بريد جديد
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Recipient row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" /> البريد الإلكتروني <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="example@email.com"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="h-8 text-xs"
                  dir="ltr"
                  data-testid="input-email-to"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /> اسم المستلم (اختياري)
                </Label>
                <Input
                  placeholder="محمد أحمد"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-email-name"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                الموضوع <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="موضوع البريد الإلكتروني"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="h-8 text-xs"
                data-testid="input-email-subject"
              />
            </div>

            {/* Message body */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                محتوى الرسالة <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="اكتب محتوى رسالتك هنا..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                className="text-xs resize-none"
                data-testid="input-email-message"
              />
              <p className="text-[10px] text-muted-foreground">{message.length} حرف</p>
            </div>

            {/* Send button */}
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!isValid || sendMutation.isPending}
              className="w-full gap-2 h-9"
              data-testid="btn-send-email"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sendMutation.isPending ? "جاري الإرسال..." : "إرسال البريد"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

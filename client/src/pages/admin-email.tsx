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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Mail, Send } from "lucide-react";

export default function AdminEmail() {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: customers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/customers-list"],
  });

  const mutation = useMutation({
    mutationFn: async (payload: { customerId: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-email", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إرسال البريد الإلكتروني للعميل بنجاح.",
      });
      setSubject("");
      setMessage("");
      setSelectedCustomerId("");
    },
    onError: (error: Error) => {
      toast({
        title: "فشل الإرسال",
        description: error.message || "حدث خطأ أثناء إرسال البريد الإلكتروني.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!selectedCustomerId || !subject || !message) {
      toast({
        title: "تنبيه",
        description: "يرجى ملء جميع الحقول المطلوبة.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({ customerId: selectedCustomerId, subject, message });
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            إرسال بريد إلكتروني للعملاء
          </CardTitle>
          <CardDescription>
            أرسل رسائل مخصصة أو عروض ترويجية لعملائك المسجلين.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">اختر العميل</label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "جاري التحميل..." : "اختر عميلاً"} />
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
            <label className="text-sm font-medium">الموضوع</label>
            <Input
              placeholder="أدخل موضوع الرسالة"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">الرسالة</label>
            <Textarea
              placeholder="اكتب رسالتك هنا..."
              className="min-h-[150px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSend}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            إرسال البريد الإلكتروني
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import SarIcon from "@/components/sar-icon";

export default function TablePay() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/table-pay/:tableId");
  const { toast } = useToast();
  const tableId = params?.tableId;

  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const { data: table, isLoading: tableLoading } = useQuery<any>({
    queryKey: [`/api/tables/${tableId}`],
    enabled: !!tableId,
  });

  const { data: order, isLoading: orderLoading } = useQuery<any>({
    queryKey: [`/api/orders/${table?.currentOrderId}`],
    enabled: !!table?.currentOrderId,
  });

  const cashierPayMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${order?.id || order?._id}/cashier-pay-request`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم إرسال طلب الدفع للكاشير" });
      setPaid(true);
      queryClient.invalidateQueries({ queryKey: [`/api/tables/${tableId}`] });
    },
    onError: () => {
      toast({ title: "حدث خطأ", variant: "destructive" });
    },
  });

  if (tableLoading || orderLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!table || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">لا توجد طلبات نشطة لهذه الطاولة</p>
            <Button variant="outline" onClick={() => navigate(`/table-menu/${tableId}`)}>
              <ArrowRight className="w-4 h-4 ml-2" />
              رجوع
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = Number(order?.totalAmount || 0);
  const items: any[] = Array.isArray(order?.items) ? order.items : [];

  if (paid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">تم إرسال طلب الدفع!</h2>
            <p className="text-muted-foreground">سيأتيك الكاشير قريباً لإتمام الدفع.</p>
            <Button variant="outline" onClick={() => navigate(`/table-menu/${table?.qrToken || tableId}`)}>
              العودة للقائمة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button
          onClick={() => navigate(`/table-menu/${table?.qrToken || tableId}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-pay"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>الفاتورة — طاولة {table?.tableNumber}</span>
              <Badge variant="outline">#{order?.orderNumber || order?.dailyNumber || '—'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="divide-y">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between py-2 text-sm">
                  <span>{item.name || item.nameAr || item.coffeeItem?.nameAr} x{item.quantity || 1}</span>
                  <span className="font-semibold">{Number(item.price || item.unitPrice || 0).toFixed(2)} <SarIcon className="inline w-3 h-3" /></span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-bold text-lg">الإجمالي</span>
              <span className="font-black text-2xl text-primary">{total.toFixed(2)} <SarIcon className="inline w-5 h-5" /></span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="font-bold text-center text-muted-foreground text-sm">اختر طريقة الدفع</h3>

          <Button
            className="w-full h-14 text-base gap-3"
            size="lg"
            onClick={() => {
              setPaying(true);
              cashierPayMutation.mutate();
            }}
            disabled={cashierPayMutation.isPending || paying}
            data-testid="button-cashier-pay"
          >
            {cashierPayMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Banknote className="w-5 h-5" />
            )}
            سأدفع عند الكاشير
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 text-base gap-3 border-primary/30"
            size="lg"
            onClick={() => {
              toast({
                title: "الدفع الإلكتروني",
                description: "سيصلك رابط الدفع على واتساب أو سيحضر الكاشير للطاولة",
              });
            }}
            data-testid="button-online-pay"
          >
            <CreditCard className="w-5 h-5 text-primary" />
            دفع إلكتروني (شبكة / أبل باي)
          </Button>
        </div>
      </div>
    </div>
  );
}

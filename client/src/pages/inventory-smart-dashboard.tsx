import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowUpCircle, ArrowDownCircle, History, AlertCircle } from "lucide-react";

export default function InventoryDashboard() {
  const { data: movements, isLoading: loadingMovements } = useQuery<any[]>({
    queryKey: ["/api/inventory/movements"],
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<any[]>({
    queryKey: ["/api/inventory/alerts"],
  });

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen text-right" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">المخزون الذكي - حالة النظام</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              تنبيهات المخزون المنخفض
            </CardTitle>
            <CardDescription>مواد خام وصلت للحد الأدنى وتحتاج لإعادة شراء</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? <Loader2 className="animate-spin" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المادة</TableHead>
                    <TableHead className="text-right">المتوفر</TableHead>
                    <TableHead className="text-right">الحد الأدنى</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nameAr}</TableCell>
                      <TableCell className="text-destructive font-bold">{item.currentStock} {item.unit}</TableCell>
                      <TableCell>{item.minStockThreshold} {item.unit}</TableCell>
                    </TableRow>
                  ))}
                  {alerts?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center p-4 text-muted-foreground">لا يوجد تنبيهات حالياً</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              آخر التحركات المخزنية
            </CardTitle>
            <CardDescription>سجل العمليات الأخيرة (توريد، خصم، هالك)</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMovements ? <Loader2 className="animate-spin" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المادة</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">الوقت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements?.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        {m.type === 'in' ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800"><ArrowUpCircle className="w-3 h-3 ml-1" /> توريد</Badge>
                        ) : m.type === 'order_deduction' ? (
                          <Badge variant="outline"><ArrowDownCircle className="w-3 h-3 ml-1" /> مبيعات</Badge>
                        ) : (
                          <Badge variant="destructive">{m.type}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{m.ingredientId}</TableCell>
                      <TableCell dir="ltr">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                      <TableCell className="text-xs">{new Date(m.createdAt).toLocaleTimeString('ar-SA')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

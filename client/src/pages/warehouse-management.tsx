import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, ArrowLeft, Send, History, Warehouse, BarChart3, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";

export default function WarehouseManagementPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [transferItems, setTransferItems] = useState([{ ingredientId: "", quantity: 0, unit: "g" }]);

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
  });

  const transferMutation = useMutation({
    mutationFn: async (transfer: any) => {
      const res = await apiRequest("POST", "/api/warehouses/transfer", transfer);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "تم بدء عملية التحويل بنجاح", className: "bg-green-600 text-white" });
    },
  });

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen" dir="rtl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/manager")} className="hover:bg-primary/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">إدارة المستودعات المركزية</h1>
          <p className="text-muted-foreground">تتبع المخزون وإدارة التحويلات بين الفروع والمخازن</p>
        </div>
        <Warehouse className="h-10 w-10 text-primary mr-auto" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Summary */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Warehouse className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المستودعات</p>
              <p className="text-2xl font-bold">{warehouses.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <LayoutDashboard className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الفروع النشطة</p>
              <p className="text-2xl font-bold">{branches.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-background0/5 border-amber-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-background0/10">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تحويلات معلقة</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Send className="w-5 h-5 text-primary" /> طلب تحويل جديد
            </CardTitle>
            <CardDescription>نقل المواد الخام بين المستودعات والفروع</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>من مستودع</Label>
                <Select onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المصدر" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.nameAr}</SelectItem>
                    ))}
                    {warehouses.length === 0 && <SelectItem value="demo">مستودع تجريبي</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>إلى فرع / مستودع</Label>
                <Select onValueChange={setSelectedTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الوجهة" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.nameAr}</SelectItem>
                    ))}
                    {branches.length === 0 && <SelectItem value="demo-branch">فرع تجريبي</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الأصناف المراد تحويلها</Label>
              {transferItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input placeholder="اسم الصنف أو المعرف" className="flex-1" />
                  <Input type="number" placeholder="الكمية" className="w-24" />
                  <Button variant="outline" size="icon" onClick={() => {
                    const newItems = [...transferItems];
                    newItems.splice(index, 1);
                    setTransferItems(newItems);
                  }}>×</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setTransferItems([...transferItems, { ingredientId: "", quantity: 0, unit: "g" }])}>
                + إضافة صنف آخر
              </Button>
            </div>

            <Button className="w-full" size="lg" onClick={() => transferMutation.mutate({
              fromWarehouseId: selectedSource,
              toWarehouseId: selectedTarget,
              items: transferItems
            })}>
              تأكيد وبدء التحويل
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="w-5 h-5 text-primary" /> سجل التحويلات والمخزون
            </CardTitle>
            <CardDescription>متابعة حالة الشحنات وتوافر المخزون عبر الشبكة</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 border rounded-lg p-8 bg-muted/20 flex flex-col items-center justify-center text-center">
              <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">لا توجد عمليات تحويل حالية</p>
              <p className="text-sm text-muted-foreground">سيظهر تاريخ عمليات النقل هنا فور بدئها</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

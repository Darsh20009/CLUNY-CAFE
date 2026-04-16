import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";

export default function OSStockManagement() {
  const { toast } = useToast();
  const [movementType, setMovementType] = useState<"in" | "out" | "waste" | "adjustment">("in");
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [quantity, setQuantity] = useState("");

  const { data: ingredients = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: movements = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory/movements"],
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory/alerts"],
  });

  const createMovementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/inventory/movements", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم بنجاح", description: "تم تسجيل حركة المخزون" });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      setSelectedIngredient("");
      setQuantity("");
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateMovement = () => {
    if (!selectedIngredient || !quantity) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    createMovementMutation.mutate({
      rawItemId: selectedIngredient,
      movementType,
      quantity: parseFloat(quantity),
    });
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "in": return "text-green-600";
      case "out": return "text-red-600";
      case "waste": return "text-accent";
      case "adjustment": return "text-blue-600";
      default: return "text-muted-foreground";
    }
  };

  const getMovementLabel = (type: string) => {
    const labels: Record<string, string> = {
      in: "إدخال",
      out: "إخراج",
      waste: "هدر",
      adjustment: "تعديل",
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen text-right" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">إدارة حركات المخزون</h1>
        <TrendingDown className="w-8 h-8 text-primary" />
      </div>

      {/* Create Movement */}
      <Card>
        <CardHeader>
          <CardTitle>تسجيل حركة مخزون جديدة</CardTitle>
          <CardDescription>أضف إدخال، إخراج، هدر، أو تعديل للمخزون</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>نوع الحركة</Label>
              <Select value={movementType} onValueChange={(v: any) => setMovementType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">إدخال (In)</SelectItem>
                  <SelectItem value="out">إخراج (Out)</SelectItem>
                  <SelectItem value="waste">هدر (Waste)</SelectItem>
                  <SelectItem value="adjustment">تعديل (Adjustment)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المادة الخام</Label>
              <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((ing: any) => (
                    <SelectItem key={ing.id} value={ing.id}>{ing.nameAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الكمية</Label>
              <Input type="number" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateMovement} disabled={createMovementMutation.isPending} className="w-full">
                {createMovementMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="ml-2 w-4 h-4" />}
                تسجيل
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-background dark:bg-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent" />
              تنبيهات المخزون المنخفض
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert: any, i: number) => (
                <div key={i} className="p-3 bg-white dark:bg-card rounded border border-orange-200">
                  <p className="font-medium">{alert.rawItemName}</p>
                  <p className="text-sm text-muted-foreground">المخزون الحالي: {alert.currentQuantity} - الحد الأدنى: {alert.thresholdQuantity}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle>حركات المخزون الأخيرة</CardTitle>
          <CardDescription>آخر 20 حركة في النظام</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin w-8 h-8" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المادة</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">السابق</TableHead>
                    <TableHead className="text-right">الحالي</TableHead>
                    <TableHead className="text-right">الملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.slice(0, 50).map((movement: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{movement.rawItemName || movement.rawItemId}</TableCell>
                      <TableCell>
                        <span className={getMovementColor(movement.movementType)}>
                          {getMovementLabel(movement.movementType)}
                        </span>
                      </TableCell>
                      <TableCell>{movement.quantity}</TableCell>
                      <TableCell>{movement.previousQuantity}</TableCell>
                      <TableCell className="font-semibold">{movement.newQuantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{movement.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Loader2, Plus, Package, Ruler, DollarSign, AlertTriangle } from "lucide-react";

const ingredientSchema = z.object({
  nameAr: z.string().min(1, "الاسم العربي مطلوب"),
  nameEn: z.string().optional(),
  sku: z.string().optional(),
  unit: z.enum(['g', 'ml', 'pcs', 'kg', 'l']),
  unitCost: z.coerce.number().min(0, "التكلفة يجب أن تكون 0 أو أكثر"),
  currentStock: z.coerce.number().min(0),
  minStockThreshold: z.coerce.number().min(0),
});

export default function OSInventoryManagement() {
  const { toast } = useToast();
  const { data: ingredients, isLoading } = useQuery<any[]>({
    queryKey: ["/api/ingredients"],
  });

  const form = useForm({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      sku: "",
      unit: "g",
      unitCost: 0,
      currentStock: 0,
      minStockThreshold: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("POST", "/api/ingredients", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      toast({ title: "تم الإضافة بنجاح", description: "تم إضافة المادة الخام للمخزون" });
      form.reset();
    },
  });

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen text-right" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">إدارة المواد الخام (المخزون الذكي)</h1>
        <Package className="w-8 h-8 text-primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>إضافة مادة جديدة</CardTitle>
            <CardDescription>أدخل بيانات المادة الخام لحساب التكاليف والوصفات</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nameAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الاسم بالعربي</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>وحدة القياس</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="اختر الوحدة" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="g">جرام (g)</SelectItem>
                          <SelectItem value="ml">مللتر (ml)</SelectItem>
                          <SelectItem value="pcs">حبة (pcs)</SelectItem>
                          <SelectItem value="kg">كيلوجرام (kg)</SelectItem>
                          <SelectItem value="l">لتر (l)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>تكلفة الوحدة</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currentStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الكمية الحالية</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="ml-2" />}
                  إضافة للمخزون
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>قائمة المواد الخام</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المادة</TableHead>
                    <TableHead className="text-right">الوحدة</TableHead>
                    <TableHead className="text-right">التكلفة</TableHead>
                    <TableHead className="text-right">المخزون</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nameAr}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.unitCost} ريال</TableCell>
                      <TableCell>{item.currentStock}</TableCell>
                      <TableCell>
                        {item.currentStock <= item.minStockThreshold ? (
                          <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> منخفض</span>
                        ) : (
                          <span className="text-green-600">جيد</span>
                        )}
                      </TableCell>
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

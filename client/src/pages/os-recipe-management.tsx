import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Loader2, Save, Plus, Trash2, Calculator, Beaker } from "lucide-react";

export default function OSRecipeManagement() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [recipeIngredients, setRecipeIngredients] = useState<any[]>([]);

  const { data: products } = useQuery<any[]>({ queryKey: ["/api/coffee-items"] });
  const { data: ingredients } = useQuery<any[]>({ queryKey: ["/api/ingredients"] });

  const { data: existingRecipe, isLoading: loadingRecipe } = useQuery<any>({
    queryKey: ["/api/recipes/product", selectedProduct],
    enabled: !!selectedProduct,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("POST", "/api/recipes", values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الوصفة", description: "تم تحديث وصفة المنتج وتكلفته" });
    },
  });

  const addIngredientToRecipe = () => {
    setRecipeIngredients([...recipeIngredients, { ingredientId: "", quantity: 0, unit: "g" }]);
  };

  const removeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const calculateTotalCost = () => {
    return recipeIngredients.reduce((total, item) => {
      const ing = ingredients?.find((i: any) => i.id === item.ingredientId);
      return total + (ing ? ing.unitCost * item.quantity : 0);
    }, 0);
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen text-right" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">هندسة الوصفات (Recipe Engine)</h1>
        <Beaker className="w-8 h-8 text-primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>اختر المنتج</CardTitle>
            <CardDescription>اختر المشروب لإدارة مكوناته</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedProduct} value={selectedProduct}>
              <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
              <SelectContent>
                {products?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>مكونات الوصفة</CardTitle>
              <CardDescription>حدد كميات المواد الخام لكل كوب</CardDescription>
            </div>
            {selectedProduct && (
              <Button onClick={addIngredientToRecipe} variant="outline" size="sm">
                <Plus className="ml-2 w-4 h-4" /> إضافة مكون
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedProduct ? (
              <div className="text-center p-12 text-muted-foreground italic">الرجاء اختيار منتج للبدء</div>
            ) : (
              <div className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المادة الخام</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">الوحدة</TableHead>
                      <TableHead className="text-right">التكلفة المتوقعة</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipeIngredients.map((ri, index) => {
                      const ing = ingredients?.find((i: any) => i.id === ri.ingredientId);
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <Select 
                              onValueChange={(val) => {
                                const newRI = [...recipeIngredients];
                                newRI[index].ingredientId = val;
                                setRecipeIngredients(newRI);
                              }}
                              value={ri.ingredientId}
                            >
                              <SelectTrigger><SelectValue placeholder="اختر مادة" /></SelectTrigger>
                              <SelectContent>
                                {ingredients?.map((i: any) => (
                                  <SelectItem key={i.id} value={i.id}>{i.nameAr}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              value={ri.quantity} 
                              onChange={(e) => {
                                const newRI = [...recipeIngredients];
                                newRI[index].quantity = Number(e.target.value);
                                setRecipeIngredients(newRI);
                              }}
                            />
                          </TableCell>
                          <TableCell>{ing?.unit || "---"}</TableCell>
                          <TableCell>{(ing ? ing.unitCost * ri.quantity : 0).toFixed(2)} ريال</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeIngredient(index)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 font-bold text-lg">
                    <Calculator className="w-5 h-5" />
                    إجمالي التكلفة (COGS): {calculateTotalCost().toFixed(2)} ريال
                  </div>
                  <Button 
                    onClick={() => saveMutation.mutate({ 
                      productId: selectedProduct, 
                      ingredients: recipeIngredients,
                      totalCost: calculateTotalCost()
                    })}
                    disabled={saveMutation.isPending || recipeIngredients.length === 0}
                  >
                    {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save className="ml-2 w-4 h-4" />}
                    حفظ الوصفة
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

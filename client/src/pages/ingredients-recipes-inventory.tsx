import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SarIcon from "@/components/sar-icon";
import { 
  Plus, 
  Package,
  Coffee,
  Search,
  Edit,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Calculator,
  ShoppingCart,
} from "lucide-react";

interface RawItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  unit: string;
  unitCost: number;
  category?: string;
  minimumStock?: number;
  isActive?: number;
}

interface BranchStock {
  id: string;
  branchId: string;
  rawItemId: string;
  currentQuantity: number;
  minimumStock: number;
  lastUpdated: string;
}

interface RecipeItem {
  id: string;
  coffeeItemId: string;
  rawItemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface CoffeeItem {
  id: string;
  nameAr: string;
  nameEn?: string;
  price: number;
  category: string;
  imageUrl?: string;
}

interface Branch {
  id: string;
  nameAr: string;
}

const unitLabels: Record<string, string> = {
  kg: "كجم",
  g: "جرام",
  liter: "لتر",
  ml: "مل",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

const unitLabelsFull: Record<string, string> = {
  kg: "كيلوجرام",
  g: "جرام",
  liter: "لتر",
  ml: "ملليلتر",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

const formatQuantity = (quantity: number, unit: string): string => {
  if (unit === "kg") {
    return quantity >= 1 ? `${quantity.toFixed(1)} كجم` : `${(quantity * 1000).toFixed(0)} جرام`;
  }
  if (unit === "liter") {
    return quantity >= 1 ? `${quantity.toFixed(1)} لتر` : `${(quantity * 1000).toFixed(0)} مل`;
  }
  if (unit === "g" || unit === "ml") {
    return `${quantity.toFixed(0)} ${unitLabels[unit]}`;
  }
  return `${quantity.toFixed(quantity % 1 === 0 ? 0 : 1)} ${unitLabels[unit] || unit}`;
};

const categoryLabels: Record<string, string> = {
  coffee: "قهوة",
  dairy: "ألبان",
  syrups: "شراب",
  cups: "أكواب",
  chocolate: "شوكولاتة",
  tea: "شاي",
  other: "أخرى",
};

export default function IngredientsRecipesInventoryPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  
  const [addStockItem, setAddStockItem] = useState<RawItem | null>(null);
  const [addStockQuantity, setAddStockQuantity] = useState("");
  
  const [isEditRecipeOpen, setIsEditRecipeOpen] = useState(false);
  const [editingRecipeDrink, setEditingRecipeDrink] = useState<CoffeeItem | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ rawItemId: string; quantity: string; unit: string }>>([]);

  const [newItem, setNewItem] = useState({
    nameAr: "",
    unit: "kg",
    unitCost: "",
    category: "ingredient",
    minimumStock: "10",
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: rawItems = [], isLoading: isRawItemsLoading } = useQuery<RawItem[]>({
    queryKey: ["/api/inventory/raw-items"],
  });

  const { data: branchStocks = [] } = useQuery<BranchStock[]>({
    queryKey: ["/api/branch-stock", selectedBranch],
    queryFn: async () => {
      const params = selectedBranch !== "all" ? `?branchId=${selectedBranch}` : "";
      const res = await fetch(`/api/branch-stock${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branch stock");
      return res.json();
    },
  });

  const { data: coffeeItems = [] } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const { data: recipeItems = [] } = useQuery<RecipeItem[]>({
    queryKey: ["/api/inventory/all-recipes"],
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/inventory/raw-items", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      setIsAddItemOpen(false);
      setNewItem({ nameAr: "", unit: "kg", unitCost: "", category: "ingredient", minimumStock: "10" });
      toast({ title: "تم إضافة المكون بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة المكون", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      return apiRequest("PUT", `/api/inventory/raw-items/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      setEditingItem(null);
      toast({ title: "تم تحديث المكون بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث المكون", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/inventory/raw-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      setDeletingItemId(null);
      toast({ title: "تم حذف المكون بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف المكون", variant: "destructive" });
    },
  });

  const addStockMutation = useMutation({
    mutationFn: async (data: { rawItemId: string; quantity: number }) => {
      if (selectedBranch === "all") {
        throw new Error("اختر فرع محدد أولاً");
      }
      return apiRequest("POST", "/api/stock-movements", {
        branchId: selectedBranch,
        rawItemId: data.rawItemId,
        movementType: "purchase",
        quantity: data.quantity,
        notes: "إضافة مخزون",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-stock"] });
      setAddStockItem(null);
      setAddStockQuantity("");
      toast({ title: "تم إضافة المخزون بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إضافة المخزون", variant: "destructive" });
    },
  });

  const saveRecipeMutation = useMutation({
    mutationFn: async (data: { coffeeItemId: string; ingredients: Array<{ rawItemId: string; quantity: number; unit: string }> }) => {
      const existingRecipes = recipeItems.filter(r => r.coffeeItemId === data.coffeeItemId);
      const createdRecipeIds: string[] = [];
      
      try {
        for (const ingredient of data.ingredients) {
          const response = await apiRequest("POST", "/api/inventory/recipes", {
            coffeeItemId: data.coffeeItemId,
            rawItemId: ingredient.rawItemId,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
          if (response && (response as any).id) {
            createdRecipeIds.push((response as any).id);
          }
        }
        
        for (const recipe of existingRecipes) {
          await apiRequest("DELETE", `/api/inventory/recipes/${recipe.id}`);
        }
        
        return true;
      } catch (error) {
        for (const recipeId of createdRecipeIds) {
          try {
            await apiRequest("DELETE", `/api/inventory/recipes/${recipeId}`);
          } catch {}
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] });
      setIsEditRecipeOpen(false);
      setEditingRecipeDrink(null);
      setRecipeIngredients([]);
      toast({ title: "تم حفظ الوصفة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حفظ الوصفة", variant: "destructive" });
    },
  });

  const stockItems = useMemo(() => {
    return rawItems.map(item => {
      const stock = branchStocks.find(s => s.rawItemId === item.id);
      const currentQty = stock?.currentQuantity || 0;
      const minStock = stock?.minimumStock || item.minimumStock || 10;
      const percentage = minStock > 0 ? Math.min((currentQty / minStock) * 100, 100) : 100;
      
      let status: "ok" | "low" | "critical" = "ok";
      if (currentQty <= minStock * 0.2) status = "critical";
      else if (currentQty <= minStock) status = "low";
      
      return {
        ...item,
        currentQuantity: currentQty,
        minimumStock: minStock,
        percentage,
        status,
      };
    }).filter(item =>
      item.nameAr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rawItems, branchStocks, searchQuery]);

  const drinksWithRecipes = useMemo(() => {
    return coffeeItems.map(drink => {
      const recipes = recipeItems.filter(r => r.coffeeItemId === drink.id);
      const recipeCost = recipes.reduce((total, recipe) => {
        const rawItem = rawItems.find(r => r.id === recipe.rawItemId);
        if (!rawItem) return total;
        let costPerUnit = rawItem.unitCost;
        if (rawItem.unit === "kg" && recipe.unit === "g") costPerUnit = rawItem.unitCost / 1000;
        if (rawItem.unit === "liter" && recipe.unit === "ml") costPerUnit = rawItem.unitCost / 1000;
        return total + (costPerUnit * recipe.quantity);
      }, 0);
      
      return {
        ...drink,
        recipes,
        hasRecipe: recipes.length > 0,
        recipeCost,
        profit: drink.price - recipeCost,
        profitMargin: drink.price > 0 ? ((drink.price - recipeCost) / drink.price) * 100 : 0,
      };
    }).filter(item =>
      item.nameAr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [coffeeItems, recipeItems, rawItems, searchQuery]);

  const lowStockCount = stockItems.filter(i => i.status !== "ok").length;
  const drinksWithRecipeCount = drinksWithRecipes.filter(d => d.hasRecipe).length;

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    const code = `RAW-${Date.now().toString(36).toUpperCase()}`;
    
    createItemMutation.mutate({
      code,
      nameAr: newItem.nameAr,
      unit: newItem.unit,
      unitCost: parseFloat(newItem.unitCost) || 0,
      category: newItem.category,
      minStockLevel: parseFloat(newItem.minimumStock) || 10,
      isActive: 1,
    });
  };

  const handleAddStock = () => {
    if (!addStockItem || !addStockQuantity) return;
    const qty = parseFloat(addStockQuantity);
    if (qty <= 0) {
      toast({ title: "أدخل كمية صحيحة", variant: "destructive" });
      return;
    }
    addStockMutation.mutate({ rawItemId: addStockItem.id, quantity: qty });
  };

  const openEditRecipe = (drink: CoffeeItem) => {
    setEditingRecipeDrink(drink);
    const existingRecipes = recipeItems.filter(r => r.coffeeItemId === drink.id);
    if (existingRecipes.length > 0) {
      setRecipeIngredients(existingRecipes.map(r => ({
        rawItemId: r.rawItemId,
        quantity: r.quantity.toString(),
        unit: r.unit,
      })));
    } else {
      setRecipeIngredients([{ rawItemId: "", quantity: "", unit: "g" }]);
    }
    setIsEditRecipeOpen(true);
  };

  const handleSaveRecipe = () => {
    if (!editingRecipeDrink) return;
    const validIngredients = recipeIngredients.filter(
      ing => ing.rawItemId && ing.quantity && parseFloat(ing.quantity) > 0
    );
    if (validIngredients.length === 0) {
      toast({ title: "أضف مكون واحد على الأقل", variant: "destructive" });
      return;
    }
    saveRecipeMutation.mutate({
      coffeeItemId: editingRecipeDrink.id,
      ingredients: validIngredients.map(ing => ({
        rawItemId: ing.rawItemId,
        quantity: parseFloat(ing.quantity),
        unit: ing.unit,
      })),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "bg-red-500";
      case "low": return "bg-background0";
      default: return "bg-green-500";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "critical": return "bg-red-500/10 border-red-500/30";
      case "low": return "bg-background0/10 border-amber-500/30";
      default: return "bg-green-500/10 border-green-500/30";
    }
  };

  if (isRawItemsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-50 bg-background border-b p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">المخزون والوصفات</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-40" data-testid="select-branch">
                <SelectValue placeholder="الفرع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setIsAddItemOpen(true)} data-testid="button-add-item">
              <Plus className="h-4 w-4 ml-2" />
              إضافة مكون
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-2">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المكونات</p>
                <p className="text-xl font-bold">{rawItems.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background0/10">
                <AlertTriangle className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مخزون منخفض</p>
                <p className="text-xl font-bold text-accent">{lowStockCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">بوصفات</p>
                <p className="text-xl font-bold text-green-600">{drinksWithRecipeCount}/{coffeeItems.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Calculator className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">متوسط الربح</p>
                <p className="text-xl font-bold">
                  {drinksWithRecipes.length > 0 
                    ? `${(drinksWithRecipes.reduce((sum, d) => sum + (d.hasRecipe ? d.profitMargin : 0), 0) / Math.max(drinksWithRecipeCount, 1)).toFixed(0)}%`
                    : "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-l from-blue-500/10 to-transparent border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20 shrink-0">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-bold text-blue-600 dark:text-blue-400">نصائح سريعة</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span><strong>الأخضر:</strong> المخزون كافي - لا يحتاج إضافة</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-background0" />
                    <span><strong>البرتقالي:</strong> مخزون منخفض - يفضل الطلب قريباً</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span><strong>الأحمر:</strong> مخزون حرج - يجب الطلب فوراً</span>
                  </li>
                  <li className="flex items-center gap-2 mt-2">
                    <Calculator className="w-3 h-3 text-purple-500" />
                    <span>تكلفة الوصفة تُحسب تلقائياً من المكونات لحساب الربح</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stock" className="text-base py-3" data-testid="tab-stock">
              <Package className="h-5 w-5 ml-2" />
              المخزون
            </TabsTrigger>
            <TabsTrigger value="recipes" className="text-base py-3" data-testid="tab-recipes">
              <Coffee className="h-5 w-5 ml-2" />
              الوصفات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="mt-4">
            {selectedBranch === "all" && (
              <div className="mb-4 p-4 bg-background0/10 rounded-lg border border-amber-500/30 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-accent shrink-0" />
                <p className="text-sm">اختر فرع محدد لإضافة أو تعديل المخزون</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockItems.map(item => (
                <Card 
                  key={item.id} 
                  className={`border-2 transition-all ${getStatusBg(item.status)}`}
                  data-testid={`card-stock-${item.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{item.nameAr}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {categoryLabels[item.category || "other"]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.unitCost.toFixed(2)} <SarIcon />/{unitLabels[item.unit]}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setEditingItem(item)}
                          data-testid={`button-edit-item-${item.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setDeletingItemId(item.id)}
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">
                          {formatQuantity(item.currentQuantity, item.unit)}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`} />
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        الحد الأدنى: {formatQuantity(item.minimumStock, item.unit)}
                      </p>
                    </div>

                    <Button 
                      className="w-full" 
                      variant={item.status === "critical" ? "default" : "outline"}
                      onClick={() => {
                        if (selectedBranch === "all") {
                          toast({ title: "اختر فرع محدد أولاً", variant: "destructive" });
                          return;
                        }
                        setAddStockItem(item);
                        setAddStockQuantity("");
                      }}
                      data-testid={`button-add-stock-${item.id}`}
                    >
                      <ShoppingCart className="h-4 w-4 ml-2" />
                      إضافة للمخزون
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {stockItems.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد مكونات بعد</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setIsAddItemOpen(true)}
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة أول مكون
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recipes" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drinksWithRecipes.map(drink => (
                <Card 
                  key={drink.id} 
                  className={`border-2 transition-all ${drink.hasRecipe ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-background0/5"}`}
                  data-testid={`card-recipe-${drink.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {drink.imageUrl ? (
                        <img 
                          src={drink.imageUrl} 
                          alt={drink.nameAr} 
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Coffee className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{drink.nameAr}</h3>
                        <p className="text-lg font-semibold text-muted-foreground">
                          {drink.price.toFixed(2)} <SarIcon />
                        </p>
                      </div>
                      <Badge variant={drink.hasRecipe ? "default" : "secondary"}>
                        {drink.hasRecipe ? "مكتملة" : "بدون وصفة"}
                      </Badge>
                    </div>

                    {drink.hasRecipe && (
                      <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-lg">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">التكلفة</p>
                          <p className="font-bold">{drink.recipeCost.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">الربح</p>
                          <p className={`font-bold ${drink.profit > 0 ? "text-green-600" : "text-red-600"}`}>
                            {drink.profit.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">النسبة</p>
                          <p className={`font-bold ${drink.profitMargin >= 50 ? "text-green-600" : drink.profitMargin >= 30 ? "text-accent" : "text-red-600"}`}>
                            {drink.profitMargin.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    )}

                    {drink.hasRecipe && drink.recipes.length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                        {drink.recipes.map((recipe, idx) => {
                          const rawItem = rawItems.find(r => r.id === recipe.rawItemId);
                          return (
                            <p key={idx}>
                              {rawItem?.nameAr}: {recipe.quantity} {unitLabels[recipe.unit]}
                            </p>
                          );
                        })}
                      </div>
                    )}

                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => openEditRecipe(drink)}
                      data-testid={`button-edit-recipe-${drink.id}`}
                    >
                      <Edit className="h-4 w-4 ml-2" />
                      {drink.hasRecipe ? "تعديل الوصفة" : "إضافة وصفة"}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {drinksWithRecipes.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Coffee className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد مشروبات لإضافة وصفات لها</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مكون جديد</DialogTitle>
            <DialogDescription>أضف مكون لاستخدامه في وصفات المشروبات</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitItem} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المكون *</Label>
              <Input
                value={newItem.nameAr}
                onChange={(e) => setNewItem(prev => ({ ...prev, nameAr: e.target.value }))}
                placeholder="مثال: بن عربي"
                required
                data-testid="input-new-item-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الوحدة</Label>
                <Select value={newItem.unit} onValueChange={(v) => setNewItem(prev => ({ ...prev, unit: v }))}>
                  <SelectTrigger data-testid="select-new-item-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">كيلوجرام</SelectItem>
                    <SelectItem value="g">جرام</SelectItem>
                    <SelectItem value="liter">لتر</SelectItem>
                    <SelectItem value="ml">ملليلتر</SelectItem>
                    <SelectItem value="piece">قطعة</SelectItem>
                    <SelectItem value="box">صندوق</SelectItem>
                    <SelectItem value="bag">كيس</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger data-testid="select-new-item-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingredient">مكون</SelectItem>
                    <SelectItem value="packaging">تغليف</SelectItem>
                    <SelectItem value="equipment">معدات</SelectItem>
                    <SelectItem value="consumable">مستهلكات</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التكلفة لكل {unitLabelsFull[newItem.unit]} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.unitCost}
                  onChange={(e) => setNewItem(prev => ({ ...prev, unitCost: e.target.value }))}
                  placeholder="0.00"
                  required
                  data-testid="input-new-item-cost"
                />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newItem.minimumStock}
                  onChange={(e) => setNewItem(prev => ({ ...prev, minimumStock: e.target.value }))}
                  data-testid="input-new-item-min"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddItemOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createItemMutation.isPending} data-testid="button-submit-new-item">
                {createItemMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                إضافة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل المكون</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form onSubmit={(e) => {
              e.preventDefault();
              updateItemMutation.mutate({
                id: editingItem.id,
                updates: {
                  nameAr: editingItem.nameAr,
                  unit: editingItem.unit,
                  unitCost: editingItem.unitCost,
                  category: editingItem.category,
                  minStockLevel: editingItem.minimumStock,
                },
              });
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم المكون</Label>
                <Input
                  value={editingItem.nameAr}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, nameAr: e.target.value } : null)}
                  data-testid="input-edit-item-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الوحدة</Label>
                  <Select value={editingItem.unit} onValueChange={(v) => setEditingItem(prev => prev ? { ...prev, unit: v } : null)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">كيلوجرام</SelectItem>
                      <SelectItem value="g">جرام</SelectItem>
                      <SelectItem value="liter">لتر</SelectItem>
                      <SelectItem value="ml">ملليلتر</SelectItem>
                      <SelectItem value="piece">قطعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Select value={editingItem.category || "ingredient"} onValueChange={(v) => setEditingItem(prev => prev ? { ...prev, category: v } : null)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingredient">مكون</SelectItem>
                      <SelectItem value="packaging">تغليف</SelectItem>
                      <SelectItem value="equipment">معدات</SelectItem>
                      <SelectItem value="consumable">مستهلكات</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>التكلفة</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingItem.unitCost}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, unitCost: parseFloat(e.target.value) || 0 } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الحد الأدنى</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingItem.minimumStock || 10}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, minimumStock: parseFloat(e.target.value) || 10 } : null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={updateItemMutation.isPending}>
                  {updateItemMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                  حفظ
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!addStockItem} onOpenChange={() => setAddStockItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة مخزون - {addStockItem?.nameAr}</DialogTitle>
            <DialogDescription>
              أدخل الكمية بـ{addStockItem ? unitLabelsFull[addStockItem.unit] : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الكمية المضافة</Label>
              <Input
                type="number"
                step="0.01"
                value={addStockQuantity}
                onChange={(e) => setAddStockQuantity(e.target.value)}
                placeholder={`مثال: 2 ${addStockItem ? unitLabels[addStockItem.unit] : ""}`}
                autoFocus
                data-testid="input-add-stock-quantity"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddStockItem(null)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleAddStock} 
                disabled={addStockMutation.isPending || !addStockQuantity}
                data-testid="button-confirm-add-stock"
              >
                {addStockMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                إضافة
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingItemId} onOpenChange={() => setDeletingItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا المكون؟ لا يمكن التراجع عن هذا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItemId && deleteItemMutation.mutate(deletingItemId)}
              className="bg-destructive text-destructive-foreground"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditRecipeOpen} onOpenChange={setIsEditRecipeOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              وصفة {editingRecipeDrink?.nameAr}
            </DialogTitle>
            <DialogDescription>
              حدد المكونات لكوب 250 مل
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {recipeIngredients.map((ingredient, index) => (
              <div key={index} className="flex items-end gap-2 p-3 bg-muted rounded-lg">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">المكون</Label>
                  <Select
                    value={ingredient.rawItemId}
                    onValueChange={(value) => {
                      setRecipeIngredients(prev => prev.map((item, i) => 
                        i === index ? { ...item, rawItemId: value } : item
                      ));
                    }}
                  >
                    <SelectTrigger data-testid={`select-recipe-ingredient-${index}`}>
                      <SelectValue placeholder="اختر" />
                    </SelectTrigger>
                    <SelectContent>
                      {rawItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-20 space-y-1">
                  <Label className="text-xs">الكمية</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ingredient.quantity}
                    onChange={(e) => {
                      setRecipeIngredients(prev => prev.map((item, i) => 
                        i === index ? { ...item, quantity: e.target.value } : item
                      ));
                    }}
                    data-testid={`input-recipe-quantity-${index}`}
                  />
                </div>

                <div className="w-24 space-y-1">
                  <Label className="text-xs">الوحدة</Label>
                  <Select
                    value={ingredient.unit}
                    onValueChange={(value) => {
                      setRecipeIngredients(prev => prev.map((item, i) => 
                        i === index ? { ...item, unit: value } : item
                      ));
                    }}
                  >
                    <SelectTrigger data-testid={`select-recipe-unit-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">جرام</SelectItem>
                      <SelectItem value="ml">مل</SelectItem>
                      <SelectItem value="piece">قطعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setRecipeIngredients(prev => prev.filter((_, i) => i !== index));
                  }}
                  disabled={recipeIngredients.length === 1}
                  data-testid={`button-remove-ingredient-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => setRecipeIngredients(prev => [...prev, { rawItemId: "", quantity: "", unit: "g" }])}
              className="w-full"
              data-testid="button-add-recipe-ingredient"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة مكون
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditRecipeOpen(false);
                setEditingRecipeDrink(null);
                setRecipeIngredients([]);
              }}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleSaveRecipe}
              disabled={saveRecipeMutation.isPending}
              data-testid="button-save-recipe"
            >
              {saveRecipeMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              حفظ الوصفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

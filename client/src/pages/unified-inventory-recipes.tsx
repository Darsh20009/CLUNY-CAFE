import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Package, 
  ChefHat,
  Warehouse,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  Loader2,
  DollarSign,
  Layers,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Eye,
  Edit,
  Trash2,
  Coffee,
  Box,
  Droplet,
  BarChart3,
  Bell,
  History,
  Calculator,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";

interface IngredientItem {
  id?: string;
  _id?: string;
  nameAr: string;
  nameEn?: string;
  sku?: string;
  unit: string;
  unitCost: number;
  currentStock: number;
  minStockThreshold: number;
  category?: string;
  lastRestocked?: string;
  branchId?: string;
}

interface Recipe {
  id?: string;
  _id?: string;
  coffeeItemId: string;
  coffeeItemName?: string;
  nameAr: string;
  nameEn?: string;
  ingredients: RecipeIngredient[];
  totalCost?: number;
  isActive?: boolean;
  branchId?: string;
}

interface RecipeIngredient {
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  unit: string;
}

interface Branch {
  id?: string;
  _id?: string;
  nameAr: string;
}

const unitLabels: Record<string, string> = {
  g: "جرام",
  kg: "كيلو",
  ml: "مل",
  l: "لتر",
  pcs: "قطعة",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

const categoryLabels: Record<string, { label: string; icon: any; color: string }> = {
  coffee: { label: "قهوة", icon: Coffee, color: "text-accent" },
  dairy: { label: "ألبان", icon: Droplet, color: "text-blue-500" },
  packaging: { label: "تغليف", icon: Box, color: "text-muted-foreground" },
  sweetener: { label: "محليات", icon: Droplet, color: "text-yellow-500" },
  other: { label: "أخرى", icon: Package, color: "text-muted-foreground" },
};

export default function UnifiedInventoryRecipesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientItem | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [newIngredient, setNewIngredient] = useState({
    nameAr: "",
    nameEn: "",
    sku: "",
    unit: "g",
    unitCost: "",
    currentStock: "",
    minStockThreshold: "",
    category: "other"
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: ingredients = [], isLoading: isIngredientsLoading } = useQuery<IngredientItem[]>({
    queryKey: ["/api/ingredients"],
  });

  const { data: recipes = [], isLoading: isRecipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: coffeeItems = [] } = useQuery<any[]>({
    queryKey: ["/api/coffee-items"],
  });

  const createIngredientMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/ingredients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      setIsAddIngredientOpen(false);
      setNewIngredient({
        nameAr: "", nameEn: "", sku: "", unit: "g",
        unitCost: "", currentStock: "", minStockThreshold: "", category: "other"
      });
      toast({ title: "تمت إضافة المادة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة المادة", variant: "destructive" });
    },
  });

  const handleAddIngredient = () => {
    createIngredientMutation.mutate({
      ...newIngredient,
      unitCost: parseFloat(newIngredient.unitCost) || 0,
      currentStock: parseFloat(newIngredient.currentStock) || 0,
      minStockThreshold: parseFloat(newIngredient.minStockThreshold) || 0,
    });
  };

  const branchFilteredIngredients = ingredients.filter(item => {
    if (selectedBranch === "all") return true;
    return item.branchId === selectedBranch || !item.branchId;
  });

  const branchFilteredRecipes = recipes.filter(recipe => {
    if (selectedBranch === "all") return true;
    return recipe.branchId === selectedBranch || !recipe.branchId;
  });

  const filteredIngredients = branchFilteredIngredients.filter(item => {
    const matchesSearch = item.nameAr.includes(searchQuery) || 
                          (item.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = branchFilteredIngredients.filter(item => item.currentStock <= item.minStockThreshold);
  const totalInventoryValue = branchFilteredIngredients.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0);
  const activeRecipesCount = branchFilteredRecipes.filter(r => r.isActive !== false).length;

  const getStockStatus = (item: IngredientItem) => {
    const percentage = item.minStockThreshold > 0 
      ? (item.currentStock / (item.minStockThreshold * 2)) * 100 
      : 100;
    if (item.currentStock <= item.minStockThreshold) {
      return { status: "critical", color: "bg-red-500", text: "منخفض جداً", percentage: Math.min(percentage, 100) };
    } else if (item.currentStock <= item.minStockThreshold * 1.5) {
      return { status: "warning", color: "bg-background0", text: "منخفض", percentage: Math.min(percentage, 100) };
    }
    return { status: "good", color: "bg-green-500", text: "جيد", percentage: Math.min(percentage, 100) };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-primary/5 to-yellow-50 dark:from-background dark:via-primary/5 dark:to-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/employee/dashboard")}
            className="text-accent dark:text-accent"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-accent dark:text-accent flex items-center gap-2">
            <Package className="w-8 h-8" />
            إدارة المخزون والوصفات
          </h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => queryClient.invalidateQueries()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="بحث في المواد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="الفئة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              <SelectItem value="coffee">قهوة</SelectItem>
              <SelectItem value="dairy">ألبان</SelectItem>
              <SelectItem value="packaging">تغليف</SelectItem>
              <SelectItem value="sweetener">محليات</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="الفرع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id || ""}>
                  {branch.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-primary dark:bg-primary/30">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              المواد الخام
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-1">
              <ChefHat className="w-4 h-4" />
              الوصفات
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-1">
              <Bell className="w-4 h-4" />
              التنبيهات
              {lowStockItems.length > 0 && (
                <Badge variant="destructive" className="mr-1 h-5 w-5 p-0 flex items-center justify-center">
                  {lowStockItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="movements" className="flex items-center gap-1">
              <History className="w-4 h-4" />
              الحركات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">إجمالي المواد</p>
                      <p className="text-3xl font-bold mt-1">{ingredients.length}</p>
                      <p className="text-blue-200 text-xs mt-1">مادة خام</p>
                    </div>
                    <Package className="w-12 h-12 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">قيمة المخزون</p>
                      <p className="text-3xl font-bold mt-1">{totalInventoryValue.toFixed(0)}</p>
                      <p className="text-green-200 text-xs mt-1">ريال سعودي</p>
                    </div>
                    <DollarSign className="w-12 h-12 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-accent text-sm">الوصفات النشطة</p>
                      <p className="text-3xl font-bold mt-1">{activeRecipesCount}</p>
                      <p className="text-accent text-xs mt-1">وصفة</p>
                    </div>
                    <ChefHat className="w-12 h-12 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${lowStockItems.length > 0 ? 'from-red-500 to-red-600' : 'from-gray-500 to-gray-600'} text-white`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`${lowStockItems.length > 0 ? 'text-red-100' : 'text-gray-100'} text-sm`}>تنبيهات المخزون</p>
                      <p className="text-3xl font-bold mt-1">{lowStockItems.length}</p>
                      <p className={`${lowStockItems.length > 0 ? 'text-red-200' : 'text-gray-200'} text-xs mt-1`}>مادة منخفضة</p>
                    </div>
                    <AlertTriangle className={`w-12 h-12 ${lowStockItems.length > 0 ? 'text-red-200' : 'text-gray-200'}`} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {lowStockItems.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    تنبيهات المخزون المنخفض
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lowStockItems.slice(0, 6).map((item) => {
                      const stockStatus = getStockStatus(item);
                      return (
                        <div key={item.id} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{item.nameAr}</p>
                              <p className="text-sm text-muted-foreground">{unitLabels[item.unit] || item.unit}</p>
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {stockStatus.text}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>الكمية الحالية</span>
                              <span className="font-bold text-red-600">{item.currentStock}</span>
                            </div>
                            <Progress value={stockStatus.percentage} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                              الحد الأدنى: {item.minStockThreshold} {unitLabels[item.unit]}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    آخر المواد المضافة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المادة</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">التكلفة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchFilteredIngredients.slice(0, 5).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.nameAr}</TableCell>
                          <TableCell>{item.currentStock} {unitLabels[item.unit]}</TableCell>
                          <TableCell>{item.unitCost.toFixed(2)} <SarIcon /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-accent" />
                    الوصفات الأكثر استخداماً
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الوصفة</TableHead>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-right">التكلفة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchFilteredRecipes.slice(0, 5).map((recipe) => (
                        <TableRow key={recipe.id}>
                          <TableCell className="font-medium">{recipe.nameAr}</TableCell>
                          <TableCell>{recipe.coffeeItemName || '-'}</TableCell>
                          <TableCell>{(recipe.totalCost || 0).toFixed(2)} <SarIcon /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ingredients" className="space-y-4">
            <div className="flex justify-between items-center">
              <CardTitle>قائمة المواد الخام</CardTitle>
              <Button onClick={() => setIsAddIngredientOpen(true)} className="bg-primary hover:bg-primary">
                <Plus className="w-4 h-4 ml-2" />
                إضافة مادة جديدة
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {isIngredientsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المادة</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-right">الوحدة</TableHead>
                        <TableHead className="text-right">التكلفة</TableHead>
                        <TableHead className="text-right">المخزون</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIngredients.map((item) => {
                        const stockStatus = getStockStatus(item);
                        const CategoryIcon = categoryLabels[item.category || 'other']?.icon || Package;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CategoryIcon className={`w-4 h-4 ${categoryLabels[item.category || 'other']?.color}`} />
                                <div>
                                  <p className="font-medium">{item.nameAr}</p>
                                  {item.nameEn && <p className="text-xs text-muted-foreground">{item.nameEn}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {categoryLabels[item.category || 'other']?.label || 'أخرى'}
                              </Badge>
                            </TableCell>
                            <TableCell>{unitLabels[item.unit] || item.unit}</TableCell>
                            <TableCell>{item.unitCost.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <span className={stockStatus.status === 'critical' ? 'text-red-600 font-bold' : ''}>
                                  {item.currentStock}
                                </span>
                                <Progress value={stockStatus.percentage} className="h-1.5 w-16" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={stockStatus.status === 'critical' ? 'destructive' : stockStatus.status === 'warning' ? 'secondary' : 'default'}
                              >
                                {stockStatus.text}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredIngredients.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            لا توجد مواد خام مطابقة للبحث
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipes" className="space-y-4">
            <div className="flex justify-between items-center">
              <CardTitle>قائمة الوصفات</CardTitle>
              <Button onClick={() => setIsAddRecipeOpen(true)} className="bg-primary hover:bg-primary">
                <Plus className="w-4 h-4 ml-2" />
                إضافة وصفة جديدة
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {isRecipesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الوصفة</TableHead>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-right">عدد المكونات</TableHead>
                        <TableHead className="text-right">التكلفة الإجمالية</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchFilteredRecipes.map((recipe) => (
                        <TableRow key={recipe.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ChefHat className="w-4 h-4 text-accent" />
                              <div>
                                <p className="font-medium">{recipe.nameAr}</p>
                                {recipe.nameEn && <p className="text-xs text-muted-foreground">{recipe.nameEn}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{recipe.coffeeItemName || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{recipe.ingredients?.length || 0} مكون</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-accent">
                            {(recipe.totalCost || 0).toFixed(2)} <SarIcon />
                          </TableCell>
                          <TableCell>
                            {recipe.isActive !== false ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="w-3 h-3 ml-1" />
                                نشط
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="w-3 h-3 ml-1" />
                                معطل
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Calculator className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {branchFilteredRecipes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            لا توجد وصفات مسجلة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  تنبيهات المخزون المنخفض
                </CardTitle>
                <CardDescription>المواد التي تحتاج إعادة تموين</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockItems.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                    <p className="text-lg font-medium text-green-600">جميع المواد بمستوى جيد</p>
                    <p className="text-muted-foreground">لا توجد تنبيهات حالياً</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lowStockItems.map((item) => {
                      const stockStatus = getStockStatus(item);
                      return (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${stockStatus.status === 'critical' ? 'bg-red-100 dark:bg-red-900' : 'bg-primary dark:bg-primary'}`}>
                              <AlertTriangle className={`w-6 h-6 ${stockStatus.status === 'critical' ? 'text-red-600' : 'text-accent'}`} />
                            </div>
                            <div>
                              <p className="font-medium">{item.nameAr}</p>
                              <p className="text-sm text-muted-foreground">
                                الكمية الحالية: {item.currentStock} {unitLabels[item.unit]} | الحد الأدنى: {item.minStockThreshold} {unitLabels[item.unit]}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">{stockStatus.text}</Badge>
                            <Button variant="outline" size="sm">
                              <Plus className="w-4 h-4 ml-1" />
                              إضافة مخزون
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-600" />
                  سجل حركات المخزون
                </CardTitle>
                <CardDescription>جميع عمليات الإضافة والصرف</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>سجل الحركات سيظهر هنا</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isAddIngredientOpen} onOpenChange={setIsAddIngredientOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة مادة خام جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الاسم بالعربي *</Label>
                  <Input 
                    value={newIngredient.nameAr}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, nameAr: e.target.value }))}
                    placeholder="مثال: حليب"
                  />
                </div>
                <div>
                  <Label>الاسم بالإنجليزي</Label>
                  <Input 
                    value={newIngredient.nameEn}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, nameEn: e.target.value }))}
                    placeholder="Milk"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الفئة</Label>
                  <Select value={newIngredient.category} onValueChange={(v) => setNewIngredient(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coffee">قهوة</SelectItem>
                      <SelectItem value="dairy">ألبان</SelectItem>
                      <SelectItem value="sweetener">محليات</SelectItem>
                      <SelectItem value="packaging">تغليف</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>وحدة القياس</Label>
                  <Select value={newIngredient.unit} onValueChange={(v) => setNewIngredient(prev => ({ ...prev, unit: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">جرام (g)</SelectItem>
                      <SelectItem value="kg">كيلو (kg)</SelectItem>
                      <SelectItem value="ml">مللي (ml)</SelectItem>
                      <SelectItem value="l">لتر (l)</SelectItem>
                      <SelectItem value="pcs">قطعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>تكلفة الوحدة</Label>
                  <Input 
                    type="number"
                    value={newIngredient.unitCost}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, unitCost: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>الكمية الحالية</Label>
                  <Input 
                    type="number"
                    value={newIngredient.currentStock}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, currentStock: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>الحد الأدنى</Label>
                  <Input 
                    type="number"
                    value={newIngredient.minStockThreshold}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, minStockThreshold: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddIngredientOpen(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleAddIngredient}
                disabled={!newIngredient.nameAr || createIngredientMutation.isPending}
                className="bg-primary hover:bg-primary"
              >
                {createIngredientMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

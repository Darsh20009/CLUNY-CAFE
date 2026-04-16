import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState, EmptyState } from "@/components/ui/states";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SarIcon from "@/components/sar-icon";
import { 
  Plus, 
  Minus,
  Package, 
  Search,
  Loader2,
  Coffee,
  Box,
  Wrench,
  Droplet,
  HelpCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  PackagePlus,
  RotateCcw,
  Eye,
  Sparkles,
  Layers,
  BarChart3,
  Users,
  ShoppingCart,
  ArrowRightLeft,
  Bell,
  BookOpen,
  ChevronLeft,
} from "lucide-react";

const categoryLabels: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  ingredient: { 
    label: "مكون", 
    icon: Coffee,
    color: "text-primary",
    bgColor: "bg-muted"
  },
  packaging: { 
    label: "تغليف", 
    icon: Box,
    color: "text-primary",
    bgColor: "bg-muted"
  },
  equipment: { 
    label: "معدات", 
    icon: Wrench,
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
  consumable: { 
    label: "مستهلكات", 
    icon: Droplet,
    color: "text-primary",
    bgColor: "bg-muted"
  },
  other: { 
    label: "أخرى", 
    icon: HelpCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
};

const unitLabels: Record<string, string> = {
  kg: "كيلو",
  g: "جرام",
  liter: "لتر",
  ml: "مل",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

interface RawItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  category: string;
  unit: string;
  unitCost: number;
  minStockLevel: number;
  maxStockLevel?: number;
  isActive: number;
}

interface BranchStock {
  id: string;
  branchId: string;
  rawItemId: string;
  currentQuantity: number;
  reservedQuantity: number;
  lastUpdated: string;
  rawItem?: RawItem;
}

interface Branch {
  id?: string;
  nameAr: string;
}

export default function InventorySmartPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isQuickAdjustOpen, setIsQuickAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RawItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [newStockData, setNewStockData] = useState({
    rawItemId: "",
    quantity: 0,
    unitCost: 0,
    notes: "",
  });

  const { data: rawItems = [], isLoading: loadingItems } = useQuery<RawItem[]>({
    queryKey: ["/api/inventory/raw-items"],
  });

  const { data: branchStocks = [], isLoading: loadingStocks, refetch: refetchStocks } = useQuery<BranchStock[]>({
    queryKey: ["/api/inventory/branch-stocks", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== 'all') {
        params.append('branchId', selectedBranch);
      } else if (selectedBranch === 'all') {
        // Fetch from all branches by not providing branchId
      }
      const response = await fetch(`/api/inventory/branch-stocks?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch stocks');
      return response.json();
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (data: { rawItemId: string; branchId: string; quantity: number; type: "add" | "subtract"; notes?: string }) => {
      return apiRequest("POST", "/api/inventory/stock-adjustment", data);
    },
    onSuccess: () => {
      // Invalidate all stock queries to ensure refresh
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/branch-stocks"] });
      setIsQuickAdjustOpen(false);
      setAdjustQuantity(0);
      toast({ title: "تم تعديل المخزون بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في تعديل المخزون", variant: "destructive" });
    },
  });

  const addStockBatchMutation = useMutation({
    mutationFn: async (data: typeof newStockData & { branchId: string }) => {
      return apiRequest("POST", "/api/inventory/stock-batch", data);
    },
    onSuccess: () => {
      // Invalidate both specific and general queries
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/branch-stocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      setIsAddStockOpen(false);
      setNewStockData({ rawItemId: "", quantity: 0, unitCost: 0, notes: "" });
      toast({ title: "تمت إضافة الدفعة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إضافة الدفعة", variant: "destructive" });
    },
  });

  const getStockForItem = (itemId: string) => {
    return branchStocks.find(s => s.rawItemId === itemId);
  };

  const getStockStatus = (item: RawItem, stock?: BranchStock) => {
    const currentQty = stock?.currentQuantity || 0;
    const minLevel = item.minStockLevel || 0;
    const maxLevel = item.maxStockLevel || minLevel * 3;
    
    if (currentQty <= 0) {
      return { status: "out", label: "نفد", color: "bg-destructive", textColor: "text-destructive" };
    }
    if (currentQty <= minLevel) {
      return { status: "low", label: "منخفض", color: "bg-background0", textColor: "text-accent dark:text-accent" };
    }
    if (currentQty >= maxLevel * 0.8) {
      return { status: "high", label: "مرتفع", color: "bg-green-500", textColor: "text-green-600 dark:text-green-400" };
    }
    return { status: "normal", label: "طبيعي", color: "bg-primary", textColor: "text-primary" };
  };

  const getStockPercentage = (item: RawItem, stock?: BranchStock) => {
    const currentQty = stock?.currentQuantity || 0;
    const maxLevel = item.maxStockLevel || item.minStockLevel * 3 || 100;
    return Math.min(100, (currentQty / maxLevel) * 100);
  };

  const filteredItems = rawItems.filter((item) => {
    const matchesSearch =
      item.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalItems = rawItems.length;
  const lowStockItems = rawItems.filter(item => {
    const stock = getStockForItem(item.id);
    return (stock?.currentQuantity || 0) <= item.minStockLevel;
  }).length;
  const outOfStockItems = rawItems.filter(item => {
    const stock = getStockForItem(item.id);
    return (stock?.currentQuantity || 0) <= 0;
  }).length;
  
  const totalCOGS = rawItems.reduce((sum, item) => {
    const stock = getStockForItem(item.id);
    return sum + ((stock?.currentQuantity || 0) * item.unitCost);
  }, 0);

  const handleQuickAdjust = (item: RawItem, type: "add" | "subtract") => {
    setSelectedItem(item);
    setAdjustType(type);
    setAdjustQuantity(1);
    setIsQuickAdjustOpen(true);
  };

  const handleAdjustSubmit = () => {
    if (!selectedItem || !selectedBranch || selectedBranch === "all") {
      toast({ title: "يرجى اختيار الفرع أولاً", variant: "destructive" });
      return;
    }
    adjustStockMutation.mutate({
      rawItemId: selectedItem.id,
      branchId: selectedBranch,
      quantity: adjustQuantity,
      type: adjustType,
    });
  };

  if (loadingItems || loadingStocks) {
    return (
      <div dir="rtl">
        <LoadingState message="جاري تحميل المخزون..." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary/10 shadow-lg">
            <Layers className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              المخزون الذكي
            </h1>
            <p className="text-muted-foreground">إدارة مبسطة وذكية للمخزون</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[180px]" data-testid="select-branch">
              <SelectValue placeholder="اختر الفرع" />
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
          <Button 
            onClick={() => setIsAddStockOpen(true)} 
            data-testid="button-add-stock-batch"
          >
            <PackagePlus className="h-4 w-4 ml-2" />
            إضافة دفعة جديدة
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">إجمالي المواد</p>
                <p className="text-4xl font-bold text-foreground" data-testid="text-total-items">{totalItems}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Package className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">مخزون منخفض</p>
                <p className="text-4xl font-bold text-accent dark:text-accent" data-testid="text-low-stock">{lowStockItems}</p>
              </div>
              <div className="p-3 rounded-full bg-accent dark:bg-accent/30">
                <TrendingDown className="h-8 w-8 text-accent dark:text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">نفد المخزون</p>
                <p className="text-4xl font-bold text-destructive" data-testid="text-out-stock">{outOfStockItems}</p>
              </div>
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">قيمة المخزون (COGS)</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-cogs">
                  {totalCOGS.toFixed(0)}
                  <span className="text-lg mr-1"><SarIcon /></span>
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        <Link href="/manager/inventory/raw-items" data-testid="link-raw-items">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                <Coffee className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">المواد الخام</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/inventory/stock" data-testid="link-stock">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">المخزون</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/inventory/recipes" data-testid="link-recipes">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">الوصفات</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/inventory/suppliers" data-testid="link-suppliers">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">الموردين</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/inventory/purchases" data-testid="link-purchases">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">المشتريات</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/inventory/transfers" data-testid="link-transfers">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">التحويلات</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manager/inventory/alerts" data-testid="link-alerts">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 group-hover:scale-110 transition-transform">
                <Bell className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">التنبيهات</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="bg-muted/50 border-b">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-12 h-12 text-lg rounded-xl"
                data-testid="input-search"
              />
            </div>
            <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="w-auto">
              <TabsList className="bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="all" className="rounded-lg px-4">الكل</TabsTrigger>
                {Object.entries(categoryLabels).map(([key, { label }]) => (
                  <TabsTrigger key={key} value={key} className="rounded-lg px-3">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {filteredItems.length === 0 ? (
            <EmptyState
              title="لا توجد مواد"
              description="أضف مواد خام جديدة للبدء"
              icon={<Package className="h-10 w-10 text-muted-foreground" />}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => {
                const categoryInfo = categoryLabels[item.category] || categoryLabels.other;
                const CategoryIcon = categoryInfo.icon;
                const stock = getStockForItem(item.id);
                const stockStatus = getStockStatus(item, stock);
                const stockPercentage = getStockPercentage(item, stock);
                const currentQty = stock?.currentQuantity || 0;

                return (
                  <Card 
                    key={item.id} 
                    className="border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden bg-card"
                    data-testid={`card-item-${item.id}`}
                  >
                    <CardContent className="p-0">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl bg-muted ${categoryInfo.color}`}>
                              <CategoryIcon className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg leading-tight text-foreground">{item.nameAr}</h3>
                              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {item.code}
                              </code>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`${stockStatus.textColor} border-current`}
                          >
                            {stockStatus.label}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-3xl font-bold text-foreground" data-testid={`text-qty-${item.id}`}>
                              {currentQty.toFixed(currentQty < 1 ? 3 : 1)}
                            </span>
                            <span className="text-muted-foreground text-lg">
                              {unitLabels[item.unit] || item.unit}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>الحد الأدنى: {item.minStockLevel}</span>
                              <span>{stockPercentage.toFixed(0)}%</span>
                            </div>
                            <Progress 
                              value={stockPercentage} 
                              className="h-2"
                            />
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <div className="text-sm">
                              <span className="text-muted-foreground">التكلفة: </span>
                              <span className="font-semibold text-foreground">{item.unitCost.toFixed(2)} <SarIcon /></span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleQuickAdjust(item, "subtract")}
                                disabled={currentQty <= 0}
                                data-testid={`button-minus-${item.id}`}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleQuickAdjust(item, "add")}
                                data-testid={`button-plus-${item.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {stockStatus.status === "low" || stockStatus.status === "out" ? (
                        <div className={`px-4 py-2 flex items-center gap-2 text-sm ${
                          stockStatus.status === "out" 
                            ? "bg-destructive/10 text-destructive" 
                            : "bg-accent dark:bg-accent/20 text-accent dark:text-accent"
                        }`}>
                          <AlertTriangle className="h-4 w-4" />
                          {stockStatus.status === "out" ? "نفد المخزون - يرجى إعادة التعبئة" : "المخزون منخفض - يرجى الطلب"}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isQuickAdjustOpen} onOpenChange={setIsQuickAdjustOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustType === "add" ? (
                <Plus className="h-5 w-5 text-green-600" />
              ) : (
                <Minus className="h-5 w-5 text-destructive" />
              )}
              {adjustType === "add" ? "إضافة كمية" : "خصم كمية"} - {selectedItem?.nameAr}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الكمية</Label>
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setAdjustQuantity(Math.max(0, adjustQuantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseFloat(e.target.value) || 0)}
                  className="text-center text-2xl font-bold h-14"
                  min={0}
                  step={0.1}
                  data-testid="input-adjust-qty"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setAdjustQuantity(adjustQuantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-center text-muted-foreground">
                {unitLabels[selectedItem?.unit || ""] || selectedItem?.unit}
              </p>
            </div>

            {selectedBranch === "all" && (
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="text-sm text-muted-foreground">
                  يرجى اختيار فرع محدد من القائمة أعلاه للتعديل على المخزون
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickAdjustOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleAdjustSubmit}
              disabled={adjustStockMutation.isPending || selectedBranch === "all" || adjustQuantity <= 0}
              variant={adjustType === "add" ? "default" : "destructive"}
            >
              {adjustStockMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              {adjustType === "add" ? "إضافة" : "خصم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              إضافة دفعة مخزون جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>المادة الخام</Label>
              <Select
                value={newStockData.rawItemId}
                onValueChange={(value) => {
                  const item = rawItems.find(i => i.id === value);
                  setNewStockData({ 
                    ...newStockData, 
                    rawItemId: value,
                    unitCost: item?.unitCost || 0
                  });
                }}
              >
                <SelectTrigger data-testid="select-raw-item">
                  <SelectValue placeholder="اختر المادة الخام" />
                </SelectTrigger>
                <SelectContent>
                  {rawItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <span>{item.nameAr}</span>
                        <code className="text-xs text-muted-foreground">{item.code}</code>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الكمية</Label>
                <Input
                  type="number"
                  value={newStockData.quantity}
                  onChange={(e) => setNewStockData({ ...newStockData, quantity: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.1}
                  data-testid="input-batch-qty"
                />
              </div>
              <div className="space-y-2">
                <Label>تكلفة الوحدة (<SarIcon />)</Label>
                <Input
                  type="number"
                  value={newStockData.unitCost}
                  onChange={(e) => setNewStockData({ ...newStockData, unitCost: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.01}
                  data-testid="input-batch-cost"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={newStockData.notes}
                onChange={(e) => setNewStockData({ ...newStockData, notes: e.target.value })}
                placeholder="ملاحظات اختيارية..."
                data-testid="input-batch-notes"
              />
            </div>

            {newStockData.rawItemId && newStockData.quantity > 0 && (
              <div className="p-4 rounded-xl bg-green-100 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">إجمالي التكلفة:</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {(newStockData.quantity * newStockData.unitCost).toFixed(2)} <SarIcon />
                  </span>
                </div>
              </div>
            )}

            {selectedBranch === "all" && (
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="text-sm text-muted-foreground">
                  يرجى اختيار فرع محدد من القائمة أعلاه لإضافة الدفعة
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStockOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (selectedBranch !== "all") {
                  addStockBatchMutation.mutate({ ...newStockData, branchId: selectedBranch });
                }
              }}
              disabled={addStockBatchMutation.isPending || selectedBranch === "all" || !newStockData.rawItemId || newStockData.quantity <= 0}
            >
              {addStockBatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              إضافة الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

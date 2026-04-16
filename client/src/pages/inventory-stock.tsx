import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Warehouse,
  Search,
  Plus,
  Minus,
  AlertTriangle,
  TrendingDown,
  Package,
  Loader2,
  RefreshCw,
  DollarSign,
  PackagePlus,
  Bell,
  Box,
  Coffee,
  Droplet,
  Wrench,
  HelpCircle,
  TrendingUp,
  BarChart3,
  Eye,
  History,
  Filter,
  ArrowUpDown,
  Sparkles,
  Target,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";

interface BranchStock {
  id: string;
  branchId: string;
  rawItemId: string;
  currentQuantity: number;
  reservedQuantity: number;
  lastUpdated: string;
  notes?: string;
  rawItem?: {
    nameAr: string;
    nameEn?: string;
    code: string;
    unit: string;
    minStockLevel: number;
    unitCost: number;
    category?: string;
  };
  branch?: {
    nameAr: string;
  };
}

interface RawItem {
  id: string;
  code: string;
  nameAr: string;
  unit: string;
  minStockLevel: number;
  unitCost: number;
  category?: string;
}

interface Branch {
  id?: string;
  nameAr: string;
}

const unitLabels: Record<string, string> = {
  kg: "كيلو",
  g: "جرام",
  liter: "لتر",
  ml: "مل",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

const categoryConfig: Record<string, { label: string; icon: any; gradient: string }> = {
  ingredient: { 
    label: "مكون", 
    icon: Coffee,
    gradient: "from-amber-500 to-background0"
  },
  packaging: { 
    label: "تغليف", 
    icon: Box,
    gradient: "from-blue-500 to-cyan-500"
  },
  equipment: { 
    label: "معدات", 
    icon: Wrench,
    gradient: "from-slate-500 to-slate-600"
  },
  consumable: { 
    label: "مستهلكات", 
    icon: Droplet,
    gradient: "from-green-500 to-emerald-500"
  },
  other: { 
    label: "أخرى", 
    icon: HelpCircle,
    gradient: "from-gray-500 to-gray-600"
  },
};

export default function InventoryStockPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [isQuickAdjustOpen, setIsQuickAdjustOpen] = useState(false);
  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<BranchStock | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<string>("1");
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustNotes, setAdjustNotes] = useState("");
  
  const [newBatchData, setNewBatchData] = useState({
    branchId: "",
    rawItemId: "",
    quantity: "",
    unitCost: "",
    notes: "",
  });

  const { data: stockData = [], isLoading } = useQuery<BranchStock[]>({
    queryKey: ["/api/inventory/stock"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: rawItems = [] } = useQuery<RawItem[]>({
    queryKey: ["/api/inventory/raw-items"],
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { branchId: string; rawItemId: string; quantity: number; type: string; notes: string }) => {
      if (!data.branchId || !data.rawItemId) {
        return Promise.reject(new Error("بيانات غير صالحة"));
      }
      return apiRequest("POST", "/api/inventory/stock/adjust", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/movements"] });
      setIsQuickAdjustOpen(false);
      setSelectedStock(null);
      setAdjustQuantity("1");
      setAdjustNotes("");
      toast({ 
        title: variables.type === "add" ? "تمت الإضافة بنجاح" : "تم الخصم بنجاح",
        description: `${Math.abs(variables.quantity)} ${unitLabels[selectedStock?.rawItem?.unit || ''] || ''}`
      });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في تعديل المخزون", variant: "destructive" });
    },
  });

  const newBatchMutation = useMutation({
    mutationFn: (data: { branchId: string; rawItemId: string; quantity: number; unitCost?: number; notes: string }) => {
      return apiRequest("POST", "/api/inventory/stock/adjust", {
        ...data,
        type: "add",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/journal-entries"] });
      setIsNewBatchOpen(false);
      setNewBatchData({
        branchId: "",
        rawItemId: "",
        quantity: "",
        unitCost: "",
        notes: "",
      });
      toast({ 
        title: "تمت إضافة الدفعة بنجاح",
        description: "تم تحديث المخزون والقيود المحاسبية بالكمية الجديدة"
      });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إضافة الدفعة", variant: "destructive" });
    },
  });

  const handleQuickAdjust = (stock: BranchStock, type: "add" | "subtract") => {
    setSelectedStock(stock);
    setAdjustType(type);
    setAdjustQuantity("1");
    setAdjustNotes("");
    setIsQuickAdjustOpen(true);
  };

  const handleSubmitAdjust = () => {
    if (!selectedStock) return;
    const qty = parseFloat(adjustQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "يرجى إدخال كمية صحيحة", variant: "destructive" });
      return;
    }
    if (adjustType === "subtract" && qty > selectedStock.currentQuantity) {
      toast({ title: "لا يمكن خصم كمية أكبر من المتوفر", variant: "destructive" });
      return;
    }
    adjustMutation.mutate({
      branchId: selectedStock.branchId,
      rawItemId: selectedStock.rawItemId,
      quantity: adjustType === "add" ? qty : -qty,
      type: adjustType,
      notes: adjustNotes || (adjustType === "add" ? "إضافة مخزون" : "خصم يدوي"),
    });
  };

  const handleDirectAdjust = (stock: BranchStock, amount: number) => {
    if (amount < 0 && Math.abs(amount) > stock.currentQuantity) {
      toast({ title: "لا يمكن خصم كمية أكبر من المتوفر", variant: "destructive" });
      return;
    }
    adjustMutation.mutate({
      branchId: stock.branchId,
      rawItemId: stock.rawItemId,
      quantity: amount,
      type: amount > 0 ? "add" : "subtract",
      notes: amount > 0 ? "إضافة سريعة" : "خصم سريع",
    });
  };

  const handleSubmitNewBatch = () => {
    const qty = parseFloat(newBatchData.quantity);
    if (!newBatchData.branchId || !newBatchData.rawItemId) {
      toast({ title: "يرجى اختيار الفرع والمادة", variant: "destructive" });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "يرجى إدخال كمية صحيحة", variant: "destructive" });
      return;
    }
    newBatchMutation.mutate({
      branchId: newBatchData.branchId,
      rawItemId: newBatchData.rawItemId,
      quantity: qty,
      unitCost: newBatchData.unitCost ? parseFloat(newBatchData.unitCost) : undefined,
      notes: newBatchData.notes || "دفعة جديدة",
    });
  };

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.nameAr || id;

  const getStockStatus = (stock: BranchStock) => {
    const minLevel = stock.rawItem?.minStockLevel || 0;
    const percentage = minLevel > 0 ? (stock.currentQuantity / (minLevel * 2)) * 100 : 100;
    
    if (stock.currentQuantity <= 0) {
      return { 
        label: "نفاد", 
        color: "bg-red-500", 
        textColor: "text-red-700 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        borderColor: "border-red-300 dark:border-red-700",
        icon: AlertTriangle, 
        priority: 3,
        percentage: 0 
      };
    } else if (stock.currentQuantity <= minLevel) {
      return { 
        label: "منخفض", 
        color: "bg-yellow-500",
        textColor: "text-yellow-700 dark:text-yellow-400",
        bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
        borderColor: "border-yellow-300 dark:border-yellow-700",
        icon: TrendingDown, 
        priority: 2,
        percentage: Math.min(percentage, 40)
      };
    } else if (stock.currentQuantity <= minLevel * 1.5) {
      return { 
        label: "تنبيه", 
        color: "bg-blue-500",
        textColor: "text-blue-700 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        borderColor: "border-blue-300 dark:border-blue-700",
        icon: Bell, 
        priority: 1,
        percentage: Math.min(percentage, 60)
      };
    }
    return { 
      label: "متوفر", 
      color: "bg-green-500",
      textColor: "text-green-700 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      borderColor: "border-green-300 dark:border-green-700",
      icon: CheckCircle2, 
      priority: 0,
      percentage: Math.min(percentage, 100)
    };
  };

  const calculateStockValue = (stock: BranchStock) => {
    const unitCost = stock.rawItem?.unitCost || 0;
    return stock.currentQuantity * unitCost;
  };

  const filteredStock = stockData.filter((stock) => {
    const matchesSearch = 
      (stock.rawItem?.nameAr?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (stock.rawItem?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesBranch = branchFilter === "all" || stock.branchId === branchFilter;
    const matchesCategory = categoryFilter === "all" || stock.rawItem?.category === categoryFilter;
    
    let matchesStockFilter = true;
    if (stockFilter === "low") {
      matchesStockFilter = stock.currentQuantity <= (stock.rawItem?.minStockLevel || 0) && stock.currentQuantity > 0;
    } else if (stockFilter === "out") {
      matchesStockFilter = stock.currentQuantity <= 0;
    } else if (stockFilter === "warning") {
      const minLevel = stock.rawItem?.minStockLevel || 0;
      matchesStockFilter = stock.currentQuantity > minLevel && stock.currentQuantity <= minLevel * 1.5;
    } else if (stockFilter === "available") {
      const minLevel = stock.rawItem?.minStockLevel || 0;
      matchesStockFilter = stock.currentQuantity > minLevel * 1.5;
    }
    
    return matchesSearch && matchesBranch && matchesStockFilter && matchesCategory;
  }).sort((a, b) => getStockStatus(b).priority - getStockStatus(a).priority);

  const totalItems = stockData.length;
  const lowStockItems = stockData.filter(s => s.currentQuantity <= (s.rawItem?.minStockLevel || 0) && s.currentQuantity > 0).length;
  const outOfStockItems = stockData.filter(s => s.currentQuantity <= 0).length;
  const healthyItems = stockData.filter(s => {
    const minLevel = s.rawItem?.minStockLevel || 0;
    return s.currentQuantity > minLevel * 1.5;
  }).length;
  const totalStockValue = stockData.reduce((acc, stock) => acc + calculateStockValue(stock), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="relative">
            <Warehouse className="h-16 w-16 text-accent animate-pulse mx-auto" />
            <Loader2 className="h-8 w-8 animate-spin text-accent absolute -bottom-2 -right-2" />
          </div>
          <p className="text-muted-foreground mt-4 text-lg">جاري تحميل المخزون...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-background/30 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/10 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
              <Warehouse className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                إدارة المخزون
              </h1>
              <p className="text-muted-foreground text-sm">تحكم كامل في المواد الخام والمخزون</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setIsNewBatchOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-background0 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20"
              data-testid="button-new-batch"
            >
              <PackagePlus className="h-4 w-4 ml-2" />
              إضافة دفعة جديدة
            </Button>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock"] })}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مخزون سليم</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">{healthyItems}</p>
                  <p className="text-xs text-green-600/70">من أصل {totalItems} مادة</p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/20">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950/50 dark:to-amber-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مخزون منخفض</p>
                  <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{lowStockItems}</p>
                  <p className="text-xs text-yellow-600/70">يحتاج إعادة تعبئة</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/20">
                  <TrendingDown className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950/50 dark:to-rose-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">نفاد المخزون</p>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-400">{outOfStockItems}</p>
                  <p className="text-xs text-red-600/70">يجب الطلب فوراً</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/20">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">قيمة المخزون</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{totalStockValue.toFixed(0)}</p>
                  <p className="text-xs text-blue-600/70">ريال سعودي</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {(lowStockItems > 0 || outOfStockItems > 0) && (
          <Card className="border-2 border-yellow-300 dark:border-yellow-700 bg-gradient-to-r from-yellow-50 to-background dark:from-yellow-950/30 dark:to-amber-950/30 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <Bell className="h-5 w-5 animate-pulse" />
                تنبيهات المخزون العاجلة
              </CardTitle>
              <CardDescription className="text-yellow-600/80">
                هذه المواد تحتاج انتباهك الفوري
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {stockData
                  .filter(s => getStockStatus(s).priority >= 2)
                  .sort((a, b) => getStockStatus(b).priority - getStockStatus(a).priority)
                  .slice(0, 8)
                  .map((stock) => {
                    const status = getStockStatus(stock);
                    const StatusIcon = status.icon;
                    return (
                      <div
                        key={stock.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl ${status.bgColor} ${status.borderColor} border-2 cursor-pointer transition-transform hover:scale-105`}
                        onClick={() => handleQuickAdjust(stock, "add")}
                      >
                        <StatusIcon className={`h-4 w-4 ${status.textColor}`} />
                        <span className={`font-medium ${status.textColor}`}>{stock.rawItem?.nameAr}</span>
                        <Badge variant="outline" className={status.textColor}>
                          {stock.currentQuantity} {unitLabels[stock.rawItem?.unit || ""]}
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-6 px-2">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg border-0">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن مادة بالاسم أو الكود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-background"
                  data-testid="input-search-stock"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-branch-filter">
                    <SelectValue placeholder="الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id as string}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-stock-filter">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="available">متوفر</SelectItem>
                    <SelectItem value="warning">تنبيه</SelectItem>
                    <SelectItem value="low">منخفض</SelectItem>
                    <SelectItem value="out">نفاد</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-category-filter">
                    <SelectValue placeholder="النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {filteredStock.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">لا توجد بيانات مخزون</p>
                <p className="text-sm text-muted-foreground/70">حاول تغيير معايير البحث</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStock.map((stock) => {
                  const status = getStockStatus(stock);
                  const StatusIcon = status.icon;
                  const category = categoryConfig[stock.rawItem?.category || "other"] || categoryConfig.other;
                  const CategoryIcon = category.icon;
                  const stockValue = calculateStockValue(stock);
                  
                  return (
                    <Card 
                      key={stock.id} 
                      className={`overflow-hidden border-2 transition-all hover:shadow-lg ${status.borderColor}`}
                      data-testid={`card-stock-${stock.id}`}
                    >
                      <div className={`h-2 bg-gradient-to-r ${category.gradient}`} />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${category.gradient} text-white`}>
                              <CategoryIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="font-bold text-base">{stock.rawItem?.nameAr}</h3>
                              <p className="text-xs text-muted-foreground font-mono">{stock.rawItem?.code}</p>
                            </div>
                          </div>
                          <Badge className={`${status.bgColor} ${status.textColor} border ${status.borderColor}`}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {status.label}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">الكمية المتوفرة</span>
                              <span className="font-bold text-lg">
                                {stock.currentQuantity} {unitLabels[stock.rawItem?.unit || ""]}
                              </span>
                            </div>
                            <Progress 
                              value={status.percentage} 
                              className={`h-2 ${status.color === "bg-green-500" ? "[&>div]:bg-green-500" : status.color === "bg-yellow-500" ? "[&>div]:bg-yellow-500" : status.color === "bg-red-500" ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"}`}
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                              <span>الحد الأدنى: {stock.rawItem?.minStockLevel || 0}</span>
                              <span>{getBranchName(stock.branchId)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2">
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3 text-accent" />
                              <span className="text-muted-foreground">المخزون الحصري:</span>
                            </div>
                            <span className="font-bold font-mono">{stock.currentQuantity} {unitLabels[stock.rawItem?.unit || ""]}</span>
                          </div>

                          <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-green-600" />
                              <span className="text-muted-foreground">القيمة:</span>
                            </div>
                            <span className="font-bold text-green-600">{stockValue.toFixed(2)} <SarIcon /></span>
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                              onClick={() => handleDirectAdjust(stock, -1)}
                              disabled={stock.currentQuantity <= 0 || adjustMutation.isPending}
                              data-testid={`button-quick-subtract-${stock.id}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleQuickAdjust(stock, "subtract")}
                              disabled={adjustMutation.isPending}
                            >
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
                              onClick={() => handleDirectAdjust(stock, 1)}
                              disabled={adjustMutation.isPending}
                              data-testid={`button-quick-add-${stock.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isQuickAdjustOpen} onOpenChange={setIsQuickAdjustOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {adjustType === "add" ? (
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Plus className="h-5 w-5 text-green-600" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Minus className="h-5 w-5 text-red-600" />
                  </div>
                )}
                {adjustType === "add" ? "إضافة للمخزون" : "خصم من المخزون"}
              </DialogTitle>
              <DialogDescription>
                {selectedStock?.rawItem?.nameAr}
              </DialogDescription>
            </DialogHeader>
            {selectedStock && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted/50 rounded-xl text-center">
                  <p className="text-sm text-muted-foreground mb-1">الكمية الحالية</p>
                  <p className="text-3xl font-bold">
                    {selectedStock.currentQuantity}
                    <span className="text-base font-normal text-muted-foreground mr-2">
                      {unitLabels[selectedStock.rawItem?.unit || ""]}
                    </span>
                  </p>
                </div>

                <Tabs value={adjustType} onValueChange={(v) => setAdjustType(v as "add" | "subtract")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="add" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة
                    </TabsTrigger>
                    <TabsTrigger value="subtract" className="flex items-center gap-2">
                      <Minus className="h-4 w-4" />
                      خصم
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2">
                  <Label>الكمية</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setAdjustQuantity(String(Math.max(1, parseFloat(adjustQuantity || "1") - 1)))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      className="text-center text-xl font-bold"
                      min="0.1"
                      step="0.1"
                      data-testid="input-adjust-quantity"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setAdjustQuantity(String(parseFloat(adjustQuantity || "0") + 1))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {unitLabels[selectedStock.rawItem?.unit || ""]}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات (اختياري)</Label>
                  <Textarea
                    placeholder="سبب التعديل..."
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="resize-none"
                    rows={2}
                  />
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الكمية بعد التعديل:</span>
                    <span className="text-xl font-bold">
                      {adjustType === "add" 
                        ? (selectedStock.currentQuantity + parseFloat(adjustQuantity || "0")).toFixed(1)
                        : (selectedStock.currentQuantity - parseFloat(adjustQuantity || "0")).toFixed(1)
                      }
                      <span className="text-sm font-normal text-muted-foreground mr-1">
                        {unitLabels[selectedStock.rawItem?.unit || ""]}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsQuickAdjustOpen(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleSubmitAdjust}
                disabled={adjustMutation.isPending}
                className={adjustType === "add" 
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  : "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
                }
                data-testid="button-confirm-adjust"
              >
                {adjustMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : adjustType === "add" ? (
                  <Plus className="h-4 w-4 ml-2" />
                ) : (
                  <Minus className="h-4 w-4 ml-2" />
                )}
                تأكيد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isNewBatchOpen} onOpenChange={setIsNewBatchOpen}>
          <DialogContent dir="rtl" className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary dark:bg-primary/30">
                  <PackagePlus className="h-5 w-5 text-accent" />
                </div>
                إضافة دفعة جديدة
              </DialogTitle>
              <DialogDescription>
                أضف كمية جديدة من المواد الخام للمخزون
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select 
                    value={newBatchData.branchId} 
                    onValueChange={(v) => setNewBatchData({...newBatchData, branchId: v})}
                  >
                    <SelectTrigger data-testid="select-new-batch-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id as string}>
                          {branch.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المادة</Label>
                  <Select 
                    value={newBatchData.rawItemId} 
                    onValueChange={(v) => setNewBatchData({...newBatchData, rawItemId: v})}
                  >
                    <SelectTrigger data-testid="select-new-batch-item">
                      <SelectValue placeholder="اختر المادة" />
                    </SelectTrigger>
                    <SelectContent>
                      {rawItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nameAr} ({item.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الكمية</Label>
                  <Input
                    type="number"
                    placeholder="أدخل الكمية"
                    value={newBatchData.quantity}
                    onChange={(e) => setNewBatchData({...newBatchData, quantity: e.target.value})}
                    min="0.1"
                    step="0.1"
                    data-testid="input-new-batch-quantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>تكلفة الوحدة (اختياري)</Label>
                  <Input
                    type="number"
                    placeholder="ر.س"
                    value={newBatchData.unitCost}
                    onChange={(e) => setNewBatchData({...newBatchData, unitCost: e.target.value})}
                    min="0"
                    step="0.01"
                    data-testid="input-new-batch-cost"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea
                  placeholder="ملاحظات عن الدفعة..."
                  value={newBatchData.notes}
                  onChange={(e) => setNewBatchData({...newBatchData, notes: e.target.value})}
                  className="resize-none"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewBatchOpen(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleSubmitNewBatch}
                disabled={newBatchMutation.isPending}
                className="bg-gradient-to-r from-amber-500 to-background0 hover:from-amber-600 hover:to-orange-600"
                data-testid="button-confirm-new-batch"
              >
                {newBatchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <PackagePlus className="h-4 w-4 ml-2" />
                )}
                إضافة الدفعة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

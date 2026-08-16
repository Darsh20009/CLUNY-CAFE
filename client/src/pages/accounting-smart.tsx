import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Wallet,
  Receipt,
  ShoppingCart,
  Package,
  Loader2,
  Plus,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Target,
  Layers,
  CreditCard,
  Banknote,
  Clock,
  CheckCircle,
  Eye,
  X,
  Coffee,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

interface DashboardData {
  totalRevenue: number;
  totalVat: number;
  totalExpenses: number;
  totalCogs: number;
  grossProfit: number;
  netProfit: number;
  orderCount: number;
  invoiceCount: number;
  profitMargin: number;
  expensesByCategory: Record<string, number>;
  revenueByPayment: Record<string, number>;
  dailyTrend: Array<{ date: string; revenue: number; expenses: number; cogs: number; netProfit: number }>;
  weeklyTrend: Array<{ week: string; revenue: number; expenses: number; cogs: number; netProfit: number }>;
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number; cogs: number; netProfit: number }>;
}

interface Branch {
  id: string;
  nameAr: string;
}

const CHART_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#ec4899"];

const periodOptions = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "last30", label: "آخر 30 يوم" },
];

const expenseCategories = [
  { value: "inventory", label: "المخزون والمواد الخام" },
  { value: "salaries", label: "الرواتب والأجور" },
  { value: "rent", label: "الإيجار" },
  { value: "utilities", label: "المرافق" },
  { value: "marketing", label: "التسويق" },
  { value: "maintenance", label: "الصيانة" },
  { value: "other", label: "أخرى" },
];

const paymentMethodLabels: Record<string, string> = {
  cash: "نقدي",
  pos: "شبكة",
  online: "أونلاين",
  wallet: "محفظة",
};

type DrilldownType = "revenue" | "expenses" | "orders" | null;

export default function AccountingSmartPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("today");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<DrilldownType>(null);
  const [newExpense, setNewExpense] = useState({
    category: "",
    description: "",
    amount: "",
    notes: "",
  });

  const { data: dashboardData, isLoading: loadingDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/accounting/dashboard", period, selectedBranch],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: recentOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders", { limit: 5 }],
  });

  const { data: allOrders = [], isLoading: loadingOrders } = useQuery<any[]>({
    queryKey: [`/api/orders?period=${period}&branchId=${selectedBranch}&limit=50`],
    enabled: drilldownType === "revenue" || drilldownType === "orders",
  });

  const { data: allExpenses = [], isLoading: loadingExpenses } = useQuery<any[]>({
    queryKey: [`/api/accounting/expenses?period=${period}&branchId=${selectedBranch}`],
    enabled: drilldownType === "expenses",
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/accounting/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/dashboard"] });
      setIsAddExpenseOpen(false);
      setNewExpense({ category: "", description: "", amount: "", notes: "" });
      toast({ title: "تم إضافة المصروف بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إضافة المصروف", variant: "destructive" });
    },
  });

  const handleAddExpense = () => {
    const amount = parseFloat(newExpense.amount);
    if (!newExpense.category || !newExpense.description || isNaN(amount) || amount <= 0) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    createExpenseMutation.mutate({
      branchId: selectedBranch !== "all" ? selectedBranch : undefined,
      date: new Date().toISOString(),
      category: newExpense.category,
      description: newExpense.description,
      amount,
      totalAmount: amount,
      notes: newExpense.notes,
    });
  };

  const paymentData = dashboardData?.revenueByPayment
    ? Object.entries(dashboardData.revenueByPayment).map(([method, amount]) => ({
        name: paymentMethodLabels[method] || method,
        value: amount as number,
      }))
    : [];

  const expenseData = dashboardData?.expensesByCategory
    ? Object.entries(dashboardData.expensesByCategory).map(([category, amount]) => ({
        name: expenseCategories.find(c => c.value === category)?.label || category,
        value: amount as number,
      }))
    : [];

  if (loadingDashboard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="relative">
            <BarChart3 className="h-16 w-16 text-accent animate-pulse mx-auto" />
            <Loader2 className="h-8 w-8 animate-spin text-accent absolute -bottom-2 -right-2" />
          </div>
          <p className="text-muted-foreground mt-4 text-lg">جاري تحميل البيانات المالية...</p>
        </div>
      </div>
    );
  }

  const data = dashboardData || {
    totalRevenue: 0,
    totalVat: 0,
    totalExpenses: 0,
    totalCogs: 0,
    grossProfit: 0,
    netProfit: 0,
    orderCount: 0,
    invoiceCount: 0,
    profitMargin: 0,
    expensesByCategory: {},
    revenueByPayment: {},
    dailyTrend: [],
    weeklyTrend: [],
    monthlyTrend: [],
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 shadow-lg">
            <BarChart3 className="h-10 w-10 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-l from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
              المحاسبة الذكية
            </h1>
            <p className="text-muted-foreground">تحليل مالي شامل ومتكامل</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]" data-testid="select-period">
              <Calendar className="h-4 w-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[150px]" data-testid="select-branch">
              <SelectValue placeholder="الفرع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setIsAddExpenseOpen(true)} 
            variant="outline"
            data-testid="button-add-expense"
          >
            <Plus className="h-4 w-4 ml-2" />
            مصروف جديد
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 cursor-pointer hover-elevate"
          onClick={() => setDrilldownType("revenue")}
          data-testid="card-revenue-drilldown"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  إجمالي الإيرادات
                  <Eye className="h-3 w-3 opacity-50" />
                </p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-revenue">
                  {data.totalRevenue.toFixed(0)}
                  <span className="text-lg mr-1"><SarIcon /></span>
                </p>
                <div className="flex items-center gap-1 mt-2 text-sm text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>{data.orderCount} طلب</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-emerald-200/50 dark:bg-emerald-700/30">
                <TrendingUp className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 cursor-pointer hover-elevate"
          onClick={() => setDrilldownType("orders")}
          data-testid="card-cogs-drilldown"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  تكلفة المكونات (COGS)
                  <Eye className="h-3 w-3 opacity-50" />
                </p>
                <p className="text-3xl font-bold text-accent dark:text-accent" data-testid="text-cogs">
                  {data.totalCogs.toFixed(0)}
                  <span className="text-lg mr-1"><SarIcon /></span>
                </p>
                <div className="flex items-center gap-1 mt-2 text-sm text-accent">
                  <Package className="h-4 w-4" />
                  <span>خصم تلقائي من المخزون</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-primary/50 dark:bg-primary/30">
                <Layers className="h-8 w-8 text-accent dark:text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 cursor-pointer hover-elevate"
          onClick={() => setDrilldownType("expenses")}
          data-testid="card-expenses-drilldown"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  المصروفات
                  <Eye className="h-3 w-3 opacity-50" />
                </p>
                <p className="text-3xl font-bold text-red-700 dark:text-red-300" data-testid="text-expenses">
                  {data.totalExpenses.toFixed(0)}
                  <span className="text-lg mr-1"><SarIcon /></span>
                </p>
                <div className="flex items-center gap-1 mt-2 text-sm text-red-600">
                  <ArrowDownRight className="h-4 w-4" />
                  <span>مصروفات تشغيلية</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-red-200/50 dark:bg-red-700/30">
                <Wallet className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">صافي الربح</p>
                <p className={`text-3xl font-bold ${data.netProfit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`} data-testid="text-net-profit">
                  {data.netProfit.toFixed(0)}
                  <span className="text-lg mr-1"><SarIcon /></span>
                </p>
                <div className="flex items-center gap-1 mt-2 text-sm text-blue-600">
                  <Target className="h-4 w-4" />
                  <span>هامش الربح: {data.profitMargin.toFixed(1)}%</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-blue-200/50 dark:bg-blue-700/30">
                <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50/50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">الربح الإجمالي</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {data.grossProfit.toFixed(0)} <SarIcon />
                </p>
              </div>
              <Badge variant="outline" className="text-purple-600 border-purple-300">
                الإيرادات - COGS
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50/50 to-cyan-100/50 dark:from-cyan-900/20 dark:to-cyan-800/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ضريبة القيمة المضافة</p>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
                  {data.totalVat.toFixed(0)} <SarIcon />
                </p>
              </div>
              <Badge variant="outline" className="text-cyan-600 border-cyan-300">
                15% VAT
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-pink-50/50 to-pink-100/50 dark:from-pink-900/20 dark:to-pink-800/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">عدد الفواتير</p>
                <p className="text-2xl font-bold text-pink-700 dark:text-pink-300">
                  {data.invoiceCount}
                </p>
              </div>
              <Badge variant="outline" className="text-pink-600 border-pink-300">
                <Receipt className="h-3 w-3 ml-1" />
                فواتير
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="daily" className="rounded-lg px-6">يومي</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-lg px-6">أسبوعي</TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-lg px-6">شهري</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                صافي الربح اليومي (آخر 7 أيام)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.dailyTrend && data.dailyTrend.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyTrend}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => format(new Date(value), "EEE", { locale: ar })}
                        stroke="#9ca3af"
                      />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(2)} ر.س`]}
                        labelFormatter={(label) => format(new Date(label), "EEEE dd/MM", { locale: ar })}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#10b981" 
                        fill="url(#colorRevenue)"
                        name="الإيرادات"
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="netProfit" 
                        stroke="#3b82f6" 
                        fill="url(#colorProfit)"
                        name="صافي الربح"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p>لا توجد بيانات كافية لعرض الرسم البياني</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                صافي الربح الأسبوعي
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.weeklyTrend && data.weeklyTrend.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="week" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(2)} ر.س`]}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" fill="#10b981" name="الإيرادات" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cogs" fill="#f59e0b" name="تكلفة المكونات" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" fill="#ef4444" name="المصروفات" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="netProfit" fill="#3b82f6" name="صافي الربح" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <p>لا توجد بيانات كافية</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                التحليل الشهري
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.monthlyTrend && data.monthlyTrend.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(2)} ر.س`]}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" name="الإيرادات" strokeWidth={3} dot={{ r: 6 }} />
                      <Line type="monotone" dataKey="netProfit" stroke="#3b82f6" name="صافي الربح" strokeWidth={3} dot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <p>لا توجد بيانات كافية</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              الإيرادات حسب طريقة الدفع
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {paymentData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <p>لا توجد بيانات</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-red-600" />
              المصروفات حسب الفئة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {expenseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <p>لا توجد مصروفات مسجلة</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-red-600" />
              إضافة مصروف جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select
                value={newExpense.category}
                onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
              >
                <SelectTrigger data-testid="select-expense-category">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="وصف المصروف..."
                data-testid="input-expense-desc"
              />
            </div>

            <div className="space-y-2">
              <Label>المبلغ (<SarIcon />)</Label>
              <Input
                type="number"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="0.00"
                min={0}
                step={0.01}
                data-testid="input-expense-amount"
              />
            </div>

            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Input
                value={newExpense.notes}
                onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                data-testid="input-expense-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleAddExpense}
              disabled={createExpenseMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {createExpenseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              إضافة المصروف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={drilldownType !== null} onOpenChange={(open) => !open && setDrilldownType(null)}>
        <SheetContent side="left" className="w-full sm:max-w-xl" dir="rtl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {drilldownType === "revenue" && (
                <>
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  تفاصيل الإيرادات
                </>
              )}
              {drilldownType === "orders" && (
                <>
                  <Coffee className="h-5 w-5 text-accent" />
                  تفاصيل الطلبات (COGS)
                </>
              )}
              {drilldownType === "expenses" && (
                <>
                  <Wallet className="h-5 w-5 text-red-600" />
                  تفاصيل المصروفات
                </>
              )}
            </SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            {(drilldownType === "revenue" || drilldownType === "orders") && (
              <div className="space-y-3">
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : allOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد طلبات في هذه الفترة
                  </div>
                ) : (
                  allOrders.map((order: any) => (
                    <Card key={order.id} className="border shadow-sm" data-testid={`card-order-${order.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{order.orderNumber || order.id?.slice(-6)}</Badge>
                            <Badge 
                              variant={order.status === "completed" ? "default" : "secondary"}
                              className={order.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}
                            >
                              {order.status === "completed" ? "مكتمل" : 
                               order.status === "pending" ? "قيد الانتظار" :
                               order.status === "preparing" ? "قيد التحضير" : order.status}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {order.createdAt && format(new Date(order.createdAt), "dd/MM HH:mm", { locale: ar })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {order.items?.length || 0} عناصر
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-emerald-600">{(order.totalAmount || 0).toFixed(2)} <SarIcon /></p>
                            {drilldownType === "orders" && order.totalCost !== undefined && (
                              <p className="text-xs text-accent">COGS: {(order.totalCost || 0).toFixed(2)} <SarIcon /></p>
                            )}
                          </div>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">العناصر:</p>
                            <div className="flex flex-wrap gap-1">
                              {order.items.slice(0, 3).map((item: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {item.nameAr || item.name} x{item.quantity}
                                </Badge>
                              ))}
                              {order.items.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{order.items.length - 3} أخرى
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {drilldownType === "expenses" && (
              <div className="space-y-3">
                {loadingExpenses ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : allExpenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد مصروفات في هذه الفترة
                  </div>
                ) : (
                  allExpenses.map((expense: any) => (
                    <Card key={expense.id} className="border shadow-sm" data-testid={`card-expense-${expense.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">
                            {expenseCategories.find(c => c.value === expense.category)?.label || expense.category}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {expense.date && format(new Date(expense.date), "dd/MM/yyyy", { locale: ar })}
                          </span>
                        </div>
                        <p className="font-medium mb-1">{expense.description}</p>
                        {expense.notes && (
                          <p className="text-sm text-muted-foreground mb-2">{expense.notes}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">المبلغ:</span>
                          <span className="font-bold text-red-600">{(expense.amount || 0).toFixed(2)} <SarIcon /></span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

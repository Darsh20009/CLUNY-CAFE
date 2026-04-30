import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/states";
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, 
  Coffee, Package, BarChart3, Calendar, ArrowUpRight, ArrowDownRight,
  Wallet, CreditCard, Building2, ChefHat, Settings, LogOut,
  FileText, PieChart, Activity, Target, Award, Sparkles,
  GitCompare, UserCheck, Clock, Briefcase
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, 
  PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line
} from "recharts";
import type { Employee, Order } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import { getSaudiTodayRange, getSaudiDaysAgoBounds, getSaudiLastNDaysRange, getSaudiDateString } from "@/lib/saudi-time";

export default function ExecutiveDashboard() {
  const [, setLocation] = useLocation();
  const [manager, setManager] = useState<Employee | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "year">("month");

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      if (emp.role !== "manager" && emp.role !== "admin" && emp.role !== "owner") {
        setLocation("/employee/dashboard");
        return;
      }
      setManager(emp);
    } else {
      setLocation("/manager/login");
    }
  }, [setLocation]);

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!manager,
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: !!manager,
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    enabled: !!manager,
  });

  if (!manager) {
    return <LoadingState message="جاري التحميل..." />;
  }

  // All ranges are computed in Asia/Riyadh time so this dashboard agrees
  // with the Accounting Dashboard. Without this, the boundary for "today"
  // shifts by 3 hours and revenue numbers diverge.
  const getRange = (filter: string): { start: Date; end: Date } => {
    switch (filter) {
      case "today":
        return getSaudiTodayRange();
      case "week":
        return getSaudiLastNDaysRange(7);
      case "month":
        return getSaudiLastNDaysRange(30);
      case "year":
        return getSaudiLastNDaysRange(365);
      default:
        return { start: new Date(0), end: new Date() };
    }
  };

  const getFilteredOrders = () => {
    const { start, end } = getRange(dateFilter);
    return orders.filter(order => {
      if (order.status === 'cancelled') return false;
      if (!order.createdAt) return dateFilter === "year";
      const orderDate = new Date(order.createdAt);
      if (isNaN(orderDate.getTime())) return false;
      return orderDate >= start && orderDate <= end;
    });
  };

  const filteredOrders = getFilteredOrders();
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const completedOrders = filteredOrders.filter(o => o.status === "completed");
  const completedRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  const { start: todayStart, end: todayEnd } = getSaudiTodayRange();
  const todayOrders = orders.filter(o => {
    if (o.status === 'cancelled') return false;
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt);
    return d >= todayStart && d <= todayEnd;
  });
  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  const dailyData = (() => {
    const days: Record<string, { revenue: number; orders: number }> = {};
    filteredOrders.forEach(order => {
      if (!order.createdAt) return;
      const date = new Date(order.createdAt);
      if (isNaN(date.getTime())) return;
      // Bucket by Saudi calendar day (YYYY-MM-DD) so days don't get split
      // across the midnight UTC boundary.
      const key = getSaudiDateString(date);
      if (!days[key]) days[key] = { revenue: 0, orders: 0 };
      days[key].revenue += Number(order.totalAmount || 0);
      days[key].orders += 1;
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, data]) => {
        const [, m, d] = iso.split("-");
        return { date: `${parseInt(d)}/${parseInt(m)}`, ...data };
      })
      .slice(-14);
  })();

  const paymentData = (() => {
    const methods: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const method = o.paymentMethod === 'cash' ? 'نقدي' : 
                     o.paymentMethod === 'card' ? 'بطاقة' : 
                     o.paymentMethod === 'mada' ? 'مدى' : o.paymentMethod;
      methods[method] = (methods[method] || 0) + Number(o.totalAmount || 0);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  })();

  const topProducts = (() => {
    const items: Record<string, { count: number; revenue: number }> = {};
    filteredOrders.forEach(order => {
      const orderItems = Array.isArray(order.items) ? order.items : [];
      orderItems.forEach((item: any) => {
        const name = item.coffeeItem?.nameAr || item.nameAr || 'منتج';
        if (!items[name]) items[name] = { count: 0, revenue: 0 };
        items[name].count += item.quantity || 1;
        items[name].revenue += (item.quantity || 1) * Number(item.price || 0);
      });
    });
    return Object.entries(items)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  })();

  const CHART_COLORS = ['#D4AF37', '#2D3748', '#38A169', '#E53E3E', '#805AD5'];

  const branchAnalytics = (() => {
    const analytics: Record<string, { 
      name: string; 
      revenue: number; 
      orders: number; 
      avgOrder: number;
      growth: number;
      previousRevenue: number;
    }> = {};
    
    const getPreviousPeriodOrders = () => {
      // Saudi-aware previous-period bounds (mirror the current-period range).
      let prev: { start: Date; end: Date };
      switch (dateFilter) {
        case "today":
          prev = getSaudiDaysAgoBounds(1);
          break;
        case "week":
          prev = { start: getSaudiDaysAgoBounds(13).start, end: getSaudiDaysAgoBounds(7).end };
          break;
        case "month":
          prev = { start: getSaudiDaysAgoBounds(59).start, end: getSaudiDaysAgoBounds(30).end };
          break;
        case "year":
          prev = { start: getSaudiDaysAgoBounds(729).start, end: getSaudiDaysAgoBounds(365).end };
          break;
        default:
          return [] as typeof orders;
      }
      return orders.filter(order => {
        if (order.status === 'cancelled') return false;
        if (!order.createdAt) return false;
        const orderDate = new Date(order.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        return orderDate >= prev.start && orderDate < prev.end;
      });
    };
    
    const previousOrders = getPreviousPeriodOrders();
    
    branches.forEach((branch: any) => {
      const branchOrders = filteredOrders.filter((o: any) => o.branchId === branch.id);
      const prevBranchOrders = previousOrders.filter((o: any) => o.branchId === branch.id);
      const revenue = branchOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
      const prevRevenue = prevBranchOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
      const orderCount = branchOrders.length;
      const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
      
      analytics[branch.id] = {
        name: branch.name || branch.nameAr || 'فرع',
        revenue,
        orders: orderCount,
        avgOrder: orderCount > 0 ? revenue / orderCount : 0,
        growth,
        previousRevenue: prevRevenue
      };
    });
    
    return Object.values(analytics).sort((a, b) => b.revenue - a.revenue);
  })();

  const laborAnalytics = (() => {
    const roles: Record<string, { count: number; costEstimate: number }> = {};
    const roleSalaries: Record<string, number> = {
      'cashier': 4500,
      'barista': 4000,
      'manager': 8000,
      'admin': 10000,
      'owner': 0,
      'driver': 3500,
      'kitchen': 4000,
      'waiter': 3800
    };
    
    employees.forEach((emp: any) => {
      const role = emp.role || 'other';
      if (!roles[role]) roles[role] = { count: 0, costEstimate: 0 };
      roles[role].count += 1;
      roles[role].costEstimate += roleSalaries[role] || 3500;
    });
    
    const totalMonthlyLaborCost = Object.values(roles).reduce((sum, r) => sum + r.costEstimate, 0);
    
    const getMonthlyProjectedRevenue = () => {
      const daysInPeriod = dateFilter === 'today' ? 1 : 
                          dateFilter === 'week' ? 7 : 
                          dateFilter === 'month' ? 30 : 365;
      return (totalRevenue / daysInPeriod) * 30;
    };
    
    const projectedMonthlyRevenue = getMonthlyProjectedRevenue();
    const laborCostPercent = projectedMonthlyRevenue > 0 ? (totalMonthlyLaborCost / projectedMonthlyRevenue) * 100 : 0;
    
    return {
      byRole: Object.entries(roles).map(([role, data]) => ({
        role: role === 'cashier' ? 'كاشير' : 
              role === 'barista' ? 'باريستا' :
              role === 'manager' ? 'مدير' :
              role === 'admin' ? 'مشرف' :
              role === 'driver' ? 'سائق' :
              role === 'kitchen' ? 'مطبخ' :
              role === 'waiter' ? 'نادل' : role,
        ...data
      })),
      totalCost: totalMonthlyLaborCost,
      laborPercent: laborCostPercent,
      projectedMonthlyRevenue,
      totalEmployees: employees.length,
      avgCostPerEmployee: employees.length > 0 ? totalMonthlyLaborCost / employees.length : 0,
      isMonthlyEstimate: true
    };
  })();

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    setLocation("/employee/gateway");
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="header-gold px-6 py-4 border-b border-sidebar-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-accent title-executive">
                CLUNY CAFE Enterprise
              </h1>
              <p className="text-sm text-slate-400">
                مرحباً، {manager.fullName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
              <SelectTrigger className="w-36 bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                <Calendar className="w-4 h-4 ml-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="year">هذا العام</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/manager/dashboard")}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Settings className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleLogout}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="dashboard-grid">
          <div className="kpi-card card-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-background0 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-slate-900" />
              </div>
              <Badge className="badge-premium badge-gold">
                <TrendingUp className="w-3 h-3" />
                +12.5%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">إجمالي الإيرادات</p>
            <p className="text-2xl font-bold text-foreground">{totalRevenue.toLocaleString('ar-SA')} <span className="text-sm font-normal"><SarIcon /></span></p>
          </div>

          <div className="kpi-card card-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <Badge className="badge-premium badge-success">
                <Activity className="w-3 h-3" />
                مكتمل
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">الإيرادات المحصلة</p>
            <p className="text-2xl font-bold text-foreground">{completedRevenue.toLocaleString('ar-SA')} <span className="text-sm font-normal"><SarIcon /></span></p>
          </div>

          <div className="kpi-card card-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">عدد الطلبات</p>
            <p className="text-2xl font-bold text-foreground">{filteredOrders.length.toLocaleString('ar-SA')}</p>
          </div>

          <div className="kpi-card card-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">متوسط قيمة الطلب</p>
            <p className="text-2xl font-bold text-foreground">{avgOrderValue.toFixed(0)} <span className="text-sm font-normal"><SarIcon /></span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 stat-card-premium">
            <CardHeader className="section-header-executive pb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-accent" />
                <CardTitle className="text-lg title-executive">تحليل الإيرادات</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    formatter={(value: number) => [`${value.toLocaleString('ar-SA')} ر.س`, 'الإيرادات']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#D4AF37" 
                    strokeWidth={2}
                    fill="url(#revenueGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="stat-card-premium">
            <CardHeader className="section-header-executive pb-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-accent" />
                <CardTitle className="text-lg title-executive">طرق الدفع</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toLocaleString('ar-SA')} ر.س`, '']}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="stat-card-premium">
            <CardHeader className="section-header-executive pb-4">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-accent" />
                <CardTitle className="text-lg title-executive">أفضل المنتجات</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                      ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-background0 text-slate-900' : 
                        index === 1 ? 'bg-slate-200 text-slate-700' :
                        index === 2 ? 'bg-accent text-accent' :
                        'bg-slate-100 text-slate-600'}`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.count} طلب</p>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{product.revenue.toLocaleString('ar-SA')} <SarIcon /></p>
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card-premium">
            <CardHeader className="section-header-executive pb-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-accent" />
                <CardTitle className="text-lg title-executive">نظرة سريعة</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-primary dark:border-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-accent" />
                    <span className="text-sm text-accent dark:text-accent">الفروع</span>
                  </div>
                  <p className="text-2xl font-bold text-accent dark:text-accent">{branches.length}</p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">الموظفين</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{employees.length}</p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Coffee className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">طلبات اليوم</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{todayOrders.length}</p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">إيراد اليوم</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{todayRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Comparison Section */}
        <Card className="stat-card-premium">
          <CardHeader className="section-header-executive pb-4">
            <div className="flex items-center gap-3">
              <GitCompare className="w-5 h-5 text-accent" />
              <CardTitle className="text-lg title-executive">مقارنة أداء الفروع</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {branchAnalytics.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={branchAnalytics} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{ 
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toLocaleString('ar-SA')} ر.س`, 'الإيرادات']}
                    />
                    <Bar dataKey="revenue" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                
                <div className="table-premium">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">الفرع</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">الإيرادات</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">الطلبات</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">متوسط الطلب</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">النمو</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchAnalytics.slice(0, 5).map((branch, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{branch.name}</td>
                          <td className="py-3 px-4">{branch.revenue.toLocaleString('ar-SA')} <SarIcon /></td>
                          <td className="py-3 px-4">{branch.orders}</td>
                          <td className="py-3 px-4">{branch.avgOrder.toFixed(0)} <SarIcon /></td>
                          <td className="py-3 px-4">
                            <Badge className={branch.growth >= 0 ? 'badge-premium badge-success' : 'badge-premium badge-danger'}>
                              {branch.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(branch.growth).toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">لا توجد بيانات فروع متاحة</p>
            )}
          </CardContent>
        </Card>

        {/* Labor Cost Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="stat-card-premium">
            <CardHeader className="section-header-executive pb-4">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-accent" />
                <CardTitle className="text-lg title-executive">تحليل تكلفة العمالة</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-primary dark:border-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-accent" />
                    <span className="text-sm text-accent dark:text-accent">التكلفة الشهرية (تقديرية)</span>
                  </div>
                  <p className="text-2xl font-bold text-accent dark:text-accent">
                    {laborAnalytics.totalCost.toLocaleString('ar-SA')} <span className="text-sm font-normal"><SarIcon /></span>
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">نسبة من الإيرادات المتوقعة</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                    {laborAnalytics.laborPercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                    (إيراد شهري متوقع: {laborAnalytics.projectedMonthlyRevenue.toLocaleString('ar-SA')} <SarIcon />)
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={laborAnalytics.byRole}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="role" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ 
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'count' ? `${value} موظف` : `${value.toLocaleString('ar-SA')} ر.س`,
                      name === 'count' ? 'العدد' : 'التكلفة'
                    ]}
                  />
                  <Bar dataKey="costEstimate" fill="#D4AF37" radius={[4, 4, 0, 0]} name="التكلفة" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="stat-card-premium">
            <CardHeader className="section-header-executive pb-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-accent" />
                <CardTitle className="text-lg title-executive">توزيع الموظفين</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">إجمالي الموظفين</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{laborAnalytics.totalEmployees}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">متوسط التكلفة</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                    {laborAnalytics.avgCostPerEmployee.toFixed(0)} <span className="text-sm font-normal"><SarIcon /></span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {laborAnalytics.byRole.map((roleData, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">{roleData.role}</div>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 to-background0 rounded-full"
                        style={{ 
                          width: `${(roleData.count / laborAnalytics.totalEmployees) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="w-16 text-sm text-muted-foreground text-left">{roleData.count} موظف</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            onClick={() => setLocation("/manager/dashboard")}
            className="h-20 btn-premium flex flex-col gap-2"
          >
            <BarChart3 className="w-6 h-6" />
            <span>لوحة التحكم</span>
          </Button>
          <Button 
            onClick={() => setLocation("/employee/pos")}
            variant="outline"
            className="h-20 flex flex-col gap-2 border-primary hover:border-primary hover:bg-background dark:hover:bg-primary/20"
          >
            <Package className="w-6 h-6 text-accent" />
            <span>نقاط البيع</span>
          </Button>
          <Button 
            onClick={() => setLocation("/manager/inventory")}
            variant="outline"
            className="h-20 flex flex-col gap-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          >
            <ChefHat className="w-6 h-6 text-emerald-600" />
            <span>المخزون</span>
          </Button>
          <Button 
            onClick={() => setLocation("/os/accounting")}
            variant="outline"
            className="h-20 flex flex-col gap-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <FileText className="w-6 h-6 text-blue-600" />
            <span>المحاسبة</span>
          </Button>
        </div>
      </div>

      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            CLUNY CAFE Enterprise &copy; {new Date().getFullYear()} - نظام إدارة المقاهي المتكامل
          </p>
        </div>
      </footer>
    </div>
  );
}

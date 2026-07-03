import { useState, useMemo } from 'react';
import { useTranslate } from "@/lib/useTranslate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  ArrowUp, ArrowDown, Download, Printer, TrendingUp, TrendingDown,
  BarChart3, Package, Users, ShoppingBag, RefreshCw, ExternalLink, ChevronRight
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import SarIcon from "@/components/sar-icon";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const COLORS = ['#2D9B6E', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

function getMonthRange(monthOffset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0, 23, 59, 59);
  return { start, end };
}

export default function AdminReports() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [timePeriod, setTimePeriod] = useState('month');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['/api/employees'],
  });

  const { data: coffeeItems = [] } = useQuery<any[]>({
    queryKey: ['/api/coffee-items'],
  });

  const { data: businessConfig, refetch: refetchConfig } = useQuery<any>({
    queryKey: ['/api/business-config'],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await apiRequest('PATCH', '/api/business-config', updates);
      return res.json();
    },
    onSuccess: () => {
      refetchConfig();
      toast({ title: tc("تم تحديث الإعدادات", "Settings updated") });
    }
  });

  // ── Real period calculations ──────────────────────────────────────────────
  const now = new Date();

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd   = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

  const filterOrders = (from: Date, to: Date) =>
    orders.filter((o: any) => {
      const d = new Date(o.createdAt);
      return d >= from && d <= to;
    });

  const currentPeriodOrders = useMemo(() => {
    if (timePeriod === 'week')  return filterOrders(thisWeekStart, now);
    if (timePeriod === 'year')  return filterOrders(thisYearStart, now);
    return filterOrders(thisMonthStart, now);
  }, [orders, timePeriod]);

  const prevPeriodOrders = useMemo(() => {
    if (timePeriod === 'week')  return filterOrders(lastWeekStart, lastWeekEnd);
    if (timePeriod === 'year')  return filterOrders(lastYearStart, lastYearEnd);
    return filterOrders(lastMonthStart, lastMonthEnd);
  }, [orders, timePeriod]);

  const currentRevenue = currentPeriodOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);
  const prevRevenue    = prevPeriodOrders.reduce((s: number, o: any)    => s + Number(o.totalAmount || 0), 0);
  const currentOrderCount = currentPeriodOrders.length;
  const prevOrderCount    = prevPeriodOrders.length;
  const currentAvg = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;
  const prevAvg    = prevOrderCount > 0    ? prevRevenue / prevOrderCount : 0;

  const pctChange = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  const revTrend = pctChange(currentRevenue, prevRevenue);
  const ordTrend = pctChange(currentOrderCount, prevOrderCount);
  const avgTrend = pctChange(currentAvg, prevAvg);

  const periodLabel = timePeriod === 'week'
    ? tc("مقارنة بالأسبوع الماضي", "vs last week")
    : timePeriod === 'year'
      ? tc("مقارنة بالعام الماضي", "vs last year")
      : tc("مقارنة بالشهر الماضي", "vs last month");

  // ── Chart data ────────────────────────────────────────────────────────────
  const revenueData = useMemo(() => {
    const result: any[] = [];
    if (timePeriod === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const dayOrders = orders.filter((o: any) => {
          const od = new Date(o.createdAt);
          return od >= d && od < next;
        });
        result.push({
          date: d.toLocaleDateString('ar-SA', { weekday: 'short' }),
          revenue: Math.round(dayOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0)),
          orders: dayOrders.length,
        });
      }
    } else if (timePeriod === 'month') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        if (d.getDate() % 5 === 1 || i === 0) {
          const dayOrders = orders.filter((o: any) => {
            const od = new Date(o.createdAt);
            return od >= d && od < next;
          });
          result.push({
            date: `${d.getDate()}/${d.getMonth() + 1}`,
            revenue: Math.round(dayOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0)),
            orders: dayOrders.length,
          });
        }
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const monthOrders = orders.filter((o: any) => {
          const od = new Date(o.createdAt);
          return od >= d && od < next;
        });
        result.push({
          date: d.toLocaleDateString('ar-SA', { month: 'short' }),
          revenue: Math.round(monthOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0)),
          orders: monthOrders.length,
        });
      }
    }
    return result;
  }, [orders, timePeriod]);

  const topProducts = useMemo(() => {
    const map: any = {};
    currentPeriodOrders.forEach((order: any) => {
      (order.items || []).forEach((item: any) => {
        const key = item.coffeeItemId || item.id || item.nameAr;
        const product = coffeeItems.find((c: any) => c.id === key);
        const name = product?.nameAr || item.nameAr || item.name || key;
        if (!map[key]) map[key] = { name, sold: 0, revenue: 0 };
        map[key].sold += item.quantity || 1;
        map[key].revenue += item.totalPrice || (item.quantity || 1) * (item.price || product?.price || 0);
      });
    });
    return Object.values(map).sort((a: any, b: any) => b.sold - a.sold).slice(0, 8) as any[];
  }, [currentPeriodOrders, coffeeItems]);

  const employeePerf = useMemo(() => {
    const map: any = {};
    currentPeriodOrders.forEach((order: any) => {
      const emp = employees.find((e: any) => e.id === order.employeeId);
      if (!emp) return;
      const key = emp.id;
      if (!map[key]) map[key] = { name: emp.fullName, orders: 0, revenue: 0 };
      map[key].orders++;
      map[key].revenue += Number(order.totalAmount || 0);
    });
    return Object.values(map).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 8) as any[];
  }, [currentPeriodOrders, employees]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBulkPrint = async () => {
    if (selectedOrders.length === 0) return;
    const res = await apiRequest('POST', '/api/orders/bulk-print-employee', { orderIds: selectedOrders });
    const bulkOrders = await res.json();
    const { printBulkEmployeeInvoices } = await import('@/lib/print-utils');
    printBulkEmployeeInvoices(bulkOrders);
  };

  const handlePrintDailySummary = async () => {
      const { brand } = await import('@/lib/brand');
      const { buildGenericReportEscPos, thermalPrint, loadPrinterSettings } = await import('@/lib/thermal-printer');
      const nowSaudi = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const todayStr = nowSaudi.toISOString().slice(0, 10);
      const todayOrders = orders.filter((o: any) => {
        const d = new Date(new Date(o.createdAt).getTime() + 3 * 60 * 60 * 1000);
        return d.toISOString().slice(0, 10) === todayStr && o.status !== 'cancelled';
      });
      if (todayOrders.length === 0) {
        toast({ title: tc("لا توجد طلبات اليوم", "No orders today"), variant: "destructive" });
        return;
      }
      const rev = todayOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);
      const vat = rev - rev / 1.15;
      const net = rev / 1.15;
      const pd = nowSaudi.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const pt = nowSaudi.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const payLabels: Record<string, string> = { cash: 'نقدي', pos: 'نقاط البيع', stc: 'STC', geidea: 'جهاز', delivery: 'توصيل', alinma: 'الإنماء', ur: 'يور باي', barq: 'برق', rajhi: 'الراجحي', 'qahwa-card': 'بطاقة قهوة' };
      const settings = loadPrinterSettings();
      const paperWidth = settings.paperWidth || '80mm';

      const esc = await buildGenericReportEscPos({
        shopName: brand.nameAr,
        reportTitle: 'موجز أرباح وطلبات اليوم',
        dateLabel: pd,
        periodLabel: `وقت الطباعة: ${pt}`,
        kpis: [
          { label: 'إجمالي الطلبات:', value: `${todayOrders.length} طلب` },
          { label: 'صافي المبيعات (بدون ضريبة):', value: `${net.toFixed(2)} ر.س` },
          { label: 'ضريبة القيمة المضافة (15%):', value: `${vat.toFixed(2)} ر.س` },
          { label: 'إجمالي الإيرادات:', value: `${rev.toFixed(2)} ر.س`, bold: true },
        ],
        sections: [
          {
            title: 'تفصيل الطلبات',
            rows: todayOrders.map((o: any, i: number) => {
              const time = new Date(new Date(o.createdAt).getTime() + 3 * 60 * 60 * 1000).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
              const pay = payLabels[o.paymentMethod] || o.paymentMethod || '';
              return {
                label: `#${o.orderNumber || i + 1} — ${time} — ${pay}`,
                value: `${Number(o.totalAmount || 0).toFixed(2)} ر.س`,
              };
            }),
          },
        ],
        paperWidth,
      });

      const result = await thermalPrint(esc, '', paperWidth);
      if (!result.success) {
        toast({ title: tc('فشل الطباعة', 'Print failed'), description: result.error, variant: 'destructive' });
      }
  };

  // ── Trend badge ───────────────────────────────────────────────────────────
  const TrendBadge = ({ pct }: { pct: number }) => (
    <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      {pct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      <span>{Math.abs(pct)}% {periodLabel}</span>
    </div>
  );

  const StatCard = ({ label, value, icon: Icon, trend, color, sub }: any) => (
    <Card className="border border-border bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {trend !== undefined && <TrendBadge pct={trend} />}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-background min-h-screen" dir={tc('rtl', 'ltr')}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{tc("التقارير والتحليلات", "Reports & Analytics")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{tc("تحليل حقيقي لأداء المبيعات والعمليات", "Real analysis of sales performance")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Card className="flex items-center gap-3 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">{tc("فاتورة الموظف", "Employee Invoice")}</span>
            <input
              type="checkbox"
              checked={businessConfig?.employeeInvoiceEnabled || false}
              onChange={(e) => updateConfigMutation.mutate({ employeeInvoiceEnabled: e.target.checked })}
              className="w-4 h-4 cursor-pointer accent-primary"
            />
          </Card>
          <Button variant="outline" size="sm" onClick={handlePrintDailySummary} data-testid="button-print-daily">
            <Printer className="w-4 h-4 ml-1" />
            <span className="hidden sm:inline">{tc("طباعة موجز اليوم", "Print Today")}</span>
            <span className="sm:hidden">{tc("طباعة", "Print")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/manager/product-reports')} data-testid="button-product-reports">
            <BarChart3 className="w-4 h-4 ml-1" />
            <span>{tc("تقارير المنتجات", "Product Reports")}</span>
            <ExternalLink className="w-3 h-3 mr-1" />
          </Button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedOrders.length > 0 && (
        <Card className="p-3 bg-primary/5 border-primary/20 flex justify-between items-center">
          <span className="font-medium text-sm">{selectedOrders.length} {tc("طلبات مختارة", "orders selected")}</span>
          <Button onClick={handleBulkPrint} size="sm">
            <Printer className="w-4 h-4 ml-1" />
            {tc("طباعة فواتير الموظفين", "Print Employee Invoices")}
          </Button>
        </Card>
      )}

      {/* Period filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-44" data-testid="select-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{tc("هذا الأسبوع", "This Week")}</SelectItem>
            <SelectItem value="month">{tc("هذا الشهر", "This Month")}</SelectItem>
            <SelectItem value="year">{tc("هذا العام", "This Year")}</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">
          {currentPeriodOrders.length} {tc("طلب في الفترة", "orders in period")}
        </Badge>
        {isLoading && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {tc("جارٍ التحميل...", "Loading...")}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={tc("إيرادات الفترة", "Period Revenue")}
          value={<span className="flex items-center gap-1">{currentRevenue.toFixed(0)} <SarIcon /></span>}
          icon={TrendingUp}
          trend={revTrend}
          color="#2D9B6E"
          sub={prevRevenue > 0 ? `${tc("الفترة السابقة", "Prev")}: ${prevRevenue.toFixed(0)} ر.س` : undefined}
        />
        <StatCard
          label={tc("عدد الطلبات", "Orders Count")}
          value={currentOrderCount}
          icon={ShoppingBag}
          trend={ordTrend}
          color="#3b82f6"
          sub={prevOrderCount > 0 ? `${tc("الفترة السابقة", "Prev")}: ${prevOrderCount}` : undefined}
        />
        <StatCard
          label={tc("متوسط الطلب", "Avg Order")}
          value={<span className="flex items-center gap-1">{currentAvg.toFixed(1)} <SarIcon /></span>}
          icon={BarChart3}
          trend={avgTrend}
          color="#f59e0b"
          sub={prevAvg > 0 ? `${tc("الفترة السابقة", "Prev")}: ${prevAvg.toFixed(1)} ر.س` : undefined}
        />
        <StatCard
          label={tc("الموظفون النشطون", "Active Employees")}
          value={employees.filter((e: any) => e.isActivated === 1).length}
          icon={Users}
          color="#8b5cf6"
          sub={`${tc("من", "of")} ${employees.length} ${tc("إجمالاً", "total")}`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {tc("اتجاه الإيرادات", "Revenue Trend")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 11 }}
                  formatter={(v: any) => [`${v} ر.س`, tc("إيراد", "Revenue")]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#2D9B6E" strokeWidth={2.5} dot={{ fill: '#2D9B6E', r: 3 }} name={tc("الإيرادات", "Revenue")} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-500" />
              {tc("عدد الطلبات اليومية", "Daily Orders")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 11 }}
                  formatter={(v: any) => [v, tc("طلبات", "Orders")]}
                />
                <Bar dataKey="orders" fill="#3b82f6" name={tc("الطلبات", "Orders")} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Employee Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                {tc("أفضل المنتجات مبيعاً", "Top Selling Products")}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/manager/product-reports')} className="text-xs text-primary gap-1">
                {tc("تفصيلي", "Details")} <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {topProducts.length > 0 ? (
              <div className="space-y-2">
                {topProducts.slice(0, 6).map((p: any, i: number) => {
                  const maxSold = topProducts[0]?.sold || 1;
                  const pct = Math.round((p.sold / maxSold) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-foreground truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground mr-2">{p.sold} {tc("قطعة", "pcs")}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{Math.round(p.revenue)} ر.س</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">{tc("لا توجد مبيعات في هذه الفترة", "No sales in this period")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-pink-500" />
              {tc("أداء الموظفين", "Employee Performance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {employeePerf.length > 0 ? (
              <div className="space-y-2">
                {employeePerf.map((emp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] text-primary font-bold">{(emp.name || '?')[0]}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.orders} {tc("طلب", "orders")}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-primary flex items-center gap-1">
                      {Math.round(emp.revenue)} <SarIcon size={12} />
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">{tc("لا يوجد بيانات في هذه الفترة", "No data in this period")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed orders table */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">{tc("تفاصيل الطلبات الأخيرة", "Recent Orders Details")}</CardTitle>
            {selectedOrders.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedOrders.length} {tc("محدد", "selected")}</span>
                <Button size="sm" onClick={handleBulkPrint}>
                  <Printer className="w-3.5 h-3.5 ml-1" />
                  {tc("طباعة", "Print")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedOrders([])}>
                  {tc("إلغاء", "Cancel")}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedOrders(orders.slice(-20).map((o: any) => o.id));
                        else setSelectedOrders([]);
                      }}
                    />
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground">{tc("رقم الطلب", "Order #")}</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground">{tc("العميل", "Customer")}</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">{tc("الموظف", "Employee")}</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground">{tc("المبلغ", "Amount")}</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">{tc("التاريخ", "Date")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(-20).reverse().map((order: any) => {
                  const emp = employees.find((e: any) => e.id === order.employeeId);
                  return (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5"
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]);
                            else setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                          }}
                        />
                      </td>
                      <td className="p-3 text-xs font-medium">#{order.orderNumber || order.dailyNumber || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{order.customerInfo?.name || tc('زائر', 'Guest')}</td>
                      <td className="p-3 text-xs hidden md:table-cell">{emp?.fullName || '—'}</td>
                      <td className="p-3 text-xs font-bold text-primary flex items-center gap-1">
                        {Number(order.totalAmount || 0).toFixed(2)} <SarIcon size={11} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders.length === 0 && !isLoading && (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">{tc("لا توجد طلبات بعد", "No orders yet")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

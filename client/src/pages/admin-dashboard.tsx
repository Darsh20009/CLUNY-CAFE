import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, TrendingUp, DollarSign, Settings, ShoppingBag,
  BarChart2, CreditCard, Banknote, SplitSquareVertical, Calendar, RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import SarIcon from "@/components/sar-icon";

// IMPORTANT: `period` values map to Saudi-aware date ranges on the server
// (see /api/orders/analytics). Anything else falls back to from/to ISO strings.
const PERIOD_OPTIONS: Array<{ label: string; days: number; period?: string }> = [
  { label: 'اليوم', days: 0, period: 'today' },
  { label: 'أمس', days: 1, period: 'yesterday' },
  { label: '7 أيام', days: 7 },
  { label: '30 يوم', days: 30 },
  { label: '90 يوم', days: 90 },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'كاش', card: 'شبكة', split: 'مجزأ',
  pos: 'POS', mada: 'مدى', geidea: 'جيدية',
  apple_pay: 'Apple Pay', loyalty_points: 'ولاء', other: 'أخرى',
};

const COLORS = ['#b45309', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

function fmt(n: number) { return n.toLocaleString('ar-SA', { maximumFractionDigits: 1 }); }
function dayLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [periodIdx, setPeriodIdx] = useState(2); // 7 days default
  const [refreshKey, setRefreshKey] = useState(0);

  const { days, period } = PERIOD_OPTIONS[periodIdx];
  // For the "today" / "yesterday" buckets we hand the server a Saudi-aware
  // `period` so the date math matches the Accounting Dashboard exactly. For
  // longer ranges (7/30/90 days) we still send from/to as ISO timestamps.
  const { from, to } = useMemo(() => {
    if (period) return { from: '', to: '' };
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }, [days, period]);

  const { data: analytics, isLoading, refetch } = useQuery<any>({
    queryKey: ['/api/orders/analytics', period || '', from, to, refreshKey],
    queryFn: () => {
      const url = period
        ? `/api/orders/analytics?period=${encodeURIComponent(period)}`
        : `/api/orders/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      return fetch(url).then(r => r.json());
    },
    staleTime: 60_000,
  });

  const { data: employees = [] } = useQuery<any[]>({ queryKey: ['/api/employees'] });
  const activeEmployees = employees.filter((e: any) => e.isActivated === 1).length;

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const totalOrders = analytics?.totalOrders ?? 0;
  const avgOrder = analytics?.avgOrderValue ?? 0;
  const topProducts = analytics?.topProducts ?? [];
  const revenueByDay = (analytics?.revenueByDay ?? []).map((d: any) => ({ ...d, label: dayLabel(d.date) }));
  const payBreakdown = analytics?.paymentBreakdown ?? [];
  const topProduct = topProducts[0]?.name ?? '—';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-0.5">تحليلات المبيعات والأداء</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setRefreshKey(k => k + 1); refetch(); }} data-testid="button-refresh-analytics">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/settings')} data-testid="button-admin-settings">
            <Settings className="w-4 h-4 ml-2" />الإعدادات
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 flex-wrap" data-testid="filter-period">
        {PERIOD_OPTIONS.map((opt, i) => (
          <Button
            key={i}
            size="sm"
            variant={periodIdx === i ? 'default' : 'outline'}
            onClick={() => setPeriodIdx(i)}
            data-testid={`button-period-${opt.label}`}
          >
            <Calendar className="w-3 h-3 ml-1" />
            {opt.label}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: DollarSign, label: 'الإيرادات', value: `${fmt(totalRevenue)} ر.س`, sub: `${PERIOD_OPTIONS[periodIdx].label}`, color: 'text-emerald-600' },
          { icon: ShoppingBag, label: 'عدد الطلبات', value: fmt(totalOrders), sub: `${PERIOD_OPTIONS[periodIdx].label}`, color: 'text-blue-600' },
          { icon: TrendingUp, label: 'متوسط الطلب', value: `${fmt(avgOrder)} ر.س`, sub: 'لكل طلب', color: 'text-amber-600' },
          { icon: BarChart2, label: 'الأكثر مبيعاً', value: topProduct, sub: `${topProducts[0]?.quantity ?? 0} قطعة`, color: 'text-primary' },
        ].map(({ icon: Icon, label, value, sub, color }, i) => (
          <Card key={i} className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-lg sm:text-xl font-black truncate ${color}`} data-testid={`kpi-${label}`}>{isLoading ? '...' : value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
                <div className="shrink-0 rounded-lg bg-muted/50 p-2">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            الإيرادات بالتفصيل
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueByDay} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: 'Cairo' }} />
                <YAxis tick={{ fontSize: 10 }} width={45} />
                <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)} ر.س`, 'الإيراد']} labelStyle={{ fontFamily: 'Cairo' }} contentStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {revenueByDay.map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-36 flex items-center justify-center text-muted-foreground text-sm">
              {isLoading ? 'جاري التحميل...' : 'لا توجد بيانات للفترة المحددة'}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              أكثر المنتجات طلباً
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {topProducts.length > 0 ? (
              <div className="space-y-2">
                {topProducts.slice(0, 8).map((p: any, i: number) => {
                  const maxQty = topProducts[0]?.quantity || 1;
                  const pct = Math.round((p.quantity / maxQty) * 100);
                  return (
                    <div key={i} className="space-y-0.5" data-testid={`row-product-${i}`}>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium truncate flex-1 ml-2">{p.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px] h-4">{p.quantity} قطعة</Badge>
                          <span className="font-bold text-primary text-[10px]">{fmt(p.revenue)} <SarIcon /></span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isLoading ? 'جاري التحميل...' : 'لا توجد بيانات'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              توزيع طرق الدفع
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {payBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={payBreakdown.map((p: any) => ({ ...p, label: PAYMENT_LABELS[p.method] || p.method }))} layout="vertical" margin={{ left: 40, right: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fontFamily: 'Cairo' }} width={40} />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)} ر.س`]} contentStyle={{ fontFamily: 'Cairo', fontSize: 11 }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {payBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {payBreakdown.sort((a: any, b: any) => b.revenue - a.revenue).map((p: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs bg-muted/40 rounded-lg px-3 py-1.5">
                      <span className="flex items-center gap-1.5">
                        {p.method === 'cash' ? <Banknote className="w-3 h-3 text-green-600" /> :
                         p.method === 'split' ? <SplitSquareVertical className="w-3 h-3 text-purple-600" /> :
                         <CreditCard className="w-3 h-3 text-blue-600" />}
                        <span className="font-medium">{PAYMENT_LABELS[p.method] || p.method}</span>
                      </span>
                      <span className="font-bold">{fmt(p.revenue)} ر.س</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isLoading ? 'جاري التحميل...' : 'لا توجد بيانات'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff Quick Stats */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              الموظفون
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/employees')}>عرض الكل</Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 p-3">
              <p className="text-xs text-muted-foreground">إجمالي الموظفين</p>
              <p className="text-2xl font-black text-blue-600">{employees.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <p className="text-xs text-muted-foreground">الموظفون النشطون</p>
              <p className="text-2xl font-black text-emerald-600">{activeEmployees}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-xs text-muted-foreground">غير نشط</p>
              <p className="text-2xl font-black text-amber-600">{employees.length - activeEmployees}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'إدارة الموظفين', path: '/admin/employees', icon: Users },
          { label: 'التقارير التفصيلية', path: '/admin/reports', icon: TrendingUp },
          { label: 'الإعدادات', path: '/admin/settings', icon: Settings },
        ].map(({ label, path, icon: Icon }) => (
          <Button key={path} variant="outline" className="h-12 gap-2 justify-start" onClick={() => navigate(path)} data-testid={`button-quick-${label}`}>
            <Icon className="w-4 h-4" />
            <span className="font-medium text-sm">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

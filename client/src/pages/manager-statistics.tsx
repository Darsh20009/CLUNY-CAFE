import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/states";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users,
  Activity, Clock, Package, BarChart3, Calendar, Receipt, Coffee
} from "lucide-react";
import {
  AreaChart, Area, BarChart as RechartsBar, Bar,
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";
import type { Order, Employee, Customer } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import { getSaudiDaysAgoBounds, getSaudiTodayRange, getSaudiLastNDaysRange, getSaudiHour, getSaudiDateString } from "@/lib/saudi-time";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type DateRange = "today" | "yesterday" | "week" | "month" | "all";

export default function ManagerStatistics() {
  const [, setLocation] = useLocation();
  const [manager, setManager] = useState<Employee | null>(null);
  const [range, setRange] = useState<DateRange>("today");

  useEffect(() => {
    document.title = "الإحصائيات الدقيقة - CLUNY CAFE";
    const stored = localStorage.getItem("currentEmployee");
    if (!stored) {
      setLocation("/manager/login");
      return;
    }
    const emp = JSON.parse(stored);
    if (emp.role !== "manager" && emp.role !== "admin" && emp.role !== "owner") {
      setLocation("/employee/dashboard");
      return;
    }
    setManager(emp);
  }, [setLocation]);

  const isAdmin = manager?.role === "admin" || manager?.role === "owner";
  const branchId = manager?.branchId;

  const { data: allOrders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!manager,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: !!manager,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: !!manager,
  });

  const orders = useMemo(
    () => isAdmin ? allOrders : allOrders.filter(o => o.branchId === branchId),
    [allOrders, isAdmin, branchId]
  );

  const { current, previous, periodLabel } = useMemo(() => {
    // All ranges are computed in Asia/Riyadh time so this page agrees with
    // the Accounting Dashboard. Mixing browser local time and Saudi time is
    // what was making the totals look "inverted" between the two pages.
    let start: Date, end: Date, prevStart: Date, prevEnd: Date, label: string;
    switch (range) {
      case "today": {
        const t = getSaudiTodayRange();
        start = t.start; end = t.end;
        const y = getSaudiDaysAgoBounds(1);
        prevStart = y.start; prevEnd = y.end;
        label = "اليوم";
        break;
      }
      case "yesterday": {
        const y = getSaudiDaysAgoBounds(1);
        start = y.start; end = y.end;
        const dby = getSaudiDaysAgoBounds(2);
        prevStart = dby.start; prevEnd = dby.end;
        label = "أمس";
        break;
      }
      case "week": {
        const w = getSaudiLastNDaysRange(7);
        start = w.start; end = w.end;
        const pw = getSaudiDaysAgoBounds(13);
        prevStart = pw.start;
        prevEnd = getSaudiDaysAgoBounds(7).end;
        label = "آخر 7 أيام";
        break;
      }
      case "month": {
        const m = getSaudiLastNDaysRange(30);
        start = m.start; end = m.end;
        prevStart = getSaudiDaysAgoBounds(59).start;
        prevEnd = getSaudiDaysAgoBounds(30).end;
        label = "آخر 30 يوم";
        break;
      }
      default: {
        end = new Date(); start = new Date(0);
        prevEnd = start; prevStart = new Date(0);
        label = "كل الفترة";
      }
    }
    const inRange = (d: Date, s: Date, e: Date) => d >= s && d <= e;
    const cur = orders.filter(o => {
      if (o.status === "cancelled") return false;
      if (!o.createdAt) return range === "all";
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return false;
      return inRange(d, start, end);
    });
    const prv = orders.filter(o => {
      if (o.status === "cancelled") return false;
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return false;
      return inRange(d, prevStart, prevEnd);
    });
    return { current: cur, previous: prv, periodLabel: label };
  }, [orders, range]);

  const stats = useMemo(() => {
    const revenue = current.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const completed = current.filter(o => o.status === "completed");
    const pending = current.filter(o => ["new","pending","preparing","in_progress","ready"].includes(String(o.status)));
    const completedRevenue = completed.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const aov = current.length > 0 ? revenue / current.length : 0;
    const itemsSold = current.reduce((sum, o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      return sum + items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
    }, 0);
    const uniqueCustomers = new Set(current.map(o => o.customerInfo?.phone || o.customerId).filter(Boolean)).size;

    const prevRevenue = previous.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : (revenue > 0 ? 100 : 0);
    const ordersGrowth = previous.length > 0 ? ((current.length - previous.length) / previous.length) * 100 : (current.length > 0 ? 100 : 0);

    return {
      revenue, completedRevenue, completed: completed.length, pending: pending.length,
      total: current.length, aov, itemsSold, uniqueCustomers,
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      ordersGrowth: Number(ordersGrowth.toFixed(1)),
    };
  }, [current, previous]);

  const hourlyData = useMemo(() => {
    const hours: Record<number, { count: number; revenue: number }> = {};
    for (let i = 0; i < 24; i++) hours[i] = { count: 0, revenue: 0 };
    current.forEach(o => {
      if (!o.createdAt) return;
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return;
      // Bucket by Saudi hour-of-day so the curve matches what staff see at the till.
      const h = getSaudiHour(d);
      hours[h].count++;
      hours[h].revenue += Number(o.totalAmount || 0);
    });
    return Object.entries(hours).map(([h, v]) => ({
      hour: `${h}:00`,
      count: v.count,
      revenue: Number(v.revenue.toFixed(2)),
    }));
  }, [current]);

  const dailyTrend = useMemo(() => {
    const days: Record<string, { revenue: number; count: number }> = {};
    current.forEach(o => {
      if (!o.createdAt) return;
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return;
      // Use Saudi date string (YYYY-MM-DD) as the key so days don't get split
      // across the midnight UTC boundary.
      const k = getSaudiDateString(d);
      if (!days[k]) days[k] = { revenue: 0, count: 0 };
      days[k].revenue += Number(o.totalAmount || 0);
      days[k].count++;
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, v]) => {
        const [, m, day] = iso.split("-");
        return {
          date: `${parseInt(day)}/${parseInt(m)}`,
          revenue: Number(v.revenue.toFixed(2)),
          count: v.count,
        };
      })
      .slice(-30);
  }, [current]);

  const topItems = useMemo(() => {
    const items: Record<string, { count: number; revenue: number }> = {};
    current.forEach(o => {
      const list = Array.isArray(o.items) ? o.items : [];
      list.forEach((it: any) => {
        const name = it.coffeeItem?.nameAr || it.nameAr || it.name || "منتج";
        if (!items[name]) items[name] = { count: 0, revenue: 0 };
        items[name].count += Number(it.quantity || 0);
        items[name].revenue += Number(it.quantity || 0) * Number(it.price || it.coffeeItem?.price || 0);
      });
    });
    return Object.entries(items).map(([name, v]) => ({
      name, count: v.count, revenue: Number(v.revenue.toFixed(2)),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [current]);

  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    current.forEach(o => {
      const k = o.paymentMethod || "غير محدد";
      map[k] = (map[k] || 0) + Number(o.totalAmount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name === "cash" ? "نقدي" : name === "card" ? "بطاقة" : name === "geidea" ? "Geidea" : name,
      value: Number(value.toFixed(2)),
    }));
  }, [current]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    current.forEach(o => {
      const k = String(o.status || "غير محدد");
      map[k] = (map[k] || 0) + 1;
    });
    const labels: Record<string, string> = {
      completed: "مكتمل", new: "جديد", pending: "قيد الانتظار",
      preparing: "قيد التحضير", in_progress: "قيد التنفيذ",
      ready: "جاهز", cancelled: "ملغي", payment_confirmed: "مدفوع",
    };
    return Object.entries(map).map(([name, value]) => ({
      name: labels[name] || name, value,
    }));
  }, [current]);

  const topEmployees = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    current.forEach(o => {
      const id = String(o.employeeId || "");
      if (!id) return;
      if (!map[id]) map[id] = { count: 0, revenue: 0 };
      map[id].count++;
      map[id].revenue += Number(o.totalAmount || 0);
    });
    return Object.entries(map).map(([id, v]) => {
      const emp = employees.find(e => String(e.id) === id);
      return {
        name: emp?.fullName || "موظف",
        role: emp?.role || "",
        count: v.count,
        revenue: Number(v.revenue.toFixed(2)),
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [current, employees]);

  if (!manager) return <LoadingState message="جاري التحميل..." />;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24 sm:pb-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <header className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-primary">الإحصائيات الدقيقة</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  تحديث مباشر • {periodLabel}
                  <span className="inline-flex items-center gap-1 mr-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-600 dark:text-green-500">مباشر</span>
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={range} onValueChange={(v: any) => setRange(v)}>
                <SelectTrigger className="w-32 sm:w-40 bg-card" data-testid="select-range">
                  <Calendar className="w-4 h-4 ml-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="yesterday">أمس</SelectItem>
                  <SelectItem value="week">آخر 7 أيام</SelectItem>
                  <SelectItem value="month">آخر 30 يوم</SelectItem>
                  <SelectItem value="all">كل الفترة</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setLocation("/manager/dashboard")} data-testid="button-back">
                <ArrowLeft className="w-4 h-4 ml-1" />
                رجوع
              </Button>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            title="إجمالي المبيعات"
            value={stats.revenue.toFixed(2)}
            suffix={<SarIcon />}
            icon={DollarSign}
            growth={stats.revenueGrowth}
            color="primary"
            testId="kpi-revenue"
          />
          <KpiCard
            title="عدد الطلبات"
            value={stats.total.toString()}
            badge={`${stats.completed} مكتمل`}
            icon={ShoppingBag}
            growth={stats.ordersGrowth}
            color="accent"
            testId="kpi-orders"
          />
          <KpiCard
            title="متوسط الطلب"
            value={stats.aov.toFixed(2)}
            suffix={<SarIcon />}
            icon={Activity}
            color="primary"
            testId="kpi-aov"
          />
          <KpiCard
            title="عدد المنتجات المباعة"
            value={stats.itemsSold.toString()}
            icon={Package}
            color="accent"
            testId="kpi-items"
          />
          <KpiCard
            title="عملاء فريدون"
            value={stats.uniqueCustomers.toString()}
            icon={Users}
            color="primary"
            testId="kpi-customers"
          />
          <KpiCard
            title="طلبات قيد التنفيذ"
            value={stats.pending.toString()}
            icon={Clock}
            color="accent"
            testId="kpi-pending"
          />
          <KpiCard
            title="إيرادات مكتملة"
            value={stats.completedRevenue.toFixed(2)}
            suffix={<SarIcon />}
            icon={Receipt}
            color="primary"
            testId="kpi-completed-revenue"
          />
          <KpiCard
            title="إجمالي العملاء"
            value={customers.length.toString()}
            icon={Users}
            color="accent"
            testId="kpi-total-customers"
          />
        </div>

        {/* Daily / Hourly Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">المبيعات اليومية</CardTitle>
              <CardDescription className="text-xs">تطور الإيرادات خلال الفترة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-72">
                {dailyTrend.length === 0 ? (
                  <EmptyChart label="لا توجد بيانات" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrend}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">توزيع الطلبات على ساعات اليوم</CardTitle>
              <CardDescription className="text-xs">أكثر الساعات ازدحاماً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-72">
                {current.length === 0 ? (
                  <EmptyChart label="لا توجد بيانات" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBar data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                    </RechartsBar>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Items + Pie charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between gap-2">
                <span>مبيعات جميع المنتجات</span>
                <Badge variant="secondary" className="text-xs" data-testid="badge-products-count">{topItems.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topItems.length === 0 ? (
                <EmptyChart label="لا توجد منتجات" />
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {topItems.map((item, idx) => {
                    const max = topItems[0]?.revenue || 1;
                    const pct = (item.revenue / max) * 100;
                    return (
                      <div key={item.name} className="space-y-1" data-testid={`top-item-${idx}`}>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                              {idx + 1}
                            </div>
                            <span className="font-medium truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                            <span className="font-bold text-primary tabular-nums">
                              {item.revenue.toFixed(2)} <SarIcon />
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">طرق الدفع</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                {paymentBreakdown.length === 0 ? (
                  <EmptyChart label="لا توجد بيانات" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentBreakdown}
                        cx="50%" cy="50%"
                        outerRadius={70}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                        label={(entry: any) => `${entry.name}`}
                      >
                        {paymentBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status + Top employees */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">حالات الطلبات</CardTitle>
            </CardHeader>
            <CardContent>
              {statusBreakdown.length === 0 ? (
                <EmptyChart label="لا توجد بيانات" />
              ) : (
                <div className="space-y-2">
                  {statusBreakdown.map((s, idx) => {
                    const total = statusBreakdown.reduce((a, b) => a + b.value, 0);
                    const pct = total > 0 ? (s.value / total) * 100 : 0;
                    return (
                      <div key={s.name} className="space-y-1" data-testid={`status-${idx}`}>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-medium">{s.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{s.value}</Badge>
                            <span className="text-muted-foreground tabular-nums w-12 text-left">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[idx % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">أعلى الموظفين أداءً</CardTitle>
            </CardHeader>
            <CardContent>
              {topEmployees.length === 0 ? (
                <EmptyChart label="لا يوجد بيانات" />
              ) : (
                <div className="space-y-2">
                  {topEmployees.map((emp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/40 hover-elevate"
                      data-testid={`top-employee-${idx}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">{emp.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">{emp.role}</p>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="font-bold text-primary text-xs sm:text-sm tabular-nums">
                          {emp.revenue.toFixed(2)} <SarIcon />
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{emp.count} طلب</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {ordersLoading && (
          <p className="text-center text-xs text-muted-foreground">جاري تحميل البيانات...</p>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  title, value, suffix, icon: Icon, growth, badge, color = "primary", testId,
}: {
  title: string;
  value: string;
  suffix?: React.ReactNode;
  icon: any;
  growth?: number;
  badge?: string;
  color?: "primary" | "accent";
  testId?: string;
}) {
  const colorClass = color === "primary" ? "bg-primary/10 text-primary" : "bg-accent/20 text-accent-foreground";
  const barColor = color === "primary" ? "bg-primary" : "bg-accent";
  return (
    <Card className="rounded-xl overflow-hidden" data-testid={testId}>
      <div className={`h-1 ${barColor}`} />
      <CardHeader className="pb-1 pt-3 sm:pt-4 px-3 sm:px-6">
        <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
        <div className="text-xl sm:text-3xl font-bold text-foreground tabular-nums break-all">
          {value} {suffix && <span className="text-xs sm:text-sm">{suffix}</span>}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {badge && <Badge variant="secondary" className="text-[10px] sm:text-xs">{badge}</Badge>}
          {typeof growth === "number" && growth !== 0 && (
            <Badge variant={growth > 0 ? "default" : "destructive"} className="text-[10px] sm:text-xs">
              {growth > 0 ? <TrendingUp className="w-3 h-3 ml-1" /> : <TrendingDown className="w-3 h-3 ml-1" />}
              {growth > 0 ? "+" : ""}{growth}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
      <Coffee className="w-8 h-8 opacity-30" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

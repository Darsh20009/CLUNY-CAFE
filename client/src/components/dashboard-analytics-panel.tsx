import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import {
  TrendingUp, Package, ShoppingCart, Wallet,
  BarChart3, ArrowUpRight, ArrowDownRight, Star, Percent, Calendar
} from "lucide-react";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
import { getQueryFn } from "@/lib/queryClient";

interface Props {
  branchId?: string;
}

const COLORS = ["#2D9B6E", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6", "#a855f7", "#ef4444", "#84cc16", "#f43f5e", "#0ea5e9", "#d946ef", "#fb923c"];

type Shortcut = "today" | "yesterday" | "thisweek" | "lastweek" | "thismonth" | "lastmonth";

const SHORTCUTS: { key: Shortcut; labelAr: string; labelEn: string }[] = [
  { key: "today",     labelAr: "اليوم",      labelEn: "Today" },
  { key: "yesterday", labelAr: "أمس",        labelEn: "Yesterday" },
  { key: "thisweek",  labelAr: "هذا الأسبوع", labelEn: "This Week" },
  { key: "lastweek",  labelAr: "الأسبوع الماضي", labelEn: "Last Week" },
  { key: "thismonth", labelAr: "هذا الشهر",  labelEn: "This Month" },
  { key: "lastmonth", labelAr: "الشهر الماضي", labelEn: "Last Month" },
];

function getDateRange(shortcut: Shortcut): { from: string; to: string; period: string } {
  const dayStartHour = parseInt(localStorage.getItem("qirox_day_start_hour") || "0", 10);
  const now = new Date();
  const tz = "Asia/Riyadh";

  const todaySaudi = new Date(new Date().toLocaleDateString("en-CA", { timeZone: tz }));
  const todayStr = todaySaudi.toISOString().split("T")[0];

  const addDays = (d: Date, n: number) => {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  };
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  if (shortcut === "today") {
    return { from: todayStr, to: todayStr, period: "today" };
  }
  if (shortcut === "yesterday") {
    const y = fmt(addDays(todaySaudi, -1));
    return { from: y, to: y, period: "yesterday" };
  }
  if (shortcut === "thisweek") {
    const dow = todaySaudi.getDay(); // 0=Sun
    const start = addDays(todaySaudi, -dow);
    return { from: fmt(start), to: todayStr, period: "week" };
  }
  if (shortcut === "lastweek") {
    const dow = todaySaudi.getDay();
    const thisStart = addDays(todaySaudi, -dow);
    const lastStart = addDays(thisStart, -7);
    const lastEnd = addDays(thisStart, -1);
    return { from: fmt(lastStart), to: fmt(lastEnd), period: "lastweek" };
  }
  if (shortcut === "thismonth") {
    const start = new Date(todaySaudi.getFullYear(), todaySaudi.getMonth(), 1);
    return { from: fmt(start), to: todayStr, period: "month" };
  }
  if (shortcut === "lastmonth") {
    const start = new Date(todaySaudi.getFullYear(), todaySaudi.getMonth() - 1, 1);
    const end = new Date(todaySaudi.getFullYear(), todaySaudi.getMonth(), 0);
    return { from: fmt(start), to: fmt(end), period: "lastmonth" };
  }
  return { from: todayStr, to: todayStr, period: "today" };
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

export default function DashboardAnalyticsPanel({ branchId }: Props) {
  const tc = useTranslate();
  const [shortcut, setShortcut] = useState<Shortcut>("thisweek");

  const { from, to, period } = useMemo(() => getDateRange(shortcut), [shortcut]);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (branchId) p.set("branchId", branchId);
    return p.toString();
  }, [from, to, branchId]);

  const analyticsKey = `/api/analytics/advanced?${queryParams}`;

  const { data: weekly, isLoading: weeklyLoading } = useQuery<any>({
    queryKey: [analyticsKey],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: cogs, isLoading: cogsLoading } = useQuery<any>({
    queryKey: ['/api/analytics/cogs'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 10,
  });

  const isLoading = weeklyLoading || cogsLoading;

  const currentShortcutLabel = SHORTCUTS.find(s => s.key === shortcut)?.labelAr || "";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="h-7 w-20 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0,1,2].map(i => (
            <Card key={i} className="border border-border bg-card animate-pulse">
              <CardContent className="p-4 h-48" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summary = weekly?.summary || {};
  const revenueTrend: any[] = weekly?.revenueTrend || [];
  const topProducts: any[] = weekly?.topProducts || [];
  const maxQty = Math.max(...topProducts.map((p: any) => p.qty), 1);

  const cogsSummary = cogs?.summary || {};
  const cogsItems: any[] = (cogs?.items || []).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Section header + Date shortcuts */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-blue-500 rounded-full" />
          <h2 className="font-bold text-base text-foreground">{tc("إحصائيات المبيعات والأرباح", "Sales & Profit Stats")}</h2>
        </div>
        {/* Date shortcuts */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {SHORTCUTS.map(s => (
            <Button
              key={s.key}
              variant={shortcut === s.key ? "default" : "outline"}
              size="sm"
              onClick={() => setShortcut(s.key)}
              className={`h-7 text-[11px] px-2.5 rounded-full ${shortcut === s.key ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
              data-testid={`shortcut-${s.key}`}
            >
              {s.labelAr}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          {
            label: tc("الإيرادات", "Revenue"),
            value: <span className="flex items-center gap-1 text-xl font-bold">{(summary.totalRevenue || 0).toLocaleString()} <SarIcon size={14} /></span>,
            sub: <TrendBadge pct={summary.revenueChange || 0} />,
            icon: Wallet, color: "#2D9B6E",
          },
          {
            label: tc("الطلبات", "Orders"),
            value: <span className="text-xl font-bold">{summary.totalOrders || 0}</span>,
            sub: <TrendBadge pct={summary.ordersChange || 0} />,
            icon: ShoppingCart, color: "#3b82f6",
          },
          {
            label: tc("متوسط الطلب", "Avg Order"),
            value: <span className="flex items-center gap-1 text-xl font-bold">{(summary.avgOrderValue || 0).toFixed(1)} <SarIcon size={14} /></span>,
            sub: <TrendBadge pct={summary.avgOrderChange || 0} />,
            icon: BarChart3, color: "#8b5cf6",
          },
          {
            label: tc("هامش ربح متوسط", "Avg Profit Margin"),
            value: <span className="text-xl font-bold">{cogsSummary.avgMargin || 0}%</span>,
            sub: <span className="text-[10px] text-muted-foreground">{cogsSummary.highMargin || 0} {tc("منتج عالي", "high margin")}</span>,
            icon: Percent, color: "#f59e0b",
          },
        ] as const).map((k, i) => (
          <Card key={i} className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}18` }}>
                  <k.icon className="w-4 h-4" style={{ color: k.color }} />
                </div>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{currentShortcutLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">{k.label}</p>
              {k.value}
              <div className="mt-1">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row: trend + profit margins */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Revenue trend chart */}
        <Card className="lg:col-span-3 border border-border bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              {tc("الإيرادات اليومية", "Daily Revenue")}
              {summary.changeLabel && (
                <span className="text-[10px] text-muted-foreground font-normal">({summary.changeLabel})</span>
              )}
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{currentShortcutLabel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={revenueTrend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number, n: string) => [`${v.toLocaleString()} ﷼`, n === 'current' ? tc("الإيراد", "Revenue") : tc("الطلبات", "Orders")]}
                  />
                  <Area type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={2.5} fill="url(#weekGrad)" name="current" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                {tc("لا توجد بيانات", "No data")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit margin top items */}
        <Card className="lg:col-span-2 border border-border bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              {tc("أعلى هوامش ربح", "Top Profit Margins")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {cogsItems.length > 0 ? cogsItems.map((item: any, i: number) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.nameAr}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${Math.min(item.margin, 100)}%`, background: item.margin >= 60 ? '#2D9B6E' : item.margin >= 40 ? '#f59e0b' : '#ef4444' }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: item.margin >= 60 ? '#2D9B6E' : item.margin >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {item.margin}%
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">{item.price} <span className="text-[9px]">﷼</span></p>
                  <p className="text-[10px] text-emerald-600">+{item.profit} <span className="text-[9px]">﷼</span></p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs">
                <Package className="w-8 h-8 mb-2 opacity-30" />
                {tc("لا يوجد بيانات تكلفة", "No COGS data")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ALL products consumed table */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {tc("استهلاك المنتجات التفصيلي", "Detailed Product Consumption")}
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                {topProducts.length} {tc("منتج", "products")}
              </Badge>
            </CardTitle>
            <Badge variant="outline" className="text-[9px] h-5 px-2 text-muted-foreground">
              {currentShortcutLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {topProducts.length > 0 ? (
            <div className="space-y-1.5">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border">
                <span className="col-span-1 text-[10px] text-muted-foreground">#</span>
                <span className="col-span-4 text-[10px] text-muted-foreground">{tc("المنتج", "Product")}</span>
                <span className="col-span-4 text-[10px] text-muted-foreground">{tc("الكمية المباعة", "Qty Sold")}</span>
                <span className="col-span-3 text-[10px] text-muted-foreground text-left">{tc("الإيراد", "Revenue")}</span>
              </div>
              {topProducts.map((p: any, i: number) => {
                const barPct = Math.round((p.qty / maxQty) * 100);
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={p.id || i} className="grid grid-cols-12 gap-2 items-center py-1 hover:bg-muted/30 rounded-lg transition-colors">
                    <span className="col-span-1 text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                    <div className="col-span-4 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{p.nameAr}</p>
                      {p.nameEn && <p className="text-[10px] text-muted-foreground truncate">{p.nameEn}</p>}
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color }}>{p.qty}</span>
                    </div>
                    <div className="col-span-3 text-left">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-0.5">
                        {(p.revenue || 0).toLocaleString()} <SarIcon size={10} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm">
              <Package className="w-8 h-8 mb-2 opacity-30" />
              {tc("لا توجد بيانات مبيعات في هذه الفترة", "No sales data for this period")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

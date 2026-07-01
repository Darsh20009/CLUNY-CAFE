import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import {
  TrendingUp, Package, ShoppingCart, Wallet,
  BarChart3, ArrowUpRight, ArrowDownRight, Star, Percent
} from "lucide-react";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
import { getQueryFn } from "@/lib/queryClient";

interface Props {
  branchId?: string;
}

const COLORS = ["#2D9B6E", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6", "#a855f7", "#ef4444"];

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

  const weeklyKey = branchId
    ? `/api/analytics/advanced?period=week&branchId=${branchId}`
    : `/api/analytics/advanced?period=week`;

  const { data: weekly, isLoading: weeklyLoading } = useQuery<any>({
    queryKey: [weeklyKey],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: cogs, isLoading: cogsLoading } = useQuery<any>({
    queryKey: ['/api/analytics/cogs'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 10,
  });

  const isLoading = weeklyLoading || cogsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0,1,2].map(i => (
          <Card key={i} className="border border-border bg-card animate-pulse">
            <CardContent className="p-4 h-48" />
          </Card>
        ))}
      </div>
    );
  }

  const summary = weekly?.summary || {};
  const revenueTrend: any[] = weekly?.revenueTrend || [];
  const topProducts: any[] = (weekly?.topProducts || []).slice(0, 10);
  const maxQty = Math.max(...topProducts.map((p: any) => p.qty), 1);

  const cogsSummary = cogs?.summary || {};
  const cogsItems: any[] = (cogs?.items || []).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-blue-500 rounded-full" />
        <h2 className="font-bold text-base text-foreground">{tc("إحصائيات الأسبوع والأرباح", "Weekly Stats & Profits")}</h2>
        <Badge variant="secondary" className="text-[10px]">{tc("آخر 7 أيام", "Last 7 days")}</Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          {
            label: tc("إيرادات الأسبوع", "Week Revenue"),
            value: <span className="flex items-center gap-1 text-xl font-bold">{(summary.totalRevenue || 0).toLocaleString()} <SarIcon size={14} /></span>,
            sub: <TrendBadge pct={summary.revenueChange || 0} />,
            icon: Wallet, color: "#2D9B6E",
          },
          {
            label: tc("طلبات الأسبوع", "Week Orders"),
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
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">{k.label}</p>
              {k.value}
              <div className="mt-1">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row: Weekly trend + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Weekly revenue bar chart */}
        <Card className="lg:col-span-3 border border-border bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              {tc("الإيرادات اليومية - هذا الأسبوع", "Daily Revenue - This Week")}
              {summary.changeLabel && (
                <span className="text-[10px] text-muted-foreground font-normal">({summary.changeLabel})</span>
              )}
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

      {/* Top products consumed table */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            {tc("استهلاك المنتجات التفصيلي - هذا الأسبوع", "Detailed Product Consumption - This Week")}
            <Badge variant="secondary" className="text-[10px]">{tc("أعلى 10 منتجات", "Top 10")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 pb-1 border-b border-border">
                <span className="col-span-1 text-[10px] text-muted-foreground">#</span>
                <span className="col-span-4 text-[10px] text-muted-foreground">{tc("المنتج", "Product")}</span>
                <span className="col-span-4 text-[10px] text-muted-foreground">{tc("الكمية المباعة", "Qty Sold")}</span>
                <span className="col-span-3 text-[10px] text-muted-foreground text-left">{tc("الإيراد", "Revenue")}</span>
              </div>
              {topProducts.map((p: any, i: number) => {
                const barPct = Math.round((p.qty / maxQty) * 100);
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-center py-1">
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
                        {p.revenue.toLocaleString()} <SarIcon size={10} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm">
              <Package className="w-8 h-8 mb-2 opacity-30" />
              {tc("لا توجد بيانات مبيعات هذا الأسبوع", "No sales data this week")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

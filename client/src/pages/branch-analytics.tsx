import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@/lib/useTranslate";
import { SarIcon } from "@/components/SarIcon";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowRight, Banknote, CreditCard, Shuffle, TrendingUp,
  ShoppingCart, Users, BarChart3, Package, MapPin,
  AlertTriangle, ChevronLeft, RefreshCw,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
function getSaudiToday(): string {
  const saudi = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return saudi.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const saudi = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return new Date(saudi.getTime() - n * 86_400_000).toISOString().slice(0, 10);
}

const SHORTCUTS = [
  { key: "today",        label: "اليوم" },
  { key: "yesterday",    label: "أمس" },
  { key: "this_week",    label: "الأسبوع" },
  { key: "last_week",    label: "الأسبوع الماضي" },
  { key: "this_month",   label: "الشهر" },
  { key: "last_month",   label: "الشهر الماضي" },
  { key: "last_2m",      label: "آخر شهرين" },
  { key: "this_quarter", label: "الربع" },
  { key: "this_year",    label: "السنة" },
];

function buildShortcutDates(key: string): { dateFrom: string; dateTo: string } {
  const today = getSaudiToday();
  const saudi = new Date(Date.now() + 3 * 60 * 60 * 1000);
  if (key === "today")     return { dateFrom: today, dateTo: today };
  if (key === "yesterday") { const y = daysAgo(1); return { dateFrom: y, dateTo: y }; }
  const dow = saudi.getUTCDay();
  if (key === "this_week") return { dateFrom: daysAgo(dow === 0 ? 6 : dow - 1), dateTo: today };
  if (key === "last_week") {
    const toSun = dow === 0 ? 7 : dow;
    return { dateFrom: daysAgo(toSun + 6), dateTo: daysAgo(toSun) };
  }
  if (key === "this_month") return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today };
  if (key === "last_month") {
    const prev = new Date(Date.UTC(saudi.getUTCFullYear(), saudi.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(saudi.getUTCFullYear(), saudi.getUTCMonth(), 0));
    return { dateFrom: prev.toISOString().slice(0, 10), dateTo: last.toISOString().slice(0, 10) };
  }
  if (key === "last_2m") {
    const from = new Date(Date.UTC(saudi.getUTCFullYear(), saudi.getUTCMonth() - 2, 1));
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: today };
  }
  if (key === "this_quarter") {
    const qStart = Math.floor(saudi.getUTCMonth() / 3) * 3;
    const from = new Date(Date.UTC(saudi.getUTCFullYear(), qStart, 1));
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: today };
  }
  if (key === "this_year") return { dateFrom: `${today.slice(0, 4)}-01-01`, dateTo: today };
  return { dateFrom: today, dateTo: today };
}

const COLORS = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#ec4899","#84cc16"];

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BranchAnalytics() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;

  // Read initial period from URL search params
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initFrom = urlParams.get("dateFrom") || getSaudiToday();
  const initTo   = urlParams.get("dateTo")   || getSaudiToday();

  const [dateFrom, setDateFrom]         = useState(initFrom);
  const [dateTo,   setDateTo]           = useState(initTo);
  const [activeShortcut, setActive]     = useState("custom");
  const [activeTab, setActiveTab]       = useState<"overview"|"products"|"customers"|"stock">("overview");

  // Detect which shortcut matches initial dates
  useEffect(() => {
    for (const s of SHORTCUTS) {
      const { dateFrom: sf, dateTo: st } = buildShortcutDates(s.key);
      if (sf === initFrom && st === initTo) { setActive(s.key); break; }
    }
  }, []);

  const applyShortcut = (key: string) => {
    setActive(key);
    const { dateFrom: f, dateTo: t } = buildShortcutDates(key);
    setDateFrom(f);
    setDateTo(t);
  };

  const queryKey = [`/api/owner/branch-analytics`, branchId, dateFrom, dateTo];
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const stored = localStorage.getItem("currentEmployee");
      const headers: Record<string, string> = {};
      if (stored) {
        try { const e = JSON.parse(stored); if (e.id) headers["X-Employee-Id"] = e.id; } catch {}
      }
      const url = `/api/owner/branch-analytics?branchId=${encodeURIComponent(branchId)}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const kpis = data?.kpis;
  const pay  = data?.paymentBreakdown;
  const branch = data?.branch;

  // ── Label period for display ──
  const periodLabel = dateFrom === dateTo
    ? dateFrom
    : `${dateFrom} → ${dateTo}`;

  return (
    <div className="min-h-screen bg-background text-foreground font-ibm-arabic" dir="rtl">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/owner/dashboard")} className="shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-base truncate">
              {branch?.nameAr || tc("تحليلات الفرع", "Branch Analytics")}
            </h1>
            <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} className="shrink-0">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-4">

        {/* ── Period Picker ── */}
        <Card>
          <CardContent className="p-3 space-y-3">
            {/* Shortcut buttons */}
            <div className="flex flex-wrap gap-1.5">
              {SHORTCUTS.map(s => (
                <button key={s.key}
                  onClick={() => applyShortcut(s.key)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    activeShortcut === s.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* Custom date inputs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-[11px] text-muted-foreground shrink-0">{tc("من", "From")}</span>
                <input type="date" value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setActive("custom"); if (e.target.value > dateTo) setDateTo(e.target.value); }}
                  max={getSaudiToday()}
                  className="flex-1 text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-[11px] text-muted-foreground shrink-0">{tc("إلى", "To")}</span>
                <input type="date" value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setActive("custom"); if (e.target.value < dateFrom) setDateFrom(e.target.value); }}
                  min={dateFrom} max={getSaudiToday()}
                  className="flex-1 text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: TrendingUp,    label: tc("الإيرادات","Revenue"),        value: kpis ? `${fmt(kpis.revenue)} ﷼` : "—", color: "text-emerald-500" },
            { icon: ShoppingCart,  label: tc("الطلبات","Orders"),           value: kpis ? kpis.orders.toLocaleString() : "—", color: "text-blue-500" },
            { icon: BarChart3,     label: tc("متوسط الطلب","Avg. Order"),   value: kpis ? `${fmt(kpis.avgOrder)} ﷼` : "—", color: "text-amber-500" },
            { icon: Users,         label: tc("العملاء","Customers"),        value: kpis ? kpis.uniqueCustomers.toLocaleString() : "—", color: "text-purple-500" },
          ].map(k => (
            <Card key={k.label} className="border bg-card">
              <CardContent className="p-3 flex flex-col gap-1">
                <k.icon className={`w-4 h-4 ${k.color}`} />
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
                <p className={`font-bold text-sm ${k.color}`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Payment Breakdown ── */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              {tc("طرق الدفع", "Payment Methods")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Cash */}
              <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{tc("كاش", "Cash")}</p>
                    <p className="text-[10px] text-muted-foreground">{pay?.cash.orders ?? 0} {tc("طلب","orders")}</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  {pay ? fmt(pay.cash.total) : "—"} <SarIcon size={12} />
                </p>
              </div>

              {/* Card / Network */}
              <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{tc("شبكة / كارت", "Card / Network")}</p>
                    <p className="text-[10px] text-muted-foreground">{pay?.card.orders ?? 0} {tc("طلب","orders")}</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  {pay ? fmt(pay.card.total) : "—"} <SarIcon size={12} />
                </p>
              </div>

              {/* Split */}
              <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <Shuffle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{tc("مقسّم", "Split")}</p>
                    <p className="text-[10px] text-muted-foreground">{pay?.split.orders ?? 0} {tc("طلب","orders")}</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  {pay ? fmt(pay.split.total) : "—"} <SarIcon size={12} />
                </p>
                {pay && pay.split.orders > 0 && (
                  <div className="mt-2 space-y-1 border-t border-amber-200 dark:border-amber-800 pt-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" /> {tc("منها كاش","Cash portion")}</span>
                      <span className="font-medium text-emerald-600">{fmt(pay.split.cashPortion)} ﷼</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> {tc("منها شبكة","Card portion")}</span>
                      <span className="font-medium text-blue-600">{fmt(pay.split.cardPortion)} ﷼</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Loyalty + Other (compact) */}
              {pay && (pay.loyalty.orders > 0 || pay.other.orders > 0) && (
                <div className="sm:col-span-3 grid grid-cols-2 gap-3">
                  {pay.loyalty.orders > 0 && (
                    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <Package className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{tc("ولاء / بطاقة","Loyalty / Card")} · {pay.loyalty.orders} {tc("طلب","orders")}</p>
                        <p className="font-bold text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1">{fmt(pay.loyalty.total)} <SarIcon size={10} /></p>
                      </div>
                    </div>
                  )}
                  {pay.other.orders > 0 && (
                    <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                        <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{tc("أخرى","Other")} · {pay.other.orders} {tc("طلب","orders")}</p>
                        <p className="font-bold text-sm text-foreground flex items-center gap-1">{fmt(pay.other.total)} <SarIcon size={10} /></p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Combined totals bar */}
            {pay && (pay.cash.total + pay.card.total + pay.split.total) > 0 && (() => {
              const total = pay.cash.total + pay.card.total + pay.split.total + pay.loyalty.total + pay.other.total;
              const cashTotal  = pay.cash.total + pay.split.cashPortion;
              const cardTotal  = pay.card.total + pay.split.cardPortion;
              const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
              return (
                <div className="mt-4">
                  <p className="text-[10px] text-muted-foreground mb-1">{tc("الكاش الكلي (كاش + حصة الكاش من المقسّم)", "Total cash incl. split cash portion")}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden flex">
                      <div className="h-3 bg-emerald-500 transition-all" style={{ width: `${pct(cashTotal)}%` }} title={`كاش: ${fmt(cashTotal)} ﷼`} />
                      <div className="h-3 bg-blue-500 transition-all"   style={{ width: `${pct(cardTotal)}%` }} title={`شبكة: ${fmt(cardTotal)} ﷼`} />
                      {pay.loyalty.total > 0 && <div className="h-3 bg-purple-500 transition-all" style={{ width: `${pct(pay.loyalty.total)}%` }} />}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>{tc("كاش","Cash")}: {fmt(cashTotal)} ﷼ ({pct(cashTotal)}%)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>{tc("شبكة","Card")}: {fmt(cardTotal)} ﷼ ({pct(cardTotal)}%)</span>
                    {pay.loyalty.total > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"/>{tc("ولاء","Loyalty")}: {fmt(pay.loyalty.total)} ﷼ ({pct(pay.loyalty.total)}%)</span>}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* ── Daily Revenue Trend ── */}
        {data?.dailyTrend && data.dailyTrend.length > 1 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {tc("مسار الإيرادات اليومي", "Daily Revenue Trend")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.dailyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={40} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [`${fmt(v)} ﷼`, "الإيراد"]}
                    labelFormatter={l => l}
                  />
                  <Bar dataKey="revenue" radius={[4,4,0,0]}>
                    {data.dailyTrend.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-border overflow-x-auto pb-0.5">
          {(["overview","products","customers","stock"] as const).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs px-3 py-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview"   ? tc("نظرة عامة","Overview")   :
               tab === "products"   ? tc("المنتجات","Products")     :
               tab === "customers"  ? tc("العملاء","Customers")     :
                                      tc("المخزون","Stock")}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {activeTab === "overview" && data?.dailyTrend && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">{tc("ملخص الأيام","Daily Summary")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-right py-2 px-4 font-medium">{tc("التاريخ","Date")}</th>
                      <th className="text-left py-2 px-4 font-medium">{tc("الطلبات","Orders")}</th>
                      <th className="text-left py-2 px-4 font-medium">{tc("الإيراد","Revenue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.dailyTrend].reverse().map((row: any) => (
                      <tr key={row.date} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-4">{row.date}</td>
                        <td className="py-2 px-4 text-left">{row.orders}</td>
                        <td className="py-2 px-4 text-left font-medium text-emerald-600 flex items-center gap-1">{fmt(row.revenue)} <SarIcon size={9} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Products tab ── */}
        {activeTab === "products" && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                {tc("أفضل المنتجات مبيعاً","Top Products")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {data?.topProducts?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={data.topProducts.length > 5 ? 300 : 200}>
                    <BarChart data={data.topProducts.slice(0, 10)} layout="vertical" margin={{ right: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="nameAr" width={100} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: any, n: string) => [n === "qty" ? `${v} قطعة` : `${fmt(v)} ﷼`, n === "qty" ? "الكمية" : "الإيراد"]}
                      />
                      <Bar dataKey="qty" radius={[0,4,4,0]}>
                        {data.topProducts.slice(0, 10).map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-right py-2 font-medium">#</th>
                          <th className="text-right py-2 px-2 font-medium">{tc("المنتج","Product")}</th>
                          <th className="text-left py-2 px-2 font-medium">{tc("الكمية","Qty")}</th>
                          <th className="text-left py-2 px-2 font-medium">{tc("الإيراد","Revenue")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((p: any, i: number) => (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 pr-2 text-muted-foreground">{i+1}</td>
                            <td className="py-2 px-2 font-medium">{p.nameAr}</td>
                            <td className="py-2 px-2 text-left">{p.qty}</td>
                            <td className="py-2 px-2 text-left text-emerald-600 flex items-center gap-1">{fmt(p.revenue, 0)} <SarIcon size={9} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm py-6 text-center">{tc("لا توجد بيانات","No data")}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Customers tab ── */}
        {activeTab === "customers" && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {tc("عملاء الفرع","Branch Customers")} · {data?.customers?.length ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {data?.customers?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-right py-2 px-4 font-medium">{tc("الاسم","Name")}</th>
                        <th className="text-left py-2 px-4 font-medium">{tc("الجوال","Phone")}</th>
                        <th className="text-left py-2 px-4 font-medium">{tc("الطلبات","Orders")}</th>
                        <th className="text-left py-2 px-4 font-medium">{tc("الإجمالي","Total")}</th>
                        <th className="text-left py-2 px-4 font-medium">{tc("آخر طلب","Last Order")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customers.map((c: any, i: number) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-4 font-medium">{c.name}</td>
                          <td className="py-2 px-4 text-left text-muted-foreground dir-ltr">{c.phone || "—"}</td>
                          <td className="py-2 px-4 text-left">{c.orders}</td>
                          <td className="py-2 px-4 text-left text-emerald-600 font-medium">{fmt(c.totalSpent, 0)} ﷼</td>
                          <td className="py-2 px-4 text-left text-muted-foreground">{c.lastOrder}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-6 text-center px-4">{tc("لا يوجد عملاء في هذه الفترة","No customers in this period")}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Stock tab ── */}
        {activeTab === "stock" && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                {tc("مخزون الفرع","Branch Stock")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {data?.stock?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-right py-2 px-4 font-medium">{tc("المادة","Item")}</th>
                        <th className="text-left py-2 px-4 font-medium">{tc("الكمية الحالية","Current Qty")}</th>
                        <th className="text-left py-2 px-4 font-medium">{tc("الحد الأدنى","Min Level")}</th>
                        <th className="text-left py-2 px-4 font-medium">{tc("الحالة","Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stock.map((s: any) => (
                        <tr key={s.rawItemId} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-4 font-medium">{s.nameAr}</td>
                          <td className="py-2 px-4 text-left">{s.currentQuantity} {s.unit}</td>
                          <td className="py-2 px-4 text-left text-muted-foreground">{s.minStockLevel} {s.unit}</td>
                          <td className="py-2 px-4 text-left">
                            {s.status === "out" ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> {tc("نفد","Out")}
                              </span>
                            ) : s.status === "low" ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> {tc("منخفض","Low")}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">{tc("جيد","OK")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-6 text-center px-4">{tc("لا توجد بيانات مخزون لهذا الفرع","No stock data for this branch")}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

      </div>
    </div>
  );
}

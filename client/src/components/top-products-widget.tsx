import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ExternalLink, RefreshCw, TrendingUp, ShoppingCart, Banknote } from "lucide-react";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";

interface ProductSummary {
  id: string; nameAr: string; nameEn: string; price: number;
  category: string; imageUrl: string; totalQty: number;
  totalRevenue: number; orderCount: number; available: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtSAR(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function saudiToday() {
  const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${sa.getFullYear()}-${String(sa.getMonth() + 1).padStart(2, "0")}-${String(sa.getDate()).padStart(2, "0")}`;
}

const SHORTCUTS = [
  {
    label: "اليوم", key: "today",
    get: () => { const t = saudiToday(); return { from: t, to: t }; },
  },
  {
    label: "أمس", key: "yesterday",
    get: () => {
      const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      sa.setDate(sa.getDate() - 1);
      const d = `${sa.getFullYear()}-${String(sa.getMonth() + 1).padStart(2, "0")}-${String(sa.getDate()).padStart(2, "0")}`;
      return { from: d, to: d };
    },
  },
  {
    label: "هذا الأسبوع", key: "thisweek",
    get: () => {
      const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      const day = sa.getDay();
      const offset = -(day === 0 ? 6 : day - 1);
      const start = new Date(sa); start.setDate(sa.getDate() + offset);
      const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { from: f(start), to: saudiToday() };
    },
  },
  {
    label: "هذا الشهر", key: "thismonth",
    get: () => {
      const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      return { from: `${sa.getFullYear()}-${String(sa.getMonth() + 1).padStart(2, "0")}-01`, to: saudiToday() };
    },
  },
  {
    label: "الشهر الماضي", key: "lastmonth",
    get: () => {
      const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      const first = new Date(sa.getFullYear(), sa.getMonth() - 1, 1);
      const last = new Date(sa.getFullYear(), sa.getMonth(), 0);
      const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { from: f(first), to: f(last) };
    },
  },
  {
    label: "هذا العام", key: "thisyear",
    get: () => {
      const y = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" })).getFullYear();
      return { from: `${y}-01-01`, to: saudiToday() };
    },
  },
];

interface Props {
  branchId?: string;
  topN?: number;
}

export default function TopProductsWidget({ branchId, topN = 8 }: Props) {
  const [, setLocation] = useLocation();
  const [activeKey, setActiveKey] = useState("thismonth");
  const [range, setRange] = useState(() => {
    const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    return { from: `${sa.getFullYear()}-${String(sa.getMonth() + 1).padStart(2, "0")}-01`, to: saudiToday() };
  });

  function apply(key: string) {
    const sc = SHORTCUTS.find(s => s.key === key);
    if (!sc) return;
    setRange(sc.get());
    setActiveKey(key);
  }

  const url = branchId
    ? `/api/analytics/products?from=${range.from}&to=${range.to}&branchId=${branchId}`
    : `/api/analytics/products?from=${range.from}&to=${range.to}`;

  const { data, isLoading } = useQuery<{ products: ProductSummary[]; totalOrders: number }>({
    queryKey: [url],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 3,
  });

  const products = (data?.products || []).filter(p => p.totalQty > 0).slice(0, topN);
  const totalQty = (data?.products || []).reduce((s, p) => s + p.totalQty, 0);
  const totalRevenue = (data?.products || []).reduce((s, p) => s + p.totalRevenue, 0);
  const zeroCount = (data?.products || []).filter(p => p.totalQty === 0).length;
  const maxQty = Math.max(...products.map(p => p.totalQty), 1);

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2D9B6E]" />
            أداء المنتجات
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[#2D9B6E] gap-1 h-7"
            onClick={() => setLocation("/manager/product-reports")}
          >
            <ExternalLink className="w-3 h-3" />
            التقرير الكامل
          </Button>
        </div>

        {/* Shortcuts */}
        <div className="flex flex-wrap gap-1 pt-2">
          {SHORTCUTS.map(sc => (
            <Button
              key={sc.key}
              size="sm"
              variant={activeKey === sc.key ? "default" : "outline"}
              className={`h-6 text-xs px-2.5 ${activeKey === sc.key ? "bg-[#2D9B6E] hover:bg-[#25845c] text-white" : ""}`}
              onClick={() => apply(sc.key)}
            >
              {sc.label}
            </Button>
          ))}
        </div>

        {/* KPI row */}
        <div className="flex gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShoppingCart className="w-3.5 h-3.5 text-[#2D9B6E]" />
            <span className="font-semibold text-foreground">{fmt(totalQty)}</span> مباع
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Banknote className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-semibold text-foreground">{fmtSAR(totalRevenue)}</span> ريال
          </div>
          {zeroCount > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 h-5">
              {zeroCount} بلا مبيعات
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-[#2D9B6E]" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            لا توجد مبيعات في هذه الفترة
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p, idx) => {
              const pct = Math.round((p.totalQty / maxQty) * 100);
              return (
                <div key={p.id} className="flex items-center gap-2 group">
                  <span className="text-xs text-muted-foreground w-4 shrink-0 font-bold">{idx + 1}</span>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.nameAr} className="w-7 h-7 rounded-md object-cover border shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">{p.nameAr}</span>
                      <span className="text-xs font-bold text-[#2D9B6E] shrink-0">{fmt(p.totalQty)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: idx === 0 ? "#2D9B6E" : idx === 1 ? "#3b82f6" : "#8b5cf6" }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 w-14 text-left">{fmtSAR(p.totalRevenue)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

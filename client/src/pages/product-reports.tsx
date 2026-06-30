import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  BarChart3,
  Clock,
  Calendar,
  Printer,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Star,
  Banknote,
  ChevronRight,
  RefreshCw,
  Download,
  Users,
  Timer,
} from "lucide-react";
import clunyLogo from "@assets/cluny-logo.png";

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAYS_AR = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

const CHANNEL_LABELS: Record<string, string> = {
  pos: "نقطة البيع", online: "أونلاين", delivery: "توصيل",
  takeaway: "سفري", dine_in: "محلي",
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي", card: "بطاقة", split: "مختلط", loyalty: "نقاط", online: "أونلاين",
};

interface ProductSummary {
  id: string; nameAr: string; nameEn: string; price: number;
  category: string; imageUrl: string; totalQty: number;
  totalRevenue: number; orderCount: number; available: boolean;
}

interface ProductDetail {
  item: { id: string; nameAr: string; nameEn: string; price: number; category: string; imageUrl: string; availabilityStatus: string };
  targetYear: number;
  currentYearMonths: { month: number; year: number; qty: number; revenue: number; orders: number }[];
  prevYearMonths: { month: number; year: number; qty: number; revenue: number; orders: number }[];
  currentYearTotal: { qty: number; revenue: number };
  prevYearTotal: { qty: number; revenue: number };
  hourlyDistribution: { hour: number; qty: number }[];
  dayOfWeekDistribution: { day: number; dayName: string; qty: number }[];
  channelBreakdown: { channel: string; qty: number }[];
  paymentBreakdown: { method: string; qty: number }[];
  peakHour: { hour: number; qty: number } | null;
  peakDay: { day: number; dayName: string; qty: number } | null;
  totalOrders: number;
}

function formatSAR(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BarMini({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-left">{pct}%</span>
    </div>
  );
}

function ProductDetailView({ itemId, year, onBack }: { itemId: string; year: number; onBack: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery<ProductDetail>({
    queryKey: ["/api/analytics/products", itemId, year],
    queryFn: () =>
      fetch(`/api/analytics/products/${itemId}?year=${year}`, { credentials: "include" }).then(r => r.json()),
  });

  const handlePrint = () => {
    if (!printRef.current || !data) return;
    const printWin = window.open("", "_blank", "width=900,height=700");
    if (!printWin) return;
    const content = printRef.current.innerHTML;
    printWin.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"><title>تقرير منتج - ${data.item.nameAr}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', 'Arial', sans-serif; direction: rtl; background: #fff; color: #111; padding: 24px; }
        .print-header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #2D9B6E; padding-bottom: 12px; margin-bottom: 20px; }
        .print-header img { width: 60px; height: 60px; border-radius: 12px; object-fit: cover; }
        h1 { font-size: 22px; font-weight: 900; color: #2D9B6E; }
        h2 { font-size: 16px; font-weight: 700; color: #333; margin: 16px 0 8px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi { background: #f8faf9; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; text-align: center; }
        .kpi .val { font-size: 22px; font-weight: 900; color: #2D9B6E; }
        .kpi .lbl { font-size: 11px; color: #666; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #2D9B6E; color: #fff; padding: 8px; text-align: center; }
        td { border: 1px solid #e5e7eb; padding: 7px 10px; text-align: center; }
        tr:nth-child(even) td { background: #f9fafb; }
        .badge-zero { background: #fef2f2; color: #ef4444; border-radius: 6px; padding: 2px 8px; font-size: 11px; }
        .badge-ok { background: #f0fdf4; color: #16a34a; border-radius: 6px; padding: 2px 8px; font-size: 11px; }
        @media print {
          body { padding: 10px; }
          .no-print { display: none !important; }
        }
      </style></head>
      <body>${content}</body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 animate-spin text-[#2D9B6E]" />
    </div>
  );
  if (!data || (data as any).error) return (
    <div className="text-center py-16 text-muted-foreground">لم يتم العثور على بيانات المنتج</div>
  );

  const { item, currentYearMonths, prevYearMonths, currentYearTotal, prevYearTotal, hourlyDistribution, dayOfWeekDistribution, channelBreakdown, paymentBreakdown, peakHour, peakDay, totalOrders } = data;
  const maxMonthQty = Math.max(...currentYearMonths.map(m => m.qty), 1);
  const maxHour = Math.max(...hourlyDistribution.map(h => h.qty), 1);
  const maxDay = Math.max(...dayOfWeekDistribution.map(d => d.qty), 1);
  const maxChannel = Math.max(...channelBreakdown.map(c => c.qty), 1);
  const qtyChange = prevYearTotal.qty > 0 ? ((currentYearTotal.qty - prevYearTotal.qty) / prevYearTotal.qty * 100) : 0;
  const revChange = prevYearTotal.revenue > 0 ? ((currentYearTotal.revenue - prevYearTotal.revenue) / prevYearTotal.revenue * 100) : 0;

  const printContent = (
    <div>
      <div className="print-header">
        <img src="/cluny-logo.png" alt="CLUNY CAFE" />
        <div>
          <h1>CLUNY CAFE — تقرير المنتج التفصيلي</h1>
          <p style={{ fontSize: 13, color: "#666" }}>{item.nameAr} | عام {year} | تم الإنشاء: {new Date().toLocaleDateString("ar-SA")}</p>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi"><div className="val">{currentYearTotal.qty.toLocaleString("ar-SA")}</div><div className="lbl">إجمالي المبيعات</div></div>
        <div className="kpi"><div className="val">{formatSAR(currentYearTotal.revenue)}</div><div className="lbl">الإيرادات (ريال)</div></div>
        <div className="kpi"><div className="val">{totalOrders.toLocaleString("ar-SA")}</div><div className="lbl">عدد الطلبات</div></div>
        <div className="kpi"><div className="val">{peakDay?.dayName || "—"}</div><div className="lbl">أفضل يوم</div></div>
      </div>
      <h2>المبيعات الشهرية</h2>
      <table>
        <thead><tr><th>الشهر</th><th>الكمية ({year})</th><th>الإيرادات ({year})</th><th>الكمية ({year - 1})</th><th>الإيرادات ({year - 1})</th></tr></thead>
        <tbody>{MONTHS_AR.map((mn, i) => {
          const cur = currentYearMonths[i];
          const prev = prevYearMonths[i];
          return (
            <tr key={i}>
              <td>{mn}</td>
              <td>{cur.qty > 0 ? <span className="badge-ok">{cur.qty}</span> : <span className="badge-zero">لا يوجد</span>}</td>
              <td>{formatSAR(cur.revenue)}</td>
              <td>{prev.qty > 0 ? prev.qty : "—"}</td>
              <td>{formatSAR(prev.revenue)}</td>
            </tr>
          );
        })}</tbody>
      </table>
      <h2>تحليل القنوات</h2>
      <table>
        <thead><tr><th>القناة</th><th>الكمية</th><th>النسبة</th></tr></thead>
        <tbody>{channelBreakdown.map((c, i) => (
          <tr key={i}><td>{CHANNEL_LABELS[c.channel] || c.channel}</td><td>{c.qty}</td><td>{Math.round(c.qty / Math.max(currentYearTotal.qty, 1) * 100)}%</td></tr>
        ))}</tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowRight className="w-4 h-4" />
            رجوع للقائمة
          </Button>
          <div className="flex items-center gap-3">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.nameAr} className="w-12 h-12 rounded-xl object-cover border" />
            )}
            <div>
              <h2 className="text-xl font-bold">{item.nameAr}</h2>
              <p className="text-sm text-muted-foreground">{item.nameEn} · {item.category} · {formatSAR(item.price)} ريال</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={item.availabilityStatus === "out_of_stock" ? "destructive" : "default"} className="gap-1">
            {item.availabilityStatus === "out_of_stock" ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {item.availabilityStatus === "out_of_stock" ? "نفذ المخزون" : "متاح"}
          </Badge>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 print:hidden">
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المبيعات", value: currentYearTotal.qty.toLocaleString("ar-SA"), sub: `مقارنة ${prevYearTotal.qty} العام الماضي`, change: qtyChange, icon: ShoppingCart, color: "#2D9B6E" },
          { label: "الإيرادات (ريال)", value: formatSAR(currentYearTotal.revenue), sub: `مقارنة ${formatSAR(prevYearTotal.revenue)} العام الماضي`, change: revChange, icon: Banknote, color: "#3b82f6" },
          { label: "عدد الطلبات", value: totalOrders.toLocaleString("ar-SA"), sub: `طلب يحتوي هذا المنتج`, change: 0, icon: Package, color: "#8b5cf6" },
          { label: "ذروة البيع", value: peakDay?.dayName || "—", sub: peakHour ? `الساعة ${peakHour.hour}:00` : "لا توجد بيانات كافية", change: 0, icon: Timer, color: "#f59e0b" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                </div>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: kpi.color + "22" }}>
                  <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
              </div>
              {kpi.change !== 0 && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${kpi.change >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {kpi.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(kpi.change).toFixed(1)}% مقارنة بالعام الماضي
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-[#2D9B6E]" />
            المبيعات الشهرية — {year} مقارنة بـ {year - 1}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 px-3 font-semibold text-muted-foreground">الشهر</th>
                  {["الكمية", "الإيرادات (ريال)", "الطلبات"].map(h => (
                    <th key={h} className="text-center py-2 px-3 font-semibold text-muted-foreground">{h} {year}</th>
                  ))}
                  {["الكمية", "الإيرادات (ريال)"].map(h => (
                    <th key={h} className="text-center py-2 px-3 font-semibold text-muted-foreground opacity-60">{h} {year - 1}</th>
                  ))}
                  <th className="text-center py-2 px-3 font-semibold text-muted-foreground">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS_AR.map((mn, i) => {
                  const cur = currentYearMonths[i];
                  const prev = prevYearMonths[i];
                  const trend = prev.qty > 0 ? ((cur.qty - prev.qty) / prev.qty * 100) : null;
                  return (
                    <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-medium">{mn}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-bold ${cur.qty === 0 ? "text-red-400" : "text-foreground"}`}>{cur.qty}</span>
                          <div className="w-20">
                            <BarMini value={cur.qty} max={maxMonthQty} color="#2D9B6E" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">{formatSAR(cur.revenue)}</td>
                      <td className="py-3 px-3 text-center">{cur.orders}</td>
                      <td className="py-3 px-3 text-center opacity-60">{prev.qty}</td>
                      <td className="py-3 px-3 text-center opacity-60">{formatSAR(prev.revenue)}</td>
                      <td className="py-3 px-3 text-center">
                        {cur.qty === 0 ? (
                          <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-xs gap-1">
                            <XCircle className="w-3 h-3" /> لا مبيعات
                          </Badge>
                        ) : trend !== null ? (
                          <Badge variant="outline" className={`text-xs gap-1 ${trend >= 0 ? "text-green-600 border-green-200 bg-green-50" : "text-red-500 border-red-200 bg-red-50"}`}>
                            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(trend).toFixed(0)}%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-200 bg-green-50">
                            <CheckCircle2 className="w-3 h-3" /> جيد
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-bold">
                  <td className="py-3 px-3">الإجمالي</td>
                  <td className="py-3 px-3 text-center text-[#2D9B6E]">{currentYearTotal.qty}</td>
                  <td className="py-3 px-3 text-center text-[#2D9B6E]">{formatSAR(currentYearTotal.revenue)}</td>
                  <td className="py-3 px-3 text-center">{totalOrders}</td>
                  <td className="py-3 px-3 text-center opacity-60">{prevYearTotal.qty}</td>
                  <td className="py-3 px-3 text-center opacity-60">{formatSAR(prevYearTotal.revenue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Hourly Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-[#3b82f6]" />
              توزيع المبيعات بالساعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {hourlyDistribution.filter(h => h.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 10).map(h => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground text-left">{h.hour}:00 — {h.hour + 1}:00</span>
                  <BarMini value={h.qty} max={maxHour} color="#3b82f6" />
                  <span className="text-xs font-bold w-6">{h.qty}</span>
                </div>
              ))}
              {hourlyDistribution.filter(h => h.qty > 0).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Day of Week */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-[#8b5cf6]" />
              توزيع المبيعات بأيام الأسبوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dayOfWeekDistribution.sort((a, b) => b.qty - a.qty).map(d => (
                <div key={d.day} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground">{d.dayName}</span>
                  <BarMini value={d.qty} max={maxDay} color="#8b5cf6" />
                  <span className="text-xs font-bold w-6">{d.qty}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Channel Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-[#f59e0b]" />
              قنوات البيع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {channelBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              ) : channelBreakdown.sort((a, b) => b.qty - a.qty).map(c => (
                <div key={c.channel} className="flex items-center gap-3">
                  <span className="text-xs w-20 text-muted-foreground">{CHANNEL_LABELS[c.channel] || c.channel}</span>
                  <BarMini value={c.qty} max={maxChannel} color="#f59e0b" />
                  <span className="text-xs font-bold w-6">{c.qty}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(c.qty / Math.max(currentYearTotal.qty, 1) * 100)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="w-4 h-4 text-[#10b981]" />
              طرق الدفع المستخدمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paymentBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              ) : paymentBreakdown.sort((a, b) => b.qty - a.qty).map(p => {
                const maxPay = Math.max(...paymentBreakdown.map(x => x.qty), 1);
                return (
                  <div key={p.method} className="flex items-center gap-3">
                    <span className="text-xs w-16 text-muted-foreground">{PAYMENT_LABELS[p.method] || p.method}</span>
                    <BarMini value={p.qty} max={maxPay} color="#10b981" />
                    <span className="text-xs font-bold w-6">{p.qty}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insight: Why not sold in some months */}
      {currentYearMonths.some(m => m.qty === 0) && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">أشهر بدون مبيعات</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  لم يُباع هذا المنتج في: <strong>{currentYearMonths.filter(m => m.qty === 0).map(m => MONTHS_AR[m.month - 1]).join("، ")}</strong>.
                  قد يكون السبب: نفاد المخزون، إيقاف المنتج مؤقتاً، موسمية المنتج، أو عدم عرضه في القائمة خلال تلك الفترة.
                </p>
                {item.availabilityStatus === "out_of_stock" && (
                  <Badge variant="outline" className="mt-2 text-red-600 border-red-300 bg-red-50 text-xs gap-1">
                    <XCircle className="w-3 h-3" /> المنتج نافد حالياً من المخزون
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden print area */}
      <div ref={printRef} className="hidden">{printContent}</div>
    </div>
  );
}

export default function ProductReportsPage() {
  const [, setLocation] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sort, setSort] = useState<"qty" | "revenue" | "name" | "zero">("qty");
  const [year, setYear] = useState(new Date().getFullYear());
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery<{ products: ProductSummary[]; period: any; totalOrders: number }>({
    queryKey: ["/api/analytics/products", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/analytics/products?from=${fromDate}&to=${toDate}`, { credentials: "include" }).then(r => r.json()),
  });

  const products = data?.products || [];

  const filtered = products
    .filter(p =>
      p.nameAr.includes(search) ||
      (p.nameEn || "").toLowerCase().includes(search.toLowerCase()) ||
      p.category.includes(search)
    )
    .sort((a, b) => {
      if (sort === "qty") return b.totalQty - a.totalQty;
      if (sort === "revenue") return b.totalRevenue - a.totalRevenue;
      if (sort === "name") return a.nameAr.localeCompare(b.nameAr, "ar");
      if (sort === "zero") return a.totalQty - b.totalQty;
      return 0;
    });

  const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
  const totalQty = products.reduce((s, p) => s + p.totalQty, 0);
  const zeroProducts = products.filter(p => p.totalQty === 0);
  const topProduct = products.reduce((top, p) => (!top || p.totalQty > top.totalQty) ? p : top, null as ProductSummary | null);

  const handlePrintSummary = () => {
    if (!printRef.current) return;
    const printWin = window.open("", "_blank", "width=1000,height=700");
    if (!printWin) return;
    const content = printRef.current.innerHTML;
    printWin.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"><title>تقرير مبيعات المنتجات — CLUNY CAFE</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', 'Arial', sans-serif; direction: rtl; background: #fff; color: #111; padding: 24px; }
        .header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #2D9B6E; padding-bottom: 14px; margin-bottom: 20px; }
        .header img { width: 64px; height: 64px; border-radius: 14px; object-fit: cover; }
        .header h1 { font-size: 22px; font-weight: 900; color: #2D9B6E; }
        .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
        .kpi { background: #f8faf9; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
        .kpi .v { font-size: 20px; font-weight: 900; color: #2D9B6E; }
        .kpi .l { font-size: 11px; color: #777; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
        th { background: #2D9B6E; color: #fff; padding: 9px 8px; text-align: center; font-size: 12px; }
        td { border: 1px solid #e5e7eb; padding: 8px; text-align: center; vertical-align: middle; }
        tr:nth-child(even) td { background: #f9fafb; }
        .zero { background: #fef2f2; color: #ef4444; border-radius: 4px; padding: 2px 6px; font-size: 11px; }
        .ok { background: #f0fdf4; color: #16a34a; border-radius: 4px; padding: 2px 6px; font-size: 11px; }
        .footer { margin-top: 20px; text-align: center; color: #aaa; font-size: 11px; border-top: 1px solid #eee; padding-top: 10px; }
      </style></head>
      <body>${content}</body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
  };

  if (selectedProduct) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <ProductDetailView itemId={selectedProduct} year={year} onBack={() => setSelectedProduct(null)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#2D9B6E]" />
            تقارير المنتجات التفصيلية
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تحليل مفصّل لأداء كل منتج — المبيعات، الإيرادات، القنوات، والتوجهات الشهرية والسنوية
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintSummary} className="gap-2">
            <Printer className="w-4 h-4" />
            طباعة الملخص
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">من تاريخ</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-sm" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">إلى تاريخ</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-sm" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">السنة للتفاصيل</label>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2026, 2025, 2024, 2023].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ترتيب حسب</label>
              <Select value={sort} onValueChange={v => setSort(v as any)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qty">الأكثر مبيعاً</SelectItem>
                  <SelectItem value="revenue">الأعلى إيراداً</SelectItem>
                  <SelectItem value="name">الاسم</SelectItem>
                  <SelectItem value="zero">الأقل مبيعاً (بالأول)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">بحث</label>
              <div className="relative">
                <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="اسم المنتج أو الفئة..." value={search} onChange={e => setSearch(e.target.value)} className="pr-8 text-sm" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المبيعات", value: totalQty.toLocaleString("ar-SA"), icon: ShoppingCart, color: "#2D9B6E" },
          { label: "إجمالي الإيرادات", value: `${formatSAR(totalRevenue)} ريال`, icon: Banknote, color: "#3b82f6" },
          { label: "منتجات بدون مبيعات", value: zeroProducts.length, icon: AlertCircle, color: "#ef4444" },
          { label: "المنتج الأكثر مبيعاً", value: topProduct?.nameAr || "—", icon: Star, color: "#f59e0b" },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.color + "20" }}>
                <k.icon className="w-5 h-5" style={{ color: k.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="font-bold text-sm truncate">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#2D9B6E]" />
              تفاصيل كل منتج ({filtered.length} منتج)
            </span>
            {zeroProducts.length > 0 && (
              <Badge variant="outline" className="text-red-500 border-red-200 text-xs gap-1">
                <AlertCircle className="w-3 h-3" />
                {zeroProducts.length} منتج بدون مبيعات
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-8 h-8 animate-spin text-[#2D9B6E]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">لا توجد منتجات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right py-3 px-4 font-semibold">#</th>
                    <th className="text-right py-3 px-4 font-semibold">المنتج</th>
                    <th className="text-center py-3 px-4 font-semibold">الفئة</th>
                    <th className="text-center py-3 px-4 font-semibold">السعر</th>
                    <th className="text-center py-3 px-4 font-semibold">الكمية المباعة</th>
                    <th className="text-center py-3 px-4 font-semibold">الإيرادات (ريال)</th>
                    <th className="text-center py-3 px-4 font-semibold">الطلبات</th>
                    <th className="text-center py-3 px-4 font-semibold">الحالة</th>
                    <th className="text-center py-3 px-4 font-semibold">التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => {
                    const maxQ = Math.max(...filtered.map(x => x.totalQty), 1);
                    return (
                      <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.nameAr} className="w-9 h-9 rounded-lg object-cover border" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{p.nameAr}</p>
                              {p.nameEn && <p className="text-xs text-muted-foreground">{p.nameEn}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="text-xs">{p.category || "—"}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{formatSAR(p.price)}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`font-bold ${p.totalQty === 0 ? "text-red-400" : "text-foreground"}`}>
                              {p.totalQty}
                            </span>
                            <div className="w-16">
                              <BarMini value={p.totalQty} max={maxQ} color={p.totalQty === 0 ? "#ef4444" : "#2D9B6E"} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{formatSAR(p.totalRevenue)}</td>
                        <td className="py-3 px-4 text-center">{p.orderCount}</td>
                        <td className="py-3 px-4 text-center">
                          {!p.available ? (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <XCircle className="w-3 h-3" /> نافد
                            </Badge>
                          ) : p.totalQty === 0 ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs gap-1">
                              <AlertCircle className="w-3 h-3" /> لا مبيعات
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" /> نشط
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedProduct(p.id)}
                            className="gap-1 text-xs h-7"
                          >
                            <ChevronRight className="w-3 h-3" />
                            عرض
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden print summary */}
      <div ref={printRef} className="hidden">
        <div className="header">
          <img src="/cluny-logo.png" alt="CLUNY CAFE" />
          <div>
            <h1>CLUNY CAFE — تقرير مبيعات المنتجات</h1>
            <p style={{ fontSize: 12, color: "#666" }}>الفترة: {fromDate} إلى {toDate} | تم الإنشاء: {new Date().toLocaleDateString("ar-SA")}</p>
          </div>
        </div>
        <div className="kpi-row">
          <div className="kpi"><div className="v">{totalQty.toLocaleString()}</div><div className="l">إجمالي المبيعات</div></div>
          <div className="kpi"><div className="v">{formatSAR(totalRevenue)}</div><div className="l">الإيرادات (ريال)</div></div>
          <div className="kpi"><div className="v">{products.length}</div><div className="l">عدد المنتجات</div></div>
          <div className="kpi"><div className="v">{zeroProducts.length}</div><div className="l">منتجات بدون مبيعات</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>المنتج</th><th>الفئة</th><th>السعر</th>
              <th>الكمية</th><th>الإيرادات (ريال)</th><th>الطلبات</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => (
              <tr key={p.id}>
                <td>{idx + 1}</td>
                <td style={{ textAlign: "right" }}>{p.nameAr}</td>
                <td>{p.category || "—"}</td>
                <td>{formatSAR(p.price)}</td>
                <td>{p.totalQty > 0 ? <span className="ok">{p.totalQty}</span> : <span className="zero">لا مبيعات</span>}</td>
                <td>{formatSAR(p.totalRevenue)}</td>
                <td>{p.orderCount}</td>
                <td>{!p.available ? "نافد المخزون" : p.totalQty === 0 ? "لا مبيعات" : "نشط"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="footer">
          تقرير أنشئ بواسطة CLUNY CAFE — نظام إدارة المقاهي الرقمي | {new Date().toLocaleString("ar-SA")}
        </div>
      </div>
    </div>
  );
}

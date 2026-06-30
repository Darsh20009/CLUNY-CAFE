import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Search, Printer, TrendingUp, TrendingDown, Package, ShoppingBag, Clock, Calendar, Star, BarChart2, ArrowRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brand } from "@/lib/brand";

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const CHANNEL_LABELS: Record<string, string> = { pos: "POS كاشير", online: "طلب إلكتروني", delivery: "توصيل", takeaway: "تيك أواي", dine_in: "داخل المقهى" };
const PAYMENT_LABELS: Record<string, string> = { cash: "نقدي", card: "بطاقة", split: "مقسم", qahwa_card: "بطاقة كلوني", apple_pay: "Apple Pay" };
const TEAL = brand.colors.primary.hex;
const COLORS = [TEAL, "#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#00BCD4"];
const currentYear = new Date().getFullYear();

function kpi(label: string, value: string | number, sub?: string, up?: boolean) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className={`text-xs font-medium ${up === true ? "text-green-600" : up === false ? "text-red-500" : "text-gray-400"}`}>{sub}</span>}
    </div>
  );
}

export default function ProductAnalyticsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [year, setYear] = useState(String(currentYear));
  const [tab, setTab] = useState<"monthly" | "hourly" | "channel">("monthly");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: listData, isLoading: listLoading } = useQuery<any>({
    queryKey: ["/api/analytics/products"],
  });

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/analytics/products", selectedId, year],
    queryFn: () => fetch(`/api/analytics/products/${selectedId}?year=${year}`, { credentials: "include", headers: { "X-Employee-Id": localStorage.getItem("employeeId") || "", "X-Restore-Key": localStorage.getItem("restoreKey") || "" } }).then(r => r.json()),
    enabled: !!selectedId,
  });

  const products: any[] = listData?.products || [];
  const filtered = products.filter(p => p.nameAr.includes(search) || (p.nameEn || "").toLowerCase().includes(search.toLowerCase()));

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = document.createElement("iframe");
    win.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:800px;height:1px";
    document.body.appendChild(win);
    const doc = win.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير منتج</title>
    <style>
      *{box-sizing:border-box;font-family:'Tajawal',Arial,sans-serif}
      body{margin:0;padding:20px;color:#111;background:#fff}
      .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #2D9B6E;padding-bottom:12px}
      .logo{width:80px;height:80px;object-fit:contain}
      h1{color:#2D9B6E;font-size:22px;margin:6px 0}
      h2{font-size:16px;color:#444;margin:4px 0}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
      .kpi{border:1px solid #eee;border-radius:10px;padding:10px;text-align:center}
      .kpi .val{font-size:22px;font-weight:700;color:#2D9B6E}
      .kpi .lbl{font-size:11px;color:#666}
      table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
      th{background:#2D9B6E;color:#fff;padding:8px;text-align:right}
      td{padding:6px 8px;border-bottom:1px solid #f0f0f0}
      tr:nth-child(even) td{background:#f9f9f9}
      .section{margin-top:20px;break-inside:avoid}
      .section-title{font-size:15px;font-weight:700;color:#2D9B6E;border-right:4px solid #2D9B6E;padding-right:8px;margin-bottom:10px}
      .footer{text-align:center;font-size:11px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:10px}
    </style></head><body>${content}<script>window.onload=function(){window.print();}</script></body></html>`);
    doc.close();
    win.addEventListener("afterprint", () => document.body.removeChild(win));
    setTimeout(() => { try { document.body.removeChild(win); } catch {} }, 30000);
  };

  const selectedProduct = detail?.item;
  const currentYearMonths: any[] = detail?.currentYearMonths || [];
  const prevYearMonths: any[] = detail?.prevYearMonths || [];
  const hourly: any[] = detail?.hourlyDistribution || [];
  const channels: any[] = detail?.channelBreakdown || [];
  const payments: any[] = detail?.paymentBreakdown || [];
  const daysOfWeek: any[] = detail?.dayOfWeekDistribution || [];
  const cy = detail?.currentYearTotal || { qty: 0, revenue: 0 };
  const py = detail?.prevYearTotal || { qty: 0, revenue: 0 };
  const qtyGrowth = py.qty > 0 ? Math.round(((cy.qty - py.qty) / py.qty) * 100) : null;
  const revGrowth = py.revenue > 0 ? Math.round(((cy.revenue - py.revenue) / py.revenue) * 100) : null;

  const monthlyChartData = ARABIC_MONTHS.map((name, i) => ({
    name,
    [String(year)]: currentYearMonths[i]?.qty || 0,
    [String(Number(year) - 1)]: prevYearMonths[i]?.qty || 0,
    revenue: currentYearMonths[i]?.revenue || 0,
  }));

  const hourlyChartData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    qty: hourly.find(x => x.hour === h)?.qty || 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-primary" />
              تقارير المنتجات المفصلة
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">تحليل مبيعات كل منتج — شهرياً، سنوياً، وتوزيع القنوات</p>
          </div>
          {selectedId && (
            <Button onClick={handlePrint} className="gap-2 bg-primary hover:bg-primary/90">
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ابحث عن منتج..."
                  className="pr-9 text-right"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">{filtered.length} منتج</p>
            </div>
            <div className="overflow-y-auto max-h-[600px]">
              {listLoading ? (
                <div className="p-8 text-center text-gray-400">جاري التحميل...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400">لا توجد نتائج</div>
              ) : (
                filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-right ${selectedId === p.id ? "bg-primary/5 border-r-2 border-r-primary" : ""}`}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.nameAr} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{p.nameAr}</div>
                      <div className="text-xs text-gray-400">{p.totalQty > 0 ? `${p.totalQty} مباع` : "لم يُباع"} · {p.price} ر.س</div>
                    </div>
                    {p.totalQty > 0 ? (
                      <Badge className="text-xs bg-green-100 text-green-700 border-0">{p.totalQty}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-gray-400">0</Badge>
                    )}
                    <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-2">
            {!selectedId ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col items-center justify-center p-12 text-center">
                <BarChart2 className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-gray-400 font-medium">اختر منتجاً من القائمة</p>
                <p className="text-xs text-gray-300 mt-1">لعرض التقرير المفصل لمبيعاته</p>
              </div>
            ) : detailLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full flex items-center justify-center p-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : detail && (
              <div ref={printRef}>
                {/* Print Header (hidden on screen, shown on print) */}
                <div className="print-header hidden print:block header mb-6 text-center">
                  <img src="/logo.png" alt="CLUNY CAFE" className="logo mx-auto" />
                  <h1>تقرير مبيعات منتج — CLUNY CAFE</h1>
                  <h2>{selectedProduct?.nameAr} ({selectedProduct?.nameEn})</h2>
                  <p style={{ fontSize: 12, color: "#666" }}>سنة {year} — تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</p>
                </div>

                <div className="space-y-4">
                  {/* Product Header */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-4">
                      {selectedProduct?.imageUrl && (
                        <img src={selectedProduct.imageUrl} alt={selectedProduct.nameAr} className="w-16 h-16 rounded-xl object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-bold text-gray-900">{selectedProduct?.nameAr}</h2>
                          <Badge variant="outline" className="text-xs">{selectedProduct?.category}</Badge>
                          {selectedProduct?.availabilityStatus === 'out_of_stock' && <Badge className="bg-red-100 text-red-700 border-0 text-xs">نفد المخزون</Badge>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{selectedProduct?.nameEn} · السعر: {selectedProduct?.price} ر.س</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">السنة:</span>
                        <Select value={year} onValueChange={setYear}>
                          <SelectTrigger className="w-24 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="h-8 w-8 p-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 kpis">
                    {kpi("إجمالي المباع " + year, cy.qty, qtyGrowth !== null ? `${qtyGrowth > 0 ? "+" : ""}${qtyGrowth}% عن ${Number(year) - 1}` : "أول سنة", qtyGrowth !== null ? qtyGrowth > 0 : undefined)}
                    {kpi("الإيراد " + year, `${cy.revenue.toLocaleString()} ر.س`, revGrowth !== null ? `${revGrowth > 0 ? "+" : ""}${revGrowth}%` : undefined, revGrowth !== null ? revGrowth > 0 : undefined)}
                    {kpi("المباع " + (Number(year) - 1), py.qty, `${py.revenue.toLocaleString()} ر.س`)}
                    {kpi("أفضل يوم", detail?.peakDay?.dayName || "—", detail?.peakDay ? `${detail.peakDay.qty} وحدة` : undefined)}
                  </div>

                  {/* Tabs */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex border-b border-gray-100">
                      {[
                        { id: "monthly", label: "شهري / سنوي", icon: Calendar },
                        { id: "hourly", label: "توزيع الساعات", icon: Clock },
                        { id: "channel", label: "القنوات والدفع", icon: ShoppingBag },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTab(t.id as any)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === t.id ? "text-primary border-b-2 border-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          <t.icon className="w-4 h-4" />
                          <span className="hidden sm:inline">{t.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="p-4">
                      {tab === "monthly" && (
                        <div className="space-y-4 section">
                          <div className="section-title hidden print:block">المبيعات الشهرية</div>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={monthlyChartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v: any, n: string) => [v + " وحدة", n]} />
                              <Legend />
                              <Bar dataKey={year} fill={TEAL} radius={[4, 4, 0, 0]} name={`مبيعات ${year}`} />
                              <Bar dataKey={String(Number(year) - 1)} fill="#ccc" radius={[4, 4, 0, 0]} name={`مبيعات ${Number(year) - 1}`} />
                            </BarChart>
                          </ResponsiveContainer>

                          {/* Monthly Table */}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-right">
                                <th className="px-3 py-2 font-semibold text-gray-600">الشهر</th>
                                <th className="px-3 py-2 font-semibold text-gray-600">المباع {year}</th>
                                <th className="px-3 py-2 font-semibold text-gray-600">الإيراد {year}</th>
                                <th className="px-3 py-2 font-semibold text-gray-600">المباع {Number(year) - 1}</th>
                                <th className="px-3 py-2 font-semibold text-gray-600">التغيير</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ARABIC_MONTHS.map((m, i) => {
                                const cy = currentYearMonths[i] || { qty: 0, revenue: 0 };
                                const py = prevYearMonths[i] || { qty: 0 };
                                const change = py.qty > 0 ? Math.round(((cy.qty - py.qty) / py.qty) * 100) : null;
                                return (
                                  <tr key={i} className={`border-b border-gray-50 ${cy.qty > 0 ? "" : "opacity-40"}`}>
                                    <td className="px-3 py-2 font-medium">{m}</td>
                                    <td className="px-3 py-2 text-primary font-bold">{cy.qty || "—"}</td>
                                    <td className="px-3 py-2">{cy.revenue > 0 ? cy.revenue.toFixed(1) + " ر.س" : "—"}</td>
                                    <td className="px-3 py-2 text-gray-400">{py.qty || "—"}</td>
                                    <td className="px-3 py-2">
                                      {change !== null ? (
                                        <span className={`font-medium flex items-center gap-1 ${change > 0 ? "text-green-600" : change < 0 ? "text-red-500" : "text-gray-400"}`}>
                                          {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                          {change > 0 ? "+" : ""}{change}%
                                        </span>
                                      ) : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-primary/5 font-bold">
                                <td className="px-3 py-2">الإجمالي</td>
                                <td className="px-3 py-2 text-primary">{cy.qty}</td>
                                <td className="px-3 py-2">{cy.revenue.toFixed(1)} ر.س</td>
                                <td className="px-3 py-2 text-gray-500">{py.qty}</td>
                                <td className="px-3 py-2">
                                  {qtyGrowth !== null && (
                                    <span className={qtyGrowth > 0 ? "text-green-600" : "text-red-500"}>
                                      {qtyGrowth > 0 ? "+" : ""}{qtyGrowth}%
                                    </span>
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {tab === "hourly" && (
                        <div className="space-y-4 section">
                          <div className="section-title hidden print:block">توزيع المبيعات على ساعات اليوم</div>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={hourlyChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v: any) => [v + " وحدة", "المبيعات"]} />
                              <Bar dataKey="qty" fill={TEAL} radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-primary/5 rounded-xl p-3 text-center">
                              <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                              <div className="font-bold text-lg">{detail?.peakHour ? `${detail.peakHour.hour}:00` : "—"}</div>
                              <div className="text-xs text-gray-500">أعلى ساعة مبيعات</div>
                              <div className="text-sm font-medium text-primary">{detail?.peakHour?.qty || 0} وحدة</div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                              <div className="font-semibold text-sm text-gray-700 mb-2">توزيع أيام الأسبوع</div>
                              {daysOfWeek.filter(d => d.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 4).map(d => (
                                <div key={d.day} className="flex items-center justify-between text-xs py-0.5">
                                  <span className="text-gray-600">{d.dayName}</span>
                                  <span className="font-bold text-primary">{d.qty}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {tab === "channel" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 section">
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-3">قناة البيع</div>
                            {channels.length === 0 ? (
                              <p className="text-gray-400 text-sm">لا توجد بيانات</p>
                            ) : (
                              <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                  <Pie data={channels} dataKey="qty" nameKey="channel" cx="50%" cy="50%" outerRadius={70} label={({ channel, percent }) => `${CHANNEL_LABELS[channel] || channel} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {channels.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip formatter={(v: any, n: string) => [v + " وحدة", CHANNEL_LABELS[n] || n]} />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                            <table className="w-full text-sm mt-2">
                              <tbody>
                                {channels.map((c, i) => (
                                  <tr key={c.channel} className="border-b border-gray-50">
                                    <td className="py-1.5 flex items-center gap-2">
                                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                                      {CHANNEL_LABELS[c.channel] || c.channel}
                                    </td>
                                    <td className="py-1.5 font-bold text-left">{c.qty}</td>
                                    <td className="py-1.5 text-gray-400 text-left">{cy.qty > 0 ? Math.round((c.qty / cy.qty) * 100) : 0}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-3">طريقة الدفع</div>
                            {payments.length === 0 ? (
                              <p className="text-gray-400 text-sm">لا توجد بيانات</p>
                            ) : (
                              <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                  <Pie data={payments} dataKey="qty" nameKey="method" cx="50%" cy="50%" outerRadius={70} label={({ method, percent }) => `${PAYMENT_LABELS[method] || method} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {payments.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip formatter={(v: any, n: string) => [v + " وحدة", PAYMENT_LABELS[n] || n]} />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                            <table className="w-full text-sm mt-2">
                              <tbody>
                                {payments.map((p, i) => (
                                  <tr key={p.method} className="border-b border-gray-50">
                                    <td className="py-1.5 flex items-center gap-2">
                                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLORS[(i + 2) % COLORS.length] }} />
                                      {PAYMENT_LABELS[p.method] || p.method}
                                    </td>
                                    <td className="py-1.5 font-bold text-left">{p.qty}</td>
                                    <td className="py-1.5 text-gray-400 text-left">{cy.qty > 0 ? Math.round((p.qty / cy.qty) * 100) : 0}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Zero-sales products warning */}
                  {cy.qty === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <div className="flex items-center gap-2 text-amber-700 font-semibold mb-1">
                        <Star className="w-4 h-4" />
                        لم يُباع هذا المنتج في {year}
                      </div>
                      <ul className="text-sm text-amber-600 list-disc list-inside space-y-1">
                        {selectedProduct?.availabilityStatus === 'out_of_stock' && <li>المنتج مُعلَّم كنافد من المخزون</li>}
                        {py.qty > 0 && <li>كان يُباع في العام السابق ({py.qty} وحدة) — راجع السعر أو التوفر</li>}
                        {py.qty === 0 && <li>لم يُسجَّل أي مبيع سابقاً — تحقق من ظهوره في القائمة</li>}
                        <li>تأكد من أن المنتج منشور في الفروع المطلوبة</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

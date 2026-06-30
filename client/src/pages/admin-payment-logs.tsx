import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@/lib/useTranslate";
import { SarIcon } from "@/components/sar-icon";
import {
  CreditCard, CheckCircle2, XCircle, Clock, AlertTriangle,
  Users, Globe, Wifi, RefreshCw, Filter, ChevronLeft, ChevronRight,
  Activity, BarChart3, TrendingUp, Server, Search, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface PaymentLog {
  id: string;
  event: string;
  provider: string;
  amount?: number;
  currency?: string;
  status: string;
  sessionId?: string;
  externalId?: string;
  orderId?: string;
  orderNumber?: string;
  customerPhone?: string;
  customerEmail?: string;
  errorMessage?: string;
  ipAddress?: string;
  createdAt: string;
}

interface PaymentLogsResponse {
  logs: PaymentLog[];
  total: number;
  page: number;
  pages: number;
  summary: {
    todayTotal: number;
    todaySuccess: number;
    todayFailed: number;
    todayPending: number;
    todayRevenue: number;
  };
}

interface SystemStats {
  websocket: { total: number; customers: number; staff: number; kitchen: number; pos: number };
  visitors: { uniqueVisitorsToday: number; totalPageViewsToday: number; activeVisitors: number };
  payments: { weekTotal: number; weekSuccess: number; weekFailed: number; weekSuccessRate: number };
  recentErrors: PaymentLog[];
  serverTime: string;
  uptime: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    success: { label: "ناجح", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
    failed: { label: "فاشل", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
    pending: { label: "معلق", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
    unknown: { label: "غير معروف", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: AlertTriangle },
  };
  const s = map[status] || map.unknown;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function EventBadge({ event }: { event: string }) {
  const map: Record<string, string> = {
    init: "bg-blue-100 text-blue-700",
    verify: "bg-purple-100 text-purple-700",
    callback: "bg-orange-100 text-orange-700",
    webhook: "bg-teal-100 text-teal-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[event] || "bg-gray-100 text-gray-600"}`}>
      {event}
    </span>
  );
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}س ${m}د`;
}

export default function AdminPaymentLogs() {
  const tc = useTranslate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "system">("logs");
  const [search, setSearch] = useState("");

  const buildQuery = () => {
    const params: any = { page, limit: 50 };
    if (statusFilter !== "all") params.status = statusFilter;
    if (providerFilter !== "all") params.provider = providerFilter;
    if (eventFilter !== "all") params.event = eventFilter;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return new URLSearchParams(params).toString();
  };

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<PaymentLogsResponse>({
    queryKey: ["/api/admin/payment-logs", page, statusFilter, providerFilter, eventFilter, fromDate, toDate],
    queryFn: () => fetch(`/api/admin/payment-logs?${buildQuery()}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: sysStats, isLoading: sysLoading, refetch: refetchSys } = useQuery<SystemStats>({
    queryKey: ["/api/admin/system-stats"],
    refetchInterval: 15000,
  });

  const summary = logsData?.summary;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {tc("مراقبة الدفعات والنظام", "Payments & System Monitor")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tc("تتبع كل عمليات الدفع ومستخدمي النظام في الوقت الفعلي", "Track all payment operations and system users in real time")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchLogs(); refetchSys(); }}
          className="gap-2 self-start"
          data-testid="button-refresh-stats"
        >
          <RefreshCw className="w-4 h-4" />
          {tc("تحديث", "Refresh")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([["logs", "💳 سجل الدفعات", "Payment Logs"], ["system", "📡 حالة النظام", "System Status"]] as const).map(([tab, ar, en]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${tab}`}
          >
            {tc(ar, en)}
          </button>
        ))}
      </div>

      {/* ── PAYMENT LOGS TAB ── */}
      {activeTab === "logs" && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: tc("إجمالي اليوم", "Today Total"), value: summary?.todayTotal ?? "—", icon: CreditCard, color: "text-blue-600" },
              { label: tc("ناجحة", "Success"), value: summary?.todaySuccess ?? "—", icon: CheckCircle2, color: "text-green-600" },
              { label: tc("فاشلة", "Failed"), value: summary?.todayFailed ?? "—", icon: XCircle, color: "text-red-600" },
              { label: tc("معلقة", "Pending"), value: summary?.todayPending ?? "—", icon: Clock, color: "text-yellow-600" },
              {
                label: tc("إيرادات اليوم", "Today Revenue"),
                value: summary?.todayRevenue !== undefined ? (
                  <span className="flex items-center gap-1">{summary.todayRevenue.toFixed(2)} <SarIcon /></span>
                ) : "—",
                icon: TrendingUp, color: "text-primary"
              },
            ].map((card, i) => (
              <div key={i} className="rounded-xl border bg-background p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <p className="text-xl font-bold">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-2.5 top-1.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tc("ابحث برقم الطلب أو الجلسة أو الهاتف...", "Search by order, session, or phone...")}
                className="w-full h-8 rounded-lg border border-input bg-background pr-8 pl-7 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-search-payments"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute left-2 top-1.5 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-8 text-xs" data-testid="filter-status">
                <SelectValue placeholder={tc("الحالة", "Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("كل الحالات", "All Status")}</SelectItem>
                <SelectItem value="success">{tc("ناجح", "Success")}</SelectItem>
                <SelectItem value="failed">{tc("فاشل", "Failed")}</SelectItem>
                <SelectItem value="pending">{tc("معلق", "Pending")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-8 text-xs" data-testid="filter-provider">
                <SelectValue placeholder={tc("البوابة", "Provider")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("كل البوابات", "All Providers")}</SelectItem>
                <SelectItem value="geidea">Geidea</SelectItem>
                <SelectItem value="paymob">Paymob</SelectItem>
                <SelectItem value="neoleap">NeoLeap</SelectItem>
                <SelectItem value="cash">نقدي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-8 text-xs" data-testid="filter-event">
                <SelectValue placeholder={tc("النوع", "Event")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("كل الأنواع", "All Events")}</SelectItem>
                <SelectItem value="init">init</SelectItem>
                <SelectItem value="verify">verify</SelectItem>
                <SelectItem value="callback">callback</SelectItem>
                <SelectItem value="webhook">webhook</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 w-36 text-xs" data-testid="input-from-date" />
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 w-36 text-xs" data-testid="input-to-date" />
            {(statusFilter !== "all" || providerFilter !== "all" || eventFilter !== "all" || fromDate || toDate) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setStatusFilter("all"); setProviderFilter("all"); setEventFilter("all"); setFromDate(""); setToDate(""); setPage(1); }}>
                {tc("مسح الفلاتر", "Clear")}
              </Button>
            )}
          </div>

          {/* Logs Table */}
          <div className="rounded-xl border overflow-hidden">
            {logsLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                {tc("جاري التحميل...", "Loading...")}
              </div>
            ) : !logsData?.logs.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <CreditCard className="w-8 h-8 opacity-30" />
                <p className="text-sm">{tc("لا توجد عمليات دفع بعد", "No payment logs yet")}</p>
                <p className="text-xs">{tc("ستظهر العمليات هنا فور حدوثها", "Operations will appear here as they happen")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        tc("الوقت", "Time"),
                        tc("النوع", "Event"),
                        tc("البوابة", "Provider"),
                        tc("المبلغ", "Amount"),
                        tc("الحالة", "Status"),
                        tc("رقم الطلب", "Order"),
                        tc("العميل", "Customer"),
                        tc("المعرّف الخارجي", "External ID"),
                        tc("ملاحظات", "Notes"),
                      ].map((h, i) => (
                        <th key={i} className="text-right text-xs text-muted-foreground font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logsData.logs.filter(log => {
                      if (!search.trim()) return true;
                      const q = search.toLowerCase();
                      return (
                        log.orderId?.toLowerCase().includes(q) ||
                        log.orderNumber?.toLowerCase().includes(q) ||
                        log.sessionId?.toLowerCase().includes(q) ||
                        log.externalId?.toLowerCase().includes(q) ||
                        log.customerPhone?.toLowerCase().includes(q) ||
                        log.customerEmail?.toLowerCase().includes(q) ||
                        log.provider?.toLowerCase().includes(q)
                      );
                    }).map(log => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-payment-log-${log.id}`}>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                          {new Date(log.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3 py-2.5"><EventBadge event={log.event} /></td>
                        <td className="px-3 py-2.5 font-medium text-xs">{log.provider}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {log.amount ? <span className="flex items-center gap-1 font-semibold">{log.amount.toFixed(2)} <SarIcon /></span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5"><StatusBadge status={log.status} /></td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{log.orderId || log.orderNumber || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground" dir="ltr">{log.customerPhone || log.customerEmail || "—"}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground max-w-[120px] truncate" dir="ltr" title={log.externalId}>{log.externalId || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-red-500 max-w-[200px] truncate" title={log.errorMessage}>{log.errorMessage || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {logsData && logsData.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground text-xs">
                {tc(`${logsData.total} عملية إجمالاً — صفحة ${logsData.page} من ${logsData.pages}`, `${logsData.total} total — page ${logsData.page} of ${logsData.pages}`)}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= logsData.pages} onClick={() => setPage(p => p + 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SYSTEM STATUS TAB ── */}
      {activeTab === "system" && (
        <div className="space-y-5">
          {sysLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
              {tc("جاري التحميل...", "Loading...")}
            </div>
          ) : sysStats && (
            <>
              {/* WS Connections */}
              <div className="rounded-xl border bg-background p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-primary" />
                  <h3 className="font-bold">{tc("الاتصالات النشطة (WebSocket)", "Active Connections (WebSocket)")}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-pulse">
                    {tc("مباشر", "Live")}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: tc("إجمالي المتصلين", "Total Connected"), value: sysStats.websocket.total, icon: Users, color: "text-primary" },
                    { label: tc("عملاء", "Customers"), value: sysStats.websocket.customers, icon: Globe, color: "text-blue-500" },
                    { label: tc("موظفون", "Staff"), value: sysStats.websocket.staff, icon: Users, color: "text-violet-500" },
                    { label: tc("مطبخ", "Kitchen"), value: sysStats.websocket.kitchen, icon: Activity, color: "text-orange-500" },
                    { label: tc("POS", "POS"), value: sysStats.websocket.pos, icon: CreditCard, color: "text-teal-500" },
                  ].map((card, i) => (
                    <div key={i} className="rounded-lg bg-muted/30 p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <card.icon className={`w-4 h-4 ${card.color}`} />
                        <span className="text-xs text-muted-foreground">{card.label}</span>
                      </div>
                      <p className="text-2xl font-bold">{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visitors */}
              <div className="rounded-xl border bg-background p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold">{tc("زوار النظام اليوم", "Today's System Visitors")}</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: tc("نشطون الآن (آخر 5 دقائق)", "Active Now (last 5 min)"), value: sysStats.visitors.activeVisitors, color: "text-green-600" },
                    { label: tc("زوار فريدون اليوم", "Unique Visitors Today"), value: sysStats.visitors.uniqueVisitorsToday, color: "text-blue-600" },
                    { label: tc("مشاهدات الصفحات اليوم", "Page Views Today"), value: sysStats.visitors.totalPageViewsToday, color: "text-violet-600" },
                  ].map((card, i) => (
                    <div key={i} className="rounded-lg bg-muted/30 p-4 space-y-1">
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment 7-day stats */}
              <div className="rounded-xl border bg-background p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-500" />
                  <h3 className="font-bold">{tc("إحصائيات الدفع (آخر 7 أيام)", "Payment Stats (Last 7 Days)")}</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: tc("إجمالي العمليات", "Total Ops"), value: sysStats.payments.weekTotal, color: "text-foreground" },
                    { label: tc("ناجحة", "Successful"), value: sysStats.payments.weekSuccess, color: "text-green-600" },
                    { label: tc("فاشلة", "Failed"), value: sysStats.payments.weekFailed, color: "text-red-500" },
                    { label: tc("معدل النجاح", "Success Rate"), value: `${sysStats.payments.weekSuccessRate}%`, color: sysStats.payments.weekSuccessRate >= 90 ? "text-green-600" : sysStats.payments.weekSuccessRate >= 70 ? "text-yellow-600" : "text-red-600" },
                  ].map((card, i) => (
                    <div key={i} className="rounded-lg bg-muted/30 p-4 space-y-1">
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Server info */}
              <div className="rounded-xl border bg-background p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-bold">{tc("معلومات السيرفر", "Server Info")}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tc("وقت التشغيل", "Uptime")}</span>
                    <span className="font-medium">{formatUptime(sysStats.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tc("وقت السيرفر", "Server Time")}</span>
                    <span className="font-medium" dir="ltr">{new Date(sysStats.serverTime).toLocaleTimeString('ar-SA')}</span>
                  </div>
                </div>
              </div>

              {/* Recent payment errors */}
              {sysStats.recentErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-background p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <h3 className="font-bold text-red-600">{tc("آخر أخطاء الدفع", "Recent Payment Errors")}</h3>
                  </div>
                  <div className="space-y-2">
                    {sysStats.recentErrors.map(err => (
                      <div key={err.id} className="rounded-lg bg-red-50 dark:bg-red-900/10 p-3 flex items-start gap-3">
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-red-700 dark:text-red-400">{err.provider}</span>
                            <EventBadge event={err.event} />
                            {err.orderId && <span className="text-xs text-muted-foreground">#{err.orderId}</span>}
                            {err.amount && <span className="text-xs font-medium">{err.amount} SAR</span>}
                            <span className="text-[10px] text-muted-foreground" dir="ltr">
                              {new Date(err.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          {err.errorMessage && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err.errorMessage}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

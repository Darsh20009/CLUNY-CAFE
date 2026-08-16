import { useState, useEffect } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, CreditCard, CheckCircle2, XCircle, Clock, Phone,
  ChevronLeft, RefreshCw, Receipt, AlertCircle, TrendingUp, Wifi
} from "lucide-react";
import SarIcon from "@/components/sar-icon";
import { ManagerLayout } from "@/components/manager-layout";
import { useLocation } from "wouter";

interface PaymentLog {
  _id: string;
  id: string;
  provider: string;
  event: string;
  status: string;
  amount?: number;
  currency?: string;
  orderNumber?: string;
  orderId?: string;
  customerPhone?: string;
  customerEmail?: string;
  errorMessage?: string;
  externalId?: string;
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

type Period = "today" | "week" | "month" | "all";

function statusBadge(status: string, tc: (a: string, b: string) => string) {
  if (status === "success")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200">
        <CheckCircle2 className="w-3 h-3 ml-1" />
        {tc("ناجح", "Success")}
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200">
        <XCircle className="w-3 h-3 ml-1" />
        {tc("فشل", "Failed")}
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
        <Clock className="w-3 h-3 ml-1" />
        {tc("قيد التنفيذ", "Pending")}
      </Badge>
    );
  return <Badge variant="secondary">{status}</Badge>;
}

function providerLabel(provider: string) {
  const map: Record<string, string> = {
    paymob: "Paymob",
    geidea: "Geidea",
    neoleap: "NeoLeap",
    cash: "كاش",
    "stc-pay": "STC Pay",
    apple_pay: "Apple Pay",
  };
  return map[provider] || provider;
}

function eventLabel(event: string, tc: (a: string, b: string) => string) {
  const map: Record<string, [string, string]> = {
    init: ["تهيئة", "Init"],
    verify: ["تحقق", "Verify"],
    callback: ["رد البوابة", "Callback"],
    webhook: ["ويب هوك", "Webhook"],
    failed: ["فشل", "Failed"],
  };
  return map[event] ? tc(map[event][0], map[event][1]) : event;
}

function getPeriodParams(period: Period): string {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return `&from=${start.toISOString()}`;
  }
  if (period === "week") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return `&from=${start.toISOString()}`;
  }
  if (period === "month") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return `&from=${start.toISOString()}`;
  }
  return "";
}

export default function PaymentTrackingPage() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [phone, setPhone] = useState("");
  const [orderNum, setOrderNum] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [period, setPeriod] = useState<Period>("today");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Build query string
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (phone.trim()) params.set("phone", phone.trim());
    if (orderNum.trim()) params.set("orderNumber", orderNum.trim());
    if (filterStatus && filterStatus !== "all") params.set("status", filterStatus);
    params.set("limit", "100");
    const periodStr = getPeriodParams(period);
    return `?${params.toString()}${periodStr}`;
  };

  const queryKey = ["/api/admin/payment-logs", phone, orderNum, filterStatus, period, lastRefresh];

  const { data, isLoading, isFetching, refetch } = useQuery<PaymentLogsResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/admin/payment-logs${buildQueryString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Manual refresh
  const handleRefresh = () => {
    setLastRefresh(Date.now());
    refetch();
  };

  const handleSearch = () => {
    setLastRefresh(Date.now());
  };

  const handleClear = () => {
    setPhone("");
    setOrderNum("");
    setFilterStatus("all");
    setLastRefresh(Date.now());
  };

  const logs = data?.logs || [];
  const summary = data?.summary;

  const periodOptions: { value: Period; labelAr: string; labelEn: string }[] = [
    { value: "today", labelAr: "اليوم", labelEn: "Today" },
    { value: "week", labelAr: "آخر 7 أيام", labelEn: "Last 7 days" },
    { value: "month", labelAr: "هذا الشهر", labelEn: "This month" },
    { value: "all", labelAr: "كل العمليات", labelEn: "All time" },
  ];

  return (
    <ManagerLayout>
      <div className="bg-white text-gray-900 min-h-screen p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                {tc("تتبع الدفعات الأونلاين", "Online Payment Tracking")}
              </h1>
              <p className="text-sm text-gray-500">{tc("جميع عمليات الدفع الإلكتروني — يتجدد كل 15 ثانية", "All online payments — auto-refreshes every 15s")}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {isFetching && <Wifi className="w-4 h-4 text-primary animate-pulse" />}
              <Button variant="outline" size="icon" onClick={handleRefresh} title={tc("تحديث", "Refresh")} data-testid="button-refresh">
                <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Summary Cards — always visible */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {[
              { label: tc("إجمالي اليوم", "Today Total"), value: summary?.todayTotal ?? "—", color: "text-gray-900", icon: <TrendingUp className="w-4 h-4 text-gray-400" /> },
              { label: tc("ناجحة", "Success"), value: summary?.todaySuccess ?? "—", color: "text-green-600", icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> },
              { label: tc("فاشلة", "Failed"), value: summary?.todayFailed ?? "—", color: "text-red-600", icon: <XCircle className="w-4 h-4 text-red-400" /> },
              { label: tc("معلقة", "Pending"), value: summary?.todayPending ?? "—", color: "text-yellow-600", icon: <Clock className="w-4 h-4 text-yellow-400" /> },
              {
                label: tc("إيرادات اليوم", "Today Revenue"),
                value: summary
                  ? <span className="flex items-center gap-1 justify-center">{(summary.todayRevenue || 0).toLocaleString()} <SarIcon size={12} /></span>
                  : "—",
                color: "text-primary",
                icon: <CreditCard className="w-4 h-4 text-primary/50" />,
              },
            ].map((s, i) => (
              <Card key={i} className="border-gray-200">
                <CardContent className="p-3 text-center">
                  <div className="flex justify-center mb-1">{s.icon}</div>
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card className="mb-5 border-gray-200">
            <CardContent className="p-4">
              {/* Period tabs */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setPeriod(opt.value); setLastRefresh(Date.now()); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      period === opt.value
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    data-testid={`button-period-${opt.value}`}
                  >
                    {tc(opt.labelAr, opt.labelEn)}
                  </button>
                ))}
              </div>

              {/* Search row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative md:col-span-2">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={tc("رقم جوال العميل", "Customer phone")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pr-9 text-right"
                    data-testid="input-payment-phone"
                  />
                </div>
                <div className="relative">
                  <Receipt className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={tc("رقم الطلب", "Order number")}
                    value={orderNum}
                    onChange={(e) => setOrderNum(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pr-9 text-right"
                    data-testid="input-payment-order"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setLastRefresh(Date.now()); }}>
                  <SelectTrigger data-testid="select-payment-status">
                    <SelectValue placeholder={tc("كل الحالات", "All statuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tc("كل الحالات", "All statuses")}</SelectItem>
                    <SelectItem value="success">{tc("ناجح", "Success")}</SelectItem>
                    <SelectItem value="pending">{tc("قيد التنفيذ", "Pending")}</SelectItem>
                    <SelectItem value="failed">{tc("فشل", "Failed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 mt-3">
                <Button onClick={handleSearch} className="flex-1 bg-primary text-white" data-testid="button-payment-search">
                  <Search className="w-4 h-4 ml-2" />
                  {tc("بحث", "Search")}
                </Button>
                <Button variant="outline" onClick={handleClear}>
                  {tc("مسح", "Clear")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{tc("جاري تحميل المدفوعات...", "Loading payments...")}</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && logs.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">{tc("لا توجد سجلات دفع لهذه الفترة", "No payment records for this period")}</p>
              <p className="text-xs opacity-60">{tc("ستظهر عمليات الدفع هنا فور حدوثها", "Payment operations will appear here as they happen")}</p>
            </div>
          )}

          {/* Logs table */}
          {!isLoading && logs.length > 0 && (
            <Card className="border-gray-200">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                  <span>
                    {tc("سجلات الدفع", "Payment Records")} ({data?.total})
                  </span>
                  <span className="text-xs font-normal text-gray-400">
                    {tc("آخر تحديث", "Last update")}: {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <div
                      key={log._id || log.id}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                      data-testid={`payment-log-${log.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {statusBadge(log.status, tc)}
                            <Badge variant="outline" className="text-xs">
                              {providerLabel(log.provider)}
                            </Badge>
                            <span className="text-xs text-gray-400">{eventLabel(log.event, tc)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm flex-wrap">
                            {log.orderNumber && (
                              <span className="font-mono font-medium text-gray-800">#{log.orderNumber}</span>
                            )}
                            {log.customerPhone && (
                              <span className="text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {log.customerPhone}
                              </span>
                            )}
                            {log.externalId && (
                              <span className="text-gray-400 text-xs truncate max-w-[120px]" title={log.externalId}>
                                ID: {log.externalId.slice(0, 16)}...
                              </span>
                            )}
                          </div>
                          {log.errorMessage && (
                            <p className="text-xs text-red-500 mt-1 truncate" title={log.errorMessage}>
                              {log.errorMessage}
                            </p>
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          {log.amount ? (
                            <p className="font-bold text-gray-900 flex items-center gap-1">
                              {log.amount.toLocaleString()} <SarIcon size={12} />
                            </p>
                          ) : null}
                          <p className="text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleDateString("ar-SA", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}

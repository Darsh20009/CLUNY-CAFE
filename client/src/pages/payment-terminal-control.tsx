import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CreditCard, Wifi, WifiOff, CheckCircle2, XCircle, AlertCircle, Loader2,
  Settings, Play, RefreshCw, Ban, RotateCcw, ChevronRight, Banknote,
  Smartphone, Globe, Zap, Shield, Clock, TrendingUp, Monitor
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const DRIVERS = [
  { id: "geidea", nameAr: "Geidea", nameEn: "Geidea", logo: "💳", color: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700", icon: Globe },
  { id: "mada", nameAr: "مدى", nameEn: "Mada", logo: "🏦", color: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-700", icon: CreditCard },
  { id: "stcbank", nameAr: "STC Bank", nameEn: "STC Bank", logo: "📱", color: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700", icon: Smartphone },
  { id: "foodicspay", nameAr: "Foodics Pay", nameEn: "Foodics Pay", logo: "🍽️", color: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700", icon: Zap },
  { id: "rajhi", nameAr: "مصرف الراجحي", nameEn: "Al Rajhi Bank", logo: "🟢", color: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700", icon: Shield },
  { id: "ahli", nameAr: "البنك الأهلي", nameEn: "Al Ahli Bank", logo: "🔵", color: "bg-cyan-50 border-cyan-200", badge: "bg-cyan-100 text-cyan-700", icon: TrendingUp },
  { id: "manual", nameAr: "يدوي", nameEn: "Manual", logo: "✅", color: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-700", icon: CheckCircle2 },
];

const STATUS_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  online: { icon: Wifi, label: "متصل", color: "text-green-600", bg: "bg-green-100" },
  offline: { icon: WifiOff, label: "غير متصل", color: "text-gray-500", bg: "bg-gray-100" },
  busy: { icon: Loader2, label: "مشغول", color: "text-yellow-600", bg: "bg-yellow-100" },
  error: { icon: AlertCircle, label: "خطأ", color: "text-red-600", bg: "bg-red-100" },
  unknown: { icon: AlertCircle, label: "غير معروف", color: "text-gray-400", bg: "bg-gray-50" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function PaymentTerminalControl() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("terminals");
  const [payDialog, setPayDialog] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payOrderId, setPayOrderId] = useState("");
  const [configDialog, setConfigDialog] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});

  const { data: terminalsRaw, isLoading: tLoading, refetch: refetchTerminals } = useQuery<any[]>({
    queryKey: ["/api/payment-terminal/terminals"],
    refetchInterval: 30000,
  });

  const { data: configRaw } = useQuery<any>({
    queryKey: ["/api/payment-terminal/config"],
  });

  const { data: txnsRaw } = useQuery<any[]>({
    queryKey: ["/api/payment-terminal/transactions"],
    refetchInterval: 10000,
  });

  const terminals = terminalsRaw || [];
  const config = configRaw || {};
  const txns = txnsRaw || [];
  const activeId = config.activeDriverId || "manual";

  const setActiveMut = useMutation({
    mutationFn: (driverId: string) => apiRequest("POST", "/api/payment-terminal/set-active", { driverId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payment-terminal/config"] });
      qc.invalidateQueries({ queryKey: ["/api/payment-terminal/terminals"] });
      toast({ title: "تم تغيير جهاز الدفع النشط" });
    },
  });

  const payMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment-terminal/pay", data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/payment-terminal/transactions"] });
      if (res?.response?.success) {
        toast({ title: "✅ تمت عملية الدفع بنجاح", description: `رقم المعاملة: ${res?.txn?.transactionId || res?.txn?.id}` });
      } else {
        toast({ title: "❌ فشل الدفع", description: res?.response?.error || "خطأ غير معروف", variant: "destructive" });
      }
      setPayDialog(false);
      setPayAmount("");
      setPayOrderId("");
    },
  });

  const saveCfgMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment-terminal/configure", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payment-terminal/config"] });
      qc.invalidateQueries({ queryKey: ["/api/payment-terminal/terminals"] });
      toast({ title: "تم حفظ إعدادات الجهاز" });
      setConfigDialog(null);
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/payment-terminal/cancel", {}),
    onSuccess: () => {
      toast({ title: "تم إلغاء العملية" });
      qc.invalidateQueries({ queryKey: ["/api/payment-terminal/transactions"] });
    },
  });

  function openConfig(driverId: string) {
    const driverCfg = config?.drivers?.[driverId] || {};
    setConfigForm(driverCfg);
    setConfigDialog(driverId);
  }

  function saveConfig() {
    if (!configDialog) return;
    saveCfgMut.mutate({
      drivers: { ...(config.drivers || {}), [configDialog]: configForm },
      activeDriverId: activeId,
    });
  }

  const CONFIG_FIELDS: Record<string, { key: string; label: string; type?: string }[]> = {
    geidea: [
      { key: "merchantId", label: "Merchant ID" },
      { key: "apiPassword", label: "API Password", type: "password" },
      { key: "publicKey", label: "Public Key", type: "password" },
      { key: "baseUrl", label: "Base URL (اختياري)" },
    ],
    mada: [
      { key: "terminalIp", label: "عنوان IP للجهاز (LAN)" },
      { key: "terminalPort", label: "المنفذ (port) — افتراضي 8080" },
      { key: "merchantId", label: "Merchant ID (اختياري)" },
    ],
    stcbank: [
      { key: "apiKey", label: "API Key", type: "password" },
      { key: "merchantId", label: "Merchant ID" },
      { key: "baseUrl", label: "Base URL (اختياري)" },
    ],
    foodicspay: [
      { key: "apiKey", label: "API Key", type: "password" },
      { key: "businessId", label: "Business ID" },
      { key: "baseUrl", label: "Base URL (اختياري)" },
    ],
    rajhi: [
      { key: "merchantId", label: "Merchant ID" },
      { key: "terminalId", label: "Terminal ID" },
      { key: "secretKey", label: "Secret Key", type: "password" },
      { key: "baseUrl", label: "Base URL (اختياري)" },
    ],
    ahli: [
      { key: "merchantId", label: "Merchant ID" },
      { key: "apiKey", label: "API Key", type: "password" },
      { key: "baseUrl", label: "Base URL (اختياري)" },
    ],
    manual: [],
  };

  const activeTerminal = terminals.find((t: any) => t.id === activeId);
  const activeCfg = DRIVERS.find((d) => d.id === activeId);

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">طبقة دمج أجهزة الدفع</h1>
              <p className="text-sm text-gray-500">Payment Terminal Integration Layer</p>
            </div>
          </div>
        </div>

        {/* Active Terminal Card */}
        <Card className="mb-4 border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-primary/20 flex items-center justify-center text-2xl shadow-sm">
                  {activeCfg?.logo || "💳"}
                </div>
                <div>
                  <p className="text-xs text-primary font-medium">الجهاز النشط حالياً</p>
                  <p className="text-lg font-bold text-gray-900">{activeCfg?.nameAr || activeId}</p>
                  {activeTerminal && <StatusBadge status={activeTerminal.status} />}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => refetchTerminals()} disabled={tLoading}>
                  <RefreshCw className={cn("w-4 h-4 ml-1", tLoading && "animate-spin")} />
                  فحص
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => setPayDialog(true)}
                  data-testid="button-initiate-payment"
                >
                  <Play className="w-4 h-4 ml-1" />
                  تهيئة دفعة
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="terminals">الأجهزة</TabsTrigger>
            <TabsTrigger value="transactions">المعاملات</TabsTrigger>
            <TabsTrigger value="settings">الإعدادات</TabsTrigger>
          </TabsList>

          {/* ─── Terminals Tab ─── */}
          <TabsContent value="terminals" className="space-y-3">
            {tLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              DRIVERS.map((driver) => {
                const terminalInfo = terminals.find((t: any) => t.id === driver.id);
                const isActive = driver.id === activeId;
                const isCfg = terminalInfo?.configured || driver.id === "manual";
                const Icon = driver.icon;

                return (
                  <Card
                    key={driver.id}
                    className={cn(
                      "border-2 transition-all",
                      isActive ? "border-primary shadow-md" : "border-gray-200",
                    )}
                    data-testid={`card-terminal-${driver.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center text-xl", driver.color)}>
                            {driver.logo}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{driver.nameAr}</p>
                              {isActive && <Badge className="bg-primary text-white text-xs">نشط</Badge>}
                              {!isCfg && <Badge variant="outline" className="text-xs text-gray-400">غير مُهيّأ</Badge>}
                            </div>
                            <p className="text-xs text-gray-500">{driver.nameEn}</p>
                            {terminalInfo && <StatusBadge status={terminalInfo.status} />}
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {driver.id !== "manual" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openConfig(driver.id)}
                              data-testid={`button-config-${driver.id}`}
                            >
                              <Settings className="w-3 h-3 ml-1" />
                              إعداد
                            </Button>
                          )}
                          {!isActive && (
                            <Button
                              size="sm"
                              variant={isCfg ? "default" : "outline"}
                              disabled={!isCfg || setActiveMut.isPending}
                              onClick={() => setActiveMut.mutate(driver.id)}
                              data-testid={`button-activate-${driver.id}`}
                            >
                              {setActiveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <ChevronRight className="w-3 h-3 ml-1" />}
                              تفعيل
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Features */}
                      {terminalInfo?.features && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {terminalInfo.features.map((f: string) => (
                            <span key={f} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{f}</span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ─── Transactions Tab ─── */}
          <TabsContent value="transactions" className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">آخر المعاملات</h2>
              <Button size="sm" variant="ghost" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
                <Ban className="w-3 h-3 ml-1" />
                إلغاء العملية الحالية
              </Button>
            </div>

            {txns.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">لا توجد معاملات بعد</p>
              </div>
            ) : (
              txns.map((txn: any) => (
                <Card key={txn.id} className="border border-gray-200" data-testid={`card-txn-${txn.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {txn.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : txn.status === "failed" ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : txn.status === "cancelled" ? (
                          <Ban className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{txn.amount} ريال</p>
                          <p className="text-xs text-gray-500">
                            {DRIVERS.find((d) => d.id === txn.driverId)?.nameAr || txn.driverId}
                            {txn.orderId && ` · طلب ${txn.orderId}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <Badge
                          className={cn(
                            "text-xs",
                            txn.status === "success" && "bg-green-100 text-green-700",
                            txn.status === "failed" && "bg-red-100 text-red-700",
                            txn.status === "pending" && "bg-yellow-100 text-yellow-700",
                            txn.status === "cancelled" && "bg-gray-100 text-gray-500",
                          )}
                        >
                          {txn.status === "success" ? "ناجح" : txn.status === "failed" ? "فاشل" : txn.status === "cancelled" ? "ملغي" : "قيد التنفيذ"}
                        </Badge>
                        {txn.authCode && <p className="text-xs text-gray-400 mt-0.5">Auth: {txn.authCode}</p>}
                        {txn.last4 && <p className="text-xs text-gray-400">•••• {txn.last4}</p>}
                      </div>
                    </div>
                    {txn.error && <p className="mt-2 text-xs text-red-500 bg-red-50 px-2 py-1 rounded">{txn.error}</p>}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ─── Settings Tab ─── */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">الجهاز الافتراضي</CardTitle></CardHeader>
              <CardContent>
                <Select value={activeId} onValueChange={(v) => setActiveMut.mutate(v)}>
                  <SelectTrigger data-testid="select-active-driver">
                    <SelectValue placeholder="اختر الجهاز" />
                  </SelectTrigger>
                  <SelectContent>
                    {DRIVERS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nameAr} — {d.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-2">
                  كل عمليات الدفع في النظام (POS، الكاشير، الكيوسك) ستستخدم هذا الجهاز تلقائياً.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">إعداد الأجهزة</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {DRIVERS.filter((d) => d.id !== "manual").map((d) => (
                  <Button
                    key={d.id}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => openConfig(d.id)}
                    data-testid={`button-open-config-${d.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{d.logo}</span>
                      <span>{d.nameAr}</span>
                    </span>
                    <Settings className="w-4 h-4 text-gray-400" />
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-blue-100 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Monitor className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">كيف يعمل نمط الـ Driver؟</p>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      النظام يُرسل أمر <code className="bg-blue-100 px-1 rounded">pay(150 SAR)</code> موحد — والـ Driver المحدد هو من يتواصل مع الجهاز الفعلي.
                      لإضافة جهاز جديد: اكتب Driver واحد يُطبّق الواجهة المشتركة.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Pay Dialog ─── */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              تهيئة عملية دفع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-primary/5 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">الجهاز النشط</p>
              <p className="font-bold text-primary">{activeCfg?.nameAr || activeId}</p>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (ريال)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                data-testid="input-pay-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>رقم الطلب (اختياري)</Label>
              <Input
                placeholder="ORDER-001"
                value={payOrderId}
                onChange={(e) => setPayOrderId(e.target.value)}
                data-testid="input-pay-order-id"
              />
            </div>
            <Button
              className="w-full bg-primary"
              disabled={!payAmount || Number(payAmount) <= 0 || payMut.isPending}
              onClick={() => payMut.mutate({ amount: Number(payAmount), orderId: payOrderId || undefined })}
              data-testid="button-confirm-payment"
            >
              {payMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Play className="w-4 h-4 ml-2" />}
              تنفيذ الدفع
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Config Dialog ─── */}
      <Dialog open={!!configDialog} onOpenChange={(o) => !o && setConfigDialog(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              إعدادات {DRIVERS.find((d) => d.id === configDialog)?.nameAr}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {(CONFIG_FIELDS[configDialog || "manual"] || []).map((field) => (
              <div key={field.key} className="space-y-1">
                <Label className="text-sm">{field.label}</Label>
                <Input
                  type={field.type || "text"}
                  placeholder={field.label}
                  value={configForm[field.key] || ""}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  data-testid={`input-cfg-${field.key}`}
                />
              </div>
            ))}
            {(CONFIG_FIELDS[configDialog || "manual"] || []).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">لا توجد إعدادات مطلوبة لهذا الجهاز</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfigDialog(null)}>إلغاء</Button>
              <Button className="flex-1 bg-primary" onClick={saveConfig} disabled={saveCfgMut.isPending}>
                {saveCfgMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

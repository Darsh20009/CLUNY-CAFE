import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, ImagePlus, Link2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEFAULT_INVOICE_SETTINGS, normalizeInvoiceSettings, type InvoiceQrSurface, type InvoiceSettings } from "@/lib/invoice-template";
import { useTranslate } from "@/lib/useTranslate";
import { ReceiptInvoice } from "@/components/receipt-invoice";

const ELEMENTS: Array<{ key: string; ar: string; en: string }> = [
  { key: "headerArtwork", ar: "الصورة العلوية", en: "Top artwork" },
  { key: "orderNumber", ar: "رقم الطلب", en: "Order number" },
  { key: "logo", ar: "شعار كلوني", en: "CLUNY logo" },
  { key: "businessInfo", ar: "بيانات المنشأة", en: "Business details" },
  { key: "orderType", ar: "نوع الطلب", en: "Order type" },
  { key: "cashier", ar: "اسم الكاشير", en: "Cashier name" },
  { key: "items", ar: "تفاصيل المنتجات", en: "Order items" },
  { key: "itemCount", ar: "عدد المنتجات", en: "Item count" },
  { key: "totals", ar: "الإجمالي والضريبة", en: "Totals and VAT" },
  { key: "paymentMethod", ar: "طريقة الدفع", en: "Payment method" },
  { key: "customerNotes", ar: "ملاحظات العميل", en: "Customer notes" },
  { key: "tagline", ar: "العبارة التعريفية", en: "Tagline" },
  { key: "trackingQr", ar: "باركود تتبع الطلب", en: "Order tracking QR" },
  { key: "zatcaQr", ar: "باركود الفاتورة الضريبية", en: "ZATCA invoice QR" },
  { key: "poweredBy", ar: "Powered by CLUNY SYSTEMS", en: "Powered by CLUNY SYSTEMS" },
];

const PREVIEW_ORDER: any = {
  id: "invoice-preview",
  orderNumber: "163",
  createdAt: new Date("2026-10-15T12:00:00.000Z").toISOString(),
  totalAmount: 21.85,
  paymentMethod: "cash",
  orderType: "pickup",
  employeeName: "فريق كلوني",
  items: [{ coffeeItemId: "preview-coffee", nameAr: "قهوة كلوني", nameEn: "CLUNY Coffee", quantity: 1, price: 21.85 }],
};

export function InvoiceTemplateSettings() {
  const tc = useTranslate();
  const { toast } = useToast();
  const { data: businessConfig, isLoading } = useQuery<any>({ queryKey: ["/api/business-config"] });
  const [draft, setDraft] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [newQr, setNewQr] = useState<{ label: string; content: string; surface: InvoiceQrSurface }>({ label: "", content: "", surface: "all" });

  useEffect(() => {
    if (businessConfig?.invoiceSettings) {
      setDraft(normalizeInvoiceSettings(businessConfig.invoiceSettings));
    }
  }, [businessConfig?.invoiceSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/business-config", { invoiceSettings: draft });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-config"] });
      toast({ title: tc("تم حفظ إعدادات الفاتورة", "Invoice settings saved") });
    },
    onError: (error: Error) => {
      toast({
        title: tc("تعذر حفظ إعدادات الفاتورة", "Could not save invoice settings"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateElement = (key: string, checked: boolean) => {
    setDraft((current) => ({ ...current, elements: { ...current.elements, [key]: checked } }));
  };

  const addQr = () => {
    const label = newQr.label.trim();
    const content = newQr.content.trim();
    if (!label || !content) {
      toast({
        title: tc("أكمل اسم الباركود والرابط أو النص", "Enter a QR label and link or text"),
        variant: "destructive",
      });
      return;
    }
    setDraft((current) => ({
      ...current,
      customQrs: [...current.customQrs, { ...newQr, label, content, id: `${Date.now()}-${current.customQrs.length}`, enabled: true }],
    }));
    setNewQr({ label: "", content: "", surface: "all" });
  };

  const reset = () => setDraft(normalizeInvoiceSettings(DEFAULT_INVOICE_SETTINGS));
  const handleSave = () => {
    if (draft.headerArtwork === "custom") {
      const url = draft.customArtworkUrl.trim();
      if (!/^https?:\/\//i.test(url) && !(url.startsWith("/") && !url.startsWith("//"))) {
        toast({
          title: tc("رابط الصورة غير صالح", "Invalid image URL"),
          description: tc("استخدم رابط HTTPS أو مساراً يبدأ بشرطة واحدة.", "Use an HTTPS URL or a same-site path beginning with one slash."),
          variant: "destructive",
        });
        return;
      }
    }
    saveMutation.mutate();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4" dir="rtl">
      <Card className="border-primary/20">
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-6 w-6 text-primary" /></div>
            <div>
              <CardTitle>{tc("إعدادات الفاتورة والإيصال", "Invoice and receipt settings")}</CardTitle>
              <CardDescription>{tc("اختر القالب، أظهر أو أخفِ عناصره، وأضف باركودات خاصة بكل صفحة.", "Choose a template, toggle its sections, and add QR codes for selected pages.")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-template-mode">{tc("نمط الفاتورة", "Invoice mode")}</Label>
              <select
                id="invoice-template-mode"
                value={draft.mode}
                onChange={(event) => setDraft((current) => ({ ...current, mode: event.target.value as InvoiceSettings["mode"] }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="default">{tc("الافتراضي — هوية كلوني", "Default — CLUNY branding")}</option>
                <option value="custom">{tc("تخصيص", "Custom")}</option>
              </select>
              <p className="text-xs text-muted-foreground">{tc("القالب الافتراضي يحافظ على تنسيق كلوني؛ ويمكنك تغيير العناصر الظاهرة في أي نمط.", "The default preserves CLUNY's receipt layout; visible elements can be changed in either mode.")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-template-style">{tc("شكل الفاتورة", "Receipt style")}</Label>
              <select
                id="invoice-template-style"
                value={draft.templateStyle}
                onChange={(event) => {
                  const templateStyle = event.target.value as InvoiceSettings["templateStyle"];
                  setDraft((current) => ({
                    ...current,
                    templateStyle,
                    headerArtwork: templateStyle === "patriotic" ? "campaign" : "none",
                  }));
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="standard">{tc("الشكل العادي الحالي", "Standard receipt")}</option>
                <option value="patriotic">{tc("بالغوا بالدفاع عن الوطن", "Patriotic campaign")}</option>
              </select>
              <p className="text-xs text-muted-foreground">{tc("الشكل الوطني يضع الصورة بعرض الإيصال بالكامل، ثم رقم الطلب تحتها مباشرة.", "The campaign style prints the artwork full-width, with the order number directly below.")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-header-artwork">{tc("الصورة أعلى الفاتورة", "Top invoice artwork")}</Label>
              <select
                id="invoice-header-artwork"
                value={draft.headerArtwork}
                onChange={(event) => setDraft((current) => ({ ...current, headerArtwork: event.target.value as InvoiceSettings["headerArtwork"] }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                disabled={draft.mode !== "custom"}
              >
                <option value="campaign">{tc("صورة «بالغوا بالدفاع عن وطنكم»", "Patriotic campaign image")}</option>
                <option value="logo">{tc("شعار كلوني", "CLUNY logo")}</option>
                <option value="custom">{tc("رابط صورة مخصص", "Custom image URL")}</option>
                <option value="none">{tc("بدون صورة", "No image")}</option>
              </select>
              {draft.mode === "custom" && draft.headerArtwork === "custom" && (
                <Input
                  value={draft.customArtworkUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, customArtworkUrl: event.target.value }))}
                  placeholder="https://..."
                  dir="ltr"
                  aria-label={tc("رابط صورة الفاتورة", "Invoice image URL")}
                />
              )}
            </div>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">{tc("عناصر الفاتورة", "Invoice elements")}</h3>
              <p className="text-xs text-muted-foreground">{tc("أوقف أي عنصر لا تريد طباعته؛ التغييرات تظهر في معاينة الفاتورة وفواتير العملاء والموظفين.", "Turn off any element you do not want printed; changes apply to invoice previews and customer/staff order receipts.")}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ELEMENTS.map((element) => (
                <label key={element.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="text-sm">{tc(element.ar, element.en)}</span>
                  <Switch
                    checked={draft.elements[element.key] !== false}
                    onCheckedChange={(checked) => updateElement(element.key, checked)}
                    aria-label={tc(element.ar, element.en)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3 border-t pt-5">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <div>
                <h3 className="font-semibold">{tc("باركود مخصص أو رابط", "Custom QR code or link")}</h3>
                <p className="text-xs text-muted-foreground">{tc("أضف رابطاً أو نصاً وحدد صفحة ظهوره. يمكن إيقاف باركود التتبع والضريبة من القائمة أعلاه.", "Add a link or text and choose where it appears. Tracking and tax QR codes can be toggled above.")}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={newQr.label} onChange={(event) => setNewQr((current) => ({ ...current, label: event.target.value }))} placeholder={tc("اسم الباركود", "QR label")} />
              <Input value={newQr.content} onChange={(event) => setNewQr((current) => ({ ...current, content: event.target.value }))} placeholder="https://cluny.cafe/..." dir="ltr" />
              <select
                value={newQr.surface}
                onChange={(event) => setNewQr((current) => ({ ...current, surface: event.target.value as InvoiceQrSurface }))}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                aria-label={tc("مكان ظهور الباركود", "QR display location")}
              >
                <option value="all">{tc("كل الفواتير", "All receipts")}</option>
                <option value="customer">{tc("فاتورة العميل", "Customer receipt")}</option>
                <option value="cashier">{tc("إيصال الكاشير", "Cashier receipt")}</option>
                <option value="staff">{tc("طلبات الموظفين", "Staff orders")}</option>
              </select>
              <Button type="button" variant="outline" onClick={addQr} className="gap-2">
                <Plus className="h-4 w-4" />{tc("إضافة باركود", "Add QR")}
              </Button>
            </div>
            {draft.customQrs.length > 0 && (
              <div className="space-y-2">
                {draft.customQrs.map((qr) => (
                  <div key={qr.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <Switch
                      checked={qr.enabled}
                      onCheckedChange={(enabled) => setDraft((current) => ({
                        ...current,
                        customQrs: current.customQrs.map((item) => item.id === qr.id ? { ...item, enabled } : item),
                      }))}
                      aria-label={tc(`إظهار ${qr.label}`, `Show ${qr.label}`)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{qr.label}</p>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">{qr.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {tc(
                          `مكان العرض: ${{ all: "كل الفواتير", customer: "فاتورة العميل", cashier: "إيصال الكاشير", staff: "طلبات الموظفين" }[qr.surface]}`,
                          `Display: ${{ all: "All receipts", customer: "Customer receipt", cashier: "Cashier receipt", staff: "Staff orders" }[qr.surface]}`,
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDraft((current) => ({ ...current, customQrs: current.customQrs.filter((item) => item.id !== qr.id) }))}
                      aria-label={tc("حذف الباركود", "Remove QR")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={reset} className="gap-2">
              <RotateCcw className="h-4 w-4" />{tc("استعادة الافتراضي", "Reset to default")}
            </Button>
            <Button onClick={handleSave} disabled={isLoading || saveMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />{saveMutation.isPending ? tc("جاري الحفظ...", "Saving...") : tc("حفظ إعدادات الفاتورة", "Save invoice settings")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ImagePlus className="h-4 w-4 text-primary" />{tc("معاينة مباشرة", "Live preview")}</CardTitle>
          <CardDescription>{tc("هذه معاينة تجريبية؛ لا تنشئ طلباً أو تغيّر بيانات المتجر.", "Preview only; it does not create an order or change store data.")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-lg border bg-muted/20 p-2">
          <div className="max-h-[70vh] overflow-y-auto">
            <ReceiptInvoice order={PREVIEW_ORDER} variant="preview" surface="customer" invoiceSettingsOverride={draft} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

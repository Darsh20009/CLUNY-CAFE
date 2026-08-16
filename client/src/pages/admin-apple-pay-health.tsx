import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Apple, CheckCircle2, CreditCard, FileText, Globe, RefreshCw, Server, ShieldCheck, XCircle } from 'lucide-react';

function statusBadge(ok: boolean | undefined, label?: string) {
  if (ok === undefined) return <Badge variant="secondary" data-testid="badge-status-unknown">غير معروف</Badge>;
  return ok ? (
    <Badge className="bg-emerald-600 text-white" data-testid="badge-status-ok">{label || 'سليم'}</Badge>
  ) : (
    <Badge variant="destructive" data-testid="badge-status-error">{label || 'يحتاج مراجعة'}</Badge>
  );
}

function ValueRow({ label, value, ok, testId }: { label: string; value: string | number | boolean | undefined; ok?: boolean; testId: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={testId}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2 text-left">
        {ok !== undefined && (ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />)}
        <span className="truncate text-sm font-semibold" data-testid={`${testId}-value`}>{String(value ?? '-')}</span>
      </div>
    </div>
  );
}

export default function AdminApplePayHealth() {
  useEffect(() => {
    document.title = 'فحص Apple Pay - CLUNY CAFE';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'صفحة فحص إعدادات Apple Pay و Geidea في لوحة إدارة CLUNY CAFE');
  }, []);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<any>({
    queryKey: ['/api/payments/apple-pay/diagnose'],
    retry: false,
  });

  const report = data?.report || {};
  const wellKnownOk = !!report.wellKnownFile?.exists;
  const certOk = !!report.localFiles?.paymentProcessingCertificateExists;
  const geideaOk = !!report.geideaConfig?.hasPublicKey && !!report.geideaConfig?.hasApiPassword;
  const expectedDomain = report.expectedApplePayDomain || 'cluny.cafe';
  const merchantId = report.geideaConfig?.applePayMerchantId || 'merchant.cluny.cafe';
  const allOk = wellKnownOk && certOk && geideaOk && expectedDomain === 'cluny.cafe' && merchantId === 'merchant.cluny.cafe';

  return (
    <div className="min-h-screen space-y-5 bg-gradient-to-b from-background via-primary/5 to-background p-4 sm:space-y-8 sm:p-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-4xl" data-testid="text-apple-pay-health-title">
            <Apple className="h-7 w-7 text-slate-900 dark:text-white" />
            فحص Apple Pay
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-apple-pay-health-subtitle">متابعة حالة النطاق، ملف التحقق، شهادة الدفع، وربط Geidea</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-apple-pay-health">
          <RefreshCw className="ml-2 h-4 w-4" />
          تحديث الفحص
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20" data-testid="card-apple-pay-health-error">
          <CardContent className="flex items-center gap-3 p-5 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
            تعذر تشغيل فحص Apple Pay الآن. جرّب التحديث أو راجع الاتصال بالخادم.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-0 bg-white dark:bg-card" data-testid="card-apple-pay-overall-status">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-2xl p-3 ${allOk ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'}`}>
                    {allOk ? <ShieldCheck className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
                  </div>
                  <div>
                    <p className="text-lg font-bold" data-testid="text-apple-pay-overall-title">{allOk ? 'Apple Pay جاهز من ناحية الإعدادات الأساسية' : 'يوجد إعداد يحتاج مراجعة'}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-apple-pay-overall-detail">آخر فحص: {data?.timestamp ? new Date(data.timestamp).toLocaleString('ar-SA') : '-'}</p>
                  </div>
                </div>
                {statusBadge(allOk)}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 sm:gap-6">
            <Card className="border-0 bg-white dark:bg-card" data-testid="card-apple-pay-domain">
              <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Globe className="h-5 w-5" />
                  النطاق وملف التحقق
                </CardTitle>
                <CardDescription>يجب أن يعمل Apple Pay من cluny.cafe فقط على Safari وجهاز Apple.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-2 sm:p-6 sm:pt-0">
                <ValueRow label="النطاق المتوقع" value={expectedDomain} ok={expectedDomain === 'cluny.cafe'} testId="row-apple-pay-domain" />
                <ValueRow label="نطاق الخادم الحالي" value={report.serverDomain} testId="row-apple-pay-server-domain" />
                <ValueRow label="ملف .well-known" value={wellKnownOk ? 'موجود' : 'غير موجود'} ok={wellKnownOk} testId="row-apple-pay-well-known" />
                <ValueRow label="حجم الملف" value={report.wellKnownFile?.size ? `${report.wellKnownFile.size} بايت` : '-'} testId="row-apple-pay-well-known-size" />
              </CardContent>
            </Card>

            <Card className="border-0 bg-white dark:bg-card" data-testid="card-apple-pay-geidea">
              <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <CreditCard className="h-5 w-5" />
                  Geidea و Merchant ID
                </CardTitle>
                <CardDescription>يتحقق من أن الربط يستخدم merchant.cluny.cafe وليس Merchant داخلي.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-2 sm:p-6 sm:pt-0">
                <ValueRow label="Merchant ID" value={merchantId} ok={merchantId === 'merchant.cluny.cafe'} testId="row-apple-pay-merchant-id" />
                <ValueRow label="Public Key" value={report.geideaConfig?.hasPublicKey ? 'موجود' : 'غير موجود'} ok={!!report.geideaConfig?.hasPublicKey} testId="row-geidea-public-key" />
                <ValueRow label="API Password" value={report.geideaConfig?.hasApiPassword ? 'موجود' : 'غير موجود'} ok={!!report.geideaConfig?.hasApiPassword} testId="row-geidea-api-password" />
                <ValueRow label="Base URL" value={report.geideaConfig?.baseUrl} testId="row-geidea-base-url" />
              </CardContent>
            </Card>

            <Card className="border-0 bg-white dark:bg-card" data-testid="card-apple-pay-files-env">
              <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <FileText className="h-5 w-5" />
                  الملفات والمتغيرات
                </CardTitle>
                <CardDescription>فحص وجود الشهادة وبيئة Apple Pay.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-2 sm:p-6 sm:pt-0">
                <ValueRow label="شهادة الدفع" value={certOk ? 'موجودة' : 'غير موجودة'} ok={certOk} testId="row-payment-certificate" />
                <ValueRow label="APPLE_PAY_DOMAIN" value={report.envVars?.APPLE_PAY_DOMAIN} ok={report.envVars?.APPLE_PAY_DOMAIN === 'SET'} testId="row-env-apple-pay-domain" />
                <ValueRow label="APPLE_PAY_MERCHANT_ID" value={report.envVars?.APPLE_PAY_MERCHANT_ID} ok={report.envVars?.APPLE_PAY_MERCHANT_ID === 'SET'} testId="row-env-apple-pay-merchant-id" />
                <ValueRow label="Identity Cert Path" value={report.envVars?.APPLE_PAY_MERCHANT_IDENTITY_CERT_PATH} testId="row-env-apple-pay-cert-path" />
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 bg-white dark:bg-card" data-testid="card-geidea-endpoints">
            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Server className="h-5 w-5" />
                اختبار نقاط Geidea
              </CardTitle>
              <CardDescription>يعرض حالة الاستجابة من نقاط Apple Pay التجريبية لدى Geidea.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-2 sm:p-6 sm:pt-0">
              {Array.isArray(report.geideaEndpoints) && report.geideaEndpoints.length > 0 ? report.geideaEndpoints.map((endpoint: any, index: number) => (
                <div key={endpoint.url || index} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`row-geidea-endpoint-${index}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="break-all text-sm font-semibold" data-testid={`text-geidea-endpoint-url-${index}`}>{endpoint.url}</span>
                    <Badge variant={endpoint.status > 0 && endpoint.status < 500 ? 'secondary' : 'destructive'} data-testid={`badge-geidea-endpoint-status-${index}`}>HTTP {endpoint.status || 0}</Badge>
                  </div>
                  <p className="mt-2 break-words text-xs text-muted-foreground" data-testid={`text-geidea-endpoint-preview-${index}`}>{endpoint.error || endpoint.preview || '-'}</p>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-geidea-endpoints">لا توجد نتائج نقاط Geidea في هذا الفحص</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

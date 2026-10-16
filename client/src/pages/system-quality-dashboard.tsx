import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Code2, Cpu, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

export default function SystemQualityDashboard() {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const isAr = i18n.language.startsWith("ar");
  const tc = (ar: string, en: string) => isAr ? ar : en;
  const performance = useQuery<any>({
    queryKey: ["/api/performance/stats"],
    refetchInterval: 30_000,
  });
  const quality = useQuery<any>({
    queryKey: ["/api/code-quality/stats"],
    refetchInterval: 60_000,
  });
  const errorLogs = useQuery<any>({
    queryKey: ["/api/error-logs?hours=24&limit=25"],
    refetchInterval: 30_000,
  });
  const tests = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/code-quality/run-tests", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/code-quality/stats"] }),
  });

  const perf = performance.data;
  const code = quality.data;
  const testResult = tests.data as any;
  const cards = [
    { label: tc("متوسط الاستجابة", "Average response"), value: `${perf?.lastHour?.avgMs ?? "—"} ms`, icon: Gauge },
    { label: tc("طلبات آخر ساعة", "Requests this hour"), value: perf?.lastHour?.requests ?? "—", icon: Activity },
    { label: tc("معدل الأخطاء", "Error rate"), value: `${perf?.lastHour?.errorRate ?? "—"}%`, icon: AlertTriangle },
    { label: tc("الذاكرة المستخدمة", "Memory used"), value: `${perf?.memory?.heapUsedMB ?? "—"} MB`, icon: Cpu },
  ];

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8" dir={isAr ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">{tc("مراقبة النظام", "System monitoring")}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{tc("الأداء وجودة النظام", "Performance & system quality")}</h1>
            <p className="mt-1 text-sm text-gray-500">{tc("إحصاءات قراءة فقط، مع تشغيل اختبارات النظام عند الحاجة.", "Read-only metrics with an optional on-demand test run.")}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void performance.refetch();
              void quality.refetch();
            }}
            disabled={performance.isFetching || quality.isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${performance.isFetching || quality.isFetching ? "animate-spin" : ""}`} />
            {tc("تحديث", "Refresh")}
          </Button>
        </header>

        {(performance.isError || quality.isError) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {tc("تعذّر تحميل بعض المؤشرات. قد لا تسمح صلاحيات الحساب بعرض جميع البيانات.", "Some metrics could not be loaded. Your account may not have access to every metric.")}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-gray-200 bg-white shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
                </div>
                <div className="rounded-xl bg-[#EDF7F2] p-3 text-[#2D9B6E]"><Icon className="h-5 w-5" /></div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-[#2D9B6E]" />{tc("أبطأ نقاط API", "Slowest API endpoints")}</CardTitle>
              <span className="text-xs text-gray-500">{tc("آخر ساعة", "Last hour")}</span>
            </CardHeader>
            <CardContent>
              {performance.isLoading ? <p className="text-sm text-gray-500">{tc("جاري التحميل…", "Loading…")}</p> : (
                <div className="space-y-2">
                  {(perf?.slowest || []).slice(0, 8).map((row: any) => (
                    <div key={row.path} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <code className="min-w-0 truncate text-gray-700" dir="ltr">{row.path}</code>
                      <span className="shrink-0 font-semibold text-gray-900">{row.avgMs} ms</span>
                    </div>
                  ))}
                  {!perf?.slowest?.length && <p className="text-sm text-gray-500">{tc("لا توجد بيانات كافية بعد.", "No endpoint data yet.")}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" />{tc("المسارات التي سجلت أخطاء", "Endpoints with errors")}</CardTitle>
            </CardHeader>
            <CardContent>
              {performance.isLoading ? <p className="text-sm text-gray-500">{tc("جاري التحميل…", "Loading…")}</p> : (
                <div className="space-y-2">
                  {(perf?.errorPaths || []).slice(0, 8).map((row: any) => (
                    <div key={row.path} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">
                      <code className="min-w-0 truncate text-gray-700" dir="ltr">{row.path}</code>
                      <span className="shrink-0 font-semibold text-amber-800">{row.count}</span>
                    </div>
                  ))}
                  {!perf?.errorPaths?.length && <p className="text-sm text-gray-500">{tc("لا توجد أخطاء مسجلة في آخر 24 ساعة.", "No API errors recorded in the last 24 hours.")}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-rose-600" />{tc("سجل أخطاء API", "API error log")}</CardTitle>
                <p className="mt-1 text-xs text-gray-500">
                  {tc("أخطاء الخادم في آخر 24 ساعة؛ يحتفظ النظام بالمؤشرات لمدة 7 أيام.", "Server errors from the last 24 hours; metrics are retained for 7 days.")}
                </p>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                {errorLogs.data?.total ?? 0}
              </span>
            </CardHeader>
            <CardContent>
              {errorLogs.isLoading ? <p className="text-sm text-gray-500">{tc("جاري تحميل السجل…", "Loading log…")}</p> : errorLogs.isError ? (
                <p className="text-sm text-amber-800">{tc("تعذّر تحميل سجل الأخطاء.", "Could not load the error log.")}</p>
              ) : errorLogs.data?.logs?.length ? (
                <div className="space-y-2">
                  {errorLogs.data.logs.map((log: any) => (
                    <div key={log.id} className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">{log.statusCode || "5xx"}</span>
                        <span className="text-xs font-semibold text-gray-700">{log.method}</span>
                      </div>
                      <div className="min-w-0">
                        <code className="block truncate text-xs text-gray-800" dir="ltr">{log.path}</code>
                        {log.errorMessage && <p className="mt-1 truncate text-xs text-gray-500">{log.errorMessage}</p>}
                      </div>
                      <div className="text-xs text-gray-500 sm:text-end">
                        <span>{log.durationMs} ms</span>
                        <span className="mx-2">·</span>
                        <span>{new Date(log.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{tc("لا توجد أخطاء خادم مسجلة في آخر 24 ساعة.", "No server errors recorded in the last 24 hours.")}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-[#2D9B6E]" />{tc("ملخص جودة الكود", "Code quality summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              {quality.isLoading ? <p className="text-sm text-gray-500">{tc("جاري التحميل…", "Loading…")}</p> : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      [tc("درجة الصحة", "Health score"), code?.summary?.healthScore ?? "—"],
                      [tc("الملفات", "Files"), code?.summary?.totalFiles ?? "—"],
                      [tc("ملفات الاختبار", "Test files"), code?.summary?.testFiles ?? "—"],
                      [tc("مهام TODO", "TODO items"), code?.summary?.totalTodos ?? "—"],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => tests.mutate()}
                      disabled={tests.isPending}
                      className="gap-2 bg-[#2D9B6E] hover:bg-[#24865F]"
                    >
                      <Code2 className="h-4 w-4" />
                      {tests.isPending ? tc("جاري تشغيل الاختبارات…", "Running tests…") : tc("تشغيل الاختبارات", "Run tests")}
                    </Button>
                    {testResult && (
                      <span className={`inline-flex items-center gap-1 text-sm ${testResult.ok ? "text-emerald-700" : "text-rose-700"}`}>
                        {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        {testResult.ok
                          ? tc(`نجح ${testResult.passed} اختبار`, `${testResult.passed} tests passed`)
                          : tc(`فشل ${testResult.failed} اختبار`, `${testResult.failed} tests failed`)}
                      </span>
                    )}
                  </div>
                  {tests.isError && <p className="mt-3 text-sm text-rose-700">{tc("تعذّر تشغيل الاختبارات. قد تكون معطلة في بيئة الإنتاج.", "Tests could not run; the test runner may be disabled in production.")}</p>}
                  {testResult?.output && <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100" dir="ltr">{testResult.output}</pre>}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

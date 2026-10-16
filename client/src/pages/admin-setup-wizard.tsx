import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Printer, Settings2, Store, Users, Utensils } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

function asList(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export default function AdminSetupWizard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");
  const [, navigate] = useLocation();
  const config = useQuery<any>({ queryKey: ["/api/business-config"] });
  const branches = useQuery<any>({ queryKey: ["/api/branches"] });
  const products = useQuery<any>({ queryKey: ["/api/coffee-items"] });
  const employees = useQuery<any>({ queryKey: ["/api/employees"] });

  const branchList = asList(branches.data);
  const productList = asList(products.data);
  const employeeList = asList(employees.data);
  const steps = [
    {
      title: isAr ? "إعداد بيانات كلوني" : "Set up CLUNY details",
      description: isAr ? "راجع اسم النشاط وساعات العمل وإعدادات المتجر." : "Review the business name, hours, and store settings.",
      done: Boolean(config.data?.businessName || config.data?.nameAr),
      href: "/admin/settings",
      icon: Store,
    },
    {
      title: isAr ? "إضافة الفرع" : "Add a branch",
      description: isAr ? "أضف الفرع الذي ستتم عليه إدارة الطلبات والمخزون." : "Add the branch used for orders and inventory.",
      done: branchList.length > 0,
      href: "/admin/branches",
      icon: Store,
    },
    {
      title: isAr ? "إضافة المنتجات" : "Add products",
      description: isAr ? "أدخل قائمة المشروبات والمأكولات وأسعارها." : "Add menu items and their prices.",
      done: productList.length > 0,
      href: "/employee/menu-management",
      icon: Utensils,
    },
    {
      title: isAr ? "إعداد فريق العمل" : "Set up the team",
      description: isAr ? "أضف حسابات الموظفين وحدد صلاحياتهم." : "Add employee accounts and assign their roles.",
      done: employeeList.length > 0,
      href: "/admin/employees",
      icon: Users,
    },
    {
      title: isAr ? "توصيل الطابعة" : "Connect a printer",
      description: isAr ? "اختبر الطابعة الحرارية أو الشبكية قبل بدء البيع." : "Test a thermal or network printer before sales begin.",
      done: false,
      href: "/manager/hardware",
      icon: Printer,
      optional: true,
    },
    {
      title: isAr ? "ضبط الفاتورة" : "Configure receipts",
      description: isAr ? "اختر الشكل العادي أو قالب الحملة، ثم اضبط عناصر الفاتورة." : "Choose the standard or campaign layout, then adjust receipt elements.",
      done: Boolean(config.data?.invoiceSettings),
      href: "/admin/settings",
      icon: Settings2,
    },
  ];
  const requiredSteps = steps.filter((step) => !step.optional);
  const completed = requiredSteps.filter((step) => step.done).length;
  const progress = Math.round((completed / requiredSteps.length) * 100);
  const isLoading = config.isLoading || branches.isLoading || products.isLoading || employees.isLoading;

  return (
    <div className="min-h-full bg-[#F7F9F8] p-4 sm:p-6 lg:p-8" dir={isAr ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-sm text-gray-500">{isAr ? "الإدارة" : "Management"}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{isAr ? "دليل إعداد النظام" : "System setup guide"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isAr ? "خطوات عملية تعتمد على بيانات النظام الحالية، ويمكنك إكمالها بالترتيب الذي يناسبك." : "A practical checklist based on current system data. Complete the steps in any order."}
          </p>
        </header>

        <Card className="border-gray-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{isAr ? `اكتمل ${completed} من ${requiredSteps.length} خطوات أساسية` : `${completed} of ${requiredSteps.length} required steps complete`}</p>
                <p className="mt-1 text-xs text-gray-500">{isAr ? "إعداد الطابعة اختياري ويمكن إكماله لاحقاً." : "Printer setup is optional and can be completed later."}</p>
              </div>
              <span className="text-lg font-bold text-[#2D9B6E]">{isLoading ? "…" : `${progress}%`}</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#2D9B6E] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={step.title} className="border-gray-200 bg-white shadow-sm">
                <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                  {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2D9B6E]" /> : <Circle className="h-5 w-5 shrink-0 text-gray-300" />}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF7F2] text-[#2D9B6E]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{index + 1}. {step.title}</CardTitle>
                      {step.optional && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{isAr ? "اختياري" : "Optional"}</span>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{step.description}</p>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => navigate(step.href)}>
                    {isAr ? "فتح" : "Open"}
                    {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

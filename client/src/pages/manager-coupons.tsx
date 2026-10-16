import { useQuery } from "@tanstack/react-query";
import CouponManagement from "@/components/coupon-management";
import { useTranslation } from "react-i18next";

export default function ManagerCouponsPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");
  const { data: manager, isLoading, isError } = useQuery<any>({ queryKey: ["/api/verify-session"] });

  return (
    <div className="min-h-full bg-[#F7F9F8] p-4 sm:p-6 lg:p-8" dir={isAr ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <p className="text-sm text-gray-500">{isAr ? "التسويق" : "Marketing"}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{isAr ? "أكواد الخصم" : "Discount codes"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isAr
              ? "حدد المنتجات المشمولة، وضع نسبة خصم مستقلة لكل منتج."
              : "Choose the included products and set an independent discount for each one."}
          </p>
        </header>
        {isLoading ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">{isAr ? "جاري تحميل بيانات الحساب…" : "Loading account…"}</div>
        ) : isError || !manager?.id ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            {isAr ? "تعذّر تحميل بيانات المدير، لذلك لم يتم فتح إدارة الخصومات." : "Could not load the manager account, so discount management was not opened."}
          </div>
        ) : (
          <CouponManagement employeeId={manager.id} />
        )}
      </div>
    </div>
  );
}

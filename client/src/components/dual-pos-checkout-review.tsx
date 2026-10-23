import { Banknote, ClipboardList, CreditCard, ReceiptText } from "lucide-react";
import SarIcon from "@/components/sar-icon";

type CheckoutReviewItem = {
  lineItemId: string;
  nameAr: string;
  nameEn?: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedAddons?: string[];
};

type DualPosCheckoutReviewProps = {
  isArabic: boolean;
  direction: "rtl" | "ltr";
  items: CheckoutReviewItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentMethodLabel: string;
};

export default function DualPosCheckoutReview({
  isArabic,
  direction,
  items,
  subtotal,
  tax,
  total,
  paymentMethod,
  paymentMethodLabel,
}: DualPosCheckoutReviewProps) {
  const isCash = ["cash", "cash_on_delivery", "pay_at_branch"].includes(
    paymentMethod.toLowerCase(),
  );
  const MethodIcon = isCash ? Banknote : CreditCard;
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(isArabic ? "ar-SA" : "en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);

  return (
    <main
      dir={direction}
      className="flex min-h-[100dvh] w-full items-center justify-center bg-[#f3f5f3] p-3 text-[#202b25] sm:p-6"
      aria-live="polite"
    >
      <section className="mx-auto flex max-h-[calc(100dvh-1.5rem)] min-h-[min(760px,calc(100dvh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d9e0da] bg-white shadow-sm sm:max-h-[calc(100dvh-3rem)] sm:min-h-[min(760px,calc(100dvh-3rem))]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e7ebe7] px-5 py-4 sm:px-8 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf3ee] text-[#2c7056]">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#718078]">CLUNY CAFE</p>
              <h1 className="mt-0.5 text-xl font-bold sm:text-2xl">
                {isArabic ? "مراجعة الطلب" : "Order review"}
              </h1>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#e5d7b8] bg-[#fbf7ed] px-3 py-2 text-xs font-bold text-[#735b30] sm:px-4 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-[#b28a3b]" />
            {isArabic ? "بانتظار إتمام الدفع" : "Awaiting payment"}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-h-0 overflow-y-auto px-5 py-5 sm:px-8">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#39473f]">
              <ClipboardList className="h-4 w-4 text-[#54816a]" />
              <span>{isArabic ? "الأصناف" : "Items"}</span>
              <span className="text-xs font-medium text-[#78847d]">
                ({items.reduce((sum, item) => sum + item.quantity, 0)})
              </span>
            </div>

            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#dce3dd] p-6 text-center text-sm text-[#6e7972]">
                {isArabic ? "لا توجد أصناف في الطلب" : "There are no items in this order"}
              </p>
            ) : (
              <div className="divide-y divide-[#edf0ed]">
                {items.map((item, index) => (
                  <article
                    key={item.lineItemId || `${item.nameAr}-${index}`}
                    className="flex items-start justify-between gap-4 py-4 first:pt-1"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-md bg-[#f1f4f1] px-1.5 text-xs font-bold text-[#536259]">
                        {item.quantity}×
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-6">
                          {isArabic ? item.nameAr : item.nameEn || item.nameAr}
                        </p>
                        {isArabic && item.nameEn && (
                          <p className="text-xs text-[#7a857e]" dir="ltr">{item.nameEn}</p>
                        )}
                        {(item.selectedSize || item.selectedAddons?.length) && (
                          <p className="mt-1 text-xs leading-5 text-[#718078]">
                            {[item.selectedSize, ...(item.selectedAddons || [])]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pt-1 text-sm font-semibold tabular-nums">
                      <span>{formatAmount(item.price * item.quantity)}</span>
                      <SarIcon size={13} className="text-[#58665e]" />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="shrink-0 border-t border-[#e7ebe7] bg-[#fafbfa] p-5 sm:p-7 md:border-s md:border-t-0">
            <p className="mb-3 text-xs font-bold text-[#748078]">
              {isArabic ? "طريقة الدفع" : "Payment method"}
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-[#dfe5df] bg-white px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf3ee] text-[#2c7056]">
                <MethodIcon className="h-5 w-5" />
              </span>
              <span className="font-bold">{paymentMethodLabel}</span>
            </div>

            <div className="mt-6 space-y-3 border-t border-[#e5eae5] pt-5 text-sm">
              <div className="flex items-center justify-between gap-3 text-[#69756d]">
                <span>{isArabic ? "المجموع الفرعي" : "Subtotal"}</span>
                <span className="flex items-center gap-1 font-medium tabular-nums">
                  {formatAmount(subtotal)} <SarIcon size={12} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[#69756d]">
                <span>{isArabic ? "الضريبة" : "Tax"}</span>
                <span className="flex items-center gap-1 font-medium tabular-nums">
                  {formatAmount(tax)} <SarIcon size={12} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[#e5eae5] pt-4 text-base font-bold">
                <span>{isArabic ? "الإجمالي" : "Total"}</span>
                <span className="flex items-center gap-1 text-lg text-[#267653] tabular-nums">
                  {formatAmount(total)} <SarIcon size={15} />
                </span>
              </div>
            </div>

            <p className="mt-6 rounded-lg border border-[#e1e8e2] bg-white px-4 py-3 text-sm leading-6 text-[#526158]">
              {isArabic
                ? "يرجى إتمام الدفع لدى الموظف. لم يتم تسجيل الدفع بعد."
                : "Please complete payment with the staff. Payment has not been recorded yet."}
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

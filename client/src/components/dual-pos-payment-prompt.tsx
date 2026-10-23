import { Banknote, Clock3, LoaderCircle, Sparkles } from "lucide-react";
import SarIcon from "@/components/sar-icon";
import clunyLogo from "@assets/cluny-logo-customer.png";

type DualPosPaymentPromptProps = {
  isArabic: boolean;
  direction: "rtl" | "ltr";
  stage: "processing" | "cash_due";
  amount: number;
  paymentMethodLabel: string;
  orderNumber?: string;
};

export default function DualPosPaymentPrompt({
  isArabic,
  direction,
  stage,
  amount,
  paymentMethodLabel,
  orderNumber,
}: DualPosPaymentPromptProps) {
  const isCashDue = stage === "cash_due";
  const formattedAmount = new Intl.NumberFormat(isArabic ? "ar-SA" : "en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);

  const copy = isCashDue
    ? {
        eyebrow: isArabic ? "خطوتك الأخيرة" : "ONE LAST STEP",
        title: isArabic ? "المبلغ المطلوب دفعه" : "Amount to pay",
        instruction: isArabic ? "سلّم المبلغ نقداً للموظف" : "Please pay this amount in cash to the employee",
        status: isArabic ? "بانتظار الدفع النقدي" : "CASH DUE",
      }
    : {
        eyebrow: isArabic ? "لحظات ونكون جاهزين" : "JUST A MOMENT",
        title: isArabic ? "جارٍ إتمام طلبك" : "Finishing your order",
        instruction: isArabic ? "يتم الآن إتمام الدفع، شكراً لانتظارك" : "Your payment is being processed. Thanks for waiting.",
        status: isArabic ? "قيد المعالجة" : "PROCESSING",
      };

  return (
    <main
      dir={direction}
      className="relative isolate flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#edf2ed] px-4 py-5 text-[#173b32] sm:px-8 sm:py-8"
      aria-live="polite"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -start-28 -top-32 h-80 w-80 rounded-full bg-[#d8e5da] opacity-70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -end-24 h-96 w-96 rounded-full bg-[#f4dfbd] opacity-70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "radial-gradient(#426b5c 0.7px, transparent 0.7px)", backgroundSize: "22px 22px" }} />

      <section className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-[#d5e0d7] bg-[#fbfaf5] shadow-[0_28px_80px_-36px_rgba(30,67,53,0.34)] sm:rounded-[2.5rem] landscape:min-h-[min(78dvh,760px)] landscape:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden px-6 pb-7 pt-6 sm:px-10 sm:pb-9 sm:pt-8 landscape:px-10 landscape:py-9">
          <div aria-hidden="true" className="pointer-events-none absolute -end-20 top-1/3 h-64 w-64 rounded-full border border-[#dce6dc] sm:h-80 sm:w-80" />
          <div aria-hidden="true" className="pointer-events-none absolute -end-10 top-[38%] h-44 w-44 rounded-full border border-[#e5ebe2] sm:h-60 sm:w-60" />

          <header className="relative z-10 flex items-center justify-between gap-4">
            <img src={clunyLogo} alt="CLUNY CAFE" className="h-9 w-auto max-w-[145px] object-contain sm:h-12 sm:max-w-[190px]" />
            <div className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-extrabold tracking-[0.16em] sm:px-4 sm:text-xs ${isCashDue ? "border-[#ead4b0] bg-[#fbf1df] text-[#805426]" : "border-[#d5e4d8] bg-[#edf5ee] text-[#3f7059]"}`}>
              {isCashDue ? <Banknote className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              <span>{copy.status}</span>
            </div>
          </header>

          <div className="relative z-10 mt-7 flex flex-col items-center text-center sm:mt-9 landscape:mt-5 landscape:items-start landscape:text-start">
            <div className={`mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.6rem] shadow-[0_12px_24px_-12px_rgba(25,68,51,0.35)] sm:mb-7 sm:h-24 sm:w-24 sm:rounded-[2rem] ${isCashDue ? "bg-[#e9c88f] text-[#4c4028]" : "bg-[#244f40] text-[#f4e3b7]"}`}>
              {isCashDue ? (
                <Banknote className="h-9 w-9 sm:h-12 sm:w-12" strokeWidth={1.7} />
              ) : (
                <span className="relative flex h-10 w-10 items-center justify-center sm:h-14 sm:w-14">
                  <span className="absolute inset-0 rounded-full border-[3px] border-[#83a992]/40" />
                  <LoaderCircle className="h-10 w-10 animate-spin sm:h-14 sm:w-14" strokeWidth={2.2} />
                  <Sparkles className="absolute -end-2 -top-2 h-4 w-4 text-[#f1d596] sm:h-5 sm:w-5" />
                </span>
              )}
            </div>

            <p className={`mb-2 text-[10px] font-black tracking-[0.24em] sm:text-xs ${isCashDue ? "text-[#9b713d]" : "text-[#6f907a]"}`}>
              {copy.eyebrow}
            </p>
            <h1 className="max-w-xl text-3xl font-extrabold leading-[1.15] tracking-tight text-[#183d32] sm:text-5xl landscape:text-4xl xl:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-md text-sm font-medium leading-relaxed text-[#63766c] sm:mt-4 sm:text-lg">
              {copy.instruction}
            </p>

            {!isCashDue && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#dfe7dc] bg-white/75 px-4 py-2 text-sm font-bold text-[#3e5e4f] sm:mt-7 sm:px-5 sm:py-2.5 sm:text-base">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#5d9a70]" />
                <span>{paymentMethodLabel}</span>
              </div>
            )}
          </div>

          <footer className="relative z-10 mt-7 flex items-center justify-center gap-2 border-t border-[#e7e9df] pt-4 text-[10px] font-bold tracking-[0.22em] text-[#93a097] sm:mt-9 sm:pt-5 landscape:justify-start">
            <span>CLUNY</span>
            <span className="h-1 w-1 rounded-full bg-[#c99b5b]" />
            <span>CAFE</span>
          </footer>
        </div>

        <aside className={`relative flex flex-col items-center justify-center overflow-hidden px-6 py-8 text-center sm:px-10 sm:py-10 landscape:w-[46%] landscape:shrink-0 landscape:px-8 ${isCashDue ? "bg-[#e9c88f]" : "bg-[#244f40] text-[#faf6e9]"}`}>
          <div aria-hidden="true" className={`pointer-events-none absolute -end-20 -top-24 h-64 w-64 rounded-full border ${isCashDue ? "border-[#cba66a]/45" : "border-white/10"}`} />
          <div aria-hidden="true" className={`pointer-events-none absolute -start-28 -bottom-32 h-80 w-80 rounded-full border ${isCashDue ? "border-[#cba66a]/35" : "border-white/10"}`} />

          <div className="relative z-10 w-full">
            <p className={`text-xs font-extrabold tracking-[0.18em] sm:text-sm ${isCashDue ? "text-[#72542d]" : "text-[#c4d7c8]"}`}>
              {isArabic ? "إجمالي الطلب" : "ORDER TOTAL"}
            </p>
            <div className={`mt-3 flex items-center justify-center gap-2 sm:mt-5 sm:gap-3 ${isCashDue ? "text-[#263d31]" : "text-[#fff9e9]"}`}>
              <span className="whitespace-nowrap text-[clamp(3.4rem,12vw,7.5rem)] font-black leading-none tracking-[-0.07em] tabular-nums sm:text-[clamp(4.5rem,9vw,7.5rem)]">
                {formattedAmount}
              </span>
              <SarIcon size={34} className={`shrink-0 sm:!h-11 sm:!w-11 ${isCashDue ? "text-[#263d31]" : "text-[#e4c47f]"}`} />
            </div>
            <div className={`mx-auto mt-5 h-px w-16 sm:mt-7 sm:w-24 ${isCashDue ? "bg-[#b68a4a]/45" : "bg-white/20"}`} />

            {isCashDue ? (
              <div className="mt-5 sm:mt-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#f8efd9]/75 px-4 py-2 text-xs font-bold text-[#66502f] sm:text-sm">
                  <Banknote className="h-4 w-4" />
                  <span>{isArabic ? "المبلغ المطلوب" : "AMOUNT TO HAND OVER"}</span>
                </div>
                {orderNumber && (
                  <p className="mt-5 text-sm font-bold text-[#72542d] sm:mt-7 sm:text-base">
                    {isArabic ? "رقم الطلب" : "Order"} <span className="mx-1 opacity-60">/</span>
                    <span dir="ltr" className="font-mono">{orderNumber}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm font-semibold text-[#d2dfd3] sm:mt-7 sm:text-base">
                {isArabic ? "طريقة الدفع" : "PAYMENT METHOD"} <span className="mx-1 opacity-50">·</span> {paymentMethodLabel}
              </p>
            )}
          </div>

          {isCashDue && (
            <div className="relative z-10 mt-7 flex items-center gap-2 text-xs font-bold text-[#72542d] sm:mt-9 sm:text-sm">
                <Banknote className="h-4 w-4" />
                <span>{isArabic ? "الدفع لدى الموظف" : "Pay the employee"}</span>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

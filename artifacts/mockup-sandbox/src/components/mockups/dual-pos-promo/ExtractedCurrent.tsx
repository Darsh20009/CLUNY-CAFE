import "./_group.css";
import { Coffee, QrCode, Sparkles, Wifi } from "lucide-react";
import SarIcon from "@/components/sar-icon";

const products = [
  { id: "drip-ice", nameAr: "قهوة اليوم باردة وسط", price: 12, imageUrl: "/__mockup/images/dual-pos/drip-ice.png" },
  { id: "signature-ice", nameAr: "سجنـتـشر بارد", price: 14, imageUrl: "/__mockup/images/dual-pos/signature-ice.png" },
  { id: "cappuccino", nameAr: "كابتشينو", price: 10, imageUrl: "/__mockup/images/dual-pos/cappuccino.png" },
  { id: "drip-small", nameAr: "قهوة اليوم باردة صغير", price: 10, imageUrl: "/__mockup/images/dual-pos/drip-ice.png" },
];

export function ExtractedCurrent() {
  return (
    <main
      className="relative h-auto min-h-dvh overflow-y-auto bg-[#f4f6f3] text-[#17392f] landscape:h-dvh landscape:min-h-0 landscape:overflow-hidden"
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[#2d9b6e]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1720px] flex-col px-4 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6 landscape:h-full landscape:min-h-0 landscape:px-9 landscape:py-6 xl:px-12">
        <header className="mb-5 flex shrink-0 items-center justify-between gap-4 border-b border-[#dce4dd] pb-4 sm:mb-6 sm:pb-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img
              src="/__mockup/images/dual-pos/cluny-logo.png"
              alt="CLUNY CAFE"
              className="h-11 w-11 shrink-0 rounded-full border border-[#dce4dd] bg-white object-contain p-1.5 sm:h-12 sm:w-12"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-[0.22em] text-[#246d50] sm:text-xs">CLUNY CAFE</p>
              <p className="mt-1 truncate text-xs text-[#78857d] sm:text-sm">قهوة مختصة، محضّرة بعناية</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#dce4dd] bg-white px-3 py-2 text-[10px] font-bold text-[#53675b] shadow-sm sm:gap-2.5 sm:px-4 sm:text-xs">
            <span className="hidden sm:inline">شاشة #01</span>
            <span className="hidden h-4 w-px bg-[#e3e8e2] sm:block" />
            <Wifi className="h-4 w-4 text-[#2d9b6e]" aria-hidden="true" />
            <span>متصلة</span>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-5 landscape:min-h-0 landscape:grid-cols-[minmax(0,1fr)_280px] landscape:gap-7 xl:landscape:grid-cols-[minmax(0,1fr)_310px]">
          <section className="flex min-w-0 flex-col landscape:min-h-0">
            <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
              <div>
                <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-[#8a754e] sm:text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  مختارات كلوني
                </p>
                <h1 className="text-[23px] font-black leading-tight tracking-tight text-[#17392f] sm:text-3xl xl:text-[36px]">
                  قهوتك المفضلة، أقرب مما تتخيل
                </h1>
              </div>
              <span className="hidden shrink-0 pb-1 text-xs text-[#89938a] sm:inline">تصفّح المنيو واطلب بسهولة</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 landscape:min-h-0 landscape:flex-1 landscape:grid-cols-4">
              {products.map((item, index) => (
                <article
                  key={`${item.id}-${index}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#dfe6df] bg-white shadow-[0_5px_20px_rgba(27,58,43,0.055)] transition-transform duration-300 hover:-translate-y-0.5 landscape:min-h-0"
                >
                  <div className="relative aspect-[1.45/1] overflow-hidden bg-[#edf1ec] landscape:min-h-0 landscape:flex-1">
                    <div className="absolute inset-0 flex items-center justify-center text-[#8aa192]">
                      <Coffee className="h-8 w-8" strokeWidth={1.4} aria-hidden="true" />
                    </div>
                    <img
                      src={item.imageUrl}
                      alt={item.nameAr}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                      onError={(event) => event.currentTarget.remove()}
                    />
                  </div>
                  <div className="flex flex-1 flex-col px-3 py-3 sm:px-4 sm:py-3.5 landscape:min-h-[100px]">
                    <h2 className="line-clamp-2 text-[12px] font-bold leading-5 text-[#253d31] sm:text-sm">{item.nameAr}</h2>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                      <span className="text-[10px] text-[#8b958d]">السعر</span>
                      <p className="flex items-center gap-1.5 text-sm font-black tabular-nums text-[#26734f] sm:text-base">
                        {item.price.toFixed(2)}
                        <SarIcon size={13} className="opacity-80" />
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="relative flex flex-col items-center justify-center overflow-hidden rounded-[24px] bg-[#1e684c] px-5 py-6 text-center text-white shadow-[0_14px_32px_rgba(23,57,47,0.15)] sm:px-7 sm:py-7 landscape:min-h-0 landscape:px-5 landscape:py-5">
            <div className="pointer-events-none absolute -end-16 -top-20 h-52 w-52 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -start-14 -bottom-24 h-56 w-56 rounded-full border border-white/10" />
            <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[#e3c888]">
              <QrCode className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
            </div>
            <p className="relative z-10 mt-3 text-[10px] font-bold tracking-[0.18em] text-[#e8d7ad]">قائمة كلوني</p>
            <h2 className="relative z-10 mt-1 text-xl font-black sm:text-2xl">اطلب الآن</h2>
            <p className="relative z-10 mt-2 max-w-[225px] text-xs leading-6 text-white/75 sm:text-sm">
              امسح الرمز لتصفح المنيو والطلب
            </p>
            <div className="relative z-10 my-4 flex aspect-square w-[154px] items-center justify-center rounded-[18px] bg-white p-3 shadow-lg sm:my-5 sm:w-[184px] landscape:my-4 landscape:w-[164px] xl:landscape:w-[184px]">
              <img src="/__mockup/images/dual-pos/menu-qr.png" alt="رمز QR للمنيو" className="h-full w-full object-contain" />
            </div>
            <a
              href="https://cluny.cafe/menu"
              className="relative z-10 break-all text-[11px] font-semibold tracking-wide text-white/90 underline decoration-white/35 underline-offset-4"
              dir="ltr"
            >
              cluny.cafe/menu
            </a>
            <div className="relative z-10 mt-5 flex w-full items-center justify-center gap-2 border-t border-white/15 pt-4 text-[11px] text-white/75 sm:text-xs landscape:mt-4 landscape:pt-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e3c888]" />
              <span>المس الشاشة للعودة إلى المنيو</span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

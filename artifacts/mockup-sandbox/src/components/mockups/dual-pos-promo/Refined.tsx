import { ArrowRight, Coffee, Hand, QrCode, Wifi } from "lucide-react";
import SarIcon from "@/components/sar-icon";

const products = [
  {
    name: "قهوة اليوم باردة وسط",
    price: 12,
    image: "/__mockup/images/dual-pos/drip-ice.png",
    note: "تحضير اليوم",
  },
  {
    name: "سجنـتـشر بارد",
    price: 14,
    image: "/__mockup/images/dual-pos/signature-ice.png",
    note: "اختيار كلوني",
  },
  {
    name: "كابتشينو",
    price: 10,
    image: "/__mockup/images/dual-pos/cappuccino.png",
    note: "كلاسيكي محبوب",
  },
  {
    name: "قهوة اليوم باردة صغير",
    price: 10,
    image: "/__mockup/images/dual-pos/drip-ice.png",
    note: "خفيفة ومنعشة",
  },
];

export function Refined() {
  return (
    <main
      className="relative flex min-h-dvh flex-col overflow-y-auto bg-[#f2eee5] text-[#183a31] selection:bg-[#c49a62]/25 landscape:h-dvh landscape:min-h-0 landscape:overflow-hidden"
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:radial-gradient(#a99c80_0.55px,transparent_0.55px)] [background-size:9px_9px]" />
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full border border-[#d6c7a9]/50" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1720px] flex-col px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7 landscape:min-h-0 landscape:px-10 landscape:py-7 xl:px-14">
        <header className="mb-6 flex items-center justify-between gap-4 border-b border-[#183a31]/12 pb-4 sm:mb-8 sm:pb-5 landscape:mb-6 landscape:shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src="/__mockup/images/dual-pos/cluny-logo.png"
              alt="CLUNY CAFE"
              className="h-11 w-11 rounded-full border border-[#d9cfbc] bg-[#fffdf8] object-contain p-1.5 sm:h-[52px] sm:w-[52px]"
            />
            <div>
              <p className="text-[11px] font-bold tracking-[0.28em] text-[#31594b] sm:text-xs">CLUNY CAFE</p>
              <p className="mt-1 text-xs text-[#718078] sm:text-sm">قهوة تُحضّر على مهل</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#d8d1c3] bg-[#faf8f2]/85 px-3 py-2 text-[11px] font-semibold text-[#456357] sm:gap-2.5 sm:px-4 sm:text-xs">
            <span className="hidden text-[#827c6e] sm:inline">شاشة #01</span>
            <span className="hidden h-3.5 w-px bg-[#d8d1c3] sm:block" />
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#56866e]/45" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#56866e]" />
            </span>
            <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            <span>متصلة</span>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-7 landscape:min-h-0 landscape:grid-cols-[minmax(0,1fr)_270px] landscape:gap-8 xl:landscape:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-w-0 flex-col landscape:min-h-0">
            <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6 landscape:mb-5">
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-[0.24em] text-[#a27b48] sm:text-[11px]">من قائمة كلوني</p>
                <h1 className="text-[25px] font-bold leading-[1.45] tracking-[-0.035em] text-[#183a31] sm:text-3xl xl:text-[38px]">
                  قهوتك المفضلة،
                  <span className="text-[#8d7653]"> أقرب مما تتخيل</span>
                </h1>
              </div>
              <div className="hidden shrink-0 items-center gap-2 pb-1 text-xs text-[#7d8176] sm:flex">
                <span className="h-px w-8 bg-[#cbb996]" />
                <span>مختارات اليوم</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 landscape:min-h-0 landscape:flex-1 landscape:grid-cols-4">
              {products.map((item, index) => (
                <article
                  key={`${item.name}-${index}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#ddd5c5] bg-[#fbf9f3] shadow-[0_8px_24px_rgba(43,55,44,0.055)] transition-transform duration-300 hover:-translate-y-1 landscape:min-h-0"
                >
                  <div className="relative aspect-[1.35/1] overflow-hidden bg-[#e9e3d7] sm:aspect-[1.5/1] landscape:aspect-auto landscape:min-h-0 landscape:flex-[1_1_55%]">
                    <div className="absolute inset-0 flex items-center justify-center text-[#a7997c]">
                      <Coffee className="h-8 w-8" strokeWidth={1.25} aria-hidden="true" />
                    </div>
                    <img
                      src={item.image}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                      onError={(event) => event.currentTarget.remove()}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#172e27]/25 to-transparent" />
                    <span className="absolute right-3 top-3 rounded-full border border-white/55 bg-[#f8f5ed]/90 px-2.5 py-1 text-[9px] font-semibold text-[#466353] backdrop-blur-sm sm:text-[10px]">
                      {item.note}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col px-3.5 py-3 sm:px-4 sm:py-4 landscape:min-h-[104px]">
                    <h2 className="line-clamp-2 text-[13px] font-bold leading-6 text-[#254438] sm:text-[15px]">
                      {item.name}
                    </h2>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="text-[10px] text-[#8c8d81]">السعر</span>
                      <p className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-[#8d6d40] sm:text-base">
                        {item.price.toFixed(2)}
                        <SarIcon size={13} className="opacity-75" />
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 hidden items-center gap-3 text-[11px] text-[#858579] landscape:flex">
              <span className="h-px flex-1 bg-[#d9d1c1]" />
              <span>لحظات بسيطة، وقهوة تستحقها</span>
              <span className="h-px w-12 bg-[#d9d1c1]" />
            </div>
          </section>

          <aside className="relative flex flex-col items-center rounded-[24px] border border-[#d9cfba] bg-[#e9e4d8] px-5 py-6 text-center sm:px-7 sm:py-7 landscape:min-h-0 landscape:justify-center landscape:px-6 landscape:py-5">
            <div className="absolute inset-x-7 top-0 h-px bg-gradient-to-l from-transparent via-[#b99a69] to-transparent" />
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#cdbb99] bg-[#f6f2e9] text-[#8c7047]">
              <QrCode className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden="true" />
            </div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#9b7b4d]">قائمتنا بين يديك</p>
            <h2 className="mt-1.5 text-xl font-bold text-[#183a31] sm:text-2xl">اطلب الآن</h2>
            <p className="mt-2 max-w-[220px] text-xs leading-6 text-[#69756c] sm:text-sm">
              امسح الرمز بكاميرا جوالك وتصفح المنيو
            </p>
            <div className="my-4 flex aspect-square w-[158px] items-center justify-center rounded-[18px] border border-[#e5dfd2] bg-[#fffdf8] p-3 shadow-[0_7px_18px_rgba(48,52,40,0.08)] sm:my-5 sm:w-[184px] landscape:my-4 landscape:w-[166px] xl:landscape:w-[184px]">
              <img
                src="/__mockup/images/dual-pos/menu-qr.png"
                alt="رمز QR للمنيو"
                className="h-full w-full object-contain"
              />
            </div>
            <p dir="ltr" className="text-[11px] font-semibold tracking-[0.025em] text-[#42614f]">
              www.cluny.cafe/menu
            </p>
            <button
              type="button"
              className="mt-5 flex w-full max-w-[270px] items-center justify-between gap-3 rounded-[18px] border border-[#ead8ae] bg-[#f0d99e] px-4 py-3 text-start text-[#17392f] shadow-[0_10px_26px_rgba(34,48,34,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#9db7a0] active:translate-y-0 sm:px-5 sm:py-3.5 landscape:mt-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e684c] text-[#f6e7bf] shadow-sm">
                <Hand className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black leading-5 sm:text-lg">اضغط للبدء</span>
                <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-[#456255] sm:text-[11px]">
                  تصفّح المنيو على هذه الشاشة
                </span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 rotate-180 text-[#1e684c]" aria-hidden="true" />
            </button>
            <p className="mt-2 text-[10px] leading-5 text-[#68736a] sm:text-[11px]">
              أو امسح الرمز للطلب من جوالك
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

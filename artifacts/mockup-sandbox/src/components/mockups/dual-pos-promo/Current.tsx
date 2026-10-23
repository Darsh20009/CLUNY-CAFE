import "./_group.css";
import { Coffee, QrCode, Sparkles, Wifi } from "lucide-react";
import SarIcon from "@/components/sar-icon";

const products = [
  { name: "قهوة اليوم باردة وسط", price: 12, image: "/__mockup/images/dual-pos/drip-ice.png" },
  { name: "سجنـتـشر بارد", price: 14, image: "/__mockup/images/dual-pos/signature-ice.png" },
  { name: "كابتشينو", price: 10, image: "/__mockup/images/dual-pos/cappuccino.png" },
  { name: "قهوة اليوم باردة صغير", price: 10, image: "/__mockup/images/dual-pos/drip-ice.png" },
];

export function Current() {
  return (
    <main
      className="dual-pos-promo-group relative flex h-dvh min-h-0 overflow-hidden bg-[#06271f] p-5 text-white sm:p-8"
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(206,173,106,0.18),transparent_32%),radial-gradient(circle_at_82%_88%,rgba(34,120,88,0.34),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(45deg,transparent_48%,#d6c18b_49%,#d6c18b_51%,transparent_52%)] [background-size:46px_46px]" />
      <div className="absolute end-5 top-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-white/75 backdrop-blur-md">
        <span className="rounded-full bg-[#d6c18b]/15 px-2 py-1 font-black text-[#e4cc91]">شاشة #01</span>
        <Wifi className="h-4 w-4 text-emerald-300" />
        متصلة
      </div>
      <div className="relative z-10 mx-auto grid h-full w-full max-w-[1600px] grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-5 landscape:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] landscape:grid-rows-1 sm:gap-8">
        <section className="flex min-w-0 flex-col justify-center">
          <div className="mb-5 flex items-center gap-3">
            <img
              src="/__mockup/images/dual-pos/cluny-logo.png"
              alt="CLUNY CAFE"
              className="h-12 w-12 rounded-full bg-white object-contain p-1.5"
            />
            <div>
              <p className="text-xs font-semibold tracking-[0.3em] text-[#d6c18b]">CLUNY CAFE</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/55">
                <Sparkles className="h-3.5 w-3.5 text-[#d6c18b]" />
                اكتشف نكهاتنا المميزة
              </p>
            </div>
          </div>
          <h1 className="mb-5 text-2xl font-black leading-tight text-white sm:text-4xl">
            قهوتك المفضلة… أقرب مما تتخيل
          </h1>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {products.map((item, index) => (
              <article
                key={`${item.name}-${index}`}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-sm"
              >
                <div className="relative flex h-[55%] min-h-20 items-center justify-center overflow-hidden bg-white/5">
                  <Coffee className="h-9 w-9 text-[#d6c18b]/60" aria-hidden="true" />
                  <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 text-sm font-bold text-white sm:text-base">{item.name}</h2>
                  <p className="mt-2 flex items-center gap-1 text-sm font-black text-[#e4cc91]">
                    {item.price.toFixed(2)} <SarIcon size={12} />
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="flex flex-col items-center justify-center rounded-[2rem] border border-[#d6c18b]/35 bg-white/[0.08] px-4 py-6 text-center shadow-2xl backdrop-blur-md sm:px-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d6c18b]/15 text-[#e4cc91]">
            <QrCode className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-black text-white sm:text-2xl">اطلب الآن</h2>
          <p className="mt-2 text-sm leading-6 text-white/65">امسح الرمز بكاميرا جوالك وتصفح المنيو</p>
          <div className="my-5 flex aspect-square w-full max-w-[190px] items-center justify-center overflow-hidden rounded-2xl bg-white p-3 shadow-xl">
            <img src="/__mockup/images/dual-pos/menu-qr.png" alt="QR للمنيو" className="h-full w-full object-contain" />
          </div>
          <p className="break-all text-[11px] text-[#e4cc91]/80">www.cluny.cafe/menu</p>
          <div className="mt-auto flex items-center gap-2 pt-5 text-xs text-white/40">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#d6c18b]" />
            المس الشاشة لعرض المنيو
          </div>
        </aside>
      </div>
    </main>
  );
}

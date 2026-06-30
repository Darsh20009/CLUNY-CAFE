import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Star, Zap, Gift, ArrowLeft } from "lucide-react";
import clunyLogo from "@assets/cluny-logo-customer.png";
import { isCapacitorNative } from "@/lib/platform";

const ONBOARDING_DONE_KEY = "br_onboarding_done";

export function useOnboardingGuard() {
  const [, navigate] = useLocation();
  useEffect(() => {
    // Only block inside native app
    if (!isCapacitorNative()) return;
    const done = localStorage.getItem(ONBOARDING_DONE_KEY);
    if (done) return;
    navigate("/onboarding", { replace: true });
  }, []);
}

const slides = [
  {
    icon: null,
    emoji: "☕",
    titleAr: "مرحباً بك في BlackRose",
    subtitleAr: "اكتشف أفضل العروض والمكافآت الحصرية لعملائنا المميزين",
    bg: "from-[#0d0306] via-[#1a0510] to-[#0d0306]",
    accent: "#2D9B6E",
  },
  {
    icon: Star,
    emoji: null,
    titleAr: "برنامج الولاء",
    subtitleAr: "اجمع النقاط مع كل طلب واستبدلها بمشروبات ومكافآت حصرية مجاناً",
    bg: "from-[#060d0a] via-[#0a1a13] to-[#060d0a]",
    accent: "#C8A53A",
  },
  {
    icon: Zap,
    emoji: null,
    titleAr: "طلبات أسرع",
    subtitleAr: "اطلب مشروبك المفضل خلال ثوانٍ، سواء بالتوصيل أو الاستلام أو من طاولتك",
    bg: "from-[#05090d] via-[#0a1219] to-[#05090d]",
    accent: "#147EFB",
  },
  {
    icon: Gift,
    emoji: null,
    titleAr: "جاهز للبدء؟",
    subtitleAr: "سجّل الدخول أو تصفح القائمة الآن واستمتع بتجربة BlackRose الكاملة",
    bg: "from-[#0d0306] via-[#1a0510] to-[#0d0306]",
    accent: "#2D9B6E",
    isFinal: true,
  },
];

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const [current, setCurrent] = useState(0);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    // If not native app, skip onboarding
    if (!isCapacitorNative()) {
      const done = localStorage.getItem(ONBOARDING_DONE_KEY);
      if (!done) {
        // Mark done and redirect for web users
        localStorage.setItem(ONBOARDING_DONE_KEY, "1");
      }
      navigate("/", { replace: true });
    }
  }, []);

  const goTo = (index: number, dir: "left" | "right") => {
    if (index < 0 || index >= slides.length) return;
    setAnimDir(dir);
    setTimeout(() => {
      setCurrent(index);
      setAnimDir(null);
    }, 200);
  };

  const finish = () => {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    navigate("/menu", { replace: true });
  };

  const skip = () => {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    navigate("/menu", { replace: true });
  };

  const slide = slides[current];
  const Icon = slide.icon;
  const isLast = current === slides.length - 1;

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 bg-gradient-to-br ${slide.bg} flex flex-col`}
      style={{ transition: "background 0.5s ease" }}
    >
      {/* Skip button */}
      {!isLast && (
        <button
          onClick={skip}
          className="absolute top-12 left-5 z-10 text-white/40 text-sm font-semibold px-3 py-1.5 rounded-full hover:text-white/70 hover:bg-white/5 transition-all"
          data-testid="button-skip-onboarding"
        >
          تخطي
        </button>
      )}

      {/* Step indicator */}
      <div className="absolute top-12 right-5 flex gap-2 z-10">
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === current ? 22 : 7,
              height: 7,
              borderRadius: 4,
              background: i === current ? slide.accent : "rgba(255,255,255,0.18)",
              transition: "all 0.35s cubic-bezier(0.34,1.4,0.64,1)",
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 text-center"
        style={{
          opacity: animDir ? 0 : 1,
          transform: animDir === "left" ? "translateX(-30px)" : animDir === "right" ? "translateX(30px)" : "translateX(0)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}
      >
        {/* Icon area */}
        <div className="mb-10">
          {current === 0 ? (
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-40 h-40 rounded-full"
                style={{ background: `radial-gradient(circle, ${slide.accent}22 0%, transparent 70%)`, animation: "pulse 2s infinite" }}
              />
              <img
                src={clunyLogo}
                alt="BlackRose"
                className="relative w-28 h-28 object-contain drop-shadow-2xl"
                style={{ borderRadius: 30, boxShadow: `0 20px 60px ${slide.accent}44` }}
              />
            </div>
          ) : Icon ? (
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${slide.accent}22, ${slide.accent}08)`,
                border: `1.5px solid ${slide.accent}33`,
                boxShadow: `0 20px 60px ${slide.accent}33`,
              }}
            >
              <Icon size={56} color={slide.accent} strokeWidth={1.5} />
            </div>
          ) : null}

          {slide.emoji && !Icon && (
            <div className="text-8xl mb-2">{slide.emoji}</div>
          )}
        </div>

        {/* Text */}
        <h1
          className="text-3xl font-black text-white mb-4 leading-tight"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
        >
          {slide.titleAr}
        </h1>
        <p className="text-white/55 text-base leading-relaxed max-w-xs">
          {slide.subtitleAr}
        </p>
      </div>

      {/* Bottom navigation */}
      <div className="px-6 pb-12 pt-4 flex flex-col gap-4">
        {isLast ? (
          <>
            <button
              onClick={finish}
              className="w-full h-14 rounded-2xl text-white font-bold text-lg transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${slide.accent} 0%, ${slide.accent}bb 100%)`,
                boxShadow: `0 8px 28px ${slide.accent}44`,
              }}
              data-testid="button-onboarding-login"
            >
              ابدأ الآن 🚀
            </button>
            <button
              onClick={finish}
              className="w-full h-12 rounded-2xl text-white/40 text-sm font-semibold hover:text-white/60 transition-all"
            >
              تصفح بدون تسجيل
            </button>
          </>
        ) : (
          <div className="flex gap-3 items-center">
            {current > 0 && (
              <button
                onClick={() => goTo(current - 1, "right")}
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="button-onboarding-prev"
              >
                <ChevronRight size={22} color="rgba(255,255,255,0.5)" />
              </button>
            )}
            <button
              onClick={() => goTo(current + 1, "left")}
              className="flex-1 h-14 rounded-2xl text-white font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${slide.accent} 0%, ${slide.accent}bb 100%)`,
                boxShadow: `0 6px 24px ${slide.accent}33`,
              }}
              data-testid="button-onboarding-next"
            >
              التالي
              <ChevronLeft size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

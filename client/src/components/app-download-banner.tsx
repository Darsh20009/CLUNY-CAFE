import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import clunyLogo from "@assets/cluny-logo-customer.png";
import { getDeviceType, isMobileDevice, isCapacitorNative, isPWAStandalone, isIOS, isAndroid } from "@/lib/platform";

const BANNER_DISMISSED_KEY = "hide_app_banner";
const DISMISSED_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let cachedInstallPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    cachedInstallPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pwa-banner-installable"));
  });
}

function shouldShowBanner(): boolean {
  if (isCapacitorNative()) return false;
  if (isPWAStandalone()) return false;
  if (!isMobileDevice()) return false;
  const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
  if (dismissed) {
    const dismissedAt = parseInt(dismissed, 10);
    if (Date.now() - dismissedAt < DISMISSED_DURATION) return false;
  }
  return true;
}

// ── Store URLs — update once the apps are published ──────────────────────────
const APP_STORE_URL = "https://apps.apple.com/app/cluny-cafe";
// Set this to your Google Play Store URL once the app is published:
// e.g. "https://play.google.com/store/apps/details?id=cafe.cluny.app"
const PLAY_STORE_URL = "";          // leave empty to hide Play Store button
// ─────────────────────────────────────────────────────────────────────────────

const BANNER_STYLE = {
  position: "fixed" as const,
  top: 0,
  left: 0,
  right: 0,
  zIndex: 9000,
  background: "linear-gradient(135deg, #0d0d0d 0%, #1a0a10 100%)",
  borderBottom: "1px solid rgba(45,155,110,0.25)",
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
  animation: "slideDownBanner 0.35s cubic-bezier(0.34,1.4,0.64,1)",
};

const CLOSE_BTN_STYLE = {
  background: "rgba(255,255,255,0.08)",
  border: "none",
  borderRadius: "50%",
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const SLIDE_ANIM = `
  @keyframes slideDownBanner {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

export function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [canInstall, setCanInstall] = useState(!!cachedInstallPrompt);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!shouldShowBanner()) return;
    const t = setTimeout(() => setVisible(true), 2000);
    const handler = () => setCanInstall(true);
    window.addEventListener("pwa-banner-installable", handler);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pwa-banner-installable", handler);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowAndroidGuide(false);
    localStorage.setItem(BANNER_DISMISSED_KEY, String(Date.now()));
  };

  const handlePWAInstall = async () => {
    if (cachedInstallPrompt) {
      setInstalling(true);
      try {
        await cachedInstallPrompt.prompt();
        const { outcome } = await cachedInstallPrompt.userChoice;
        if (outcome === "accepted") {
          cachedInstallPrompt = null;
          dismiss();
        }
      } finally {
        setInstalling(false);
      }
    } else {
      setShowAndroidGuide(true);
    }
  };

  if (!visible) return null;

  // ── iOS Banner ───────────────────────────────────────────────────────────────
  if (isIOS()) {
    return (
      <div dir="rtl" style={BANNER_STYLE}>
        <img
          src={clunyLogo}
          alt="CLUNY"
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 13, margin: 0, lineHeight: 1.3 }}>
            📱 احصل على تجربة أسرع مع تطبيق BlackRose
          </p>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "2px 0 0" }}>
            حمّل التطبيق الآن واستمتع بمزايا إضافية
          </p>
        </div>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          style={{
            background: "linear-gradient(135deg, #2D9B6E 0%, #1A6B4A 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          <Download size={13} />
          App Store
        </a>
        <button onClick={dismiss} aria-label="إغلاق" style={CLOSE_BTN_STYLE}>
          <X size={14} color="rgba(255,255,255,0.4)" />
        </button>
        <style>{SLIDE_ANIM}</style>
      </div>
    );
  }

  // ── Android Banner ───────────────────────────────────────────────────────────
  if (isAndroid()) {
    const hasPlayStore = Boolean(PLAY_STORE_URL);

    return (
      <>
        <div dir="rtl" style={BANNER_STYLE}>
          <img
            src={clunyLogo}
            alt="CLUNY"
            style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 13, margin: 0, lineHeight: 1.3 }}>
              📱 احصل على تجربة أسرع مع تطبيق BlackRose
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "2px 0 0" }}>
              {hasPlayStore
                ? "حمّل من Google Play أو أضف للشاشة الرئيسية"
                : canInstall
                  ? "أضف التطبيق للشاشة الرئيسية بنقرة واحدة"
                  : "اضغط لمعرفة كيفية التثبيت"}
            </p>
          </div>

          {/* Google Play Store button — shown when URL is configured */}
          {hasPlayStore && (
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismiss}
              style={{
                background: "linear-gradient(135deg, #01875f 0%, #005c40 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                flexShrink: 0,
              }}
            >
              {/* Google Play icon (SVG) */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                <path d="M3.18 23.65c.37.21.79.26 1.19.14l.09-.05 10.01-10.01-2.84-2.84L3.18 23.65zm14.69-14.69-2.26-1.3-2.96 2.96 2.96 2.96 2.24-1.29c.64-.37.64-1.97.02-2.33zm-14.69-7.97 8.45 8.45-2.84 2.84L1.07 1.9C.97 1.68.92 1.43.93 1.17.95.55 1.5.02 2.13 0c.4-.01.77.15 1.05.99zm10.21 5.7L5.61.58c.42-.12.87-.07 1.27.14l10.01 5.78-2.6 2.19z"/>
              </svg>
              Play Store
            </a>
          )}

          {/* PWA install / manual guide button */}
          <button
            onClick={handlePWAInstall}
            disabled={installing}
            style={{
              background: installing
                ? "rgba(45,155,110,0.4)"
                : "linear-gradient(135deg, #2D9B6E 0%, #1A6B4A 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 800,
              cursor: installing ? "wait" : "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
              transition: "all 0.2s",
            }}
          >
            <Smartphone size={12} />
            {installing ? "..." : hasPlayStore ? "تثبيت سريع" : "تثبيت"}
          </button>

          <button onClick={dismiss} aria-label="إغلاق" style={CLOSE_BTN_STYLE}>
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
          <style>{SLIDE_ANIM}</style>
        </div>

        {/* Android manual guide overlay */}
        {showAndroidGuide && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAndroidGuide(false); }}
          >
            <div
              dir="rtl"
              style={{
                width: "100%",
                maxWidth: 480,
                background: "linear-gradient(160deg, #161616 0%, #0e0e0e 100%)",
                borderRadius: "26px 26px 0 0",
                border: "1px solid rgba(255,255,255,0.07)",
                overflow: "hidden",
                animation: "slideUpSheet 0.32s cubic-bezier(0.34,1.4,0.64,1)",
                paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px" }}>
                <div style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
              </div>
              <div style={{ padding: "8px 24px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "#fff", fontWeight: 800, fontSize: 18, margin: 0 }}>إضافة التطبيق للشاشة الرئيسية</p>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "4px 0 0" }}>اتبع الخطوات التالية</p>
                  </div>
                  <button
                    onClick={() => setShowAndroidGuide(false)}
                    style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <X size={16} color="rgba(255,255,255,0.4)" />
                  </button>
                </div>

                {[
                  { n: "١", title: "اضغط القائمة", desc: "اضغط أيقونة النقاط الثلاث (⋮) في أعلى المتصفح" },
                  { n: "٢", title: 'اختر "Add to Home Screen"', desc: "أو «إضافة إلى الشاشة الرئيسية» بالعربي" },
                  { n: "٣", title: "اضغط «إضافة»", desc: "ستظهر أيقونة BlackRose على شاشتك فوراً ✨" },
                ].map((step) => (
                  <div key={step.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(45,155,110,0.12)", border: "1.5px solid rgba(45,155,110,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ color: "#2D9B6E", fontWeight: 800, fontSize: 14 }}>{step.n}</span>
                    </div>
                    <div>
                      <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: "4px 0 5px" }}>{step.title}</p>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}

                {/* If Play Store URL is set, also show it in the guide */}
                {Boolean(PLAY_STORE_URL) && (
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { setShowAndroidGuide(false); dismiss(); }}
                    style={{
                      width: "100%", height: 52, borderRadius: 16,
                      background: "linear-gradient(135deg, #01875f 0%, #005c40 100%)",
                      border: "none", color: "#fff", fontSize: 15,
                      fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 10, textDecoration: "none",
                      boxShadow: "0 4px 20px rgba(1,135,95,0.35)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M3.18 23.65c.37.21.79.26 1.19.14l.09-.05 10.01-10.01-2.84-2.84L3.18 23.65zm14.69-14.69-2.26-1.3-2.96 2.96 2.96 2.96 2.24-1.29c.64-.37.64-1.97.02-2.33zm-14.69-7.97 8.45 8.45-2.84 2.84L1.07 1.9C.97 1.68.92 1.43.93 1.17.95.55 1.5.02 2.13 0c.4-.01.77.15 1.05.99zm10.21 5.7L5.61.58c.42-.12.87-.07 1.27.14l10.01 5.78-2.6 2.19z"/>
                    </svg>
                    تحميل من Google Play
                  </a>
                )}

                <button
                  onClick={() => { setShowAndroidGuide(false); dismiss(); }}
                  style={{
                    width: "100%", height: 52, borderRadius: 16,
                    background: "linear-gradient(135deg, #2D9B6E 0%, #1A6B4A 100%)",
                    border: "none", color: "#fff", fontSize: 16,
                    fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(45,155,110,0.35)",
                  }}
                >
                  فهمت! 👍
                </button>
              </div>
            </div>
            <style>{`
              @keyframes slideUpSheet {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
          </div>
        )}
      </>
    );
  }

  return null;
}

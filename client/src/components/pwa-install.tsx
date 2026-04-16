import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, PlusSquare, Smartphone, X, ChevronDown } from "lucide-react";
import clunyLogo from "@assets/cluny-logo-customer.png";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

// iOS Install Instructions Modal
function IOSInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-8 duration-400 pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-6 pt-2 pb-6">
          <div className="flex items-center gap-3 mb-5">
            <img src={clunyLogo} alt="كلوني كافيه" className="w-14 h-14 rounded-2xl shadow-md" />
            <div>
              <h2 className="text-lg font-black text-gray-900">ثبّت كلوني كافيه</h2>
              <p className="text-xs text-gray-500">على شاشتك الرئيسية</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-xl">1</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">اضغط على زر المشاركة</p>
                <p className="text-xs text-gray-500 mt-0.5">زر <Share2 className="inline w-3.5 h-3.5 text-blue-500" /> في أسفل المتصفح</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-xl">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">اختر "إضافة إلى الشاشة الرئيسية"</p>
                <p className="text-xs text-gray-500 mt-0.5">ابحث عن <PlusSquare className="inline w-3.5 h-3.5 text-blue-500" /> في القائمة</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <span className="text-xl">3</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">اضغط "إضافة" للتأكيد</p>
                <p className="text-xs text-gray-500 mt-0.5">سيظهر التطبيق على شاشتك فوراً</p>
              </div>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="w-full rounded-2xl h-12 font-bold text-sm bg-primary text-white"
          >
            فهمت، شكراً
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    if (isIOS()) {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    if (isAndroid()) {
      setPlatform("android");
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setVisible(false);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  if (installed || !visible) return null;

  // Android: Full-width bottom banner with Download button
  if (platform === "android") {
    return (
      <div className="fixed bottom-[4.5rem] left-3 right-3 z-[100] animate-in slide-in-from-bottom-6 duration-500">
        <div className="bg-[#1a1a2e] text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <img
              src={clunyLogo}
              alt="كلوني"
              className="w-12 h-12 rounded-2xl shrink-0 border border-white/10"
            />
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm leading-tight">كلوني كافيه</p>
              <p className="text-[11px] text-white/60 mt-0.5">ثبّت التطبيق على جهازك</p>
            </div>
            <Button
              onClick={handleAndroidInstall}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs px-4 h-9 shrink-0 gap-1.5"
              data-testid="button-pwa-android-install"
            >
              <Download className="w-4 h-4" />
              حمّل الآن
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // iOS: Bottom banner with "ثبّت التطبيق الآن" button
  if (platform === "ios") {
    return (
      <>
        <div className="fixed bottom-[4.5rem] left-3 right-3 z-[100] animate-in slide-in-from-bottom-6 duration-500">
          <div className="bg-[#1a1a2e] text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <img
                src={clunyLogo}
                alt="كلوني"
                className="w-12 h-12 rounded-2xl shrink-0 border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-tight">كلوني كافيه</p>
                <p className="text-[11px] text-white/60 mt-0.5">أضف التطبيق لشاشتك الرئيسية</p>
              </div>
              <Button
                onClick={() => setShowIOSModal(true)}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs px-4 h-9 shrink-0 gap-1.5"
                data-testid="button-pwa-ios-install"
              >
                <Smartphone className="w-4 h-4" />
                ثبّت الآن
              </Button>
            </div>
          </div>
        </div>

        {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
      </>
    );
  }

  return null;
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import clunyLogoStaff from "@assets/cluny-logo-staff.png";

export default function EmployeeSplash() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    document.title = "نظام الموظفين - CLUNY SYSTEMS | نظام إدارة متكامل";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'نظام إدارة الموظفين والعمليات في CLUNY SYSTEMS');

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1a2e2b] via-[#1e3530] to-[#12201e] flex items-center justify-center p-6 overflow-hidden relative">

      {/* Background glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[100px]"
          animate={{ scale: [1, 1.15, 1], x: [0, 15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#B58B5A]/20 blur-[100px]"
          animate={{ scale: [1, 1.1, 1], x: [0, -15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Unified Card */}
      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Top colored band */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-[#4eca9c] to-primary" />

          <div className="p-8 flex flex-col items-center gap-6" dir="rtl">

            {/* Logo */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-lg shadow-black/30 ring-1 ring-white/10">
                <img
                  src={clunyLogoStaff}
                  alt="CLUNY SYSTEMS"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Title & subtitle */}
            <div className="text-center">
              <h1 className="text-white font-bold text-2xl tracking-wide mb-1">
                CLUNY SYSTEMS
              </h1>
              <p className="text-white/50 text-sm font-cairo">
                نظام إدارة الموظفين
              </p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-white/10" />

            {/* Buttons or Loading */}
            {isLoading ? (
              <div className="flex gap-2 py-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-primary"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                className="w-full flex flex-col gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Button
                  size="lg"
                  onClick={() => setLocation("/employee/gateway")}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/25"
                >
                  الدخول للنظام
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  onClick={async () => {
                    const manifestTag = document.getElementById('main-manifest') as HTMLLinkElement;
                    if (manifestTag) {
                      const newManifest = manifestTag.cloneNode(true) as HTMLLinkElement;
                      newManifest.href = '/employee-manifest.json?v=' + Date.now();
                      manifestTag.parentNode?.replaceChild(newManifest, manifestTag);
                    }
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') setDeferredPrompt(null);
                    } else {
                      const ua = navigator.userAgent.toLowerCase();
                      if (/iphone|ipad|ipod/.test(ua)) {
                        alert("لتثبيت النظام على iPhone: اضغط على زر 'مشاركة' ثم 'إضافة إلى الشاشة الرئيسية'");
                      } else {
                        alert("لتثبيت النظام: اضغط على القائمة (⋮) ثم 'تثبيت التطبيق'");
                      }
                    }
                  }}
                  className="w-full text-white/60 hover:text-white hover:bg-white/5 h-10 rounded-xl font-cairo text-sm"
                >
                  <Download className="ml-2 h-4 w-4" />
                  تحميل كتطبيق
                </Button>
              </motion.div>
            )}

          </div>

          {/* Footer strip */}
          <div className="px-8 pb-5 text-center">
            <p className="text-white/25 text-xs font-cairo">
              أهلاً وسهلاً بك في نظام الموظفين
            </p>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

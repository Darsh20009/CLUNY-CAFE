import { useState, useEffect } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import clunyLogo from "@assets/cluny-logo-customer.png";

interface NotificationPermissionBannerProps {
  onRequestPermission: () => Promise<NotificationPermission | void>;
  onDismiss?: () => void;
}

export function NotificationPermissionBanner({
  onRequestPermission,
}: NotificationPermissionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") {
      setDenied(true);
      return;
    }
    // Show immediately — mandatory
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Also re-check permission state changes
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") setVisible(false);
    if (Notification.permission === "denied") {
      setDenied(true);
      setVisible(false);
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await onRequestPermission();
      if (result === "granted") {
        setVisible(false);
      } else if (result === "denied") {
        setDenied(true);
        setVisible(false);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    // Full-screen backdrop — blocks interaction until permission is decided
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="تفعيل الإشعارات"
    >
      <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-500 pb-safe">
        <div className="bg-[#111827] rounded-t-3xl shadow-2xl border-t border-white/10 px-6 pt-5 pb-8">

          {/* Handle bar */}
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Logo + Title */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <img
                src={clunyLogo}
                alt="كلوني كافيه"
                className="w-20 h-20 rounded-3xl shadow-xl border border-white/10"
              />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-[#111827]">
                <Bell className="w-4 h-4 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-black text-white mt-1">فعّل الإشعارات</h2>
            <p className="text-sm text-white/60 mt-1 leading-relaxed max-w-xs">
              لمتابعة حالة طلبك لحظة بلحظة وتلقّي أحدث العروض
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            {[
              { emoji: "📦", text: "تنبيه فوري عند قبول طلبك" },
              { emoji: "☕", text: "إشعار عند جاهزية المشروب" },
              { emoji: "🎁", text: "عروض حصرية ومكافآت خاصة" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3"
              >
                <span className="text-lg">{item.emoji}</span>
                <span className="text-sm text-white/80 font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleEnable}
            disabled={loading}
            className="w-full h-14 rounded-2xl text-base font-black bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 gap-2"
            data-testid="button-notif-enable"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري التفعيل...
              </>
            ) : (
              <>
                <Bell className="w-5 h-5" />
                تفعيل الإشعارات الآن
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-white/30 mt-3">
            يمكنك تغيير الإعدادات لاحقاً من إعدادات جهازك
          </p>
        </div>
      </div>
    </div>
  );
}

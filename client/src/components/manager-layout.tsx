import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ManagerSidebar, MobileBottomNav } from "./manager-sidebar";
import { ManagerNotificationCenter } from "./manager-notification-center";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { brand } from "@/lib/brand";

interface ManagerLayoutProps {
  children: ReactNode;
}

const managerPageTitles: Record<string, [string, string]> = {
  "/manager/dashboard": ["لوحة المدير", "Manager dashboard"],
  "/owner/dashboard": ["لوحة المالك", "Owner dashboard"],
  "/manager/orders": ["الطلبات", "Orders"],
  "/manager/attendance": ["الحضور والانصراف", "Attendance"],
  "/manager/accounting": ["المحاسبة", "Accounting"],
  "/manager/coupons": ["أكواد الخصم", "Discount codes"],
  "/manager/loyalty": ["برنامج الولاء", "Loyalty program"],
  "/manager/promotions": ["العروض", "Promotions"],
  "/manager/delivery": ["التوصيل", "Delivery"],
  "/manager/unified-reports": ["التقارير", "Reports"],
  "/manager/inventory": ["المخزون", "Inventory"],
  "/manager/tables": ["الطاولات", "Tables"],
  "/manager/reservations": ["حجوزات الطاولات", "Reservations"],
  "/admin/settings": ["إعدادات المتجر", "Store settings"],
};

export function ManagerLayout({ children }: ManagerLayoutProps) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");

  const { data: session } = useQuery<any>({
    queryKey: ["/api/verify-session"],
  });

  const manager = session?.employee || session?.manager || null;
  const role = manager?.role || "manager";
  const pageTitle = managerPageTitles[location]?.[isAr ? 0 : 1] || (isAr ? "مساحة التشغيل" : "Operations workspace");

  const handleLogout = async () => {
    await fetch("/api/employees/logout", { method: "POST" });
    localStorage.removeItem("qirox-restore-key");
    navigate("/manager/login");
  };

  return (
    <div className="flex h-[100dvh] bg-[#f8f9fa] text-foreground overflow-hidden" dir={isAr ? "rtl" : "ltr"}>
      <ManagerSidebar
        manager={manager}
        onLogout={handleLogout}
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className="flex-1 min-w-0 min-h-0 overflow-auto pb-16 lg:pb-0 relative flex flex-col">
        <header className="sticky top-0 z-30 flex min-h-[58px] items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 py-2 shrink-0">
          <div className="flex min-w-0 items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={isAr ? "فتح القائمة" : "Open navigation"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white select-none">
              <img src={brand.logoStaff} alt={brand.nameEn} className="h-6 w-6 shrink-0 object-contain" />
              <span className="text-sm text-slate-700 font-medium max-w-[160px] truncate">
                {isAr ? brand.nameAr : brand.nameEn}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center text-sm font-semibold text-slate-700">
            <div className="truncate">{pageTitle}</div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <ManagerNotificationCenter />
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      </main>
      <MobileBottomNav manager={manager} />
    </div>
  );
}

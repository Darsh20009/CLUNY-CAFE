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

export function ManagerLayout({ children }: ManagerLayoutProps) {
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");

  const { data: session } = useQuery<any>({
    queryKey: ["/api/verify-session"],
  });

  const manager = session?.employee || session?.manager || null;
  const role = manager?.role || "manager";

  const handleLogout = async () => {
    await fetch("/api/employees/logout", { method: "POST" });
    localStorage.removeItem("qirox-restore-key");
    navigate("/manager/login");
  };

  return (
    <div className="flex min-h-[100dvh] bg-background overflow-hidden" dir={isAr ? "rtl" : "ltr"}>
      <ManagerSidebar
        manager={manager}
        onLogout={handleLogout}
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className="flex-1 min-w-0 min-h-[100dvh] overflow-auto pb-20 lg:pb-0 relative">
        <header className="sticky top-0 z-30 flex h-[62px] items-center justify-between gap-3 border-b border-border/80 bg-background/90 px-3 sm:px-5 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={isAr ? "فتح القائمة" : "Open navigation"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <img src={brand.logoStaff} alt={brand.nameEn} className="h-8 w-8 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold tracking-[.16em] text-primary">{brand.nameEn}</p>
              <p className="truncate text-xs text-muted-foreground">{isAr ? "مساحة التشغيل" : "Operations workspace"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary sm:inline-flex">
              {isAr ? "متصل بالنظام" : "System online"}
            </span>
            <ManagerNotificationCenter />
          </div>
        </header>
        {children}
      </main>
      <MobileBottomNav manager={manager} />
    </div>
  );
}

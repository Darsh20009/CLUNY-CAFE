import { ReactNode } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { LanguageToggle } from './language-toggle';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { brand } from '@/lib/brand';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const pageTitles: Record<string, [string, string]> = {
    '/admin/settings': ['الإعدادات', 'Settings'],
    '/admin/employees': ['إدارة الموظفين', 'Team management'],
    '/admin/reports': ['التقارير', 'Reports'],
    '/admin/branches': ['الفروع', 'Branches'],
    '/admin/api': ['إدارة API', 'API management'],
    '/admin/notifications': ['الإشعارات', 'Notifications'],
    '/admin/payment-logs': ['سجل المدفوعات', 'Payment logs'],
  };
  const pageTitle = pageTitles[location]?.[isAr ? 0 : 1] || (isAr ? 'لوحة الإدارة' : 'Admin');

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground" dir={isAr ? 'rtl' : 'ltr'}>
      <AdminSidebar />
      <main className="flex-1 min-h-[100dvh] overflow-auto relative min-w-0">
        <header className="sticky top-0 z-40 grid min-h-[62px] grid-cols-3 items-center gap-3 border-b border-border/80 bg-background/90 px-3 sm:px-5 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <img src={brand.logoStaff} alt={brand.nameEn} className="h-9 w-9 rounded-xl bg-card p-1 object-contain ring-1 ring-border/70" />
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-bold tracking-[.15em] text-primary">{brand.nameEn}</span>
              <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{brand.platformNameEn}</span>
            </div>
          </div>
          <h1 className="truncate text-center text-sm font-semibold text-foreground">{pageTitle}</h1>
          <div className="flex justify-end">
            <LanguageToggle variant="outline" />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

import { ReactNode, useState } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { LanguageToggle } from './language-toggle';
import { Menu, Bell, UserRound } from 'lucide-react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { brand } from '@/lib/brand';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const { data: session } = useQuery<any>({ queryKey: ['/api/verify-session'], retry: false });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30_000,
    retry: false,
  });
  const accountName: string = session?.employee?.fullName || session?.manager?.fullName || '';
  const unreadCount = unreadData?.count ?? 0;
  const pageTitles: Record<string, [string, string]> = {
    '/admin/dashboard': ['لوحة الإدارة', 'Admin dashboard'],
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
    <div className="flex h-[100dvh] bg-[#f8f9fa] text-foreground overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} onMobileOpen={() => setMobileOpen(true)} />
      <main className="flex-1 min-h-0 overflow-auto relative min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex min-h-[58px] items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={isAr ? 'فتح القائمة' : 'Open navigation'}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white select-none">
              <img src={brand.logoStaff} alt={brand.nameEn} className="h-6 w-6 object-contain" />
              <span className="text-sm text-slate-700 font-medium max-w-[160px] truncate">{isAr ? brand.nameAr : brand.nameEn}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center text-sm font-semibold text-slate-700">
            <h1 className="truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center justify-end gap-1 shrink-0">
            {accountName ? (
              <div
                className="hidden sm:flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-600"
                title={accountName}
                aria-label={isAr ? `حساب ${accountName}` : `${accountName} account`}
              >
                <span className="max-w-[120px] truncate">{accountName}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {accountName.trim().charAt(0).toUpperCase()}
                </span>
              </div>
            ) : (
              <UserRound className="hidden sm:block h-5 w-5 text-slate-500" aria-hidden="true" />
            )}
            <button
              onClick={() => navigate('/admin/notifications')}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={isAr ? 'الإشعارات' : 'Notifications'}
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
            <LanguageToggle variant="outline" />
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      </main>
    </div>
  );
}

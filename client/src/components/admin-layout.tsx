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
    <div className="flex h-screen bg-[#F7F9F8] text-gray-900" dir={isAr ? 'rtl' : 'ltr'}>
      <AdminSidebar />
      <main className="flex-1 overflow-auto relative min-w-0">
        <header className="sticky top-0 z-40 grid grid-cols-3 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <img src={brand.logoStaff} alt={brand.nameAr} className="h-9 w-9 rounded-lg object-contain" />
            <span className="truncate text-sm font-bold text-gray-900">{brand.nameAr}</span>
          </div>
          <h1 className="truncate text-center text-sm font-semibold text-gray-700">{pageTitle}</h1>
          <div className="flex justify-end">
            <LanguageToggle variant="outline" />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

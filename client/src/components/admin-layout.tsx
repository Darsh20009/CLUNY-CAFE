import { ReactNode, type CSSProperties } from 'react';
import { useLocation } from 'wouter';
import { AdminSidebar, adminNavItems } from './admin-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

interface AdminLayoutProps {
  children: ReactNode;
}

function AdminMobileNav() {
  const [location, navigate] = useLocation();
  const primaryItems = adminNavItems.slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-orange-200/80 bg-white/95 px-2 py-2 shadow-2xl backdrop-blur md:hidden dark:border-orange-900/40 dark:bg-slate-950/95" dir="rtl" data-testid="nav-admin-mobile-bottom">
      <div className="grid grid-cols-5 gap-1">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold ${
                isActive
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'text-muted-foreground'
              }`}
              data-testid={`button-mobile-admin-${item.id}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate">{item.shortLabel || item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const activeItem = adminNavItems.find((item) => item.path === location);

  const sidebarStyle = {
    '--sidebar-width': '17rem',
    '--sidebar-width-icon': '4rem',
  } as CSSProperties;

  return (
    <SidebarProvider defaultOpen style={sidebarStyle}>
      <div className="flex min-h-screen w-full bg-slate-50 text-foreground dark:bg-slate-950" dir="rtl">
        <AdminSidebar />
        <SidebarInset className="min-w-0 flex-1 bg-transparent">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-orange-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:hidden dark:border-orange-900/40 dark:bg-slate-950/95">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400" data-testid="text-admin-mobile-brand">CLUNY CAFE</p>
              <h1 className="truncate text-base font-bold" data-testid="text-admin-mobile-title">{activeItem?.label || 'لوحة الإدارة'}</h1>
            </div>
            <SidebarTrigger data-testid="button-open-admin-menu" />
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden pb-24 md:pb-0" data-testid="main-admin-content">
            {children}
          </main>
          <AdminMobileNav />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

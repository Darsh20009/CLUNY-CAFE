import { useLocation } from 'wouter';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Bell, MonitorSmartphone, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export const adminNavItems = [
  { id: 'dashboard', label: 'لوحة التحكم', shortLabel: 'الرئيسية', icon: LayoutDashboard, path: '/admin/dashboard' },
  { id: 'reports', label: 'التقارير التفصيلية', shortLabel: 'التقارير', icon: FileText, path: '/admin/reports' },
  { id: 'employees', label: 'الموظفون', shortLabel: 'الموظفون', icon: Users, path: '/admin/employees' },
  { id: 'notifications', label: 'إرسال الإشعارات', shortLabel: 'الإشعارات', icon: Bell, path: '/admin/notifications' },
  { id: 'settings', label: 'الإعدادات', shortLabel: 'الإعدادات', icon: Settings, path: '/admin/settings' },
  { id: 'apple-pay', label: 'فحص Apple Pay', shortLabel: 'Apple Pay', icon: CreditCard, path: '/admin/apple-pay-health' },
  { id: 'publishing', label: 'نشر التطبيق', shortLabel: 'النشر', icon: MonitorSmartphone, path: '/admin/app-publishing' },
];

function AdminSidebarLink({ item }: { item: typeof adminNavItems[number] }) {
  const [location, navigate] = useLocation();
  const { setOpenMobile } = useSidebar();
  const Icon = item.icon;
  const isActive = location === item.path;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        size="lg"
        tooltip={item.label}
        className={isActive ? 'bg-orange-600 text-white' : ''}
      >
        <button
          type="button"
          onClick={() => {
            navigate(item.path);
            setOpenMobile(false);
          }}
          data-testid={`sidebar-link-${item.id}`}
        >
          <Icon className="h-5 w-5" />
          <span>{item.label}</span>
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdminSidebar() {
  const [, navigate] = useLocation();
  const { setOpenMobile } = useSidebar();

  const handleLogout = async () => {
    await fetch('/api/employees/logout', { method: 'POST' });
    localStorage.removeItem('cluny-restore-key');
    setOpenMobile(false);
    navigate('/employee/login');
  };

  return (
    <Sidebar side="right" collapsible="offcanvas" className="border-l border-orange-200 dark:border-orange-900/30">
      <SidebarHeader className="border-b border-orange-200/80 bg-gradient-to-b from-orange-50 to-white p-5 dark:border-orange-900/30 dark:from-slate-900 dark:to-slate-950">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-admin-brand">CLUNY CAFE</h2>
          <p className="text-xs text-muted-foreground" data-testid="text-admin-sidebar-subtitle">لوحة التحكم الإدارية</p>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white p-2 dark:bg-slate-950">
        <SidebarGroup>
          <SidebarGroupLabel>التنقل السريع</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => (
                <AdminSidebarLink key={item.path} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-orange-200/80 bg-white p-4 dark:border-orange-900/30 dark:bg-slate-950">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full justify-start"
          data-testid="button-logout"
        >
          <LogOut className="ml-2 h-4 w-4" />
          تسجيل الخروج
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

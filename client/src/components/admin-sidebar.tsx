import { useLocation } from 'wouter';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Bell, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AdminSidebar() {
  const [location, navigate] = useLocation();

  const menuItems = [
    { label: 'لوحة التحكم', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'الموظفون', icon: Users, path: '/admin/employees' },
    { label: 'التقارير', icon: FileText, path: '/admin/reports' },
    { label: 'إرسال الإشعارات', icon: Bell, path: '/admin/notifications' },
    { label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
    { label: 'نشر التطبيق', icon: MonitorSmartphone, path: '/admin/app-publishing' },
  ];

  const handleLogout = async () => {
    await fetch('/api/employees/logout', { method: 'POST' });
    localStorage.removeItem("cluny-restore-key");
    navigate('/employee/login');
  };

  return (
    <div className="w-64 bg-gradient-to-b from-orange-50 to-white dark:from-slate-900 dark:to-slate-950 border-l border-orange-200 dark:border-orange-900/30 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-orange-200 dark:border-orange-900/30">
        <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400">CLUNY CAFE</h2>
        <p className="text-xs text-muted-foreground mt-1">لوحة التحكم الإدارية</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'text-foreground hover:bg-orange-100 dark:hover:bg-orange-900/20'
              }`}
              data-testid={`sidebar-link-${item.label}`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-orange-200 dark:border-orange-900/30">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full justify-start"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 ml-2" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}

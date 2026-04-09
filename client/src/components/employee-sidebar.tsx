import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, ClipboardList, Settings, LogOut, User, BarChart3, Warehouse, Wallet, ChefHat, Table, Eye, Coffee, Utensils, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Employee } from '@shared/schema';
import clunyLogoStaff from "@assets/cluny-logo-staff.png";

interface EmployeeSidebarProps {
  employee: Employee | null;
  onLogout: () => void;
}

export function EmployeeSidebar({ employee, onLogout }: EmployeeSidebarProps) {
  const [location, navigate] = useLocation();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const baseMenuItems = [
    { label: t('sidebar.dashboard'), icon: LayoutDashboard, path: '/employee/dashboard' },
    { label: t('sidebar.cashier'), icon: ShoppingCart, path: '/employee/cashier' },
    { label: t('sidebar.pos'), icon: BarChart3, path: '/employee/pos' },
    { label: t('sidebar.orders'), icon: ClipboardList, path: '/employee/orders' },
    { label: t('sidebar.kitchen'), icon: ChefHat, path: '/employee/kitchen' },
    { label: t('sidebar.tables'), icon: Table, path: '/employee/table-orders' },
  ];

  const managerMenuItems = [
    { label: t('sidebar.system_management'), icon: Settings, path: '/admin/settings' },
    { label: t('sidebar.employee_management'), icon: User, path: '/admin/employees' },
    { label: t('sidebar.reports'), icon: BarChart3, path: '/admin/reports' },
    { label: t('sidebar.accounting'), icon: Wallet, path: '/manager/accounting' },
    { label: t('sidebar.inventory'), icon: Warehouse, path: '/manager/inventory' },
  ];

  const showManagerItems = ['manager', 'owner', 'admin'].includes(employee?.role || '');
  const isBothModes = true;

  const menuManagementItems = showManagerItems ? [
    { label: t('sidebar.drinks_management'), icon: Coffee, path: '/employee/menu-management' },
    ...(isBothModes ? [{ label: t('sidebar.food_management'), icon: Utensils, path: '/employee/menu-management?type=food' }] : []),
  ] : [];

  const menuItems = [
    ...baseMenuItems,
    ...menuManagementItems,
  ];

  return (
    <div className="hidden lg:flex w-64 bg-background border-l border-border flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <img 
            src={clunyLogoStaff} 
            alt="CLUNY SYSTEMS" 
            className="w-10 h-10 object-contain rounded-lg"
          />
          <div>
            <h2 className="text-lg font-bold text-foreground">CLUNY SYSTEMS</h2>
            <p className="text-xs text-muted-foreground">{t('sidebar.employee_system')}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t('sidebar.employee_label', { name: employee?.fullName || t('sidebar.loading') })}</p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const fullPath = location + window.location.search;
          const isActive = item.path.includes('?')
            ? fullPath === item.path
            : location === item.path && !window.location.search;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground hover:bg-primary/10'
              }`}
              data-testid={`sidebar-link-${item.path.split('/').pop()}`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}

        {showManagerItems && (
          <>
            <div className="my-4 border-t border-border pt-4">
              <p className="px-4 text-xs font-bold text-[#B58B5A] uppercase">{t('sidebar.admin_menu')}</p>
            </div>
            {managerMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-primary/10'
                  }`}
                  data-testid={`sidebar-link-${item.path.split('/').pop()}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <Button
          onClick={toggleLanguage}
          variant="outline"
          className="w-full justify-start text-sm border-border text-muted-foreground hover:bg-primary/10"
          data-testid="button-toggle-language"
        >
          <Languages className="w-4 h-4 ml-2" />
          {i18n.language === 'ar' ? 'English' : 'عربي'}
        </Button>
        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full justify-start text-sm border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          data-testid="button-logout-sidebar"
        >
          <LogOut className="w-4 h-4 ml-2" />
          {t('sidebar.logout')}
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, FileText, Settings, LogOut, Bell, Code2, GitBranch,
  Mail, Coffee, BookOpen, Star, ClipboardList, CreditCard, BarChart2, Package,
  TrendingUp, ShoppingCart, ChevronDown, ChevronUp, X, Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import clunyLogoStaff from "@assets/cluny-logo-customer.png";
import { brand } from "@/lib/brand";

export function AdminSidebar() {
  const [location, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language !== 'en';
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30_000,
    retry: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  const groups = [
    {
      label: isAr ? "الرئيسية" : "Main",
      items: [
        { label: isAr ? 'لوحة التحكم' : 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
      ]
    },
    {
      label: isAr ? "العمليات" : "Operations",
      items: [
        { label: isAr ? 'إدارة المأكولات والمشروبات' : 'Menu Management', icon: Coffee, path: '/employee/menu-management' },
        { label: isAr ? 'إدارة الطلبات' : 'Orders', icon: ClipboardList, path: '/manager/orders' },
        { label: isAr ? 'نقطة البيع' : 'POS', icon: ShoppingCart, path: '/employee/pos' },
        { label: isAr ? 'حجوزات الطاولات' : 'Table Reservations', icon: BookOpen, path: '/manager/reservations' },
        { label: isAr ? 'حجوزات المنتجات' : 'Product Reservations', icon: Star, path: '/manager/product-reservations' },
      ]
    },
    {
      label: isAr ? "الإدارة" : "Management",
      items: [
        { label: isAr ? 'الموظفون' : 'Employees', icon: Users, path: '/admin/employees' },
        { label: isAr ? 'الفروع' : 'Branches', icon: GitBranch, path: '/admin/branches' },
        { label: isAr ? 'المخزون' : 'Inventory', icon: Package, path: '/manager/inventory' },
      ]
    },
    {
      label: isAr ? "التقارير والتحليلات" : "Reports & Analytics",
      items: [
        { label: isAr ? 'تقارير المنتجات التفصيلية' : 'Product Reports', icon: BarChart2, path: '/manager/product-reports', badge: isAr ? 'جديد' : 'New' },
        { label: isAr ? 'التقارير الإدارية' : 'Admin Reports', icon: FileText, path: '/admin/reports' },
        { label: isAr ? 'التقارير الموحدة' : 'Unified Reports', icon: TrendingUp, path: '/manager/unified-reports' },
      ]
    },
    {
      label: isAr ? "التواصل" : "Communication",
      items: [
        { label: isAr ? 'إرسال الإشعارات' : 'Send Notifications', icon: Bell, path: '/admin/notifications', isNotifications: true },
        { label: isAr ? 'التسويق البريدي' : 'Email Marketing', icon: Mail, path: '/admin/email' },
      ]
    },
    {
      label: isAr ? "المالية والأمان" : "Finance & Security",
      items: [
        { label: isAr ? 'سجل الدفعات والنظام' : 'Payments & System', icon: CreditCard, path: '/admin/payment-logs' },
      ]
    },
    {
      label: isAr ? "الإعدادات" : "Settings",
      items: [
        { label: isAr ? 'الإعدادات' : 'Settings', icon: Settings, path: '/admin/settings' },
        { label: isAr ? 'إدارة API' : 'API Management', icon: Code2, path: '/admin/api' },
      ]
    },
  ];

  const toggleGroup = (label: string) => {
    setCollapsed(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const SidebarContent = () => (
    <>
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={clunyLogoStaff} alt={brand.platformNameEn} className="w-9 h-9 object-contain rounded-lg" />
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">{isAr ? brand.platformNameAr : brand.platformNameEn}</h2>
            <p className="text-[10px] text-muted-foreground">{isAr ? 'لوحة التحكم الإدارية' : 'Admin Dashboard'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {groups.map((group) => {
          const isCollapsed = collapsed.includes(group.label);
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{group.label}</span>
                {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item: any) => {
                    const Icon = item.icon;
                    const isActive = location === item.path || location.startsWith(item.path + '/');
                    const showBadge = item.isNotifications && unreadCount > 0;
                    return (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setMobileOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-right ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-foreground hover:bg-primary/10'
                        }`}
                        data-testid={`sidebar-link-${item.path.split('/').pop()}`}
                      >
                        <div className="relative shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                          {showBadge && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-[13px] flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold shrink-0">{item.badge}</span>
                        )}
                        {showBadge && (
                          <span className="min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Button
          onClick={async () => {
            await fetch('/api/employees/logout', { method: 'POST' });
            localStorage.removeItem("qirox-restore-key");
            navigate('/employee/login');
          }}
          variant="outline"
          className="w-full justify-start text-sm"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 ml-2" />
          {isAr ? 'تسجيل الخروج' : 'Logout'}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle button - only visible on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 right-0 h-full w-72 bg-background border-l border-border flex flex-col z-50 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute top-3 left-3">
          <button onClick={() => setMobileOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 bg-background border-l border-border flex-col h-screen sticky top-0">
        <SidebarContent />
      </div>
    </>
  );
}

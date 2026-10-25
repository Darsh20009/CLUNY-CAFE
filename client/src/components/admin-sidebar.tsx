import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, FileText, Settings, LogOut, Bell, Code2, GitBranch,
  Mail, Coffee, BookOpen, Star, ClipboardList, CreditCard, BarChart2, Package,
  TrendingUp, ShoppingCart, ChevronDown, X, Menu, BarChart3, Warehouse,
  Gift, Tag, Truck, Wallet, Table, Activity, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { brand } from "@/lib/brand";

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onMobileOpen?: () => void;
}

export function AdminSidebar({ mobileOpen, onMobileClose, onMobileOpen }: AdminSidebarProps) {
  const [location, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language !== 'en';
  const [collapsed, setCollapsed] = useState<string[]>(['inventory', 'products', 'management', 'marketing']);
  const [localMobileOpen, setLocalMobileOpen] = useState(false);
  const isMobileOpen = mobileOpen ?? localMobileOpen;
  const closeMobile = onMobileClose ?? (() => setLocalMobileOpen(false));
  const openMobile = onMobileOpen ?? (() => setLocalMobileOpen(true));

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30_000,
    retry: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  const topItems = [
    { label: isAr ? 'الملخص' : 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: isAr ? 'الطلبات' : 'Orders', icon: ShoppingCart, path: '/manager/orders' },
    { label: isAr ? 'الموظفون' : 'Employees', icon: Users, path: '/admin/employees' },
    { label: isAr ? 'الإعدادات' : 'Settings', icon: Settings, path: '/admin/settings' },
  ];

  const groups = [
    {
      key: 'reports',
      label: isAr ? "التقارير" : "Reports",
      icon: BarChart3,
      items: [
        { label: isAr ? 'تقارير المبيعات' : 'Sales Reports', icon: FileText, path: '/admin/reports' },
        { label: isAr ? 'سجل المدفوعات' : 'Payment Logs', icon: CreditCard, path: '/admin/payment-logs' },
        { label: isAr ? 'تقارير المنتجات' : 'Product Reports', icon: BarChart2, path: '/manager/product-reports' },
        { label: isAr ? 'تحليلات المنتجات' : 'Product Analytics', icon: TrendingUp, path: '/manager/product-analytics' },
        { label: isAr ? 'التقارير الموحدة' : 'Unified Reports', icon: Activity, path: '/manager/unified-reports' },
        { label: isAr ? 'تحليلات BI' : 'BI Analytics', icon: BarChart2, path: '/manager/bi-analytics' },
      ]
    },
    {
      key: 'inventory',
      label: isAr ? "المخزون" : "Inventory",
      icon: Warehouse,
      items: [
        { label: isAr ? 'نظرة المخزون' : 'Inventory Overview', icon: Warehouse, path: '/manager/inventory' },
        { label: isAr ? 'المواد الخام' : 'Raw Materials', icon: Package, path: '/manager/inventory/raw-items' },
        { label: isAr ? 'المشتريات' : 'Purchases', icon: ClipboardList, path: '/manager/inventory/purchases' },
        { label: isAr ? 'الوصفات' : 'Recipes', icon: Coffee, path: '/manager/inventory/recipes' },
        { label: isAr ? 'المخزون المتاح' : 'Stock', icon: Package, path: '/manager/inventory/stock' },
        { label: isAr ? 'تنبيهات المخزون' : 'Inventory Alerts', icon: Bell, path: '/manager/inventory/alerts' },
        { label: isAr ? 'حركات المخزون' : 'Stock Movements', icon: TrendingUp, path: '/manager/inventory/movements' },
        { label: isAr ? 'التحويلات' : 'Transfers', icon: Truck, path: '/manager/inventory/transfers' },
        { label: isAr ? 'الموردون' : 'Suppliers', icon: Users, path: '/manager/inventory/suppliers' },
      ]
    },
    {
      key: 'products',
      label: isAr ? "قائمة المنتجات" : "Products",
      icon: Coffee,
      items: [
        { label: isAr ? 'إدارة القائمة' : 'Menu Management', icon: Coffee, path: '/employee/menu-management' },
        { label: isAr ? 'نقطة البيع' : 'POS', icon: ShoppingCart, path: '/employee/pos' },
        { label: 'Dual POS', icon: Table, path: '/employee/dual-pos' },
        { label: isAr ? 'الطاولات' : 'Tables', icon: Table, path: '/manager/tables' },
        { label: isAr ? 'حجوزات الطاولات' : 'Table Reservations', icon: BookOpen, path: '/manager/reservations' },
        { label: isAr ? 'حجوزات المنتجات' : 'Product Reservations', icon: Star, path: '/manager/product-reservations' },
      ]
    },
    {
      key: 'management',
      label: isAr ? "الإدارة" : "Management",
      icon: Settings,
      items: [
        { label: isAr ? 'الفروع' : 'Branches', icon: GitBranch, path: '/admin/branches' },
        { label: isAr ? 'إدارة API' : 'API Management', icon: Code2, path: '/admin/api' },
        { label: isAr ? 'بوابة الدفع' : 'Payment Terminal', icon: CreditCard, path: '/manager/payment-terminal' },
        { label: isAr ? 'تتبع المدفوعات' : 'Payment Tracking', icon: Wallet, path: '/manager/payment-tracking' },
        { label: isAr ? 'تشخيص النظام' : 'System Diagnostics', icon: Activity, path: '/manager/system-diagnostics' },
        { label: isAr ? 'جودة النظام' : 'System Quality', icon: Activity, path: '/manager/system-quality' },
      ]
    },
    {
      key: 'marketing',
      label: isAr ? "التسويق" : "Marketing",
      icon: Gift,
      items: [
        { label: isAr ? 'برنامج الولاء' : 'Loyalty', icon: Gift, path: '/manager/loyalty' },
        { label: isAr ? 'العروض الترويجية' : 'Promotions', icon: Tag, path: '/manager/promotions' },
        { label: isAr ? 'أكواد الخصم' : 'Discount Codes', icon: Tag, path: '/manager/coupons' },
        { label: isAr ? 'الإشعارات' : 'Notifications', icon: Bell, path: '/admin/notifications', isNotifications: true },
        { label: isAr ? 'التسويق البريدي' : 'Email Marketing', icon: Mail, path: '/admin/email' },
      ]
    },
  ];

  const isActivePath = (path: string) => location === path || location.startsWith(`${path}/`);

  useEffect(() => {
    const activeGroup = groups.find(group =>
      group.items.some(item => isActivePath(item.path))
    );
    if (activeGroup && collapsed.includes(activeGroup.key)) {
      setCollapsed(prev => prev.filter(key => key !== activeGroup.key));
    }
  }, [location]);

  const toggleGroup = (key: string) => {
    setCollapsed(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  };

  const SidebarContent = () => (
    <>
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <img src={brand.logoStaff} alt={brand.nameEn} className="w-8 h-8 object-contain rounded-lg" />
          <div>
            <h2 className="text-sm font-black tracking-wide text-slate-900 leading-tight">{isAr ? brand.shortNameAr : brand.shortNameEn}</h2>
            <p className="text-[10px] text-slate-500">{isAr ? 'مساحة الإدارة' : 'Admin workspace'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="mb-2">
          {topItems.map(item => {
            const isActive = isActivePath(item.path);
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); closeMobile(); }}
                className={`relative w-full flex items-center gap-3 py-2 px-4 text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-primary font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                data-testid={`sidebar-link-${item.path.split('/').pop()}`}
              >
                {isActive && (
                  <span className={`absolute top-0 bottom-0 w-[3px] bg-primary ${isAr ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full'}`} />
                )}
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                <span className={`flex-1 truncate ${isAr ? 'text-right' : 'text-left'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mx-4 my-1 border-t border-slate-100" />
        {groups.map((group) => {
          const isCollapsed = collapsed.includes(group.key);
          const hasActiveChild = group.items.some(item => isActivePath(item.path));
          return (
            <div key={group.key} className="mb-1">
              <button
                onClick={() => toggleGroup(group.key)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
                  hasActiveChild && !isCollapsed
                    ? 'bg-primary/5 text-primary'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <group.icon className={`w-4 h-4 shrink-0 ${hasActiveChild ? 'text-primary' : 'text-slate-500'}`} />
                  {group.label}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item: any) => {
                    const Icon = item.icon;
                    const isActive = isActivePath(item.path);
                    const showBadge = item.isNotifications && unreadCount > 0;
                    return (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); closeMobile(); }}
                        className={`relative w-full flex items-center gap-3 py-2 text-sm transition-colors ${
                          isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'
                        } ${
                          isActive
                          ? 'bg-slate-100 text-primary font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                        data-testid={`sidebar-link-${item.path.split('/').pop()}`}
                      >
                        {isActive && <span className={`absolute top-0 bottom-0 w-[3px] bg-primary ${isAr ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full'}`} />}
                        <div className="relative shrink-0">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                        </div>
                        <span className={`font-medium text-[13px] flex-1 truncate ${isAr ? 'text-right' : 'text-left'}`}>{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold shrink-0">{item.badge}</span>
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

      <div className="border-t border-slate-100">
        <button
          onClick={() => { navigate('/manager/loyalty'); closeMobile(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Gift className="h-4 w-4 text-slate-400" />
          <span className={`flex-1 ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'رشح واكسب' : 'Refer & Earn'}</span>
        </button>
        <button
          onClick={() => { navigate('/help'); closeMobile(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
        >
          <HelpCircle className="h-4 w-4 text-slate-400" />
          <span className={`flex-1 ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? 'مركز المساعدة' : 'Help Center'}</span>
        </button>
        <Button
          onClick={async () => {
            await fetch('/api/employees/logout', { method: 'POST' });
            localStorage.removeItem("qirox-restore-key");
            navigate('/employee/login');
          }}
          variant="ghost"
          className={`w-full justify-start rounded-none px-4 py-2.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 ${isAr ? '' : 'flex-row-reverse'}`}
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
        onClick={openMobile}
        aria-label={isAr ? "فتح القائمة" : "Open navigation"}
        className={`lg:hidden fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center rounded-lg bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 ${onMobileOpen ? 'hidden' : ''}`}
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={closeMobile}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 ${isAr ? 'right-0 border-l' : 'left-0 border-r'} h-[100dvh] w-56 bg-white border-slate-200 flex flex-col z-50 transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : isAr ? 'translate-x-full' : '-translate-x-full'}`}>
        <div className={`absolute top-3 ${isAr ? 'left-3' : 'right-3'}`}>
          <button onClick={closeMobile} aria-label={isAr ? "إغلاق القائمة" : "Close navigation"} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex w-56 bg-white ${isAr ? 'border-l' : 'border-r'} border-slate-200 flex-col h-[100dvh] sticky top-0`}>
        <SidebarContent />
      </div>
    </>
  );
}

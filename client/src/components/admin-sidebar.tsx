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
  const [collapsed, setCollapsed] = useState<string[]>([]);
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

  const groups = [
    {
      label: isAr ? "الرئيسية" : "Main",
      icon: LayoutDashboard,
      items: [
        { label: isAr ? 'لوحة التحكم' : 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
      ]
    },
    {
      label: isAr ? "العمليات" : "Operations",
      icon: ClipboardList,
      items: [
        { label: isAr ? 'إدارة المأكولات والمشروبات' : 'Menu Management', icon: Coffee, path: '/employee/menu-management' },
        { label: isAr ? 'إدارة الطلبات' : 'Orders', icon: ClipboardList, path: '/manager/orders' },
        { label: isAr ? 'نقطة البيع' : 'POS', icon: ShoppingCart, path: '/employee/pos' },
        { label: 'Dual POS', icon: ShoppingCart, path: '/employee/dual-pos' },
        { label: isAr ? 'حجوزات الطاولات' : 'Table Reservations', icon: BookOpen, path: '/manager/reservations' },
        { label: isAr ? 'حجوزات المنتجات' : 'Product Reservations', icon: Star, path: '/manager/product-reservations' },
      ]
    },
    {
      label: isAr ? "الإدارة" : "Management",
      icon: Users,
      items: [
        { label: isAr ? 'الموظفون' : 'Employees', icon: Users, path: '/admin/employees' },
        { label: isAr ? 'الفروع' : 'Branches', icon: GitBranch, path: '/admin/branches' },
        { label: isAr ? 'المخزون' : 'Inventory', icon: Package, path: '/manager/inventory' },
      ]
    },
    {
      label: isAr ? "التقارير والتحليلات" : "Reports & Analytics",
      icon: BarChart2,
      items: [
        { label: isAr ? 'تقارير المنتجات التفصيلية' : 'Product Reports', icon: BarChart2, path: '/manager/product-reports', badge: isAr ? 'جديد' : 'New' },
        { label: isAr ? 'التقارير الإدارية' : 'Admin Reports', icon: FileText, path: '/admin/reports' },
        { label: isAr ? 'التقارير الموحدة' : 'Unified Reports', icon: TrendingUp, path: '/manager/unified-reports' },
      ]
    },
    {
      label: isAr ? "التواصل" : "Communication",
      icon: Bell,
      items: [
        { label: isAr ? 'إرسال الإشعارات' : 'Send Notifications', icon: Bell, path: '/admin/notifications', isNotifications: true },
        { label: isAr ? 'التسويق البريدي' : 'Email Marketing', icon: Mail, path: '/admin/email' },
      ]
    },
    {
      label: isAr ? "المالية والأمان" : "Finance & Security",
      icon: CreditCard,
      items: [
        { label: isAr ? 'سجل الدفعات والنظام' : 'Payments & System', icon: CreditCard, path: '/admin/payment-logs' },
      ]
    },
    {
      label: isAr ? "الإعدادات" : "Settings",
      icon: Settings,
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
        {groups.map((group) => {
          const isCollapsed = collapsed.includes(group.label);
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <group.icon className={`w-4 h-4 shrink-0 ${collapsed ? 'text-primary' : 'text-slate-500'}`} />
                  {group.label}
                </span>
                {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
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
                         onClick={() => { navigate(item.path); closeMobile(); }}
                        className={`relative w-full flex items-center gap-3 py-2 px-4 transition-colors text-sm ${
                          isActive
                          ? 'bg-primary/5 text-primary font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                        data-testid={`sidebar-link-${item.path.split('/').pop()}`}
                      >
                        {isActive && <span className={`absolute top-0 bottom-0 w-[3px] bg-primary ${isAr ? 'right-0' : 'left-0'}`} />}
                        <div className="relative shrink-0">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                          {showBadge && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
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

      <div className="py-1 border-t border-slate-100">
        <Button
          onClick={async () => {
            await fetch('/api/employees/logout', { method: 'POST' });
            localStorage.removeItem("qirox-restore-key");
            navigate('/employee/login');
          }}
          variant="ghost"
          className="w-full justify-start rounded-none px-4 py-2.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50"
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

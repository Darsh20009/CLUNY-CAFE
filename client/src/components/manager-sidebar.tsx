import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Package, Warehouse,
  Wallet, Users, Truck, BarChart3, Building2, Brain, Tag, Settings,
  ChefHat, Clock, Coffee, Gift, Star, Banknote, FileText, Globe,
  HardDrive, Code2, Store, Handshake, Shield,
  TrendingUp, MapPin, Receipt, Activity, ChevronDown, ChevronRight,
  LogOut, Menu, X, BarChart2, Zap, Box, FlaskConical, 
  ArrowRightLeft, Bell, Table, BookOpen, UserCheck, CreditCard, Monitor,
  Sparkles, MessageSquare, ShieldCheck, RefreshCw, Calculator, Columns2
} from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface ManagerSidebarProps {
  manager: any;
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  role?: string;
}

interface NavItem {
  label: string;
  labelEn: string;
  icon: any;
  path?: string;
  children?: NavItem[];
  color?: string;
  badge?: string;
  roles?: string[];
}

const NAV_GROUPS: { label: string; labelEn: string; icon: any; items: NavItem[] }[] = [
  {
    label: "التقارير", labelEn: "Reports", icon: BarChart3,
    items: [
      { label: "تحاليلي اليومي", labelEn: "My Daily Analytics", icon: TrendingUp, path: "/manager/tahalyli", badge: "AI" },
      { label: "تقارير المنتجات التفصيلية", labelEn: "Product Reports", icon: BarChart2, path: "/manager/product-reports", badge: "جديد" },
      { label: "التقارير", labelEn: "Reports", icon: FileText, path: "/admin/reports" },
      { label: "التقارير الموحدة", labelEn: "Unified Reports", icon: Building2, path: "/manager/unified-reports" },
      { label: "تحليلات BI", labelEn: "BI Analytics", icon: Brain, path: "/manager/bi-analytics" },
      { label: "سجل الأحداث", labelEn: "Audit Logs", icon: ShieldCheck, path: "/manager/audit-logs", roles: ["owner", "admin", "manager"] },
      { label: "الأداء وجودة النظام", labelEn: "Performance & Quality", icon: Activity, path: "/manager/system-quality", roles: ["owner", "admin"] },
      { label: "CEO AI — مستشار الأعمال", labelEn: "CEO AI", icon: Brain, path: "/manager/ceo-ai" },
      { label: "محاكي قرارات الأعمال", labelEn: "Business Simulator", icon: Calculator, path: "/manager/simulator" },
      { label: "التوأم الرقمي للفروع", labelEn: "Digital Twin", icon: Building2, path: "/manager/digital-twin" },
      { label: "مساعد الذكاء الاصطناعي", labelEn: "AI Assistant", icon: Zap, path: "/manager/ai" },
      { label: "تقارير ذكية", labelEn: "Smart Reports", icon: Sparkles, path: "/manager/smart-reports" },
      { label: "اختبارات النظام الشاملة", labelEn: "System Diagnostics", icon: ShieldCheck, path: "/manager/system-diagnostics", badge: "جديد" },
    ]
  },
  {
    label: "المخزون", labelEn: "Inventory", icon: Warehouse,
    items: [
      { label: "دورة المخزون الذكي", labelEn: "Inventory Cycle", icon: RefreshCw, path: "/manager/inventory/cycle" },
      { label: "الجرد الذكي", labelEn: "Smart Stocktake", icon: ClipboardList, path: "/manager/inventory/stocktake" },
      { label: "ذكاء المخزون AI", labelEn: "Inventory AI", icon: Sparkles, path: "/manager/inventory/ai" },
      { label: "نظرة المخزون", labelEn: "Inventory", icon: Warehouse, path: "/manager/inventory" },
      { label: "المواد الخام", labelEn: "Raw Items", icon: Box, path: "/manager/inventory/raw-items" },
      { label: "الوصفات", labelEn: "Recipes", icon: FlaskConical, path: "/manager/inventory/recipes" },
      { label: "المشتريات", labelEn: "Purchases", icon: Receipt, path: "/manager/inventory/purchases" },
      { label: "حركات المخزون", labelEn: "Movements", icon: ArrowRightLeft, path: "/manager/inventory/movements" },
      { label: "نقل بين الفروع", labelEn: "Transfers", icon: Truck, path: "/manager/inventory/transfers" },
      { label: "تنبيهات المخزون", labelEn: "Alerts", icon: Bell, path: "/manager/inventory/alerts", badge: "!" },
      { label: "إدارة المستودع", labelEn: "Warehouse", icon: Warehouse, path: "/manager/warehouse" },
    ]
  },
  {
    label: "المنتجات", labelEn: "Products", icon: Coffee,
    items: [
      { label: "الطاولات", labelEn: "Tables", icon: Table, path: "/manager/tables" },
      { label: "إدارة المأكولات والمشروبات", labelEn: "Menu", icon: Coffee, path: "/employee/menu-management" },
      { label: "حجوزات الطاولات", labelEn: "Table Reservations", icon: BookOpen, path: "/manager/reservations" },
      { label: "حجوزات المنتجات", labelEn: "Product Reservations", icon: Star, path: "/manager/product-reservations" },
      { label: "الورديات", labelEn: "Shifts", icon: Clock, path: "/manager/shifts" },
      { label: "الكيوسك", labelEn: "Kiosk", icon: Monitor, path: "/kiosk" },
    ]
  },
  {
    label: "الإدارة", labelEn: "Management", icon: Settings,
    items: [
      { label: "الموظفون", labelEn: "Employees", icon: Users, path: "/admin/employees" },
      { label: "الحضور", labelEn: "Attendance", icon: UserCheck, path: "/manager/attendance" },
      { label: "كيوسك الحضور", labelEn: "Attendance Kiosk", icon: Monitor, path: "/attendance-kiosk" },
      { label: "إدارة التوصيل", labelEn: "Delivery", icon: Truck, path: "/manager/delivery" },
      { label: "السائقون", labelEn: "Drivers", icon: MapPin, path: "/manager/drivers" },
      { label: "المحاسبة", labelEn: "Accounting", icon: Wallet, path: "/manager/accounting" },
      { label: "ZATCA فاتورة", labelEn: "ZATCA", icon: Shield, path: "/manager/zatca", roles: ["admin", "owner"] },
      { label: "ERP المحاسبة", labelEn: "ERP Accounting", icon: BookOpen, path: "/erp/accounting", roles: ["admin", "owner"] },
      { label: "إعدادات الفروع", labelEn: "Branches", icon: Building2, path: "/admin/branches", roles: ["admin", "owner"] },
      { label: "الإعدادات", labelEn: "Settings", icon: Settings, path: "/admin/settings" },
      { label: "دليل إعداد النظام", labelEn: "Setup guide", icon: Settings, path: "/admin/setup-wizard", roles: ["admin", "owner", "manager"] },
      { label: "التكاملات", labelEn: "Integrations", icon: Globe, path: "/manager/integrations", roles: ["admin", "owner"] },
      { label: "مفاتيح API", labelEn: "API keys", icon: Code2, path: "/manager/ecosystem", roles: ["admin", "owner"] },
      { label: "طبقة دمج أجهزة الدفع", labelEn: "Terminal Layer", icon: CreditCard, path: "/manager/payment-terminal", badge: "جديد" },
      { label: "تتبع المدفوعات", labelEn: "Payment Tracking", icon: BarChart2, path: "/manager/payment-tracking" },
      { label: "سوق B2B", labelEn: "B2B Market", icon: Store, path: "/manager/b2b", roles: ["admin", "owner"] },
      { label: "برنامج الشركاء", labelEn: "Partners", icon: Handshake, path: "/manager/partners", roles: ["admin", "owner"] },
      { label: "إدارة الأجهزة", labelEn: "Hardware", icon: HardDrive, path: "/manager/hardware", roles: ["admin", "owner"] },
      { label: "إدارة API", labelEn: "API Mgmt", icon: Code2, path: "/admin/api", roles: ["admin", "owner"] },
    ]
  },
  {
    label: "التسويق", labelEn: "Marketing", icon: Gift,
    items: [
      { label: "برنامج الولاء", labelEn: "Loyalty", icon: CreditCard, path: "/manager/loyalty" },
      { label: "العروض الترويجية", labelEn: "Promotions", icon: Tag, path: "/manager/promotions" },
      { label: "أكواد الخصم", labelEn: "Discount codes", icon: Tag, path: "/manager/coupons" },
      { label: "إرسال إشعارات Push", labelEn: "Push Notifications", icon: Bell, path: "/admin/notifications" },
      { label: "الموردون", labelEn: "Suppliers", icon: Handshake, path: "/manager/suppliers" },
    ]
  },
];

function SidebarNavItem({ item, collapsed, depth = 0, onNavigate }: { item: NavItem; collapsed: boolean; depth?: number; onNavigate?: (path: string) => void }) {
  const [location, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const label = isAr ? item.label : item.labelEn;
  const isActive = location === item.path || (!!item.path && location.startsWith(`${item.path}/`));

  if (item.children) {
    return (
      <div className="space-y-0.5">
        <button
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors",
            "text-slate-700 hover:text-slate-900 hover:bg-slate-50",
            depth > 0 && "pl-8"
          )}
        >
          <item.icon className="w-4 h-4 flex-shrink-0 text-slate-500" />
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
          {!collapsed && <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        {!collapsed && (
          <div className="space-y-0.5">
            {item.children.map(child => (
              <SidebarNavItem key={child.path} item={child} collapsed={collapsed} depth={depth + 1} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => item.path && (onNavigate ? onNavigate(item.path) : navigate(item.path))}
      className={cn(
        "w-full flex items-center gap-3 py-2 text-sm transition-colors group relative",
        depth > 0 ? "pr-10 pl-4" : "px-4",
        isActive
          ? "text-primary bg-primary/5 font-semibold"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium",
      )}
      title={collapsed ? label : undefined}
    >
      {isActive && (
        <span className={cn("absolute top-0 bottom-0 w-[3px] bg-primary", isAr ? "right-0 rounded-l-full" : "left-0 rounded-r-full")} />
      )}
      <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "text-slate-400")} />
      {!collapsed && (
        <>
          <span className={cn("flex-1 truncate", isAr ? "text-right" : "text-left")}>{label}</span>
          {item.badge && (
            <span className={cn("min-w-4 h-4 rounded-full px-1 text-[10px] flex items-center justify-center font-bold flex-shrink-0", item.badge === "!" ? "bg-destructive text-destructive-foreground" : "bg-primary/10 text-primary")}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export function ManagerSidebar({ manager, onLogout, mobileOpen, onMobileClose, role }: ManagerSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location, navigate] = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["المخزون"]));
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const userRole = role || manager?.role || "manager";

  useEffect(() => {
    const activeGroup = NAV_GROUPS.find(group =>
      group.items.some(item =>
        item.path && (location === item.path || location.startsWith(`${item.path}/`))
      )
    );
    if (!activeGroup) return;
    setExpandedGroups((previous) => {
      if (previous.has(activeGroup.label)) return previous;
      return new Set(previous).add(activeGroup.label);
    });
  }, [location]);

  const filterItemsByRole = (items: NavItem[]) =>
    items.filter(item => !item.roles || item.roles.includes(userRole));

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole);
  const dashboardPath = isOwnerOrAdmin ? '/owner/dashboard' : '/manager/dashboard';
  const topItems: NavItem[] = [
    { label: "لوحة التحكم", labelEn: "Overview", icon: LayoutDashboard, path: dashboardPath },
    { label: "إدارة الطلبات", labelEn: "Orders", icon: ClipboardList, path: "/manager/orders" },
    { label: "نقطة البيع", labelEn: "POS", icon: ShoppingCart, path: "/employee/pos" },
    { label: "Dual POS", labelEn: "Dual POS", icon: Columns2, path: "/employee/dual-pos" },
  ];
  const directPaths = new Set(["/manager/dashboard", "/owner/dashboard", "/manager/orders", "/employee/pos", "/employee/dual-pos"]);

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: filterItemsByRole(group.items).filter(item => !item.path || !directPaths.has(item.path)),
  })).filter(group => group.items.length > 0);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  const sidebarContent = (
    <div dir={isAr ? "rtl" : "ltr"} className={cn("flex flex-col h-full bg-white text-slate-800 border-slate-200 overflow-hidden transition-all duration-200", isAr ? "border-l" : "border-r", collapsed ? "w-[60px]" : "w-56")}>
      {/* Header */}
      <div className={cn("flex items-center border-b border-slate-100 flex-shrink-0", collapsed ? "justify-center px-2 py-4" : "justify-between px-5 py-4")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={brand.logoStaff} alt={brand.nameEn} className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-900 text-sm font-black tracking-wide truncate">{isAr ? brand.shortNameAr : brand.shortNameEn}</div>
              <div className="text-slate-500 text-[10px] truncate">{manager?.fullName || (isAr ? "مدير" : "Manager")}</div>
            </div>
          </div>
        )}
        <button
          onClick={() => mobileOpen ? onMobileClose?.() : setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex-shrink-0 transition-colors"
          aria-label={mobileOpen ? (isAr ? "إغلاق القائمة" : "Close navigation") : (isAr ? "طي القائمة" : "Collapse navigation")}
        >
          {mobileOpen ? <X className="w-4 h-4" /> : collapsed ? <Menu className="w-4 h-4" /> : <X className="w-3 h-3" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        <div className="mb-2">
          {topItems.map(item => (
            <button key={item.path} onClick={() => handleNavigate(item.path!)} className={cn(
              "relative w-full flex items-center gap-3 py-2 text-sm transition-colors",
              isAr ? "px-4" : "px-4",
              location === item.path || (!!item.path && location.startsWith(`${item.path}/`))
                ? "bg-primary/5 text-primary font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}>
              {(location === item.path || (!!item.path && location.startsWith(`${item.path}/`))) && <span className={cn("absolute top-0 bottom-0 w-[3px] bg-primary", isAr ? "right-0" : "left-0")} />}
              <item.icon className={cn("w-4 h-4 shrink-0", location === item.path || (!!item.path && location.startsWith(`${item.path}/`)) ? "text-primary" : "text-slate-400")} />
              {!collapsed && <span className={cn("flex-1 truncate", isAr ? "text-right" : "text-left")}>{isAr ? item.label : item.labelEn}</span>}
            </button>
          ))}
        </div>
        <div className="mx-4 my-1 border-t border-slate-100" />
        {visibleGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <group.icon className={cn("w-4 h-4 shrink-0", expandedGroups.has(group.label) ? "text-primary" : "text-slate-500")} />
                  {isAr ? group.label : group.labelEn}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", expandedGroups.has(group.label) && "rotate-180")} />
              </button>
            )}
            {(collapsed || expandedGroups.has(group.label)) && (
              <div className="pb-1">
                {group.items.map(item => (
                  <SidebarNavItem key={item.path || item.label} item={item} collapsed={collapsed} onNavigate={handleNavigate} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 flex-shrink-0 py-1">
        <button
          onClick={() => {
            const newLang = isAr ? "en" : "ar";
            i18n.changeLanguage(newLang);
            try { localStorage.setItem("i18nextLng", newLang); } catch {}
            document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
            document.documentElement.lang = newLang;
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-sm"
          title={collapsed ? (isAr ? "English" : "عربي") : undefined}
          data-testid="button-sidebar-language-toggle"
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className={cn("flex-1 font-medium", isAr ? "text-right" : "text-left")}>{isAr ? "English" : "عربي"}</span>}
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-sm"
          title={collapsed ? (isAr ? "تسجيل الخروج" : "Logout") : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className={cn("flex-1 font-medium", isAr ? "text-right" : "text-left")}>{isAr ? "تسجيل الخروج" : "Logout"}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-[100dvh] sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onMobileClose} />
          <aside className={cn("fixed top-0 h-[100dvh] z-50 flex lg:hidden shadow-2xl", isAr ? "right-0" : "left-0")}>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

/* Mobile bottom navigation bar */
export function MobileBottomNav({ manager }: { manager: any }) {
  const [location, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");
  const managerRole = manager?.role || "manager";
  const homePath = ['owner', 'admin'].includes(managerRole) ? '/owner/dashboard' : '/manager/dashboard';

  const items = [
    { label: isAr ? "الرئيسية" : "Home", icon: LayoutDashboard, path: homePath },
    { label: isAr ? "الطلبات" : "Orders", icon: ClipboardList, path: "/employee/orders" },
    { label: isAr ? "المخزون" : "Stock", icon: Warehouse, path: "/manager/inventory" },
    { label: isAr ? "التقارير" : "Reports", icon: BarChart2, path: "/manager/unified-reports" },
    { label: isAr ? "المحاسبة" : "Finance", icon: Wallet, path: "/manager/accounting" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-slate-100 shadow-md">
      <div className="flex items-center justify-around px-1 py-1 safe-area-pb">
        {items.map(item => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn("flex flex-col items-center gap-1 px-2 py-2 rounded-xl flex-1 transition-colors", isActive ? "bg-primary/5" : "hover:bg-slate-50")}
            >
              <item.icon className={cn("w-5 h-5 transition-transform", isActive ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-[10px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

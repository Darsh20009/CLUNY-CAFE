import { useState } from "react";
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
  Sparkles, MessageSquare, ShieldCheck, RefreshCw, Calculator
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

const NAV_GROUPS: { label: string; labelEn: string; color: string; items: NavItem[] }[] = [
  {
    label: "التقارير", labelEn: "Reports", color: "#2D9B6E",
    items: [
      { label: "تحاليلي اليومي", labelEn: "My Daily Analytics", icon: TrendingUp, path: "/manager/tahalyli", badge: "✨" },
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
    label: "المخزون", labelEn: "Inventory", color: "#2D9B6E",
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
    label: "المنتجات", labelEn: "Products", color: "#2D9B6E",
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
    label: "الإدارة", labelEn: "Management", color: "#2D9B6E",
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
    label: "التسويق", labelEn: "Marketing", color: "#2D9B6E",
    items: [
      { label: "برنامج الولاء", labelEn: "Loyalty", icon: CreditCard, path: "/manager/loyalty" },
      { label: "العروض الترويجية", labelEn: "Promotions", icon: Tag, path: "/manager/promotions" },
      { label: "أكواد الخصم", labelEn: "Discount codes", icon: Tag, path: "/manager/coupons" },
      { label: "إرسال إشعارات Push", labelEn: "Push Notifications", icon: Bell, path: "/admin/notifications" },
      { label: "الموردون", labelEn: "Suppliers", icon: Handshake, path: "/manager/suppliers" },
    ]
  },
];

function SidebarNavItem({ item, collapsed, depth = 0 }: { item: NavItem; collapsed: boolean; depth?: number }) {
  const [location, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const label = isAr ? item.label : item.labelEn;
  const isActive = location === item.path;

  if (item.children) {
    return (
      <div className="space-y-0.5">
        <button
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all",
            "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
            depth > 0 && "pl-8"
          )}
        >
          <item.icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
          {!collapsed && <ChevronDown className="w-3 h-3 opacity-50" />}
        </button>
        {!collapsed && (
          <div className="ml-4 space-y-0.5">
            {item.children.map(child => (
              <SidebarNavItem key={child.path} item={child} collapsed={collapsed} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => item.path && navigate(item.path)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all group relative",
        isActive
          ? "text-[#2D9B6E] bg-[#EDF7F2] border border-[#D8EEE3] font-semibold"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium",
        depth > 0 && "pl-6"
      )}
      title={collapsed ? label : undefined}
    >
      {isActive && (
        <span className={cn("absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-[#2D9B6E]", isAr ? "right-0 rounded-l-full" : "left-0 rounded-r-full")} />
      )}
      <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105", isActive ? "text-[#2D9B6E]" : "text-gray-400")} />
      {!collapsed && (
        <>
          <span className={cn("flex-1 truncate", isAr ? "text-right" : "text-left")}>{label}</span>
          {item.badge && (
            <span className={cn("min-w-4 h-4 rounded-full px-1 text-[10px] flex items-center justify-center font-bold flex-shrink-0", item.badge === "!" ? "bg-red-500 text-white" : "bg-[#E8F5EE] text-[#2D9B6E]")}>
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["التقارير", "المخزون"]));
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const userRole = role || manager?.role || "manager";

  const filterItemsByRole = (items: NavItem[]) =>
    items.filter(item => !item.roles || item.roles.includes(userRole));

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole);
  const dashboardPath = isOwnerOrAdmin ? '/owner/dashboard' : '/manager/dashboard';
  const topItems: NavItem[] = [
    { label: "لوحة التحكم", labelEn: "Overview", icon: LayoutDashboard, path: dashboardPath },
    { label: "إدارة الطلبات", labelEn: "Orders", icon: ClipboardList, path: "/manager/orders" },
    { label: "نقطة البيع", labelEn: "POS", icon: ShoppingCart, path: "/employee/pos" },
  ];
  const directPaths = new Set(["/manager/dashboard", "/owner/dashboard", "/manager/orders", "/employee/pos"]);

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

  const sidebarContent = (
    <div className={cn("flex flex-col h-full bg-white text-gray-900 border-l border-gray-200 overflow-hidden transition-all duration-300 shadow-sm", collapsed ? "w-[60px]" : "w-[248px]")}>
      {/* Header */}
      <div className={cn("flex items-center border-b border-gray-100 flex-shrink-0", collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-4")}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <img src={brand.logoStaff} alt={brand.nameAr} className="w-9 h-9 rounded-lg object-contain flex-shrink-0 bg-white" />
            <div className="min-w-0">
              <div className="text-gray-900 text-sm font-bold truncate">{brand.nameAr}</div>
              <div className="text-gray-500 text-[10px] truncate">{manager?.fullName || "مدير"}</div>
            </div>
          </div>
        )}
        <button
          onClick={() => mobileOpen ? onMobileClose?.() : setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 flex-shrink-0"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : collapsed ? <Menu className="w-4 h-4" /> : <X className="w-3 h-3" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent px-3">
        <div className="space-y-1 border-b border-gray-100 pb-3 mb-2">
          {topItems.map(item => (
            <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </div>
        {visibleGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
              >
                <span>{isAr ? group.label : group.labelEn}</span>
                {expandedGroups.has(group.label) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
            {(collapsed || expandedGroups.has(group.label)) && (
              <div className="space-y-0.5 pb-1">
                {group.items.map(item => (
                  <SidebarNavItem key={item.path || item.label} item={item} collapsed={collapsed} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-2 flex-shrink-0 space-y-1">
        <button
          onClick={() => {
            const newLang = isAr ? "en" : "ar";
            i18n.changeLanguage(newLang);
            try { localStorage.setItem("i18nextLng", newLang); } catch {}
            document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
            document.documentElement.lang = newLang;
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all text-sm"
          title={collapsed ? (isAr ? "English" : "عربي") : undefined}
          data-testid="button-sidebar-language-toggle"
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="font-medium">{isAr ? "English" : "عربي"}</span>}
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all text-sm"
          title={collapsed ? (isAr ? "تسجيل الخروج" : "Logout") : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="font-medium">{isAr ? "تسجيل الخروج" : "Logout"}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onMobileClose} />
          <aside className="fixed right-0 top-0 h-full z-50 flex lg:hidden">
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
  const managerRole = manager?.role || "manager";
  const homePath = ['owner', 'admin'].includes(managerRole) ? '/owner/dashboard' : '/manager/dashboard';

  const items = [
    { label: "الرئيسية", icon: LayoutDashboard, path: homePath, color: "#2D9B6E" },
    { label: "الطلبات", icon: ClipboardList, path: "/employee/orders", color: "#3b82f6" },
    { label: "المخزون", icon: Warehouse, path: "/manager/inventory", color: "#f59e0b" },
    { label: "التقارير", icon: BarChart2, path: "/manager/unified-reports", color: "#14b8a6" },
    { label: "المحاسبة", icon: Wallet, path: "/manager/accounting", color: "#8b5cf6" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around px-1 py-1 safe-area-pb">
        {items.map(item => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl flex-1 transition-all", isActive ? "bg-[#EDF7F2]" : "")}
            >
              <item.icon className="w-5 h-5 transition-transform" style={{ color: isActive ? "#2D9B6E" : "#9ca3af" }} />
              <span className="text-[10px] font-medium" style={{ color: isActive ? "#2D9B6E" : "#6b7280" }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

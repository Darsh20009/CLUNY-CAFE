import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import SarIcon from "@/components/sar-icon";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@/lib/useTranslate";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ShoppingCart, Coffee, Users, ClipboardList, Calendar, ChefHat,
  LayoutDashboard, Package, BarChart3, Settings, CreditCard,
  Receipt, Boxes, Truck, FileText, UserCog, Bell, Gift, Tag,
  MonitorSmartphone, Home, Wallet, TrendingUp, MapPin, Star,
  Layers, Building2, Wrench, Database, Globe, Shield, Cpu,
  BarChart, PieChart, FlaskConical, Leaf, Zap, BookOpen,
  RefreshCw, AlertTriangle, DollarSign, ClipboardCheck,
  MessagesSquare, Mail, Key, Fingerprint, Car, Warehouse,
} from "lucide-react";

interface QuickLink {
  ar: string;
  en: string;
  path: string;
  icon: React.ReactNode;
  groupAr: string;
  groupEn: string;
}

const QUICK_LINKS: QuickLink[] = [
  // ── موظف: تنقل سريع ─────────────────────────────────────────────
  { ar: "الصفحة الرئيسية للموظف", en: "Employee Home", path: "/employee/home", icon: <Home className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "كاشير POS", en: "POS Cashier", path: "/employee/pos", icon: <ShoppingCart className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "نظام نقطة البيع", en: "POS System", path: "/employee/pos-system", icon: <MonitorSmartphone className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "شاشة المطبخ", en: "Kitchen Display", path: "/employee/kitchen", icon: <ChefHat className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "الطلبات الحية", en: "Live Orders", path: "/employee/orders", icon: <ClipboardList className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "عرض الطلبات", en: "Orders Display", path: "/employee/orders-display", icon: <ClipboardList className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "حضور وانصراف", en: "Attendance", path: "/employee/attendance", icon: <Calendar className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "الطاولات", en: "Tables", path: "/employee/tables", icon: <LayoutDashboard className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "طلبات الطاولات", en: "Table Orders", path: "/employee/table-orders", icon: <ClipboardList className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "حجوزات الطاولات", en: "Table Reservations", path: "/employee/reservations", icon: <Calendar className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "حجوزات المنتجات", en: "Product Reservations", path: "/employee/product-reservations", icon: <Gift className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "ولاء العملاء", en: "Customer Loyalty", path: "/employee/loyalty", icon: <Star className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "الشيفت والكاشير", en: "Shift Management", path: "/employee/shifts", icon: <RefreshCw className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "طلب إجازة", en: "Leave Request", path: "/employee/leave-request", icon: <Calendar className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "الكاشير", en: "Cashier", path: "/employee/cashier", icon: <Receipt className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "رمز QR للكيوسك", en: "Kiosk QR Code", path: "/employee/kiosk-qr", icon: <MonitorSmartphone className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "توفر الموظف", en: "My Availability", path: "/employee/availability", icon: <Calendar className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "مساعد الذكاء الاصطناعي للموظف", en: "Employee AI Assistant", path: "/employee/ai", icon: <Cpu className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },
  { ar: "لوحة الموظف", en: "Employee Dashboard", path: "/employee/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, groupAr: "موظف", groupEn: "Employee" },

  // ── مدير: إدارة ─────────────────────────────────────────────────
  { ar: "لوحة المدير", en: "Manager Dashboard", path: "/manager/dashboard", icon: <BarChart3 className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "لوحة المالك", en: "Owner Dashboard", path: "/owner/dashboard", icon: <UserCog className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "لوحة التنفيذي", en: "Executive Dashboard", path: "/executive/dashboard", icon: <TrendingUp className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "إدارة المنيو", en: "Menu Management", path: "/employee/menu-management", icon: <Coffee className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "الموظفون", en: "Employees", path: "/admin/employees", icon: <Users className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "إدارة الموظفين", en: "Manage Employees", path: "/manager/employees", icon: <Users className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "مركز الموظفين", en: "Employees Hub", path: "/manager/employees/hub", icon: <Users className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "الرواتب", en: "Payroll", path: "/manager/payroll", icon: <DollarSign className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "الطاولات (مدير)", en: "Tables (Manager)", path: "/manager/tables", icon: <LayoutDashboard className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "سجل الحضور", en: "Attendance Log", path: "/manager/attendance", icon: <ClipboardCheck className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "تقييمات العملاء", en: "Customer Reviews", path: "/manager/reviews", icon: <Star className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "شيفت المدير", en: "Manager Shifts", path: "/manager/shifts", icon: <RefreshCw className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "حجوزات (مدير)", en: "Reservations (Manager)", path: "/manager/reservations", icon: <Calendar className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "حجوزات المنتجات (مدير)", en: "Product Reservations (Manager)", path: "/manager/product-reservations", icon: <Gift className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },
  { ar: "طلبات المدير", en: "Manager Orders", path: "/manager/orders", icon: <ClipboardList className="w-4 h-4" />, groupAr: "مدير", groupEn: "Manager" },

  // ── مالية وتقارير ──────────────────────────────────────────────
  { ar: "المحاسبة", en: "Accounting", path: "/manager/accounting", icon: <Wallet className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "نظام ERP المحاسبي", en: "ERP Accounting", path: "/manager/erp", icon: <BookOpen className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "فواتير ZATCA", en: "ZATCA Invoices", path: "/manager/zatca", icon: <Receipt className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "الرواتب", en: "Payroll", path: "/manager/payroll", icon: <DollarSign className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "التحليلات المتقدمة", en: "Advanced Analytics", path: "/manager/analytics", icon: <BarChart3 className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "BI Analytics", en: "BI Analytics", path: "/manager/bi-analytics", icon: <TrendingUp className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "تقارير موحدة", en: "Unified Reports", path: "/manager/unified-reports", icon: <FileText className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "تقارير ذكية", en: "Smart Reports", path: "/manager/smart-reports", icon: <BarChart className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },
  { ar: "تتبع الدفعات الأونلاين", en: "Online Payment Tracking", path: "/manager/payment-tracking", icon: <CreditCard className="w-4 h-4" />, groupAr: "مالية", groupEn: "Finance" },

  // ── المخزون ──────────────────────────────────────────────────
  { ar: "المخزون الذكي", en: "Smart Inventory", path: "/manager/inventory", icon: <Boxes className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "المواد الخام", en: "Raw Items", path: "/manager/inventory/raw-items", icon: <Leaf className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "تنبيهات المخزون", en: "Inventory Alerts", path: "/manager/inventory/alerts", icon: <Bell className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "الموردون", en: "Suppliers", path: "/manager/inventory/suppliers", icon: <Truck className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "إدارة الموردين", en: "Supplier Management", path: "/manager/suppliers", icon: <Truck className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "المشتريات", en: "Purchases", path: "/manager/inventory/purchases", icon: <Package className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "الوصفات والمكونات", en: "Recipes", path: "/manager/inventory/recipes", icon: <FlaskConical className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "مستوى المخزون", en: "Stock Levels", path: "/manager/inventory/stock", icon: <Layers className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "حركات المخزون", en: "Stock Movements", path: "/manager/inventory/movements", icon: <RefreshCw className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "تحويلات المخزون", en: "Stock Transfers", path: "/manager/inventory/transfers", icon: <Truck className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "دورة المخزون", en: "Inventory Cycle", path: "/manager/inventory/cycle", icon: <RefreshCw className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "الجرد الذكي", en: "Smart Stocktake", path: "/manager/inventory/stocktake", icon: <ClipboardCheck className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "ذكاء اصطناعي للمخزون", en: "Inventory AI", path: "/manager/inventory/ai", icon: <Cpu className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "تنظيم المخزون", en: "Stock Organization", path: "/manager/inventory/stock-organization", icon: <Layers className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "مركز المخزون", en: "Inventory Hub", path: "/manager/inventory/hub", icon: <Warehouse className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "إدارة المستودعات", en: "Warehouse Management", path: "/manager/warehouse", icon: <Warehouse className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },

  // ── التوصيل ──────────────────────────────────────────────────
  { ar: "لوحة التوصيل", en: "Delivery Dashboard", path: "/manager/delivery", icon: <Truck className="w-4 h-4" />, groupAr: "توصيل", groupEn: "Delivery" },
  { ar: "السائقون", en: "Drivers", path: "/manager/drivers", icon: <Car className="w-4 h-4" />, groupAr: "توصيل", groupEn: "Delivery" },
  { ar: "مناطق التوصيل", en: "Delivery Zones", path: "/manager/delivery-zones", icon: <MapPin className="w-4 h-4" />, groupAr: "توصيل", groupEn: "Delivery" },

  // ── الإعدادات والنظام ──────────────────────────────────────────
  { ar: "الفروع", en: "Branches", path: "/admin/branches", icon: <Building2 className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "إعدادات النظام", en: "System Settings", path: "/admin/settings", icon: <Settings className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "بطاقات الهدايا", en: "Gift Cards", path: "/manager/gift-cards", icon: <Gift className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "العروض والخصومات", en: "Promotions", path: "/manager/promotions", icon: <Tag className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "برنامج الولاء", en: "Loyalty Program", path: "/manager/loyalty", icon: <CreditCard className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "إشعارات الإدارة", en: "Admin Notifications", path: "/admin/notifications", icon: <Bell className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "تسويق بالإيميل", en: "Email Marketing", path: "/admin/email", icon: <Mail className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "إدارة API", en: "API Management", path: "/admin/api", icon: <Key className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "سجلات الدفع", en: "Payment Logs", path: "/admin/payment-logs", icon: <Receipt className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "سجلات التدقيق", en: "Audit Logs", path: "/manager/audit-logs", icon: <Shield className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "التكاملات الخارجية", en: "External Integrations", path: "/manager/integrations", icon: <Globe className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "كشك الطلب الذاتي", en: "Self-Order Kiosk", path: "/kiosk", icon: <MonitorSmartphone className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "شاشة العميل", en: "Customer Display", path: "/customer-display", icon: <MonitorSmartphone className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "دليل النظام", en: "System Guide", path: "/guide", icon: <BookOpen className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "دليل المستخدم", en: "User Guide", path: "/manager/guide", icon: <BookOpen className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "نقاط البيع الحضورية", en: "Attendance Kiosk", path: "/attendance-kiosk", icon: <Fingerprint className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },

  // ── ذكاء اصطناعي وتقنية ──────────────────────────────────────
  { ar: "لوحة AI التنفيذي", en: "CEO AI Dashboard", path: "/manager/ceo-ai", icon: <Cpu className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },
  { ar: "الأتمتة الذكية", en: "AI Automation", path: "/manager/ai-automation", icon: <Zap className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },
  { ar: "محاكي الأعمال", en: "Business Simulator", path: "/manager/simulator", icon: <PieChart className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },
  { ar: "التوأم الرقمي", en: "Digital Twin", path: "/manager/digital-twin", icon: <Cpu className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },
  { ar: "مركز النظام البيئي", en: "Ecosystem Hub", path: "/manager/ecosystem", icon: <Globe className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },
  { ar: "مركز الموثوقية", en: "Reliability Hub", path: "/manager/reliability", icon: <Shield className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },
  { ar: "لوحة QIROX الإدارية", en: "QIROX Admin Panel", path: "/qirox", icon: <Database className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },
  { ar: "الأجهزة", en: "Hardware Management", path: "/admin/hardware", icon: <Wrench className="w-4 h-4" />, groupAr: "ذكاء اصطناعي", groupEn: "AI & Tech" },

  // ── برامج الشراكة ─────────────────────────────────────────────
  { ar: "برنامج الشراكة B2B", en: "B2B Marketplace", path: "/manager/b2b", icon: <Building2 className="w-4 h-4" />, groupAr: "شراكات", groupEn: "Partnerships" },
  { ar: "برنامج الشركاء", en: "Partner Program", path: "/manager/partners", icon: <Users className="w-4 h-4" />, groupAr: "شراكات", groupEn: "Partnerships" },
  { ar: "برنامج الإحالة", en: "Referral Program", path: "/referrals", icon: <Gift className="w-4 h-4" />, groupAr: "شراكات", groupEn: "Partnerships" },

  // ── العميل ──────────────────────────────────────────────────
  { ar: "المنيو", en: "Menu", path: "/menu", icon: <Coffee className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
  { ar: "تتبع الطلب", en: "Order Tracking", path: "/tracking", icon: <MapPin className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
  { ar: "احجز طاولة", en: "Table Reservation", path: "/table-reservation", icon: <Calendar className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
  { ar: "حجوزاتي", en: "My Reservations", path: "/my-reservations", icon: <Calendar className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
  { ar: "بطاقتي", en: "My Card", path: "/my-card", icon: <CreditCard className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
  { ar: "طلباتي", en: "My Orders", path: "/my-orders", icon: <ClipboardList className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
  { ar: "عروضي", en: "My Offers", path: "/my-offers", icon: <Tag className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
  { ar: "الاستلام من السيارة", en: "Curbside Pickup", path: "/curbside", icon: <Car className="w-4 h-4" />, groupAr: "العميل", groupEn: "Customer" },
];

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const tc = useTranslate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    enabled: open,
    staleTime: 30_000,
  });
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/coffee-items"],
    enabled: open,
    staleTime: 60_000,
  });
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    enabled: open,
    staleTime: 60_000,
  });
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    enabled: open,
    staleTime: 60_000,
  });

  const q = search.trim().toLowerCase();
  const currency = tc("ر.س", "SAR");

  const filteredOrders = useMemo(() => {
    if (!q) return [];
    return (orders || []).filter((o: any) => {
      const num = String(o.orderNumber || "").toLowerCase();
      const phone = String(o.customerPhone || "").toLowerCase();
      const name = String(o.customerName || "").toLowerCase();
      return num.includes(q) || phone.includes(q) || name.includes(q);
    }).slice(0, 6);
  }, [orders, q]);

  const filteredProducts = useMemo(() => {
    if (!q) return [];
    return (products || []).filter((p: any) => {
      const ar = String(p.nameAr || p.name || "").toLowerCase();
      const en = String(p.nameEn || "").toLowerCase();
      return ar.includes(q) || en.includes(q);
    }).slice(0, 6);
  }, [products, q]);

  const filteredCustomers = useMemo(() => {
    if (!q) return [];
    return (customers || []).filter((c: any) => {
      const phone = String(c.phone || "").toLowerCase();
      const name = String(c.name || "").toLowerCase();
      return phone.includes(q) || name.includes(q);
    }).slice(0, 5);
  }, [customers, q]);

  const filteredEmployees = useMemo(() => {
    if (!q) return [];
    return (employees || []).filter((e: any) => {
      const name = String(e.name || "").toLowerCase();
      const phone = String(e.phone || "").toLowerCase();
      const role = String(e.role || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || role.includes(q);
    }).slice(0, 5);
  }, [employees, q]);

  const go = (path: string) => {
    setOpen(false);
    setSearch("");
    setLocation(path);
  };

  const linkGroups = useMemo(() => {
    const groups: Record<string, { ar: string; en: string; path: string; icon: React.ReactNode }[]> = {};
    QUICK_LINKS.forEach((l) => {
      const label = (l.ar + " " + l.en).toLowerCase();
      if (q && !label.includes(q)) return;
      const key = tc(l.groupAr, l.groupEn);
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    return groups;
  }, [q, tc]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={tc("ابحث عن طلب / منتج / عميل / موظف أو صفحة...", "Search orders / products / customers / employees or pages...")}
        value={search}
        onValueChange={setSearch}
        data-testid="input-command-search"
      />
      <CommandList className="max-h-[500px]">
        <CommandEmpty>{tc("لا توجد نتائج", "No results")}</CommandEmpty>

        {filteredOrders.length > 0 && (
          <>
            <CommandGroup heading={tc("الطلبات", "Orders")}>
              {filteredOrders.map((o: any) => (
                <CommandItem
                  key={o.id || o._id}
                  onSelect={() => go(`/employee/orders?id=${o.id || o._id}`)}
                  data-testid={`cmd-order-${o.orderNumber || o.id}`}
                >
                  <Receipt className="w-4 h-4 ml-2 text-primary" />
                  <span className="font-medium">#{o.orderNumber}</span>
                  <span className="text-muted-foreground text-sm mr-2">
                    {o.customerName || o.customerPhone || "—"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{o.total} <SarIcon size={11} /></span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredProducts.length > 0 && (
          <>
            <CommandGroup heading={tc("المنتجات", "Products")}>
              {filteredProducts.map((p: any) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => go(`/employee/menu-management?productId=${p.id}`)}
                  data-testid={`cmd-product-${p.id}`}
                >
                  <Coffee className="w-4 h-4 ml-2 text-primary" />
                  <span>{tc(p.nameAr || p.name, p.nameEn || p.nameAr || p.name)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.price} <SarIcon size={11} /></span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredCustomers.length > 0 && (
          <>
            <CommandGroup heading={tc("العملاء", "Customers")}>
              {filteredCustomers.map((c: any) => (
                <CommandItem
                  key={c.phone}
                  onSelect={() => go(`/employee/loyalty?phone=${encodeURIComponent(c.phone)}`)}
                  data-testid={`cmd-customer-${c.phone}`}
                >
                  <Users className="w-4 h-4 ml-2 text-primary" />
                  <span>{c.name || tc("بدون اسم", "No name")}</span>
                  <span className="text-muted-foreground text-xs mr-2">{c.phone}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredEmployees.length > 0 && (
          <>
            <CommandGroup heading={tc("الموظفون", "Employees")}>
              {filteredEmployees.map((e: any) => (
                <CommandItem
                  key={e.id}
                  onSelect={() => go(`/admin/employees?employeeId=${e.id}`)}
                  data-testid={`cmd-employee-${e.id}`}
                >
                  <UserCog className="w-4 h-4 ml-2 text-primary" />
                  <span>{e.name}</span>
                  <span className="text-muted-foreground text-xs mr-2">({e.role})</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {Object.entries(linkGroups).map(([heading, items]) => (
          <CommandGroup key={heading} heading={heading}>
            {items.map((l) => (
              <CommandItem
                key={l.path}
                onSelect={() => go(l.path)}
                data-testid={`cmd-link-${l.path.replace(/\//g, "-")}`}
              >
                {l.icon}
                <span className="mr-2">{tc(l.ar, l.en)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="px-3 py-2 text-[10px] text-muted-foreground border-t flex items-center justify-between">
        <span>{tc("اضغط Esc للإغلاق", "Press Esc to close")}</span>
        <span>{tc("Ctrl+K لفتح البحث", "Ctrl+K to open search")}</span>
      </div>
    </CommandDialog>
  );
}

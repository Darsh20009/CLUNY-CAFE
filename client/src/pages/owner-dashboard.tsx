import { useEffect, useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Coffee, Database, Trash2, RefreshCw, AlertTriangle, 
  ShoppingCart, Users, Package, GitBranch, Settings,
  Calendar, CreditCard, Table, Clock, ChevronLeft, ChevronRight,
  Eye, BarChart3, Shield, ArrowRight, Utensils, Menu, TrendingUp, Store,
  MonitorSmartphone, ChefHat, LayoutGrid, FileBarChart2, Wallet, MapPin, ExternalLink,
  Activity, Wifi, Globe
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import DashboardAnalyticsPanel from "@/components/dashboard-analytics-panel";
import TopProductsWidget from "@/components/top-products-widget";
import { ManagerSidebar, MobileBottomNav } from "@/components/manager-sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from "recharts";

interface CollectionStats {
  count: number;
  nameAr: string;
}

interface BranchStat {
  branchId: string;
  branchName: string;
  totalRevenue: number;
  totalOrders: number;
  dayRevenue: number;
  dayOrders: number;
}

interface DatabaseStats {
  collections: Record<string, CollectionStats>;
  summary: {
    todayOrders: number;
    dayOrders?: number;
    dayRevenue?: number;
    totalRevenue: number;
    dayStart?: string;
    dayEnd?: string;
    dayStartHour?: number;
    branchStats?: BranchStat[];
    filteredBranchId?: string | null;
  };
}

function formatLocalDateISO(d: Date): string {
  const saudi = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return saudi.toISOString().slice(0, 10);
}

interface CollectionData {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const collectionIcons: Record<string, any> = {
  orders: ShoppingCart,
  customers: Users,
  employees: Users,
  coffeeItems: Package,
  branches: GitBranch,
  discountCodes: CreditCard,
  loyaltyCards: CreditCard,
  tables: Table,
  attendance: Clock,
  ingredients: Package,
  categories: Settings,
  deliveryZones: Settings
};

export default function OwnerDashboard() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDateISO(new Date()));
  const [dayStartHour, setDayStartHour] = useState<number>(() => {
    const v = parseInt(localStorage.getItem('qirox_day_start_hour') || '0', 10);
    return isNaN(v) ? 0 : Math.max(0, Math.min(23, v));
  });
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activeShortcut, setActiveShortcut] = useState<string>('today');

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      if (emp.role !== 'owner' && emp.role !== 'admin') {
        setLocation("/employee/gateway");
        return;
      }
      setEmployee(emp);
    } else {
      setLocation("/employee/gateway");
    }
  }, [setLocation]);

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('');

  useEffect(() => {
    if (employee) {
      fetchStats(selectedBranchFilter);
    }
  }, [employee, selectedDate, dateFrom, dateTo, dayStartHour, selectedBranchFilter]);

  const SHORTCUTS = [
    { key: 'today',       label: 'اليوم' },
    { key: 'yesterday',   label: 'أمس' },
    { key: 'day_before',  label: 'قبل أمس' },
    { key: 'this_week',   label: 'الأسبوع' },
    { key: 'last_week',   label: 'الأسبوع الماضي' },
    { key: 'this_month',  label: 'الشهر' },
    { key: 'last_2m',     label: 'آخر شهرين' },
    { key: 'this_quarter',label: 'الربع' },
    { key: 'this_year',   label: 'السنة' },
    { key: 'full_year',   label: 'السنة كاملة' },
  ];

  const applyShortcut = (key: string) => {
    setActiveShortcut(key);
    const now = new Date();
    const saudiNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const today = saudiNow.toISOString().slice(0, 10);
    const daysAgo = (n: number) => new Date(saudiNow.getTime() - n * 86400000).toISOString().slice(0, 10);

    if (key === 'today')      { setSelectedDate(today); setDateFrom(''); setDateTo(''); return; }
    if (key === 'yesterday')  { const y = daysAgo(1); setSelectedDate(y); setDateFrom(''); setDateTo(''); return; }
    if (key === 'day_before') { const d = daysAgo(2); setSelectedDate(d); setDateFrom(''); setDateTo(''); return; }

    let from = '';
    let to = today;
    if (key === 'this_week') {
      const dow = saudiNow.getUTCDay();
      from = daysAgo(dow === 0 ? 6 : dow - 1);
    } else if (key === 'last_week') {
      const dow = saudiNow.getUTCDay();
      const toSun = dow === 0 ? 7 : dow;
      from = daysAgo(toSun + 6);
      to   = daysAgo(toSun);
    } else if (key === 'this_month') {
      from = `${today.slice(0, 7)}-01`;
    } else if (key === 'last_2m') {
      from = new Date(Date.UTC(saudiNow.getUTCFullYear(), saudiNow.getUTCMonth() - 2, 1)).toISOString().slice(0, 10);
    } else if (key === 'this_quarter') {
      const qStart = Math.floor(saudiNow.getUTCMonth() / 3) * 3;
      from = new Date(Date.UTC(saudiNow.getUTCFullYear(), qStart, 1)).toISOString().slice(0, 10);
    } else if (key === 'this_year') {
      from = `${today.slice(0, 4)}-01-01`;
    } else if (key === 'full_year') {
      from = `${today.slice(0, 4)}-01-01`;
      to   = `${today.slice(0, 4)}-12-31`;
    }
    setDateFrom(from);
    setDateTo(to);
  };

  useEffect(() => {
    localStorage.setItem('qirox_day_start_hour', String(dayStartHour));
  }, [dayStartHour]);

  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionData(selectedCollection, currentPage);
    }
  }, [selectedCollection, currentPage]);

  const fetchStats = async (branchId?: string) => {
    setIsLoading(true);
    try {
      const bid = branchId !== undefined ? branchId : selectedBranchFilter;
      const branchParam = bid ? `&branchId=${encodeURIComponent(bid)}` : '';
      const url = (dateFrom && dateTo)
        ? `/api/owner/database-stats?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&dayStartHour=${dayStartHour}${branchParam}`
        : `/api/owner/database-stats?date=${encodeURIComponent(selectedDate)}&dayStartHour=${dayStartHour}${branchParam}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isToday = selectedDate === formatLocalDateISO(new Date());

  const fetchCollectionData = async (collection: string, page: number) => {
    try {
      const response = await fetch(`/api/owner/collection/${collection}?page=${page}&limit=20`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCollectionData(data);
      }
    } catch (error) {
      console.error("Error fetching collection data:", error);
    }
  };

  const deleteKeyword = tc('حذف', 'DELETE');
  const resetKeyword = tc('احذف جميع البيانات', 'DELETE ALL DATA');

  const handleDeleteCollection = async (collection: string) => {
    if (deleteConfirm !== deleteKeyword) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc(`يرجى كتابة '${deleteKeyword}' للتأكيد`, `Please type '${deleteKeyword}' to confirm`),
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await apiRequest('DELETE', `/api/owner/collection/${collection}`);
      const data = await response.json();

      toast({
        title: tc("تم الحذف", "Deleted"),
        description: data.message
      });

      fetchStats();
      setSelectedCollection(null);
      setCollectionData(null);
      setDeleteConfirm('');
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل الحذف", "Delete failed"),
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRecord = async (collection: string, id: string) => {
    try {
      await apiRequest('DELETE', `/api/owner/record/${collection}/${id}`);

      toast({
        title: tc("تم الحذف", "Deleted"),
        description: tc("تم حذف السجل بنجاح", "Record deleted successfully")
      });

      fetchCollectionData(collection, currentPage);
      fetchStats();
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل الحذف", "Delete failed"),
        variant: "destructive"
      });
    }
  };

  const handleResetOrdersOnly = async () => {
    if (!confirm(tc("سيتم حذف جميع الطلبات والمحاسبة. المنتجات والموظفون والصور ستبقى. هل أنت متأكد؟", "All orders and accounting will be deleted. Products, employees and images will be preserved. Are you sure?"))) return;
    try {
      const response = await apiRequest('DELETE', '/api/admin/reset-orders-only');
      const data = await response.json();
      toast({
        title: tc("تم التصفير", "Reset Done"),
        description: data.message
      });
      fetchStats();
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل التصفير", "Reset failed"),
        variant: "destructive"
      });
    }
  };

  const [migrateTargetBranchId, setMigrateTargetBranchId] = useState<string>("");

  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });

  const { data: sysStats } = useQuery<any>({
    queryKey: ["/api/admin/system-stats"],
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const handleMigrateMainBranch = async () => {
    if (!migrateTargetBranchId) {
      toast({ title: tc("اختر الفرع المستهدف أولاً", "Select target branch first"), variant: "destructive" });
      return;
    }
    const targetBranch = (branches as any[]).find((b: any) => b.id === migrateTargetBranchId);
    if (!confirm(tc(
      `سيتم ترحيل جميع بيانات فرع "main" إلى "${targetBranch?.nameAr}" وحذف فرع "main". هل أنت متأكد؟`,
      `All "main" branch data will be migrated to "${targetBranch?.nameAr}" and "main" will be deleted. Are you sure?`
    ))) return;
    try {
      const response = await apiRequest('POST', '/api/admin/migrate-main-branch', { targetBranchId: migrateTargetBranchId });
      const data = await response.json();
      toast({ title: tc("تم الترحيل", "Migration Done"), description: data.message });
    } catch (error: any) {
      toast({ title: tc("خطأ", "Error"), description: error.message || tc("فشل الترحيل", "Migration failed"), variant: "destructive" });
    }
  };

  const handleMigrateBranchEmployees = async () => {
    if (!confirm(tc("سيتم ربط جميع الموظفين غير المرتبطين بفرع بالفرع الرئيسي. هل أنت متأكد؟", "All employees without a branch will be linked to the main branch. Are you sure?"))) return;
    try {
      const response = await apiRequest('POST', '/api/admin/migrate-branch-employees');
      const data = await response.json();
      toast({
        title: tc("تم الترحيل", "Migration Done"),
        description: data.message
      });
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل الترحيل", "Migration failed"),
        variant: "destructive"
      });
    }
  };

  const handleResetDatabase = async () => {
    if (resetConfirm !== resetKeyword) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("يرجى كتابة العبارة الصحيحة للتأكيد", "Please type the correct confirmation phrase"),
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/owner/reset-database', { 
        confirmPhrase: resetConfirm 
      });
      const data = await response.json();

      toast({
        title: tc("تم إعادة التعيين", "Reset Done"),
        description: data.message
      });

      fetchStats();
      setResetDialogOpen(false);
      setResetConfirm('');
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل إعادة التعيين", "Reset failed"),
        variant: "destructive"
      });
    }
  };

  if (!employee) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir={tc('rtl','ltr')} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <ManagerSidebar
        manager={employee as any}
        onLogout={() => { localStorage.removeItem("currentEmployee"); setLocation("/employee/gateway"); }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        role={employee?.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <header className="flex-shrink-0 bg-background border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-foreground font-bold text-sm">{tc("مرحباً،", "Hello,")} <span className="text-[#2D9B6E]">{employee?.fullName}</span></div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                employee?.role === 'admin' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>
                {employee?.role === 'admin' ? tc('مدير عام', 'Admin') : tc('مالك', 'Owner')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{tc("إدارة قاعدة البيانات والصلاحيات", "Database & permissions management")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setLocation("/employee/menu-management")} data-testid="button-owner-manage-drinks">
            <Coffee className="w-4 h-4 ml-2" />{tc("المشروبات", "Drinks")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/employee/menu-management?type=food")} data-testid="button-owner-manage-food">
            <Utensils className="w-4 h-4 ml-2" />{tc("المأكولات", "Food")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchStats()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 ml-2" />{tc("تحديث", "Refresh")}
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
      <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">

        {/* Period shortcuts + Branch selector */}
        <Card className="bg-card border border-border mb-6">
          <CardContent className="p-4 space-y-3">
            {/* Shortcut buttons row */}
            <div className="flex flex-wrap gap-1.5" data-testid="period-shortcuts">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => applyShortcut(s.key)}
                  data-testid={`shortcut-${s.key}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    activeShortcut === s.key
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Bottom row: custom date + hour + branch */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {tc("من تاريخ", "From date")}
                </label>
                <Input
                  type="date"
                  value={dateFrom || selectedDate}
                  onChange={(e) => {
                    const v = e.target.value || formatLocalDateISO(new Date());
                    const currentTo = dateTo || dateFrom || selectedDate;
                    setDateFrom(v);
                    setDateTo(currentTo < v ? v : currentTo);
                    setActiveShortcut('custom');
                  }}
                  max={formatLocalDateISO(new Date())}
                  className="h-9 w-40"
                  data-testid="input-stats-date-from"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {tc("إلى تاريخ", "To date")}
                </label>
                <Input
                  type="date"
                  value={dateTo || dateFrom || selectedDate}
                  onChange={(e) => {
                    const v = e.target.value || formatLocalDateISO(new Date());
                    const currentFrom = dateFrom || selectedDate;
                    setDateTo(v);
                    setDateFrom(currentFrom > v ? v : currentFrom);
                    setActiveShortcut('custom');
                  }}
                  min={dateFrom || undefined}
                  max={formatLocalDateISO(new Date())}
                  className="h-9 w-40"
                  data-testid="input-stats-date-to"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {tc("اليوم يبدأ من", "Day starts at")}
                </label>
                <select
                  value={dayStartHour}
                  onChange={(e) => setDayStartHour(parseInt(e.target.value, 10) || 0)}
                  className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid="select-day-start-hour"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Store className="w-3.5 h-3.5" /> {tc("الفرع", "Branch")}
                </label>
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid="select-branch-filter"
                >
                  <option value="">{tc("جميع الفروع", "All Branches")}</option>
                  {(stats?.summary.branchStats || []).map((b) => (
                    <option key={b.branchId} value={b.branchId}>{b.branchName}</option>
                  ))}
                </select>
              </div>
              {selectedBranchFilter && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedBranchFilter('')} className="text-xs text-muted-foreground">
                  × {tc("كل الفروع", "All branches")}
                </Button>
              )}
              {stats?.summary.dayStart && (
                <div className="text-xs text-muted-foreground mr-auto hidden sm:flex items-center gap-1">
                  <span className="opacity-60">{tc("الفترة:", "Window:")}</span>
                  <span className="font-mono" dir="ltr">
                    {new Date(stats.summary.dayStart).toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh' })}
                    {" → "}
                    {new Date(stats.summary.dayEnd!).toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh' })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-4">{tc("جاري التحميل...", "Loading...")}</p>
          </div>
        ) : (
          <>
            {/* ── Global KPI Row ─────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-6">
              {([
                {
                  label: isToday ? tc("إيرادات اليوم", "Today's Revenue") : tc("إيرادات اليوم المحدد", "Day Revenue"),
                  value: <span className="flex items-center gap-1">{(stats?.summary.dayRevenue || 0).toLocaleString()} <SarIcon /></span>,
                  sub: `${stats?.summary.dayOrders ?? 0} ${tc("طلب", "orders")}`,
                  icon: Wallet, bg: 'from-emerald-500 to-emerald-600',
                },
                {
                  label: tc("إجمالي الإيرادات", "Total Revenue"),
                  value: <span className="flex items-center gap-1">{(stats?.summary.totalRevenue || 0).toLocaleString()} <SarIcon /></span>,
                  sub: `${stats?.collections.orders?.count || 0} ${tc("طلب كلي", "total orders")}`,
                  icon: TrendingUp, bg: 'from-blue-500 to-blue-600',
                },
                {
                  label: tc("الموظفون", "Employees"),
                  value: stats?.collections.employees?.count || 0,
                  sub: tc("في جميع الفروع", "across all branches"),
                  icon: Users, bg: 'from-violet-500 to-violet-600',
                },
                {
                  label: tc("الفروع", "Branches"),
                  value: stats?.summary.branchStats?.length || stats?.collections.branches?.count || 0,
                  sub: tc("فروع نشطة", "active branches"),
                  icon: GitBranch, bg: 'from-amber-500 to-amber-600',
                },
              ] as const).map((k, i) => (
                <Card key={i} className={`bg-gradient-to-br ${k.bg} border-0 shadow-sm`}>
                  <CardContent className="p-4">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                      <k.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-white/80 text-xs mb-0.5">{k.label}</p>
                    <p className="text-2xl font-bold text-white leading-tight">{k.value}</p>
                    <p className="text-white/60 text-[10px] mt-0.5">{k.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── Live Visitors ─────────────────────────────── */}
            {sysStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: tc("زوار الآن", "Active Now"), value: sysStats.visitors?.activeVisitors ?? 0, icon: Activity, color: "text-green-600", bg: "bg-green-50 border-green-100", dot: true },
                  { label: tc("زوار اليوم", "Today's Visitors"), value: sysStats.visitors?.uniqueVisitorsToday ?? 0, icon: Globe, color: "text-blue-600", bg: "bg-blue-50 border-blue-100", dot: false },
                  { label: tc("مشاهدات اليوم", "Page Views Today"), value: sysStats.visitors?.totalPageViewsToday ?? 0, icon: Eye, color: "text-violet-600", bg: "bg-violet-50 border-violet-100", dot: false },
                  { label: tc("متصلون WS", "WS Connections"), value: sysStats.websocket?.connectedClients ?? 0, icon: Wifi, color: "text-primary", bg: "bg-primary/5 border-primary/10", dot: false },
                ].map((s, i) => (
                  <Card key={i} className={`border ${s.bg} shadow-none`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 truncate">{s.label}</p>
                        <p className={`text-xl font-bold ${s.color} flex items-center gap-1`}>
                          {s.value}
                          {s.dot && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* ── Branch Operations Center ─────────────────── */}
            {stats?.summary.branchStats && stats.summary.branchStats.length > 0 && (() => {
              const branches = stats.summary.branchStats!;
              const COLORS = ['#2D9B6E','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899'];
              const maxDay = Math.max(...branches.map(b => b.dayRevenue), 1);
              const totalDay = branches.reduce((s, b) => s + b.dayRevenue, 0);
              const chartData = branches.map((b, i) => ({
                name: b.branchName.length > 8 ? b.branchName.slice(0, 8) + '…' : b.branchName,
                fullName: b.branchName,
                اليوم: b.dayRevenue,
                fill: COLORS[i % COLORS.length],
              }));
              const pieData = branches.map((b, i) => ({
                name: b.branchName,
                value: b.totalRevenue || 0.01,
                fill: COLORS[i % COLORS.length],
              }));
              const QUICK_ACTIONS = [
                { label: tc("نقاط البيع", "POS"), icon: MonitorSmartphone, path: '/employee/pos-system' },
                { label: tc("الطلبات", "Orders"), icon: ShoppingCart, path: '/employee/orders' },
                { label: tc("المطبخ", "Kitchen"), icon: ChefHat, path: '/employee/kitchen' },
                { label: tc("الطاولات", "Tables"), icon: LayoutGrid, path: '/employee/tables' },
                { label: tc("الموظفون", "Staff"), icon: Users, path: '/admin/employees' },
                { label: tc("التقارير", "Reports"), icon: FileBarChart2, path: '/manager/analytics' },
              ];
              return (
                <div className="mb-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-primary rounded-full" />
                      <h2 className="font-bold text-base text-foreground">{tc("مركز إدارة الفروع", "Branch Operations Center")}</h2>
                      <Badge variant="secondary" className="text-[10px]">{branches.length} {tc("فروع", "branches")}</Badge>
                    </div>
                    {selectedBranchFilter && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBranchFilter('')} className="text-xs">
                        ✕ {tc("عرض الكل", "Show all")}
                      </Button>
                    )}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <Card className="lg:col-span-3 border border-border bg-card">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm text-foreground flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          {isToday ? tc("إيرادات اليوم بالفروع", "Today's Revenue by Branch") : tc("إيرادات اليوم المحدد", "Day Revenue by Branch")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-2 pb-4">
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                              tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                              formatter={(value: number, name: string) => [`${value.toLocaleString()} ﷼`, name]}
                              labelFormatter={(_: unknown, payload: any[]) => payload?.[0]?.payload?.fullName || _}
                            />
                            <Bar dataKey="اليوم" radius={[4, 4, 0, 0]}>
                              {chartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.fill}
                                  opacity={!selectedBranchFilter || branches[idx]?.branchId === selectedBranchFilter ? 1 : 0.25} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2 border border-border bg-card">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm text-foreground flex items-center gap-2">
                          <Store className="w-4 h-4 text-primary" />
                          {tc("حصة الفروع (الإجمالي)", "Revenue Share (Total)")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-2 pb-2">
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2} dataKey="value">
                              {pieData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.fill}
                                  opacity={!selectedBranchFilter || branches[idx]?.branchId === selectedBranchFilter ? 1 : 0.2} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                              formatter={(v: number) => [`${v.toLocaleString()} ﷼`]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-1 px-2 pb-2">
                          {branches.slice(0, 4).map((b, idx) => (
                            <div key={b.branchId} className="flex items-center gap-2 text-[10px]">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                              <span className="truncate text-muted-foreground">{b.branchName}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Branch cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {branches.map((b, i) => {
                      const color = COLORS[i % COLORS.length];
                      const dayPct = totalDay > 0 ? Math.round((b.dayRevenue / totalDay) * 100) : 0;
                      const barPct = maxDay > 0 ? Math.round((b.dayRevenue / maxDay) * 100) : 0;
                      const isSelected = selectedBranchFilter === b.branchId;
                      return (
                        <Card key={b.branchId}
                          className={`border-2 bg-card transition-all cursor-pointer hover:shadow-md ${isSelected ? 'shadow-lg' : ''}`}
                          style={{ borderColor: isSelected ? color : 'hsl(var(--border))' }}
                          onClick={() => setSelectedBranchFilter(isSelected ? '' : b.branchId)}
                          data-testid={`branch-card-${b.branchId}`}
                        >
                          <CardContent className="p-0">
                            <div className="h-1.5 rounded-t-[10px]" style={{ background: color }} />
                            <div className="p-4">
                              {/* Branch name */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1A` }}>
                                    <MapPin className="w-4 h-4" style={{ color }} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-sm text-foreground truncate">{b.branchName}</p>
                                    <p className="text-[10px] text-muted-foreground">{dayPct}% {tc("من إيرادات اليوم", "of day rev.")}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${color}18`, color }}>
                                  {b.dayOrders} {tc("طلب", "ord.")}
                                </span>
                              </div>

                              {/* Revenue numbers */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="rounded-lg p-2.5" style={{ background: `${color}0D` }}>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">{tc("اليوم", "Today")}</p>
                                  <p className="font-bold text-sm flex items-center gap-0.5" style={{ color }}>
                                    {b.dayRevenue.toLocaleString()} <SarIcon size={10} />
                                  </p>
                                </div>
                                <div className="rounded-lg p-2.5 bg-muted/40">
                                  <p className="text-[10px] text-muted-foreground mb-0.5">{tc("الإجمالي", "All-time")}</p>
                                  <p className="font-bold text-sm text-foreground flex items-center gap-0.5">
                                    {b.totalRevenue.toLocaleString()} <SarIcon size={10} />
                                  </p>
                                </div>
                              </div>

                              {/* Progress bar vs top branch */}
                              <div className="mb-3">
                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${barPct}%`, background: color }} />
                                </div>
                              </div>

                              {/* Quick actions */}
                              <div className="grid grid-cols-3 gap-1.5">
                                {QUICK_ACTIONS.map((action) => (
                                  <button key={action.path}
                                    onClick={(e) => { e.stopPropagation(); setLocation(action.path); }}
                                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[9px] font-medium"
                                    data-testid={`branch-action-${b.branchId}-${action.path.split('/').pop()}`}
                                  >
                                    <action.icon className="w-3.5 h-3.5" />
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Weekly Stats, Profits & Product Consumption ── */}
            <div className="mb-6">
              <DashboardAnalyticsPanel branchId={selectedBranchFilter || undefined} />
            </div>

            {/* ── Top Products Widget ── */}
            <div className="mb-6">
              <TopProductsWidget branchId={selectedBranchFilter || undefined} />
            </div>

            <Card className="bg-card border border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  {tc("مجموعات قاعدة البيانات", "Database Collections")}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {tc("اضغط على أي مجموعة لعرض بياناتها", "Click any collection to view its data")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {stats?.collections && Object.entries(stats.collections).map(([key, value]) => {
                    const Icon = collectionIcons[key] || Database;
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedCollection(key);
                          setCurrentPage(1);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedCollection === key
                            ? 'border-primary bg-primary/10'
                            : 'border-primary/20 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                        data-testid={`collection-${key}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-5 h-5 text-accent" />
                          <span className="text-white font-medium">{value.nameAr}</span>
                        </div>
                        <p className="text-2xl font-bold text-accent">{value.count}</p>
                        <p className="text-gray-500 text-xs">{key}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {selectedCollection && (
              <Card className="bg-card border border-border mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">
                      {stats?.collections[selectedCollection]?.nameAr || selectedCollection}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {collectionData?.pagination.total || 0} {tc("سجل", "records")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {['orders', 'customers', 'discountCodes', 'loyaltyCards', 'attendance'].includes(selectedCollection) && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid="button-delete-collection">
                            <Trash2 className="w-4 h-4 ml-2" />
                            {tc("حذف الكل", "Delete All")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#2d1f1a] border-primary/20">
                          <DialogHeader>
                            <DialogTitle className="text-red-500">{tc("تأكيد الحذف", "Confirm Delete")}</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              {tc(`سيتم حذف جميع سجلات ${stats?.collections[selectedCollection]?.nameAr}. اكتب "${deleteKeyword}" للتأكيد.`,
                                  `All records of ${selectedCollection} will be deleted. Type "${deleteKeyword}" to confirm.`)}
                            </DialogDescription>
                          </DialogHeader>
                          <Input
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder={tc(`اكتب: ${deleteKeyword}`, `Type: ${deleteKeyword}`)}
                            className="bg-[#1a1410] border-red-500/50 text-white"
                            data-testid="input-delete-confirm"
                          />
                          <DialogFooter>
                            <Button
                              variant="destructive"
                              onClick={() => handleDeleteCollection(selectedCollection)}
                              disabled={isDeleting || deleteConfirm !== deleteKeyword}
                              data-testid="button-confirm-delete"
                            >
                              {isDeleting ? tc('جاري الحذف...', 'Deleting...') : tc('تأكيد الحذف', 'Confirm Delete')}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCollection(null);
                        setCollectionData(null);
                      }}
                      className="text-gray-400"
                      data-testid="button-close-collection"
                    >
                      {tc("إغلاق", "Close")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {collectionData && collectionData.data.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-primary/20">
                              {Object.keys(collectionData.data[0]).slice(0, 6).map((key) => (
                                <th key={key} className="text-right py-2 px-3 text-gray-400 font-medium">
                                  {key}
                                </th>
                              ))}
                              <th className="text-right py-2 px-3 text-gray-400 font-medium">{tc("إجراءات", "Actions")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {collectionData.data.map((item, index) => (
                              <tr key={item.id || index} className="border-b border-primary/10">
                                {Object.entries(item).slice(0, 6).map(([key, value]) => (
                                  <td key={key} className="py-2 px-3 text-white">
                                    {typeof value === 'object' 
                                      ? JSON.stringify(value).slice(0, 50) + '...'
                                      : String(value).slice(0, 30)}
                                  </td>
                                ))}
                                <td className="py-2 px-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRecord(selectedCollection, item.id)}
                                    className="text-red-500 hover:text-red-400 p-1 h-auto"
                                    data-testid={`button-delete-record-${item.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {collectionData.pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="border-primary/50 text-accent"
                            data-testid="button-prev-page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          <span className="text-gray-400">
                            {tc(`صفحة ${currentPage} من ${collectionData.pagination.pages}`, `Page ${currentPage} of ${collectionData.pagination.pages}`)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(collectionData.pagination.pages, p + 1))}
                            disabled={currentPage === collectionData.pagination.pages}
                            className="border-primary/50 text-accent"
                            data-testid="button-next-page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Database className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-400">{tc("لا توجد بيانات", "No data")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(employee.role === 'owner' || employee.role === 'admin') && (
              <Card className="bg-rose-50/40 border border-rose-200">
                <CardHeader>
                  <CardTitle className="text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {tc("منطقة الخطر", "Danger Zone")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {tc("عمليات لا يمكن التراجع عنها", "Operations that cannot be undone")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Migrate "main" branch data to a real branch */}
                  <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                    <p className="text-violet-700 text-sm font-medium mb-1">{tc("ترحيل بيانات الفرع الرئيسي (main)", "Migrate 'main' Branch Data")}</p>
                    <p className="text-muted-foreground text-xs mb-3">{tc("ينقل كل الطلبات والوردايات والموظفين من 'main' إلى فرع محدد ثم يحذف 'main'", "Moves all orders, shifts, and employees from 'main' to a chosen branch then deletes 'main'")}</p>
                    <div className="flex gap-2 items-center">
                      <Select value={migrateTargetBranchId} onValueChange={setMigrateTargetBranchId}>
                        <SelectTrigger className="flex-1 border-violet-300 text-sm">
                          <SelectValue placeholder={tc("اختر الفرع المستهدف", "Select target branch")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(branches as any[]).map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.nameAr || b.nameEn}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        className="border-violet-400 text-violet-700 hover:bg-violet-100 shrink-0"
                        onClick={handleMigrateMainBranch}
                        data-testid="button-migrate-main-branch"
                      >
                        {tc("ترحيل", "Migrate")}
                      </Button>
                    </div>
                  </div>

                  {/* Migrate Branch Employees */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-700 text-sm font-medium mb-1">{tc("ربط الموظفين بالفروع", "Link Employees to Branches")}</p>
                    <p className="text-muted-foreground text-xs mb-3">{tc("يربط الموظفين غير المعيّنين لفرع بالفرع الرئيسي تلقائياً", "Links unassigned employees to the main branch automatically")}</p>
                    <Button
                      variant="outline"
                      className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                      onClick={handleMigrateBranchEmployees}
                      data-testid="button-migrate-branch-employees"
                    >
                      {tc("ترحيل الموظفين للفروع", "Migrate Employees to Branches")}
                    </Button>
                  </div>

                  {/* Reset Orders Only */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-700 text-sm font-medium mb-1">{tc("تصفير الطلبات والمكاسب", "Reset Orders & Revenue")}</p>
                    <p className="text-muted-foreground text-xs mb-3">{tc("يحذف الطلبات والمحاسبة فقط — المنتجات، الموظفون، والصور تبقى", "Deletes orders & accounting only — products, employees, images remain")}</p>
                    <Button
                      variant="outline"
                      className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={handleResetOrdersOnly}
                      data-testid="button-reset-orders-only"
                    >
                      <ShoppingCart className="w-4 h-4 ml-2" />
                      {tc("تصفير الطلبات فقط", "Reset Orders Only")}
                    </Button>
                  </div>

                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="w-full" data-testid="button-reset-database">
                        <Trash2 className="w-4 h-4 ml-2" />
                        {tc("إعادة تعيين قاعدة البيانات الكاملة", "Full Database Reset")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#2d1f1a] border-red-500/20">
                      <DialogHeader>
                        <DialogTitle className="text-red-500 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          {tc("تحذير خطير", "Critical Warning")}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                          {tc("سيتم حذف جميع بيانات العمليات (الطلبات، العملاء، أكواد الخصم، بطاقات الولاء، سجلات الحضور).",
                              "All operational data will be deleted (orders, customers, discount codes, loyalty cards, attendance records).")}
                          <br />
                          <br />
                          <strong className="text-red-400">{tc("هذه العملية لا يمكن التراجع عنها!", "This action cannot be undone!")}</strong>
                          <br />
                          <br />
                          {tc(`اكتب "${resetKeyword}" للتأكيد.`, `Type "${resetKeyword}" to confirm.`)}
                        </DialogDescription>
                      </DialogHeader>
                      <Input
                        value={resetConfirm}
                        onChange={(e) => setResetConfirm(e.target.value)}
                        placeholder={tc(`اكتب: ${resetKeyword}`, `Type: ${resetKeyword}`)}
                        className="bg-[#1a1410] border-red-500/50 text-white"
                        data-testid="input-reset-confirm"
                      />
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setResetDialogOpen(false)}
                          className="border-gray-500/50 text-gray-400"
                        >
                          {tc("إلغاء", "Cancel")}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleResetDatabase}
                          disabled={resetConfirm !== resetKeyword}
                          data-testid="button-confirm-reset"
                        >
                          {tc("تأكيد إعادة التعيين", "Confirm Reset")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}
          </>
        )}
        </div>
        </main>
        <MobileBottomNav manager={employee as any} />
      </div>
    </div>
  );
}

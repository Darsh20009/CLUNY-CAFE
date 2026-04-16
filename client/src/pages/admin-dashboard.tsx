import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, DollarSign, Calendar, Activity, Settings, Clock, ShoppingBag, ReceiptText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import SarIcon from "@/components/sar-icon";

function getItemName(item: any) {
  return item.nameAr || item.name || item.coffeeItemName || item.productName || 'منتج غير مسمى';
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "لوحة تحكم الإدارة - CLUNY CAFE | إحصائيات شاملة";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'لوحة تحكم الإدارة في CLUNY CAFE - إحصائيات المبيعات والموظفين والطلبات');
  }, []);

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['/api/employees'],
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['/api/orders'],
  });

  const { data: attendance = [] } = useQuery<any[]>({
    queryKey: ['/api/attendance'],
    retry: false,
  });

  const { data: leaveRequests = [] } = useQuery<any[]>({
    queryKey: ['/api/leave-requests'],
    retry: false,
  });

  const activeEmployees = employees.filter((e: any) => e.isActivated === 1).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const presentToday = Array.isArray(attendance)
    ? attendance.filter((a: any) => {
        const checkIn = a.checkIn ? new Date(a.checkIn) : null;
        return checkIn && checkIn >= today;
      }).length
    : 0;

  const onLeave = Array.isArray(leaveRequests)
    ? leaveRequests.filter((lr: any) => {
        if (lr.status !== 'approved') return false;
        const start = lr.startDate ? new Date(lr.startDate) : null;
        const end = lr.endDate ? new Date(lr.endDate) : null;
        const now = new Date();
        return start && end && start <= now && end >= now;
      }).length
    : 0;

  const todayOrders = orders.filter((o: any) => {
    const created = o.createdAt ? new Date(o.createdAt) : null;
    return created && created >= today;
  });

  const todayRevenue = todayOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
  const totalRevenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  const todaySoldItems = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number; orders: number }>();
    todayOrders.forEach((order: any) => {
      const seenInOrder = new Set<string>();
      (Array.isArray(order.items) ? order.items : []).forEach((item: any) => {
        const id = String(item.coffeeItemId || item.id || getItemName(item));
        const quantity = Number(item.quantity || 1);
        const revenue = Number(item.totalPrice || item.price * quantity || 0);
        const current = map.get(id) || { name: getItemName(item), quantity: 0, revenue: 0, orders: 0 };
        current.quantity += quantity;
        current.revenue += revenue;
        if (!seenInOrder.has(id)) {
          current.orders += 1;
          seenInOrder.add(id);
        }
        map.set(id, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [todayOrders]);

  const todayItemCount = todaySoldItems.reduce((sum, item) => sum + item.quantity, 0);

  const StatCard = ({ icon: Icon, label, value, subtext }: any) => (
    <Card className="border-border/50 bg-gradient-to-br from-card to-card/90 shadow-md" data-testid={`card-stat-${label}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm" data-testid={`text-stat-label-${label}`}>{label}</p>
            <p className="mt-2 truncate text-2xl font-bold font-playfair text-foreground sm:text-3xl" data-testid={`text-stat-value-${label}`}>{value}</p>
            {subtext && <p className="mt-1 text-xs text-muted-foreground" data-testid={`text-stat-subtext-${label}`}>{subtext}</p>}
          </div>
          <div className="shrink-0 rounded-lg bg-accent/20 p-3 dark:bg-accent/10">
            <Icon className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen space-y-5 bg-gradient-to-b from-background via-primary/5 to-background p-4 sm:space-y-8 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-playfair text-foreground sm:text-4xl" data-testid="text-admin-dashboard-title">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted-foreground font-cairo sm:mt-2" data-testid="text-admin-dashboard-subtitle">نظرة فورية على أداء اليوم والإدارة</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/settings')} data-testid="button-open-admin-settings">
          <Settings className="ml-2 h-4 w-4" />
          الإعدادات
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-6">
        <StatCard icon={Users} label="إجمالي الموظفين" value={employees.length} subtext={`${activeEmployees} نشطين`} />
        <StatCard icon={Activity} label="الحاضرون اليوم" value={presentToday} subtext={`من ${activeEmployees} موظف نشط`} />
        <StatCard icon={Calendar} label="في الإجازة" value={onLeave} subtext="إجازة معتمدة اليوم" />
        <StatCard icon={DollarSign} label="إيرادات اليوم" value={`${todayRevenue.toFixed(0)} ر.س`} subtext={`${todayOrders.length} طلب اليوم`} />
      </div>

      <Card className="border-0 bg-white dark:bg-card" data-testid="card-today-sales-summary">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <ShoppingBag className="h-5 w-5" />
                تفاصيل مبيعات اليوم
              </CardTitle>
              <CardDescription>أهم ما تم بيعه اليوم مع الكمية والإيراد</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate('/admin/reports')} data-testid="button-open-detailed-reports">
              <ReceiptText className="ml-2 h-4 w-4" />
              تحليل تفصيلي
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/20" data-testid="metric-today-orders">
              <p className="text-xs text-muted-foreground">طلبات</p>
              <p className="text-xl font-bold text-orange-600">{todayOrders.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20" data-testid="metric-today-items">
              <p className="text-xs text-muted-foreground">قطع مباعة</p>
              <p className="text-xl font-bold text-emerald-600">{todayItemCount}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20" data-testid="metric-today-average">
              <p className="text-xs text-muted-foreground">متوسط الطلب</p>
              <p className="text-xl font-bold text-blue-600">{todayOrders.length ? (todayRevenue / todayOrders.length).toFixed(1) : '0'}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {todaySoldItems.length > 0 ? todaySoldItems.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`row-today-sold-item-${index}`}>
                <div className="min-w-0">
                  <p className="truncate font-semibold" data-testid={`text-today-item-name-${index}`}>{item.name}</p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-today-item-orders-${index}`}>{item.orders} طلب مرتبط</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" data-testid={`badge-today-item-qty-${index}`}>{item.quantity} قطعة</Badge>
                  <span className="font-bold text-accent" data-testid={`text-today-item-revenue-${index}`}>{item.revenue.toFixed(0)} <SarIcon /></span>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-today-sales">لا توجد مبيعات مسجلة اليوم حتى الآن</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 sm:gap-6">
        <Card className="border-0 bg-white dark:bg-card lg:col-span-2">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <TrendingUp className="h-5 w-5" />
              نظرة عامة على الطلبات
            </CardTitle>
            <CardDescription>جميع الطلبات</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-background p-4 dark:bg-accent/20" data-testid="row-total-orders">
                <span className="text-sm font-medium">إجمالي الطلبات</span>
                <span className="text-2xl font-bold text-accent">{orders.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20" data-testid="row-today-orders">
                <span className="text-sm font-medium">طلبات اليوم</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{todayOrders.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20" data-testid="row-total-revenue">
                <span className="text-sm font-medium">إجمالي الإيرادات</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalRevenue.toFixed(0)} <SarIcon /></span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20" data-testid="row-average-order">
                <span className="text-sm font-medium">متوسط قيمة الطلب</span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{avgOrderValue.toFixed(2)} <SarIcon /></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white dark:bg-card">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">إجراءات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-2 sm:p-6 sm:pt-0">
            <Button onClick={() => navigate('/admin/employees')} className="w-full bg-accent text-white" data-testid="button-manage-employees">
              <Users className="ml-2 h-4 w-4" />
              إدارة الموظفين
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/reports')} className="w-full" data-testid="button-view-reports">
              <TrendingUp className="ml-2 h-4 w-4" />
              التقارير التفصيلية
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/apple-pay-health')} className="w-full" data-testid="button-view-apple-pay-health">
              <Clock className="ml-2 h-4 w-4" />
              فحص Apple Pay
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white dark:bg-card">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg sm:text-xl">الموظفون</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/employees')} data-testid="button-view-all-employees">
              عرض الكل
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 sm:p-6 sm:pt-0">
          {employees.length > 0 ? (
            <div className="space-y-3 md:hidden">
              {employees.slice(0, 5).map((emp: any, index: number) => (
                <div key={emp.id || index} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`card-employee-mobile-${emp.id || index}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold" data-testid={`text-employee-name-${emp.id || index}`}>{emp.fullName}</p>
                      <p className="text-sm text-muted-foreground" data-testid={`text-employee-job-${emp.id || index}`}>{emp.jobTitle}</p>
                    </div>
                    <Badge variant={emp.isActivated === 1 ? 'default' : 'secondary'} data-testid={`badge-employee-status-${emp.id || index}`}>
                      {emp.isActivated === 1 ? 'نشط' : 'معطل'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center" data-testid="empty-employees">
              <Users className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-muted-foreground">لا توجد موظفون</p>
            </div>
          )}
          {employees.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-200 dark:border-orange-900/30">
                    <th className="p-3 text-right font-semibold">الاسم</th>
                    <th className="p-3 text-right font-semibold">الدور</th>
                    <th className="p-3 text-right font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 5).map((emp: any) => (
                    <tr key={emp.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-3">{emp.fullName}</td>
                      <td className="p-3 text-muted-foreground">{emp.jobTitle}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          emp.isActivated === 1
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-muted-foreground'
                        }`}>
                          {emp.isActivated === 1 ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

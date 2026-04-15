import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUp, Download, Printer, Search, ShoppingBag, ReceiptText, Clock, CreditCard, SlidersHorizontal } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import SarIcon from "@/components/sar-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORS = ['#f97316', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];

const statusLabels: Record<string, string> = {
  pending: 'جديد',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  in_progress: 'قيد التنفيذ',
  ready: 'جاهز',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  refunded: 'مسترجع',
};

const paymentLabels: Record<string, string> = {
  cash: 'كاش',
  card: 'بطاقة',
  apple_pay: 'Apple Pay',
  geidea: 'Geidea',
  online: 'دفع إلكتروني',
  points: 'نقاط',
};

function formatInputDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function getOrderDate(order: any) {
  return order.createdAt ? formatInputDate(new Date(order.createdAt)) : '';
}

function getOrderTime(order: any) {
  return order.createdAt ? new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '-';
}

function getItemName(item: any, coffeeItems: any[]) {
  const itemId = item.coffeeItemId || item.id;
  const product = coffeeItems.find((c: any) => c.id === itemId || c._id === itemId);
  return item.nameAr || item.name || item.coffeeItemName || item.productName || product?.nameAr || product?.name || 'منتج غير مسمى';
}

function getPaymentMethod(order: any) {
  return order.paymentMethod || order.payment?.method || order.gateway || order.paymentGateway || 'cash';
}

function normalizeStatus(status?: string) {
  return status || 'pending';
}

function ChartFrame({ children, height = 300 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="w-full overflow-x-auto" data-testid="chart-scroll-frame">
      <div className="h-[260px] min-w-[520px] sm:h-[300px]" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export default function AdminReports() {
  const { toast } = useToast();
  const today = useMemo(() => formatInputDate(), []);
  const weekStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return formatInputDate(date);
  }, []);

  const [timePeriod, setTimePeriod] = useState('month');
  const [selectedDay, setSelectedDay] = useState(today);
  const [dateFrom, setDateFrom] = useState(weekStart);
  const [dateTo, setDateTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const { data: rawOrders = [] } = useQuery<any[]>({
    queryKey: ['/api/orders'],
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['/api/employees'],
  });

  const { data: coffeeItems = [] } = useQuery<any[]>({
    queryKey: ['/api/coffee-items'],
  });

  const { data: businessConfig, refetch: refetchConfig } = useQuery<any>({
    queryKey: ['/api/business-config'],
  });

  const orders = useMemo(
    () => (rawOrders as any[]).filter((o: any) => normalizeStatus(o.status) !== 'cancelled'),
    [rawOrders]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      const orderDate = getOrderDate(order);
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
      if (statusFilter !== 'all' && normalizeStatus(order.status) !== statusFilter) return false;
      if (paymentFilter !== 'all' && getPaymentMethod(order) !== paymentFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const customerName = order.customerInfo?.name || order.customerName || '';
        const orderNumber = String(order.orderNumber || order.id || '');
        const itemNames = (Array.isArray(order.items) ? order.items : []).map((item: any) => getItemName(item, coffeeItems)).join(' ');
        const haystack = `${customerName} ${orderNumber} ${itemNames}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [orders, dateFrom, dateTo, statusFilter, paymentFilter, searchTerm, coffeeItems]);

  const selectedDayOrders = useMemo(
    () => orders.filter((order: any) => getOrderDate(order) === selectedDay),
    [orders, selectedDay]
  );

  const getDateRange = (period: string) => {
    const current = new Date();
    const data: any[] = [];

    if (period === 'week') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(current);
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toLocaleDateString('ar-SA', { weekday: 'short' }),
          fullDate: formatInputDate(date),
          revenue: 0,
          orders: 0,
        });
      }
    } else if (period === 'month') {
      for (let i = 29; i >= 0; i--) {
        const date = new Date(current);
        date.setDate(date.getDate() - i);
        data.push({
          date: `${date.getDate()}`,
          fullDate: formatInputDate(date),
          revenue: 0,
          orders: 0,
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(current);
        date.setMonth(date.getMonth() - i);
        data.push({
          date: date.toLocaleDateString('ar-SA', { month: 'short' }),
          fullDate: formatInputDate(date).slice(0, 7),
          revenue: 0,
          orders: 0,
        });
      }
    }

    return data;
  };

  const revenueData = useMemo(() => {
    const dateData = getDateRange(timePeriod);
    orders.forEach((order: any) => {
      const orderDate = getOrderDate(order);
      const key = timePeriod === 'year' ? orderDate.slice(0, 7) : orderDate;
      const entry = dateData.find((d: any) => d.fullDate === key);
      if (entry) {
        entry.revenue = (entry.revenue || 0) + (order.totalAmount || 0);
        entry.orders = (entry.orders || 0) + 1;
      }
    });
    return timePeriod === 'month' ? dateData.slice(-14) : dateData;
  }, [orders, timePeriod]);

  const soldItems = useMemo(() => {
    const productMap = new Map<string, { id: string; name: string; sold: number; revenue: number; orders: number }>();
    filteredOrders.forEach((order: any) => {
      const seenInOrder = new Set<string>();
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item: any) => {
        const id = String(item.coffeeItemId || item.id || getItemName(item, coffeeItems));
        const quantity = Number(item.quantity || 1);
        const revenue = Number(item.totalPrice || item.price * quantity || 0);
        const current = productMap.get(id) || { id, name: getItemName(item, coffeeItems), sold: 0, revenue: 0, orders: 0 };
        current.sold += quantity;
        current.revenue += revenue;
        if (!seenInOrder.has(id)) {
          current.orders += 1;
          seenInOrder.add(id);
        }
        productMap.set(id, current);
      });
    });
    return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, coffeeItems]);

  const daySoldItems = useMemo(() => {
    const productMap = new Map<string, { id: string; name: string; sold: number; revenue: number; orders: number }>();
    selectedDayOrders.forEach((order: any) => {
      const seenInOrder = new Set<string>();
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item: any) => {
        const id = String(item.coffeeItemId || item.id || getItemName(item, coffeeItems));
        const quantity = Number(item.quantity || 1);
        const revenue = Number(item.totalPrice || item.price * quantity || 0);
        const current = productMap.get(id) || { id, name: getItemName(item, coffeeItems), sold: 0, revenue: 0, orders: 0 };
        current.sold += quantity;
        current.revenue += revenue;
        if (!seenInOrder.has(id)) {
          current.orders += 1;
          seenInOrder.add(id);
        }
        productMap.set(id, current);
      });
    });
    return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [selectedDayOrders, coffeeItems]);

  const employeePerformance = useMemo(() => {
    const empMap: any = {};
    filteredOrders.forEach((order: any) => {
      const empId = order.employeeId || order.cashierId || 'unknown';
      const employee = employees.find((e: any) => e.id === empId || e._id === empId);
      if (empId !== 'unknown') {
        const name = employee?.fullName || order.employeeName || 'غير محدد';
        empMap[empId] = {
          name,
          orders: (empMap[empId]?.orders || 0) + 1,
          revenue: (empMap[empId]?.revenue || 0) + (order.totalAmount || 0),
        };
      }
    });
    return Object.values(empMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 8);
  }, [filteredOrders, employees]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}:00`, orders: 0, revenue: 0 }));
    selectedDayOrders.forEach((order: any) => {
      if (!order.createdAt) return;
      const hour = new Date(order.createdAt).getHours();
      hours[hour].orders += 1;
      hours[hour].revenue += order.totalAmount || 0;
    });
    return hours.filter((h) => h.orders > 0);
  }, [selectedDayOrders]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; revenue: number }>();
    filteredOrders.forEach((order: any) => {
      const method = getPaymentMethod(order);
      const current = map.get(method) || { name: paymentLabels[method] || method, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += order.totalAmount || 0;
      map.set(method, current);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; revenue: number }>();
    filteredOrders.forEach((order: any) => {
      const status = normalizeStatus(order.status);
      const current = map.get(status) || { name: statusLabels[status] || status, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += order.totalAmount || 0;
      map.set(status, current);
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [filteredOrders]);

  const totalRevenue = filteredOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0);
  const totalOrders = filteredOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const soldQuantity = soldItems.reduce((sum, item) => sum + item.sold, 0);
  const selectedDayRevenue = selectedDayOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0);
  const selectedDayQuantity = daySoldItems.reduce((sum, item) => sum + item.sold, 0);

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await apiRequest('PATCH', '/api/business-config', updates);
      return res.json();
    },
    onSuccess: () => {
      refetchConfig();
      toast({ title: "تم تحديث الإعدادات" });
    }
  });

  const handleBulkPrint = async () => {
    if (selectedOrders.length === 0) return;
    const res = await apiRequest('POST', '/api/orders/bulk-print-employee', { orderIds: selectedOrders });
    const selected = await res.json();
    const { printBulkEmployeeInvoices } = await import('@/lib/print-utils');
    printBulkEmployeeInvoices(selected);
  };

  const applyToday = () => {
    setSelectedDay(today);
    setDateFrom(today);
    setDateTo(today);
  };

  const applyWeek = () => {
    setDateFrom(weekStart);
    setDateTo(today);
  };

  const StatBox = ({ label, value, detail, icon: Icon, trend }: any) => (
    <Card className="border-0 bg-gradient-to-br from-card to-background dark:from-card dark:to-slate-800" data-testid={`card-report-stat-${label}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm" data-testid={`text-report-stat-label-${label}`}>{label}</p>
            <p className="mt-2 truncate text-2xl font-bold sm:text-3xl" data-testid={`text-report-stat-value-${label}`}>{value}</p>
            {detail && <p className="mt-1 text-xs text-muted-foreground" data-testid={`text-report-stat-detail-${label}`}>{detail}</p>}
          </div>
          {Icon && <Icon className="h-5 w-5 shrink-0 text-orange-500" />}
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400" data-testid={`text-report-stat-trend-${label}`}>
            <ArrowUp className="h-4 w-4" />
            <span>{trend}% من الفترة السابقة</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen space-y-5 bg-white p-4 dark:bg-background sm:space-y-8 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-4xl" data-testid="text-admin-reports-title">التقارير والتحليلات</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-admin-reports-subtitle">تفاصيل اليوم، المنتجات المباعة، الطلبات، الفلاتر، وأداء التشغيل</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Card className="flex items-center justify-between gap-4 px-4 py-2" data-testid="card-employee-invoice-toggle">
            <span className="text-sm font-medium">فاتورة الموظف</span>
            <input
              type="checkbox"
              checked={businessConfig?.employeeInvoiceEnabled || false}
              onChange={(e) => updateConfigMutation.mutate({ employeeInvoiceEnabled: e.target.checked })}
              className="h-4 w-4 cursor-pointer"
              data-testid="checkbox-employee-invoice-enabled"
            />
          </Card>
          <Button variant="outline" data-testid="button-export-report">
            <Download className="ml-2 h-4 w-4" />
            تصدير
          </Button>
        </div>
      </div>

      {selectedOrders.length > 0 && (
        <Card className="flex flex-col gap-3 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="card-selected-orders-actions">
          <span className="font-medium" data-testid="text-selected-orders-count">{selectedOrders.length} طلبات مختارة</span>
          <Button onClick={handleBulkPrint} size="sm" data-testid="button-print-selected-employee-invoices">
            <Printer className="ml-2 h-4 w-4" />
            طباعة فواتير الموظفين
          </Button>
        </Card>
      )}

      <Card className="border-0 bg-slate-50 dark:bg-card" data-testid="card-report-filters">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <SlidersHorizontal className="h-5 w-5" />
            فلترة مرنة وسريعة
          </CardTitle>
          <CardDescription>اختر اليوم، الفترة، الحالة، طريقة الدفع، أو ابحث برقم الطلب والعميل والمنتج</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Button type="button" variant="outline" onClick={applyToday} data-testid="button-filter-today">اليوم</Button>
            <Button type="button" variant="outline" onClick={applyWeek} data-testid="button-filter-week">آخر 7 أيام</Button>
            <Input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} data-testid="input-selected-day" aria-label="اليوم التفصيلي" />
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="input-date-from" aria-label="من تاريخ" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="input-date-to" aria-label="إلى تاريخ" />
            <div className="relative col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="بحث" className="pr-9" data-testid="input-report-search" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger data-testid="select-time-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">رسم أسبوعي</SelectItem>
                <SelectItem value="month">رسم شهري</SelectItem>
                <SelectItem value="year">رسم سنوي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger data-testid="select-payment-filter">
                <SelectValue placeholder="طريقة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل طرق الدفع</SelectItem>
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-6">
        <StatBox label="إيراد الفترة" value={`${totalRevenue.toFixed(0)} ر.س`} detail={`${totalOrders} طلب`} icon={ReceiptText} trend="12" />
        <StatBox label="عدد الطلبات" value={totalOrders} detail={`${soldQuantity} قطعة مباعة`} icon={ShoppingBag} trend="8" />
        <StatBox label="متوسط الطلب" value={`${averageOrderValue.toFixed(2)} ر.س`} detail="حسب الفلاتر الحالية" icon={CreditCard} trend="5" />
        <StatBox label="الموظفون النشطون" value={employees.filter((e: any) => e.isActivated === 1).length} detail={`${employees.length} إجمالي`} icon={Clock} />
      </div>

      <Card className="border-0 bg-white dark:bg-card" data-testid="card-selected-day-details">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">تفاصيل اليوم المختار</CardTitle>
              <CardDescription>{selectedDay} — كل ما تم بيعه وما حدث في هذا اليوم</CardDescription>
            </div>
            <Badge variant="secondary" data-testid="badge-selected-day-orders">{selectedDayOrders.length} طلب</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/20" data-testid="metric-day-revenue">
              <p className="text-xs text-muted-foreground">الإيراد</p>
              <p className="text-xl font-bold text-orange-600">{selectedDayRevenue.toFixed(0)} ر.س</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20" data-testid="metric-day-items">
              <p className="text-xs text-muted-foreground">المباع</p>
              <p className="text-xl font-bold text-emerald-600">{selectedDayQuantity}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20" data-testid="metric-day-average">
              <p className="text-xs text-muted-foreground">متوسط</p>
              <p className="text-xl font-bold text-blue-600">{selectedDayOrders.length ? (selectedDayRevenue / selectedDayOrders.length).toFixed(1) : '0'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-bold" data-testid="text-day-sold-products-title">المنتجات المباعة اليوم</h3>
              {daySoldItems.length > 0 ? daySoldItems.slice(0, 10).map((item, index) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`row-day-product-${index}`}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold" data-testid={`text-day-product-name-${index}`}>{item.name}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-day-product-orders-${index}`}>{item.orders} طلب</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" data-testid={`badge-day-product-qty-${index}`}>{item.sold} قطعة</Badge>
                    <span className="font-bold text-accent" data-testid={`text-day-product-revenue-${index}`}>{item.revenue.toFixed(0)} <SarIcon /></span>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-day-products">لا توجد منتجات مباعة في اليوم المحدد</div>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="font-bold" data-testid="text-day-timeline-title">حركة اليوم بالساعة</h3>
              {hourlyData.length > 0 ? hourlyData.map((hour, index) => (
                <div key={hour.hour} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`row-hourly-${index}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold" data-testid={`text-hour-label-${index}`}>{hour.hour}</span>
                    <span className="text-sm text-muted-foreground" data-testid={`text-hour-orders-${index}`}>{hour.orders} طلب</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(100, (hour.revenue / Math.max(selectedDayRevenue, 1)) * 100)}%` }} data-testid={`bar-hour-revenue-${index}`} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground" data-testid={`text-hour-revenue-${index}`}>{hour.revenue.toFixed(0)} ر.س</p>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-day-timeline">لا توجد حركة في اليوم المحدد</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 sm:gap-6">
        <Card className="border-0 bg-white dark:bg-card">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">اتجاه الإيرادات</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 sm:p-6 sm:pt-0">
            <ChartFrame>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} name="الإيرادات (ر.س)" />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white dark:bg-card">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">عدد الطلبات</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 sm:p-6 sm:pt-0">
            <ChartFrame>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="orders" fill="#f97316" name="الطلبات" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 sm:gap-6">
        <Card className="border-0 bg-white dark:bg-card">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">أفضل المنتجات حسب الفلتر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-2 sm:p-6 sm:pt-0">
            <ChartFrame>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={soldItems.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" width={110} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="sold" fill="#f97316" name="المبيعات" />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
            <div className="space-y-3">
              {soldItems.slice(0, 8).map((item, index) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`row-filtered-product-${index}`}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold" data-testid={`text-filtered-product-name-${index}`}>{item.name}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-filtered-product-orders-${index}`}>{item.orders} طلب</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" data-testid={`badge-filtered-product-qty-${index}`}>{item.sold} قطعة</Badge>
                    <span className="font-bold text-accent" data-testid={`text-filtered-product-revenue-${index}`}>{item.revenue.toFixed(0)} <SarIcon /></span>
                  </div>
                </div>
              ))}
              {soldItems.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-filtered-products">لا توجد نتائج حسب الفلتر الحالي</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white dark:bg-card">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">أداء الموظفين وطرق الدفع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4 pt-2 sm:p-6 sm:pt-0">
            <div className="space-y-3">
              <h3 className="font-bold">أداء الموظفين</h3>
              {employeePerformance.length > 0 ? employeePerformance.map((emp: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50" data-testid={`row-employee-performance-${idx}`}>
                  <div className="min-w-0">
                    <p className="truncate font-medium" data-testid={`text-performance-employee-name-${idx}`}>{emp.name}</p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-performance-employee-orders-${idx}`}>{emp.orders} طلب</p>
                  </div>
                  <p className="font-bold text-accent" data-testid={`text-performance-employee-revenue-${idx}`}>{emp.revenue.toFixed(0)} <SarIcon /></p>
                </div>
              )) : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-employee-performance">لا توجد بيانات موظفين ضمن الفلتر</div>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-bold">طرق الدفع</h3>
                {paymentBreakdown.map((item, index) => (
                  <div key={item.name} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`row-payment-breakdown-${index}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold" data-testid={`text-payment-name-${index}`}>{item.name}</span>
                      <span className="text-sm text-muted-foreground" data-testid={`text-payment-orders-${index}`}>{item.orders} طلب</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-accent" data-testid={`text-payment-revenue-${index}`}>{item.revenue.toFixed(0)} ر.س</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-bold">حالات الطلب</h3>
                {statusBreakdown.map((item, index) => (
                  <div key={item.name} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`row-status-breakdown-${index}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold" data-testid={`text-status-name-${index}`}>{item.name}</span>
                      <span className="text-sm text-muted-foreground" data-testid={`text-status-orders-${index}`}>{item.orders} طلب</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-accent" data-testid={`text-status-revenue-${index}`}>{item.revenue.toFixed(0)} ر.س</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white dark:bg-card">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">توزيع المبيعات حسب المنتج</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 sm:p-6 sm:pt-0">
          <ChartFrame height={340}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={soldItems.slice(0, 6)} cx="50%" cy="50%" labelLine={true} label={({ name, sold }) => `${name}: ${sold}`} outerRadius={100} fill="#8884d8" dataKey="sold">
                  {soldItems.slice(0, 6).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartFrame>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white dark:bg-card" data-testid="card-recent-orders-details">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">تفاصيل الطلبات حسب الفلتر</CardTitle>
          <CardDescription>آخر {Math.min(filteredOrders.length, 25)} طلب مطابق للفلاتر الحالية</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 sm:p-6 sm:pt-0">
          <div className="space-y-3 md:hidden">
            {filteredOrders.slice(-25).reverse().map((order: any, index: number) => {
              const emp = employees.find((e: any) => e.id === order.employeeId || e._id === order.employeeId);
              const orderId = order.id || order._id || String(index);
              return (
                <div key={orderId} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60" data-testid={`card-order-mobile-${orderId}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold" data-testid={`text-order-number-mobile-${index}`}>#{order.orderNumber || orderId}</p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-order-time-mobile-${index}`}>{getOrderDate(order)} — {getOrderTime(order)}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(orderId)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedOrders([...selectedOrders, orderId]);
                        else setSelectedOrders(selectedOrders.filter(id => id !== orderId));
                      }}
                      className="h-4 w-4"
                      data-testid={`checkbox-order-mobile-${orderId}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">العميل</p>
                      <p className="truncate" data-testid={`text-order-customer-mobile-${index}`}>{order.customerInfo?.name || order.customerName || 'زائر'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">الموظف</p>
                      <p className="truncate" data-testid={`text-order-employee-mobile-${index}`}>{emp?.fullName || order.employeeName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">الحالة</p>
                      <p data-testid={`text-order-status-mobile-${index}`}>{statusLabels[normalizeStatus(order.status)] || normalizeStatus(order.status)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">المبلغ</p>
                      <p className="font-bold text-accent" data-testid={`text-order-total-mobile-${index}`}>{Number(order.totalAmount || 0).toFixed(2)} <SarIcon /></p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(Array.isArray(order.items) ? order.items : []).slice(0, 4).map((item: any, itemIndex: number) => (
                      <Badge key={`${orderId}-${itemIndex}`} variant="secondary" data-testid={`badge-order-item-mobile-${index}-${itemIndex}`}>{getItemName(item, coffeeItems)} × {item.quantity || 1}</Badge>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredOrders.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-filtered-orders-mobile">لا توجد طلبات مطابقة للفلاتر</div>}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b-2 border-accent dark:border-accent/30">
                  <th className="w-10 p-4"></th>
                  <th className="p-4 text-right font-semibold">رقم الطلب</th>
                  <th className="p-4 text-right font-semibold">العميل</th>
                  <th className="p-4 text-right font-semibold">الموظف</th>
                  <th className="p-4 text-right font-semibold">الحالة</th>
                  <th className="p-4 text-right font-semibold">الدفع</th>
                  <th className="p-4 text-right font-semibold">المبلغ</th>
                  <th className="p-4 text-right font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(-25).reverse().map((order: any, index: number) => {
                  const emp = employees.find((e: any) => e.id === order.employeeId || e._id === order.employeeId);
                  const orderId = order.id || order._id || String(index);
                  return (
                    <tr key={orderId} className="border-b border-gray-200 dark:border-gray-700" data-testid={`row-order-desktop-${orderId}`}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(orderId)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedOrders([...selectedOrders, orderId]);
                            else setSelectedOrders(selectedOrders.filter(id => id !== orderId));
                          }}
                          className="h-4 w-4"
                          data-testid={`checkbox-order-desktop-${orderId}`}
                        />
                      </td>
                      <td className="p-4" data-testid={`text-order-number-desktop-${index}`}>{order.orderNumber}</td>
                      <td className="p-4 text-muted-foreground" data-testid={`text-order-customer-desktop-${index}`}>{order.customerInfo?.name || order.customerName || 'زائر'}</td>
                      <td className="p-4" data-testid={`text-order-employee-desktop-${index}`}>{emp?.fullName || order.employeeName || '-'}</td>
                      <td className="p-4" data-testid={`text-order-status-desktop-${index}`}>{statusLabels[normalizeStatus(order.status)] || normalizeStatus(order.status)}</td>
                      <td className="p-4" data-testid={`text-order-payment-desktop-${index}`}>{paymentLabels[getPaymentMethod(order)] || getPaymentMethod(order)}</td>
                      <td className="p-4 font-bold text-accent" data-testid={`text-order-total-desktop-${index}`}>{Number(order.totalAmount || 0).toFixed(2)} <SarIcon /></td>
                      <td className="p-4 text-muted-foreground" data-testid={`text-order-date-desktop-${index}`}>{getOrderDate(order)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

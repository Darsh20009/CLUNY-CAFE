import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, DollarSign, Calendar, Activity, Settings, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import SarIcon from "@/components/sar-icon";

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

  const StatCard = ({ icon: Icon, label, value, subtext }: any) => (
    <Card className="border-border/50 bg-gradient-to-br from-card to-card/90 shadow-md hover:shadow-lg transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-3xl font-bold font-playfair mt-2 text-foreground">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
          <div className="bg-accent/20 dark:bg-accent/10 p-3 rounded-lg flex-shrink-0">
            <Icon className="w-6 h-6 text-accent" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-8 bg-gradient-to-b from-background via-primary/5 to-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-playfair text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-2 font-cairo">مرحباً بك في نظام الإدارة</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/settings')}>
          <Settings className="w-4 h-4 ml-2" />
          الإعدادات
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          label="إجمالي الموظفين"
          value={employees.length}
          subtext={`${activeEmployees} نشطين`}
        />
        <StatCard
          icon={Activity}
          label="الحاضرون اليوم"
          value={presentToday}
          subtext={`من ${activeEmployees} موظف نشط`}
        />
        <StatCard
          icon={Calendar}
          label="في الإجازة"
          value={onLeave}
          subtext="إجازة معتمدة اليوم"
        />
        <StatCard
          icon={DollarSign}
          label="إيرادات اليوم"
          value={`${todayRevenue.toFixed(0)} ر.س`}
          subtext={`${todayOrders.length} طلب اليوم`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 bg-white dark:bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              نظرة عامة على الطلبات
            </CardTitle>
            <CardDescription>جميع الطلبات</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-background dark:bg-accent/20 rounded-lg">
                <span className="text-sm font-medium">إجمالي الطلبات</span>
                <span className="text-2xl font-bold text-accent dark:text-accent">{orders.length}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-sm font-medium">طلبات اليوم</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{todayOrders.length}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <span className="text-sm font-medium">إجمالي الإيرادات</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalRevenue.toFixed(0)} <SarIcon /></span>
              </div>
              <div className="flex justify-between items-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <span className="text-sm font-medium">متوسط قيمة الطلب</span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{avgOrderValue.toFixed(2)} <SarIcon /></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white dark:bg-card">
          <CardHeader className="pb-4">
            <CardTitle>إجراءات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => navigate('/admin/employees')}
              className="w-full bg-accent hover:bg-accent text-white"
              data-testid="button-manage-employees"
            >
              <Users className="w-4 h-4 ml-2" />
              إدارة الموظفين
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/attendance')}
              className="w-full"
              data-testid="button-view-attendance"
            >
              <Clock className="w-4 h-4 ml-2" />
              الحضور والغياب
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/reports')}
              className="w-full"
              data-testid="button-view-reports"
            >
              <TrendingUp className="w-4 h-4 ml-2" />
              التقارير
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white dark:bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>الموظفون</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/employees')}
              data-testid="button-view-all-employees"
            >
              عرض الكل
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-200 dark:border-orange-900/30">
                    <th className="text-right p-3 font-semibold">الاسم</th>
                    <th className="text-right p-3 font-semibold">الدور</th>
                    <th className="text-right p-3 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 5).map((emp: any) => (
                    <tr key={emp.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-3">{emp.fullName}</td>
                      <td className="p-3 text-muted-foreground">{emp.jobTitle}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
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
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-muted-foreground">لا توجد موظفون</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

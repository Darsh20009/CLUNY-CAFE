import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Download } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function OSAccountingDashboard() {
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/orders", startDate, endDate],
  });

  const { data: dailySnapshot = null } = useQuery({
    queryKey: ["/api/accounting/daily-snapshot/:branchId", startDate],
  });

  const calculateMetrics = () => {
    if (!orders || orders.length === 0) {
      return {
        totalRevenue: 0,
        totalCOGS: 0,
        totalProfit: 0,
        profitMargin: 0,
        orderCount: 0,
        avgOrderValue: 0,
      };
    }

    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const totalCOGS = orders.reduce((sum: number, o: any) => sum + (o.costOfGoods || 0), 0);
    const totalProfit = totalRevenue - totalCOGS;
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCOGS: parseFloat(totalCOGS.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
      orderCount: orders.length,
      avgOrderValue: parseFloat((totalRevenue / orders.length).toFixed(2)),
    };
  };

  const calculateProfitByItem = () => {
    const itemProfits: { [key: string]: { revenue: number; cogs: number; count: number; name: string } } = {};

    orders.forEach((order: any) => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const key = item.coffeeItemId || item.id;
          if (!itemProfits[key]) {
            itemProfits[key] = { revenue: 0, cogs: 0, count: 0, name: item.nameAr || item.name || 'Unknown' };
          }
          itemProfits[key].revenue += item.totalPrice || 0;
          itemProfits[key].cogs += (item.costPerItem || 0) * (item.quantity || 1);
          itemProfits[key].count += item.quantity || 1;
        });
      }
    });

    return Object.entries(itemProfits)
      .map(([id, data]) => ({
        id,
        name: data.name,
        revenue: parseFloat(data.revenue.toFixed(2)),
        cogs: parseFloat(data.cogs.toFixed(2)),
        profit: parseFloat((data.revenue - data.cogs).toFixed(2)),
        margin: data.revenue > 0 ? parseFloat(((data.revenue - data.cogs) / data.revenue * 100).toFixed(1)) : 0,
        count: data.count,
      }))
      .sort((a, b) => b.profit - a.profit);
  };

  const metrics = calculateMetrics();
  const profitByItem = calculateProfitByItem();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen text-right" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">لوحة المحاسبة التشغيلية (Operating System Accounting)</h1>
        <DollarSign className="w-8 h-8 text-primary" />
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle>فلتر التقارير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>من التاريخ</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>إلى التاريخ</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
            <DollarSign className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRevenue.toFixed(2)} ريال</div>
            <p className="text-xs text-muted-foreground">{metrics.orderCount} طلب</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تكلفة البضائع المباعة</CardTitle>
            <TrendingDown className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCOGS.toFixed(2)} ريال</div>
            <p className="text-xs text-muted-foreground">{((metrics.totalCOGS / metrics.totalRevenue) * 100 || 0).toFixed(1)}% من المبيعات</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الربح</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.totalProfit.toFixed(2)} ريال</div>
            <p className="text-xs text-muted-foreground">هامش: {metrics.profitMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط قيمة الطلب</CardTitle>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgOrderValue.toFixed(2)} ريال</div>
            <p className="text-xs text-muted-foreground">لكل طلب</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Profitable Items */}
      <Card>
        <CardHeader>
          <CardTitle>أكثر المشروبات ربحية</CardTitle>
          <CardDescription>ترتيب المشروبات حسب الربح الإجمالي</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2">المشروب</th>
                  <th className="text-right p-2">المبيعات</th>
                  <th className="text-right p-2">التكلفة</th>
                  <th className="text-right p-2">الربح</th>
                  <th className="text-right p-2">الهامش</th>
                  <th className="text-right p-2">العدد</th>
                </tr>
              </thead>
              <tbody>
                {profitByItem.slice(0, 10).map((item, i) => (
                  <tr key={i} className="border-b hover:bg-muted">
                    <td className="p-2 font-medium">{item.name}</td>
                    <td className="p-2">{item.revenue.toFixed(2)}</td>
                    <td className="p-2">{item.cogs.toFixed(2)}</td>
                    <td className="p-2 font-bold text-green-600">{item.profit.toFixed(2)}</td>
                    <td className="p-2">{item.margin}%</td>
                    <td className="p-2">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Chart */}
      <Card>
        <CardHeader>
          <CardTitle>ملخص المالية</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              {
                name: 'الملخص',
                المبيعات: metrics.totalRevenue,
                التكلفة: metrics.totalCOGS,
                الربح: metrics.totalProfit,
              }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="المبيعات" fill="#10b981" />
              <Bar dataKey="التكلفة" fill="#f97316" />
              <Bar dataKey="الربح" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Export */}
      <Button className="w-full">
        <Download className="ml-2 w-4 h-4" />
        تحميل التقرير
      </Button>
    </div>
  );
}

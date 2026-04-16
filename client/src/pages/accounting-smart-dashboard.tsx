import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart, Line, BarChart as RechartsBar, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";
import { DollarSign, TrendingUp, Zap, AlertTriangle } from "lucide-react";
import { LoadingState } from "@/components/ui/states";

export default function AccountingSmartDashboard() {
  const [selectedBranch, setSelectedBranch] = useState("branch-1");
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: snapshot = {} as any, isLoading: snapshotLoading } = useQuery<any>({
    queryKey: [`/api/accounting/daily-snapshot/${selectedBranch}`],
    enabled: !!selectedBranch,
  });

  const { data: profitByItem = [], isLoading: profitLoading } = useQuery<any[]>({
    queryKey: [`/api/accounting/profit-by-item/${selectedBranch}`, startDate, endDate],
    enabled: !!selectedBranch,
  });

  const { data: topItems = [], isLoading: topLoading } = useQuery<any[]>({
    queryKey: [`/api/accounting/top-items/${selectedBranch}`, startDate, endDate],
    enabled: !!selectedBranch,
  });

  const { data: wasteReport = [], isLoading: wasteLoading } = useQuery<any[]>({
    queryKey: [`/api/accounting/waste-report/${selectedBranch}`, startDate, endDate],
    enabled: !!selectedBranch,
  });

  const isLoading = snapshotLoading || profitLoading || topLoading || wasteLoading;

  if (isLoading) return <LoadingState />;

  const dailySnapshotData = snapshot?.snapshot || {};

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Accounting Dashboard</h1>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div>
              <Label>Branch</Label>
              <Input
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                data-testid="input-branch"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-revenue">
              {dailySnapshotData.totalRevenue?.toFixed(2) || "0.00"} SAR
            </div>
            <p className="text-xs text-secondary-foreground">
              {dailySnapshotData.itemsSold || 0} items sold
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-cogs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total COGS</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-cogs">
              {dailySnapshotData.totalCOGS?.toFixed(2) || "0.00"} SAR
            </div>
            <p className="text-xs text-secondary-foreground">
              {((dailySnapshotData.totalCOGS / dailySnapshotData.totalRevenue) * 100 || 0).toFixed(1)}% of revenue
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-profit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <Zap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-profit">
              {dailySnapshotData.totalProfit?.toFixed(2) || "0.00"} SAR
            </div>
            <p className="text-xs text-secondary-foreground">
              {((dailySnapshotData.totalProfit / dailySnapshotData.totalRevenue) * 100 || 0).toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-waste">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Waste</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-waste">
              {dailySnapshotData.totalWaste?.toFixed(2) || "0.00"} SAR
            </div>
            <p className="text-xs text-secondary-foreground">
              {dailySnapshotData.wasteDetails?.length || 0} waste items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Items Table */}
      <Card data-testid="card-top-items">
        <CardHeader>
          <CardTitle>Top 10 Profitable Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topItems && topItems.length > 0 ? (
              topItems.slice(0, 10).map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  data-testid={`row-top-item-${idx}`}
                >
                  <div>
                    <p className="font-medium">{item.nameAr || item.itemId}</p>
                    <p className="text-sm text-secondary-foreground">
                      {item.quantitySold} sold • Profit: {item.totalProfit?.toFixed(2)} SAR
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{item.profitMargin?.toFixed(1)}%</p>
                    <p className="text-xs text-secondary-foreground">margin</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-secondary-foreground text-sm">No data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Waste Report */}
      <Card data-testid="card-waste-report">
        <CardHeader>
          <CardTitle>Waste Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {wasteReport && wasteReport.length > 0 ? (
              wasteReport.map((waste: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg"
                  data-testid={`row-waste-${idx}`}
                >
                  <div>
                    <p className="font-medium">{waste.itemId}</p>
                    <p className="text-sm text-secondary-foreground">
                      {waste.reason || 'Unknown'} • {waste.quantity} {waste.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-destructive">{waste.cost?.toFixed(2)} SAR</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-secondary-foreground text-sm">No waste recorded</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

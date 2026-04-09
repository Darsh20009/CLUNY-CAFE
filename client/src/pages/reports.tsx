import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

export default function ReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState("branch-1");
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: topItems = [], isLoading: topLoading } = useQuery<any[]>({
    queryKey: [`/api/accounting/top-items/${selectedBranch}`, startDate, endDate],
    enabled: !!selectedBranch,
  });

  const { data: worstItems = [], isLoading: worstLoading } = useQuery<any[]>({
    queryKey: [`/api/accounting/worst-items/${selectedBranch}`, startDate, endDate],
    enabled: !!selectedBranch,
  });

  const isLoading = topLoading || worstLoading;

  const handleExportTopItemsCSV = () => {
    const data = topItems.map((item: any) => ({
      "Item Name": item.nameAr || item.itemId,
      "Quantity Sold": item.quantitySold,
      "Total Revenue": item.totalRevenue?.toFixed(2),
      "Total COGS": item.totalCOGS?.toFixed(2),
      "Total Profit": item.totalProfit?.toFixed(2),
      "Profit Margin %": item.profitMargin?.toFixed(1),
    }));
    exportToCSV(data, `top-items-${selectedBranch}-${startDate}-to-${endDate}.csv`);
  };

  const handleExportWorstItemsCSV = () => {
    const data = worstItems.map((item: any) => ({
      "Item Name": item.nameAr || item.itemId,
      "Quantity Sold": item.quantitySold,
      "Total Revenue": item.totalRevenue?.toFixed(2),
      "Total COGS": item.totalCOGS?.toFixed(2),
      "Total Profit": item.totalProfit?.toFixed(2),
      "Profit Margin %": item.profitMargin?.toFixed(1),
      Reason: item.reason || "Low profit margin",
    }));
    exportToCSV(data, `worst-items-${selectedBranch}-${startDate}-to-${endDate}.csv`);
  };

  const handleExportSummaryPDF = () => {
    exportToPDF(
      {
        title: "Sales Report",
        date: `${startDate} to ${endDate}`,
        branch: selectedBranch,
        topItems: topItems.slice(0, 10),
        worstItems: worstItems.slice(0, 10),
      },
      `sales-report-${selectedBranch}-${startDate}-to-${endDate}.pdf`
    );
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Sales Reports</h1>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="flex items-end gap-2">
              <Button
                onClick={handleExportSummaryPDF}
                className="w-full gap-2"
                variant="outline"
                data-testid="button-export-pdf"
              >
                <Download className="w-4 h-4" /> Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Items */}
      <Card data-testid="card-top-items">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top 10 Profitable Items
            </CardTitle>
          </div>
          <Button
            onClick={handleExportTopItemsCSV}
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="button-export-top-csv"
          >
            <Download className="w-4 h-4" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {topItems && topItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topItems.slice(0, 10).map((item: any, idx: number) => (
                    <TableRow key={idx} data-testid={`row-top-item-${idx}`}>
                      <TableCell className="font-medium">{item.nameAr || item.itemId}</TableCell>
                      <TableCell className="text-right">{item.quantitySold}</TableCell>
                      <TableCell className="text-right">{item.totalRevenue?.toFixed(2)} SAR</TableCell>
                      <TableCell className="text-right">{item.totalCOGS?.toFixed(2)} SAR</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {item.totalProfit?.toFixed(2)} SAR
                      </TableCell>
                      <TableCell className="text-right">{item.profitMargin?.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No data" description="No top items found for this period" />
          )}
        </CardContent>
      </Card>

      {/* Worst Items */}
      <Card data-testid="card-worst-items">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Worst 10 Performing Items
            </CardTitle>
          </div>
          <Button
            onClick={handleExportWorstItemsCSV}
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="button-export-worst-csv"
          >
            <Download className="w-4 h-4" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {worstItems && worstItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worstItems.slice(0, 10).map((item: any, idx: number) => (
                    <TableRow key={idx} data-testid={`row-worst-item-${idx}`}>
                      <TableCell className="font-medium">{item.nameAr || item.itemId}</TableCell>
                      <TableCell className="text-right">{item.quantitySold}</TableCell>
                      <TableCell className="text-right">{item.totalRevenue?.toFixed(2)} SAR</TableCell>
                      <TableCell className="text-right">{item.totalCOGS?.toFixed(2)} SAR</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {item.totalProfit?.toFixed(2)} SAR
                      </TableCell>
                      <TableCell className="text-right text-secondary-foreground text-sm">
                        {item.reason || "Low margin"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No data" description="No worst items found for this period" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

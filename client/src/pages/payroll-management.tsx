import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, DollarSign, Users, TrendingDown, Calendar, Loader2, UserCheck, AlertCircle } from "lucide-react";
import SarIcon from "@/components/sar-icon";

interface PayrollEmployee {
  employeeId: string;
  name: string;
  role: string;
  baseSalary: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalWorkingDays: number;
  deductions: number;
  lateDeductions: number;
  netSalary: number;
  attendanceRate: number;
}

interface PayrollReport {
  month: number;
  year: number;
  employees: PayrollEmployee[];
  totals: {
    totalBaseSalary: number;
    totalDeductions: number;
    totalNetSalary: number;
    employeeCount: number;
  };
}

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default function PayrollManagementPage() {
  const [, setLocation] = useLocation();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data, isLoading } = useQuery<PayrollReport>({
    queryKey: ["/api/payroll/report", month, year],
    queryFn: () => fetch(`/api/payroll/report?month=${month}&year=${year}`).then(r => r.json()),
  });

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-card via-slate-800 to-slate-900" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Button variant="ghost" onClick={() => setLocation("/manager/dashboard")} className="text-slate-300 hover:text-white" data-testid="btn-back">
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-green-400" />تقرير الرواتب
          </h1>
          <div className="flex gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white" data-testid="select-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS_AR.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24 bg-slate-800 border-slate-700 text-white" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-green-400" /></div>
        ) : !data ? (
          <div className="text-center py-12 text-slate-400">لا توجد بيانات</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">الموظفون</p>
                  <p className="text-2xl font-bold text-white">{data.totals.employeeCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">إجمالي الرواتب الأساسية</p>
                  <p className="text-xl font-bold text-amber-400">{data.totals.totalBaseSalary.toLocaleString()} <SarIcon /></p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4 text-center">
                  <TrendingDown className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">إجمالي الخصومات</p>
                  <p className="text-xl font-bold text-red-400">{data.totals.totalDeductions.toLocaleString()} <SarIcon /></p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">صافي الرواتب</p>
                  <p className="text-xl font-bold text-green-400">{data.totals.totalNetSalary.toLocaleString()} <SarIcon /></p>
                </CardContent>
              </Card>
            </div>

            {/* Period Label */}
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 text-sm">تقرير {MONTHS_AR[data.month - 1]} {data.year}</span>
            </div>

            {/* Employee rows */}
            {data.employees.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا يوجد موظفون مسجلون</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.employees.map((emp, idx) => (
                  <Card key={emp.employeeId} className="bg-slate-800/50 border-slate-700" data-testid={`card-payroll-${idx}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                        <div>
                          <h3 className="text-white font-semibold">{emp.name}</h3>
                          <p className="text-slate-400 text-xs">{emp.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-bold text-lg">{emp.netSalary.toLocaleString()} <SarIcon /></p>
                          <p className="text-slate-400 text-xs">أساسي: {emp.baseSalary.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                        <div className="bg-card/50 rounded-lg p-2">
                          <p className="text-green-400 font-bold">{emp.presentDays}</p>
                          <p className="text-slate-400 text-xs">حضور</p>
                        </div>
                        <div className="bg-card/50 rounded-lg p-2">
                          <p className="text-red-400 font-bold">{emp.absentDays}</p>
                          <p className="text-slate-400 text-xs">غياب</p>
                        </div>
                        <div className="bg-card/50 rounded-lg p-2">
                          <p className="text-amber-400 font-bold">{emp.lateDays}</p>
                          <p className="text-slate-400 text-xs">تأخير</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs">نسبة الحضور</span>
                        <span className={`text-sm font-medium ${emp.attendanceRate >= 90 ? 'text-green-400' : emp.attendanceRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                          {emp.attendanceRate}%
                        </span>
                      </div>
                      <Progress value={emp.attendanceRate} className="h-1.5 mb-2" />
                      {(emp.deductions > 0 || emp.lateDeductions > 0) && (
                        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg p-2 mt-2">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span>خصم غياب: {emp.deductions} <SarIcon /> | خصم تأخير: {emp.lateDeductions} <SarIcon /></span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

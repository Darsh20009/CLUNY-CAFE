import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Coffee, ArrowRight, Calendar, Clock, User, MapPin, 
  Camera, CheckCircle2, XCircle, AlertTriangle, Search,
  Download, Filter, Users, FileText, Check, X
} from "lucide-react";
import * as XLSX from 'xlsx';
import type { Employee } from "@shared/schema";

interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  numberOfDays: number;
  rejectionReason?: string;
  createdAt: string;
  employee?: {
    fullName: string;
    imageUrl?: string;
  };
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  branchId: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInLocation: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
  checkInPhoto: string;
  checkOutPhoto?: string;
  status: 'checked_in' | 'checked_out' | 'late' | 'absent';
  shiftDate: string;
  isLate: number;
  lateMinutes?: number;
  isAtBranch?: number;
  distanceFromBranch?: number;
  checkOutIsAtBranch?: number;
  checkOutDistanceFromBranch?: number;
  employee?: {
    fullName: string;
    phone: string;
    jobTitle: string;
    shiftTime: string;
    imageUrl?: string;
    role?: string;
  };
  branch?: {
    name: string;
    nameAr?: string;
  };
}

interface Branch {
  id: string;
  name?: string;
  nameAr?: string;
}

export default function ManagerAttendance() {
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      if (emp.role !== 'manager' && emp.role !== 'admin' && emp.role !== 'owner') {
        setLocation("/employee/gateway");
        return;
      }
      setEmployee(emp);
    } else {
      setLocation("/employee/gateway");
    }
  }, [setLocation]);

  useEffect(() => {
    if (employee) {
      fetchBranches();
      fetchAttendance();
      fetchLeaveRequests();
    }
  }, [employee, selectedDate, selectedBranch]);

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch('/api/leave-requests/pending', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data);
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
  };

  const approveLeaveRequest = async (requestId: string) => {
    setApprovingId(requestId);
    try {
      const response = await fetch(`/api/leave-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        setLeaveRequests(leaveRequests.filter(r => r.id !== requestId));
      }
    } catch (error) {
      console.error("Error approving leave request:", error);
    } finally {
      setApprovingId(null);
    }
  };

  const rejectLeaveRequest = async (requestId: string) => {
    setRejectingId(requestId);
    try {
      const response = await fetch(`/api/leave-requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        setLeaveRequests(leaveRequests.filter(r => r.id !== requestId));
      }
    } catch (error) {
      console.error("Error rejecting leave request:", error);
    } finally {
      setRejectingId(null);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      let url = `/api/attendance?date=${selectedDate}`;
      if (selectedBranch !== 'all') {
        url += `&branchId=${selectedBranch}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAttendanceRecords(data);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = attendanceRecords.filter(record => {
    if (searchQuery && !record.employee?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !record.employee?.phone?.includes(searchQuery)) return false;
    if (selectedRole !== 'all' && record.employee?.role !== selectedRole) return false;
    if (selectedStatus !== 'all' && record.status !== selectedStatus) return false;
    return true;
  });

  const stats = {
    total: filteredRecords.length,
    present: filteredRecords.filter(r => r.status === 'checked_in' || r.status === 'checked_out').length,
    late: filteredRecords.filter(r => r.isLate === 1).length,
    checkedOut: filteredRecords.filter(r => r.status === 'checked_out').length,
    absent: filteredRecords.filter(r => r.status === 'absent').length
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadReport = () => {
    const reportData = filteredRecords.map(r => [
      r.employee?.fullName || '',
      r.employee?.jobTitle || '',
      r.branch?.nameAr || r.branch?.name || '',
      formatTime(r.checkInTime),
      formatTime(r.checkOutTime),
      r.status === 'checked_out' ? 'انصرف' : r.status === 'checked_in' ? 'حاضر' : 'غائب',
      r.lateMinutes ? r.lateMinutes : '-',
      r.isAtBranch === 1 ? 'في الفرع' : 'خارج الفرع',
      r.distanceFromBranch ? Math.round(r.distanceFromBranch) : 0,
      r.checkOutIsAtBranch === 1 ? 'في الفرع' : r.checkOutTime ? 'خارج الفرع' : '-',
      r.checkOutDistanceFromBranch ? Math.round(r.checkOutDistanceFromBranch) : 0
    ]);

    const headers = [
      'الاسم',
      'الدور',
      'الفرع',
      'وقت الحضور',
      'وقت الانصراف',
      'الحالة',
      'تأخير (دقيقة)',
      'الموقع عند الحضور',
      'المسافة (متر)',
      'موقع الانصراف',
      'مسافة الانصراف (متر)'
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...reportData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الحضور');
    
    const fileName = `سجل_حضور_${selectedDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (!employee) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-accent">سجل الحضور</h1>
              <p className="text-gray-400 text-xs">إدارة حضور جميع الموظفين والمديرين</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation("/manager/dashboard")}
            className="border-primary/50 text-accent"
            data-testid="button-back"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-blue-400 text-2xl font-bold">{stats.total}</p>
                  <p className="text-gray-400 text-xs">إجمالي</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 text-2xl font-bold">{stats.present}</p>
                  <p className="text-gray-400 text-xs">حاضرون</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-accent text-2xl font-bold">{stats.late}</p>
                  <p className="text-gray-400 text-xs">متأخرون</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-purple-400 text-2xl font-bold">{stats.checkedOut}</p>
                  <p className="text-gray-400 text-xs">انصرفوا</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-red-400 text-2xl font-bold">{stats.absent}</p>
                  <p className="text-gray-400 text-xs">غياب</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-background to-background border-primary/20 mb-6">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="بحث بالاسم أو الهاتف..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 bg-[#1a1410] border-primary/20 text-white"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-[#1a1410] border-primary/20 text-white w-40"
                    data-testid="input-date"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {(employee.role === 'admin' || employee.role === 'owner') && (
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-40 bg-[#1a1410] border-primary/20 text-white" data-testid="select-branch">
                      <Filter className="w-4 h-4 ml-2" />
                      <SelectValue placeholder="جميع الفروع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.nameAr || branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-40 bg-[#1a1410] border-primary/20 text-white" data-testid="select-role">
                    <Filter className="w-4 h-4 ml-2" />
                    <SelectValue placeholder="جميع الأدوار" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأدوار</SelectItem>
                    <SelectItem value="cashier">كاشير</SelectItem>
                    <SelectItem value="manager">مدير</SelectItem>
                    <SelectItem value="admin">إدمن</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-40 bg-[#1a1410] border-primary/20 text-white" data-testid="select-status">
                    <Filter className="w-4 h-4 ml-2" />
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="checked_in">حاضر</SelectItem>
                    <SelectItem value="checked_out">انصرف</SelectItem>
                    <SelectItem value="late">متأخر</SelectItem>
                    <SelectItem value="absent">غياب</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={downloadReport}
                  className="bg-background0 hover:bg-primary text-white"
                  data-testid="button-download-report"
                >
                  <Download className="w-4 h-4 ml-2" />
                  تنزيل تقرير
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {leaveRequests.length > 0 && (
          <Card className="bg-gradient-to-br from-background to-background border-primary/20 mb-6">
            <CardHeader>
              <CardTitle className="text-accent flex items-center gap-2">
                <FileText className="w-5 h-5" />
                طلبات الجازات المعلقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-[#1a1410] rounded-lg p-4 border border-primary/10"
                    data-testid={`leave-request-card-${request.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-bold">
                          {request.employee?.fullName || 'موظف غير معروف'}
                        </h3>
                        <p className="text-gray-400 text-sm">{request.reason}</p>
                      </div>
                      <Badge className="bg-yellow-500/20 text-yellow-400">
                        {request.numberOfDays} يوم
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">تاريخ البداية</p>
                        <p className="text-accent font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(request.startDate).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">تاريخ النهاية</p>
                        <p className="text-accent font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(request.endDate).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">تاريخ الطلب</p>
                        <p className="text-gray-400 text-xs">
                          {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveLeaveRequest(request.id)}
                        disabled={approvingId === request.id}
                        className="bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 flex-1"
                        data-testid={`button-approve-leave-${request.id}`}
                      >
                        <Check className="w-4 h-4 ml-2" />
                        {approvingId === request.id ? 'جاري...' : 'موافقة'}
                      </Button>
                      <Button
                        onClick={() => rejectLeaveRequest(request.id)}
                        disabled={rejectingId === request.id}
                        className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 flex-1"
                        data-testid={`button-reject-leave-${request.id}`}
                      >
                        <X className="w-4 h-4 ml-2" />
                        {rejectingId === request.id ? 'جاري...' : 'رفض'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-background to-background border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-accent flex items-center gap-2">
                <Clock className="w-5 h-5" />
                سجلات الحضور
              </CardTitle>
              <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'cards' | 'table')}>
                <TabsList className="bg-[#1a1410]">
                  <TabsTrigger value="cards">بطاقات</TabsTrigger>
                  <TabsTrigger value="table">جدول</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-400 mt-2">جاري التحميل...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">لا توجد سجلات حضور لهذا اليوم</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="text-right py-3 px-4 text-accent">الاسم</th>
                      <th className="text-right py-3 px-4 text-accent">الدور</th>
                      <th className="text-right py-3 px-4 text-accent">الفرع</th>
                      <th className="text-right py-3 px-4 text-accent">وقت الحضور</th>
                      <th className="text-right py-3 px-4 text-accent">وقت الانصراف</th>
                      <th className="text-right py-3 px-4 text-accent">الحالة</th>
                      <th className="text-right py-3 px-4 text-accent">الموقع/المسافة</th>
                      <th className="text-right py-3 px-4 text-accent">الصور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="border-b border-primary/10 hover:bg-[#2d1f1a]/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {record.employee?.imageUrl ? (
                              <img 
                                src={record.employee.imageUrl} 
                                alt={record.employee.fullName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-background0/30 rounded-full flex items-center justify-center text-xs">
                                {record.employee?.fullName?.charAt(0) || '?'}
                              </div>
                            )}
                            <span className="text-white">{record.employee?.fullName || 'موظف غير معروف'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400">{record.employee?.jobTitle || 'موظف'}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{record.branch?.nameAr || record.branch?.name || '-'}</td>
                        <td className="py-3 px-4 text-green-400">{formatTime(record.checkInTime)}</td>
                        <td className="py-3 px-4 text-accent">{formatTime(record.checkOutTime)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {record.isLate === 1 && (
                              <Badge variant="destructive" className="text-xs">
                                تأخير {record.lateMinutes}د
                              </Badge>
                            )}
                            <Badge
                              className={
                                record.status === 'checked_out'
                                  ? 'bg-green-500/20 text-green-400'
                                  : record.status === 'checked_in'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }
                            >
                              {record.status === 'checked_out' ? 'انصرف' : 'حاضر'}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={`text-xs ${
                              record.isAtBranch === 1
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {record.isAtBranch === 1 ? 'في الفرع' : `${Math.round(record.distanceFromBranch || 0)}م`}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {record.checkInPhoto && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPhoto(record.checkInPhoto)}
                                className="text-accent p-0 h-auto text-xs"
                                data-testid={`button-view-checkin-photo-${record.id}`}
                              >
                                <Camera className="w-3 h-3" />
                              </Button>
                            )}
                            {record.checkOutPhoto && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPhoto(record.checkOutPhoto!)}
                                className="text-accent p-0 h-auto text-xs"
                                data-testid={`button-view-checkout-photo-${record.id}`}
                              >
                                <Camera className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="bg-[#1a1410] rounded-lg p-4 border border-primary/10"
                    data-testid={`attendance-record-${record.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {record.employee?.imageUrl ? (
                          <img 
                            src={record.employee.imageUrl} 
                            alt={record.employee.fullName}
                            className="w-12 h-12 rounded-full object-cover border-2 border-primary/50"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {record.employee?.fullName?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-white font-bold">
                            {record.employee?.fullName || 'موظف غير معروف'}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            {record.employee?.jobTitle || 'موظف'}
                          </p>
                          {(record.branch?.nameAr || record.branch?.name) && (
                            <p className="text-accent/70 text-xs flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {record.branch.nameAr || record.branch.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          {record.isLate === 1 && (
                            <Badge variant="destructive" className="text-xs">
                              تأخير {record.lateMinutes} د
                            </Badge>
                          )}
                          <Badge
                            className={
                              record.status === 'checked_out'
                                ? 'bg-green-500/20 text-green-400'
                                : record.status === 'checked_in'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }
                          >
                            {record.status === 'checked_out' ? 'انصرف' : 'حاضر'}
                          </Badge>
                        </div>
                        {record.isAtBranch !== undefined && (
                          <Badge
                            className={
                              record.isAtBranch === 1
                                ? 'bg-green-500/20 text-green-400 text-xs'
                                : 'bg-red-500/20 text-red-400 text-xs'
                            }
                          >
                            <MapPin className="w-3 h-3 ml-1" />
                            {record.isAtBranch === 1 ? 'في الفرع' : `خارج الفرع (${Math.round(record.distanceFromBranch || 0)}م)`}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">وقت الحضور</p>
                        <p className="text-green-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(record.checkInTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">موقع الحضور</p>
                        {record.isAtBranch !== undefined ? (
                          <p className={`font-medium flex items-center gap-1 ${record.isAtBranch === 1 ? 'text-green-400' : 'text-red-400'}`}>
                            {record.isAtBranch === 1 ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                في الفرع
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                بعيد ({Math.round(record.distanceFromBranch || 0)}م)
                              </>
                            )}
                          </p>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">صورة الحضور</p>
                        {record.checkInPhoto ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPhoto(record.checkInPhoto)}
                            className="text-accent p-0 h-auto"
                            data-testid={`button-view-checkin-photo-${record.id}`}
                          >
                            <Camera className="w-3 h-3 ml-1" />
                            عرض
                          </Button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">وقت الانصراف</p>
                        <p className="text-accent font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(record.checkOutTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">موقع الانصراف</p>
                        {record.checkOutTime && record.checkOutIsAtBranch !== undefined ? (
                          <p className={`font-medium flex items-center gap-1 ${record.checkOutIsAtBranch === 1 ? 'text-green-400' : 'text-red-400'}`}>
                            {record.checkOutIsAtBranch === 1 ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                في الفرع
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                بعيد ({Math.round(record.checkOutDistanceFromBranch || 0)}م)
                              </>
                            )}
                          </p>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">صورة الانصراف</p>
                        {record.checkOutPhoto ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPhoto(record.checkOutPhoto!)}
                            className="text-accent p-0 h-auto"
                            data-testid={`button-view-checkout-photo-${record.id}`}
                          >
                            <Camera className="w-3 h-3 ml-1" />
                            عرض
                          </Button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPhoto && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="max-w-lg w-full">
              <img
                src={selectedPhoto}
                alt="صورة الحضور"
                className="w-full rounded-lg"
              />
              <Button
                variant="outline"
                onClick={() => setSelectedPhoto(null)}
                className="w-full mt-4 border-primary/50 text-accent"
                data-testid="button-close-photo"
              >
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

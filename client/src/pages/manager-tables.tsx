import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table as TableIcon, Plus, Trash2, Download, QrCode, Power, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableQRCard, downloadQRCard } from "@/components/table-qr-card";

interface ITable {
  id: string;
  tableNumber: string;
  qrToken: string;
  branchId?: string;
  isActive: number;
  isOccupied: number;
  currentOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IBranch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address: string;
  city: string;
  isActive: number;
  managerName?: string;
}

export default function ManagerTables() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [bulkCount, setBulkCount] = useState("10");
  const [selectedBranch, setSelectedBranch] = useState<string>("none");
  const [selectedTable, setSelectedTable] = useState<ITable | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [currentBranchName, setCurrentBranchName] = useState<string>("");
  const [currentBranchManager, setCurrentBranchManager] = useState<string>("");
  const [userBranchId, setUserBranchId] = useState<string>("");
  const qrCardRef = useRef<HTMLCanvasElement>(null);

  // Get current user's branch from localStorage
  useEffect(() => {
    const employeeData = localStorage.getItem("currentEmployee");
    if (employeeData) {
      const employee = JSON.parse(employeeData);
      setUserBranchId(employee.branchId || "");
    }
  }, []);

  // Fetch branches
  const { data: branches } = useQuery<IBranch[]>({
    queryKey: ["/api/branches"],
  });

  // Auto-select branch if user has a branchId or there's only one branch
  useEffect(() => {
    if (branches && branches.length > 0 && selectedBranch === "none") {
      if (userBranchId) {
        const userBranch = branches.find(b => b.id === userBranchId);
        if (userBranch) {
          setSelectedBranch(userBranch.id);
        }
      } else if (branches.length === 1) {
        setSelectedBranch(branches[0].id);
      }
    }
  }, [branches, userBranchId, selectedBranch]);

  // Update branch manager info when selectedBranch changes
  useEffect(() => {
    if (selectedBranch !== "none" && selectedBranch && branches) {
      const branch = branches.find(b => b.id === selectedBranch);
      if (branch) {
        setCurrentBranchName(branch.nameAr);
        setCurrentBranchManager(branch.managerName || "غير محدد");
      }
    }
  }, [selectedBranch, branches]);

  // Fetch tables - filter by selected branch
  const { data: tables = [], isLoading, refetch } = useQuery<ITable[]>({
    queryKey: ["/api/tables", selectedBranch],
    queryFn: async () => {
      let url = "/api/tables";
      if (selectedBranch && selectedBranch !== "none") {
        url += `?branchId=${selectedBranch}`;
      }
      
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      const tenantId = employee?.tenantId || 'demo-tenant';

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': tenantId,
          'Cache-Control': 'no-cache'
        },
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tables (${response.status})`);
      }
      
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Create single table mutation
  const createTableMutation = useMutation({
    mutationFn: async (tableNumber: string) => {
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      const tenantId = employee?.tenantId || 'demo-tenant';

      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({ tableNumber, branchId: selectedBranch }),
      });
      if (!response.ok) throw new Error("Failed to create table");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "تم إنشاء الطاولة",
        description: "تم إنشاء الطاولة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل إنشاء الطاولة",
        variant: "destructive",
      });
    },
  });

  // Bulk create tables mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async ({ count, branchId }: { count: number; branchId: string }) => {
      console.log("Bulk creating tables:", { count, branchId });
      
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      const tenantId = employee?.tenantId || 'demo-tenant';

      const response = await fetch("/api/tables/bulk-create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({ count, branchId }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("Bulk create error response:", error);
        throw new Error(error.error || "Failed to bulk create tables");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      console.log("Bulk create success data:", data);
      
      // Invalidate the queries to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      
      const createdCount = data.details?.created?.length || data.results?.created?.length || 0;
      toast({
        title: "تم إنشاء الطاولات",
        description: `تم إنشاء ${createdCount} طاولة بنجاح`,
      });
      setBulkCount("10");
      
      // Explicitly refetch the tables for the current branch to be sure
      refetch();
    },
    onError: (error: Error) => {
      console.error("Bulk create mutation error:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل إنشاء الطاولات",
        variant: "destructive",
      });
    },
  });

  // Toggle table active status mutation
  const toggleActiveStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}/toggle-active`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": "demo-tenant"
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle table status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "تم تحديث الحالة",
        description: "تم تحديث حالة الطاولة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل تحديث حالة الطاولة",
        variant: "destructive",
      });
    },
  });

  // Empty table mutation
  const emptyTableMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}/empty`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": "demo-tenant"
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to empty table");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "تم إفراغ الطاولة",
        description: "الطاولة الآن متاحة للزبائن الجدد",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل إفراغ الطاولة",
        variant: "destructive",
      });
    },
  });

  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}`, {
        method: "DELETE",
        headers: {
          "x-tenant-id": "demo-tenant"
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete table");
      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "تم حذف الطاولة",
        description: "تم حذف الطاولة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل حذف الطاولة",
        variant: "destructive",
      });
    },
  });

  // Get QR code for table
  const getQRCodeMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/qr-code`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get QR code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("QR Code loaded:", data);
      setQrCodeData(data);
      setQrDialogOpen(true);
    },
    onError: (error: Error) => {
      console.error("QR Code error:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل تحميل رمز QR",
        variant: "destructive",
      });
    },
  });

  const handleBulkCreate = () => {
    const count = parseInt(bulkCount);
    if (isNaN(count) || count < 1 || count > 100) {
      toast({
        title: "خطأ",
        description: "يجب أن يكون العدد بين 1 و 100",
        variant: "destructive",
      });
      return;
    }
    if (!selectedBranch || selectedBranch === "none") {
      toast({
        title: "خطأ",
        description: "يجب اختيار الفرع أولاً",
        variant: "destructive",
      });
      return;
    }
    bulkCreateMutation.mutate({ count, branchId: selectedBranch });
  };

  const handleViewQR = (table: ITable) => {
    setSelectedTable(table);
    getQRCodeMutation.mutate(table.id);
  };

  const handleDownloadQRCode = () => {
    if (!selectedTable || !qrCardRef.current) return;
    downloadQRCard(qrCardRef.current, selectedTable.tableNumber);
  };

  const deleteAllTablesMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const response = await fetch(`/api/tables/branch/${branchId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete all tables");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "تم الحذف",
        description: data.message || "تم حذف جميع الطاولات بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل حذف جميع الطاولات",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAll = () => {
    if (!selectedBranch || selectedBranch === "none") return;
    if (window.confirm("هل أنت متأكد من رغبتك في حذف جميع طاولات هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.")) {
      deleteAllTablesMutation.mutate(selectedBranch);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-[#f0ecd8]" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TableIcon className="w-8 h-8" />
              إدارة الطاولات
            </h1>
            <p className="text-muted-foreground">إدارة طاولات المقهى وإنشاء رموز QR</p>
          </div>
          <Button variant="outline" className="bg-[#944219]" onClick={() => setLocation("/manager/dashboard")}>
            العودة للوحة التحكم
          </Button>
        </div>

        {/* Bulk Create Section */}
        <Card>
          <CardHeader>
            <CardTitle>إنشاء طاولات جديدة</CardTitle>
            <CardDescription>أنشئ طاولات متعددة دفعة واحدة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="branch">اختر الفرع</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="bulkCount">عدد الطاولات</Label>
                <Input
                  id="bulkCount"
                  type="number"
                  min="1"
                  max="100"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(e.target.value)}
                  placeholder="مثال: 10"
                  data-testid="input-bulk-count"
                />
              </div>
              <Button
                onClick={handleBulkCreate}
                disabled={bulkCreateMutation.isPending || !selectedBranch}
                data-testid="button-bulk-create"
              >
                <Plus className="w-4 h-4 ml-2" />
                إنشاء الطاولات
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAll}
                disabled={deleteAllTablesMutation.isPending || !selectedBranch || tables.length === 0}
                data-testid="button-delete-all-tables"
              >
                <Trash2 className="w-4 h-4 ml-2" />
                حذف الكل
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tables List */}
        <Card>
          <CardHeader>
            <CardTitle>الطاولات الحالية ({tables?.length || 0})</CardTitle>
            <CardDescription>
              {selectedBranch 
                ? `طاولات الفرع المختار` 
                : "اختر فرعاً لعرض الطاولات"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : !tables || tables.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                {selectedBranch && userBranchId && selectedBranch !== userBranchId ? (
                  <div className="text-muted-foreground">
                    <div className="text-lg font-semibold text-red-600 mb-2">
                      ⛔ أنت لست مدير هذا الفرع
                    </div>
                    <div className="space-y-1">
                      <p><span className="font-semibold">الفرع:</span> {currentBranchName}</p>
                      <p><span className="font-semibold">مدير الفرع:</span> {currentBranchManager}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    لا توجد طاولات. أنشئ طاولات جديدة للبدء.
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الطاولة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">حالة الإشغال</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => (
                    <TableRow key={table.id}>
                      <TableCell className="font-medium">
                        طاولة {table.tableNumber}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={table.isActive ? "default" : "outline"}
                          onClick={() => toggleActiveStatusMutation.mutate(table.id)}
                          disabled={toggleActiveStatusMutation.isPending}
                          className="w-full justify-center"
                          data-testid={`button-toggle-active-${table.tableNumber}`}
                        >
                          <Power className="w-3 h-3 ml-1" />
                          {table.isActive ? "نشطة" : "غير نشطة"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${table.isOccupied ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          {table.isOccupied ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="bg-red-600 hover:bg-red-700">محجوزة</Badge>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 px-2 text-xs"
                                onClick={() => emptyTableMutation.mutate(table.id)}
                                disabled={emptyTableMutation.isPending}
                              >
                                إفراغ
                              </Button>
                            </div>
                          ) : (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">متاحة</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewQR(table)}
                            data-testid={`button-qr-${table.tableNumber}`}
                          >
                            <QrCode className="w-4 h-4 ml-1" />
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const newNum = window.prompt("أدخل رقم الطاولة الجديد:", table.tableNumber);
                              if (newNum && newNum !== table.tableNumber) {
                                apiRequest("PATCH", `/api/tables/${table.id}`, { tableNumber: newNum })
                                  .then(() => {
                                    queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
                                    toast({ title: "تم التحديث", description: "تم تغيير رقم الطاولة بنجاح" });
                                  })
                                  .catch((error) => {
                                    toast({ 
                                      title: "خطأ", 
                                      description: "فشل تحديث الطاولة", 
                                      variant: "destructive" 
                                    });
                                  });
                              }
                            }}
                            data-testid={`button-edit-${table.tableNumber}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من حذف الطاولة ${table.tableNumber}؟`)) {
                                deleteTableMutation.mutate(table.id);
                              }
                            }}
                            disabled={deleteTableMutation.isPending || table.isOccupied === 1}
                            title={table.isOccupied === 1 ? "لا يمكن حذف طاولة مشغولة" : "حذف الطاولة"}
                            data-testid={`button-delete-${table.tableNumber}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#fefffe]" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                بطاقة QR للطاولة {selectedTable?.tableNumber}
              </DialogTitle>
              <DialogDescription>
                اطبع أو احفظ هذه البطاقة لوضعها على الطاولة
              </DialogDescription>
            </DialogHeader>
            {qrCodeData && selectedTable && (
              <div className="space-y-4">
                <TableQRCard
                  tableNumber={selectedTable.tableNumber}
                  qrToken={qrCodeData.qrToken}
                  branchName={qrCodeData.branchName}
                  tableUrl={qrCodeData.tableUrl}
                />
                <div className="space-y-2">
                  <p className="text-xs text-center text-muted-foreground break-all">
                    {qrCodeData.tableUrl}
                  </p>
                </div>
                <Button
                  onClick={handleDownloadQRCode}
                  className="w-full"
                  data-testid="button-download-qr"
                >
                  <Download className="w-4 h-4 ml-2" />
                  تحميل البطاقة
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Plus, 
  FileText,
  Search,
  Eye,
  Package,
  Loader2,
  Trash2,
  CreditCard,
  Receipt,
  Clock,
  AlertCircle,
  DollarSign,
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  branchId: string;
  status: string;
  items: Array<{
    rawItemId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    notes?: string;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: string;
  paidAmount: number;
  invoiceDate: string;
  dueDate?: string;
  createdAt: string;
}

interface RawItem {
  id: string;
  code: string;
  nameAr: string;
  unit: string;
  unitCost: number;
}

interface Supplier {
  id: string;
  code: string;
  nameAr: string;
}

interface Branch {
  id?: string;
  nameAr: string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "مسودة", variant: "secondary" },
  pending: { label: "قيد الانتظار", variant: "outline" },
  approved: { label: "معتمدة", variant: "default" },
  received: { label: "تم الاستلام", variant: "default" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

const paymentStatusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  unpaid: { label: "غير مدفوعة", variant: "destructive" },
  partial: { label: "مدفوعة جزئياً", variant: "secondary" },
  paid: { label: "مدفوعة", variant: "default" },
};

export default function InventoryPurchasesPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const [formData, setFormData] = useState({
    supplierId: "",
    branchId: "",
    items: [] as Array<{ rawItemId: string; quantity: number; unitCost: number; totalCost: number }>,
    taxAmount: 0,
    discountAmount: 0,
    notes: "",
    dueDate: "",
  });

  const [newItem, setNewItem] = useState({
    rawItemId: "",
    quantity: 1,
    unitCost: 0,
  });

  const { data: invoices = [], isLoading } = useQuery<PurchaseInvoice[]>({
    queryKey: ["/api/inventory/purchases"],
  });

  const { data: rawItems = [] } = useQuery<RawItem[]>({
    queryKey: ["/api/inventory/raw-items"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/inventory/suppliers"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inventory/purchases", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/purchases"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء فاتورة الشراء بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إنشاء فاتورة الشراء", variant: "destructive" });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inventory/purchases/${id}/receive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/journal-entries"] });
      toast({ title: "تم استلام الفاتورة وتحديث المخزون والقيود المحاسبية" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في استلام الفاتورة", variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { id: string; amount: number }) => 
      apiRequest("PUT", `/api/inventory/purchases/${data.id}/payment`, { amount: data.amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/purchases"] });
      setIsPaymentDialogOpen(false);
      setPaymentAmount(0);
      toast({ title: "تم تسجيل الدفعة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في تسجيل الدفعة", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inventory/purchases/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/purchases"] });
      toast({ title: "تم اعتماد الفاتورة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في اعتماد الفاتورة", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      supplierId: "",
      branchId: "",
      items: [],
      taxAmount: 0,
      discountAmount: 0,
      notes: "",
      dueDate: "",
    });
    setNewItem({ rawItemId: "", quantity: 1, unitCost: 0 });
  };

  const addItemToInvoice = () => {
    if (!newItem.rawItemId || newItem.quantity <= 0) return;

    const rawItem = rawItems.find(r => r.id === newItem.rawItemId);
    const unitCost = newItem.unitCost || rawItem?.unitCost || 0;
    const totalCost = newItem.quantity * unitCost;

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          rawItemId: newItem.rawItemId,
          quantity: newItem.quantity,
          unitCost,
          totalCost,
        },
      ],
    });

    setNewItem({ rawItemId: "", quantity: 1, unitCost: 0 });
  };

  const removeItemFromInvoice = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.totalCost, 0);
    const totalAmount = subtotal + formData.taxAmount - formData.discountAmount;
    return { subtotal, totalAmount };
  };

  const handleSubmit = () => {
    if (!formData.supplierId || !formData.branchId || formData.items.length === 0) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }

    const { subtotal, totalAmount } = calculateTotals();
    createMutation.mutate({
      ...formData,
      subtotal: Number(subtotal) || 0,
      taxAmount: Number(formData.taxAmount) || 0,
      discountAmount: Number(formData.discountAmount) || 0,
      totalAmount: Number(totalAmount) || 0,
    });
  };

  const handleView = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handlePayment = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.totalAmount - invoice.paidAmount);
    setIsPaymentDialogOpen(true);
  };

  const submitPayment = () => {
    if (selectedInvoice && paymentAmount > 0) {
      paymentMutation.mutate({ id: selectedInvoice.id, amount: paymentAmount });
    }
  };

  const statistics = {
    totalPurchases: invoices.length,
    totalValue: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    pendingPayment: invoices.filter(inv => inv.paymentStatus !== 'paid').reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
    receivedCount: invoices.filter(inv => inv.status === 'received').length,
    pendingReceive: invoices.filter(inv => inv.status === 'approved').length,
    overdueCount: invoices.filter(inv => 
      inv.dueDate && new Date(inv.dueDate) < new Date() && inv.paymentStatus !== 'paid'
    ).length,
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getRawItemName = (id: string) => rawItems.find(r => r.id === id)?.nameAr || id;
  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.nameAr || id;
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.nameAr || id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">فواتير الشراء</h1>
            <p className="text-muted-foreground text-sm">إدارة فواتير شراء المواد الخام</p>
          </div>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-purchase">
          <Plus className="h-4 w-4 ml-2" />
          إنشاء فاتورة
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المشتريات</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalValue.toFixed(2)} <SarIcon /></div>
            <p className="text-xs text-muted-foreground">{statistics.totalPurchases} فاتورة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المستحقات</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{statistics.pendingPayment.toFixed(2)} <SarIcon /></div>
            <p className="text-xs text-muted-foreground">مبالغ غير مسددة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">في انتظار الاستلام</CardTitle>
            <Package className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statistics.pendingReceive}</div>
            <p className="text-xs text-muted-foreground">فاتورة معتمدة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متأخرة السداد</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statistics.overdueCount}</div>
            <p className="text-xs text-muted-foreground">فاتورة متأخرة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الفاتورة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-purchases"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                {Object.entries(statusLabels).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">المورد</TableHead>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">حالة الدفع</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      لا توجد فواتير شراء
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`row-purchase-${invoice.id}`}>
                      <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{getSupplierName(invoice.supplierId)}</TableCell>
                      <TableCell>{getBranchName(invoice.branchId)}</TableCell>
                      <TableCell>{invoice.totalAmount.toFixed(2)} <SarIcon /></TableCell>
                      <TableCell>
                        <Badge variant={statusLabels[invoice.status]?.variant || "secondary"}>
                          {statusLabels[invoice.status]?.label || invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusLabels[invoice.paymentStatus]?.variant || "secondary"}>
                          {paymentStatusLabels[invoice.paymentStatus]?.label || invoice.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoiceDate), "dd/MM/yyyy", { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleView(invoice)}
                            data-testid={`button-view-${invoice.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status === "draft" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => approveMutation.mutate(invoice.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${invoice.id}`}
                              title="اعتماد الفاتورة"
                            >
                              <FileText className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {invoice.status === "approved" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => receiveMutation.mutate(invoice.id)}
                              disabled={receiveMutation.isPending}
                              data-testid={`button-receive-${invoice.id}`}
                              title="استلام البضاعة"
                            >
                              <Package className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {invoice.paymentStatus !== "paid" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handlePayment(invoice)}
                              data-testid={`button-payment-${invoice.id}`}
                              title="تسجيل دفعة"
                            >
                              <CreditCard className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء فاتورة شراء جديدة</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المورد *</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                >
                  <SelectTrigger data-testid="select-supplier">
                    <SelectValue placeholder="اختر المورد" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الفرع *</Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                >
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id as string}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">المواد</h3>
              
              <div className="grid grid-cols-4 gap-2">
                <Select
                  value={newItem.rawItemId}
                  onValueChange={(value) => {
                    const item = rawItems.find(r => r.id === value);
                    setNewItem({
                      ...newItem,
                      rawItemId: value,
                      unitCost: item?.unitCost || 0,
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-raw-item">
                    <SelectValue placeholder="اختر المادة" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  placeholder="الكمية"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  data-testid="input-quantity"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="سعر الوحدة"
                  value={newItem.unitCost}
                  onChange={(e) => setNewItem({ ...newItem, unitCost: parseFloat(e.target.value) || 0 })}
                  data-testid="input-unit-cost"
                />
                <Button onClick={addItemToInvoice} data-testid="button-add-item">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {formData.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">المادة</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">سعر الوحدة</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{getRawItemName(item.rawItemId)}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unitCost.toFixed(2)} <SarIcon /></TableCell>
                          <TableCell>{item.totalCost.toFixed(2)} <SarIcon /></TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeItemFromInvoice(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الضريبة (<SarIcon />)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxAmount}
                  onChange={(e) => setFormData({ ...formData, taxAmount: parseFloat(e.target.value) || 0 })}
                  data-testid="input-tax"
                />
              </div>
              <div className="space-y-2">
                <Label>الخصم (<SarIcon />)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountAmount}
                  onChange={(e) => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
                  data-testid="input-discount"
                />
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span>{calculateTotals().subtotal.toFixed(2)} <SarIcon /></span>
              </div>
              <div className="flex justify-between">
                <span>الضريبة:</span>
                <span>{formData.taxAmount.toFixed(2)} <SarIcon /></span>
              </div>
              <div className="flex justify-between">
                <span>الخصم:</span>
                <span>-{formData.discountAmount.toFixed(2)} <SarIcon /></span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>الإجمالي:</span>
                <span>{calculateTotals().totalAmount.toFixed(2)} <SarIcon /></span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formData.supplierId || !formData.branchId || formData.items.length === 0}
              data-testid="button-submit"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              إنشاء الفاتورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الفاتورة</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">رقم الفاتورة</Label>
                  <p className="font-mono font-medium">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">التاريخ</Label>
                  <p>{format(new Date(selectedInvoice.invoiceDate), "dd/MM/yyyy", { locale: ar })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">المورد</Label>
                  <p>{getSupplierName(selectedInvoice.supplierId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">الفرع</Label>
                  <p>{getBranchName(selectedInvoice.branchId)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">المادة</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">سعر الوحدة</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{getRawItemName(item.rawItemId)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unitCost.toFixed(2)} <SarIcon /></TableCell>
                        <TableCell>{item.totalCost.toFixed(2)} <SarIcon /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{selectedInvoice.subtotal.toFixed(2)} <SarIcon /></span>
                </div>
                <div className="flex justify-between">
                  <span>الضريبة:</span>
                  <span>{selectedInvoice.taxAmount.toFixed(2)} <SarIcon /></span>
                </div>
                <div className="flex justify-between">
                  <span>الخصم:</span>
                  <span>-{selectedInvoice.discountAmount.toFixed(2)} <SarIcon /></span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2 mt-2">
                  <span>الإجمالي:</span>
                  <span>{selectedInvoice.totalAmount.toFixed(2)} <SarIcon /></span>
                </div>
              </div>

              <div className="flex gap-4">
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <Badge variant={statusLabels[selectedInvoice.status]?.variant || "secondary"}>
                    {statusLabels[selectedInvoice.status]?.label || selectedInvoice.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">حالة الدفع</Label>
                  <Badge variant={paymentStatusLabels[selectedInvoice.paymentStatus]?.variant || "secondary"}>
                    {paymentStatusLabels[selectedInvoice.paymentStatus]?.label || selectedInvoice.paymentStatus}
                  </Badge>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm font-medium">المدفوع</span>
                  <span className="text-sm">{selectedInvoice.paidAmount.toFixed(2)} من {selectedInvoice.totalAmount.toFixed(2)} <SarIcon /></span>
                </div>
                <Progress 
                  value={(selectedInvoice.paidAmount / selectedInvoice.totalAmount) * 100} 
                  className="h-2"
                />
                <div className="flex justify-between items-center gap-2 text-sm text-muted-foreground">
                  <span>المتبقي: {(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toFixed(2)} <SarIcon /></span>
                  <span>{Math.round((selectedInvoice.paidAmount / selectedInvoice.totalAmount) * 100)}% مدفوع</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>إغلاق</Button>
            {selectedInvoice && selectedInvoice.paymentStatus !== "paid" && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                handlePayment(selectedInvoice);
              }}>
                <CreditCard className="h-4 w-4 ml-2" />
                تسجيل دفعة
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              تسجيل دفعة
            </DialogTitle>
            <DialogDescription>
              تسجيل دفعة جديدة للفاتورة {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">إجمالي الفاتورة:</span>
                  <span className="font-medium">{selectedInvoice.totalAmount.toFixed(2)} <SarIcon /></span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">المدفوع سابقاً:</span>
                  <span className="font-medium">{selectedInvoice.paidAmount.toFixed(2)} <SarIcon /></span>
                </div>
                <div className="flex justify-between gap-2 border-t pt-2">
                  <span className="font-medium">المتبقي:</span>
                  <span className="font-bold text-destructive">{(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toFixed(2)} <SarIcon /></span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-amount">مبلغ الدفعة *</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  max={selectedInvoice.totalAmount - selectedInvoice.paidAmount}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  data-testid="input-payment-amount"
                />
                <p className="text-xs text-muted-foreground">
                  الحد الأقصى: {(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toFixed(2)} <SarIcon />
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount((selectedInvoice.totalAmount - selectedInvoice.paidAmount) / 2)}
                >
                  نصف المتبقي
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount(selectedInvoice.totalAmount - selectedInvoice.paidAmount)}
                >
                  كامل المتبقي
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={submitPayment}
              disabled={paymentMutation.isPending || paymentAmount <= 0 || (selectedInvoice ? paymentAmount > (selectedInvoice.totalAmount - selectedInvoice.paidAmount) : false)}
              data-testid="button-submit-payment"
            >
              {paymentMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

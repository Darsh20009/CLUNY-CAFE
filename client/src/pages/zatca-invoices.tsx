import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileText, 
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  ArrowLeft,
  Loader2,
  Download,
  Eye,
  Send,
  RefreshCw,
  QrCode,
  Building2,
  AlertTriangle,
  Settings,
  FileCheck,
  Shield,
  Stamp,
  Printer,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import QRCode from "qrcode";
import SarIcon from "@/components/sar-icon";

interface TaxInvoice {
  id?: string;
  _id?: string;
  invoiceNumber: string;
  invoiceType: 'standard' | 'simplified' | 'debit_note' | 'credit_note';
  transactionType: 'B2B' | 'B2C';
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerVatNumber?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: string;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'cancelled';
  zatcaSubmissionId?: string;
  zatcaQRCode?: string;
  zatcaHash?: string;
  createdAt: string;
  submittedAt?: string;
}

interface InvoiceItem {
  itemId: string;
  nameAr: string;
  nameEn?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

interface ZATCASettings {
  sellerName: string;
  sellerNameEn: string;
  vatNumber: string;
  crNumber: string;
  address: string;
  city: string;
  postalCode: string;
  buildingNumber: string;
  district: string;
  isConfigured: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد الانتظار", color: "bg-background0", icon: Clock },
  submitted: { label: "تم الإرسال", color: "bg-blue-500", icon: Send },
  accepted: { label: "مقبولة", color: "bg-green-500", icon: CheckCircle },
  rejected: { label: "مرفوضة", color: "bg-red-500", icon: XCircle },
  cancelled: { label: "ملغاة", color: "bg-gray-500", icon: XCircle },
};

const invoiceTypeLabels: Record<string, string> = {
  standard: "فاتورة ضريبية",
  simplified: "فاتورة مبسطة",
  debit_note: "إشعار مدين",
  credit_note: "إشعار دائن",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "نقدي",
  pos: "بطاقة",
  bank_transfer: "تحويل بنكي",
  mada: "مدى",
  stc_pay: "STC Pay",
  apple_pay: "Apple Pay",
};

export default function ZATCAInvoicesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoice | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { data: invoices = [], isLoading: isInvoicesLoading, refetch } = useQuery<TaxInvoice[]>({
    queryKey: ["/api/zatca/invoices"],
  });

  const { data: settings } = useQuery<ZATCASettings>({
    queryKey: ["/api/zatca/settings"],
  });

  const submitInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("POST", `/api/zatca/submit/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zatca/invoices"] });
      toast({ title: "تم إرسال الفاتورة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل إرسال الفاتورة", variant: "destructive" });
    },
  });

  const generateQRCodeImage = async (data: string) => {
    try {
      const url = await QRCode.toDataURL(data, { width: 200 });
      setQrCodeImage(url);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  const handleViewInvoice = async (invoice: TaxInvoice) => {
    setSelectedInvoice(invoice);
    if (invoice.zatcaQRCode) {
      await generateQRCodeImage(invoice.zatcaQRCode);
    }
    setIsViewDialogOpen(true);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customerName.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesType = typeFilter === "all" || invoice.invoiceType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const acceptedCount = invoices.filter(i => i.status === 'accepted').length;
  const rejectedCount = invoices.filter(i => i.status === 'rejected').length;
  const totalVat = invoices.filter(i => i.status === 'accepted').reduce((sum, i) => sum + i.vatAmount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-primary/5 to-yellow-50 dark:from-background dark:via-primary/5 dark:to-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/manager/accounting")}
            className="text-accent dark:text-accent"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-accent dark:text-accent flex items-center gap-2">
            <Receipt className="w-8 h-8" />
            الفوترة الإلكترونية - ZATCA
          </h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {(!settings?.isConfigured) && (
          <Card className="mb-6 border-primary bg-background dark:bg-primary/20">
            <CardContent className="flex items-center gap-4 p-4">
              <AlertTriangle className="w-8 h-8 text-accent" />
              <div>
                <p className="font-medium text-accent dark:text-accent">لم يتم تكوين إعدادات ZATCA</p>
                <p className="text-sm text-accent">يرجى إعداد بيانات المنشأة والرقم الضريبي قبل إرسال الفواتير</p>
              </div>
              <Button onClick={() => setIsSettingsOpen(true)} className="mr-auto bg-primary hover:bg-primary">
                إعداد الآن
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-accent text-sm">قيد الانتظار</p>
                  <p className="text-3xl font-bold mt-1">{pendingCount}</p>
                  <p className="text-accent text-xs mt-1">فاتورة</p>
                </div>
                <Clock className="w-12 h-12 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">مقبولة</p>
                  <p className="text-3xl font-bold mt-1">{acceptedCount}</p>
                  <p className="text-green-200 text-xs mt-1">فاتورة</p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">مرفوضة</p>
                  <p className="text-3xl font-bold mt-1">{rejectedCount}</p>
                  <p className="text-red-200 text-xs mt-1">فاتورة</p>
                </div>
                <XCircle className="w-12 h-12 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">إجمالي الضريبة</p>
                  <p className="text-3xl font-bold mt-1">{totalVat.toFixed(2)}</p>
                  <p className="text-blue-200 text-xs mt-1">ريال سعودي</p>
                </div>
                <Receipt className="w-12 h-12 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-primary dark:bg-primary/30">
            <TabsTrigger value="invoices" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              الفواتير
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              الامتثال
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1">
              <FileCheck className="w-4 h-4" />
              التقارير
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="بحث برقم الفاتورة أو الطلب..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="submitted">تم الإرسال</SelectItem>
                  <SelectItem value="accepted">مقبولة</SelectItem>
                  <SelectItem value="rejected">مرفوضة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="نوع الفاتورة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="standard">فاتورة ضريبية</SelectItem>
                  <SelectItem value="simplified">فاتورة مبسطة</SelectItem>
                  <SelectItem value="debit_note">إشعار مدين</SelectItem>
                  <SelectItem value="credit_note">إشعار دائن</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                {isInvoicesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">رقم الفاتورة</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">الضريبة</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => {
                        const StatusIcon = statusConfig[invoice.status]?.icon || Clock;
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {invoiceTypeLabels[invoice.invoiceType]}
                              </Badge>
                            </TableCell>
                            <TableCell>{invoice.customerName}</TableCell>
                            <TableCell className="font-medium">{invoice.totalAmount.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell className="text-accent">{invoice.vatAmount.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(invoice.createdAt), "dd/MM/yyyy", { locale: ar })}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusConfig[invoice.status]?.color} text-white`}>
                                <StatusIcon className="w-3 h-3 ml-1" />
                                {statusConfig[invoice.status]?.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleViewInvoice(invoice)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {invoice.status === 'pending' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-green-600"
                                    onClick={() => submitInvoiceMutation.mutate(invoice.id || '')}
                                    disabled={submitInvoiceMutation.isPending}
                                  >
                                    <Send className="w-4 h-4" />
                                  </Button>
                                )}
                                {invoice.status === 'accepted' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Printer className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredInvoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            لا توجد فواتير
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-accent" />
                    بيانات المنشأة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-sm">اسم المنشأة</Label>
                      <p className="font-medium">{settings?.sellerName || 'غير محدد'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">الرقم الضريبي</Label>
                      <p className="font-mono font-medium">{settings?.vatNumber || 'غير محدد'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">رقم السجل التجاري</Label>
                      <p className="font-mono">{settings?.crNumber || 'غير محدد'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">المدينة</Label>
                      <p>{settings?.city || 'غير محدد'}</p>
                    </div>
                  </div>
                  <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="w-full">
                    تعديل البيانات
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    حالة الامتثال
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span>توليد رمز QR</span>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700">متوافق</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span>حساب الضريبة</span>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700">15% VAT</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span>تنسيق TLV</span>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700">متوافق</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {settings?.vatNumber ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-accent" />
                        )}
                        <span>الرقم الضريبي</span>
                      </div>
                      <Badge variant="outline" className={settings?.vatNumber ? "bg-green-50 text-green-700" : "bg-background text-accent"}>
                        {settings?.vatNumber ? 'مسجل' : 'غير مسجل'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  متطلبات ZATCA Phase 2
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium mb-2">الفواتير الإلكترونية</h4>
                    <p className="text-sm text-muted-foreground">
                      جميع الفواتير تُنشأ بتنسيق إلكتروني متوافق مع متطلبات هيئة الزكاة
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="font-medium mb-2">رمز QR</h4>
                    <p className="text-sm text-muted-foreground">
                      كل فاتورة تحتوي على رمز QR يتضمن بيانات TLV المطلوبة
                    </p>
                  </div>
                  <div className="p-4 bg-background dark:bg-primary/20 rounded-lg">
                    <h4 className="font-medium mb-2">التكامل مع ZATCA</h4>
                    <p className="text-sm text-muted-foreground">
                      إرسال الفواتير تلقائياً لمنصة FATOORA للتحقق والاعتماد
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>تقرير الضريبة الشهري</CardTitle>
                  <CardDescription>ملخص ضريبة القيمة المضافة</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span>إجمالي المبيعات</span>
                      <span className="font-bold">{invoices.reduce((s, i) => s + i.subtotal, 0).toFixed(2)} <SarIcon /></span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span>إجمالي الخصومات</span>
                      <span className="font-bold text-red-600">-{invoices.reduce((s, i) => s + i.discountTotal, 0).toFixed(2)} <SarIcon /></span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span>المبلغ الخاضع للضريبة</span>
                      <span className="font-bold">{invoices.reduce((s, i) => s + i.taxableAmount, 0).toFixed(2)} <SarIcon /></span>
                    </div>
                    <div className="flex justify-between p-3 bg-background dark:bg-primary/20 rounded-lg border border-primary dark:border-primary">
                      <span className="font-medium">ضريبة القيمة المضافة (15%)</span>
                      <span className="font-bold text-accent">{invoices.reduce((s, i) => s + i.vatAmount, 0).toFixed(2)} <SarIcon /></span>
                    </div>
                    <div className="flex justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="font-medium">إجمالي المبالغ</span>
                      <span className="font-bold text-green-600">{invoices.reduce((s, i) => s + i.totalAmount, 0).toFixed(2)} <SarIcon /></span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>إحصائيات الفواتير</CardTitle>
                  <CardDescription>توزيع الفواتير حسب الحالة والنوع</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">حسب الحالة</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between p-2 bg-background dark:bg-primary/20 rounded">
                          <span className="text-sm">قيد الانتظار</span>
                          <Badge variant="outline">{pendingCount}</Badge>
                        </div>
                        <div className="flex justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <span className="text-sm">مقبولة</span>
                          <Badge variant="outline">{acceptedCount}</Badge>
                        </div>
                        <div className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <span className="text-sm">مرفوضة</span>
                          <Badge variant="outline">{rejectedCount}</Badge>
                        </div>
                        <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <span className="text-sm">تم الإرسال</span>
                          <Badge variant="outline">{invoices.filter(i => i.status === 'submitted').length}</Badge>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">حسب النوع</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">فاتورة ضريبية</span>
                          <Badge variant="outline">{invoices.filter(i => i.invoiceType === 'standard').length}</Badge>
                        </div>
                        <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">فاتورة مبسطة</span>
                          <Badge variant="outline">{invoices.filter(i => i.invoiceType === 'simplified').length}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>تصدير التقارير</CardTitle>
                  <CardDescription>تحميل تقارير الضريبة بصيغ مختلفة</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button variant="outline">
                    <Download className="w-4 h-4 ml-2" />
                    تقرير VAT (PDF)
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 ml-2" />
                    سجل الفواتير (Excel)
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 ml-2" />
                    ملف ZATCA (XML)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                تفاصيل الفاتورة - {selectedInvoice?.invoiceNumber}
              </DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">رقم الطلب</Label>
                    <p className="font-mono">{selectedInvoice.orderNumber}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">نوع الفاتورة</Label>
                    <p>{invoiceTypeLabels[selectedInvoice.invoiceType]}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">العميل</Label>
                    <p>{selectedInvoice.customerName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">طريقة الدفع</Label>
                    <p>{paymentMethodLabels[selectedInvoice.paymentMethod] || selectedInvoice.paymentMethod}</p>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">تفاصيل المنتجات</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">السعر</TableHead>
                        <TableHead className="text-right">الضريبة</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.nameAr}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell>{item.taxAmount.toFixed(2)}</TableCell>
                          <TableCell>{item.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">المجموع الفرعي</p>
                    <p className="font-medium">{selectedInvoice.subtotal.toFixed(2)} <SarIcon /></p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الخصم</p>
                    <p className="font-medium text-red-600">-{selectedInvoice.discountTotal.toFixed(2)} <SarIcon /></p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ضريبة القيمة المضافة</p>
                    <p className="font-medium text-accent">{selectedInvoice.vatAmount.toFixed(2)} <SarIcon /></p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الإجمالي</p>
                    <p className="text-xl font-bold text-green-600">{selectedInvoice.totalAmount.toFixed(2)} <SarIcon /></p>
                  </div>
                </div>

                {qrCodeImage && (
                  <div className="flex flex-col items-center p-4 bg-white rounded-lg">
                    <h4 className="font-medium mb-2">رمز QR - ZATCA</h4>
                    <img src={qrCodeImage} alt="ZATCA QR Code" className="w-32 h-32" />
                    <p className="text-xs text-muted-foreground mt-2">امسح للتحقق من صحة الفاتورة</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                إغلاق
              </Button>
              <Button className="bg-primary hover:bg-primary">
                <Printer className="w-4 h-4 ml-2" />
                طباعة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                إعدادات ZATCA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم المنشأة (عربي)</Label>
                  <Input defaultValue={settings?.sellerName} />
                </div>
                <div>
                  <Label>اسم المنشأة (إنجليزي)</Label>
                  <Input defaultValue={settings?.sellerNameEn} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الرقم الضريبي (VAT)</Label>
                  <Input defaultValue={settings?.vatNumber} placeholder="3XXXXXXXXXX0003" />
                </div>
                <div>
                  <Label>رقم السجل التجاري</Label>
                  <Input defaultValue={settings?.crNumber} />
                </div>
              </div>
              <div>
                <Label>العنوان</Label>
                <Input defaultValue={settings?.address} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>المدينة</Label>
                  <Input defaultValue={settings?.city} />
                </div>
                <div>
                  <Label>الرمز البريدي</Label>
                  <Input defaultValue={settings?.postalCode} />
                </div>
                <div>
                  <Label>رقم المبنى</Label>
                  <Input defaultValue={settings?.buildingNumber} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                إلغاء
              </Button>
              <Button className="bg-primary hover:bg-primary">
                حفظ الإعدادات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

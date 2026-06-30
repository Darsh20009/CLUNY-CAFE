import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslate } from "@/lib/useTranslate";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, MapPin, Phone, User, Store, Loader2, Edit2, Trash2,
  Navigation, Wifi, WifiOff, Car, Grid3X3, Globe, Users,
  ShoppingBag, TrendingUp, Clock, CheckCircle2, XCircle,
  Map, BarChart2, Activity, Eye, Search, X
} from 'lucide-react';
import BranchMapPicker from '@/components/branch-map-picker';
import SarIcon from '@/components/sar-icon';

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  managerName?: string;
  managerId?: string;
  location?: { lat: number; lng: number };
  geofenceRadius?: number;
  geofenceBoundary?: Array<{ lat: number; lng: number }>;
  lateThresholdMinutes?: number;
  workingHours?: { open: string; close: string };
  allowOnlineOrders?: boolean;
  allowCarOrders?: boolean;
  allowTableOrders?: boolean;
  isOnline?: boolean;
  isActive?: boolean;
}

interface Employee {
  id: string;
  fullName: string;
  role: string;
  branchId?: string;
}

interface BranchStats {
  branchId: string;
  todayOrders: number;
  todayRevenue: number;
  totalOrders: number;
  totalRevenue: number;
  activeEmployees: number;
  isOnline: boolean;
}

export default function AdminBranches() {
  const tc = useTranslate();
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    address: '',
    phone: '',
    locationLat: '',
    locationLng: '',
    geofenceRadius: '200',
    lateThresholdMinutes: '15',
    workingHoursOpen: '08:00',
    workingHoursClose: '23:00',
    managerId: '',
    allowOnlineOrders: true,
    allowCarOrders: true,
    allowTableOrders: true,
  });
  const [geofenceBoundary, setGeofenceBoundary] = useState<Array<{ lat: number; lng: number }>>([]);

  const handleBoundaryChange = useCallback((points: Array<{ lat: number; lng: number }>) => {
    setGeofenceBoundary(points);
  }, []);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['/api/branches'],
  });

  const { data: branchStats = [] } = useQuery<BranchStats[]>({
    queryKey: ['/api/branches/stats'],
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
  });

  const managerEmployees = (employees as Employee[]).filter(
    (e) => ['manager', 'branch_manager', 'admin', 'owner', 'supervisor'].includes(e.role)
  );

  const getStats = (branchId: string) =>
    (branchStats as BranchStats[]).find((s) => s.branchId === branchId);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/branches/stats'] });
      toast({ title: tc("✅ تم إنشاء الفرع بنجاح", "✅ Branch created successfully") });
      setIsAddDialogOpen(false);
      resetFormData();
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ في إنشاء الفرع", "Error creating branch"), description: error?.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      apiRequest('PUT', `/api/branches/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/branches/stats'] });
      toast({ title: tc("✅ تم تحديث الفرع بنجاح", "✅ Branch updated successfully") });
      setIsEditDialogOpen(false);
      setSelectedBranch(null);
      resetFormData();
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ في تحديث الفرع", "Error updating branch"), description: error?.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      toast({ title: tc("تم حذف الفرع بنجاح", "Branch deleted successfully") });
      setDeleteDialogOpen(false);
      setSelectedBranch(null);
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ في حذف الفرع", "Error deleting branch"), description: error?.message, variant: "destructive" });
    }
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/branches/${id}/toggle-online`),
    onSuccess: (res: Response) => res.json().then((data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/branches/stats'] });
      toast({ title: data.message });
    }),
    onError: (error: any) => {
      toast({ title: tc("خطأ في تغيير حالة الفرع", "Error toggling branch status"), description: error?.message, variant: "destructive" });
    }
  });

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      nameAr: branch.nameAr || '',
      nameEn: branch.nameEn || '',
      address: branch.address || '',
      phone: branch.phone || '',
      locationLat: branch.location?.lat?.toString() || '',
      locationLng: branch.location?.lng?.toString() || '',
      geofenceRadius: branch.geofenceRadius?.toString() || '200',
      lateThresholdMinutes: branch.lateThresholdMinutes?.toString() || '15',
      workingHoursOpen: branch.workingHours?.open || '08:00',
      workingHoursClose: branch.workingHours?.close || '23:00',
      managerId: branch.managerId || '',
      allowOnlineOrders: branch.allowOnlineOrders !== false,
      allowCarOrders: branch.allowCarOrders !== false,
      allowTableOrders: branch.allowTableOrders !== false,
    });
    setGeofenceBoundary(branch.geofenceBoundary || []);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (branch: Branch) => {
    setSelectedBranch(branch);
    setDeleteDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    const branchId = selectedBranch.id;
    if (!branchId) return;
    updateMutation.mutate({ id: branchId, updates: prepareSubmitData() });
  };

  const confirmDelete = () => {
    if (!selectedBranch) return;
    const branchId = selectedBranch.id;
    if (!branchId) return;
    deleteMutation.mutate(branchId);
  };

  const resetFormData = () => {
    setFormData({
      nameAr: '',
      nameEn: '',
      address: '',
      phone: '',
      locationLat: '',
      locationLng: '',
      geofenceRadius: '200',
      lateThresholdMinutes: '15',
      workingHoursOpen: '08:00',
      workingHoursClose: '23:00',
      managerId: '',
      allowOnlineOrders: true,
      allowCarOrders: true,
      allowTableOrders: true,
    });
    setGeofenceBoundary([]);
  };

  const prepareSubmitData = () => ({
    nameAr: formData.nameAr,
    nameEn: formData.nameEn,
    address: formData.address,
    phone: formData.phone,
    location: formData.locationLat && formData.locationLng
      ? { lat: parseFloat(formData.locationLat), lng: parseFloat(formData.locationLng) }
      : undefined,
    geofenceRadius: formData.geofenceRadius ? parseInt(formData.geofenceRadius) : 200,
    geofenceBoundary: geofenceBoundary.length >= 3 ? geofenceBoundary : [],
    lateThresholdMinutes: formData.lateThresholdMinutes ? parseInt(formData.lateThresholdMinutes) : 15,
    workingHours: { open: formData.workingHoursOpen, close: formData.workingHoursClose },
    managerId: formData.managerId || undefined,
    managerAssignment: formData.managerId,
    allowOnlineOrders: formData.allowOnlineOrders,
    allowCarOrders: formData.allowCarOrders,
    allowTableOrders: formData.allowTableOrders,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr.trim()) {
      toast({ title: tc("اسم الفرع بالعربي مطلوب", "Arabic branch name is required"), variant: "destructive" });
      return;
    }
    if (!formData.address.trim()) {
      toast({ title: tc("العنوان مطلوب", "Address is required"), variant: "destructive" });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: tc("رقم الهاتف مطلوب", "Phone is required"), variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...prepareSubmitData(),
      city: 'Yanbu',
      cafeId: 'demo-tenant',
    });
  };

  const totalBranches = (branches as Branch[]).length;
  const onlineBranches = (branches as Branch[]).filter(b => b.isOnline !== false).length;
  const totalTodayOrders = (branchStats as BranchStats[]).reduce((s, b) => s + b.todayOrders, 0);
  const totalTodayRevenue = (branchStats as BranchStats[]).reduce((s, b) => s + b.todayRevenue, 0);

  const BranchFormFields = () => (
    <div className="overflow-y-auto flex-1 p-1">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nameAr">{tc("اسم الفرع (عربي) *", "Branch Name (Arabic) *")}</Label>
            <Input id="nameAr" value={formData.nameAr} onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })} placeholder="مثال: فرع المروج" required data-testid="input-nameAr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nameEn">{tc("اسم الفرع (إنجليزي)", "Branch Name (English)")}</Label>
            <Input id="nameEn" value={formData.nameEn} onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })} placeholder="Al Muruj Branch" data-testid="input-nameEn" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">{tc("العنوان *", "Address *")}</Label>
          <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={tc("الحي، الشارع، المدينة", "District, Street, City")} required data-testid="input-address" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{tc("رقم الهاتف *", "Phone *")}</Label>
          <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0500000000" required data-testid="input-phone" />
        </div>

        <div className="space-y-2">
          <Label>{tc("المدير المسؤول", "Branch Manager")}</Label>
          <Select value={formData.managerId || "none"} onValueChange={(v) => setFormData({ ...formData, managerId: v === "none" ? '' : v })}>
            <SelectTrigger data-testid="select-manager"><SelectValue placeholder={tc("اختر المدير", "Select Manager")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tc("بدون مدير", "No Manager")}</SelectItem>
              {managerEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.fullName} ({e.role})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <Label className="text-sm font-semibold">{tc("الموقع الجغرافي", "Location")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{tc("خط العرض", "Latitude")}</Label>
              <Input type="number" step="any" value={formData.locationLat} onChange={(e) => setFormData({ ...formData, locationLat: e.target.value })} placeholder="24.5247" data-testid="input-lat" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{tc("خط الطول", "Longitude")}</Label>
              <Input type="number" step="any" value={formData.locationLng} onChange={(e) => setFormData({ ...formData, locationLng: e.target.value })} placeholder="38.0647" data-testid="input-lng" />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setIsMapDialogOpen(true)} data-testid="button-open-map">
            <Map className="w-4 h-4 ml-2" />
            {tc("اختر من الخريطة", "Pick from Map")}
          </Button>
          {geofenceBoundary.length >= 3 && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {tc(`حدود الجيوفينس: ${geofenceBoundary.length} نقاط`, `Geofence: ${geofenceBoundary.length} points`)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{tc("نطاق الجيوفينس (م)", "Geofence Radius (m)")}</Label>
            <Input type="number" value={formData.geofenceRadius} onChange={(e) => setFormData({ ...formData, geofenceRadius: e.target.value })} placeholder="200" data-testid="input-geofenceRadius" />
            <p className="text-xs text-muted-foreground">{tc("يُستخدم إذا لم ترسم حدود", "Used if no polygon drawn")}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tc("عتبة التأخير (دقيقة)", "Late Threshold (min)")}</Label>
            <Input type="number" value={formData.lateThresholdMinutes} onChange={(e) => setFormData({ ...formData, lateThresholdMinutes: e.target.value })} placeholder="15" data-testid="input-lateThreshold" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{tc("وقت الافتتاح", "Opening Time")}</Label>
            <Input type="time" value={formData.workingHoursOpen} onChange={(e) => setFormData({ ...formData, workingHoursOpen: e.target.value })} data-testid="input-openTime" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tc("وقت الإغلاق", "Closing Time")}</Label>
            <Input type="time" value={formData.workingHoursClose} onChange={(e) => setFormData({ ...formData, workingHoursClose: e.target.value })} data-testid="input-closeTime" />
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <Label className="text-sm font-semibold">{tc("خيارات الطلب", "Order Types")}</Label>
          <div className="space-y-2">
            {[
              { key: 'allowOnlineOrders', label: tc("🌐 الطلبات الأونلاين", "🌐 Online Orders") },
              { key: 'allowCarOrders', label: tc("🚗 طلبات السيارة", "🚗 Curbside Orders") },
              { key: 'allowTableOrders', label: tc("🪑 طلبات الطاولة", "🪑 Table Orders") },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-sm font-normal">{label}</Label>
                <Switch
                  checked={formData[key as keyof typeof formData] as boolean}
                  onCheckedChange={(v) => setFormData({ ...formData, [key]: v })}
                  data-testid={`switch-${key}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" />
            {tc("إدارة الفروع", "Branch Management")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tc("تحكم كامل في فروعك — تفاصيل، إحصائيات، وتفعيل أونلاين", "Full control over your branches — details, stats, and online activation")}
          </p>
        </div>
        <Button
          onClick={() => { resetFormData(); setIsAddDialogOpen(true); }}
          className="bg-primary hover:bg-primary/90"
          data-testid="button-add-branch"
        >
          <Plus className="w-4 h-4 ml-2" />
          {tc("إضافة فرع جديد", "Add New Branch")}
        </Button>
      </div>

      {/* ═══ Summary KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: tc("إجمالي الفروع", "Total Branches"), value: totalBranches, icon: <Store className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: tc("الفروع أونلاين", "Online Branches"), value: onlineBranches, icon: <Wifi className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: tc("طلبات اليوم", "Today's Orders"), value: totalTodayOrders, icon: <ShoppingBag className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { label: tc("إيرادات اليوم", "Today's Revenue"), value: <span className="flex items-center gap-1">{totalTodayRevenue.toFixed(0)} <SarIcon className="w-4 h-4" /></span>, icon: <TrendingUp className="w-5 h-5" />, color: "text-primary", bg: "bg-primary/5" },
        ].map((kpi, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ Search ═══ */}
      <div className="relative">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tc("ابحث باسم الفرع أو العنوان أو رقم الهاتف...", "Search by branch name, address, or phone...")}
          className="w-full h-9 rounded-lg border border-input bg-background pr-10 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          data-testid="input-search-branches"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ═══ Branches Grid ═══ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">{tc("جاري تحميل الفروع...", "Loading branches...")}</span>
        </div>
      ) : (branches as Branch[]).length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <Store className="w-14 h-14 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">{tc("لا توجد فروع مضافة", "No branches added")}</h3>
          <p className="text-muted-foreground text-sm">{tc("ابدأ بإضافة أول فرع للمقهى الخاص بك", "Start by adding your first branch")}</p>
          <Button className="mt-4" onClick={() => { resetFormData(); setIsAddDialogOpen(true); }}>
            <Plus className="w-4 h-4 ml-2" />
            {tc("إضافة فرع", "Add Branch")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {(branches as Branch[]).filter((b) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
              b.nameAr?.toLowerCase().includes(q) ||
              b.nameEn?.toLowerCase().includes(q) ||
              b.address?.toLowerCase().includes(q) ||
              b.phone?.toLowerCase().includes(q) ||
              b.managerName?.toLowerCase().includes(q)
            );
          }).map((branch) => {
            const branchId = branch.id;
            const stats = getStats(branchId);
            const isOnline = branch.isOnline !== false;
            const isExpanded = expandedBranch === branchId;

            return (
              <Card key={branchId} className={`overflow-hidden transition-all duration-200 ${isOnline ? 'border-green-200 dark:border-green-900/40' : 'border-gray-200 dark:border-gray-800 opacity-80'}`} data-testid={`card-branch-${branchId}`}>
                {/* Status bar */}
                <div className={`h-1 w-full ${isOnline ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`} />

                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    {/* Branch name & status */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOnline ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Store className={`w-5 h-5 ${isOnline ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{branch.nameAr}</CardTitle>
                          {branch.nameEn && <span className="text-xs text-muted-foreground">{branch.nameEn}</span>}
                          <Badge variant="outline" className={`text-[10px] ${isOnline ? 'border-green-400 text-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 text-gray-500'}`}>
                            {isOnline ? <><Wifi className="w-2.5 h-2.5 ml-1" /> {tc("متاح", "Online")}</> : <><WifiOff className="w-2.5 h-2.5 ml-1" /> {tc("غير متاح", "Offline")}</>}
                          </Badge>
                        </div>
                        {branch.address && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{branch.address}</p>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      {/* Online toggle */}
                      <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-medium text-muted-foreground">{tc("أونلاين", "Online")}</span>
                        <Switch
                          checked={isOnline}
                          onCheckedChange={() => toggleOnlineMutation.mutate(branchId)}
                          disabled={toggleOnlineMutation.isPending}
                          data-testid={`switch-online-${branchId}`}
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setExpandedBranch(isExpanded ? null : branchId)} data-testid={`button-expand-${branchId}`}>
                        <Eye className="w-4 h-4 ml-1" />
                        {isExpanded ? tc("إخفاء", "Hide") : tc("تفاصيل", "Details")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(branch)} data-testid={`button-edit-branch-${branchId}`}>
                        <Edit2 className="w-4 h-4 ml-1" />
                        {tc("تعديل", "Edit")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(branch)} className="text-destructive hover:text-destructive border-destructive/30" data-testid={`button-delete-branch-${branchId}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 pb-4 space-y-4">
                  {/* Quick stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-primary">{stats?.todayOrders ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{tc("طلبات اليوم", "Today's Orders")}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-600">{stats ? `${stats.todayRevenue.toFixed(0)}` : '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{tc("إيراد اليوم (ريال)", "Today Revenue (SAR)")}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{stats?.activeEmployees ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{tc("موظف نشط", "Active Staff")}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-600">{stats?.totalOrders ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{tc("إجمالي الطلبات", "Total Orders")}</p>
                    </div>
                  </div>

                  {/* Order type badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${branch.allowOnlineOrders !== false ? 'bg-green-50 dark:bg-green-900/20 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'}`}>
                      🌐 {tc("أونلاين", "Online")}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${branch.allowCarOrders !== false ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'}`}>
                      🚗 {tc("سيارة", "Curbside")}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${branch.allowTableOrders !== false ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'}`}>
                      🪑 {tc("طاولة", "Table")}
                    </span>
                    {branch.workingHours && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-orange-50 dark:bg-orange-900/20 text-orange-700 border-orange-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {branch.workingHours.open} — {branch.workingHours.close}
                      </span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Contact info */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5"><User className="w-4 h-4 text-primary" />{tc("معلومات التواصل", "Contact Info")}</h4>
                        {branch.phone && <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{branch.phone}</p>}
                        {branch.managerName && <p className="text-sm text-muted-foreground flex items-center gap-2"><User className="w-3.5 h-3.5" />{tc("المدير:", "Manager:")} {branch.managerName}</p>}
                      </div>

                      {/* Location info */}
                      {branch.location && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-1.5"><Navigation className="w-4 h-4 text-primary" />{tc("الموقع", "Location")}</h4>
                          <p className="text-xs text-muted-foreground font-mono">{branch.location.lat.toFixed(5)}, {branch.location.lng.toFixed(5)}</p>
                          {branch.geofenceBoundary && branch.geofenceBoundary.length >= 3 && (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                              {tc(`جيوفينس: ${branch.geofenceBoundary.length} نقطة`, `Geofence: ${branch.geofenceBoundary.length} pts`)}
                            </Badge>
                          )}
                          <a
                            href={`https://www.google.com/maps?q=${branch.location.lat},${branch.location.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                          >
                            <Globe className="w-3 h-3" />
                            {tc("فتح في خرائط جوجل", "Open in Google Maps")}
                          </a>
                        </div>
                      )}

                      {/* Stats details */}
                      {stats && (
                        <div className="space-y-2 sm:col-span-2">
                          <h4 className="text-sm font-semibold flex items-center gap-1.5"><BarChart2 className="w-4 h-4 text-primary" />{tc("إحصائيات تفصيلية", "Detailed Stats")}</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="bg-primary/5 rounded-lg p-2 text-center">
                              <p className="font-bold text-primary">{stats.totalRevenue.toFixed(0)}</p>
                              <p className="text-[10px] text-muted-foreground">{tc("إجمالي الإيراد", "Total Revenue")}</p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-2 text-center">
                              <p className="font-bold">{stats.totalOrders}</p>
                              <p className="text-[10px] text-muted-foreground">{tc("إجمالي الطلبات", "Total Orders")}</p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-2 text-center">
                              <p className="font-bold">{stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(1) : '0'}</p>
                              <p className="text-[10px] text-muted-foreground">{tc("متوسط الطلب", "Avg Order")}</p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-2 text-center">
                              <p className="font-bold">{stats.activeEmployees}</p>
                              <p className="text-[10px] text-muted-foreground">{tc("موظفون نشطون", "Active Staff")}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══ Add Branch Dialog ═══ */}
      <Dialog open={isAddDialogOpen} onOpenChange={(v) => { setIsAddDialogOpen(v); if (!v) resetFormData(); }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[92vh]">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" />{tc("إضافة فرع جديد", "Add New Branch")}</DialogTitle>
            <DialogDescription>{tc("أضف الفرع واختر المدير المسؤول عنه", "Add the branch and choose its responsible manager")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <BranchFormFields />
            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-branch">
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{tc("جاري الحفظ...", "Saving...")}</> : <><Plus className="w-4 h-4 ml-2" />{tc("حفظ الفرع", "Save Branch")}</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Branch Dialog ═══ */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setSelectedBranch(null); resetFormData(); } }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[92vh]">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <DialogTitle className="flex items-center gap-2"><Edit2 className="w-5 h-5 text-primary" />{tc("تعديل الفرع", "Edit Branch")}</DialogTitle>
            <DialogDescription>{tc("تعديل بيانات الفرع", "Update branch details")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <BranchFormFields />
            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-branch">
                {updateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{tc("جاري التحديث...", "Updating...")}</> : tc("حفظ التعديلات", "Save Changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Dialog ═══ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("تأكيد الحذف", "Confirm Deletion")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tc(`هل أنت متأكد من حذف فرع "${selectedBranch?.nameAr}"؟ هذا الإجراء لا يمكن التراجع عنه.`, `Are you sure you want to delete "${selectedBranch?.nameAr}"? This cannot be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-branch">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("تأكيد الحذف", "Confirm Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Map Dialog ═══ */}
      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Map className="w-5 h-5 text-primary" />{tc("تحديد موقع الفرع", "Set Branch Location")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <BranchMapPicker
              initialLat={formData.locationLat ? parseFloat(formData.locationLat) : undefined}
              initialLng={formData.locationLng ? parseFloat(formData.locationLng) : undefined}
              initialPoints={geofenceBoundary}
              onLocationSelect={(lat, lng) => {
                setFormData(prev => ({ ...prev, locationLat: lat.toString(), locationLng: lng.toString() }));
              }}
              onBoundaryChange={handleBoundaryChange}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setIsMapDialogOpen(false)}>
              {tc("تأكيد الموقع", "Confirm Location")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

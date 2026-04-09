import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, MapPin, Phone, User, Store, ArrowRight, Loader2, Edit2, Trash2, Pentagon } from 'lucide-react';
import BranchPolygonPicker from '@/components/branch-polygon-picker';
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
import { useLocation } from 'wouter';

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  mapUrl?: string;
  phone?: string;
  managerName?: string;
  location?: { lat: number; lng: number };
  geofenceRadius?: number;
  geofenceBoundary?: Array<{ lat: number; lng: number }>;
  lateThresholdMinutes?: number;
  workingHours?: { open: string; close: string };
}

export default function AdminBranches() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    address: '',
    mapUrl: '',
    phone: '',
    locationLat: '',
    locationLng: '',
    geofenceRadius: '200',
    lateThresholdMinutes: '15',
    workingHoursOpen: '08:00',
    workingHoursClose: '23:00',
  });
  const [geofenceBoundary, setGeofenceBoundary] = useState<Array<{ lat: number; lng: number }>>([]);

  const handleBoundaryChange = useCallback((points: Array<{ lat: number; lng: number }>) => {
    setGeofenceBoundary(points);
  }, []);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['/api/branches'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      toast({
        title: "تم إنشاء الفرع بنجاح",
        description: "تم إنشاء الفرع وتعيين المدير.",
      });
      setIsAddDialogOpen(false);
      resetFormData();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إنشاء الفرع",
        description: error?.message || "حدث خطأ عند إنشاء الفرع",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) => 
      apiRequest('PUT', `/api/branches/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      toast({
        title: "تم تحديث الفرع بنجاح",
      });
      setIsEditDialogOpen(false);
      setSelectedBranch(null);
      resetFormData();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في تحديث الفرع",
        description: error?.message || "حدث خطأ عند تحديث الفرع",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      toast({
        title: "تم حذف الفرع بنجاح",
      });
      setDeleteDialogOpen(false);
      setSelectedBranch(null);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في حذف الفرع",
        description: error?.message || "حدث خطأ عند حذف الفرع",
        variant: "destructive"
      });
    }
  });

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      nameAr: branch.nameAr || '',
      nameEn: branch.nameEn || '',
      address: branch.address || '',
      mapUrl: branch.mapUrl || '',
      phone: branch.phone || '',
      locationLat: branch.location?.lat?.toString() || '',
      locationLng: branch.location?.lng?.toString() || '',
      geofenceRadius: branch.geofenceRadius?.toString() || '200',
      lateThresholdMinutes: branch.lateThresholdMinutes?.toString() || '15',
      workingHoursOpen: branch.workingHours?.open || '08:00',
      workingHoursClose: branch.workingHours?.close || '23:00',
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
      mapUrl: '',
      phone: '',
      locationLat: '',
      locationLng: '',
      geofenceRadius: '200',
      lateThresholdMinutes: '15',
      workingHoursOpen: '08:00',
      workingHoursClose: '23:00',
    });
    setGeofenceBoundary([]);
  };

  const prepareSubmitData = () => {
    return {
      nameAr: formData.nameAr,
      nameEn: formData.nameEn,
      address: formData.address,
      mapUrl: formData.mapUrl || undefined,
      phone: formData.phone,
      location: formData.locationLat && formData.locationLng ? {
        lat: parseFloat(formData.locationLat),
        lng: parseFloat(formData.locationLng),
      } : undefined,
      geofenceRadius: parseInt(formData.geofenceRadius) || 200,
      geofenceBoundary: geofenceBoundary.length >= 3 ? geofenceBoundary : undefined,
      lateThresholdMinutes: parseInt(formData.lateThresholdMinutes) || 15,
      workingHours: {
        open: formData.workingHoursOpen,
        close: formData.workingHoursClose,
      },
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال اسم الفرع بالعربية",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate(prepareSubmitData());
    setIsAddDialogOpen(false);
    resetFormData();
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-background min-h-screen" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">إدارة الفروع</h1>
            <p className="text-muted-foreground mt-1">إضافة وتعديل فروع المقهى</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-accent hover:bg-accent"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة فرع جديد
        </Button>
      </div>

      {/* Add Branch Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة فرع جديد</DialogTitle>
            <DialogDescription>
              سيتم إنشاء حساب مدير للفرع تلقائياً عند الحفظ
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nameAr">اسم الفرع (بالعربية) *</Label>
                <Input 
                  id="nameAr"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({...formData, nameAr: e.target.value})}
                  placeholder="فرع المربع"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">اسم الفرع (بالإنجليزي)</Label>
                <Input 
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                  placeholder="Al-Murabba Branch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Input 
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="الرياض، طريق الملك فهد"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mapUrl">رابط خرائط قوقل (اختياري)</Label>
                <Input 
                  id="mapUrl"
                  value={formData.mapUrl}
                  onChange={(e) => setFormData({...formData, mapUrl: e.target.value})}
                  placeholder="https://maps.app.goo.gl/..."
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">الصق رابط الموقع من خرائط قوقل — سيُستخدم لتوجيه العملاء للفرع</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input 
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="0501234567"
                />
              </div>
            </div>

            {/* إعدادات الموقع والحدود الجغرافية */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                إعدادات الموقع والحدود الجغرافية
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="locationLat">خط العرض (Latitude)</Label>
                  <Input 
                    id="locationLat"
                    type="number"
                    step="any"
                    value={formData.locationLat}
                    onChange={(e) => setFormData({...formData, locationLat: e.target.value})}
                    placeholder="24.7136"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationLng">خط الطول (Longitude)</Label>
                  <Input 
                    id="locationLng"
                    type="number"
                    step="any"
                    value={formData.locationLng}
                    onChange={(e) => setFormData({...formData, locationLng: e.target.value})}
                    placeholder="46.6753"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geofenceRadius">نطاق حدود الفرع الدائري (بالمتر) - اختياري</Label>
                  <Input 
                    id="geofenceRadius"
                    type="number"
                    value={formData.geofenceRadius}
                    onChange={(e) => setFormData({...formData, geofenceRadius: e.target.value})}
                    placeholder="200"
                  />
                  <p className="text-xs text-muted-foreground">يُستخدم فقط إذا لم ترسم حدود متعددة النقاط</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lateThresholdMinutes">عتبة التأخير (بالدقائق)</Label>
                  <Input 
                    id="lateThresholdMinutes"
                    type="number"
                    value={formData.lateThresholdMinutes}
                    onChange={(e) => setFormData({...formData, lateThresholdMinutes: e.target.value})}
                    placeholder="15"
                  />
                  <p className="text-xs text-muted-foreground">بعد كم دقيقة يُعتبر الموظف متأخراً</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workingHoursOpen">وقت الافتتاح</Label>
                  <Input 
                    id="workingHoursOpen"
                    type="time"
                    value={formData.workingHoursOpen}
                    onChange={(e) => setFormData({...formData, workingHoursOpen: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workingHoursClose">وقت الإغلاق</Label>
                  <Input 
                    id="workingHoursClose"
                    type="time"
                    value={formData.workingHoursClose}
                    onChange={(e) => setFormData({...formData, workingHoursClose: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* رسم حدود الفرع متعددة النقاط */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Pentagon className="w-4 h-4" />
                رسم حدود الفرع (اختياري - أدق من الدائرة)
              </h4>
              <BranchPolygonPicker
                initialPoints={geofenceBoundary}
                centerLat={formData.locationLat ? parseFloat(formData.locationLat) : undefined}
                centerLng={formData.locationLng ? parseFloat(formData.locationLng) : undefined}
                onBoundaryChange={handleBoundaryChange}
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                className="bg-accent hover:bg-accent"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 ml-2" />
                    حفظ الفرع
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
            <p className="mt-2 text-muted-foreground">جاري تحميل الفروع...</p>
          </div>
        ) : branches && branches.length > 0 ? (
          branches.map((branch) => {
            const branchId = branch.id;
            return (
              <Card key={branchId} className="hover:shadow-md transition-shadow border-orange-100 dark:border-orange-900/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">{branch.nameAr}</CardTitle>
                    <Store className="w-5 h-5 text-accent" />
                  </div>
                  {branch.nameEn && <CardDescription>{branch.nameEn}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {branch.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {branch.address}
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {branch.phone}
                    </div>
                  )}
                  {branch.managerName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      المدير: {branch.managerName}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEdit(branch)}
                      className="flex-1"
                      data-testid={`button-edit-branch-${branchId}`}
                    >
                      <Edit2 className="w-4 h-4 ml-1" />
                      تعديل
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(branch)}
                      className="flex-1 text-destructive hover:text-destructive"
                      data-testid={`button-delete-branch-${branchId}`}
                    >
                      <Trash2 className="w-4 h-4 ml-1" />
                      حذف
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-card rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-800">
            <Store className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold">لا توجد فروع مضافة</h3>
            <p className="text-muted-foreground">ابدأ بإضافة أول فرع للمقهى الخاص بك</p>
          </div>
        )}
      </div>

      {/* Edit Branch Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setSelectedBranch(null);
          resetFormData();
        }
      }}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الفرع</DialogTitle>
            <DialogDescription>
              تعديل بيانات الفرع
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nameAr">اسم الفرع (بالعربية) *</Label>
                <Input 
                  id="edit-nameAr"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({...formData, nameAr: e.target.value})}
                  placeholder="فرع المربع"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nameEn">اسم الفرع (بالإنجليزي)</Label>
                <Input 
                  id="edit-nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                  placeholder="Al-Murabba Branch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">العنوان</Label>
                <Input 
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="الرياض، طريق الملك فهد"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mapUrl">رابط خرائط قوقل (اختياري)</Label>
                <Input 
                  id="edit-mapUrl"
                  value={formData.mapUrl}
                  onChange={(e) => setFormData({...formData, mapUrl: e.target.value})}
                  placeholder="https://maps.app.goo.gl/..."
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">الصق رابط الموقع من خرائط قوقل — سيُستخدم لتوجيه العملاء للفرع</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">رقم الهاتف</Label>
                <Input 
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="0501234567"
                />
              </div>
            </div>

            {/* رسم حدود الفرع متعددة النقاط - التعديل */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Pentagon className="w-4 h-4" />
                تعديل حدود الفرع
              </h4>
              <BranchPolygonPicker
                initialPoints={geofenceBoundary}
                centerLat={formData.locationLat ? parseFloat(formData.locationLat) : undefined}
                centerLng={formData.locationLng ? parseFloat(formData.locationLng) : undefined}
                onBoundaryChange={handleBoundaryChange}
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                className="bg-accent hover:bg-accent"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 ml-2" />
                    حفظ التعديلات
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الفرع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الفرع "{selectedBranch?.nameAr}"؟ 
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedBranch(null)}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 ml-2" />
                  تأكيد الحذف
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

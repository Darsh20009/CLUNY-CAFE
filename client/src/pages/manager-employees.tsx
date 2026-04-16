import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coffee, Plus, User, Phone, Clock, Percent, LogOut, Edit, Upload, X, MapPin, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface Branch {
 id: string;
 nameAr: string;
 nameEn?: string;
}

export default function ManagerEmployees() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
 const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
 const [currentManager, setCurrentManager] = useState<any>(null);
 const [selectedImage, setSelectedImage] = useState<File | null>(null);
 const [imagePreview, setImagePreview] = useState<string | null>(null);
 const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
 const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
 const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
 const [editUploadedImageUrl, setEditUploadedImageUrl] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const editFileInputRef = useRef<HTMLInputElement>(null);
 const [isUploadingImage, setIsUploadingImage] = useState(false);
 const [selectedRole, setSelectedRole] = useState<string>("cashier");
   const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);

  useEffect(() => {
    if (editingEmployee) {
      setSelectedPermissions(editingEmployee.permissions || []);
      setSelectedPages(editingEmployee.allowedPages || []);
    } else {
      setSelectedPermissions([]);
      setSelectedPages([]);
    }
  }, [editingEmployee]);

  const PERMISSIONS_OPTIONS = [
    { id: 'create_order', label: 'إنشاء طلبات' },
    { id: 'cancel_order', label: 'إلغاء طلبات' },
    { id: 'manage_inventory', label: 'إدارة المخزون' },
    { id: 'view_reports', label: 'عرض التقارير' },
    { id: 'manage_employees', label: 'إدارة الموظفين' },
    { id: 'manage_branches', label: 'إدارة الفروع' },
    { id: 'manage_settings', label: 'إعدادات النظام' },
  ];

  const PAGES_OPTIONS = [
    { id: '/employee/pos', label: 'نقطة البيع' },
    { id: '/employee/orders', label: 'الطلبات' },
    { id: '/employee/inventory', label: 'المخزون' },
    { id: '/employee/accounting', label: 'المحاسبة' },
    { id: '/employee/attendance', label: 'التحضير' },
    { id: '/employee/availability', label: 'التوفر' },
    { id: '/employee/cashier', label: 'الكاشير' },
    { id: '/manager/dashboard', label: 'لوحة التحكم' },
    { id: '/manager/employees', label: 'إدارة الموظفين' },
  ];


 // Get current manager info and verify session
 useEffect(() => {
 const checkSession = async () => {
 const managerData = localStorage.getItem("currentEmployee");
 if (managerData) {
 const parsed = JSON.parse(managerData);
 
      // Verify session is still valid on backend
      try {
        const response = await fetch("/api/verify-session", { credentials: "include" });
        if (!response.ok) {
          // Session expired, clear localStorage and redirect
          localStorage.removeItem("currentEmployee");
          setLocation("/employee/gateway");
          return;
        }
        // Update with server data if needed
        const data = await response.json();
        if (data && data.employee) {
          const updatedManager = { ...parsed, ...data.employee };
          localStorage.setItem("currentEmployee", JSON.stringify(updatedManager));
          setCurrentManager(updatedManager);
        } else {
          setCurrentManager(parsed);
        }
      } catch (error) {
 console.error("Session verification error:", error);
 localStorage.removeItem("currentEmployee");
 setLocation("/employee/gateway");
 }
 } else {
 setLocation("/employee/gateway");
 }
 };

 checkSession();
 }, [setLocation]);

 // Determine if current user is admin/owner
 const isAdminOrOwner = currentManager?.role === "admin" || currentManager?.role === "owner";
 const managerBranchId = currentManager?.branchId;

  const { data: employees = [], isLoading, isError, error } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: !!currentManager,
    retry: 1
  });

  const branchesData = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    enabled: !!currentManager && isAdminOrOwner,
  });
  const branches = branchesData.data || [];

  // Derived state for filtered employees
  const displayEmployees = useMemo(() => {
    if (!Array.isArray(employees)) return [];
    return isAdminOrOwner 
      ? employees 
      : employees.filter(emp => emp && emp.branchId === managerBranchId);
  }, [employees, isAdminOrOwner, managerBranchId]);

 const createEmployeeMutation = useMutation({
 mutationFn: async (data: any) => {
 const res = await apiRequest("POST", "/api/employees", data);
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
 setIsAddDialogOpen(false);
 setSelectedRole("cashier");
 setSelectedBranchId("");
 setImagePreview(null);
 setSelectedImage(null);
 setUploadedImageUrl(null);
 toast({
 title: "تم إضافة الموظف",
 description: "تم إضافة الموظف بنجاح. يمكنه الآن إنشاء كلمة المرور الخاصةبه.",
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: "فشل إضافة الموظف",
 description: error.message || "حدث خطأ أثناء إضافة الموظف",
 });
 },
 });

 const updateEmployeeMutation = useMutation({
 mutationFn: async ({ id, data }: { id: string; data: any }) => {
 const res = await apiRequest("PUT", `/api/employees/${id}`, data);
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
 setEditingEmployee(null);
 toast({
 title: "تم تحديث الموظف",
 description: "تم تحديث بيانات الموظف بنجاح",
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: "فشل التحديث",
 description: error.message || "حدث خطأ أثناء تحديث الموظف",
 });
 },
 });

 const handleLogout = () => {
 localStorage.removeItem("currentEmployee");
 setLocation("/employee/gateway");
 };

 const handleSubmitNew = (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const formData = new FormData(e.currentTarget);
 
 const username = formData.get("username") as string;
 const workDaysData = formData.getAll("workDays") as string[];
 const shiftStartTime = formData.get("shiftStartTime") as string;
 const shiftEndTime = formData.get("shiftEndTime") as string;
 
 // Determine branch ID - admin can select, manager uses their branch
 const branchId = isAdminOrOwner && selectedBranchId ? selectedBranchId : currentManager?.branchId;
 
 const employeeData = {
 username: username,
 fullName: formData.get("fullName") as string,
 phone: formData.get("phone") as string,
 jobTitle: formData.get("jobTitle") as string,
 role: selectedRole,
 branchId: branchId,
 permissions: selectedPermissions,
 allowedPages: selectedPages,
 shiftTime: shiftStartTime && shiftEndTime ? `${shiftStartTime}-${shiftEndTime}` : undefined,
 shiftStartTime: shiftStartTime || undefined,
 shiftEndTime: shiftEndTime || undefined,
 workDays: workDaysData.length > 0 ? workDaysData : undefined,
 deviceBalance: parseInt(formData.get("deviceBalance") as string) || 0,
 commissionPercentage: parseFloat(formData.get("commissionPercentage") as string) || 0,
 imageUrl: uploadedImageUrl || undefined,
 };

 createEmployeeMutation.mutate(employeeData);
 };

 const handleSubmitEdit = (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 if (!editingEmployee) return;

 const formData = new FormData(e.currentTarget);
 const workDaysData = formData.getAll("workDays") as string[];
 const employeeData = {
 fullName: formData.get("fullName") as string,
 phone: formData.get("phone") as string,
 jobTitle: formData.get("jobTitle") as string,
 permissions: selectedPermissions,
 allowedPages: selectedPages,
 shiftTime: formData.get("shiftTime") as string,
 shiftStartTime: formData.get("shiftStartTime") as string || undefined,
 shiftEndTime: formData.get("shiftEndTime") as string || undefined,
 workDays: workDaysData.length > 0 ? workDaysData : undefined,
 deviceBalance: parseInt(formData.get("deviceBalance") as string) || 0,
 commissionPercentage: parseFloat(formData.get("commissionPercentage") as string) || 0,
 imageUrl: editUploadedImageUrl || editingEmployee.imageUrl || undefined,
 };

 updateEmployeeMutation.mutate({ id: editingEmployee.id || '', data: employeeData });
 };

 const handleImageUpload = async (file: File) => {
 if (!file) return;
 
 const preview = URL.createObjectURL(file);
 setImagePreview(preview);
 setSelectedImage(file);

 setIsUploadingImage(true);
 try {
 const formData = new FormData();
 formData.append('image', file);
 const response = await fetch('/api/upload-employee-image', {
 method: 'POST',
 body: formData,
 credentials: 'include'
 });

 if (response.ok) {
 const data = await response.json();
 setUploadedImageUrl(data.url);
 toast({
 title: "تم رفع الصورة",
 description: "تم رفع صورة الموظف بنجاح"
 });
 } else {
 throw new Error('فشل الرفع');
 }
 } catch (error) {
 toast({
 title: "خطأ",
 description: "فشل رفع الصورة",
 variant: "destructive"
 });
 setImagePreview(null);
 setSelectedImage(null);
 }
 setIsUploadingImage(false);
 };

 const handleEditImageUpload = async (file: File) => {
 if (!file) return;
 
 const preview = URL.createObjectURL(file);
 setEditImagePreview(preview);
 setEditSelectedImage(file);

 setIsUploadingImage(true);
 try {
 const formData = new FormData();
 formData.append('image', file);
 const response = await fetch('/api/upload-employee-image', {
 method: 'POST',
 body: formData,
 credentials: 'include'
 });

 if (response.ok) {
 const data = await response.json();
 setEditUploadedImageUrl(data.url);
 toast({
 title: "تم رفع الصورة",
 description: "تم رفع صورة الموظف بنجاح"
 });
 } else {
 throw new Error('فشل الرفع');
 }
 } catch (error) {
 toast({
 title: "خطأ",
 description: "فشل رفع الصورة",
 variant: "destructive"
 });
 setEditImagePreview(null);
 setEditSelectedImage(null);
 }
 setIsUploadingImage(false);
 };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center">
              <Coffee className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-accent">{t("manager.employees")}</h1>
              <p className="text-gray-400 text-sm">{t("manager.dashboard")}</p>
            </div>
          </div>
 <div className="flex gap-2">
 <Button
 onClick={() => setLocation("/employee/dashboard")}
 variant="outline"
 className="border-primary/50 text-accent"
 data-testid="button-dashboard"
 >
 لوحةالتحكم
 </Button>
 <Button
 variant="outline"
 onClick={handleLogout}
 className="border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
 data-testid="button-logout"
 >
 <LogOut className="w-4 h-4 ml-2" />
 تسجيل الخروج
 </Button>
 </div>
 </div>

 <div className="mb-6">
 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
 <DialogTrigger asChild>
 <Button
 className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
 data-testid="button-add-employee"
 >
 <Plus className="w-4 h-4 ml-2" />
 إضافة موظف جديد
 </Button>
 </DialogTrigger>
 <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">إضافة موظف جديد</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmitNew} className="space-y-3 sm:space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label htmlFor="fullName" className="text-gray-300">الاسم الكامل *</Label>
 <Input
 id="fullName"
 name="fullName"
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-fullname"
 />
 </div>
 <div>
 <Label htmlFor="username" className="text-gray-300">اسم المستخدم *</Label>
 <Input
 id="username"
 name="username"
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-username"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label htmlFor="phone" className="text-gray-300">رقم الهاتف *</Label>
 <Input
 id="phone"
 name="phone"
 type="tel"
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-phone"
 />
 </div>
 <div>
 <Label htmlFor="jobTitle" className="text-gray-300">الوظيفة*</Label>
 <Select name="jobTitle" required>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-jobtitle">
 <SelectValue placeholder="اختر الوظيفة" />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 <SelectItem value="كاشير">كاشير</SelectItem>
 <SelectItem value="محاسب">محاسب</SelectItem>
 <SelectItem value="بائع">بائع</SelectItem>
 <SelectItem value="عارض">عارض</SelectItem>
 <SelectItem value="سائق توصيل">سائق توصيل</SelectItem>
 <SelectItem value="مدير">مدير</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Role and Branch Selection - Admin only */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label className="text-gray-300 flex items-center gap-1">
 <Shield className="w-4 h-4" />
 الدور في النظام *
 </Label>
 <Select value={selectedRole} onValueChange={setSelectedRole}>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-role">
 <SelectValue placeholder="اختر الدور" />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 <SelectItem value="cashier">كاشير</SelectItem>
 <SelectItem value="accountant">محاسب</SelectItem>
 <SelectItem value="driver">سائق توصيل</SelectItem>
 {isAdminOrOwner && <SelectItem value="manager">مدير فرع</SelectItem>}
 {currentManager?.role === "admin" && <SelectItem value="admin">مدير عام</SelectItem>}
 </SelectContent>
 </Select>
 </div>
 {isAdminOrOwner && (
 <div>
 <Label className="text-gray-300 flex items-center gap-1">
 <MapPin className="w-4 h-4" />
 الفرع {selectedRole === "manager" ? "*" : ""}
 </Label>
 <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-branch">
 <SelectValue placeholder="اختر الفرع" />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 {branches.map((branch) => (
 <SelectItem key={branch.id} value={branch.id}>
 {branch.nameAr}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label htmlFor="shiftStartTime" className="text-gray-300">وقت بداية الدوام</Label>
 <Input
 id="shiftStartTime"
 name="shiftStartTime"
 type="time"
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-shiftstart"
 />
 </div>
 <div>
 <Label htmlFor="shiftEndTime" className="text-gray-300">وقت نهاية الدوام</Label>
 <Input
 id="shiftEndTime"
 name="shiftEndTime"
 type="time"
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-shiftend"
 />
 </div>
 </div>

 <div>
   <Label className="text-gray-300 block mb-2">أيام الدوام</Label>
   <div className="grid grid-cols-3 gap-2">
   {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
   <label key={day} className="flex items-center gap-2 text-gray-300 cursor-pointer">
   <input
   type="checkbox"
   name="workDays"
   value={day}
   className="w-4 h-4 rounded border-primary/30 bg-[#1a1410]"
   data-testid={`checkbox-workday-${day}`}
   />
   <span className="text-sm">{day}</span>
   </label>
   ))}
   </div>
 </div>

 <div>
   <Label className="text-gray-300 block mb-2">الصلاحيات</Label>
   <div className="grid grid-cols-2 gap-2 bg-[#1a1410] p-3 rounded-lg border border-primary/10">
     {PERMISSIONS_OPTIONS.map(opt => (
       <label key={opt.id} className="flex items-center gap-2 text-gray-300 cursor-pointer">
         <input
           type="checkbox"
           checked={selectedPermissions.includes(opt.id)}
           onChange={(e) => {
             if (e.target.checked) setSelectedPermissions([...selectedPermissions, opt.id]);
             else setSelectedPermissions(selectedPermissions.filter(id => id !== opt.id));
           }}
           className="w-4 h-4 rounded border-primary/30 bg-[#1a1410]"
         />
         <span className="text-sm">{opt.label}</span>
       </label>
     ))}
   </div>
 </div>

 <div>
   <Label className="text-gray-300 block mb-2">الصفحات المسموحة</Label>
   <div className="grid grid-cols-2 gap-2 bg-[#1a1410] p-3 rounded-lg border border-primary/10">
     {PAGES_OPTIONS.map(opt => (
       <label key={opt.id} className="flex items-center gap-2 text-gray-300 cursor-pointer">
         <input
           type="checkbox"
           checked={selectedPages.includes(opt.id)}
           onChange={(e) => {
             if (e.target.checked) setSelectedPages([...selectedPages, opt.id]);
             else setSelectedPages(selectedPages.filter(id => id !== opt.id));
           }}
           className="w-4 h-4 rounded border-primary/30 bg-[#1a1410]"
         />
         <span className="text-sm">{opt.label}</span>
       </label>
     ))}
   </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label htmlFor="deviceBalance" className="text-gray-300">رصيد الأجهزة</Label>
 <Input
 id="deviceBalance"
 name="deviceBalance"
 type="number"
 min="0"
 defaultValue="0"
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-devicebalance"
 />
 </div>
 <div>
 <Label htmlFor="commissionPercentage" className="text-gray-300">نسبةالعمولة(%)</Label>
 <Input
 id="commissionPercentage"
 name="commissionPercentage"
 type="number"
 step="0.1"
 min="0"
 max="100"
 defaultValue="0"
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-commission"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="employeeImage" className="text-gray-300">صورة الموظف</Label>
 <div className="flex gap-2 items-end">
 <div className="flex-1">
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={(e) => {
 const file = e.currentTarget.files?.[0];
 if (file) handleImageUpload(file);
 }}
 data-testid="input-employee-image"
 />
 <Button
 type="button"
 variant="outline"
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploadingImage}
 className="w-full border-primary/30 text-accent"
 >
 <Upload className="w-4 h-4 ml-2" />
 {isUploadingImage ? "جاري الرفع..." : "اختر صورة"}
 </Button>
 </div>
 {imagePreview && (
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => {
 setImagePreview(null);
 setSelectedImage(null);
 setUploadedImageUrl(null);
 }}
 className="border-red-500/30 text-red-500"
 data-testid="button-remove-image"
 >
 <X className="w-4 h-4" />
 </Button>
 )}
 </div>
 {imagePreview && (
 <div className="mt-2">
 <img src={imagePreview} alt="معاينة" className="w-20 h-20 rounded-lg object-cover" />
 </div>
 )}
 </div>

 <div className="bg-background0/10 border border-primary/30 rounded-lg p-4">
 <p className="text-sm text-accent/90">
  سيتم إنشاء الموظف بدون كلمة مرور. يجب على الموظف الذهاب إلى صفحة "موظف جديد" لإنشاء كلمة المرور الخاصةبه.
 </p>
 </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsAddDialogOpen(false);
            setImagePreview(null);
            setSelectedImage(null);
            setUploadedImageUrl(null);
          }}
          className="border-gray-600 text-gray-300 w-full sm:w-auto hover-elevate"
          data-testid="button-cancel-add"
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          disabled={createEmployeeMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-amber-700 w-full sm:w-auto hover-elevate active-elevate-2"
          data-testid="button-submit-add"
        >
          {createEmployeeMutation.isPending ? "جاري الإضافة..." : "إضافة الموظف"}
        </Button>
      </div>
 </form>
 </DialogContent>
 </Dialog>
 </div>

      {isLoading ? (
        <div className="text-center text-accent py-12">جاري تحميل الموظفين...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(employees || []).map((employee) => (
            <Card
              key={employee.id}
              className="bg-gradient-to-br from-background to-background border-primary/20 overflow-hidden hover-elevate"
              data-testid={`card-employee-${employee.id}`}
            >
 <CardHeader className="bg-gradient-to-r from-amber-500/20 to-amber-700/20">
 <div className="flex items-center justify-between">
 <CardTitle className="text-accent flex items-center gap-2">
 {employee.imageUrl ? (
 <img
 src={employee.imageUrl}
 alt={employee.fullName}
 className="w-10 h-10 rounded-full object-cover"
 />
 ) : (
 <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center">
 <User className="w-6 h-6 text-white" />
 </div>
 )}
 <span>{employee.fullName}</span>
 </CardTitle>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => setEditingEmployee(employee)}
 className="text-accent hover:bg-background0/10"
 data-testid={`button-edit-${employee.id}`}
 >
 <Edit className="w-4 h-4" />
 </Button>
 </div>
 </CardHeader>
 <CardContent className="pt-4 space-y-3">
 <div className="flex items-center gap-2 text-gray-300">
 <User className="w-4 h-4 text-accent" />
 <span className="text-sm">{employee.jobTitle}</span>
            <Badge
              className={employee.isActivated ? "bg-green-500" : "bg-gray-500"}
              data-testid={`badge-status-${employee.id}`}
            >
              {employee.isActivated ? "مفعّل" : "غير مفعّل"}
            </Badge>
 </div>

 <div className="flex items-center gap-2 text-gray-300">
 <Phone className="w-4 h-4 text-accent" />
 <span className="text-sm">{employee.phone}</span>
 </div>

 {employee.shiftTime && (
 <div className="flex items-center gap-2 text-gray-300">
 <Clock className="w-4 h-4 text-accent" />
 <span className="text-sm">{employee.shiftTime}</span>
 </div>
 )}

 {employee.commissionPercentage !== undefined && employee.commissionPercentage > 0 && (
 <div className="flex items-center gap-2 text-gray-300">
 <Percent className="w-4 h-4 text-accent" />
 <span className="text-sm">عمولة: {employee.commissionPercentage}%</span>
 </div>
 )}

 <div className="pt-2 border-t border-primary/20">
 <p className="text-xs text-gray-400">اسم المستخدم: {employee.username}</p>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 {editingEmployee && (
 <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
 <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">تعديل بيانات الموظف</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmitEdit} className="space-y-3 sm:space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label htmlFor="edit-fullName" className="text-gray-300">الاسم الكامل *</Label>
 <Input
 id="edit-fullName"
 name="fullName"
 required
 defaultValue={editingEmployee.fullName}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-fullname"
 />
 </div>
 <div>
 <Label htmlFor="edit-phone" className="text-gray-300">رقم الهاتف *</Label>
 <Input
 id="edit-phone"
 name="phone"
 type="tel"
 required
 defaultValue={editingEmployee.phone}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-phone"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label htmlFor="edit-jobTitle" className="text-gray-300">الوظيفة*</Label>
 <Select name="jobTitle" defaultValue={editingEmployee.jobTitle} required>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-edit-jobtitle">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 <SelectItem value="كاشير">كاشير</SelectItem>
 <SelectItem value="محاسب">محاسب</SelectItem>
 <SelectItem value="بائع">بائع</SelectItem>
 <SelectItem value="عارض">عارض</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <Label htmlFor="edit-shiftStartTime" className="text-gray-300">وقت بداية الدوام</Label>
 <Input
 id="edit-shiftStartTime"
 name="shiftStartTime"
 type="time"
 defaultValue={editingEmployee.shiftStartTime}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-shiftstart"
 />
 </div>
 <div>
 <Label htmlFor="edit-shiftEndTime" className="text-gray-300">وقت نهاية الدوام</Label>
 <Input
 id="edit-shiftEndTime"
 name="shiftEndTime"
 type="time"
 defaultValue={editingEmployee.shiftEndTime}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-shiftend"
 />
 </div>
 </div>

 <div>
   <Label className="text-gray-300 block mb-2">أيام الدوام</Label>
   <div className="grid grid-cols-3 gap-2">
   {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
   <label key={day} className="flex items-center gap-2 text-gray-300 cursor-pointer">
   <input
   type="checkbox"
   name="workDays"
   value={day}
   defaultChecked={editingEmployee.workDays?.includes(day)}
   className="w-4 h-4 rounded border-primary/30 bg-[#1a1410]"
   data-testid={`checkbox-edit-workday-${day}`}
   />
   <span className="text-sm">{day}</span>
   </label>
   ))}
   </div>
 </div>

 <div>
   <Label className="text-gray-300 block mb-2">الصلاحيات</Label>
   <div className="grid grid-cols-2 gap-2 bg-[#1a1410] p-3 rounded-lg border border-primary/10">
     {PERMISSIONS_OPTIONS.map(opt => (
       <label key={opt.id} className="flex items-center gap-2 text-gray-300 cursor-pointer">
         <input
           type="checkbox"
           checked={selectedPermissions.includes(opt.id)}
           onChange={(e) => {
             if (e.target.checked) setSelectedPermissions([...selectedPermissions, opt.id]);
             else setSelectedPermissions(selectedPermissions.filter(id => id !== opt.id));
           }}
           className="w-4 h-4 rounded border-primary/30 bg-[#1a1410]"
         />
         <span className="text-sm">{opt.label}</span>
       </label>
     ))}
   </div>
 </div>

 <div>
   <Label className="text-gray-300 block mb-2">الصفحات المسموحة</Label>
   <div className="grid grid-cols-2 gap-2 bg-[#1a1410] p-3 rounded-lg border border-primary/10">
     {PAGES_OPTIONS.map(opt => (
       <label key={opt.id} className="flex items-center gap-2 text-gray-300 cursor-pointer">
         <input
           type="checkbox"
           checked={selectedPages.includes(opt.id)}
           onChange={(e) => {
             if (e.target.checked) setSelectedPages([...selectedPages, opt.id]);
             else setSelectedPages(selectedPages.filter(id => id !== opt.id));
           }}
           className="w-4 h-4 rounded border-primary/30 bg-[#1a1410]"
         />
         <span className="text-sm">{opt.label}</span>
       </label>
     ))}
   </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-deviceBalance" className="text-gray-300">رصيد الأجهزة</Label>
 <Input
 id="edit-deviceBalance"
 name="deviceBalance"
 type="number"
 min="0"
 defaultValue={editingEmployee.deviceBalance || 0}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-devicebalance"
 />
 </div>
 <div>
 <Label htmlFor="edit-commissionPercentage" className="text-gray-300">نسبةالعمولة(%)</Label>
 <Input
 id="edit-commissionPercentage"
 name="commissionPercentage"
 type="number"
 step="0.1"
 min="0"
 max="100"
 defaultValue={editingEmployee.commissionPercentage || 0}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-commission"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="edit-employeeImage" className="text-gray-300">صورة الموظف</Label>
 <div className="flex gap-2 items-end">
 <div className="flex-1">
 <input
 ref={editFileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={(e) => {
 const file = e.currentTarget.files?.[0];
 if (file) handleEditImageUpload(file);
 }}
 data-testid="input-edit-employee-image"
 />
 <Button
 type="button"
 variant="outline"
 onClick={() => editFileInputRef.current?.click()}
 disabled={isUploadingImage}
 className="w-full border-primary/30 text-accent"
 >
 <Upload className="w-4 h-4 ml-2" />
 {isUploadingImage ? "جاري الرفع..." : "اختر صورة جديدة"}
 </Button>
 </div>
 {editImagePreview && (
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => {
 setEditImagePreview(null);
 setEditSelectedImage(null);
 setEditUploadedImageUrl(null);
 }}
 className="border-red-500/30 text-red-500"
 data-testid="button-remove-edit-image"
 >
 <X className="w-4 h-4" />
 </Button>
 )}
 </div>
 {editImagePreview ? (
 <div className="mt-2">
 <img src={editImagePreview} alt="معاينة جديدة" className="w-20 h-20 rounded-lg object-cover" />
 </div>
 ) : editingEmployee.imageUrl ? (
 <div className="mt-2">
 <img src={editingEmployee.imageUrl} alt={editingEmployee.fullName} className="w-20 h-20 rounded-lg object-cover" />
 </div>
 ) : null}
 </div>

 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => {
 setEditingEmployee(null);
 setEditImagePreview(null);
 setEditSelectedImage(null);
 setEditUploadedImageUrl(null);
 }}
 className="border-gray-600 text-gray-300"
 data-testid="button-cancel-edit"
 >
 إلغاء
 </Button>
 <Button
 type="submit"
 disabled={updateEmployeeMutation.isPending}
 className="bg-gradient-to-r from-amber-500 to-amber-700"
 data-testid="button-submit-edit"
 >
 {updateEmployeeMutation.isPending ? "جاري التحديث..." : "حفظ التغييرات"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 )}
 </div>
 </div>
 );
}

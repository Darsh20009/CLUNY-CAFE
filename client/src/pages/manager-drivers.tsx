import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Truck, User, Phone, Plus, Edit2, Trash2, MapPin, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";

export default function ManagerDrivers() {
 const [, setLocation] = useLocation();
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
 const [editingDriver, setEditingDriver] = useState<Employee | null>(null);
 const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null);
 const { toast } = useToast();
 const queryClient = useQueryClient();

 const { data: employees = [], isLoading } = useQuery<Employee[]>({
 queryKey: ["/api/employees"],
 });

 const drivers = employees.filter(emp => emp.role === "driver");

 const createDriverMutation = useMutation({
 mutationFn: async (data: any) => {
 const res = await apiRequest("POST", "/api/employees", data);
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
 setIsAddDialogOpen(false);
 toast({
 title: "تم الإضاف� ",
 description: "تم إضاف� السائق بنجاح",
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: "فشل الإضاف� ",
 description: error.message || "حدث � طأ أثناء إضاف� السائق",
 });
 },
 });

 const updateDriverMutation = useMutation({
 mutationFn: async (data: { id: string; updates: any }) => {
 const res = await apiRequest("PUT", `/api/employees/${data.id}`, data.updates);
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
 setIsEditDialogOpen(false);
 setEditingDriver(null);
 toast({
 title: "تم التحديث",
 description: "تم تحديث معلومات السائق بنجاح",
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: "فشل التحديث",
 description: error.message || "حدث � طأ أثناء تحديث السائق",
 });
 },
 });

 const toggleAvailabilityMutation = useMutation({
 mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: number }) => {
 const res = await apiRequest("PUT", `/api/employees/${id}`, { isAvailableForDelivery: isAvailable });
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
 toast({
 title: "تم التحديث",
 description: "تم تحديث حال� توفر السائق",
 });
 },
 });

 const handleSubmitNewDriver = (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const formData = new FormData(e.currentTarget);
 
 const driverData = {
 username: formData.get("username") as string,
 password: formData.get("password") as string,
 fullName: formData.get("fullName") as string,
 phone: formData.get("phone") as string,
 role: "driver",
 jobTitle: "سائق توصيل",
 vehicleType: formData.get("vehicleType") as string,
 vehiclePlateNumber: formData.get("vehiclePlateNumber") as string,
 vehicleColor: formData.get("vehicleColor") as string,
 licenseNumber: formData.get("licenseNumber") as string,
 isAvailableForDelivery: 1,
 isActivated: 1,
 };

 createDriverMutation.mutate(driverData);
 };

 const handleSubmitEditDriver = (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 if (!editingDriver) return;
 
 const formData = new FormData(e.currentTarget);
 
 const updates = {
 fullName: formData.get("fullName") as string,
 phone: formData.get("phone") as string,
 vehicleType: formData.get("vehicleType") as string,
 vehiclePlateNumber: formData.get("vehiclePlateNumber") as string,
 vehicleColor: formData.get("vehicleColor") as string,
 licenseNumber: formData.get("licenseNumber") as string,
 };

 updateDriverMutation.mutate({ id: editingDriver.id, updates });
 };

 const handleEdit = (driver: Employee) => {
 setEditingDriver(driver);
 setIsEditDialogOpen(true);
 };

 const handleToggleAvailability = (driver: Employee) => {
 const newAvailability = driver.isAvailableForDelivery === 1 ? 0 : 1;
 toggleAvailabilityMutation.mutate({ id: driver.id, isAvailable: newAvailability });
 };

 return (
 <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4">
 {/* Header */}
 <div className="max-w-7xl mx-auto mb-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center">
 <Truck className="w-6 h-6 text-white" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-accent">إدار� السائقين</h1>
 <p className="text-gray-400 text-sm">إضاف� وتعديل حسابات السائقين</p>
 </div>
 </div>
 <div className="flex gap-3">
 <Button
 onClick={() => setIsAddDialogOpen(true)}
 className="bg-gradient-to-r from-green-500 to-green-700"
 data-testid="button-add-driver"
 >
 <Plus className="w-4 h-4 ml-2" />
 إضاف� سائق جديد
 </Button>
 <Button
 variant="outline"
 onClick={() => setLocation("/manager/dashboard")}
 className="border-primary/50 text-accent hover:bg-background0 hover:text-white"
 data-testid="button-back"
 >
 <ArrowRight className="w-4 h-4 ml-2" />
 العود� 
 </Button>
 </div>
 </div>
 </div>

 {/* Drivers List */}
 <div className="max-w-7xl mx-auto">
 {isLoading ? (
 <Card className="bg-[#2d1f1a] border-primary/20">
 <CardContent className="p-12 text-center">
 <Truck className="w-12 h-12 animate-pulse mx-auto mb-4 text-accent" />
 <p className="text-gray-400">جاري تحميل السائقين...</p>
 </CardContent>
 </Card>
 ) : drivers.length === 0 ? (
 <Card className="bg-[#2d1f1a] border-primary/20">
 <CardContent className="p-12 text-center">
 <Truck className="w-12 h-12 mx-auto mb-4 text-gray-500" />
 <p className="text-gray-400">لا يوجد سائقين مسجلين</p>
 <Button
 onClick={() => setIsAddDialogOpen(true)}
 className="mt-4 bg-gradient-to-r from-green-500 to-green-700"
 >
 <Plus className="w-4 h-4 ml-2" />
 إضاف� أول سائق
 </Button>
 </CardContent>
 </Card>
 ) : (
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {drivers.map((driver) => (
 <Card key={driver.id} className="bg-[#2d1f1a] border-primary/20">
 <CardHeader>
 <CardTitle className="text-accent text-right flex items-center justify-between">
 <span className="flex items-center gap-2">
 <User className="w-5 h-5" />
 {driver.fullName}
 </span>
 <Badge
 className={
 driver.isAvailableForDelivery === 1
 ? "bg-green-500"
 : "bg-gray-500"
 }
 data-testid={`badge-status-${driver.id}`}
 >
 {driver.isAvailableForDelivery === 1 ? "متاح" : "غير متاح"}
 </Badge>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="space-y-2">
 <div className="flex items-center gap-2 text-gray-300">
 <Phone className="w-4 h-4 text-accent" />
 <span className="text-sm" dir="ltr">{driver.phone}</span>
 </div>
 <div className="flex items-center gap-2 text-gray-300">
 <Truck className="w-4 h-4 text-accent" />
 <span className="text-sm">
 {driver.vehicleType} - {driver.vehicleColor}
 </span>
 </div>
 <div className="bg-[#1a1410] p-2 rounded-lg">
 <p className="text-xs text-gray-400">لوح� المركب� </p>
 <p className="text-white font-mono font-semibold" data-testid={`text-plate-${driver.id}`}>
 {driver.vehiclePlateNumber}
 </p>
 </div>
 {driver.licenseNumber && (
 <div className="bg-[#1a1410] p-2 rounded-lg">
 <p className="text-xs text-gray-400">رقم الر� ص� </p>
 <p className="text-white font-mono" data-testid={`text-license-${driver.id}`}>
 {driver.licenseNumber}
 </p>
 </div>
 )}
 </div>

 <div className="flex gap-2 pt-3 border-t border-primary/20">
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleToggleAvailability(driver)}
 className={`flex-1 ${
 driver.isAvailableForDelivery === 1
 ? "border-green-500/30 text-green-500"
 : "border-gray-500/30 text-gray-500"
 }`}
 disabled={toggleAvailabilityMutation.isPending}
 data-testid={`button-toggle-${driver.id}`}
 >
 {driver.isAvailableForDelivery === 1 ? (
 <>
 <CheckCircle className="w-4 h-4 ml-1" />
 متاح
 </>
 ) : (
 <>
 <XCircle className="w-4 h-4 ml-1" />
 غير متاح
 </>
 )}
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleEdit(driver)}
 className="border-blue-500/30 text-blue-500"
 data-testid={`button-edit-${driver.id}`}
 >
 <Edit2 className="w-4 h-4" />
 </Button>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>

 {/* Add Driver Dialog */}
 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
 <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">إضاف� سائق جديد</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmitNewDriver} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
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
 <Label htmlFor="phone" className="text-gray-300">رقم الهاتف *</Label>
 <Input
 id="phone"
 name="phone"
 type="tel"
 required
 placeholder="05xxxxxxxx"
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-phone"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="username" className="text-gray-300">اسم المست� دم *</Label>
 <Input
 id="username"
 name="username"
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-username"
 />
 </div>
 <div>
 <Label htmlFor="password" className="text-gray-300">كلم� المرور *</Label>
 <Input
 id="password"
 name="password"
 type="password"
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-password"
 />
 </div>
 </div>

 <div className="border-t border-primary/20 pt-4">
 <h3 className="text-accent font-semibold mb-3">معلومات المركب� </h3>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="vehicleType" className="text-gray-300">نوع المركب� *</Label>
 <Select name="vehicleType" required>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-vehicle-type">
 <SelectValue placeholder="ا� تر نوع المركب� " />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 <SelectItem value="سيار� ">سيار� </SelectItem>
 <SelectItem value="دراج� ناري� ">دراج� ناري� </SelectItem>
 <SelectItem value="دراج� كهربائي� ">دراج� كهربائي� </SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="vehicleColor" className="text-gray-300">لون المركب� *</Label>
 <Input
 id="vehicleColor"
 name="vehicleColor"
 required
 placeholder="مثال: أبيض"
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-vehicle-color"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4 mt-4">
 <div>
 <Label htmlFor="vehiclePlateNumber" className="text-gray-300">رقم اللوح� *</Label>
 <Input
 id="vehiclePlateNumber"
 name="vehiclePlateNumber"
 required
 placeholder="ABC 1234"
 className="bg-[#1a1410] border-primary/30 text-white font-mono"
 data-testid="input-plate-number"
 />
 </div>
 <div>
 <Label htmlFor="licenseNumber" className="text-gray-300">رقم الر� ص� </Label>
 <Input
 id="licenseNumber"
 name="licenseNumber"
 className="bg-[#1a1410] border-primary/30 text-white font-mono"
 data-testid="input-license-number"
 />
 </div>
 </div>
 </div>

 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => setIsAddDialogOpen(false)}
 className="border-gray-600 text-gray-300"
 data-testid="button-cancel"
 >
 إلغاء
 </Button>
 <Button
 type="submit"
 disabled={createDriverMutation.isPending}
 className="bg-gradient-to-r from-green-500 to-green-700"
 data-testid="button-submit"
 >
 {createDriverMutation.isPending ? "جاري الإضاف� ..." : "إضاف� السائق"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>

 {/* Edit Driver Dialog */}
 <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
 <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">تعديل معلومات السائق</DialogTitle>
 </DialogHeader>
 {editingDriver && (
 <form onSubmit={handleSubmitEditDriver} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-fullName" className="text-gray-300">الاسم الكامل *</Label>
 <Input
 id="edit-fullName"
 name="fullName"
 defaultValue={editingDriver.fullName}
 required
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
 defaultValue={editingDriver.phone}
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-phone"
 />
 </div>
 </div>

 <div className="border-t border-primary/20 pt-4">
 <h3 className="text-accent font-semibold mb-3">معلومات المركب� </h3>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-vehicleType" className="text-gray-300">نوع المركب� *</Label>
 <Select name="vehicleType" defaultValue={editingDriver.vehicleType} required>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-edit-vehicle-type">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 <SelectItem value="سيار� ">سيار� </SelectItem>
 <SelectItem value="دراج� ناري� ">دراج� ناري� </SelectItem>
 <SelectItem value="دراج� كهربائي� ">دراج� كهربائي� </SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="edit-vehicleColor" className="text-gray-300">لون المركب� *</Label>
 <Input
 id="edit-vehicleColor"
 name="vehicleColor"
 defaultValue={editingDriver.vehicleColor}
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-vehicle-color"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4 mt-4">
 <div>
 <Label htmlFor="edit-vehiclePlateNumber" className="text-gray-300">رقم اللوح� *</Label>
 <Input
 id="edit-vehiclePlateNumber"
 name="vehiclePlateNumber"
 defaultValue={editingDriver.vehiclePlateNumber}
 required
 className="bg-[#1a1410] border-primary/30 text-white font-mono"
 data-testid="input-edit-plate-number"
 />
 </div>
 <div>
 <Label htmlFor="edit-licenseNumber" className="text-gray-300">رقم الر� ص� </Label>
 <Input
 id="edit-licenseNumber"
 name="licenseNumber"
 defaultValue={editingDriver.licenseNumber}
 className="bg-[#1a1410] border-primary/30 text-white font-mono"
 data-testid="input-edit-license-number"
 />
 </div>
 </div>
 </div>

 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => {
 setIsEditDialogOpen(false);
 setEditingDriver(null);
 }}
 className="border-gray-600 text-gray-300"
 data-testid="button-edit-cancel"
 >
 إلغاء
 </Button>
 <Button
 type="submit"
 disabled={updateDriverMutation.isPending}
 className="bg-gradient-to-r from-blue-500 to-blue-700"
 data-testid="button-edit-submit"
 >
 {updateDriverMutation.isPending ? "جاري التحديث..." : "تحديث المعلومات"}
 </Button>
 </div>
 </form>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}

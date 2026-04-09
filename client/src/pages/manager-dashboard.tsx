import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import BranchLocationPicker from "@/components/branch-location-picker";
import CouponManagement from "@/components/coupon-management";
import { DeliveryManagement } from "@/components/delivery-management";
import { 
 Coffee, Users, ShoppingBag, TrendingUp, DollarSign, 
 Package, MapPin, Layers, ArrowLeft, Calendar, Warehouse,
 UserCheck, Receipt, BarChart3, Download, TrendingDown, Activity, Plus, Trash2, ExternalLink, Edit2, Search,
 Gift, Star, Banknote
} from "lucide-react";
import * as XLSX from 'xlsx';
import { 
 AreaChart, Area, BarChart as RechartsBar, Bar, 
 PieChart, Pie, Cell, LineChart, Line,
 XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
 ResponsiveContainer 
} from "recharts";
import type { Employee, Order, Customer } from "@shared/schema";
import SarIcon from "@/components/sar-icon";

interface EmployeeWithStats extends Employee {
 orderCount?: number;
 totalSales?: number;
}

const SAUDI_CITIES = [
 { name: 'الرياض | Riyadh', lat: '24.7136', lon: '46.6753' },
 { name: 'جدة | Jeddah', lat: '21.5433', lon: '39.1728' },
 { name: 'الدمام | Dammam', lat: '26.4124', lon: '50.1971' },
 { name: 'مكة المكرمة | Mecca', lat: '21.4225', lon: '39.8262' },
 { name: 'المدينة المنورة | Medina', lat: '24.4672', lon: '39.6024' },
 { name: 'الخبر | Khobar', lat: '26.1588', lon: '50.2046' },
 { name: 'الظهران | Dhahran', lat: '26.1428', lon: '50.1436' },
 { name: 'عرعر | Arar', lat: '30.9753', lon: '41.0272' },
 { name: 'طريف | Turaif', lat: '31.6778', lon: '39.6444' },
 { name: 'القصيم | Qassim', lat: '26.1669', lon: '44.0056' },
 { name: 'حائل | Hail', lat: '27.5247', lon: '41.7202' },
 { name: 'الجوف | Al Jouf', lat: '29.7833', lon: '40.8333' },
 { name: 'الباحة | Al Bahah', lat: '19.9885', lon: '41.4359' },
 { name: 'عسير | Asir', lat: '18.2147', lon: '42.5053' },
 { name: 'الطائف | Taif', lat: '21.2704', lon: '40.4156' },
 { name: 'ينبع | Yanbu', lat: '24.0887', lon: '38.0697' },
 { name: 'الليث | Lith', lat: '20.2381', lon: '40.1797' },
 { name: 'رفحاء | Rafha', lat: '29.6000', lon: '43.4833' },
 { name: 'سكاكا | Sakaka', lat: '29.9709', lon: '40.2056' },
 { name: 'بريدة | Buraydah', lat: '26.3263', lon: '43.9750' },
];

export default function ManagerDashboard() {
 const [, setLocation] = useLocation();
 const [manager, setManager] = useState<Employee | null>(null);
 const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("all");

 // Set SEO metadata
 useEffect(() => {
   document.title = "لوحة تحكم المدير - CLUNY CAFE | إدارة المبيعات والعمليات";
   const metaDesc = document.querySelector('meta[name="description"]');
   if (metaDesc) metaDesc.setAttribute('content', 'لوحة تحكم المدير في CLUNY CAFE - إدارة شاملة للمبيعات والموظفين والفروع والمخزون');
 }, []);
 const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
 const [isEditBranchOpen, setIsEditBranchOpen] = useState(false);
 const [editingBranch, setEditingBranch] = useState<any>(null);
 const [branchForm, setBranchForm] = useState({
 nameAr: "",
 nameEn: "",
 address: "",
 phone: "",
 city: "",
 managerName: "",
 mapsUrl: "",
 latitude: 24.7136,
 longitude: 46.6753,
 });
 const [branchSearchQuery, setBranchSearchQuery] = useState<string>("");
 const [branchSearchResults, setBranchSearchResults] = useState<Array<{ name: string; lat: string; lon: string }>>([]);
 const [showBranchResults, setShowBranchResults] = useState(false);
 const [isSearchingBranch, setIsSearchingBranch] = useState(false);
 const [managerAssignmentType, setManagerAssignmentType] = useState<"existing" | "new">("existing");
 const [selectedManagerId, setSelectedManagerId] = useState<string>("");
 const [newManagerForm, setNewManagerForm] = useState({
 fullName: "",
 username: "",
 phone: "",
 });
 const { toast } = useToast();
 const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
 const [ordersDisplayLimit, setOrdersDisplayLimit] = useState(20);

 const deleteOrdersMutation = useMutation({
   mutationFn: async (ids: string[]) => {
     return apiRequest("DELETE", "/api/orders/bulk", { ids });
   },
   onSuccess: (_, ids) => {
     queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
     setSelectedOrderIds(new Set());
     toast({ title: `تم حذف ${ids.length} طلب بنجاح`, variant: "default" });
   },
   onError: () => {
     toast({ title: "خطأ في حذف الطلبات", variant: "destructive" });
   },
 });

 const handleBulkDelete = () => {
   const ids = Array.from(selectedOrderIds);
   if (ids.length === 0) return;
   if (!window.confirm(`هل تريد حذف ${ids.length} طلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
   deleteOrdersMutation.mutate(ids);
 };

 useEffect(() => {
 const checkSession = async () => {
 const storedEmployee = localStorage.getItem("currentEmployee");
 if (storedEmployee) {
 const emp = JSON.parse(storedEmployee);
 if (emp.role !== "manager" && emp.role !== "admin") {
 localStorage.removeItem("currentEmployee");
 setLocation("/employee/dashboard");
 return;
 }

 try {
 const response = await fetch("/api/verify-session", { credentials: "include" });
 if (!response.ok) {
 localStorage.removeItem("currentEmployee");
 setLocation("/manager/login");
 return;
 }
 setManager(emp);
 } catch (error) {
 console.error("Session verification error:", error);
 localStorage.removeItem("currentEmployee");
 setLocation("/manager/login");
 }
 } else {
 setLocation("/manager/login");
 }
 };

 checkSession();
 }, [setLocation]);

 const isAdmin = manager?.role === "admin";
 const managerBranchId = manager?.branchId;

 const searchBranchLocations = async (query: string) => {
 if (query.length < 1) {
 setBranchSearchResults([]);
 return;
 }
 
 setIsSearchingBranch(true);
 try {
 // First, search through predefined Saudi cities
 const filteredCities = SAUDI_CITIES.filter(city =>
 city.name.includes(query) || 
 city.name.toLowerCase().includes(query.toLowerCase()) ||
 city.name.includes(query.toLowerCase())
 );
 
 if (filteredCities.length > 0) {
 setBranchSearchResults(filteredCities);
 setShowBranchResults(true);
 setIsSearchingBranch(false);
 return;
 }
 
 // If no cities match, try Nominatim for custom locations
 if (query.length >= 2) {
 const response = await fetch(
 `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}, Saudi Arabia&format=json&limit=5&countrycodes=sa`
 );
 const data = await response.json();
 setBranchSearchResults(data || []);
 setShowBranchResults(true);
 } else {
 // Show suggestions when query is too short
 const suggestions = SAUDI_CITIES.slice(0, 5);
 setBranchSearchResults(suggestions);
 setShowBranchResults(true);
 }
 } catch (error) {
 console.error("Error searching branch locations:", error);
 setBranchSearchResults([]);
 } finally {
 setIsSearchingBranch(false);
 }
 };

 const handleBranchSearchChange = (value: string) => {
 setBranchSearchQuery(value);
 setTimeout(() => {
 searchBranchLocations(value);
 }, 500);
 };

 const handleSelectBranchLocation = (location: { name: string; lat: string; lon: string }) => {
 setBranchForm({
 ...branchForm,
 address: location.name,
 latitude: parseFloat(location.lat),
 longitude: parseFloat(location.lon),
 });
 setBranchSearchQuery("");
 setShowBranchResults(false);
 setBranchSearchResults([]);
 };

 const { data: allEmployees = [] } = useQuery<Employee[]>({
 queryKey: ["/api/employees"],
 enabled: !!manager,
 });

 const employees = isAdmin 
   ? allEmployees 
   : allEmployees.filter(emp => emp.branchId === managerBranchId || emp.role === 'manager' || emp.role === 'admin');

 const { data: customers = [] } = useQuery<Customer[]>({
 queryKey: ["/api/customers"],
 enabled: !!manager,
 });

 const { data: allOrders = [] } = useQuery<Order[]>({
 queryKey: ["/api/orders"],
 enabled: !!manager,
 refetchInterval: !!manager ? 60000 : false,
 staleTime: 30000,
 });

 const orders = isAdmin ? allOrders : allOrders.filter(order => order.branchId === managerBranchId);

 const { data: allBranches = [] } = useQuery<any[]>({
 queryKey: ["/api/branches"],
 enabled: !!manager,
 });

 const branches = isAdmin ? allBranches : allBranches.filter(branch => branch.id === managerBranchId);

 const availableManagers = allEmployees.filter(emp => 
 emp.role === "manager" || emp.role === "admin"
 );

 const createBranchMutation = useMutation({
 mutationFn: async (branchData: typeof branchForm & { 
 managerAssignment?: { type: "existing" | "new"; managerId?: string; newManager?: typeof newManagerForm } 
 }) => {
 const payload: any = {
 nameAr: branchData.nameAr,
 nameEn: branchData.nameEn || undefined,
 address: branchData.address,
 phone: branchData.phone,
 city: branchData.city,
 managerName: branchData.managerName || undefined,
 mapsUrl: branchData.mapsUrl || undefined,
 location: {
 lat: branchData.latitude,
 lng: branchData.longitude,
 },
 isActive: 1,
 managerAssignment: branchData.managerAssignment,
 };

 const response = await fetch("/api/branches", {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 },
 body: JSON.stringify(payload),
 credentials: "include",
 });
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || "Failed to create branch");
 }
 return response.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
 queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
 setIsAddBranchOpen(false);
 setBranchForm({
 nameAr: "",
 nameEn: "",
 address: "",
 phone: "",
 city: "",
 managerName: "",
 mapsUrl: "",
 latitude: 24.7136,
 longitude: 46.6753,
 });
 setManagerAssignmentType("existing");
 setSelectedManagerId("");
 setNewManagerForm({ fullName: "", username: "", phone: "" });
 toast({
 title: "تم إضافة الفرع بنجاح",
 description: "تم إضافة الفرع الجديد إلى النظام",
 });
 },
 onError: (error: any) => {
 toast({
 title: "خطأ في إضافة الفرع",
 description: error.message || "حدث خطأ أثناء إضافة الفرع",
 variant: "destructive",
 });
 },
 });

 const deleteBranchMutation = useMutation({
 mutationFn: async (branchId: string) => {
 await apiRequest("DELETE", `/api/branches/${branchId}`, {});
 return true;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
 toast({
 title: "تم حذف الفرع بنجاح",
 description: "تم إزالة الفرع من النظام",
 });
 },
 onError: (error: any) => {
 toast({
 title: "خطأ في حذف الفرع",
 description: error.message || "حدث خطأ أثناء حذف الفرع",
 variant: "destructive",
 });
 },
 });

 const updateBranchMutation = useMutation({
 mutationFn: async (branchData: { id: string; data: typeof branchForm }) => {
 const payload: any = {
 nameAr: branchData.data.nameAr,
 nameEn: branchData.data.nameEn || undefined,
 address: branchData.data.address,
 phone: branchData.data.phone,
 city: branchData.data.city,
 managerName: branchData.data.managerName || undefined,
 mapsUrl: branchData.data.mapsUrl || undefined,
 location: {
 lat: branchData.data.latitude,
 lng: branchData.data.longitude,
 },
 isActive: 1,
 };

 const response = await fetch(`/api/branches/${branchData.id}`, {
 method: "PUT",
 headers: {
 "Content-Type": "application/json",
 },
 body: JSON.stringify(payload),
 credentials: "include",
 });
 if (!response.ok) {
 try {
 const error = await response.json();
 throw new Error(error.error || "Failed to update branch");
 } catch (parseError) {
 throw new Error("Failed to update branch - Server error");
 }
 }
 return response.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
 setIsEditBranchOpen(false);
 setEditingBranch(null);
 setBranchForm({
 nameAr: "",
 nameEn: "",
 address: "",
 phone: "",
 city: "",
 managerName: "",
 mapsUrl: "",
 latitude: 24.7136,
 longitude: 46.6753,
 });
 toast({
 title: "تم تحديث الفرع بنجاح",
 description: "تم تحديث بيانات الفرع",
 });
 },
 onError: (error: any) => {
 toast({
 title: "خطأ في تحديث الفرع",
 description: error.message || "حدث خطأ أثناء تحديث الفرع",
 variant: "destructive",
 });
 },
 });

 const handleLogout = () => {
 localStorage.removeItem("currentEmployee");
 setLocation("/employee/gateway");
 };

 const handleCreateBranch = () => {
 if (!branchForm.nameAr || !branchForm.address || !branchForm.city || !branchForm.phone) {
 toast({
 title: "بيانات ناقصة",
 description: "الرجاء إدخال جميع البيانات المطلوبة",
 variant: "destructive",
 });
 return;
 }
 
 if (managerAssignmentType === "new" && (!newManagerForm.fullName || !newManagerForm.username || !newManagerForm.phone)) {
 toast({
 title: "بيانات المدير ناقصة",
 description: "الرجاء إدخال جميع بيانات المدير الجديد",
 variant: "destructive",
 });
 return;
 }
 
 const payload = {
 ...branchForm,
 managerAssignment: managerAssignmentType === "new" 
 ? { type: "new" as const, newManager: newManagerForm }
 : selectedManagerId 
 ? { type: "existing" as const, managerId: selectedManagerId }
 : undefined
 };
 
 createBranchMutation.mutate(payload);
 };

 const handleEditBranch = () => {
 if (!editingBranch) return;
 if (!branchForm.nameAr || !branchForm.address || !branchForm.city || !branchForm.phone) {
 toast({
 title: "بيانات ناقصة",
 description: "الرجاء إدخال جميع البيانات المطلوبة",
 variant: "destructive",
 });
 return;
 }
 
 updateBranchMutation.mutate({
 id: editingBranch.id,
 data: branchForm
 });
 };

 const openEditDialog = (branch: any) => {
 setEditingBranch(branch);
 setBranchForm({
 nameAr: branch.nameAr || "",
 nameEn: branch.nameEn || "",
 address: branch.address || "",
 phone: branch.phone || "",
 city: branch.city || "",
 managerName: branch.managerName || "",
 mapsUrl: branch.mapsUrl || "",
 latitude: branch.location?.lat || 24.7136,
 longitude: branch.location?.lng || 46.6753,
 });
 setIsEditBranchOpen(true);
 };

 const handleExportData = () => {
 try {
 const ordersData = filteredOrders.map(order => {
 const employee = employees.find(e => e.id === order.employeeId);
 return {
 'رقم الطلب': order.orderNumber,
 'التاريخ ': order.createdAt ? new Date(order.createdAt).toLocaleString('ar-SA') : '',
 'اسم العميل': order.customerInfo?.name || '',
 'رقم الجوال': order.customerInfo?.phone || '',
 'رقم الطاولة ': order.tableNumber || '',
 'الحالة': order.status,
 'طريقة الدفع': order.paymentMethod === 'cash' ? 'نقدي' : order.paymentMethod,
 'الكاشير': employee?.fullName || '',
 'الإجمالي': Number(order.totalAmount).toFixed(2),
 };
 });

 const topItemsExport = topItemsData.map(item => ({
 'المنتج': item.name,
 'عدد المبيعات': item.count,
 'الإيرادات': item.revenue.toFixed(2),
 }));

 const employeesExport = employeesWithStats.map(emp => ({
 'الاسم': emp.fullName,
 'الوظيفة': emp.jobTitle,
 'الدور': emp.role === 'manager' ? 'مدير' : 'كاشير',
 'رقم الجوال': emp.phone,
 'عدد الطلبات': emp.orderCount || 0,
 'إجمالي المبيعات': (emp.totalSales || 0).toFixed(2),
 }));

 const wb = XLSX.utils.book_new();
 
 const wsOrders = XLSX.utils.json_to_sheet(ordersData);
 const wsTopItems = XLSX.utils.json_to_sheet(topItemsExport);
 const wsEmployees = XLSX.utils.json_to_sheet(employeesExport);
 
 XLSX.utils.book_append_sheet(wb, wsOrders, 'الطلبات');
 XLSX.utils.book_append_sheet(wb, wsTopItems, 'أكثر المنتجات مبيعاً');
 XLSX.utils.book_append_sheet(wb, wsEmployees, 'الموظفين');

 const dateStr = new Date().toLocaleDateString('ar-SA').replace(/\//g, '-');
 const fileName = `تقرير-المبيعات-${dateStr}.xlsx`;

 XLSX.writeFile(wb, fileName);

 toast({
 title: "تم التصدير بنجاح",
 description: "تم تصدير البيانات إلى ملف Excel",
 });
 } catch (error) {
 toast({
 title: "خطأ في التصدير",
 description: "حدث خطأ أثناء تصدير البيانات",
 variant: "destructive",
 });
 }
 };

 const clearAllDataMutation = useMutation({
   mutationFn: async () => {
     const response = await fetch('/api/admin/clear-all-data', {
       method: 'DELETE',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
     });
     if (!response.ok) throw new Error('Failed to clear data');
     return response.json();
   },
   onSuccess: (data) => {
     queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
     queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
     toast({
       title: "تم بنجاح",
       description: data.message,
       variant: "destructive",
     });
   },
   onError: () => {
     toast({
       title: "خطأ",
       description: "فشل تنظيف البيانات",
       variant: "destructive",
     });
   },
 });

 if (!manager) {
 return <LoadingState message="جاري التحميل..." />;
 }

 const getFilteredOrders = () => {
 const now = new Date();
 return orders.filter(order => {
 if (order.status === 'cancelled') return false;
 if (!order.createdAt) return dateFilter === "all";
 
 const orderDate = new Date(order.createdAt);
 if (isNaN(orderDate.getTime())) return dateFilter === "all";
 
 switch (dateFilter) {
 case "today":
 return orderDate.toDateString() === now.toDateString();
 case "week":
 const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
 return orderDate >= weekAgo;
 case "month":
 const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
 return orderDate >= monthAgo;
 default:
 return true;
 }
 });
 };

 const filteredOrders = getFilteredOrders();
 const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
 const completedOrders = filteredOrders.filter(o => o.status === "completed");
 const completedRevenue = completedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
 
 const todayOrders = orders.filter(o => {
 if (o.status === 'cancelled') return false;
 if (!o.createdAt) return false;
 const orderDate = new Date(o.createdAt);
 if (isNaN(orderDate.getTime())) return false;
 const today = new Date();
 return orderDate.toDateString() === today.toDateString();
 });
 const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

 const employeesWithStats: EmployeeWithStats[] = employees.map(emp => {
 const empId = emp.id?.toString();
 const empOrders = filteredOrders.filter(o => {
 const orderEmpId = o.employeeId?.toString();
 return orderEmpId === empId;
 });
 return {
 ...emp,
 orderCount: empOrders.length,
 totalSales: empOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
 } as EmployeeWithStats;
 })
 .sort((a, b) => {
 const roleOrder = { 'admin': 0, 'manager': 1, 'cashier': 2 };
 const aRole = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
 const bRole = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
 if (aRole !== bRole) return aRole - bRole;
 return (b.totalSales || 0) - (a.totalSales || 0);
 });

 const dailyRevenueData = (() => {
 const days: Record<string, number> = {};
 filteredOrders.forEach(order => {
 if (!order.createdAt) return;
 const orderDate = new Date(order.createdAt);
 if (isNaN(orderDate.getTime())) return;
 
 const dateStr = orderDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
 days[dateStr] = (days[dateStr] || 0) + Number(order.totalAmount || 0);
 });
 return Object.entries(days).map(([date, revenue]) => ({
 date,
 revenue: Number(revenue.toFixed(2))
 })).slice(-14);
 })();

 const paymentMethodsData = (() => {
 const methods: Record<string, number> = {};
 filteredOrders.forEach(order => {
 methods[order.paymentMethod] = (methods[order.paymentMethod] || 0) + 1;
 });
 return Object.entries(methods).map(([name, value]) => ({
 name: name === 'cash' ? 'نقدي' : name,
 value
 }));
 })();

 const topItemsData = (() => {
 const items: Record<string, { count: number; revenue: number }> = {};
 filteredOrders.forEach(order => {
 const orderItems = Array.isArray(order.items) ? order.items : [];
 orderItems.forEach((item: any) => {
 const name = item.coffeeItem?.nameAr || item.nameAr || 'مشروب';
 if (!items[name]) {
 items[name] = { count: 0, revenue: 0 };
 }
 items[name].count += item.quantity || 0;
 items[name].revenue += (item.quantity || 0) * Number(item.price || item.coffeeItem?.price || 0);
 });
 });
 return Object.entries(items)
 .map(([name, data]) => ({
 name,
 count: data.count,
 revenue: Number(data.revenue.toFixed(2))
 }))
 .sort((a, b) => b.revenue - a.revenue)
 .slice(0, 10);
 })();

 const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))', 'hsl(var(--secondary))'];
 
 const growthRate = (() => {
 if (dateFilter === "today" || dateFilter === "all") return 0;
 const now = new Date();
 const periodStart = dateFilter === "week" ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
 dateFilter === "month" ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) : null;
 if (!periodStart) return 0;
 
 const periodOrders = orders.filter(o => {
 if (o.status === 'cancelled') return false;
 if (!o.createdAt) return false;
 const date = new Date(o.createdAt);
 return !isNaN(date.getTime()) && date >= periodStart;
 });
 
 const prevPeriodEnd = periodStart;
 const prevPeriodStart = dateFilter === "week" ? new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000) :
 new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000);
 const prevPeriodOrders = orders.filter(o => {
 if (o.status === 'cancelled') return false;
 if (!o.createdAt) return false;
 const date = new Date(o.createdAt);
 return !isNaN(date.getTime()) && date >= prevPeriodStart && date < prevPeriodEnd;
 });
 
 const currentRevenue = periodOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
 const previousRevenue = prevPeriodOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
 
 if (previousRevenue === 0) return currentRevenue > 0 ? 100 : 0;
 return Number((((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1));
 })();

 return (
 <div className="min-h-screen bg-background p-6" dir="rtl">
 <div className="max-w-7xl mx-auto">
 <header className="bg-card backdrop-blur-sm rounded-2xl border border-border p-6 mb-6">
 <div className="flex items-center justify-between gap-4 flex-wrap">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-lg">
 <Coffee className="w-7 h-7 text-primary-foreground" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-primary">
 لوحة تحكم المدير
 </h1>
 <p className="text-muted-foreground text-sm">مرحباً، {manager.fullName}</p>
 </div>
 </div>
 <div className="flex items-center gap-3 flex-wrap">
 <Button
 variant="outline"
 onClick={handleLogout}
 data-testid="button-logout"
 >
 تسجيل الخروج
 </Button>
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/dashboard")}
 data-testid="button-back"
 >
 <ArrowLeft className="w-4 h-4 ml-2" />
 رجوع
 </Button>
 </div>
 </div>
 </header>

 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
 <Button
 onClick={() => setLocation("/employee/pos")}
 className="h-20 flex flex-col gap-2 rounded-xl"
 data-testid="button-pos"
 >
 <Package className="w-6 h-6" />
 <span className="text-sm">نقاط البيع</span>
 </Button>
 <Button
 onClick={() => setLocation("/manager/inventory")}
 variant="outline"
 className="h-20 flex flex-col gap-2 rounded-xl"
 data-testid="button-inventory"
 >
 <Warehouse className="w-6 h-6" />
 <span className="text-sm">المخزون</span>
 </Button>
 <Button
 onClick={() => setLocation("/manager/attendance")}
 variant="outline"
 className="h-20 flex flex-col gap-2 rounded-xl"
 data-testid="button-attendance"
 >
 <UserCheck className="w-6 h-6" />
 <span className="text-sm">الحضور</span>
 </Button>
 <Button
 onClick={handleExportData}
 variant="outline"
 className="h-20 flex flex-col gap-2 rounded-xl"
 data-testid="button-export"
 >
 <Download className="w-6 h-6" />
 <span className="text-sm">تصدير Excel</span>
 </Button>
 <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
 <SelectTrigger className="h-20 flex flex-col gap-2 bg-card border-border rounded-xl">
 <Calendar className="w-6 h-6" />
 <span className="text-sm">
 {dateFilter === "today" ? "اليوم" : dateFilter === "week" ? "أسبوع" : dateFilter === "month" ? "شهر" : "الكل"}
 </span>
 </SelectTrigger>
 <SelectContent className="bg-card border-border">
 <SelectItem value="today">اليوم</SelectItem>
 <SelectItem value="week">آخر أسبوع</SelectItem>
 <SelectItem value="month">آخر شهر</SelectItem>
 <SelectItem value="all">كل الفترة</SelectItem>
 </SelectContent>
 </Select>
 {isAdmin && (
   <Button
     variant="destructive"
     onClick={() => {
       if (confirm('تحذير: هذا سيحذف جميع الطلبات والعملاء! هل تريد المتابعة؟')) {
         clearAllDataMutation.mutate();
       }
     }}
     disabled={clearAllDataMutation.isPending}
     className="h-20 flex flex-col gap-2 rounded-xl"
     data-testid="button-clear-all-data"
   >
     <Trash2 className="w-6 h-6" />
     <span className="text-xs">{clearAllDataMutation.isPending ? 'جاري...' : 'تنظيف'}</span>
   </Button>
 )}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <Card className="rounded-xl overflow-hidden">
 <div className="h-1 bg-primary" />
 <CardHeader className="pb-2 pt-4">
 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
 <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
 <Users className="w-4 h-4 text-primary" />
 </div>
 إجمالي العملاء
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-4xl font-bold text-foreground">{customers.length}</div>
 <p className="text-xs text-muted-foreground mt-1">عميل مسجل في النظام</p>
 </CardContent>
 </Card>

 <Card className="rounded-xl overflow-hidden">
 <div className="h-1 bg-accent" />
 <CardHeader className="pb-2 pt-4">
 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
 <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
 <ShoppingBag className="w-4 h-4 text-accent" />
 </div>
 الطلبات
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-4xl font-bold text-foreground">{filteredOrders.length}</div>
 <div className="flex items-center gap-2 mt-1">
 <Badge variant="secondary">{completedOrders.length} مكتمل</Badge>
 <span className="text-xs text-muted-foreground">
 {dateFilter === "today" ? "اليوم" : dateFilter === "week" ? "الأسبوع" : dateFilter === "month" ? "الشهر" : "الكل"}
 </span>
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-xl overflow-hidden">
 <div className="h-1 bg-primary" />
 <CardHeader className="pb-2 pt-4">
 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
 <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
 <DollarSign className="w-4 h-4 text-primary" />
 </div>
 إجمالي المبيعات
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-4xl font-bold text-primary">{totalRevenue.toFixed(2)}</div>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-xs text-muted-foreground"><SarIcon /></span>
 {growthRate !== 0 && (
 <Badge variant={growthRate > 0 ? "default" : "destructive"}>
 {growthRate > 0 ? <TrendingUp className="w-3 h-3 ml-1" /> : <TrendingDown className="w-3 h-3 ml-1" />}
 {growthRate > 0 ? '+' : ''}{growthRate}%
 </Badge>
 )}
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-xl overflow-hidden">
 <div className="h-1 bg-secondary" />
 <CardHeader className="pb-2 pt-4">
 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
 <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
 <Activity className="w-4 h-4 text-secondary-foreground" />
 </div>
 متوسط الطلب
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-4xl font-bold text-foreground">
 {filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : '0.00'}
 </div>
 <p className="text-xs text-muted-foreground mt-1">ريال سعودي لكل طلب</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="orders" className="space-y-4">
 <TabsList className="grid w-full grid-cols-8 h-14">
 <TabsTrigger value="orders" className="rounded-lg">الطلبات</TabsTrigger>
 <TabsTrigger value="analytics" className="rounded-lg">التحليلات</TabsTrigger>
 <TabsTrigger value="top-items" className="rounded-lg">الأكثر مبيعاً</TabsTrigger>
 <TabsTrigger value="employees" className="rounded-lg">أداء الموظفين</TabsTrigger>
 <TabsTrigger value="branches" className="rounded-lg">الفروع</TabsTrigger>
 <TabsTrigger value="coupons" className="rounded-lg">الكوبونات</TabsTrigger>
 <TabsTrigger value="delivery" className="rounded-lg">التوصيل</TabsTrigger>
 <TabsTrigger value="erp" className="rounded-lg">المحاسبة</TabsTrigger>
 </TabsList>

 <TabsContent value="orders" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div>
 <CardTitle>سجل الطلبات</CardTitle>
 <CardDescription>آخر {filteredOrders.length} طلب مسجل في النظام</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 {selectedOrderIds.size > 0 && (
 <Button
 variant="destructive"
 size="sm"
 onClick={handleBulkDelete}
 disabled={deleteOrdersMutation.isPending}
 data-testid="button-bulk-delete-orders"
 className="gap-2"
 >
 <Trash2 className="w-4 h-4" />
 حذف المحدد ({selectedOrderIds.size})
 </Button>
 )}
 <Button
 variant="outline"
 size="sm"
 onClick={() => {
 if (selectedOrderIds.size === filteredOrders.length) {
 setSelectedOrderIds(new Set());
 } else {
 setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
 }
 }}
 data-testid="button-select-all-orders"
 className="gap-2"
 >
 <Checkbox
 checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
 className="pointer-events-none"
 />
 {selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 ? 'إلغاء الكل' : 'تحديد الكل'}
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {filteredOrders.length === 0 ? (
 <EmptyState title="لا يوجد طلبات" description="لم يتم العثور على طلبات في هذه الفترة" />
 ) : (
 <>
 {filteredOrders.slice(0, ordersDisplayLimit).map((order) => {
 const employee = employees.find(e => e.id === order.employeeId);
 const isSelected = selectedOrderIds.has(order.id);
 return (
 <div
 key={order.id}
 className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4 transition-colors cursor-pointer ${
 isSelected ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30 hover:bg-muted/50'
 }`}
 onClick={() => {
 const next = new Set(selectedOrderIds);
 if (next.has(order.id)) next.delete(order.id);
 else next.add(order.id);
 setSelectedOrderIds(next);
 }}
 data-testid={`order-row-${order.id}`}
 >
 <div className="flex items-center gap-3">
 <Checkbox
 checked={isSelected}
 onCheckedChange={() => {
 const next = new Set(selectedOrderIds);
 if (next.has(order.id)) next.delete(order.id);
 else next.add(order.id);
 setSelectedOrderIds(next);
 }}
 onClick={e => e.stopPropagation()}
 data-testid={`checkbox-order-${order.id}`}
 />
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Receipt className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="font-bold text-foreground">طلب {order.orderNumber}</p>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <span>{order.createdAt ? new Date(order.createdAt).toLocaleString('ar-SA') : ''}</span>
 <span>•</span>
 <span>{order.customerInfo?.name || employee?.fullName || 'عميل'}</span>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-4 justify-between sm:justify-end" onClick={e => e.stopPropagation()}>
 <div className="text-left sm:text-right">
 <p className="font-bold text-primary">{Number(order.totalAmount).toFixed(2)} <SarIcon /></p>
 <Badge variant={order.status === "completed" ? "default" : "secondary"}>
 {order.status}
 </Badge>
 </div>
 <Button variant="ghost" size="icon" onClick={() => setLocation(`/order-receipt/${order.id}`)}>
 <ExternalLink className="w-4 h-4" />
 </Button>
 </div>
 </div>
 );
 })}
 {filteredOrders.length > ordersDisplayLimit && (
 <Button
 variant="outline"
 className="w-full mt-2"
 onClick={() => setOrdersDisplayLimit(prev => prev + 20)}
 data-testid="button-show-more-orders"
 >
 عرض المزيد ({filteredOrders.length - ordersDisplayLimit} طلب متبقٍ)
 </Button>
 )}
 </>
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="analytics" className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
   <Button variant="outline" onClick={() => setLocation("/manager/analytics")} className="flex flex-col h-16 gap-1" data-testid="btn-advanced-analytics">
     <BarChart3 className="w-5 h-5 text-cyan-500" /><span className="text-xs">تحليلات متقدمة</span>
   </Button>
   <Button variant="outline" onClick={() => setLocation("/manager/gift-cards")} className="flex flex-col h-16 gap-1" data-testid="btn-gift-cards">
     <Gift className="w-5 h-5 text-pink-500" /><span className="text-xs">بطاقات الهدايا</span>
   </Button>
   <Button variant="outline" onClick={() => setLocation("/manager/payroll")} className="flex flex-col h-16 gap-1" data-testid="btn-payroll">
     <Banknote className="w-5 h-5 text-green-500" /><span className="text-xs">كشف الرواتب</span>
   </Button>
   <Button variant="outline" onClick={() => setLocation("/manager/reviews")} className="flex flex-col h-16 gap-1" data-testid="btn-reviews">
     <Star className="w-5 h-5 text-amber-500" /><span className="text-xs">تقييمات العملاء</span>
   </Button>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <Card>
 <CardHeader>
 <CardTitle>إجمالي المبيعات اليومية</CardTitle>
 </CardHeader>
 <CardContent className="h-[300px]">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={dailyRevenueData}>
 <defs>
 <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="date" />
 <YAxis />
 <Tooltip />
 <Area type="monotone" dataKey="revenue" name="المبيعات" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>توزيع طرق الدفع</CardTitle>
 </CardHeader>
 <CardContent className="h-[300px]">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={paymentMethodsData}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={80}
 paddingAngle={5}
 dataKey="value"
 >
 {paymentMethodsData.map((_, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 </div>
 </TabsContent>

 <TabsContent value="top-items" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>المنتجات الأكثر مبيعاً</CardTitle>
 <CardDescription>ترتيب المنتجات حسب عدد المبيعات</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[400px]">
 <ResponsiveContainer width="100%" height="100%">
 <RechartsBar data={topItemsData} layout="vertical" margin={{ left: 40 }}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} />
 <XAxis type="number" />
 <YAxis dataKey="name" type="category" width={100} />
 <Tooltip />
 <Bar dataKey="count" name="عدد المبيعات" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
 </RechartsBar>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="employees" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>أداء الموظفين</CardTitle>
 <CardDescription>مبيعات الموظفين وعدد الطلبات لكل موظف</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {employeesWithStats.map((emp) => {
 const empId = emp.id?.toString();
 return (
 <div key={empId} className="p-4 border border-border rounded-xl bg-muted/30">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <Users className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="font-bold">{emp.fullName}</p>
 <Badge variant="outline" className="text-[10px]">{emp.role === 'admin' ? 'مدير عام' : emp.role === 'manager' ? 'مدير' : 'موظف'}</Badge>
 </div>
 </div>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">عدد الطلبات:</span>
 <span className="font-bold">{emp.orderCount || 0}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">إجمالي المبيعات:</span>
 <span className="font-bold text-primary">{(emp.totalSales || 0).toFixed(2)} <SarIcon /></span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="branches" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex justify-between items-center gap-4 flex-wrap">
 <div>
 <CardTitle className="text-primary">الفروع</CardTitle>
 <CardDescription>
 إدارة فروع المقهى
 </CardDescription>
 </div>
 {isAdmin && (
 <>
 <Button 
 data-testid="button-add-branch"
 onClick={() => setIsAddBranchOpen(true)}
 className="bg-accent hover:bg-accent"
 >
 <Plus className="w-4 h-4 ml-2" />
 إضافة فرع
 </Button>
 <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
 <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-[#708f87]">
 <DialogHeader>
 <DialogTitle className="text-primary text-xl">إضافة فرع جديد</DialogTitle>
 </DialogHeader>
 <div className="grid gap-4 py-4">
 <div className="grid gap-2">
 <Label htmlFor="nameAr">اسم الفرع (عربي) *</Label>
 <Input
 id="nameAr"
 value={branchForm.nameAr}
 onChange={(e) => setBranchForm({ ...branchForm, nameAr: e.target.value })}
 placeholder="مثال: فرع الرياض"
 data-testid="input-branch-name-ar"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="nameEn">اسم الفرع (إنجليزي)</Label>
 <Input
 id="nameEn"
 value={branchForm.nameEn}
 onChange={(e) => setBranchForm({ ...branchForm, nameEn: e.target.value })}
 placeholder="Example: Riyadh Branch"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="address">العنوان *</Label>
 <Input
 id="address"
 value={branchForm.address}
 onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
 placeholder="مثال: شارع الملك فهد"
 data-testid="input-branch-address"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="city">المدينة*</Label>
 <Input
 id="city"
 value={branchForm.city}
 onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
 placeholder="مثال: الرياض"
 data-testid="input-branch-city"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="phone">رقم الهاتف *</Label>
 <Input
 id="phone"
 value={branchForm.phone}
 onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
 placeholder="مثال: 0501234567"
 data-testid="input-branch-phone"
 />
 </div>
 <div className="space-y-4 border border-border rounded-lg p-4 bg-muted">
 <Label className="text-primary font-semibold flex items-center gap-2">
 <UserCheck className="w-4 h-4" />
 تعيين مدير الفرع
 </Label>
 
 <div className="flex gap-4">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="managerType"
 checked={managerAssignmentType === "existing"}
 onChange={() => setManagerAssignmentType("existing")}
 className="w-4 h-4 accent-primary"
 data-testid="radio-existing-manager"
 />
 <span className="text-foreground">تعيين مدير موجود</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="managerType"
 checked={managerAssignmentType === "new"}
 onChange={() => setManagerAssignmentType("new")}
 className="w-4 h-4 accent-primary"
 data-testid="radio-new-manager"
 />
 <span className="text-foreground">إنشاء مدير جديد</span>
 </label>
 </div>
 
 {managerAssignmentType === "existing" ? (
 <div className="grid gap-2">
 <Label>اختر المدير</Label>
 <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
 <SelectTrigger data-testid="select-existing-manager">
 <SelectValue placeholder="اختر مديراً موجوداً" />
 </SelectTrigger>
 <SelectContent>
 {availableManagers.length === 0 ? (
 <SelectItem value="none" disabled>لا يوجد مديرون متاحون</SelectItem>
 ) : (
 availableManagers.map((emp) => (
 <SelectItem key={emp.id} value={emp.id || ""}>
 {emp.fullName} - {emp.role === "admin" ? "مدير عام" : "مدير"}
 </SelectItem>
 ))
 )}
 </SelectContent>
 </Select>
 {availableManagers.length === 0 && (
 <p className="text-xs text-muted-foreground">لا يوجد مديرون متاحون. يمكنك إنشاء مدير جديد.</p>
 )}
 </div>
 ) : (
 <div className="grid gap-3">
 <div className="grid gap-1.5">
 <Label htmlFor="mgr-name">الاسم الكامل *</Label>
 <Input
 id="mgr-name"
 value={newManagerForm.fullName}
 onChange={(e) => setNewManagerForm({ ...newManagerForm, fullName: e.target.value })}
 placeholder="الاسم الكامل للمدير"
 data-testid="input-new-manager-name"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="mgr-user">اسم المستخدم *</Label>
 <Input
 id="mgr-user"
 value={newManagerForm.username}
 onChange={(e) => setNewManagerForm({ ...newManagerForm, username: e.target.value })}
 placeholder="اسم المستخدم للدخول"
 data-testid="input-new-manager-username"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="mgr-phone">رقم الجوال *</Label>
 <Input
 id="mgr-phone"
 value={newManagerForm.phone}
 onChange={(e) => setNewManagerForm({ ...newManagerForm, phone: e.target.value })}
 placeholder="مثال: 05XXXXXXXX"
 data-testid="input-new-manager-phone"
 />
 </div>
 </div>
 )}
 </div>
 
 <div className="grid gap-4">
 <div className="grid gap-2 relative">
 <Label>اسم الفرع - ابحث عن الموقع</Label>
 <div className="relative">
 <Input
 type="text"
 placeholder="ابحث عن الفرع... (مثال: الرياض، الدمام)"
 value={branchSearchQuery}
 onChange={(e) => handleBranchSearchChange(e.target.value)}
 onFocus={() => branchSearchQuery && setShowBranchResults(true)}
 className="text-right pr-10"
 data-testid="input-branch-search"
 />
 {isSearchingBranch && (
 <div className="absolute right-3 top-3 text-primary">
 <div className="animate-spin">⟳</div>
 </div>
 )}

 {showBranchResults && branchSearchResults.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
 {branchSearchResults.map((result, index) => (
 <button
 key={index}
 onClick={() => handleSelectBranchLocation(result)}
 className="w-full text-right px-4 py-3 hover:bg-primary/10 dark:hover:bg-primary/20 border-b border-border last:border-b-0 transition-colors"
 data-testid={`branch-location-result-${index}`}
 >
 <div className="flex items-end gap-2 justify-end">
 <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
 <span className="text-sm text-foreground">{result.name}</span>
 </div>
 </button>
 ))}
 </div>
 )}

 {showBranchResults && branchSearchResults.length === 0 && branchSearchQuery && !isSearchingBranch && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 p-3">
 <p className="text-sm text-muted-foreground text-right">لم يتم العثور على نتائج</p>
 </div>
 )}
 </div>
 </div>

 <div className="grid gap-2">
 <Label>موقع الفرع على الخريطة</Label>
 <div className="h-[250px] rounded-lg overflow-hidden border border-border">
 <BranchLocationPicker
 initialLat={branchForm.latitude}
 initialLng={branchForm.longitude}
 onLocationSelect={(lat: number, lng: number) => setBranchForm({ ...branchForm, latitude: lat, longitude: lng })}
 />
 </div>
 <div className="flex gap-4 text-xs text-muted-foreground">
 <span>خط العرض: 24.713600</span>
 <span>خط الطول: 46.675300</span>
 </div>
 </div>
 </div>
 
 <Button 
 onClick={handleCreateBranch} 
 disabled={createBranchMutation.isPending}
 className="w-full h-12 text-lg"
 data-testid="button-save-branch"
 >
 {createBranchMutation.isPending ? "جاري الحفظ..." : "حفظ الفرع"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {isAdmin && (
 <Dialog open={isEditBranchOpen} onOpenChange={setIsEditBranchOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-2xl font-bold">تعديل الفرع</DialogTitle>
 </DialogHeader>
 <div className="grid gap-4 py-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="grid gap-1.5">
 <Label htmlFor="edit-name-ar">اسم الفرع بالعربية *</Label>
 <Input
 id="edit-name-ar"
 value={branchForm.nameAr}
 onChange={(e) => setBranchForm({ ...branchForm, nameAr: e.target.value })}
 placeholder="مثال: فرع الرياض"
 data-testid="input-edit-name-ar"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="edit-name-en">اسم الفرع بالإنجليزية</Label>
 <Input
 id="edit-name-en"
 value={branchForm.nameEn}
 onChange={(e) => setBranchForm({ ...branchForm, nameEn: e.target.value })}
 placeholder="مثال: Riyadh Branch"
 data-testid="input-edit-name-en"
 />
 </div>
 </div>

 <div className="grid gap-1.5">
 <Label htmlFor="edit-address">العنوان *</Label>
 <Input
 id="edit-address"
 value={branchForm.address}
 onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
 placeholder="العنوان الكامل"
 data-testid="input-edit-address"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="grid gap-1.5">
 <Label htmlFor="edit-phone">رقم الجوال *</Label>
 <Input
 id="edit-phone"
 value={branchForm.phone}
 onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
 placeholder="مثال: 0501234567"
 data-testid="input-edit-phone"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="edit-city">المدينة *</Label>
 <Input
 id="edit-city"
 value={branchForm.city}
 onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
 placeholder="المدينة"
 data-testid="input-edit-city"
 />
 </div>
 </div>

 <div className="grid gap-1.5">
 <Label htmlFor="edit-manager-name">اسم المدير</Label>
 <Input
 id="edit-manager-name"
 value={branchForm.managerName}
 onChange={(e) => setBranchForm({ ...branchForm, managerName: e.target.value })}
 placeholder="اسم مدير الفرع"
 data-testid="input-edit-manager-name"
 />
 </div>

 <div className="grid gap-4">
 <div className="grid gap-2 relative">
 <Label>اسم الفرع - ابحث عن الموقع</Label>
 <div className="relative">
 <Input
 type="text"
 placeholder="ابحث عن الفرع... (مثال: الرياض، الدمام)"
 value={branchSearchQuery}
 onChange={(e) => handleBranchSearchChange(e.target.value)}
 onFocus={() => branchSearchQuery && setShowBranchResults(true)}
 className="text-right pr-10"
 data-testid="input-branch-search-edit"
 />
 {isSearchingBranch && (
 <div className="absolute right-3 top-3 text-primary">
 <div className="animate-spin">⟳</div>
 </div>
 )}

 {showBranchResults && branchSearchResults.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
 {branchSearchResults.map((result, index) => (
 <button
 key={index}
 onClick={() => handleSelectBranchLocation(result)}
 className="w-full text-right px-4 py-3 hover:bg-primary/10 dark:hover:bg-primary/20 border-b border-border last:border-b-0 transition-colors"
 data-testid={`branch-location-result-edit-${index}`}
 >
 <div className="flex items-end gap-2 justify-end">
 <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
 <span className="text-sm text-foreground">{result.name}</span>
 </div>
 </button>
 ))}
 </div>
 )}

 {showBranchResults && branchSearchResults.length === 0 && branchSearchQuery && !isSearchingBranch && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 p-3">
 <p className="text-sm text-muted-foreground text-right">لم يتم العثور على نتائج</p>
 </div>
 )}
 </div>
 </div>

 <div className="grid gap-2">
 <Label>موقع الفرع على الخريطة</Label>
 <div className="h-[250px] rounded-lg overflow-hidden border border-border">
 <BranchLocationPicker
 initialLat={branchForm.latitude}
 initialLng={branchForm.longitude}
 onLocationSelect={(lat: number, lng: number) => setBranchForm({ ...branchForm, latitude: lat, longitude: lng })}
 />
 </div>
 <div className="flex gap-4 text-xs text-muted-foreground">
 <span>خط العرض: {branchForm.latitude.toFixed(6)}</span>
 <span>خط الطول: {branchForm.longitude.toFixed(6)}</span>
 </div>
 </div>
 </div>

 <Button 
 onClick={handleEditBranch} 
 disabled={updateBranchMutation.isPending}
 className="w-full h-12 text-lg"
 data-testid="button-save-edit-branch"
 >
 {updateBranchMutation.isPending ? "جاري التحديث..." : "تحديث الفرع"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 )}
 </>
 )}
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {branches.length === 0 ? (
 <EmptyState title="لا يوجد فروع" description="لم يتم العثور على فروع مسجلة" />
 ) : (
 branches.map((branch) => (
 <Card key={branch.id} className="border-border/50 hover:border-primary/50 transition-colors">
 <CardContent className="p-4">
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
 <MapPin className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h3 className="font-bold text-lg">{branch.nameAr}</h3>
 <p className="text-sm text-muted-foreground">{branch.city}</p>
 </div>
 </div>
 <Badge variant={branch.isActive === 1 || branch.isActive === true ? "default" : "secondary"}>
 {branch.isActive === 1 || branch.isActive === true ? "نشط" : "غير نشط"}
 </Badge>
 </div>
 <div className="space-y-2 text-sm text-muted-foreground">
 <div className="flex items-center gap-2">
 <Users className="w-4 h-4" />
 <span>{branch.managerName || 'لا يوجد مدير'}</span>
 </div>
 <div className="flex items-center gap-2">
 <Activity className="w-4 h-4" />
 <span>{branch.phone}</span>
 </div>
 <div className="flex items-center gap-2">
 <MapPin className="w-4 h-4" />
 <span>{branch.address}</span>
 </div>
 </div>
 {isAdmin && (
 <div className="flex gap-2 mt-4 pt-4 border-t border-border">
 <Button 
 variant="outline" 
 size="sm" 
 className="flex-1"
 onClick={() => openEditDialog(branch)}
 disabled={updateBranchMutation.isPending}
 data-testid="button-edit-branch"
 >
 <Edit2 className="w-4 h-4 ml-2" />
 تعديل
 </Button>
 <Button 
 variant="outline" 
 size="sm" 
 className="flex-1"
 onClick={() => {
 if (confirm('هل أنت متأكد من حذف هذا الفرع؟')) {
 deleteBranchMutation.mutate(branch.id);
 }
 }}
 disabled={deleteBranchMutation.isPending}
 data-testid="button-delete-branch"
 >
 <Trash2 className="w-4 h-4 ml-2" />
 حذف
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 ))
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="coupons" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>إدارة أكواد الخصم</CardTitle>
 <CardDescription>إنشاء وإدارة أكواد الخصم للعملاء</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <CouponManagement employeeId={manager?.id || ''} />
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="delivery" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>إدارة التوصيل</CardTitle>
 <CardDescription>إدارة مناديب التوصيل ومناطق الخدمة والربط مع المنصات الخارجية</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <DeliveryManagement />
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="erp" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>نظام المحاسبة والفواتير</CardTitle>
 <CardDescription>إدارة الحسابات والفواتير الضريبية ومتابعة الأرباح</CardDescription>
 </div>
 <Button onClick={() => setLocation('/erp/accounting')} data-testid="button-open-erp">
 <ExternalLink className="w-4 h-4 ml-2" />
 فتح نظام المحاسبة
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
 <CardContent className="p-4 flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
 <TrendingUp className="w-6 h-6 text-green-600" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
 <p className="text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} <SarIcon /></p>
 </div>
 </CardContent>
 </Card>
 <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
 <CardContent className="p-4 flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
 <Receipt className="w-6 h-6 text-blue-600" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">عدد الطلبات</p>
 <p className="text-2xl font-bold text-blue-600">{filteredOrders.length}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
 <CardContent className="p-4 flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
 <DollarSign className="w-6 h-6 text-purple-600" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">متوسط الطلب</p>
 <p className="text-2xl font-bold text-purple-600">{filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : '0.00'} <SarIcon /></p>
 </div>
 </CardContent>
 </Card>
 </div>
 <div className="mt-4 p-4 bg-muted/30 rounded-lg">
 <p className="text-sm text-muted-foreground mb-2">للوصول إلى نظام المحاسبة الكامل مع:</p>
 <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
 <li>دليل الحسابات</li>
 <li>قيود اليومية</li>
 <li>ميزان المراجعة</li>
 <li>قائمة الدخل والميزانية العمومية</li>
 <li>الفواتير الضريبية المتوافقة مع ZATCA</li>
 </ul>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 </div>
 );
}

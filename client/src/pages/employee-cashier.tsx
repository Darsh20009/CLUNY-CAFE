import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Coffee, ShoppingBag, User, Phone, Trash2, Plus, Minus, ArrowRight, Check, Scan, Search, X, Gift, Printer, MonitorSmartphone, Settings, Wifi, WifiOff, FileText, Store, Truck, MapPin, Wallet, CreditCard } from "lucide-react";
import QRScanner from "@/components/qr-scanner";
import BarcodeScanner from "@/components/barcode-scanner";
import { TableOccupancyAlerts } from "@/components/table-occupancy-alerts";
import { ClassicCashierLayout, POSCashierLayout, SplitCashierLayout } from "@/components/cashier-layouts";
import { printTaxInvoice, printSimpleReceipt, printCustomerPickupReceipt, printCashierReceipt, printAllReceipts } from "@/lib/print-utils";
import type { Employee, CoffeeItem, PaymentMethod, LoyaltyCard } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";

interface OrderItem {
 coffeeItem: CoffeeItem;
 quantity: number;
 customization?: {
   selectedSize?: string;
   addons?: any[];
   totalAddonsPrice?: number;
 };
}

interface WhatsAppMessageData {
 phone: string;
 orderNumber: string;
 customerName: string;
 items: OrderItem[];
 total: string;
 paymentMethod: string;
}

function generateWhatsAppLink(data: WhatsAppMessageData): string {
 const message = `
مرحباً ${data.customerName}

تم استلام طلبك بنجاح!

رقم الطلب: ${data.orderNumber}

تفاصيل الطلب:
${data.items.map(item => {
  let price = Number(item.coffeeItem.price) || 0;
  if ((item as any).selectedSize && item.coffeeItem.availableSizes) {
    const sz = (item.coffeeItem.availableSizes as any[]).find((s: any) => s.nameAr === (item as any).selectedSize);
    if (sz) price = Number(sz.price) || price;
  }
  const addonsExtra = ((item.customization as any)?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
  return `• ${item.coffeeItem.nameAr}${(item as any).selectedSize ? ` (${(item as any).selectedSize})` : ''} × ${item.quantity} - ${((price + addonsExtra) * item.quantity).toFixed(2)} ريال`;
}).join('\n')}

الإجمالي: ${data.total} ريال
طريقة الدفع: ${data.paymentMethod}

حالة الطلب: تحت التنفيذ

سنبلغك عند اكتمال طلبك. شكراً لتعاملك معنا!

CLUNY CAFE
`.trim();

 const phoneNumber = data.phone.replace(/[^0-9]/g, '');
 const internationalPhone = phoneNumber.startsWith('966') ? phoneNumber : `966${phoneNumber.replace(/^0/, '')}`;
 
 return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}

export default function EmployeeCashier() {
 const [, setLocation] = useLocation();
 const [employee, setEmployee] = useState<Employee | null>(null);
 const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
 const [customerName, setCustomerName] = useState("");
 const [customerPhone, setCustomerPhone] = useState("");
 const [customerEmail, setCustomerEmail] = useState("");
 const [customerPoints, setCustomerPoints] = useState(0);
 const [customerId, setCustomerId] = useState<string | null>(null);
 const [showRegisterDialog, setShowRegisterDialog] = useState(false);
 const [tableNumber, setTableNumber] = useState("");
 const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
 const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
 const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
 const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
 const [discountCode, setDiscountCode] = useState("");
 const [appliedDiscount, setAppliedDiscount] = useState<{code: string, percentage: number, reason: string} | null>(null);
 const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
 const [lastOrder, setLastOrder] = useState<any>(null);
 const [posConnected, setPosConnected] = useState(false);
 const [isPosSettingsOpen, setIsPosSettingsOpen] = useState(false);
 const [isTogglingPos, setIsTogglingPos] = useState(false);
 const [stampsToUse, setStampsToUse] = useState(0);
 const [pointsToRedeem, setPointsToRedeem] = useState(0);
 const [usePointsDiscount, setUsePointsDiscount] = useState(false);
 const [orderType, setOrderType] = useState<'dine-in' | 'pickup' | 'delivery'>('pickup');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

 const { toast } = useToast();
 const { i18n } = useTranslation();
 const getItemDisplayName = useCallback((item: any) => {
   if (!item) return '';
   if (i18n.language === 'en') return item.nameEn || item.nameAr || '';
   return item.nameAr || item.nameEn || '';
 }, [i18n.language]);

 const { data: loyaltySettings } = useQuery<any>({
   queryKey: ["/api/public/loyalty-settings"],
   staleTime: 300000,
 });

 const pointsToSar = (pts: number) => {
   const pointsValueInSar = loyaltySettings?.pointsValueInSar ?? 0.05;
   return pts * pointsValueInSar;
 };

 useEffect(() => {
 const loadEmployee = async () => {
 const storedEmployee = localStorage.getItem("currentEmployee");
 if (storedEmployee) {
 const parsed = JSON.parse(storedEmployee);
 // If employee doesn't have branchId, fetch it from server
 if (!parsed.branchId) {
 try {
 const response = await fetch('/api/verify-session');
 if (response.ok) {
 const data = await response.json();
 if (data.employee?.branchId) {
 parsed.branchId = data.employee.branchId;
 localStorage.setItem("currentEmployee", JSON.stringify(parsed));
 }
 }
 } catch (error) {
 console.error("Error fetching branch info:", error);
 }
 }
 
 setEmployee(parsed);
 } else {
 setLocation("/employee/gateway");
 }
 };
 loadEmployee();
 }, [setLocation]);

 // Check POS device connection
 useEffect(() => {
 const checkPosConnection = async () => {
 try {
 const response = await fetch('/api/pos/status', { method: 'GET' });
 if (response.ok) {
 const data = await response.json();
 setPosConnected(data.connected === true);
 } else {
 setPosConnected(false);
 }
 } catch (error) {
 setPosConnected(false);
 }
 };

 // Check POS status every 30 seconds
 checkPosConnection();
 const interval = setInterval(checkPosConnection, 30000);
 return () => clearInterval(interval);
 }, []);

 // Check for existing customer when phone number is entered
 useEffect(() => {
 const checkCustomer = async () => {
 const is9Digit = customerPhone.length === 9 && customerPhone.startsWith('5');
 const is10Digit = customerPhone.length === 10 && customerPhone.startsWith('05');
 const normalizedPhone = is10Digit ? customerPhone.slice(1) : customerPhone;
 if (is9Digit || is10Digit) {
 setIsCheckingCustomer(true);
 try {
 const response = await fetch(`/api/customers/lookup-by-phone`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ phone: normalizedPhone })
 });
 
 if (response.ok) {
 const data = await response.json();
 if (data.found && data.customer) {
 setCustomerName(data.customer.name);
 setCustomerEmail(data.customer.email || "");
 setCustomerPoints(data.customer.points || 0);
 setCustomerId(data.customer.id);
 setLoyaltyCard(data.loyaltyCard || null);
 setShowRegisterDialog(false);
 
 const availableStamps = data.loyaltyCard 
 ? (data.loyaltyCard.freeCupsEarned || 0) - (data.loyaltyCard.freeCupsRedeemed || 0) 
 : 0;
 
 toast({
 title: "عميل مسجل",
 description: `مرحباً ${data.customer.name}! لديك ${data.customer.points || 0} نقطة${availableStamps > 0 ? ` و ${availableStamps} أختام متاحة` : ''}`,
 className: "bg-green-600 text-white",
 });
 } else {
 // Customer not found - show registration dialog
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setShowRegisterDialog(true);
 }
 } else {
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setShowRegisterDialog(true);
 }
 } catch (error) {
 console.error('Error checking customer:', error);
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 } finally {
 setIsCheckingCustomer(false);
 }
 } else {
 // Reset when phone is incomplete
 if (customerPhone.length === 0) {
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setShowRegisterDialog(false);
 }
 }
 };

 const debounceTimer = setTimeout(checkCustomer, 500);
 return () => clearTimeout(debounceTimer);
 }, [customerPhone, toast]);

 const { data: coffeeItems = [], isLoading } = useQuery<CoffeeItem[]>({
 queryKey: ["/api/coffee-items"],
 });

 const { data: businessConfig } = useQuery<any>({
   queryKey: ["/api/business-config"],
   staleTime: 300000,
 });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      // Show customer details for confirmation
      const pmLabels: Record<string, string> = { cash: "نقداً", pos: "بطاقة/شبكة", alinma: "Alinma Pay", ur: "Ur Pay", barq: "Barq", rajhi: "بنك الراجحي" };
      const pmLabel = pmLabels[orderData.paymentMethod] || "إلكتروني";
      const confirmMessage = `تأكيد الدفع (${pmLabel}) للعميل: ${orderData.customerInfo.customerName}\nرقم الجوال: ${orderData.customerInfo.phoneNumber}\nالإجمالي: ${orderData.totalAmount} ريال`;
      if (!window.confirm(confirmMessage)) {
        throw new Error("تم إلغاء تأكيد الدفع");
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create order");
      }
      
      return response.json();
    },
 onSuccess: async (order) => {
 const paymentMethodAr = paymentMethod === "cash" ? "نقدي" : 
 paymentMethod === "alinma" ? "Alinma Pay" :
 paymentMethod === "ur" ? "Ur Pay" :
 paymentMethod === "barq" ? "Barq" :
 paymentMethod === "rajhi" ? "بنك الراجحي" :
 paymentMethod === "pos" ? "جهاز نقاط البيع" : "تحويل بنكي";
 
 const orderTypeAr = orderType === 'dine-in' ? 'في الكافيه' :
 orderType === 'pickup' ? 'استلام' : 'توصيل';
 
 setLastOrder({
 orderNumber: order.orderNumber,
 customerName,
 customerPhone,
 items: orderItems,
 subtotal: calculateSubtotal().toFixed(2),
 discount: appliedDiscount ? {
 code: appliedDiscount.code,
 percentage: appliedDiscount.percentage,
 amount: calculateDiscount().toFixed(2)
 } : undefined,
 total: order.totalAmount,
 paymentMethod: paymentMethodAr,
 employeeName: employee?.fullName || "",
 tableNumber: tableNumber || undefined,
 deliveryType: orderType,
 deliveryTypeAr: orderTypeAr,
 date: new Date().toISOString()
 });
 
 const whatsappData: WhatsAppMessageData = {
 phone: customerPhone,
 orderNumber: order.orderNumber,
 customerName,
 items: orderItems,
 total: order.totalAmount,
 paymentMethod: paymentMethodAr
 };
 
 const whatsappLink = generateWhatsAppLink(whatsappData);
 window.open(whatsappLink, '_blank');
 
 toast({
 title: "تم إنشاء الطلب بنجاح",
 description: `رقم الطلب: ${order.orderNumber}`,
 className: "bg-green-600 text-white",
 });
 
 // تحديث قائمةالطلبات في صفحة الطلبات
 await queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
 
 resetForm();
 },
 onError: () => {
 toast({
 title: "خطأ",
 description: "فشل إنشاء الطلب. يرجى المحاولة مرة أخرى",
 variant: "destructive",
 });
 },
 });

 const registerCustomerMutation = useMutation({
 mutationFn: async (customerData: { phone: string; name: string; email?: string }) => {
 const response = await fetch("/api/customers/register-by-cashier", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(customerData),
 });
 
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || "فشل تسجيل العميل");
 }
 
 return response.json();
 },
 onSuccess: async (customer) => {
 setCustomerId(customer.id);
 setCustomerPoints(customer.points || 0);
 setShowRegisterDialog(false);
 
 toast({
 title: "تم تسجيل العميل بنجاح",
 description: `تم تسجيل ${customer.name} في النظام. يمكن للعميل تفعيل الحساب لاحقاً عبر نظام استعادة كلمة المرور.`,
 className: "bg-green-600 text-white",
 });

 // Fetch loyalty card after registration
 try {
 const loyaltyResponse = await fetch(`/api/loyalty/cards/phone/${customer.phone}`);
 if (loyaltyResponse.ok) {
 const card = await loyaltyResponse.json();
 setLoyaltyCard(card);
 }
 } catch (error) {
 console.error('Error fetching loyalty card after registration:', error);
 }
 },
 onError: (error: Error) => {
 toast({
 title: "خطأ في التسجيل",
 description: error.message,
 variant: "destructive",
 });
 },
 });

 const handleRegisterCustomer = () => {
 if (!customerName.trim()) {
 toast({
 title: "خطأ",
 description: "يرجى إدخال اسم العميل",
 variant: "destructive",
 });
 return;
 }

 registerCustomerMutation.mutate({
 phone: customerPhone,
 name: customerName.trim(),
 email: customerEmail.trim() || undefined,
 });
 };

 const resetForm = () => {
 setOrderItems([]);
 setCustomerName("");
 setCustomerPhone("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setCustomerId(null);
 setLoyaltyCard(null);
 setShowRegisterDialog(false);
 setTableNumber("");
 setPaymentMethod("cash");
 setDiscountCode("");
 setAppliedDiscount(null);
 setOrderType("pickup");
 setPointsToRedeem(0);
 setUsePointsDiscount(false);
 setStampsToUse(0);
 };

 const addToOrder = (coffeeItem: CoffeeItem) => {
   // Since the employee-cashier page doesn't seem to have a DrinkCustomizationDialog state defined like pos-system,
   // we should ideally add it. But for now, let's fix the calculation logic if it's there.
   // Looking at the code, it seems to add directly. 
   const existingItem = orderItems.find(item => item.coffeeItem.id === coffeeItem.id);
   
   if (existingItem) {
     setOrderItems(orderItems.map(item =>
       item.coffeeItem.id === coffeeItem.id
         ? { ...item, quantity: item.quantity + 1 }
         : item
     ));
   } else {
     setOrderItems([...orderItems, { coffeeItem, quantity: 1 }]);
   }
 };

 const updateQuantity = (coffeeItemId: string, newQuantity: number) => {
   if (newQuantity <= 0) {
     setOrderItems(orderItems.filter(item => item.coffeeItem.id !== coffeeItemId));
   } else {
     setOrderItems(orderItems.map(item =>
       item.coffeeItem.id === coffeeItemId
         ? { ...item, quantity: newQuantity }
         : item
     ));
   }
 };

 const removeFromOrder = (coffeeItemId: string) => {
   setOrderItems(orderItems.filter(item => item.coffeeItem.id !== coffeeItemId));
 };

 const calculateSubtotal = () => {
   return orderItems.reduce((sum, item) => {
     let itemPrice = Number(item.coffeeItem.price);
     // Apply size price if available in item (customization check)
     if (item.customization?.selectedSize) {
       const sizeOption = item.coffeeItem.availableSizes?.find(
         s => s.nameAr === item.customization?.selectedSize || s.nameEn === item.customization?.selectedSize
       );
       if (sizeOption) itemPrice = Number(sizeOption.price);
     }
     const addonsPrice = item.customization?.totalAddonsPrice || 0;
     return sum + ((itemPrice + addonsPrice) * item.quantity);
   }, 0);
 };

 const calculateDiscount = () => {
 if (!appliedDiscount) return 0;
 const subtotal = calculateSubtotal();
 return (subtotal * appliedDiscount.percentage) / 100;
 };

 const calculatePointsDiscount = () => {
   if (!usePointsDiscount || pointsToRedeem <= 0) return 0;
   return pointsToSar(pointsToRedeem);
 };

 const calculateTotal = () => {
 const subtotal = calculateSubtotal();
 const discount = calculateDiscount();
 const pointsDiscount = calculatePointsDiscount();
 return Math.max(0, subtotal - discount - pointsDiscount).toFixed(2);
 };

 const validateDiscountCode = async () => {
 if (!discountCode.trim()) {
 toast({
 title: "خطأ",
 description: "يرجى إدخال كود الخصم",
 variant: "destructive",
 });
 return;
 }

 setIsValidatingDiscount(true);
 try {
 const response = await fetch('/api/discount-codes/validate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ code: discountCode })
 });

 let data;
 try {
 data = await response.json();
 } catch (parseError) {
 toast({
 title: "خطأ",
 description: "فشل قراءةاستجابةالخادم",
 variant: "destructive",
 });
 setIsValidatingDiscount(false);
 return;
 }

 if (!response.ok || !data.valid) {
 toast({
 title: "كود خصم غير صالح",
 description: data.error || "الكود المدخل غير صحيح أو منتهي الصلاحية",
 variant: "destructive",
 });
 setAppliedDiscount(null);
 setIsValidatingDiscount(false);
 return;
 }

 setAppliedDiscount({
 code: data.code,
 percentage: data.discountPercentage,
 reason: data.reason
 });

 toast({
 title: "تم تطبيق الخصم بنجاح",
 description: `${data.reason} - ${data.discountPercentage}%`,
 className: "bg-green-600 text-white",
 });
 } catch (error) {
 console.error('Error validating discount code:', error);
 toast({
 title: "خطأ",
 description: "فشل التحقق من كود الخصم",
 variant: "destructive",
 });
 } finally {
 setIsValidatingDiscount(false);
 }
 };

 const removeDiscount = () => {
 setDiscountCode("");
 setAppliedDiscount(null);
 toast({
 title: "تم إزالةالخصم",
 description: "تم إلغاء الخصم من الطلب",
 });
 };

 const handlePrintReceipt = async () => {
   if (!lastOrder) {
     toast({
       title: "خطأ",
       description: "لا يوجد طلب للطباعة",
       variant: "destructive",
     });
     return;
   }
   
   try {
     await printSimpleReceipt({
       orderNumber: lastOrder.orderNumber,
       customerName: lastOrder.customerName,
       customerPhone: lastOrder.customerPhone,
       items: lastOrder.items,
       subtotal: lastOrder.subtotal,
       discount: lastOrder.discount,
       total: lastOrder.total,
       paymentMethod: lastOrder.paymentMethod,
       employeeName: lastOrder.employeeName,
       tableNumber: lastOrder.tableNumber,
       date: lastOrder.date,
     });
     toast({
       title: "تم فتح نافذة الطباعة",
       description: "يمكنك الآن طباعة الإيصال",
       className: "bg-green-600 text-white",
     });
   } catch (error) {
     console.error("Error printing receipt:", error);
     toast({
       title: "خطأ",
       description: "فشل في فتح نافذة الطباعة",
       variant: "destructive",
     });
   }
 };

 const handlePrintTaxInvoice = async () => {
   if (!lastOrder) {
     toast({
       title: "خطأ",
       description: "لا يوجد طلب للطباعة",
       variant: "destructive",
     });
     return;
   }
   
   try {
     await printTaxInvoice({
       orderNumber: lastOrder.orderNumber,
       customerName: lastOrder.customerName,
       customerPhone: lastOrder.customerPhone,
       items: lastOrder.items,
       subtotal: lastOrder.subtotal,
       discount: lastOrder.discount,
       total: lastOrder.total,
       paymentMethod: lastOrder.paymentMethod,
       employeeName: lastOrder.employeeName,
       tableNumber: lastOrder.tableNumber,
       date: lastOrder.date,
       crNumber: businessConfig?.commercialRegistration,
       vatNumber: businessConfig?.vatNumber,
     });
     toast({
       title: "تم فتح نافذة الطباعة",
       description: "يمكنك الآن طباعة الفاتورة الضريبية",
       className: "bg-green-600 text-white",
     });
   } catch (error) {
     console.error("Error printing tax invoice:", error);
     toast({
       title: "خطأ",
       description: "فشل في فتح نافذة الطباعة",
       variant: "destructive",
     });
   }
 };

 const handlePrintAllReceipts = async () => {
   if (!lastOrder) {
     toast({
       title: "خطأ",
       description: "لا يوجد طلب للطباعة",
       variant: "destructive",
     });
     return;
   }
   
   try {
     await printAllReceipts({
       orderNumber: lastOrder.orderNumber,
       customerName: lastOrder.customerName,
       customerPhone: lastOrder.customerPhone,
       items: lastOrder.items,
       subtotal: lastOrder.subtotal,
       discount: lastOrder.discount,
       total: lastOrder.total,
       paymentMethod: lastOrder.paymentMethod,
       employeeName: lastOrder.employeeName,
       tableNumber: lastOrder.tableNumber,
       deliveryType: lastOrder.deliveryType,
       deliveryTypeAr: lastOrder.deliveryTypeAr,
       date: lastOrder.date,
     });
     toast({
       title: "تم فتح نوافذ الطباعة",
       description: "طباعة 3 إيصالات: فاتورة ضريبية، إيصال استلام، نسخة الكاشير",
       className: "bg-green-600 text-white",
     });
   } catch (error) {
     console.error("Error printing all receipts:", error);
     toast({
       title: "خطأ",
       description: "فشل في فتح نوافذ الطباعة",
       variant: "destructive",
     });
   }
 };

 const handleOpenCashDrawer = async () => {
   try {
     const response = await fetch('/api/pos/cash-drawer/open', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include'
     });
     
     if (response.ok) {
       toast({
         title: "تم فتح الخزانة",
         description: "تم فتح درج النقود بنجاح",
         className: "bg-green-600 text-white",
       });
     } else {
       toast({
         title: "خطأ",
         description: "فشل فتح الخزانة",
         variant: "destructive",
       });
     }
   } catch (error) {
     console.error('Error opening cash drawer:', error);
     toast({
       title: "خطأ",
       description: "فشل الاتصال بالخادم",
       variant: "destructive",
     });
   }
 };

 const handleTogglePosConnection = async () => {
 setIsTogglingPos(true);
 try {
 const response = await fetch('/api/pos/toggle', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include'
 });
 
 if (response.ok) {
 const data = await response.json();
 setPosConnected(data.connected);
 toast({
 title: data.connected ? "تم الاتصال بجهاز POS" : "تم قطع الاتصال",
 description: data.connected ? "الجهاز جاهز للدفع الإلكتروني" : "تم إيقاف الاتصال بجهاز POS",
 className: data.connected ? "bg-green-600 text-white" : undefined,
 });
 } else {
 toast({
 title: "خطأ",
 description: "فشل تغيير حالة الاتصال بجهاز POS",
 variant: "destructive",
 });
 }
 } catch (error) {
 console.error('Error toggling POS:', error);
 toast({
 title: "خطأ",
 description: "فشل الاتصال بالخادم",
 variant: "destructive",
 });
 } finally {
 setIsTogglingPos(false);
 }
 };

 const handleSubmitOrder = async () => {
   if (orderItems.length === 0) {
     toast({
       title: "خطأ",
       description: "يرجى إضافة عناصر للطلب",
       variant: "destructive",
     });
     return;
   }

   const totalAmount = calculateTotal();
   const orderData = {
     customerId: customerId || undefined,
     customerInfo: {
       customerName: customerName,
       phoneNumber: customerPhone,
       customerEmail: customerEmail || undefined
     },
     items: orderItems.map(item => ({
       coffeeItemId: item.coffeeItem.id,
       quantity: item.quantity,
       size: item.customization?.selectedSize || "Default",
       extras: [
         ...(item.customization?.addons?.map((a: any) => a.nameAr) || []),
         ...((item.customization as any)?.selectedItemAddons?.map((a: any) => a.nameAr) || []),
       ],
       totalPrice: ((Number(item.coffeeItem.price) + (item.customization?.totalAddonsPrice || 0) + ((item.customization as any)?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0)) * item.quantity).toFixed(2)
     })),
     totalAmount: parseFloat(totalAmount),
     paymentMethod,
     orderType,
     tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
     branchId: employee?.branchId,
     discountCode: appliedDiscount?.code,
     discountPercentage: appliedDiscount?.percentage || 0,
     pointsRedeemed: (usePointsDiscount && pointsToRedeem > 0) ? pointsToRedeem : 0,
     pointsValue: (usePointsDiscount && pointsToRedeem > 0) ? pointsToSar(pointsToRedeem) : 0,
     bypassPointsVerification: true,
   };

   try {
     const order = await createOrderMutation.mutateAsync(orderData);
     
     // Handle Printing after success
     if (order) {
       toast({
         title: "تم الطلب",
         description: "جاري تحضير الفواتير...",
       });
       
       // Update lastOrder state for manual printing if needed
       setLastOrder({
         orderNumber: order.orderNumber,
         customerName,
         customerPhone,
         items: orderItems,
         subtotal: calculateSubtotal().toFixed(2),
         discount: appliedDiscount ? {
           code: appliedDiscount.code,
           percentage: appliedDiscount.percentage,
           amount: calculateDiscount().toFixed(2)
         } : undefined,
         total: order.totalAmount,
         paymentMethod: paymentMethod === "cash" ? "نقدي" : "إلكتروني",
         employeeName: employee?.fullName || "",
         tableNumber: tableNumber || undefined,
         deliveryType: orderType,
         date: new Date().toISOString()
       });

       // Small delay to ensure state updates if needed
       setTimeout(() => {
         handlePrintAllReceipts();
       }, 500);
     }
   } catch (error) {
     console.error("Order submission error:", error);
   }
 };

 if (!employee) {
 return null;
 }

 return (
 <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4 pb-20 sm:pb-4">
 <div className="max-w-7xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center">
 <Coffee className="w-6 h-6 text-white" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-accent">نظام الكاشير</h1>
 <p className="text-gray-400 text-sm">الموظف: {employee.fullName}</p>
 </div>
 </div>
 <div className="flex items-center gap-3 flex-wrap">
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/cashier/phone-lookup")}
 className="border-primary/50 text-accent hover:bg-background0 hover:text-white"
 data-testid="button-phone-lookup"
 >
 <Search className="w-4 h-4 ml-2" />
 بحث برقم الهاتف
 </Button>
 <Dialog open={isPosSettingsOpen} onOpenChange={setIsPosSettingsOpen}>
 <DialogTrigger asChild>
 <div className="bg-[#2d1f1a] border border-primary/20 rounded-lg px-4 py-2 hover-elevate cursor-pointer" data-testid="pos-settings-trigger">
 <div className="flex items-center gap-2">
 <MonitorSmartphone className={`w-4 h-4 ${posConnected ? 'text-green-400' : 'text-gray-400'}`} />
 <span className="text-xs text-gray-400">جهاز POS:</span>
 <Badge variant="outline" className={posConnected ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}>
 {posConnected ? "متصل" : "غير متصل"}
 </Badge>
 <Settings className="w-3 h-3 text-gray-500" />
 </div>
 <p className="text-xs text-gray-500 mt-1">{posConnected ? "جاهز للدفع الإلكتروني" : "انقر للإعدادات"}</p>
 </div>
 </DialogTrigger>
 <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white">
 <DialogHeader>
 <DialogTitle className="text-accent flex items-center gap-2">
 <MonitorSmartphone className="w-5 h-5" />
 إعدادات جهاز نقاط البيع (POS)
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-6">
 <div className="flex items-center justify-between p-4 bg-[#1a1410] rounded-lg border border-primary/20">
 <div className="flex items-center gap-3">
 {posConnected ? (
 <Wifi className="w-6 h-6 text-green-400" />
 ) : (
 <WifiOff className="w-6 h-6 text-gray-400" />
 )}
 <div>
 <p className="text-gray-200 font-medium">حالة الاتصال</p>
 <p className={`text-sm ${posConnected ? 'text-green-400' : 'text-gray-500'}`}>
 {posConnected ? 'متصل وجاهز للاستخدام' : 'غير متصل'}
 </p>
 </div>
 </div>
 <Switch
 checked={posConnected}
 onCheckedChange={handleTogglePosConnection}
 disabled={isTogglingPos}
 data-testid="switch-pos-connection"
 />
 </div>
 
 <div className="space-y-3 p-4 bg-[#1a1410]/50 rounded-lg">
 <h4 className="text-accent font-medium flex items-center gap-2">
 <Settings className="w-4 h-4" />
 معلومات الجهاز
 </h4>
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <p className="text-gray-500">نوع الاتصال</p>
 <p className="text-gray-300">USB / شبكة محلية</p>
 </div>
 <div>
 <p className="text-gray-500">حالة الجهاز</p>
 <p className={posConnected ? 'text-green-400' : 'text-yellow-400'}>
 {posConnected ? 'نشط' : 'في وضع الاستعداد'}
 </p>
 </div>
 </div>
 </div>

 <div className="text-xs text-gray-500 p-3 bg-background0/10 rounded-lg border border-primary/20">
 <p className="font-medium text-accent mb-1">ملاحظة:</p>
 <p>عند تفعيل جهاز POS، سيتم معالجة الدفعات الإلكترونية تلقائياً عبر الجهاز. تأكد من توصيل الجهاز بشكل صحيح قبل التفعيل.</p>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 {lastOrder && (
 <>
 <Button
 onClick={handlePrintReceipt}
 className="bg-blue-600 hover:bg-blue-700 shadow-lg"
 data-testid="button-print-receipt"
 >
 <Printer className="w-4 h-4 ml-2" />
 طباعة الإيصال
 </Button>
 <Button
 onClick={handlePrintTaxInvoice}
 className="bg-purple-600 hover:bg-purple-700 shadow-lg"
 data-testid="button-print-tax-invoice"
 >
 <FileText className="w-4 h-4 ml-2" />
 فاتورة ضريبية
 </Button>
 <Button
 onClick={handlePrintAllReceipts}
 className="bg-green-600 hover:bg-green-700 shadow-lg"
 data-testid="button-print-all-receipts"
 >
 <Printer className="w-4 h-4 ml-2" />
 طباعة 3 إيصالات
 </Button>
 </>
 )}
 <Button
 size="icon"
 variant="outline"
 onClick={handleOpenCashDrawer}
 className="border-primary/50 text-accent hover:bg-background0 hover:text-white"
 data-testid="button-open-drawer"
 title="فتح الخزانة"
 >
 <Wallet className="w-5 h-5" />
 </Button>
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/dashboard")}
 className="border-primary/50 text-accent hover:bg-background0 hover:text-white"
 data-testid="button-back-dashboard"
 >
 <ArrowRight className="w-4 h-4 ml-2" />
 العودة
 </Button>
 </div>
 </div>


 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Menu Section */}
 <div className="lg:col-span-2">
 <Card className="bg-[#2d1f1a] border-primary/20">
 <CardHeader>
 <CardTitle className="text-accent text-right">القائمة</CardTitle>
 </CardHeader>
 <CardContent>
 {businessConfig?.cashierLayout === 'pos' ? (
   <POSCashierLayout
     items={coffeeItems as any}
     isLoading={isLoading}
     getItemDisplayName={getItemDisplayName as any}
     onAddItem={addToOrder as any}
   />
 ) : businessConfig?.cashierLayout === 'split' ? (
   <SplitCashierLayout
     items={coffeeItems as any}
     isLoading={isLoading}
     getItemDisplayName={getItemDisplayName as any}
     onAddItem={addToOrder as any}
   />
 ) : (
   <ClassicCashierLayout
     items={coffeeItems as any}
     isLoading={isLoading}
     getItemDisplayName={getItemDisplayName as any}
     onAddItem={addToOrder as any}
   />
 )}
 </CardContent>
 </Card>
 </div>

 {/* Order Summary Section */}
 <div className="lg:col-span-1 space-y-4">
 <Card className="bg-[#2d1f1a] border-primary/20 sticky top-4">
 <CardHeader>
 <CardTitle className="text-accent text-right flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <ShoppingBag className="w-5 h-5" />
 الطلب الحالي
 </div>
 <Badge 
   data-testid="badge-order-type"
   className={
     orderType === 'dine-in' 
       ? 'bg-purple-600 text-white' 
       : orderType === 'pickup' 
         ? 'bg-blue-600 text-white' 
         : 'bg-green-600 text-white'
   }
 >
   {orderType === 'dine-in' ? (
     <><Store className="w-3 h-3 ml-1" />محلي</>
   ) : orderType === 'pickup' ? (
     <><MapPin className="w-3 h-3 ml-1" />استلام</>
   ) : (
     <><Truck className="w-3 h-3 ml-1" />توصيل</>
   )}
 </Badge>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {orderItems.length === 0 ? (
 <div className="text-center text-gray-400 py-8">
 لا توجد عناصر في الطلب
 </div>
 ) : (
 <>
 <div className="space-y-3 max-h-64 overflow-y-auto">
 {orderItems.map((item) => (
 <div key={item.coffeeItem.id} className="bg-[#1a1410] rounded-lg p-3">
 <div className="flex justify-between items-start mb-2">
 <div className="text-right flex-1">
 <div className="flex items-center gap-2">
 <h4 className="text-accent font-medium text-sm" data-testid={`text-order-item-${item.coffeeItem.id}`}>
 {getItemDisplayName(item.coffeeItem)}
 </h4>
 </div>
 <p className="text-gray-400 text-xs">
 {Number(item.coffeeItem.price).toFixed(2)} ريال
 </p>
 </div>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => removeFromOrder(item.coffeeItem.id)}
 className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
 data-testid={`button-remove-${item.coffeeItem.id}`}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => updateQuantity(item.coffeeItem.id, item.quantity - 1)}
 className="h-7 w-7 p-0 border-primary/30"
 data-testid={`button-decrease-${item.coffeeItem.id}`}
 >
 <Minus className="w-3 h-3" />
 </Button>
 <span className="text-white font-bold min-w-[30px] text-center" data-testid={`text-quantity-${item.coffeeItem.id}`}>
 {item.quantity}
 </span>
 <Button
 size="sm"
 variant="outline"
 onClick={() => updateQuantity(item.coffeeItem.id, item.quantity + 1)}
 className="h-7 w-7 p-0 border-primary/30"
 data-testid={`button-increase-${item.coffeeItem.id}`}
 >
 <Plus className="w-3 h-3" />
 </Button>
 </div>
 <span className="font-bold text-accent">
 {(() => {
   let price = Number(item.coffeeItem.price) || 0;
   if ((item as any).selectedSize && item.coffeeItem.availableSizes) {
     const sz = (item.coffeeItem.availableSizes as any[]).find((s: any) => s.nameAr === (item as any).selectedSize);
     if (sz) price = Number(sz.price) || price;
   }
   const addonsExtra = ((item.customization as any)?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
   return ((price + addonsExtra) * item.quantity).toFixed(2);
 })()} ريال
 </span>
 </div>
 </div>
 ))}
 </div>

 <Separator className="bg-background0/20" />

 <div className="space-y-3">
 <div className="space-y-2">
 <Label className="text-gray-300 text-right block">
 <User className="w-4 h-4 inline ml-2" />
 اسم العميل
 </Label>
 <Input
 value={customerName}
 onChange={(e) => setCustomerName(e.target.value)}
 placeholder="أدخل اسم العميل"
 className="bg-[#1a1410] border-primary/30 text-white text-right"
 data-testid="input-customer-name"
 />
 </div>

 <div className="space-y-2">
 <Label className="text-gray-300 text-right block">
 <Phone className="w-4 h-4 inline ml-2" />
 رقم الجوال (9 أرقام تبدأ بـ 5)
 </Label>
 <div className="flex gap-2">
 <Input
 value={customerPhone}
 onChange={(e) => setCustomerPhone(e.target.value)}
 placeholder="5xxxxxxxx"
 className="bg-[#1a1410] border-primary/30 text-white text-right flex-1"
 data-testid="input-customer-phone"
 />
 <Dialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner}>
 <DialogTrigger asChild>
 <Button
 variant="outline"
 size="icon"
 className="border-primary/30 text-accent"
 data-testid="button-scan-loyalty"
 >
 <CreditCard className="w-4 h-4" />
 </Button>
 </DialogTrigger>
 <DialogContent className="bg-[#1a1410] border-primary/30 text-white max-w-md">
 <DialogHeader>
 <DialogTitle className="text-right text-accent">مسح بطاقة الولاء</DialogTitle>
 </DialogHeader>
 <BarcodeScanner
 showManualInput={true}
 onCustomerFound={(result) => {
 if (result.found && result.card) {
 setCustomerPhone(result.card.phoneNumber.replace(/^966|^0/, ''));
 setCustomerName(result.card.customerName || result.customer?.name || '');
 setLoyaltyCard(result.card as any);
 if (result.customer?.id) {
 setCustomerId(result.customer.id);
 setCustomerPoints(result.customer.points || 0);
 }
 setShowBarcodeScanner(false);
 toast({
 title: "تم العثور على العميل",
 description: `${result.card.customerName || 'عميل'} - ${result.card.phoneNumber}`,
 });
 }
 }}
 onClose={() => setShowBarcodeScanner(false)}
 />
 </DialogContent>
 </Dialog>
 </div>
 {isCheckingCustomer && (
 <p className="text-xs text-accent text-right animate-pulse">جاري التحقق من العميل...</p>
 )}
 </div>

 {showRegisterDialog && customerPhone.length === 9 && (
 <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-3">
 <p className="text-blue-300 text-sm text-right">عميل غير مسجل - يمكنك تسجيله الآن</p>
 <div className="space-y-2">
 <Label className="text-gray-300 text-right block text-xs">
 البريد الإلكتروني (اختياري)
 </Label>
 <Input
 value={customerEmail}
 onChange={(e) => setCustomerEmail(e.target.value)}
 placeholder="customer@example.com"
 type="email"
 className="bg-[#1a1410] border-blue-500/30 text-white text-right"
 data-testid="input-customer-email"
 />
 </div>
 <Button
 onClick={handleRegisterCustomer}
 disabled={isRegisteringCustomer || !customerName.trim()}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white"
 data-testid="button-register-customer"
 >
 {isRegisteringCustomer ? "جاري التسجيل..." : "تسجيل العميل"}
 </Button>
 <p className="text-xs text-gray-400 text-right">
 سيتمكن العميل من تفعيل حسابه لاحقاً عبر نظام استعادة كلمة المرور
 </p>
 </div>
 )}

 {customerId && customerPoints > 0 && (
 <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-4 rounded-lg border border-purple-500/30 space-y-3">
 <div className="flex items-center justify-between">
 <Badge variant="outline" className="border-purple-400 text-purple-300">
 {customerPoints} نقطة
 </Badge>
 <div className="text-right">
   <span className="text-purple-300 text-sm block">نقاط العميل</span>
   <span className="text-purple-400 text-xs">≈ {pointsToSar(customerPoints).toFixed(2)} ريال</span>
 </div>
 </div>
 {!usePointsDiscount ? (
   <div className="space-y-2">
     <div className="flex gap-2 items-center">
       <Input
         type="number"
         min="0"
         max={customerPoints}
         value={pointsToRedeem || ''}
         onChange={(e) => setPointsToRedeem(Math.min(parseInt(e.target.value) || 0, customerPoints))}
         placeholder="عدد النقاط"
         className="bg-[#1a1410] border-purple-500/30 text-white text-center flex-1"
         data-testid="input-points-to-redeem"
       />
       <Button
         size="sm"
         onClick={() => { if (pointsToRedeem > 0) setUsePointsDiscount(true); }}
         disabled={pointsToRedeem <= 0}
         className="bg-purple-600 hover:bg-purple-700 text-white"
         data-testid="button-apply-points-discount"
       >
         <Wallet className="w-4 h-4 ml-1" />
         تطبيق
       </Button>
     </div>
     {pointsToRedeem > 0 && (
       <p className="text-xs text-purple-400 text-right">
         خصم: {pointsToSar(pointsToRedeem).toFixed(2)} ريال
       </p>
     )}
   </div>
 ) : (
   <div className="bg-purple-900/30 border border-purple-500/50 rounded p-2 flex items-center justify-between">
     <Button
       size="sm"
       variant="ghost"
       onClick={() => { setUsePointsDiscount(false); setPointsToRedeem(0); }}
       className="text-red-400 hover:text-red-300 text-xs"
       data-testid="button-cancel-points-discount"
     >
       إلغاء
     </Button>
     <div className="text-right">
       <p className="text-purple-300 text-sm font-medium">تم تطبيق {pointsToRedeem} نقطة</p>
       <p className="text-green-400 text-xs">خصم {pointsToSar(pointsToRedeem).toFixed(2)} ريال</p>
     </div>
   </div>
 )}
 </div>
 )}

 {customerId && customerEmail && (
 <div className="text-xs text-gray-400 text-right">
 {customerEmail}
 </div>
 )}

 {loyaltyCard && (
 <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 p-4 rounded-lg border-2 border-primary/30 space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Gift className="w-5 h-5 text-accent" />
 <span className="text-accent font-semibold">بطاقة كوبي</span>
 </div>
 <Badge className="bg-background0 text-black">
 {(loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)} أختام
 </Badge>
 </div>
 <div className="flex items-center gap-1 justify-end">
 {Array.from({ length: 10 }).map((_, i) => {
 const isEarned = i < (loyaltyCard.freeCupsEarned || 0);
 const isUsed = i < (loyaltyCard.freeCupsRedeemed || 0);
 return (
 <div
 key={i}
 className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
 isUsed
 ? 'bg-gray-600 border-gray-500 text-gray-400 line-through'
 : isEarned
 ? 'bg-background0 border-primary text-black'
 : 'bg-gray-800 border-gray-600 text-gray-500'
 }`}
 >
 {isUsed ? 'X' : isEarned ? '•' : i + 1}
 </div>
 );
 })}
 </div>
 <p className="text-xs text-gray-400 text-right flex items-center gap-1 justify-end">
 <Gift className="w-3 h-3 text-accent" />
 المشروبات المجانية متاحة: {Math.floor(((loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)) / 10)}
 </p>
 </div>
 )}

 <div className="space-y-2">
 <Label className="text-gray-300 text-right block text-sm font-medium">
 نوع الطلب
 </Label>
 <div className="grid grid-cols-3 gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => setOrderType('dine-in')}
 className={`flex flex-col items-center gap-1 py-3 ${
 orderType === 'dine-in' 
 ? 'bg-purple-600 border-purple-500 text-white' 
 : 'bg-[#1a1410] border-primary/30 text-gray-300'
 }`}
 data-testid="button-order-type-dinein"
 >
 <Store className="w-5 h-5" />
 <span className="text-xs">في الكافيه</span>
 </Button>
 <Button
 type="button"
 variant="outline"
 onClick={() => setOrderType('pickup')}
 className={`flex flex-col items-center gap-1 py-3 ${
 orderType === 'pickup' 
 ? 'bg-blue-600 border-blue-500 text-white' 
 : 'bg-[#1a1410] border-primary/30 text-gray-300'
 }`}
 data-testid="button-order-type-pickup"
 >
 <MapPin className="w-5 h-5" />
 <span className="text-xs">استلام</span>
 </Button>
 <Button
 type="button"
 variant="outline"
 onClick={() => setOrderType('delivery')}
 className={`flex flex-col items-center gap-1 py-3 ${
 orderType === 'delivery' 
 ? 'bg-green-600 border-green-500 text-white' 
 : 'bg-[#1a1410] border-primary/30 text-gray-300'
 }`}
 data-testid="button-order-type-delivery"
 >
 <Truck className="w-5 h-5" />
 <span className="text-xs">توصيل</span>
 </Button>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-gray-300 text-right block">
 <Coffee className="w-4 h-4 inline ml-2" />
 رقم الطاولة (اختياري)
 </Label>
 <Input
 value={tableNumber}
 onChange={(e) => setTableNumber(e.target.value)}
 placeholder="مثال: 5 أو A3"
 className="bg-[#1a1410] border-primary/30 text-white text-right"
 data-testid="input-table-number"
 />
 </div>

 <div className="space-y-2">
 <Label className="text-gray-300 text-right block">
 طريقة الدفع
 </Label>
 <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-payment-method">
 <SelectValue />
 </SelectTrigger>
    <SelectContent className="bg-[#1a1410] border-primary/30 text-white">
      <SelectItem value="cash">نقدي</SelectItem>
      <SelectItem value="pos-network">شبكة (POS)</SelectItem>
      <SelectItem value="pos">مدى</SelectItem>
      <SelectItem value="apple_pay">Apple Pay</SelectItem>
      <SelectItem value="qahwa-card">بطاقة قهوة</SelectItem>
    </SelectContent>
 </Select>
 {paymentMethod === 'qahwa-card' && loyaltyCard && (
 <div className="bg-primary/30 border border-primary/50 rounded-lg p-4 space-y-3 mt-2">
 <div className="space-y-2">
 <Label className="text-accent text-sm">عدد الأختام المراد استخدامها</Label>
 <div className="flex gap-2 items-center">
 <Input
 type="number"
 min="0"
 max={(loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)}
 value={stampsToUse}
 onChange={(e) => setStampsToUse(Math.min(parseInt(e.target.value) || 0, (loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)))}
 className="bg-[#1a1410] border-primary/30 text-white text-center w-20"
 data-testid="input-stamps-to-use"
 />
 <span className="text-accent text-sm">من {(loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)}</span>
 </div>
 </div>
 <div className="bg-[#1a1410] rounded p-2 space-y-1">
 <p className="text-xs text-gray-400">تفاصيل الحسم:</p>
 <p className="text-accent text-sm">
 الأختام المستخدمة: {stampsToUse} ختم
 </p>
 <p className="text-accent text-sm">
 {(() => {
 const itemPrices = orderItems.flatMap(item => 
 Array(item.quantity).fill(item.coffeeItem.price)
 ).sort((a, b) => b - a);
 
 let discount = 0;
 const freeItems = [];
 for (let i = 0; i < Math.min(stampsToUse, itemPrices.length); i++) {
 discount += itemPrices[i];
 freeItems.push(itemPrices[i]);
 }
 return `قيمة الخصم: ${discount.toFixed(2)} ريال (${stampsToUse} ختم = ${freeItems.length} عنصر مجاني)`;
 })()}
 </p>
 <p className="text-accent text-sm">
 {(() => {
 const itemPrices = orderItems.flatMap(item => 
 Array(item.quantity).fill(item.coffeeItem.price)
 ).sort((a, b) => b - a);
 
 let discount = 0;
 for (let i = 0; i < Math.min(stampsToUse, itemPrices.length); i++) {
 discount += itemPrices[i];
 }
 const finalPrice = Math.max(0, parseFloat(calculateTotal()) - discount);
 return `السعر النهائي: ${finalPrice.toFixed(2)} ريال`;
 })()}
 </p>
 </div>
 </div>
 )}
 </div>

 <div className="space-y-2 bg-gradient-to-br from-green-900/20 to-emerald-900/20 p-4 rounded-lg border border-green-500/20">
 <Label className="text-gray-300 text-right block flex items-center justify-end gap-2">
 <span className="text-green-400">كود الخصم (اختياري)</span>
 <Gift className="w-5 h-5 text-green-400" />
 </Label>
 <p className="text-xs text-gray-400 text-right mb-2">
 هل لديك كود خصم؟ أدخله هنا للحصول على تخفيض فوري
 </p>
 {!appliedDiscount ? (
 <div className="flex gap-2">
 <Input
 value={discountCode}
 onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
 placeholder="مثال: WELCOME10"
 className="bg-[#1a1410] border-green-500/30 text-white text-right flex-1 focus:border-green-500"
 data-testid="input-discount-code"
 />
 <Button
 onClick={validateDiscountCode}
 disabled={isValidatingDiscount || !discountCode.trim()}
 className="bg-green-600 hover:bg-green-700 min-w-[100px]"
 data-testid="button-apply-discount"
 >
 {isValidatingDiscount ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
 جاري التحقق
 </>
 ) : (
 <>
 <Check className="w-4 h-4 ml-2" />
 تطبيق
 </>
 )}
 </Button>
 </div>
 ) : (
 <div className="bg-green-500/20 border-2 border-green-500/50 rounded-lg p-4 animate-pulse-slow">
 <div className="flex items-center justify-between">
 <div className="text-right flex-1">
 <div className="flex items-center gap-2 justify-end mb-1">
 <p className="text-green-400 font-bold text-lg" data-testid="text-applied-discount-code">{appliedDiscount.code}</p>
 <Check className="w-5 h-5 text-green-400" />
 </div>
 <p className="text-sm text-green-300">{appliedDiscount.reason}</p>
 </div>
 <div className="flex items-center gap-2 mr-4">
 <Badge className="bg-green-600 text-white text-base px-3 py-1">-{appliedDiscount.percentage}%</Badge>
 <Button
 size="sm"
 variant="ghost"
 onClick={removeDiscount}
 className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
 data-testid="button-remove-discount"
 >
 <X className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 <Separator className="bg-background0/20" />

 <div className="space-y-2">
 <div className="flex justify-between items-center text-sm">
 <span className="text-gray-400">المجموع الفرعي:</span>
 <span className="text-gray-300" data-testid="text-subtotal">
 {calculateSubtotal().toFixed(2)} ريال
 </span>
 </div>
 
 {appliedDiscount && (
 <div className="flex justify-between items-center text-sm">
 <span className="text-green-400">الخصم ({appliedDiscount.percentage}%):</span>
 <span className="text-green-400" data-testid="text-discount-amount">
 -{calculateDiscount().toFixed(2)} ريال
 </span>
 </div>
 )}

 {usePointsDiscount && pointsToRedeem > 0 && (
 <div className="flex justify-between items-center text-sm">
 <span className="text-purple-400">خصم النقاط ({pointsToRedeem} نقطة):</span>
 <span className="text-purple-400" data-testid="text-points-discount-amount">
 -{pointsToSar(pointsToRedeem).toFixed(2)} ريال
 </span>
 </div>
 )}

 <Separator className="bg-background0/10" />
 
 <div className="flex justify-between items-center text-lg font-bold">
 <span className="text-accent">الإجمالي:</span>
 <span className="text-accent" data-testid="text-total">
 {calculateTotal()} ريال
 </span>
 </div>
 </div>

 <Button
 onClick={handleSubmitOrder}
 disabled={createOrderMutation.isPending}
 className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white font-bold py-6"
 data-testid="button-submit-order"
 >
 <Check className="w-5 h-5 ml-2" />
 {createOrderMutation.isPending ? "جاري الإنشاء..." : "إنشاء الطلب وإرسال واتساب"}
 </Button>
 </>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 </div>

 <MobileBottomNav employeeRole={employee?.role} />
 </div>
 );
}

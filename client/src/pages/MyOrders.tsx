import { useEffect } from "react";
import { useLocation } from "wouter";
import { useCustomer } from "@/contexts/CustomerContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Coffee, ShoppingBag, Clock } from "lucide-react";
import type { Order } from "@shared/schema";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";

export default function MyOrders() {
 const [, navigate] = useLocation();
 const { customer, isAuthenticated } = useCustomer();

 useEffect(() => {
 if (!isAuthenticated) {
 navigate("/auth");
 }
 }, [isAuthenticated, navigate]);

 const { data: orders = [], isLoading } = useQuery<Order[]>({
 queryKey: ["/api/customers", customer?.id, "orders"],
 enabled: !!customer?.id,
 });

 if (!customer) return null;

 const getStatusBadge = (status: string) => {
 const statusMap: Record<string, { text: string; class: string }> = {
 pending: { text: "قيد الانتظار", class: "bg-yellow-600/20 text-yellow-300 border-yellow-600/30" },
 confirmed: { text: "تم التأكيد", class: "bg-blue-600/20 text-blue-300 border-blue-600/30" },
 in_progress: { text: "قيد التحضير", class: "bg-purple-600/20 text-purple-300 border-purple-600/30" },
 completed: { text: "مكتمل", class: "bg-green-600/20 text-green-300 border-green-600/30" },
 cancelled: { text: "ملغي", class: "bg-red-600/20 text-red-300 border-red-600/30" },
 };
 return statusMap[status] || statusMap.pending;
 };

 return (
 <div 
 className="min-h-screen p-4 pb-20"
 style={{
 background: "linear-gradient(135deg, #1a1410 0%, #2d1810 50%, #1a1410 100%)",
 }}
 >
 {/* Header */}
 <div className="flex items-center justify-between mb-6">
 <Button
 variant="ghost"
 onClick={() => navigate("/copy-card")}
 className="text-accent hover:text-accent hover:bg-primary/20"
 data-testid="button-back"
 >
 <ArrowLeft className="w-5 h-5 ml-2" />
 رجوع للبطاقة 
 </Button>
 </div>

 {/* Page Title */}
 <div className="max-w-4xl mx-auto mb-6">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
 <ShoppingBag className="w-6 h-6 text-white" />
 </div>
 <div>
 <h1 className="text-3xl font-bold text-accent">طلباتي</h1>
 <p className="text-accent/60">سجل جميع طلباتك</p>
 </div>
 </div>
 </div>

 {/* Orders List */}
 <div className="max-w-4xl mx-auto space-y-4">
 {isLoading ? (
 <div className="text-center py-12 text-accent/60">
 <div className="w-12 h-12 border-4 border-primary/30 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
 <p>جارٍ تحميل الطلبات...</p>
 </div>
 ) : orders.length > 0 ? (
 orders.map((order, index) => {
 const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
 const itemsArray = Array.isArray(items) ? items : [];
 const statusInfo = getStatusBadge(order.status);

 return (
 <Card
 key={order.id}
 className="border-primary/30 bg-stone-900/95 backdrop-blur hover:border-primary/30 transition-all"
 data-testid={`card-order-${index}`}
 >
 <div className="p-5">
 {/* Order Header */}
 <div className="flex items-start justify-between mb-4">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-2xl font-bold text-accent" data-testid={`text-order-number-${index}`}>
 {order.orderNumber}
 </span>
 <Badge className={statusInfo.class} data-testid={`badge-status-${index}`}>
 {statusInfo.text}
 </Badge>
 </div>
 <div className="flex items-center gap-2 text-accent/60 text-sm">
 <Clock className="w-4 h-4" />
 <span>{format(new Date(order.createdAt), "d MMMM yyyy، h:mm a", { locale: ar })}</span>
 </div>
 </div>
 <div className="text-left">
 <div className="text-2xl font-bold text-accent" data-testid={`text-total-${index}`}>
 {typeof order.totalAmount === 'string' ? parseFloat(order.totalAmount).toFixed(2) : order.totalAmount.toFixed(2)} <SarIcon />
 </div>
 <div className="text-accent/60 text-sm">
 {order.paymentMethod === 'cash' ? 'نقداً' :
 order.paymentMethod === 'stc' ? 'STC Pay' :
 order.paymentMethod === 'alinma' ? 'الإنماء' :
 order.paymentMethod}
 </div>
 </div>
 </div>

 {/* Order Items */}
 <div className="space-y-2 pt-3 border-t border-primary/20">
 {itemsArray.map((item: any, itemIndex: number) => (
 <div
 key={itemIndex}
 className="bg-stone-800/30 rounded-lg p-3"
 data-testid={`item-${index}-${itemIndex}`}
 >
 <div className="flex items-center gap-3">
 {item.imageUrl && (
 <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
 <img
 src={item.imageUrl}
 alt={item.nameAr}
 className="w-full h-full object-cover"
 />
 </div>
 )}
 <div className="flex-1">
 <div className="text-accent font-medium">{item.nameAr}</div>
 <div className="text-accent/60 text-sm">
 {item.quantity} × {parseFloat(item.unitPrice).toFixed(2)} <SarIcon />
 </div>
 </div>
 <div className="text-accent font-bold">
 {(item.quantity * parseFloat(item.unitPrice)).toFixed(2)} <SarIcon />
 </div>
 </div>
 </div>
 ))}
 </div>

 {/* Customer Notes */}
 {order.customerNotes && (
 <div className="mt-3 pt-3 border-t border-primary/20">
 <div className="bg-primary/10 rounded-lg p-3">
 <div className="flex items-start gap-2">
 <div className="text-accent text-sm font-semibold whitespace-nowrap">
 ملاحظات العميل:
 </div>
 <div className="text-accent/80 text-sm flex-1" data-testid={`text-customer-notes-${index}`}>
 {order.customerNotes}
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </Card>
 );
 })
 ) : (
 <Card className="border-primary/30 bg-stone-900/95">
 <div className="p-12 text-center">
 <Coffee className="w-16 h-16 text-accent/30 mx-auto mb-4" />
 <h3 className="text-xl font-bold text-accent mb-2">
 لا توجد طلبات بعد
 </h3>
 <p className="text-accent/60 mb-6">
 ابدأ بطلب أول مشروب لك الآن!
 </p>
 <Button
 onClick={() => navigate("/menu")}
 className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
 data-testid="button-browse-menu"
 >
 تصفح القائمة
 </Button>
 </div>
 </Card>
 )}
 </div>
 </div>
 );
}

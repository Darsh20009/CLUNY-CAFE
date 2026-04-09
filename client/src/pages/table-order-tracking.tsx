import { useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  Truck,
  AlertCircle,
} from "lucide-react";
import SarIcon from "@/components/sar-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface IOrder {
  id: string;
  orderNumber: string;
  items: any[];
  totalAmount: number;
  status: string;
  tableStatus?: string;
  tableNumber?: string;
  customerInfo?: {
    customerName: string;
    phone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export default function TableOrderTracking() {
  const [match, params] = useRoute("/table-order-tracking/:orderId");
  const { toast } = useToast();
  const orderId = params?.orderId;
  const previousStatusRef = useRef<string | undefined>(undefined);

  // Fetch order details
  const { data: order, isLoading } = useQuery<IOrder>({
    queryKey: ["/api/orders", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error("الطلب غير موجود");
      const data = await response.json();
      
      // Parse items if they're stored as JSON string
      if (data.items && typeof data.items === 'string') {
        try {
          data.items = JSON.parse(data.items);
        } catch (e) {
          console.error("Error parsing order items:", e);
          data.items = [];
        }
      }
      
      // Ensure items is an array
      if (!Array.isArray(data.items)) {
        data.items = [];
      }
      
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 10000, // Poll every 10 seconds
  });
  
  // Detect status changes - Audio notifications removed
  useEffect(() => {
    const currentStatus = order?.tableStatus || order?.status;
    
    if (order && currentStatus && previousStatusRef.current && previousStatusRef.current !== currentStatus) {
      const statusMessages: Record<string, string> = {
        'payment_confirmed': 'تم تأكيد الدفع',
        'preparing': 'جاري تحضير طلبك',
        'ready': 'طلبك جاهز',
        'delivering_to_table': 'طلبك في الطريق',
        'delivered': 'تم توصيل طلبك',
      };
      
      const message = statusMessages[currentStatus] || 'تم تحديث حالة طلبك';
      
      toast({
        title: 'تحديث حالة الطلب',
        description: message,
        duration: 6000,
        className: "bg-blue-600 text-white border-blue-700",
      });
    }
    
    if (order && currentStatus) {
      previousStatusRef.current = currentStatus;
    }
  }, [order, toast]);

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orders/${orderId}/cancel-by-customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationReason: "طلب الإلغاء من العميل",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "فشل في إلغاء الطلب");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      toast({
        title: "تم إلغاء الطلب",
        description: "تم إلغاء طلبك بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل إلغاء الطلب",
        variant: "destructive",
      });
    },
  });

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          label: "في الانتظار",
          description: "طلبك في انتظار استلام الكاشير",
          color: "text-yellow-500",
        };
      case "payment_confirmed":
        return {
          icon: CheckCircle,
          label: "تم تأكيد الدفع",
          description: "تم استلام طلبك وسيتم تحضيره قريباً",
          color: "text-blue-500",
        };
      case "preparing":
        return {
          icon: ChefHat,
          label: "قيد التحضير",
          description: "طلبك قيد التحضير الآن",
          color: "text-orange-500",
        };
      case "ready":
        return {
          icon: CheckCircle,
          label: "جاهز للتقديم",
          description: "طلبك جاهز والآن يتم تقديمه لك",
          color: "text-green-500",
        };
      case "delivered":
        return {
          icon: CheckCircle,
          label: "تم التقديم",
          description: "تم تقديم طلبك بنجاح",
          color: "text-green-500",
        };
      case "delivering_to_table":
        return {
          icon: Truck,
          label: "جاري التوصيل",
          description: "طلبك في الطريق إلى طاولتك",
          color: "text-purple-500",
        };
      case "cancelled":
        return {
          icon: XCircle,
          label: "ملغي",
          description: "تم إلغاء الطلب",
          color: "text-red-500",
        };
      default:
        return {
          icon: AlertCircle,
          label: "غير معروف",
          description: "حالة الطلب غير معروفة",
          color: "text-gray-500",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-lg">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>طلب غير موجود</CardTitle>
          </CardHeader>
          <CardContent>
            <p>عذراً، لم نتمكن من العثور على هذا الطلب.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use tableStatus if available, otherwise fall back to status
  const currentStatus = order.tableStatus || order.status;
  const statusInfo = getStatusInfo(currentStatus);
  const StatusIcon = statusInfo.icon;
  const canCancel = currentStatus === "pending";

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">تتبع الطلب</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  رقم الطلب: {order.orderNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  طاولة: {order.tableNumber}
                </p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {order.totalAmount.toFixed(2)} <SarIcon />
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Status Card */}
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted ${statusInfo.color}`}>
                <StatusIcon className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{statusInfo.label}</h2>
                <p className="text-muted-foreground">{statusInfo.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الطلب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order && Array.isArray(order.items) && order.items.length > 0 ? (
                <>
                  {order.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.nameAr}</p>
                        <p className="text-sm text-muted-foreground">
                          الكمية: {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold">
                        {(item.price * item.quantity).toFixed(2)} <SarIcon />
                      </p>
                    </div>
                  ))}
                  <div className="border-t pt-3 flex justify-between items-center font-bold text-lg">
                    <span>الإجمالي</span>
                    <span>{order.totalAmount.toFixed(2)} <SarIcon /></span>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground">جاري تحميل تفاصيل الطلب...</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        {order.customerInfo && (
          <Card>
            <CardHeader>
              <CardTitle>معلومات العميل</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{order.customerInfo.customerName}</p>
              {order.customerInfo.phone && order.customerInfo.phone !== "guest" && (
                <p className="text-sm text-muted-foreground">
                  الهاتف: {order.customerInfo.phone}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                data-testid="button-cancel-order"
              >
                <XCircle className="w-4 h-4 ml-2" />
                إلغاء الطلب
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                <AlertDialogDescription>
                  هل تريد حقاً إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>رجوع</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => cancelOrderMutation.mutate()}
                  disabled={cancelOrderMutation.isPending}
                >
                  تأكيد الإلغاء
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <div className="text-center text-sm text-muted-foreground">
          يتم تحديث حالة الطلب تلقائياً
        </div>
      </div>
    </div>
  );
}

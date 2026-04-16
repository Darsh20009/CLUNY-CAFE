import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState, EmptyState } from "@/components/ui/states";
import SarIcon from "@/components/sar-icon";
import { 
  Package, MapPin, Clock, Phone, User, CheckCircle, 
  Truck, Coffee, ArrowRight, Home, RefreshCw
} from "lucide-react";

interface DeliveryOrder {
  _id: string;
  id?: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLocation?: { lat: number; lng: number };
  driverName?: string;
  driverPhone?: string;
  driverLocation?: { lat: number; lng: number };
  branchName?: string;
  estimatedDeliveryTime?: string;
  estimatedMinutes?: number;
  totalAmount: number;
  items?: Array<{ name: string; quantity: number }>;
  createdAt: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

const STATUS_STEPS = [
  { key: "pending", label: "جاري التجهيز", icon: Package },
  { key: "assigned", label: "تم تعيين المندوب", icon: User },
  { key: "picked_up", label: "تم الاستلام", icon: Coffee },
  { key: "on_the_way", label: "في الطريق", icon: Truck },
  { key: "delivered", label: "تم التوصيل", icon: CheckCircle },
];

const getStatusIndex = (status: string): number => {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
};

const getProgressPercent = (status: string): number => {
  const idx = getStatusIndex(status);
  return ((idx + 1) / STATUS_STEPS.length) * 100;
};

export default function DeliveryTracking() {
  const [, params] = useRoute("/delivery/track/:orderId");
  const [, setLocation] = useLocation();
  const orderId = params?.orderId;

  useEffect(() => {
    document.title = "تتبع التوصيل - CLUNY CAFE";
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/delivery/orders/by-order', orderId],
    enabled: !!orderId,
    refetchInterval: 30000,
  });

  const order = (data as any)?.order as DeliveryOrder | undefined;

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>تتبع التوصيل</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">يرجى إدخال رقم الطلب للتتبع</p>
            <Link href="/menu">
              <Button className="w-full">
                <ArrowRight className="w-4 h-4 ml-2" />
                العودة للقائمة
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4" dir="rtl">
        <LoadingState />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>لم يتم العثور على الطلب</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">تأكد من رقم الطلب وحاول مرة أخرى</p>
            <Link href="/menu">
              <Button className="w-full">
                <Home className="w-4 h-4 ml-2" />
                العودة للقائمة
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepIndex = getStatusIndex(order.status);
  const progressPercent = getProgressPercent(order.status);
  const isDelivered = order.status === "delivered";
  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5" dir="rtl">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/menu">
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4 ml-2" />
                العودة
              </Button>
            </Link>
            <h1 className="font-bold text-foreground">تتبع الطلب</h1>
            <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                طلب {order.orderNumber || orderId?.slice(-6)}
              </CardTitle>
              {isCancelled ? (
                <Badge variant="destructive">ملغي</Badge>
              ) : isDelivered ? (
                <Badge className="bg-green-500 text-white">تم التوصيل</Badge>
              ) : (
                <Badge className="bg-primary text-primary-foreground">جاري التوصيل</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("ar-SA")}
            </div>
          </CardContent>
        </Card>

        {!isCancelled && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <Progress value={progressPercent} className="h-2" />
              </div>
              
              <div className="space-y-4">
                {STATUS_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isCompleted = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  
                  return (
                    <div 
                      key={step.key}
                      className={`flex items-center gap-3 ${
                        isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted 
                          ? isCurrent 
                            ? "bg-primary text-primary-foreground animate-pulse" 
                            : "bg-green-500 text-white"
                          : "bg-muted"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isCurrent ? "text-primary" : ""}`}>
                          {step.label}
                        </p>
                        {isCurrent && order.estimatedMinutes && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ~{order.estimatedMinutes} دقيقة متبقية
                          </p>
                        )}
                      </div>
                      {isCompleted && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {order.driverName && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                معلومات المندوب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{order.driverName}</span>
              </div>
              {order.driverPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a 
                    href={`tel:${order.driverPhone}`} 
                    className="text-primary hover:underline"
                  >
                    {order.driverPhone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              عنوان التوصيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{order.customerAddress}</p>
          </CardContent>
        </Card>

        {order.items && order.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Coffee className="w-5 h-5 text-primary" />
                تفاصيل الطلب
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>المجموع</span>
                  <span className="text-primary">{order.totalAmount?.toFixed(2)} <SarIcon /></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isDelivered && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-bold text-green-600 mb-2">تم التوصيل بنجاح!</h3>
              <p className="text-muted-foreground mb-4">شكراً لطلبك من CLUNY CAFE</p>
              <Link href="/menu">
                <Button className="w-full">
                  طلب جديد
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

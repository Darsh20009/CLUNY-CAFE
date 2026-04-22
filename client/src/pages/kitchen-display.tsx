import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/hooks/use-toast";
import { playNotificationSound } from "@/lib/notification-sounds";
import { useOrderWebSocket } from "@/lib/websocket";
import { OrderCard } from "@/components/ui/order-card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChefHat, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Store,
  ShoppingBag,
  Truck,
  Printer,
  Navigation,
  Clock
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { MobileBottomNav } from "@/components/MobileBottomNav";

// Set global SEO metadata on mount
if (typeof document !== 'undefined') {
  document.title = "شاشة المطبخ - CLUNY CAFE | إدارة الطلبات";
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', 'شاشة المطبخ لـ CLUNY CAFE - إدارة سهلة وسريعة للطلبات المدخلة');
}

interface OrderItem {
  coffeeItemId: string;
  quantity: number;
  size: string;
  extras?: string[];
  sugarLevel?: string;
  notes?: string;
  coffeeItem?: {
    nameAr: string;
    nameEn?: string;
    price?: number;
    imageUrl?: string;
    category?: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  tableStatus?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
  tableNumber?: string;
  orderType?: string;
  deliveryType?: 'pickup' | 'delivery' | 'dine-in' | 'car-pickup' | 'car_pickup';
  carInfo?: {
    carType: string;
    carColor: string;
    plateNumber: string;
  };
  carType?: string;
  carColor?: string;
  carPlate?: string;
  plateNumber?: string;
  arrivalTime?: string;
  scheduledPickupTime?: string;
  preparationHoldUntil?: string;
  customerNotes?: string;
  branchId?: string;
  channel?: string;
  notes?: string;
}

const DELAY_THRESHOLD_MINUTES = 10;

function getElapsedMinutes(dateString: string): number {
  const created = new Date(dateString).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60));
}

export default function KitchenDisplay() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>("all");
  const previousOrderCountRef = useRef<number>(-1);
  const previousReadyCountRef = useRef<number>(-1);
  const alertedPrepNowIds = useRef<Set<string>>(new Set());

  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders/kitchen"],
    refetchInterval: autoRefresh ? 10000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 5000,
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
    staleTime: 60000,
  });

  const calculateAutoPrepTime = (order: Order): number => {
    const base = businessConfig?.prepTimeConfig?.basePrepMinutes ?? 10;
    const extraPerItem = businessConfig?.prepTimeConfig?.extraMinutesPerItem ?? 3;
    const threshold = businessConfig?.prepTimeConfig?.extraItemThreshold ?? 2;
    const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const extra = Math.max(0, totalItems - threshold) * extraPerItem;
    return base + extra;
  };

  const handleNewOrder = useCallback((order: Order) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
    if (soundEnabled) {
      const isOnlineOrder = order?.channel === 'online' || order?.channel === 'web';
      playNotificationSound(isOnlineOrder ? 'onlineOrderVoice' : 'newOrder', 0.7);
      toast({
        title: "طلب جديد!",
        description: `وصل طلب جديد ${order.orderNumber}`,
      });
    }
  }, [soundEnabled, toast]);

  const handleOrderUpdated = useCallback((order: Order) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
  }, []);

  const handleOrderReady = useCallback((order: Order) => {
    if (soundEnabled) {
      playNotificationSound('success', 0.8);
    }
  }, [soundEnabled]);

  const { isConnected } = useOrderWebSocket({
    clientType: "kitchen",
    onNewOrder: handleNewOrder,
    onOrderUpdated: handleOrderUpdated,
    onOrderReady: handleOrderReady,
    enabled: true,
  });

  useEffect(() => {
    if (!Array.isArray(orders)) return;
    const pendingCount = orders.filter(o => o.status === "pending" || o.status === "payment_confirmed" || o.status === "confirmed" || o.status === "in_progress").length;
    const readyCount = orders.filter(o => o.status === "ready").length;
    // Only play success sound when an order transitions to ready (count goes up)
    // Never play newOrder sound here — WebSocket handleNewOrder handles that
    if (previousReadyCountRef.current >= 0 && readyCount > previousReadyCountRef.current && soundEnabled) {
      playNotificationSound('success', 0.8);
    }
    previousOrderCountRef.current = pendingCount;
    previousReadyCountRef.current = readyCount;
  }, [orders, soundEnabled]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, estimatedPrepTimeInMinutes }: { id: string; status: string; estimatedPrepTimeInMinutes?: number }) => {
      return apiRequest("PUT", `/api/orders/${id}/status`, { status, estimatedPrepTimeInMinutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
      toast({
        title: "تم تحديث الحالة",
        description: "تم تحديث حالة الطلب بنجاح",
      });
    },
    onError: (error: any) => {
      console.error("[KDS] Status update failed:", error);
      toast({
        title: "خطأ",
        description: error?.message || "فشل تحديث حالة الطلب",
        variant: "destructive",
      });
    },
  });

  const handleStartPreparing = (id: string, estimatedPrepTime?: number) => {
    const order = orders.find(o => o.id === id);
    const autoTime = order ? calculateAutoPrepTime(order) : 10;
    updateStatusMutation.mutate({ 
      id, 
      status: "in_progress", 
      estimatedPrepTimeInMinutes: estimatedPrepTime ?? autoTime,
    });
  };

  const handleMarkReady = (id: string) => {
    updateStatusMutation.mutate({ id, status: "ready" });
  };

  const handleMarkCompleted = (id: string) => {
    updateStatusMutation.mutate({ id, status: "completed" });
  };

  const updateTimeMutation = useMutation({
    mutationFn: async ({ id, additionalMinutes }: { id: string; additionalMinutes: number }) => {
      return apiRequest("PATCH", `/api/orders/${id}/prep-time`, { additionalMinutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
      toast({
        title: "تم تحديث الوقت",
        description: "تم إضافة وقت إضافي وإبلاغ العميل",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل تحديث الوقت",
        variant: "destructive",
      });
    },
  });

  const handleUpdateTime = (id: string, additionalMinutes: number) => {
    updateTimeMutation.mutate({ id, additionalMinutes });
  };

  const filterByDeliveryType = useCallback((orderList: Order[]) => {
    if (deliveryTypeFilter === "all") return orderList;
    return orderList.filter(o => {
      const type = o.deliveryType || o.orderType;
      if (deliveryTypeFilter === "dine-in") return type === "dine-in" || type === "dine_in";
      if (deliveryTypeFilter === "pickup") return type === "pickup" || type === "takeaway";
      if (deliveryTypeFilter === "delivery") return type === "delivery";
      if (deliveryTypeFilter === "car-pickup") return type === "car-pickup" || type === "car_pickup";
      return true;
    });
  }, [deliveryTypeFilter]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const { pendingOrders, preparingOrders, readyOrders, delayedOrders, delayedCount, scheduledOrders, needsPrepNowOrders } = useMemo(() => {
    void tick;
    const filteredOrders = filterByDeliveryType(orders);
    const now = Date.now();
    
    const isOnHold = (o: Order) =>
      !!(o.scheduledPickupTime && o.preparationHoldUntil && new Date(o.preparationHoldUntil).getTime() > now);
    
    const isPrepDue = (o: Order) =>
      !!(o.scheduledPickupTime && o.preparationHoldUntil && new Date(o.preparationHoldUntil).getTime() <= now);

    const scheduled = filteredOrders.filter(o =>
      isOnHold(o) && (o.status === "pending" || o.status === "payment_confirmed" || o.status === "confirmed")
    );

    const needsPrepNow = filteredOrders.filter(o =>
      isPrepDue(o) && (o.status === "pending" || o.status === "payment_confirmed" || o.status === "confirmed")
    );
    
    const pending = filteredOrders.filter(o => 
      (o.status === "pending" || o.status === "payment_confirmed" || o.status === "confirmed") && !isOnHold(o)
    );
    const preparing = filteredOrders.filter(o => o.status === "in_progress");
    const ready = filteredOrders.filter(o => o.status === "ready" || o.status === "completed");
    
    const delayed = [...pending, ...preparing].filter(o => 
      getElapsedMinutes(o.createdAt) >= DELAY_THRESHOLD_MINUTES
    );

    return {
      pendingOrders: pending,
      preparingOrders: preparing,
      readyOrders: ready,
      delayedOrders: delayed,
      delayedCount: delayed.length,
      scheduledOrders: scheduled,
      needsPrepNowOrders: needsPrepNow,
    };
  }, [orders, filterByDeliveryType, tick]);

  useEffect(() => {
    if (!soundEnabled || needsPrepNowOrders.length === 0) return;
    const newAlerts = needsPrepNowOrders.filter(o => !alertedPrepNowIds.current.has(o.id));
    if (newAlerts.length === 0) return;
    newAlerts.forEach(o => alertedPrepNowIds.current.add(o.id));
    playNotificationSound('cashierOrder', 0.9);
    toast({
      title: "⏰ حان وقت التحضير!",
      description: `${newAlerts.length} طلب مجدول يحتاج للتحضير الآن`,
    });
  }, [needsPrepNowOrders, soundEnabled]);

  const getFilteredOrders = () => {
    switch (activeTab) {
      case "pending":
        return [...needsPrepNowOrders, ...pendingOrders];
      case "preparing":
        return preparingOrders;
      case "ready":
        return readyOrders;
      case "delayed":
        return delayedOrders;
      case "scheduled":
        return scheduledOrders;
      default:
        return [...needsPrepNowOrders, ...pendingOrders, ...preparingOrders, ...readyOrders, ...scheduledOrders];
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <LoadingState message="جاري تحميل الطلبات..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0" dir="rtl">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/employee/dashboard")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ChefHat className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">شاشة المطبخ</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {needsPrepNowOrders.length > 0 && (
                <Badge className="bg-orange-500 text-white animate-pulse">
                  <AlertTriangle className="h-3 w-3 ml-1" />
                  {needsPrepNowOrders.length} يحتاج تحضير الآن!
                </Badge>
              )}
              {scheduledOrders.length > 0 && (
                <Badge className="bg-blue-500 text-white">
                  <Clock className="h-3 w-3 ml-1" />
                  {scheduledOrders.length} مجدول
                </Badge>
              )}
              {delayedCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                  <AlertTriangle className="h-3 w-3 ml-1" />
                  {delayedCount} طلب متأخر
                </Badge>
              )}
              
              <Badge 
                variant="outline" 
                className={isConnected ? "bg-green-500/10 text-green-500 border-green-500/50" : "bg-red-500/10 text-red-500 border-red-500/50"}
                data-testid="badge-ws-status"
              >
                {isConnected ? <Wifi className="h-3 w-3 ml-1" /> : <WifiOff className="h-3 w-3 ml-1" />}
                {isConnected ? "متصل" : "غير متصل"}
              </Badge>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  انتظار: {pendingOrders.length}
                </Badge>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  تحضير: {preparingOrders.length}
                </Badge>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  جاهز: {readyOrders.length}
                </Badge>
              </div>
              
              <Select value={deliveryTypeFilter} onValueChange={setDeliveryTypeFilter}>
                <SelectTrigger className="w-32" data-testid="select-delivery-filter">
                  <SelectValue placeholder="نوع الطلب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="dine-in">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      محلي
                    </div>
                  </SelectItem>
                  <SelectItem value="pickup">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      سفري
                    </div>
                  </SelectItem>
                  <SelectItem value="delivery">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      توصيل
                    </div>
                  </SelectItem>
                  <SelectItem value="car-pickup">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4" />
                      استلام من السيارة
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={soundEnabled ? "border-primary text-primary" : "border-muted text-muted-foreground"}
                data-testid="button-toggle-sound"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 ml-1" /> : <VolumeX className="h-4 w-4 ml-1" />}
                {soundEnabled ? "الصوت" : "صامت"}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? "border-primary text-primary" : ""}
                data-testid="button-toggle-auto-refresh"
              >
                <RefreshCw className={`h-4 w-4 ml-1 ${autoRefresh ? "animate-spin" : ""}`} />
                {autoRefresh ? "تحديث تلقائي" : "تحديث يدوي"}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="all" data-testid="tab-all">
              الكل ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              انتظار ({pendingOrders.length + needsPrepNowOrders.length})
            </TabsTrigger>
            <TabsTrigger value="preparing" data-testid="tab-preparing">
              تحضير ({preparingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="ready" data-testid="tab-ready">
              جاهز ({readyOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="delayed" 
              data-testid="tab-delayed"
              className={delayedCount > 0 ? "text-destructive" : ""}
            >
              متأخر ({delayedCount})
            </TabsTrigger>
            <TabsTrigger
              value="scheduled"
              data-testid="tab-scheduled"
              className={needsPrepNowOrders.length > 0 ? "text-orange-500 font-bold" : scheduledOrders.length > 0 ? "text-blue-500" : ""}
            >
              مجدول ({scheduledOrders.length + needsPrepNowOrders.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-4">
            {getFilteredOrders().length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">لا توجد طلبات</h3>
                <p className="text-muted-foreground">
                  {activeTab === "all" 
                    ? "لا توجد طلبات حالياً" 
                    : `لا توجد طلبات في حالة ${
                        activeTab === "pending" ? "الانتظار" : 
                        activeTab === "preparing" ? "التحضير" : "جاهز"
                      }`
                  }
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {getFilteredOrders()
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      variant="kds"
                      showTimer={true}
                      showActions={true}
                      onStartPreparing={handleStartPreparing}
                      onMarkReady={handleMarkReady}
                      onUpdateTime={handleUpdateTime}
                      isPending={updateStatusMutation.isPending || updateTimeMutation.isPending}
                    />
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <MobileBottomNav />
    </div>
  );
}
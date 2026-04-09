import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useOrderWebSocket } from "@/lib/websocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CheckCircle, ChefHat, Truck, XCircle, User, MapPin, Volume2, VolumeX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { playNotificationSound } from "@/lib/notification-sounds";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import SarIcon from "@/components/sar-icon";

interface Employee {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

interface IOrder {
  id: string;
  orderNumber: string;
  items: any[];
  totalAmount: number;
  status: string;
  tableStatus?: string;
  tableNumber?: string;
  branchId?: string;
  branchName?: string;
  assignedCashierId?: string;
  customerInfo?: {
    customerName: string;
    name?: string;
    phone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface IBranch {
  id: string;
  nameAr: string;
}

export default function CashierTableOrders() {
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const parsed = JSON.parse(storedEmployee);
      setEmployee(parsed);
    } else {
      setLocation("/employee/gateway");
    }
  }, [setLocation]);

  const handleOrderEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/table/unassigned"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cashier", employee?.id, "orders"] });
  }, [employee?.id]);

  useOrderWebSocket({
    clientType: "display",
    onNewOrder: handleOrderEvent,
    onOrderUpdated: handleOrderEvent,
    enabled: !!employee,
  });

  // Fetch unassigned orders
  const { data: unassignedOrders } = useQuery<IOrder[]>({
    queryKey: ["/api/orders/table/unassigned"],
    refetchInterval: 60000,
    staleTime: 30000,
    enabled: !!employee,
  });

  // Notify when new orders arrive with sound
  useEffect(() => {
    if (unassignedOrders && unassignedOrders.length > 0) {
      const currentOrderIds = new Set(unassignedOrders.map(order => order.id));
      
      // Find truly new orders (IDs that weren't in previous set)
      const newOrderIds = [...currentOrderIds].filter(id => !previousOrderIdsRef.current.has(id));
      
      if (newOrderIds.length > 0 && previousOrderIdsRef.current.size > 0) {
        // Play notification sound for new orders
        if (soundEnabled) {
          playNotificationSound('cashierOrder', 0.6);
        }
        
        toast({
          title: `طلب جديد من الطاولة`,
          description: `لديك ${newOrderIds.length} ${newOrderIds.length === 1 ? 'طلب جديد' : 'طلبات جديدة'}`,
          duration: 6000,
          className: "bg-green-600 text-white border-green-700",
        });
      }
      
      // Update the ref with current order IDs
      previousOrderIdsRef.current = currentOrderIds;
    }
  }, [unassignedOrders, toast]);

  // Fetch branches
  const { data: branches = [] } = useQuery<IBranch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const response = await fetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
  });

  // Fetch cashier's assigned orders
  const { data: myOrders } = useQuery<IOrder[]>({
    queryKey: ["/api/cashier", employee?.id, "orders"],
    enabled: !!employee?.id,
    queryFn: async () => {
      const response = await fetch(`/api/cashier/${employee?.id}/orders`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Assign order to cashier mutation
  const assignOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!employee?.id) {
        throw new Error("معرف الكاشير غير متاح. يرجى تسجيل الدخول مجدداً");
      }
      const response = await fetch(`/api/orders/${orderId}/assign-cashier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ cashierId: employee.id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/table/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashier", employee?.id, "orders"] });
      
      // Play success sound when accepting order
      if (soundEnabled) {
        playNotificationSound('success', 0.5);
      }
      
      toast({
        title: "تم استلام الطلب",
        description: "تم استلام الطلب بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject order mutation
  const rejectOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}/table-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ tableStatus: "cancelled" }),
      });
      if (!response.ok) throw new Error("Failed to reject order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/table/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashier", employee?.id, "orders"] });
      toast({
        title: "تم رفض الطلب",
        description: "تم إلغاء الطلب بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل رفض الطلب",
        variant: "destructive",
      });
    },
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      if (!employee?.id) {
        throw new Error("معرف الكاشير غير متاح. يرجى تسجيل الدخول مجدداً");
      }
      const response = await fetch(`/api/orders/${orderId}/table-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ tableStatus: status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier", employee?.id, "orders"] });
      
      // Play different sounds based on status
      if (soundEnabled) {
        if (variables.status === 'delivered') {
          playNotificationSound('success', 0.5);
        } else {
          playNotificationSound('statusChange', 0.4);
        }
      }
      
      toast({
        title: "تم تحديث حالة الطلب",
        description: getStatusDescription(variables.status),
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل تحديث حالة الطلب",
        variant: "destructive",
      });
    },
  });
  
  const getStatusDescription = (status: string) => {
    switch (status) {
      case "payment_confirmed":
        return "تم تأكيد الدفع";
      case "preparing":
        return "الطلب قيد التحضير";
      case "ready":
        return "الطلب جاهز للتقديم";
      case "delivered":
        return "تم تقديم الطلب للعميل";
      case "cancelled":
        return "تم إلغاء الطلب";
      default:
        return "تم تحديث الحالة";
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">طلب جديد</Badge>;
      case "payment_confirmed":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">تم الدفع</Badge>;
      case "preparing":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">قيد التحضير</Badge>;
      case "ready":
        return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">جاهز للتقديم</Badge>;
      case "delivering_to_table":
        return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">جاري التوصيل</Badge>;
      case "delivered":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">تم التقديم</Badge>;
      case "cancelled":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white">ملغي</Badge>;
      default:
        return <Badge variant="secondary">غير معروف</Badge>;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "pending":
        return Clock;
      case "payment_confirmed":
        return CheckCircle;
      case "preparing":
        return ChefHat;
      case "ready":
        return CheckCircle;
      case "delivering_to_table":
        return Truck;
      case "delivered":
        return CheckCircle;
      case "cancelled":
        return XCircle;
      default:
        return Clock;
    }
  };

  // No branch filtering needed here
  const filteredUnassignedOrders = unassignedOrders || [];
  const filteredMyOrders = myOrders || [];

  return (
    <div className="min-h-screen p-4 pb-20 sm:pb-4 bg-[#e3e1c5] text-[#111112]" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-accent">إدارة طلبات الطاولات</h1>
            <p className="text-gray-400">
              مرحباً {employee?.fullName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={soundEnabled ? "border-green-500 text-green-500" : "border-muted text-muted-foreground"}
              data-testid="button-toggle-sound"
              aria-label={soundEnabled ? "كتم الصوت" : "تفعيل الصوت"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="outline" className="bg-[#944219]" onClick={() => setLocation("/employee/dashboard")}>
              العودة للوحة التحكم
            </Button>
          </div>
        </div>


        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              طلبات جديدة ({filteredUnassignedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="my-orders">
              طلباتي ({filteredMyOrders.filter(o => o.tableStatus !== 'delivered' && o.tableStatus !== 'cancelled').length})
            </TabsTrigger>
            <TabsTrigger value="tables">
              إدارة الطاولات
            </TabsTrigger>
          </TabsList>

          {/* Unassigned Orders */}
          <TabsContent value="pending">
            <Card className="border-primary/20 bg-[#54513f]">
              <CardHeader>
                <CardTitle className="text-accent text-right">الطلبات الجديدة</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredUnassignedOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    لا توجد طلبات جديدة
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredUnassignedOrders.map((order) => {
                      const StatusIcon = getStatusIcon(order.tableStatus);
                      const branch = branches.find(b => b.id === order.branchId);
                      return (
                        <Card key={order.id} className="bg-[#1a1410] border-primary/10">
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                {branch && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="w-4 h-4 text-accent" />
                                    <span className="text-xs bg-gradient-to-r from-amber-600 to-amber-700 text-white px-2 py-1 rounded">
                                      {branch.nameAr}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <StatusIcon className="w-5 h-5" />
                                  <h3 className="font-bold text-lg">
                                    طاولة {order.tableNumber}
                                  </h3>
                                  {getStatusBadge(order.tableStatus)}
                                </div>
                                {order.customerInfo && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <User className="w-4 h-4" />
                                    <span>{order.customerInfo.customerName || order.customerInfo.name}</span>
                                  </div>
                                )}
                                <div className="text-sm">
                                  <span className="font-medium">العناصر:</span>{" "}
                                  {Array.isArray(order.items) ? order.items.map((item: any) => `${item.nameAr} (${item.quantity})`).join(", ") : "لا توجد عناصر"}
                                </div>
                                <div className="font-bold text-lg">
                                  {order.totalAmount.toFixed(2)} <SarIcon />
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                  onClick={() => assignOrderMutation.mutate(order.id)}
                                  disabled={assignOrderMutation.isPending || rejectOrderMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                  data-testid={`button-accept-${order.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 ml-1" />
                                  قبول
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm(`هل أنت متأكد من رفض طلب الطاولة ${order.tableNumber}؟`)) {
                                      rejectOrderMutation.mutate(order.id);
                                    }
                                  }}
                                  disabled={assignOrderMutation.isPending || rejectOrderMutation.isPending}
                                  data-testid={`button-reject-${order.id}`}
                                >
                                  <XCircle className="w-4 h-4 ml-1" />
                                  رفض
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Orders */}
          <TabsContent value="my-orders">
            <Card className="border-primary/20 bg-[#54513f]">
              <CardHeader>
                <CardTitle className="text-accent text-right">طلباتي</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredMyOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    لا توجد طلبات مستلمة
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMyOrders.map((order) => {
                      const StatusIcon = getStatusIcon(order.tableStatus);
                      return (
                        <Card key={order.id} className="bg-[#1a1410] border-primary/10">
                          <CardContent className="p-4">
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className="w-5 h-5" />
                                    <h3 className="font-bold text-lg">
                                      طاولة {order.tableNumber}
                                    </h3>
                                    {getStatusBadge(order.tableStatus)}
                                  </div>
                                  {order.customerInfo && (
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                      <User className="w-4 h-4" />
                                      <span>{order.customerInfo.customerName || order.customerInfo.name}</span>
                                    </div>
                                  )}
                                  <div className="text-sm text-white">
                                    <span className="font-medium">العناصر:</span>{" "}
                                    {Array.isArray(order.items) ? order.items.map((item: any) => `${item.nameAr} (${item.quantity})`).join(", ") : "لا توجد عناصر"}
                                  </div>
                                  <div className="font-bold text-lg text-accent">
                                    {order.totalAmount.toFixed(2)} <SarIcon />
                                  </div>
                                </div>
                              </div>

                              {/* Status Controls */}
                              {order.tableStatus !== "delivered" && order.tableStatus !== "cancelled" && (
                                <div className="border-t border-primary/20 pt-4 space-y-3">
                                  <div>
                                    <Label className="text-accent text-sm mb-2 block">تحديث حالة الطلب:</Label>
                                    <Select
                                      value={order.tableStatus}
                                      onValueChange={(value) =>
                                        updateStatusMutation.mutate({
                                          orderId: order.id,
                                          status: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger data-testid={`select-status-${order.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="payment_confirmed">
                                          تم تأكيد الدفع
                                        </SelectItem>
                                        <SelectItem value="preparing">قيد التحضير</SelectItem>
                                        <SelectItem value="ready">جاهز للتقديم</SelectItem>
                                        <SelectItem value="delivered">تم التقديم</SelectItem>
                                        <SelectItem value="cancelled">إلغاء</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm(`هل أنت متأكد من رفض طلب الطاولة ${order.tableNumber}؟`)) {
                                          rejectOrderMutation.mutate(order.id);
                                        }
                                      }}
                                      disabled={rejectOrderMutation.isPending}
                                      data-testid={`button-reject-order-${order.id}`}
                                    >
                                      رفض الطلب
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tables Management */}
          <TabsContent value="tables">
            <Card className="border-primary/20 bg-[#54513f]">
              <CardHeader>
                <CardTitle className="text-accent text-right">إدارة الطاولات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">
                    لإدارة الطاولات، يرجى الذهاب إلى لوحة تحكم المدير
                  </p>
                  <Button onClick={() => setLocation("/manager/tables")}>
                    الذهاب إلى إدارة الطاولات
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <MobileBottomNav employeeRole={employee?.role} />
    </div>
  );
}

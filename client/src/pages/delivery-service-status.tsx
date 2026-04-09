import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

interface ServiceStatus {
  provider: string;
  status: 'connected' | 'disconnected' | 'warning';
  latency?: string;
  ordersToday?: number;
  lastActive?: string;
}

export default function DeliveryServiceStatusPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: services = [], refetch } = useQuery<ServiceStatus[]>({
    queryKey: ["/api/integrations/delivery/service-status"],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">متصل</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">غير متصل</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">تحذير</Badge>;
      default:
        return <Badge>غير معروف</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">حالة خدمات التوصيل</h1>
          <p className="text-gray-500 mt-2">مراقبة اتصال خدمات التوصيل والشركاء</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <Card key={service.provider}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-lg capitalize">{service.provider}</CardTitle>
              {service.status === 'connected' ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">الحالة:</span>
                {getStatusBadge(service.status)}
              </div>
              
              {service.latency && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    الاستجابة:
                  </span>
                  <span className="text-sm font-mono">{service.latency}</span>
                </div>
              )}

              {service.ordersToday !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">الطلبات اليوم:</span>
                  <span className="text-sm font-semibold">{service.ordersToday}</span>
                </div>
              )}

              {service.lastActive && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">آخر نشاط:</span>
                  <span className="text-sm">{service.lastActive}</span>
                </div>
              )}

              <div className="pt-2 border-t flex items-center">
                {service.status === 'connected' ? (
                  <div className="flex items-center text-xs text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    الاتصال مستقر
                  </div>
                ) : (
                  <div className="flex items-center text-xs text-red-600">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    فحص الاتصال
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {services.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            لم يتم العثور على خدمات توصيل متصلة
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Search, Calendar, Phone, Users, Clock, Clock3, ArrowRight, Loader2 } from "lucide-react";

interface Reservation {
  tableId: string;
  tableNumber: string;
  reservation: {
    customerName: string;
    customerPhone: string;
    reservationDate: string;
    reservationTime: string;
    numberOfGuests: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
    autoExpiryTime?: string;
    extensionCount?: number;
    reservedAt: string;
  };
}

export default function CustomerReservations() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchPhone, setSearchPhone] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Search for reservation by phone
  const { data: reservations = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/tables/reservations/customer", searchPhone],
    queryFn: async () => {
      if (!searchPhone.trim()) return [];
      
      const response = await fetch(`/api/tables/reservations/customer/${searchPhone}`);
      if (response.ok) {
        return await response.json();
      }
      throw new Error("فشل البحث عن الحجوزات");
    },
    enabled: false
  });

  // Extend reservation
  const extendMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/extend-reservation`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error("فشل في تمديد الحجز");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "تم",
        description: "تم تمديد الحجز لساعة إضافية",
        className: "bg-green-600 text-white border-green-700"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    if (!searchPhone.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال رقم جوالك",
        variant: "destructive"
      });
      return;
    }
    setHasSearched(true);
    refetch();
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">قيد الانتظار</Badge>;
      case 'confirmed':
        return <Badge className="bg-green-600 text-white">مؤكد</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">ملغى</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-300">منتهي</Badge>;
      case 'completed':
        return <Badge className="bg-blue-600 text-white">مكتمل</Badge>;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('ar', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ar');
    } catch {
      return dateString;
    }
  };

  const isReservationActive = (reservation: any) => {
    return ['pending', 'confirmed'].includes(reservation.status);
  };

  const canExtend = (reservation: any) => {
    return reservation.status === 'confirmed' && !reservation.extensionCount;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">حجوزاتي</h1>
          </div>
          <p className="text-gray-600 mr-10">ابحث عن حجوزات طاولاتك بنمرة جوالك</p>
        </div>

        {/* Search Bar */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              ابحث عن حجزك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="رقم الجوال (مثال: 501234567)"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
                data-testid="input-search-phone"
              />
              <Button 
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-search"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 ml-2" />
                )}
                بحث
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                <div className="flex justify-center mb-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                جاري البحث...
              </CardContent>
            </Card>
          ) : hasSearched && reservations.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                لا توجد حجوزات لهذا الرقم
              </CardContent>
            </Card>
          ) : hasSearched && reservations.length > 0 ? (
            reservations.map((item: any) => (
              <Card key={item.tableId} className="shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Top Row - Table and Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-blue-600">
                          {item.tableNumber}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">طاولة رقم</p>
                          <p className="font-semibold text-gray-900">{item.reservation.customerName}</p>
                        </div>
                      </div>
                      <div>
                        {getStatusDisplay(item.reservation.status)}
                      </div>
                    </div>

                    {/* Reservation Details */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Users className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">عدد الضيوف</p>
                          <p className="font-semibold">{item.reservation.numberOfGuests} ضيف</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">الموعد</p>
                          <p className="font-semibold">{formatDate(item.reservation.reservationDate)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">الساعة</p>
                          <p className="font-semibold">{item.reservation.reservationTime}</p>
                        </div>
                      </div>

                      {isReservationActive(item.reservation) && item.reservation.autoExpiryTime && (
                        <div className="flex items-center gap-2 text-orange-700">
                          <Clock3 className="w-5 h-5 text-orange-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-600">ينتهي في</p>
                            <p className="font-semibold text-orange-600">
                              {formatTime(item.reservation.autoExpiryTime)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Extension Info */}
                    {item.reservation.extensionCount > 0 && (
                      <div className="flex items-center gap-2 text-green-700 pt-2 border-t">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                        <p className="text-sm">تم تمديد الحجز</p>
                      </div>
                    )}

                    {/* Action Button */}
                    {canExtend(item.reservation) && (
                      <div className="pt-4 border-t">
                        <Button
                          onClick={() => extendMutation.mutate(item.tableId)}
                          disabled={extendMutation.isPending}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          data-testid={`button-extend-${item.tableId}`}
                        >
                          {extendMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              جاري التمديد...
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 ml-2" />
                              تمديد الحجز لساعة إضافية
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Status Message */}
                    {item.reservation.status === 'expired' && (
                      <div className="pt-4 border-t bg-gray-50 p-3 rounded text-center">
                        <p className="text-sm text-gray-700">انتهت صلاحية هذا الحجز</p>
                      </div>
                    )}

                    {item.reservation.status === 'cancelled' && (
                      <div className="pt-4 border-t bg-red-50 p-3 rounded text-center">
                        <p className="text-sm text-red-700">تم إلغاء هذا الحجز</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : null}
        </div>
      </div>
    </div>
  );
}

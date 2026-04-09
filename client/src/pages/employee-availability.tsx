import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { CoffeeItem } from "@shared/schema";
import { Coffee, Check, X } from "lucide-react";

export default function EmployeeAvailability() {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<{[key: string]: string}>({});

  const { data: items = [], isLoading } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (data: { itemId: string; availabilityStatus: string }) => {
      const res = await fetch(`/api/coffee-items/${data.itemId}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilityStatus: data.availabilityStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة المشروب بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل تحديث حالة المشروب",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="font-amiri text-3xl font-bold text-primary flex items-center gap-2">
            <Coffee className="w-8 h-8" />
            إدارة توفر المشروبات
          </h1>
          <p className="text-muted-foreground mt-2">
            تغيير حالة توفر المشروبات (متاح / نفذت الكمية / قريباً)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-amiri text-right">{item.nameAr}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Badge variant={item.availabilityStatus === 'available' || !item.availabilityStatus ? 'default' : 'secondary'} className={item.availabilityStatus === 'available' || !item.availabilityStatus ? 'bg-green-500 hover:bg-green-600' : ''}>
                    متوفر
                  </Badge>
                  {item.availabilityStatus === 'out_of_stock' && <Badge variant="destructive">نفذت الكمية</Badge>}
                  {item.availabilityStatus === 'coming_soon' && <Badge variant="secondary" className="bg-blue-500 text-white">قريباً</Badge>}
                  {item.availabilityStatus === 'temporarily_unavailable' && <Badge variant="outline" className="text-orange-500 border-orange-500">غير متوفر حالياً</Badge>}
                  {item.availabilityStatus === 'new' && <Badge variant="default" className="bg-purple-500 animate-pulse">جديد</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'available' || !item.availabilityStatus ? 'default' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'available' })}
                  >متوفر</Button>
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'out_of_stock' ? 'destructive' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'out_of_stock' })}
                  >نفذ</Button>
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'coming_soon' ? 'default' : 'outline'}
                    className="h-8 text-xs bg-blue-500 hover:bg-blue-600"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'coming_soon' })}
                  >قريباً</Button>
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'new' ? 'default' : 'outline'}
                    className="h-8 text-xs bg-purple-500 hover:bg-purple-600"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'new' })}
                  >جديد</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-12">
            <Coffee className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">لا توجد مشروبات</p>
          </div>
        )}
      </div>
    </div>
  );
}

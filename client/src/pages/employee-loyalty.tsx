import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ChevronRight, Search, Star, UserPlus, Coins, Award, Medal, Crown, Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import SarIcon from "@/components/sar-icon";

const TIER_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  bronze:   { label: "برونزي",  color: "text-amber-600 bg-amber-100",   icon: Medal  },
  silver:   { label: "فضي",     color: "text-slate-600 bg-slate-100",   icon: Star   },
  gold:     { label: "ذهبي",    color: "text-yellow-600 bg-yellow-100", icon: Crown  },
  platinum: { label: "بلاتيني", color: "text-gray-600 bg-gray-100",     icon: Award  },
};

function getTier(tier: string) {
  return TIER_CONFIG[tier] || TIER_CONFIG.bronze;
}

export default function EmployeeLoyalty() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddPointsDialog, setShowAddPointsDialog] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardPhone, setNewCardPhone] = useState("");
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [pointsNote, setPointsNote] = useState("");

  // Card lookup by phone
  const { data: card, isLoading: lookupLoading, error: lookupError, refetch } = useQuery<any>({
    queryKey: ["/api/loyalty/lookup/phone", searchedPhone],
    queryFn: async () => {
      if (!searchedPhone) return null;
      const cleanPhone = searchedPhone.replace(/\D/g, '').slice(-9);
      const res = await fetch(`/api/loyalty/lookup/phone/${cleanPhone}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("فشل في البحث");
      return res.json();
    },
    enabled: !!searchedPhone && searchedPhone.replace(/\D/g, '').length >= 9,
    retry: false,
  });

  const pointsValueInSar = 0.02; // 50 points = 1 SAR

  const handleSearch = () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 9) {
      toast({ variant: "destructive", title: "رقم الهاتف يجب أن يكون 9 أرقام على الأقل" });
      return;
    }
    setSearchedPhone(phone);
  };

  const invalidateCard = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/loyalty/lookup/phone", searchedPhone] });
    refetch();
  };

  // Add points
  const addPointsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/employee/add-points", {
        phone: searchedPhone, points: Number(pointsToAdd), note: pointsNote
      });
      return res.json();
    },
    onSuccess: (data) => {
      invalidateCard();
      setShowAddPointsDialog(false);
      setPointsToAdd("");
      setPointsNote("");
      toast({ title: `✓ تمت إضافة ${pointsToAdd} نقطة`, description: `الرصيد الجديد: ${data.card?.points ?? "-"} نقطة` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  // Create new card
  const createCardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/employee/create-card", {
        customerName: newCardName, phoneNumber: newCardPhone
      });
      return res.json();
    },
    onSuccess: () => {
      setShowCreateDialog(false);
      setNewCardName("");
      setNewCardPhone("");
      toast({ title: "✓ تم إنشاء البطاقة بنجاح", description: "يمكن البحث عن العميل الآن" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const tierCfg = card ? getTier(card.tier || "bronze") : null;
  const TierIcon = tierCfg?.icon;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/employee/dashboard")} data-testid="button-back">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <h1 className="font-black text-lg">بطاقة الولاء</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5" data-testid="button-new-card">
            <UserPlus className="w-4 h-4" />
            بطاقة جديدة
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-5">

        {/* Phone Search */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">ابحث عن العميل برقم الجوال</p>
          <div className="flex gap-2">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5xxxxxxxx"
              type="tel"
              dir="ltr"
              className="text-lg font-mono h-12"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-phone-search"
            />
            <Button onClick={handleSearch} className="h-12 px-5 gap-2" disabled={lookupLoading} data-testid="button-search">
              {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              بحث
            </Button>
          </div>
        </div>

        {/* Result */}
        {searchedPhone && !lookupLoading && (
          <>
            {lookupError || card === null ? (
              /* Not Found */
              <div className="bg-card border rounded-2xl p-8 text-center space-y-3">
                <Search className="w-12 h-12 mx-auto text-muted-foreground opacity-30" />
                <p className="font-bold text-muted-foreground">لا توجد بطاقة بهذا الرقم</p>
                <p className="text-sm text-muted-foreground">{searchedPhone}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewCardPhone(searchedPhone);
                    setShowCreateDialog(true);
                  }}
                  className="gap-2"
                  data-testid="button-create-for-phone"
                >
                  <UserPlus className="w-4 h-4" />
                  إنشاء بطاقة لهذا الرقم
                </Button>
              </div>
            ) : card ? (
              /* Card Found */
              <div className="space-y-4">
                {/* Card Info */}
                <div className="bg-card border rounded-2xl overflow-hidden" data-testid="card-found">
                  <div className="bg-primary/5 border-b px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-black text-lg">{card.customerName || "عميل"}</p>
                      <p className="text-sm text-muted-foreground font-mono">{card.phoneNumber}</p>
                    </div>
                    {tierCfg && TierIcon && (
                      <Badge className={`gap-1.5 ${tierCfg.color} border-none`} data-testid="badge-tier">
                        <TierIcon className="w-3.5 h-3.5" />
                        {tierCfg.label}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-x-reverse">
                    <div className="p-4 text-center">
                      <p className="text-3xl font-black text-primary" data-testid="text-points">{(card.points || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">نقطة</p>
                      <p className="text-[10px] text-blue-600 font-medium">{((card.points || 0) * 0.02).toFixed(2)} ر.س</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-2xl font-black text-muted-foreground" data-testid="text-discount-count">{card.discountCount || 0}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">مرة استخدام</p>
                      <p className="text-[10px] text-muted-foreground">{(card.totalSpent || 0).toFixed(2)} ر.س إجمالي</p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    onClick={() => setShowAddPointsDialog(true)}
                    variant="outline"
                    className="h-14 gap-2 text-sm font-bold border-primary/40"
                    data-testid="button-add-points"
                  >
                    <Coins className="w-5 h-5 text-primary" />
                    إضافة نقاط يدوياً
                  </Button>
                </div>

                {/* Card number */}
                <p className="text-center text-xs text-muted-foreground font-mono" data-testid="text-card-number">
                  {card.cardNumber}
                </p>
              </div>
            ) : null}
          </>
        )}

        {/* Empty state */}
        {!searchedPhone && (
          <div className="text-center py-16 space-y-3">
            <Search className="w-16 h-16 mx-auto text-muted-foreground opacity-20" />
            <p className="text-muted-foreground">ابحث عن رقم جوال العميل للبدء</p>
          </div>
        )}
      </div>

      {/* Create Card Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm" dir="rtl" data-testid="dialog-create-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              إنشاء بطاقة ولاء جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>اسم العميل</Label>
              <Input
                value={newCardName}
                onChange={(e) => setNewCardName(e.target.value)}
                placeholder="محمد أحمد"
                data-testid="input-new-name"
              />
            </div>
            <div className="space-y-2">
              <Label>رقم الجوال (9 أرقام)</Label>
              <Input
                value={newCardPhone}
                onChange={(e) => setNewCardPhone(e.target.value)}
                placeholder="5xxxxxxxx"
                type="tel"
                dir="ltr"
                data-testid="input-new-phone"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">إلغاء</Button>
            <Button
              onClick={() => createCardMutation.mutate()}
              disabled={createCardMutation.isPending || !newCardPhone}
              data-testid="button-confirm-create"
            >
              {createCardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              إنشاء البطاقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Points Dialog */}
      <Dialog open={showAddPointsDialog} onOpenChange={setShowAddPointsDialog}>
        <DialogContent className="max-w-sm" dir="rtl" data-testid="dialog-add-points">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" />
              إضافة نقاط يدوياً
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>عدد النقاط</Label>
              <Input
                value={pointsToAdd}
                onChange={(e) => setPointsToAdd(e.target.value)}
                type="number"
                min="1"
                placeholder="100"
                data-testid="input-points-amount"
              />
              {pointsToAdd && Number(pointsToAdd) > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {(Number(pointsToAdd) * pointsValueInSar).toFixed(2)} ريال قيمة خصم
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Input
                value={pointsNote}
                onChange={(e) => setPointsNote(e.target.value)}
                placeholder="سبب الإضافة..."
                data-testid="input-points-note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddPointsDialog(false)} data-testid="button-cancel-points">إلغاء</Button>
            <Button
              onClick={() => addPointsMutation.mutate()}
              disabled={addPointsMutation.isPending || !pointsToAdd || Number(pointsToAdd) <= 0}
              data-testid="button-confirm-points"
            >
              {addPointsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              إضافة النقاط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileBottomNav />
    </div>
  );
}

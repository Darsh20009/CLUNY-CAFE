import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronRight, Gift, Users, Coins, Coffee, Star, Crown,
  Award, Medal, Search, Settings, TrendingUp, Loader2, Save
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const TIER_CONFIG: Record<string, { label: string; color: string; icon: any; min: number }> = {
  bronze:   { label: "برونزي",  color: "bg-amber-100 text-amber-700",   icon: Medal,  min: 0    },
  silver:   { label: "فضي",     color: "bg-slate-100 text-slate-700",   icon: Star,   min: 500  },
  gold:     { label: "ذهبي",    color: "bg-yellow-100 text-yellow-700", icon: Crown,  min: 2000 },
  platinum: { label: "بلاتيني", color: "bg-gray-100 text-gray-700",     icon: Award,  min: 5000 },
};

function getTierBadge(tier: string) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const Icon = cfg.icon;
  return (
    <Badge className={`gap-1 border-none ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

export default function LoyaltyProgram() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  // All loyalty cards (for manager)
  const { data: cards = [], isLoading: cardsLoading } = useQuery<any[]>({
    queryKey: ["/api/loyalty/cards"],
  });

  // Loyalty settings
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/public/loyalty-settings"],
  });

  // Settings form state
  const [pointsEarnedPerSar, setPointsEarnedPerSar] = useState<string>("");
  const [pointsValueInSar, setPointsValueInSar] = useState<string>("");
  const [pointsForFreeDrink, setPointsForFreeDrink] = useState<string>("");

  // Sync form when settings load (use useEffect to avoid setState during render)
  useEffect(() => {
    if (settings) {
      setPointsEarnedPerSar(String(settings.pointsEarnedPerSar ?? 1));
      setPointsValueInSar(String(settings.pointsValueInSar ?? 0.05));
      setPointsForFreeDrink(String(settings.pointsForFreeDrink ?? 500));
    }
  }, [settings]);

  // Save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/config", {
        loyaltyConfig: {
          enabled: true,
          pointsEarnedPerSar: Number(pointsEarnedPerSar),
          pointsValueInSar: Number(pointsValueInSar),
          pointsForFreeDrink: Number(pointsForFreeDrink),
          pointsPerSar: Number(pointsEarnedPerSar) ? Math.round(1 / Number(pointsEarnedPerSar)) : 20,
          pointsPerDrink: 10,
          minPointsForRedemption: 100,
          redemptionRate: 100,
        }
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/loyalty-settings"] });
      toast({ title: "✓ تم حفظ الإعدادات" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  // Stats
  const totalMembers = cards.length;
  const totalPoints = cards.reduce((sum, c) => sum + (c.points || 0), 0);
  const totalFreeCupsRedeemed = cards.reduce((sum, c) => sum + (c.freeCupsRedeemed || 0), 0);
  const activeCards = cards.filter(c => c.isActive !== false && c.status !== 'cancelled').length;

  // Tier distribution
  const tierCounts = cards.reduce((acc, c) => {
    const tier = c.tier || 'bronze';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter by search
  const filtered = cards.filter(c => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      (c.customerName || "").toLowerCase().includes(q) ||
      (c.phoneNumber || "").includes(q) ||
      (c.cardNumber || "").toLowerCase().includes(q)
    );
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")} data-testid="button-back">
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Gift className="w-5 h-5 text-primary" />
          <h1 className="font-black text-xl">برنامج الولاء</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card data-testid="stat-members">
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-black">{totalMembers}</p>
              <p className="text-xs text-muted-foreground">إجمالي الأعضاء</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-active">
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-green-600">{activeCards}</p>
              <p className="text-xs text-muted-foreground">بطاقات نشطة</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-points">
            <CardContent className="pt-4 pb-4 text-center">
              <Coins className="w-6 h-6 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-amber-600">{totalPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">مجموع النقاط</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-redeemed">
            <CardContent className="pt-4 pb-4 text-center">
              <Coffee className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-purple-600">{totalFreeCupsRedeemed}</p>
              <p className="text-xs text-muted-foreground">مشروبات مجانية</p>
            </CardContent>
          </Card>
        </div>

        {/* Tier distribution */}
        {totalMembers > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
              const count = tierCounts[key] || 0;
              const Icon = cfg.icon;
              return (
                <div key={key} className={`rounded-xl p-3 text-center ${cfg.color}`} data-testid={`tier-stat-${key}`}>
                  <Icon className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xl font-black">{count}</p>
                  <p className="text-xs font-medium">{cfg.label}</p>
                </div>
              );
            })}
          </div>
        )}

        <Tabs defaultValue="members">
          <TabsList className="w-full">
            <TabsTrigger value="members" className="flex-1 gap-2">
              <Users className="w-4 h-4" />
              الأعضاء ({totalMembers})
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-2">
              <Settings className="w-4 h-4" />
              الإعدادات
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الجوال أو رقم البطاقة..."
                className="pr-9"
                data-testid="input-search-members"
              />
            </div>

            {cardsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Users className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                <p className="text-muted-foreground">
                  {searchTerm ? "لا توجد نتائج" : "لا توجد بطاقات ولاء بعد"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((card, i) => (
                  <div
                    key={card.id || card._id || i}
                    className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between"
                    data-testid={`member-${i}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm">
                          {(card.customerName || "ع").charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{card.customerName || "عميل"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{card.phoneNumber}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {card.createdAt ? format(new Date(card.createdAt), "dd MMM yyyy", { locale: ar }) : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {getTierBadge(card.tier || "bronze")}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-primary">{(card.points || 0).toLocaleString()} نقطة</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-amber-600">{card.stamps || 0}/6 طابع</span>
                      </div>
                      {card.isActive === false || card.status === 'cancelled' ? (
                        <Badge variant="secondary" className="text-[10px]">معطّلة</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
                <p className="text-center text-xs text-muted-foreground pt-2">
                  {filtered.length} من {totalMembers} عضو
                </p>
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  إعدادات نظام النقاط
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-bold">نقاط لكل ريال ينفقه العميل</Label>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={pointsEarnedPerSar}
                          onChange={(e) => setPointsEarnedPerSar(e.target.value)}
                          data-testid="input-points-per-sar"
                        />
                        <p className="text-xs text-muted-foreground">مثال: 1 = نقطة واحدة لكل ريال</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold">قيمة النقطة بالريال</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={pointsValueInSar}
                          onChange={(e) => setPointsValueInSar(e.target.value)}
                          data-testid="input-points-value"
                        />
                        <p className="text-xs text-muted-foreground">مثال: 0.05 = 20 نقطة = ريال واحد</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold">نقاط للحصول على مشروب مجاني</Label>
                        <Input
                          type="number"
                          min="1"
                          value={pointsForFreeDrink}
                          onChange={(e) => setPointsForFreeDrink(e.target.value)}
                          data-testid="input-points-free-drink"
                        />
                        <p className="text-xs text-muted-foreground">عدد النقاط اللازمة للحصول على مشروب مجاني</p>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-primary/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-sm">معاينة الإعدادات</p>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>• العميل الذي ينفق <span className="font-bold text-foreground">100 ريال</span> يكسب <span className="font-bold text-primary">{(100 * Number(pointsEarnedPerSar || 1)).toFixed(0)} نقطة</span></p>
                        <p>• <span className="font-bold text-foreground">100 نقطة</span> = <span className="font-bold text-primary">{(100 * Number(pointsValueInSar || 0.05)).toFixed(2)} ريال</span> خصم</p>
                        <p>• المشروب المجاني يتطلب <span className="font-bold text-foreground">{pointsForFreeDrink} نقطة</span></p>
                      </div>
                    </div>

                    {/* Tier thresholds info */}
                    <div className="border rounded-xl overflow-hidden">
                      <div className="bg-muted px-4 py-2 text-xs font-bold text-muted-foreground">مستويات العضوية (ثابتة)</div>
                      <div className="divide-y">
                        {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          return (
                            <div key={key} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-full ${cfg.color}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-medium text-sm">{cfg.label}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {cfg.min === 0 ? "الانطلاق" : `${cfg.min.toLocaleString()}+ نقطة`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      onClick={() => saveSettingsMutation.mutate()}
                      disabled={saveSettingsMutation.isPending}
                      className="w-full gap-2"
                      data-testid="button-save-settings"
                    >
                      {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      حفظ الإعدادات
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

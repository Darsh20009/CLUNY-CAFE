import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomerLayout } from "@/components/layouts/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Coffee, Clock, Gift, Percent, ArrowRight, Star, TrendingUp } from "lucide-react";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLocation } from "wouter";
import { useLoyaltyCard } from "@/hooks/useLoyaltyCard";
import { customerStorage } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";
import SarIcon from "@/components/sar-icon";

interface PersonalizedOffer {
  id: string;
  title: string;
  description: string;
  discount: number;
  type: 'loyalty' | 'comeback' | 'birthday' | 'frequent' | 'new';
  expiresIn?: string;
  coffeeItemId?: string;
  coffeeItem?: any;
}

export default function MyOffersPage() {
  const { customer } = useCustomer();
  const [, setLocation] = useLocation();
  const { card: loyaltyCard } = useLoyaltyCard();
  const { toast } = useToast();

  const handleUseOffer = (offer: PersonalizedOffer) => {
    customerStorage.setActiveOffer({
      id: offer.id,
      title: offer.title,
      description: offer.description,
      discount: offer.discount,
      type: offer.type,
      coffeeItemId: offer.coffeeItemId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    
    toast({
      title: "تم تفعيل العرض!",
      description: `${offer.title} - سيتم تطبيقه عند الدفع`,
    });
    
    setLocation("/menu");
  };

  const { data: coffeeItems = [] } = useQuery<any[]>({
    queryKey: ["/api/coffee-items"]
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/customer", customer?.phone],
    enabled: !!customer?.phone
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  const offersConfig = businessConfig?.offersConfig;
  const loyaltyConfig = businessConfig?.loyaltyConfig;
  const ptsPerSar = loyaltyConfig?.pointsPerSar ?? 20;

  const offers = useMemo((): PersonalizedOffer[] => {
    const result: PersonalizedOffer[] = [];
    const points = loyaltyCard?.points || 0;
    const orderCount = orders.length;

    // Points discount
    const pointsRedemption = offersConfig?.pointsRedemption;
    if (pointsRedemption?.enabled !== false) {
      const minPoints = pointsRedemption?.minPoints ?? 100;
      if (points >= minPoints) {
        result.push({
          id: 'points-discount',
          title: 'خصم نقاطك!',
          description: `لديك ${points} نقطة يمكنك استخدامها للحصول على خصم ${(points / ptsPerSar).toFixed(0)} ريال`,
          discount: Math.floor(points / ptsPerSar),
          type: 'loyalty'
        });
      }
    }

    // First order discount
    const firstOrderDiscount = offersConfig?.firstOrderDiscount;
    if (firstOrderDiscount?.enabled !== false && orderCount === 0) {
      const discountValue = firstOrderDiscount?.value ?? 15;
      const discountType = firstOrderDiscount?.discountType ?? 'percent';
      const expiresDays = firstOrderDiscount?.expiresDays ?? 7;
      const discountText = discountType === 'amount' ? `خصم ${discountValue} ريال` : `خصم ${discountValue}%`;
      
      result.push({
        id: 'first-order',
        title: 'عرض الترحيب!',
        description: `احصل على ${discountText} على طلبك الأول كعميل جديد`,
        discount: discountValue,
        type: 'new',
        expiresIn: `${expiresDays} أيام`
      });
    }

    // Comeback discount
    const comebackDiscount = offersConfig?.comebackDiscount;
    if (comebackDiscount?.enabled !== false) {
      const minOrders = comebackDiscount?.minOrders ?? 0;
      const maxOrders = comebackDiscount?.maxOrders ?? 5;
      if (orderCount > minOrders && orderCount < maxOrders) {
        const discountValue = comebackDiscount?.value ?? 10;
        const discountType = comebackDiscount?.discountType ?? 'percent';
        const expiresDays = comebackDiscount?.expiresDays ?? 3;
        const discountText = discountType === 'amount' ? `خصم ${discountValue} ريال` : `خصم ${discountValue}%`;
        
        result.push({
          id: 'comeback',
          title: 'اشتقنا لك!',
          description: `احصل على ${discountText} على طلبك القادم`,
          discount: discountValue,
          type: 'comeback',
          expiresIn: `${expiresDays} أيام`
        });
      }
    }

    // Frequent customer discount
    const frequentDiscount = offersConfig?.frequentDiscount;
    if (frequentDiscount?.enabled !== false) {
      const minOrders = frequentDiscount?.minOrders ?? 5;
      if (orderCount >= minOrders) {
        const discountValue = frequentDiscount?.value ?? 20;
        const discountType = frequentDiscount?.discountType ?? 'percent';
        const discountText = discountType === 'amount' ? `خصم ${discountValue} ريال` : `خصم ${discountValue}%`;
        
        result.push({
          id: 'frequent',
          title: 'عميل مميز!',
          description: `كمكافأة لولائك، احصل على ${discountText} على أي مشروب`,
          discount: discountValue,
          type: 'frequent'
        });
      }
    }

    // Special drink discount
    const specialDrinkDiscount = offersConfig?.specialDrinkDiscount;
    if (specialDrinkDiscount?.enabled !== false && coffeeItems.length > 0) {
      const stableIndex = (customer?.phone?.length || 0) % coffeeItems.length;
      const featuredItem = coffeeItems[stableIndex];
      if (featuredItem) {
        const discountValue = specialDrinkDiscount?.value ?? 25;
        const discountType = specialDrinkDiscount?.discountType ?? 'percent';
        const discountText = discountType === 'amount' ? `خصم ${discountValue} ريال على` : `خصم ${discountValue}% على`;
        
        result.push({
          id: 'special-drink',
          title: 'عرض خاص على مشروبك المفضل',
          description: `${discountText} ${featuredItem.nameAr}`,
          discount: discountValue,
          type: 'frequent',
          coffeeItemId: featuredItem.id,
          coffeeItem: featuredItem,
          expiresIn: 'اليوم فقط'
        });
      }
    }

    // Almost there
    const pointsRedemptionConfig = offersConfig?.pointsRedemption;
    const minPointsThreshold = pointsRedemptionConfig?.minPoints ?? 100;
    if (points >= 50 && points < minPointsThreshold) {
      const pointsNeeded = minPointsThreshold - points;
      const sarValue = pointsNeeded / ptsPerSar;
      
      result.push({
        id: 'almost-there',
        title: 'اقتربت من المكافأة!',
        description: `تحتاج ${pointsNeeded} نقطة إضافية للحصول على خصم ${sarValue.toFixed(0)} ريال`,
        discount: 0,
        type: 'loyalty'
      });
    }

    return result;
  }, [loyaltyCard?.points, orders.length, coffeeItems, customer?.phone, offersConfig, loyaltyConfig, ptsPerSar]);

  const getOfferIcon = (type: PersonalizedOffer['type']) => {
    switch (type) {
      case 'loyalty': return <Star className="w-5 h-5" />;
      case 'comeback': return <Coffee className="w-5 h-5" />;
      case 'birthday': return <Gift className="w-5 h-5" />;
      case 'frequent': return <TrendingUp className="w-5 h-5" />;
      case 'new': return <Sparkles className="w-5 h-5" />;
      default: return <Percent className="w-5 h-5" />;
    }
  };

  const getOfferColor = (type: PersonalizedOffer['type']) => {
    switch (type) {
      case 'loyalty': return 'from-amber-500 to-orange-500';
      case 'comeback': return 'from-blue-500 to-cyan-500';
      case 'birthday': return 'from-pink-500 to-rose-500';
      case 'frequent': return 'from-green-500 to-emerald-500';
      case 'new': return 'from-purple-500 to-violet-500';
      default: return 'from-primary to-accent';
    }
  };

  if (!customer) {
    return (
      <CustomerLayout>
        <div className="container max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Sparkles className="w-12 h-12 text-primary" />
          <p className="font-ibm-arabic text-muted-foreground text-center">
            سجل دخولك لاكتشاف عروضك الخاصة
          </p>
          <Button onClick={() => setLocation("/auth")} data-testid="button-login">
            تسجيل الدخول
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container max-w-lg mx-auto p-4 pb-24" dir="rtl">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/menu")}
            data-testid="button-back"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              عروضك الخاصة
            </h1>
            <p className="text-sm text-muted-foreground">عروض مخصصة لك بناءً على تفضيلاتك</p>
          </div>
        </div>

        {offers.length === 0 ? (
          <Card className="text-center p-8">
            <CardContent>
              <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">لا توجد عروض حالياً</p>
              <p className="text-sm text-muted-foreground mt-2">
                استمر في الطلب لفتح عروض خاصة بك
              </p>
              <Button 
                onClick={() => setLocation("/menu")} 
                className="mt-4"
                data-testid="button-explore-menu"
              >
                استكشف القائمة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <Card 
                key={offer.id} 
                className="overflow-hidden border-0 shadow-lg"
                data-testid={`offer-card-${offer.id}`}
              >
                <div className={`bg-gradient-to-r ${getOfferColor(offer.type)} p-4`}>
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      {getOfferIcon(offer.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{offer.title}</h3>
                      {offer.expiresIn && (
                        <div className="flex items-center gap-1 text-xs text-white/80 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>ينتهي خلال {offer.expiresIn}</span>
                        </div>
                      )}
                    </div>
                    {offer.discount > 0 && (
                      <Badge className="bg-white text-foreground font-bold text-lg px-3 py-1">
                        {offer.type === 'loyalty' ? `${offer.discount} ر.س` : `${offer.discount}%`}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-foreground">{offer.description}</p>
                  {offer.coffeeItem && (
                    <div className="mt-3 flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                      {offer.coffeeItem.imageUrl && (
                        <img 
                          src={offer.coffeeItem.imageUrl} 
                          alt={offer.coffeeItem.nameAr}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{offer.coffeeItem.nameAr}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="line-through">{offer.coffeeItem.price} <SarIcon /></span>
                          <span className="text-primary font-bold mr-2">
                            {(offer.coffeeItem.price * (1 - offer.discount / 100)).toFixed(2)} <SarIcon />
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => handleUseOffer(offer)}
                    disabled={offer.discount === 0}
                    data-testid={`button-use-offer-${offer.id}`}
                  >
                    {offer.discount > 0 ? 'استخدم العرض' : 'استمر في جمع النقاط'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              كيف تحصل على المزيد من العروض؟
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• اطلب بانتظام لفتح عروض العملاء المميزين</p>
            <p>• اجمع النقاط واستبدلها بخصومات</p>
            <p>• ادعُ أصدقاءك واحصل على 50 نقطة لكل صديق</p>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}

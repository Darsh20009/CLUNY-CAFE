import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, CreditCard, University, Zap, Building, Banknote, Gift, Truck, Plus, Phone, Search, Coffee, Check, Clock } from "lucide-react";
import type { PaymentMethodInfo, PaymentMethod } from "@shared/schema";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useLoyaltyCard } from "@/hooks/useLoyaltyCard";

// Payment methods temporarily disabled — coming soon
const COMING_SOON_METHODS = ['neoleap', 'neoleap-apple-pay', 'card', 'credit_card'];

interface PaymentMethodsProps {
 paymentMethods: PaymentMethodInfo[];
 selectedMethod: PaymentMethod | null;
 onSelectMethod: (method: PaymentMethod) => void;
 customerPhone?: string;
 loyaltyCard?: any;
 comingSoon?: boolean;
}

export default function PaymentMethods({
 paymentMethods,
 selectedMethod,
 onSelectMethod,
 customerPhone: propCustomerPhone,
 loyaltyCard: initialLoyaltyCard,
 comingSoon = false,
}: PaymentMethodsProps) {
 const { toast } = useToast();
  const [cardMode, setCardMode] = useState<'use' | 'add' | null>(null);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchCardNumber, setSearchCardNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const { card: autoCard, updateCardInCache } = useLoyaltyCard(propCustomerPhone);
  
  const foundCard = autoCard || initialLoyaltyCard;

  useEffect(() => {
    if (foundCard && cardMode === null) {
      setCardMode('use');
    }
  }, [foundCard, cardMode]);

 const getIcon = (iconName: string) => {
  switch (iconName) {
  case 'fas fa-gift':
  return <Gift className="w-6 h-6 text-primary" />;
  case 'fas fa-money-bill-wave':
  return <Banknote className="w-6 h-6 text-primary" />;
  case 'fas fa-truck':
  return <Truck className="w-6 h-6 text-primary" />;
  case 'fas fa-mobile-alt':
  return <Smartphone className="w-6 h-6 text-primary" />;
  case 'fas fa-credit-card':
  return <CreditCard className="w-6 h-6 text-primary" />;
  case 'fas fa-university':
  return <University className="w-6 h-6 text-primary" />;
  case 'fas fa-bolt':
  return <Zap className="w-6 h-6 text-primary" />;
  case 'fas fa-building-columns':
  return <Building className="w-6 h-6 text-primary" />;
  default:
  return <CreditCard className="w-6 h-6 text-primary" />;
  }
 };

 const handleSearchCard = async () => {
  if (!searchPhone && !searchCardNumber) {
   toast({
    variant: "destructive",
    title: "خطأ",
    description: "يرجى إدخال رقم الجوال أو رقم البطاقة",
   });
   return;
  }

  setIsSearching(true);
  try {
   let url = "";
   if (searchPhone) {
    url = `/api/loyalty/cards/phone/${searchPhone}`;
   } else {
    url = `/api/loyalty/cards/number/${searchCardNumber}`;
   }

   const res = await fetch(url);
   if (!res.ok) throw new Error("البطاقة غير موجودة");
   const cardData = await res.json();
   updateCardInCache(cardData);
   setIsAddingCard(false);
   setCardMode('use');
   toast({
    title: "تم العثور على البطاقة",
    description: `أهلاً ${cardData.customerName || 'عميلنا العزيز'}`,
   });
  } catch (error) {
   toast({
    variant: "destructive",
    title: "خطأ",
    description: "لم يتم العثور على بطاقة مرتبطة بهذه البيانات",
   });
  } finally {
   setIsSearching(false);
  }
 };

 if (comingSoon) {
   return (
     <div className="space-y-4" data-testid="section-payment-methods">
       <h3 className="text-lg font-semibold text-foreground mb-4">اختر طريقة الدفع</h3>
       <div className="relative rounded-2xl overflow-hidden border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40">
         <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-white/70 dark:bg-black/60 backdrop-blur-sm">
           <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 shadow-md">
             <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
           </div>
           <div className="text-center space-y-1 px-4">
             <p className="font-bold text-amber-800 dark:text-amber-300 text-base">خيارات الدفع قريباً</p>
             <p className="text-xs text-amber-600/80 dark:text-amber-400/70">سيتم تفعيل طرق الدفع في إصدار قادم</p>
           </div>
           <span className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
             <Clock className="w-3.5 h-3.5" />
             قريباً
           </span>
         </div>
         <div className="opacity-20 pointer-events-none select-none space-y-3 p-4">
           {paymentMethods.slice(0, 3).map((method) => (
             <Card key={method.id} className="rounded-2xl border-border/30 bg-white/50">
               <CardContent className="p-4">
                 <div className="flex items-center gap-3">
                   <div className="p-2.5 rounded-xl bg-muted">
                     <CreditCard className="w-5 h-5 text-muted-foreground" />
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-sm text-foreground">{method.nameAr}</p>
                     <p className="text-xs text-muted-foreground mt-0.5">{method.details}</p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       </div>
     </div>
   );
 }

 return (
   <div className="space-y-4" data-testid="section-payment-methods">
     <h3 className="text-lg font-semibold text-foreground mb-4">اختر طريقة الدفع</h3>
     <div className="space-y-4">
     {paymentMethods.map((method) => {
    const isQahwaCard = (method.id as string) === 'qahwa-card';
    const isApplePay = (method.id as string) === 'apple_pay' || (method.id as string) === 'neoleap-apple-pay';
    // Treat Apple Pay as a standard option (not the special NeoLeap visual block)
    const isNeoLeap = ((method.id as string) === 'neoleap' || (method.id as string) === 'neoleap-apple-pay') && !isApplePay;
    const isLoyaltyCard = (method.id as string) === 'loyalty-card';
    const isSelected = selectedMethod === method.id;
    const isComingSoon = COMING_SOON_METHODS.includes(method.id as string);

    // Filter for POS: Only Cash, Network (pos), and Cluny Card (qahwa-card)
    const allowedPosMethods = ['cash', 'pos', 'qahwa-card'];
    const isPosRoute = window.location.pathname.includes('/employee/pos');
    if (isPosRoute && !allowedPosMethods.includes(method.id as string)) {
      return null;
    }

    if (isLoyaltyCard) return null; // Always hide loyalty card from customer checkout

    // Coming Soon: show disabled card with badge
    if (isComingSoon) {
      return (
        <div key={method.id} className="relative">
          <Card className="border-border/30 bg-muted/30 rounded-2xl overflow-hidden opacity-60 cursor-not-allowed select-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted text-muted-foreground">
                  {isApplePay
                    ? <Smartphone className="w-6 h-6" />
                    : <CreditCard className="w-6 h-6" />
                  }
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-muted-foreground">{method.nameAr}</h4>
                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                      <Clock className="w-3 h-3" />
                      قريباً
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isApplePay ? "سيتوفر Apple Pay قريباً" : "الدفع بالبطاقة سيكون متاحاً قريباً"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div key={method.id} className="relative group">
        {(isQahwaCard || isNeoLeap) && (
         <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/30 via-yellow-500/30 to-orange-500/30 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
        )}
        <Card
         className={`cursor-pointer transition-all duration-500 relative overflow-hidden rounded-2xl ${
          isApplePay
          ? isSelected
            ? 'bg-black border-2 border-white/30 text-white shadow-2xl scale-[1.02]'
            : 'bg-black border-0 text-white shadow-xl hover:scale-[1.01] hover:shadow-2xl'
          : (isQahwaCard || isNeoLeap)
          ? isSelected
           ? 'border-2 border-amber-400 shadow-2xl scale-[1.02] bg-white'
           : 'border-2 border-amber-200/50 hover:border-amber-400/80 shadow-lg hover:scale-[1.01] bg-white/80'
          : isSelected
           ? 'border-primary bg-primary/5 shadow-md'
           : 'border-border/50 hover:border-primary/30 hover:bg-primary/5 bg-white/50'
         }`}
         onClick={() => onSelectMethod(method.id)}
         data-testid={`payment-method-${method.id}`}
        >
         <CardContent className="p-0">
           {isApplePay ? (
             <div className="relative overflow-hidden">
               <div className="px-5 py-4 flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/20">
                   <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                     <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                   </svg>
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between gap-2">
                     <div>
                       <p className="text-white font-bold text-base leading-tight">Apple Pay</p>
                       <p className="text-white/60 text-xs mt-0.5">دفع سريع وآمن عبر Geidea</p>
                     </div>
                     {isSelected ? (
                       <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center animate-in zoom-in duration-300 flex-shrink-0">
                         <Check className="w-4 h-4 text-black" />
                       </div>
                     ) : (
                       <span className="text-white font-black text-xl tracking-tight opacity-80">Pay</span>
                     )}
                   </div>
                 </div>
               </div>
               {isSelected && (
                 <div className="px-5 pb-4">
                   <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                     <p className="text-white/80 text-xs">اضغط الزر أدناه لفتح بوابة الدفع الآمن عبر Apple Pay</p>
                   </div>
                 </div>
               )}
             </div>
           ) : (isQahwaCard || isNeoLeap) && isSelected ? (
             <div className="space-y-4">
               <div className="min-h-80 relative overflow-visible rounded-3xl shadow-2xl border border-white/10" 
                 style={{
                   background: isNeoLeap 
                    ? `linear-gradient(135deg, #1a1a1a 0%, #333333 50%, #000000 100%)`
                    : `linear-gradient(135deg, #B8860B 0%, #D4A017 25%, #C4880F 50%, #8B6914 75%, #5C3D2E 100%)`,
                 }}>
                 <div className="absolute inset-0 opacity-10">
                   <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-white" />
                   <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-white" />
                 </div>

                 <div className="relative flex flex-col justify-between text-white h-full py-8 px-8">
                   <div className="flex justify-between items-start flex-shrink-0">
                     <div className="space-y-1">
                       <p className="text-xs uppercase tracking-widest opacity-75">CLUNY CAFE</p>
                       <h4 className="text-2xl font-black">{isNeoLeap ? (method.id === 'neoleap-apple-pay' ? 'Apple Pay' : 'بطاقة بنكية') : 'بطاقة الولاء'}</h4>
                     </div>
                     <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
                       {isNeoLeap ? <CreditCard className="w-6 h-6 text-white" /> : <Coffee className="w-6 h-6 text-white" />}
                     </div>
                   </div>

                   {isNeoLeap ? (
                     <div className="flex flex-col items-center justify-center my-auto text-center space-y-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                          <Zap className="w-8 h-8 text-amber-400 animate-pulse" />
                        </div>
                        <p className="text-lg font-bold">{method.id === 'neoleap-apple-pay' ? 'دفع سريع عبر Apple Pay' : 'دفع آمن عبر NeoLeap'}</p>
                        <p className="text-sm opacity-80">مدى، فيزا، ماستر كارد</p>
                     </div>
                   ) : cardMode === null ? (
                     <div className="flex flex-col items-center justify-center my-auto">
                          <div className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-3 text-center w-full">
                            <p className="text-sm opacity-90">كيف تريد استخدام بطاقتك؟</p>
                            <div className="space-y-2">
                              <Button 
                                size="sm"
                                className="w-full bg-[#B58B5A] hover:bg-[#B58B5A]/90 text-white transition-all duration-300 shadow-lg border-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Logic for "Pay with Copy Card"
                                  onSelectMethod(method.id);
                                  toast({
                                    title: "تم اختيار الدفع بالبطاقة",
                                    description: "سيتم خصم قيمة الطلب من رصيد بطاقة كلوني كافيه الخاصة بك",
                                  });
                                }}
                              >
                                <Zap className="w-4 h-4 ml-2" />
                                ادفع ببطاقة كلوني كافيه (كوبي)
                              </Button>
                               {foundCard && (
                              <Button 
                                size="sm"
                                className="w-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur border-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCardMode('use');
                                }}
                              >
                                <Check className="w-4 h-4 ml-2" />
                                استخدام البطاقة المربوطة
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              className="w-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardMode('add');
                              }}
                            >
                              <Plus className="w-4 h-4 ml-2" />
                              إضافة بطاقة أخرى
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : cardMode === 'use' && foundCard ? (
                      <div className="space-y-3 flex-1 flex flex-col justify-center">
                        <div className="space-y-1">
                          <p className="text-xs opacity-75">رقم البطاقة</p>
                          <p className="text-lg font-mono tracking-widest font-bold">
                            {foundCard.cardNumber.replace(/(.{4})/g, '$1 ')}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">صاحب</p>
                            <p className="font-bold">{foundCard.customerName?.split(' ')[0] || 'عضو'}</p>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">مجاني</p>
                            <p className="font-bold text-base">{(foundCard.freeCupsEarned || 0) - (foundCard.freeCupsRedeemed || 0)}</p>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">خصم</p>
                            <p className="font-bold text-base">{foundCard.discountPercentage || 0}%</p>
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-2 backdrop-blur text-center mt-2">
                          <p className="text-xs opacity-70">رصيد المشروبات</p>
                          <p className="font-bold text-base">{(foundCard.freeCupsEarned || 0) - (foundCard.freeCupsRedeemed || 0)} مشروب مجاني</p>
                        </div>
                        <Button 
                          size="sm"
                          className="w-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur border-0 mt-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardMode(null);
                          }}
                        >
                          <Plus className="w-4 h-4 ml-2" />
                          تغيير البطاقة
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {cardMode === 'add' && (
                  <div className="p-6 bg-white border-t border-amber-100 animate-in slide-in-from-top-4 duration-300" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-4">
                      <h4 className="font-bold text-amber-900 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        البحث عن بطاقتك
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-amber-800">رقم الجوال</Label>
                          <div className="relative">
                            <Phone className="absolute right-3 top-2.5 w-4 h-4 text-amber-400" />
                            <Input 
                              placeholder="5XXXXXXXX" 
                              className="pr-9 border-amber-100 focus:ring-amber-400"
                              value={searchPhone}
                              onChange={(e) => setSearchPhone(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-amber-800">رقم البطاقة</Label>
                          <div className="relative">
                            <CreditCard className="absolute right-3 top-2.5 w-4 h-4 text-amber-400" />
                            <Input 
                              placeholder="رقم البطاقة" 
                              className="pr-9 border-amber-100 focus:ring-amber-400"
                              value={searchCardNumber}
                              onChange={(e) => setSearchCardNumber(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={handleSearchCard}
                          disabled={isSearching}
                        >
                          {isSearching ? "جاري البحث..." : "تأكيد الإضافة"}
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="text-amber-700 hover:bg-amber-50"
                          onClick={() => setCardMode(null)}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-all duration-300 ${
                    isQahwaCard 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg group-hover:scale-110' 
                      : 'bg-muted text-primary'
                  }`}>
                    {getIcon(method.icon)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-bold transition-colors ${
                        isQahwaCard 
                          ? 'font-amiri text-xl text-amber-900' 
                          : 'text-foreground group-hover:text-primary'
                      }`}>
                        {isApplePay ? 'التوجه للدفع عبر Apple Pay' : method.nameAr}
                      </h4>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in duration-300">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm mt-0.5 line-clamp-1 text-[#222429]">
                      {method.details}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
         </Card>
       </div>
    );
     })}
     </div>
   </div>
 );
}

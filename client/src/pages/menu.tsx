import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PWAInstallButton } from "@/components/pwa-install";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLocation } from "wouter";
import { 
  Coffee, 
  ShoppingCart, 
  Flame, 
  Snowflake, 
  Star, 
  Cake, 
  User, 
  Plus, 
  Search, 
  QrCode, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  Utensils, 
  Sparkles,
  Tag,
  Gift,
  Languages,
  X,
  ClipboardList,
  ChefHat,
  Package,
  Bell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import banner1 from "@assets/banner-coffee-1.png";
import banner2 from "@assets/banner-coffee-2.png";
import clunyLogo from "@assets/cluny-logo-customer.png";
import type { CoffeeItem, IProductAddon, IPromoOffer } from "@shared/schema";
import { AddToCartModal } from "@/components/add-to-cart-modal";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ClassicMenuLayout, CardsMenuLayout, ListMenuLayout } from "@/components/menu-layouts";
import SarIcon from "@/components/sar-icon";
import { customerStorage } from "@/lib/customer-storage";

interface MenuCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  department?: 'drinks' | 'food';
  orderIndex: number;
  isSystem?: boolean;
}

export default function MenuPage() {
  const { cartItems, addToCart, showCart } = useCartStore();
  const { isAuthenticated, customer } = useCustomer();
  const queryClient = useQueryClient();

  const customerPhone = (customer as any)?.phone || (customer as any)?.phoneNumber;

  const { data: favData } = useQuery<{ favorites: string[] }>({
    queryKey: ['/api/customers/favorites', customerPhone],
    enabled: !!(isAuthenticated && customerPhone),
    queryFn: () => fetch('/api/customers/favorites?phone=' + encodeURIComponent(customerPhone || '')).then(r => r.json()),
  });
  const favoriteIds = new Set<string>(favData?.favorites || []);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const isFav = favoriteIds.has(itemId);
      if (isFav) {
        return fetch('/api/customers/favorites/' + itemId + '?phone=' + encodeURIComponent(customerPhone || ''), { method: 'DELETE' }).then(r => r.json());
      } else {
        return fetch('/api/customers/favorites/' + itemId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: customerPhone }) }).then(r => r.json());
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/customers/favorites', customerPhone] }),
  });

  const handleToggleFavorite = (itemId: string) => {
    if (!isAuthenticated || !customerPhone) {
      toast({ title: 'يجب تسجيل الدخول لإضافة المفضلة', variant: 'destructive' });
      return;
    }
    toggleFavoriteMutation.mutate(itemId);
  };
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<CoffeeItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Active order banner state
  const [dismissedActiveOrderId, setDismissedActiveOrderId] = useState<string | null>(() =>
    sessionStorage.getItem("menu-dismissed-active-order")
  );
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  const { data: customBanners = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-banners"],
  });

  const isStoreOpen = () => {
    if (!businessConfig) return true;
    if (businessConfig.isEmergencyClosed) return false;

    const storeHours = businessConfig.storeHours || {};
    const isAlwaysOpenGlobal = Object.values(storeHours).every((h: any) => h?.isAlwaysOpen || (h?.open === "00:00" && h?.close === "23:59"));
    
    if (isAlwaysOpenGlobal) return true;

    const now = new Date();
    // Saudi Time is UTC+3
    const riyadhTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long'
    }).formatToParts(now);

    const currentDay = riyadhTime.find(p => p.type === 'weekday')?.value.toLowerCase() || 'monday';
    const currentHour = parseInt(riyadhTime.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(riyadhTime.find(p => p.type === 'minute')?.value || '0');
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const hours = businessConfig.storeHours?.[currentDay];

    if (!hours || !hours.isOpen) return false;
    if (hours.isAlwaysOpen || (hours.open === '00:00' && hours.close === '23:59')) return true;

    const [openH, openM] = (hours.open || '06:00').split(':').map(Number);
    const [closeH, closeM] = (hours.close || '03:00').split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;

    // Handle overnight hours (e.g., 6 AM to 3 AM next day)
    if (closeMinutes <= openMinutes) {
      if (currentTimeInMinutes >= openMinutes || currentTimeInMinutes <= closeMinutes) return true;
    } else {
      if (currentTimeInMinutes >= openMinutes && currentTimeInMinutes <= closeMinutes) return true;
    }

    return false;
  };

  const getStatusMessage = () => {
    if (!businessConfig) return null;
    if (businessConfig.isEmergencyClosed) return "نعتذر، الكافيه مغلق حالياً لظروف طارئة";
    
    const isOpen = isStoreOpen();
    if (isOpen) return null;

    const nextOpening = businessConfig.currentStatus?.nextOpeningTime;
    if (nextOpening) {
      const { hours, minutes } = nextOpening;
      let timeStr = "";
      if (hours > 0) timeStr += `${hours} ساعة `;
      if (minutes > 0) timeStr += `${minutes} دقيقة`;
      return `الكافيه مغلق حالياً، يفتح بعد ${timeStr}`;
    }

    return "الكافيه مغلق حالياً";
  };

  const { data: coffeeItems = [], isLoading } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const { data: allAddons = [] } = useQuery<IProductAddon[]>({
    queryKey: ["/api/product-addons"],
  });

  const { data: itemsWithAddons = [] } = useQuery<string[]>({
    queryKey: ["/api/coffee-items-with-addons"],
  });

  const { data: promoOffers = [] } = useQuery<IPromoOffer[]>({
    queryKey: ["/api/promo-offers"],
  });

  const { data: dynamicCategories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-categories"],
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  // Active orders query – only when authenticated
  const { data: serverActiveOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/customer", customerPhone],
    enabled: !!(isAuthenticated && customerPhone),
    refetchInterval: 30000,
    staleTime: 20000,
    queryFn: async () => {
      const res = await fetch(`/api/orders/customer/${encodeURIComponent(customerPhone || "")}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Pick the most recent active order (server or localStorage)
  const activeOrder = useMemo(() => {
    const ACTIVE_STATUSES = new Set(["pending", "payment_confirmed", "in_progress", "ready"]);
    // Server orders (auth users)
    const fromServer = serverActiveOrders
      .filter((o: any) => ACTIVE_STATUSES.has(o.status))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (fromServer) return fromServer;

    // Fallback: local guest orders placed within last 3 hours
    const localOrders = customerStorage.getOrders();
    const cutoff = Date.now() - 3 * 60 * 60 * 1000;
    const fromLocal = localOrders
      .filter((o: any) => new Date(o.createdAt).getTime() > cutoff)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return fromLocal || null;
  }, [serverActiveOrders]);

  const showActiveBanner = !!(activeOrder && activeOrder.orderNumber !== dismissedActiveOrderId);

  const dismissActiveBanner = () => {
    if (activeOrder) {
      sessionStorage.setItem("menu-dismissed-active-order", activeOrder.orderNumber);
      setDismissedActiveOrderId(activeOrder.orderNumber);
    }
    setShowOrderDetail(false);
  };

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "قيد الانتظار",
      payment_confirmed: "تم تأكيد الدفع",
      in_progress: "جاري التحضير ☕",
      ready: "جاهز للاستلام 🎉",
    };
    return labels[status] || status;
  };

  const getOrderStatusIcon = (status: string) => {
    if (status === "in_progress") return ChefHat;
    if (status === "ready") return Package;
    if (status === "payment_confirmed") return ClipboardList;
    return Clock;
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const isBothModes = false; // Unified categories — no food/drink tab separation

  // Construct dynamic banners
  const bannerSlides = (() => {
    const slides: any[] = [];

    // 1. Add custom admin banners first
    if (customBanners.length > 0) {
      customBanners.forEach((banner: any) => {
        slides.push({
          image: banner.imageUrl,
          title: i18n.language === 'ar' ? banner.titleAr : (banner.titleEn || banner.titleAr),
          subtitle: i18n.language === 'ar' ? banner.subtitleAr : (banner.subtitleEn || banner.subtitleAr),
          badge: i18n.language === 'ar' ? banner.badgeAr : (banner.badgeEn || banner.badgeAr),
          linkType: banner.linkType,
          linkId: banner.linkId,
          externalUrl: banner.externalUrl,
          couponCode: banner.couponCode,
          couponImageUrl: banner.couponImageUrl
        });
      });
    }

    // 2. Add fixed banner slides
    slides.push({
      image: banner1,
      badge: t("menu.banner.default1.badge"),
      title: t("menu.banner.default1.title"),
      subtitle: t("menu.banner.default1.subtitle"),
      linkType: "offer",
      couponCode: undefined,
      couponImageUrl: undefined
    });
    slides.push({
      image: banner2,
      badge: t("menu.banner.default2.badge"),
      title: t("menu.banner.default2.title"),
      subtitle: t("menu.banner.default2.subtitle"),
      linkType: "offer",
      couponCode: undefined,
      couponImageUrl: undefined
    });

    // 3. Add dynamic "Smart" slides based on inventory/products
    if (coffeeItems.length > 0) {
      // Find cheapest drink
      const sortedByPrice = [...coffeeItems].sort((a, b) => {
        const priceA = typeof a.price === 'number' ? a.price : parseFloat(String(a.price));
        const priceB = typeof b.price === 'number' ? b.price : parseFloat(String(b.price));
        return priceA - priceB;
      });
      const cheapest = sortedByPrice[0];
      const cheapestName = i18n.language === 'ar' ? cheapest?.nameAr : (cheapest?.nameEn || cheapest?.nameAr);
      if (cheapest) {
        slides.push({
          image: cheapest.imageUrl || banner1,
          title: t("menu.banner.smart.cheapest_title", { name: cheapestName }),
          subtitle: t("menu.banner.smart.cheapest_subtitle"),
          badge: t("menu.banner.smart.cheapest_badge"),
          linkType: 'product',
          linkId: (cheapest as any).id,
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        });
      }

      const newest = [...coffeeItems].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
      const newestName = i18n.language === 'ar' ? newest?.nameAr : (newest?.nameEn || newest?.nameAr);
      if (newest && (newest as any).id !== (cheapest as any).id) {
        slides.push({
          image: newest.imageUrl || banner2,
          title: t("menu.banner.smart.newest_title"),
          subtitle: t("menu.banner.smart.newest_subtitle", { name: newestName }),
          badge: t("menu.banner.smart.newest_badge"),
          linkType: 'product',
          linkId: (newest as any).id,
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        });
      }
    }

    // 4. Fallback to default slides if nothing else
    if (slides.length === 0) {
      slides.push(
        {
          image: banner1,
          title: t("banner.1.title"),
          subtitle: t("banner.1.subtitle"),
          badge: t("banner.1.badge"),
          linkType: 'product',
          linkId: "matcha-latte",
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        },
        {
          image: banner2,
          title: t("banner.2.title"),
          subtitle: t("banner.2.subtitle"),
          badge: t("banner.2.badge"),
          linkType: 'product',
          linkId: "vanilla-latte",
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        }
      );
    }

    return slides;
  })();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % bannerSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [bannerSlides.length]);

  const iconMap: Record<string, any> = {
    Coffee, Flame, Snowflake, Star, Cake, Utensils, Sparkles
  };

  const systemCategories = [
    { id: "all",        name: t("menu.categories.all"),       icon: Coffee,    isSystem: true },
    { id: "hot",        name: t("menu.categories.hot"),       icon: Flame,     isSystem: true },
    { id: "cold",       name: t("menu.categories.cold"),      icon: Snowflake, isSystem: true },
    { id: "desserts",   name: t("menu.categories.desserts"),  icon: Cake,      isSystem: true },
    { id: "bakery",     name: t("menu.categories.bakery"),    icon: Cake,      isSystem: true },
    { id: "sandwiches", name: t("menu.categories.sandwiches"),icon: Utensils,  isSystem: true },
  ];

  const customCategories = dynamicCategories
    .filter(c => !c.isSystem)
    .map(c => ({
      id: c.id,
      name: i18n.language === 'ar' ? c.nameAr : (c.nameEn || c.nameAr),
      icon: iconMap[c.icon || 'Coffee'] || Coffee,
      isSystem: false
    }));

  const categories = [...systemCategories, ...customCategories];

  const bestSellers = useMemo(() => coffeeItems
    .filter(item => (item as any).isBestSeller || (item as any).salesCount > 10 || item.category === 'food' || item.category === 'bakery')
    .sort((a, b) => {
      const aIsFood = a.category === 'food' || a.category === 'bakery';
      const bIsFood = b.category === 'food' || b.category === 'bakery';
      if (aIsFood && !bIsFood) return -1;
      if (!aIsFood && bIsFood) return 1;
      return ((b as any).salesCount || 0) - ((a as any).salesCount || 0);
    })
    .slice(0, 8), [coffeeItems]);

  const getGroupingKey = useCallback((item: CoffeeItem): string => {
    if ((item as any).groupId) return `${item.category}::${(item as any).groupId}`;
    const nameAr = item.nameAr || "";
    if (!nameAr || typeof nameAr !== 'string') return `${item.category}::unknown`;
    const cleaned = nameAr.trim().replace(/^[\u064B-\u0652]+/, '');
    const firstWord = cleaned.split(/\s+/)[0] || 'unknown';
    return `${item.category}::${firstWord}`;
  }, []);

  const groupedItems = useMemo(() => coffeeItems.reduce((acc: Record<string, CoffeeItem[]>, item) => {
    const groupKey = getGroupingKey(item);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {}), [coffeeItems, getGroupingKey]);

  const representativeItems = useMemo(() =>
    Object.values(groupedItems).map(group => group[0]),
  [groupedItems]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeNum = currentHour * 100 + currentMinute;
    const currentDay = now.getDay();
    const searchLower = searchQuery.toLowerCase();

    return representativeItems.filter(item => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const name = i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr;
      const matchesSearch = name.toLowerCase().includes(searchLower);

      const anyItem = item as any;
      if (anyItem.availableFrom || anyItem.availableTo || (anyItem.availableDays && anyItem.availableDays.length > 0)) {
        if (anyItem.availableDays && anyItem.availableDays.length > 0 && !anyItem.availableDays.includes(currentDay)) return false;
        if (anyItem.availableFrom) {
          const [fh, fm] = (anyItem.availableFrom as string).split(':').map(Number);
          if (currentTimeNum < fh * 100 + fm) return false;
        }
        if (anyItem.availableTo) {
          const [th, tm] = (anyItem.availableTo as string).split(':').map(Number);
          if (currentTimeNum > th * 100 + tm) return false;
        }
      }
      return matchesCategory && matchesSearch;
    });
  }, [representativeItems, selectedCategory, searchQuery, i18n.language]);

  const sortedFilteredItems = useMemo(() => [...filteredItems].sort((a, b) => {
    if (selectedCategory !== "all") return 0;
    const categoryOrder = ['hot', 'cold', 'desserts', 'bakery', 'sandwiches'];
    const aIdx = categoryOrder.indexOf(a.category);
    const bIdx = categoryOrder.indexOf(b.category);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  }), [filteredItems, selectedCategory]);

  const handleAddToCartDirect = (item: CoffeeItem) => {
    if (!isStoreOpen()) {
      toast({
        title: "المتجر مغلق",
        description: "نعتذر، لا يمكن إضافة الطلبات حالياً بسبب إغلاق المتجر.",
        variant: "destructive"
      });
      return;
    }
    const isAvailable = item.isAvailable !== 0 && (item.availabilityStatus === 'available' || item.availabilityStatus === 'new' || !item.availabilityStatus);
    if (!isAvailable) {
      toast({
        title: "غير متوفر",
        description: "نعتذر، هذا المنتج غير متوفر حالياً",
        variant: "destructive"
      });
      return;
    }

    const name = i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr;
    const groupKey = getGroupingKey(item);
    const group = groupedItems[groupKey] || [item];
    const hasMultipleVariants = group.length > 1;
    const hasSizes = item.availableSizes && item.availableSizes.length > 0;
    const hasAddons = itemsWithAddons.includes((item as any).id);

    if (hasMultipleVariants || hasSizes || hasAddons) {
      setSelectedItem(item);
      setIsModalOpen(true);
    } else {
      addToCart((item as any).id, 1, "default", []);
      toast({
        title: t("menu.added_to_cart"),
        description: t("menu.added_to_cart_desc", { name }),
      });
    }
  };

  const nextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % bannerSlides.length);
  };

  const prevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + bannerSlides.length) % bannerSlides.length);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    // document.documentElement updates are now handled globally in App.tsx
  };

  if (isLoading) {
    return (
      <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Coffee className="w-10 h-10 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="fixed top-0 inset-x-0 z-[60] h-16 bg-primary/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 p-1.5 flex items-center justify-center">
            <img src={clunyLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-black text-white leading-tight">CLUNY</h1>
            <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">CAFE</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/profile")}
              className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              title={t("menu.loyalty_card") || "بطاقتي"}
            >
              <QrCode className="w-4 h-4" />
            </Button>
          )}

          {isAuthenticated && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/my-offers")}
              className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              title={t("menu.discover_offers")}
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
          >
            <Languages className="w-4 h-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              const storedCustomer = localStorage.getItem("qahwa-customer") || localStorage.getItem("currentCustomer");
              if (isAuthenticated || customer || storedCustomer) {
                setLocation("/profile");
              } else {
                setLocation("/auth");
              }
            }} 
            className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
          >
            <User className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Active Order Banner – fixed strip below header */}
      <AnimatePresence>
        {showActiveBanner && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="fixed top-16 inset-x-0 z-50"
            dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
          >
            <div
              className={`mx-3 mt-2 rounded-2xl shadow-2xl border overflow-hidden flex items-center gap-3 px-4 py-3 ${
                activeOrder?.status === 'ready'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-500 border-green-400/30'
                  : activeOrder?.status === 'in_progress'
                  ? 'bg-gradient-to-r from-blue-700 to-blue-500 border-blue-400/30'
                  : 'bg-gradient-to-r from-amber-600 to-orange-500 border-amber-400/30'
              }`}
            >
              {/* Clickable info area */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowOrderDetail(true)}
                onKeyDown={e => e.key === 'Enter' && setShowOrderDetail(true)}
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                data-testid="button-active-order-banner"
              >
                {(() => {
                  const Icon = getOrderStatusIcon(activeOrder?.status || 'pending');
                  return (
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                    {i18n.language === 'ar' ? 'لديك طلب قائم' : 'Active Order'}
                  </p>
                  <p className="text-sm font-black text-white truncate">
                    {activeOrder?.orderNumber} &mdash; {getOrderStatusLabel(activeOrder?.status || 'pending')}
                  </p>
                </div>
                <span className="text-xs font-bold text-white/80 bg-white/20 rounded-lg px-2 py-1 flex-shrink-0">
                  {i18n.language === 'ar' ? 'عرض' : 'View'}
                </span>
              </div>
              {/* Dismiss button – separate from info area */}
              <button
                onClick={dismissActiveBanner}
                className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition flex-shrink-0"
                data-testid="button-dismiss-active-order"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Detail Bottom Sheet */}
      <AnimatePresence>
        {showOrderDetail && activeOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end"
            dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
            onClick={() => setShowOrderDetail(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="w-full bg-card rounded-t-3xl shadow-2xl p-6 space-y-5 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mb-2" />

              {/* Status badge */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  activeOrder.status === 'ready' ? 'bg-green-100 dark:bg-green-900/30' :
                  activeOrder.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  'bg-amber-100 dark:bg-amber-900/30'
                }`}>
                  {(() => {
                    const Icon = getOrderStatusIcon(activeOrder.status);
                    return <Icon className={`w-6 h-6 ${
                      activeOrder.status === 'ready' ? 'text-green-600' :
                      activeOrder.status === 'in_progress' ? 'text-blue-600' :
                      'text-amber-600'
                    }`} />;
                  })()}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {i18n.language === 'ar' ? 'حالة الطلب' : 'Order Status'}
                  </p>
                  <p className="text-lg font-black text-foreground">
                    {getOrderStatusLabel(activeOrder.status)}
                  </p>
                </div>
              </div>

              {/* Order number */}
              <div className="bg-muted/50 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    {i18n.language === 'ar' ? 'رقم الفاتورة' : 'Order Number'}
                  </p>
                  <p className="text-xl font-black text-foreground tracking-wider">{activeOrder.orderNumber}</p>
                </div>
                <Bell className={`w-7 h-7 ${
                  activeOrder.status === 'ready' ? 'text-green-500 animate-bounce' :
                  activeOrder.status === 'in_progress' ? 'text-blue-400 animate-pulse' :
                  'text-amber-400 animate-pulse'
                }`} />
              </div>

              {/* Progress steps */}
              <div className="space-y-2">
                {[
                  { id: 'pending', label: i18n.language === 'ar' ? 'تم إرسال الطلب' : 'Order Sent', icon: Clock },
                  { id: 'payment_confirmed', label: i18n.language === 'ar' ? 'تأكيد الدفع' : 'Payment Confirmed', icon: ClipboardList },
                  { id: 'in_progress', label: i18n.language === 'ar' ? 'جاري التحضير' : 'Preparing', icon: ChefHat },
                  { id: 'ready', label: i18n.language === 'ar' ? 'جاهز للاستلام' : 'Ready', icon: Package },
                ].map((step, idx, arr) => {
                  const ORDER_INDICES: Record<string, number> = { pending: 0, payment_confirmed: 1, in_progress: 2, ready: 3 };
                  const currentIdx = ORDER_INDICES[activeOrder.status] ?? 0;
                  const stepIdx = ORDER_INDICES[step.id] ?? idx;
                  const isDone = stepIdx <= currentIdx;
                  const isActive = stepIdx === currentIdx;
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        isDone
                          ? isActive
                            ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                            : 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className={`text-sm font-semibold ${isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      {isActive && (
                        <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full animate-pulse">
                          {i18n.language === 'ar' ? 'الآن' : 'Now'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Items summary */}
              {activeOrder.items && activeOrder.items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {i18n.language === 'ar' ? 'الطلبات' : 'Items'}
                  </p>
                  {activeOrder.items.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm text-foreground">
                      <span>{item.nameAr || item.coffeeItem?.nameAr || item.name || '—'}</span>
                      <span className="text-muted-foreground">× {item.quantity}</span>
                    </div>
                  ))}
                  {activeOrder.items.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{activeOrder.items.length - 3} {i18n.language === 'ar' ? 'أصناف أخرى' : 'more items'}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Button
                  onClick={() => { setShowOrderDetail(false); setLocation("/my-orders"); }}
                  className="flex-1 rounded-2xl h-12 font-bold"
                  data-testid="button-view-my-orders"
                >
                  <ClipboardList className="w-4 h-4 me-2" />
                  {i18n.language === 'ar' ? 'جميع طلباتي' : 'My Orders'}
                </Button>
                <Button
                  variant="outline"
                  onClick={dismissActiveBanner}
                  className="flex-1 rounded-2xl h-12 font-bold border-2"
                  data-testid="button-start-new-order"
                >
                  <X className="w-4 h-4 me-2" />
                  {i18n.language === 'ar' ? 'طلب جديد' : 'New Order'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`${showActiveBanner ? 'pt-28' : 'pt-16'} space-y-6 pb-24 relative z-0 transition-all duration-300`}>
        <div ref={bannerRef} className={`w-full ${showActiveBanner ? '-mt-28' : '-mt-16'}`}>
          <div className="relative h-[320px] sm:h-[400px] overflow-hidden shadow-lg border-b border-border/50">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentBannerIndex}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0"
              >
                  <div className="relative h-full w-full">
                    <img 
                      src={bannerSlides[currentBannerIndex].couponImageUrl || bannerSlides[currentBannerIndex].image} 
                      alt={bannerSlides[currentBannerIndex].title}
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {bannerSlides[currentBannerIndex].couponCode && (
                      <div className="absolute top-4 right-4 z-20">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.1 }}
                          onClick={() => {
                            navigator.clipboard.writeText(bannerSlides[currentBannerIndex].couponCode!);
                            toast({ title: t("checkout.coupon_copied") || "تم نسخ الكود", description: bannerSlides[currentBannerIndex].couponCode });
                          }}
                          className="bg-primary/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl border-2 border-white/30 shadow-2xl flex items-center gap-2 cursor-pointer group transition-all"
                        >
                          <Tag className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                          <span className="text-sm font-black tracking-widest uppercase">{bannerSlides[currentBannerIndex].couponCode}</span>
                        </motion.div>
                      </div>
                    )}

                    <div className={`absolute bottom-0 inset-x-0 p-8 text-white flex flex-col items-start gap-4`}>
                      <div className="space-y-1">
                        <Badge className="bg-accent/90 text-white border-0 px-3 py-1 font-bold text-[10px] uppercase tracking-wider animate-pulse">
                          {bannerSlides[currentBannerIndex].badge}
                        </Badge>
                        <h2 className="text-2xl sm:text-4xl font-black tracking-tight drop-shadow-2xl">
                          {bannerSlides[currentBannerIndex].title}
                        </h2>
                        <p className="text-sm sm:text-lg text-white/90 font-medium max-w-md line-clamp-2 drop-shadow-xl">
                          {bannerSlides[currentBannerIndex].subtitle}
                        </p>
                      </div>
                      
                      <Button
                        disabled={!isStoreOpen()}
                        onClick={() => {
                          const slide = bannerSlides[currentBannerIndex];
                          if (slide.linkType === 'product' && slide.linkId) {
                            const product = coffeeItems.find(p => p.id === slide.linkId);
                            if (product) {
                              setSelectedItem(product);
                              setIsModalOpen(true);
                            }
                          } else if (slide.linkType === 'category' && slide.linkId) {
                            setSelectedCategory(slide.linkId);
                          } else if (slide.linkType === 'offer') {
                            setLocation("/my-offers");
                          } else if (slide.linkType === 'external' && slide.externalUrl) {
                            window.open(slide.externalUrl, '_blank');
                          }
                        }}
                        className="bg-white hover:bg-white/90 text-primary rounded-2xl px-8 h-12 text-base font-black shadow-2xl flex items-center gap-3 transition-all active:scale-95 group overflow-visible"
                      >
                        <span>{t("menu.add_to_cart")}</span>
                        <ChevronLeft className={`w-5 h-5 transition-transform ${i18n.language === 'ar' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1 rotate-180'}`} />
                      </Button>
                    </div>
                  </div>
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-6 right-6 flex gap-1.5 z-30">
              {bannerSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBannerIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentBannerIndex ? "w-8 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 space-y-6">

          <div className="flex items-center gap-4 bg-secondary/50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{t("location.riyadh")}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            {!isStoreOpen() ? (
              <div className="flex items-center gap-2 text-red-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-bold">{i18n.language === 'ar' ? "المتجر مغلق حالياً" : "Store Closed"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">{t("status.open")}</span>
              </div>
            )}
          </div>

          {isAuthenticated && (
            <button
              onClick={() => setLocation("/my-offers")}
              className="w-full flex items-center justify-between bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-4 border border-primary/20 group hover:border-primary/40 transition-all"
              data-testid="button-my-offers-banner"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className={i18n.language === 'ar' ? 'text-right' : 'text-left'}>
                  <p className="font-bold text-foreground">{t("menu.discover_offers")}</p>
                  <p className="text-xs text-muted-foreground">{t("menu.personalized_offers")}</p>
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-primary group-hover:translate-x-[-4px] transition-transform" />
            </button>
          )}

          {promoOffers.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-bold text-foreground">{t("menu.offers")}</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-2">
                {promoOffers.map((offer) => (
                  <motion.div 
                    key={offer.id} 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-shrink-0 w-[200px] snap-start bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border-2 border-accent/30 p-3 space-y-3 shadow-sm cursor-pointer group relative overflow-hidden"
                    data-testid={`card-offer-${offer.id}`}
                  >
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-accent text-white border-0 px-2 py-0.5 text-[10px]">
                        <Tag className="w-3 h-3 ml-1" />
                        {t("menu.offer_badge")}
                      </Badge>
                    </div>
                    {offer.imageUrl && (
                      <div className="aspect-video rounded-xl overflow-hidden bg-secondary">
                        <img 
                          src={offer.imageUrl} 
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          alt={i18n.language === 'ar' ? offer.nameAr : offer.nameEn || offer.nameAr} 
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-semibold text-foreground">{i18n.language === 'ar' ? offer.nameAr : offer.nameEn || offer.nameAr}</h3>
                      {offer.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-accent font-bold">{offer.offerPrice} <small className="text-xs font-normal"><SarIcon /></small></span>
                        <span className="text-xs text-muted-foreground line-through">{offer.originalPrice} <SarIcon /></span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <div className="relative group">
            <Search className={`absolute ${i18n.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors`} />
            <input 
              type="text"
              placeholder={t("menu.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-12 ${i18n.language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm`}
              data-testid="input-search"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCategory(cat.id);
                }}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedCategory === cat.id 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-card text-foreground border-border hover:border-primary/30 hover:bg-secondary/50"
                }`}
                data-testid={`button-category-${cat.id}`}
              >
                <cat.icon className={`w-4 h-4 ${selectedCategory === cat.id ? "text-primary-foreground" : "text-primary"}`} />
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{t("menu.featured")}</h2>
              <Button variant="ghost" size="sm" className="text-primary text-sm">
                {t("menu.view_all")}
              </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-2">
              {representativeItems.slice(0, 6).map((item) => (
                <motion.div 
                  key={item.id} 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-shrink-0 w-[140px] snap-start bg-card rounded-2xl border border-border p-3 space-y-3 shadow-sm cursor-pointer group"
                  onClick={() => handleAddToCartDirect(item)}
                  data-testid={`card-featured-${item.id}`}
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-secondary">
                    <img 
                      src={item.imageUrl} 
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      alt={i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-coffee.png";
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold truncate text-foreground">{i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-bold">{item.price} <small className="text-xs font-normal text-muted-foreground"><SarIcon /></small></span>
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                        <Plus className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              {t("menu.all_items")}
            </h2>
            {businessConfig?.menuLayout === 'cards' ? (
              <CardsMenuLayout
                items={sortedFilteredItems as any}
                onAddItem={handleAddToCartDirect as any}
                lang={i18n.language}
                currency=<SarIcon />
                favoriteIds={favoriteIds}
                onToggleFavorite={isAuthenticated ? handleToggleFavorite : undefined}
              />
            ) : businessConfig?.menuLayout === 'list' ? (
              <ListMenuLayout
                items={sortedFilteredItems as any}
                onAddItem={handleAddToCartDirect as any}
                lang={i18n.language}
                currency=<SarIcon />
                favoriteIds={favoriteIds}
                onToggleFavorite={isAuthenticated ? handleToggleFavorite : undefined}
              />
            ) : (
              <ClassicMenuLayout
                items={sortedFilteredItems as any}
                onAddItem={handleAddToCartDirect as any}
                lang={i18n.language}
                currency=<SarIcon />
                favoriteIds={favoriteIds}
                onToggleFavorite={isAuthenticated ? handleToggleFavorite : undefined}
              />
            )}
          </section>
        </div>
      </main>

      <AddToCartModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        variants={selectedItem ? (groupedItems[getGroupingKey(selectedItem)] || [selectedItem]) : []}
        onAddToCart={(data) => {
          addToCart(data.coffeeItemId, data.quantity, data.selectedSize, data.selectedAddons, data.selectedItemAddons);
          setIsModalOpen(false);
          toast({ 
            title: t("menu.added_to_cart"), 
            description: t("menu.added_to_cart_desc", { name: i18n.language === 'ar' ? selectedItem?.nameAr : selectedItem?.nameEn || selectedItem?.nameAr }),
            className: "bg-card border-primary/20 text-foreground font-medium"
          });
        }}
      />

      {totalItems > 0 && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 inset-x-4 z-50"
        >
          <Button 
            onClick={() => showCart()}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-lg flex items-center justify-between px-5"
            data-testid="button-view-cart"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-right">
                <p className="text-xs font-medium opacity-80">{t("menu.view_cart")}</p>
                <p className="text-sm font-bold">{t("menu.items_count", { count: totalItems })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {cartItems.reduce((sum, i) => {
                  let itemPrice = 0;
                  const basePrice = i.coffeeItem?.price || 0;

                  // Use size price if available
                  if (i.selectedSize && i.coffeeItem?.availableSizes) {
                    const size = i.coffeeItem.availableSizes.find(s => s.nameAr === i.selectedSize);
                    itemPrice = size ? size.price : basePrice;
                  } else {
                    itemPrice = basePrice;
                  }

                  // Handle price formats
                  let price = 0;
                  if (typeof itemPrice === 'number') {
                    price = itemPrice;
                  } else if (typeof itemPrice === 'string') {
                    price = parseFloat(itemPrice);
                  } else if (itemPrice && typeof itemPrice === 'object' && '$numberDecimal' in (itemPrice as any)) {
                    price = parseFloat((itemPrice as any).$numberDecimal);
                  } else {
                    price = parseFloat(String(itemPrice));
                  }
                  
                  return sum + (isNaN(price) ? 0 : price * i.quantity);
                }, 0).toFixed(2)} <SarIcon />
              </span>
            </div>
          </Button>
        </motion.div>
      )}

      <footer className="text-center py-5 text-xs text-muted-foreground/50">
        made by{" "}
        <a
          href="https://qiroxstudio.online"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/70 hover:text-primary transition-colors underline underline-offset-2"
          data-testid="link-qirox-studio"
        >
          Qirox Studio
        </a>{" "}
        group
      </footer>

    </div>
  );
}

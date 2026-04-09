import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, User, CreditCard, ClipboardList, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

import { CustomerFooter } from "@/components/customer-footer";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";

interface CustomerLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  showHeader?: boolean;
  title?: string;
}

export function CustomerLayout({ 
  children, 
  showNav = true, 
  showHeader = false,
  title 
}: CustomerLayoutProps) {
  const [location] = useLocation();
  const { cartItems, showCart } = useCartStore();
  const { t, i18n } = useTranslation();
  const [customerId, setCustomerId] = useState<string | undefined>();
  
  useEffect(() => {
    const stored = localStorage.getItem("currentCustomer");
    if (stored) {
      try {
        const customer = JSON.parse(stored);
        setCustomerId(customer.id || customer._id);
      } catch (e) { console.warn('[CustomerLayout] Failed to parse stored customer:', e); }
    }
  }, []);

  const { requestPermission, permission } = useNotifications({
    userType: 'customer',
    userId: customerId,
    autoSubscribe: true,
  });

  // Show notification banner for ALL visitors — mandatory
  const showNotifBanner = permission === 'default';

  const cartItemCount = cartItems.reduce((acc: number, item: { quantity: number }) => acc + item.quantity, 0);

  const navItems = [
    { path: "/menu", icon: Home, label: t("nav.menu") || "القائمة", testId: "nav-menu" },
    { path: "/my-offers", icon: Gift, label: t("nav.my_offers") || "عروضي", testId: "nav-my-offers" },
    { path: "/my-orders", icon: ClipboardList, label: t("nav.my_orders") || "طلباتي", testId: "nav-my-orders" },
    { path: "/my-card", icon: CreditCard, label: t("nav.my_card") || "محفظتي", testId: "nav-my-card" },
    { path: "/profile", icon: User, label: t("nav.profile") || "حسابي", testId: "nav-profile" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-ibm-arabic" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      {showHeader && (
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container flex h-14 items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">{title}</h1>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative"
              onClick={showCart}
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -left-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>
        </header>
      )}

      <main className="flex-1 pb-20">
        {children}
      </main>

      <CustomerFooter />

      {showNotifBanner && (
        <NotificationPermissionBanner onRequestPermission={requestPermission} />
      )}

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t safe-area-bottom">
          <div className="flex h-16 items-center gap-1 px-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={`flex flex-col gap-0.5 h-auto py-2 px-3 flex-shrink-0 min-w-[56px] rounded-xl ${isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                  data-testid={item.testId}
                >
                  <Link href={item.path}>
                    <item.icon className="h-5 w-5 mx-auto" />
                    <span className="text-[10px] leading-tight whitespace-nowrap">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              className="flex flex-col gap-0.5 h-auto py-2 px-3 flex-shrink-0 min-w-[56px] rounded-xl text-muted-foreground relative"
              onClick={showCart}
              data-testid="nav-cart"
            >
              <ShoppingCart className="h-5 w-5 mx-auto" />
              <span className="text-[10px] leading-tight whitespace-nowrap">{t("nav.cart") || "السلة"}</span>
              {cartItemCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute top-1 right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

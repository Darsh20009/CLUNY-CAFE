import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, User, CreditCard, ClipboardList, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/language-toggle";

import { CustomerFooter } from "@/components/customer-footer";

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
  const cartItemCount = cartItems.reduce((acc: number, item: { quantity: number }) => acc + item.quantity, 0);
  const isArabic = i18n.language.startsWith("ar");

  const navItems = [
    { path: "/menu", icon: Home, label: t("nav.menu") || "القائمة", shortLabel: isArabic ? "القائمة" : "Menu", testId: "nav-menu" },
    { path: "/my-offers", icon: Gift, label: t("nav.my_offers") || "عروضي", shortLabel: isArabic ? "عروضي" : "Offers", testId: "nav-my-offers" },
    { path: "/my-orders", icon: ClipboardList, label: t("nav.my_orders") || "طلباتي", shortLabel: isArabic ? "طلباتي" : "Orders", testId: "nav-my-orders" },
    { path: "/my-card", icon: CreditCard, label: t("nav.my_card") || "بطاقتي", shortLabel: isArabic ? "بطاقتي" : "Card", testId: "nav-my-card" },
    { path: "/profile", icon: User, label: t("nav.profile") || "حسابي", shortLabel: isArabic ? "حسابي" : "Profile", testId: "nav-profile" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-ibm-arabic" dir={isArabic ? 'rtl' : 'ltr'}>
      {showHeader && (
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container flex h-14 items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">{title}</h1>
            <div className="flex items-center gap-1">
              <LanguageToggle />
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
          </div>
        </header>
      )}
      {!showHeader && (
        <div className="fixed top-3 z-50 start-3">
          <LanguageToggle variant="outline" className="bg-background/90 backdrop-blur shadow-sm border" />
        </div>
      )}

      <main className="flex-1 pb-20">
        {children}
      </main>

      <CustomerFooter />

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
          <div className="container grid h-16 grid-cols-6 items-center gap-0.5 px-1">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={`relative h-full w-full min-w-0 flex-col justify-center gap-1 rounded-lg px-0 py-1.5 text-muted-foreground transition-colors ${
                    isActive ? 'bg-primary/5 text-primary' : 'hover:bg-muted/60'
                  }`}
                  data-testid={item.testId}
                >
                  <Link href={item.path} aria-current={isActive ? "page" : undefined} aria-label={item.label}>
                    <item.icon className="h-5 w-5" />
                    <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-4 sm:text-xs">{item.shortLabel}</span>
                  </Link>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              className="relative h-full w-full min-w-0 flex-col justify-center gap-1 rounded-lg px-0 py-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
              onClick={showCart}
              data-testid="nav-cart"
              aria-label={t("nav.cart") || "السلة"}
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-4 sm:text-xs">
                {isArabic ? "السلة" : "Cart"}
              </span>
              {cartItemCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -left-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCartStore } from "@/lib/cart-store";
import { Trash2, Plus, Minus, ShoppingCart, ArrowLeft, ArrowRight, Coffee } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { IProductAddon, CoffeeItem } from "@shared/schema";
import SarIcon from "@/components/sar-icon";

export default function CartPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { cartItems, updateQuantity, removeFromCart, getTotalPrice } = useCartStore();

  // Fetch addons for display
  const { data: allAddons = [] } = useQuery<IProductAddon[]>({
    queryKey: ["/api/product-addons"],
  });

  // Fetch coffee items for linked drink addons
  const { data: allCoffeeItems = [] } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  // Get addon info by ID
  const getAddonInfo = (addonId: string) => {
    const addon = allAddons.find(a => a.id === addonId);
    if (!addon) return null;
    const linkedDrink = addon.linkedCoffeeItemId 
      ? allCoffeeItems.find(item => item.id === addon.linkedCoffeeItemId)
      : null;
    return { addon, linkedDrink };
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" data-testid="page-cart-empty" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <ShoppingCart className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2" data-testid="text-empty-title">
              {t("cart.empty_title")}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4" data-testid="text-empty-description">
              {t("cart.empty_desc")}
            </p>
            <Button 
              onClick={() => setLocation("/menu")}
              variant="default" 
              className="bg-primary text-accent-foreground gap-2" 
              data-testid="button-continue-shopping"
            >
              {i18n.language === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {t("cart.continue_shopping")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 sm:py-6 md:py-8" data-testid="page-cart" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center text-lg sm:text-xl md:text-2xl font-bold text-foreground" data-testid="text-cart-title">
              <ShoppingCart className={`w-5 h-5 sm:w-6 sm:h-6 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t("cart.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {cartItems.map((item) => {
              const currentName = i18n.language === 'ar' ? item.coffeeItem?.nameAr : item.coffeeItem?.nameEn || item.coffeeItem?.nameAr;
              return (
                <div 
                  key={item.id} 
                  className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-0 bg-background rounded-xl p-3 sm:p-4 border"
                  data-testid={`cart-item-${item.id}`}
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground text-base sm:text-lg" data-testid={`text-item-name-${item.id}`}>
                      {currentName}
                    </h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.selectedSize && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {t("cart.item_size")}: {item.selectedSize}
                        </Badge>
                      )}
                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.selectedAddons.map((addonId) => {
                            const info = getAddonInfo(addonId);
                            if (!info) return (
                              <Badge key={addonId} variant="outline" className="text-[10px] py-0 h-5 opacity-50">
                                {t("cart.loading")}...
                              </Badge>
                            );
                            const { addon, linkedDrink } = info;
                            const displayName = addon.isAddonDrink && linkedDrink 
                              ? `${addon.nameAr} (${linkedDrink.nameAr})`
                              : addon.nameAr;
                            return (
                              <Badge 
                                key={addonId} 
                                variant={addon.isAddonDrink ? "default" : "secondary"} 
                                className={`text-[10px] py-0 h-5 flex items-center gap-1 ${addon.isAddonDrink ? "bg-primary/20 text-primary border-primary/30" : ""}`}
                              >
                                {addon.isAddonDrink && <Coffee className="w-3 h-3" />}
                                {displayName}
                                <span className="opacity-70">+{addon.price}</span>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1" data-testid={`text-item-details-${item.id}`}>
                      {(() => {
                        let price = item.coffeeItem?.price || 0;
                        if (item.selectedSize && item.coffeeItem?.availableSizes) {
                          const size = item.coffeeItem.availableSizes.find(s => s.nameAr === item.selectedSize);
                          if (size) price = size.price;
                        }
                        return price;
                      })()} <SarIcon /> × {item.quantity}
                    </p>
                  </div>
                  <div className={`flex items-center justify-between sm:justify-end gap-2`}>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-8 h-8 sm:w-10 sm:h-10"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                      <span className="font-semibold text-foreground w-6 sm:w-8 text-center text-sm sm:text-base" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-8 h-8 sm:w-10 sm:h-10"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="w-8 h-8 sm:w-10 sm:h-10 mr-2"
                      onClick={() => removeFromCart(item.id)}
                      data-testid={`button-remove-${item.id}`}
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            
            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg sm:text-xl font-semibold text-foreground" data-testid="text-total-label">
                  {t("cart.total")}:
                </span>
                <span className="text-xl sm:text-2xl font-bold text-primary" data-testid="text-total-amount">
                  {getTotalPrice().toFixed(2)} <SarIcon />
                </span>
              </div>
              <Button 
                onClick={() => setLocation('/delivery')}
                size="lg"
                className="w-full btn-primary text-accent-foreground py-2.5 sm:py-3 text-base sm:text-lg font-semibold"
                data-testid="button-checkout"
              >
                {t("cart.checkout")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

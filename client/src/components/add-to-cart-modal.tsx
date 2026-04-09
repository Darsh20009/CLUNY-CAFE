import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { CoffeeItem, IProductAddon } from "@shared/schema";
import SarIcon from "@/components/sar-icon";

interface AddToCartModalProps {
  item: CoffeeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (itemData: any) => void;
  variants?: CoffeeItem[];
}

export function AddToCartModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  variants = [],
}: AddToCartModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<CoffeeItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedItemAddonIndices, setSelectedItemAddonIndices] = useState<number[]>([]);
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const resetModal = useCallback(() => {
    setQuantity(1);
    setSelectedSize(null);
    setSelectedAddons([]);
    setSelectedItemAddonIndices([]);
    setSelectedVariant(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen && item) {
      setSelectedVariant(item);
      setQuantity(1);
      setSelectedSize(null);
      setSelectedAddons([]);
      setSelectedItemAddonIndices([]);
    }
  }, [isOpen, item]);

  const activeItem = selectedVariant || item;

  const { data: allAddons = [] } = useQuery<IProductAddon[]>({
    queryKey: ["/api/product-addons"],
    enabled: isOpen && !!activeItem,
  });

  const { data: specificAddons = [] } = useQuery<IProductAddon[]>({
    queryKey: ["/api/coffee-items", (activeItem as any)?.id, "addons"],
    enabled: isOpen && !!activeItem && !!(activeItem as any)?.id,
  });

  const { data: allCoffeeItems = [] } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
    enabled: isOpen && !!activeItem,
  });

  const generalAddons = useMemo(() => {
    if (!activeItem) return [];
    const itemMenuCategory = (activeItem as any).category || '';
    return allAddons.filter(addon => {
      if (!addon.isAvailable || addon.isAddonDrink) return false;
      // If addon has a menuCategory set, only show it when item's category matches
      if ((addon as any).menuCategory && itemMenuCategory) {
        return (addon as any).menuCategory === itemMenuCategory;
      }
      return true; // No category restriction → show for all items
    });
  }, [activeItem, allAddons]);

  const drinkAddons = useMemo(() => {
    if (!activeItem) return [];
    return allAddons.filter(addon => addon.isAvailable === 1 && addon.isAddonDrink && addon.linkedCoffeeItemId);
  }, [activeItem, allAddons]);

  const getLinkedDrinkInfo = (addon: IProductAddon) => {
    if (!addon.linkedCoffeeItemId) return null;
    return allCoffeeItems.find(item => item.id === addon.linkedCoffeeItemId);
  };

  const itemAddons = useMemo(() => {
    const specificIds = new Set(specificAddons.map(a => a.id));
    const uniqueGeneralAddons = generalAddons.filter(a => !specificIds.has(a.id));
    return [...specificAddons, ...uniqueGeneralAddons].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [specificAddons, generalAddons]);

  const inlineAddons: Array<{nameAr: string; nameEn?: string; price: number}> = useMemo(() => {
    return (activeItem as any)?.addons || [];
  }, [activeItem]);

  const handleAddToCart = () => {
    if (!activeItem) return;

    if (activeItem.availableSizes && activeItem.availableSizes.length > 0 && !selectedSize) {
      toast({
        title: isAr ? "تنبيه" : "Notice",
        description: isAr ? "يرجى اختيار حجم المشروب" : "Please select a drink size",
        variant: "destructive",
      });
      return;
    }

    if (activeItem.isAvailable === 0 || (activeItem.availabilityStatus !== 'available' && activeItem.availabilityStatus !== 'new' && !!activeItem.availabilityStatus)) {
      toast({
        title: isAr ? "غير متوفر" : "Unavailable",
        description: isAr ? "نعتذر، هذا المنتج غير متوفر للطلب حالياً" : "Sorry, this product is currently unavailable",
        variant: "destructive",
      });
      return;
    }

    const selectedItemAddons = selectedItemAddonIndices.map(idx => inlineAddons[idx]).filter(Boolean);

    const cartItem = {
      coffeeItemId: activeItem.id,
      quantity,
      selectedSize: selectedSize || "default",
      selectedAddons: selectedAddons,
      selectedItemAddons,
    };

    onAddToCart(cartItem);
    resetModal();
  };

  if (!activeItem) return null;

  const inlineAddonsPrice = selectedItemAddonIndices.reduce((sum, idx) => {
    return sum + (inlineAddons[idx]?.price ?? 0);
  }, 0);

  const productAddonPrice = selectedAddons.reduce((sum, addonId) => {
    const addon = allAddons.find((a) => a.id === addonId);
    return sum + (addon?.price ?? 0);
  }, 0);

  const totalPrice =
    (selectedSize
      ? activeItem.availableSizes?.find((s) => s.nameAr === selectedSize)?.price ??
        activeItem.price
      : activeItem.price) * quantity +
    (productAddonPrice + inlineAddonsPrice) * quantity;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetModal()}>
      <DialogContent className="w-full max-w-sm bg-background border border-border p-0 overflow-hidden gap-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
          {activeItem.imageUrl && (
            <img 
              src={activeItem.imageUrl.startsWith('/') ? activeItem.imageUrl : `/${activeItem.imageUrl}`} 
              alt={isAr ? activeItem.nameAr : activeItem.nameEn || activeItem.nameAr} 
              className="w-24 h-24 rounded-xl object-cover border-4 border-background shadow-lg"
            />
          )}
        </div>
        
        <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[75vh]">
          <DialogHeader className="pt-2">
            <DialogTitle className="text-xl font-bold text-center text-foreground">
              {isAr ? activeItem.nameAr : activeItem.nameEn || activeItem.nameAr}
            </DialogTitle>
            {activeItem.description && (
              <p className="text-xs text-muted-foreground text-center line-clamp-2 mt-1">
                {activeItem.description}
              </p>
            )}
          </DialogHeader>

          {variants.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{isAr ? "اختر النوع" : "Select Type"}</Label>
              <div className="flex flex-wrap gap-3">
                {variants.map((variant) => {
                  const displayName = isAr 
                    ? (variant.nameAr.replace(activeItem.nameAr, '').trim() || variant.nameAr)
                    : ((variant.nameEn || variant.nameAr).replace(activeItem.nameEn || activeItem.nameAr, '').trim() || variant.nameEn || variant.nameAr);
                  
                  return (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setSelectedSize(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        selectedVariant?.id === variant.id 
                          ? "bg-primary text-white shadow-md border-2 border-primary" 
                          : "bg-secondary text-foreground border-2 border-border hover:border-primary/50"
                      }`}
                    >
                      {isAr ? variant.nameAr : variant.nameEn || variant.nameAr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeItem.availableSizes && activeItem.availableSizes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{isAr ? "اختر الحجم" : "Select Size"}</Label>
              <div className="grid grid-cols-3 gap-2">
                {activeItem.availableSizes.map((size) => (
                  <button
                    key={size.nameAr}
                    onClick={() => setSelectedSize(size.nameAr)}
                    className={`p-2 rounded-xl text-center transition-all ${
                      selectedSize === size.nameAr
                        ? "bg-primary text-white shadow-md"
                        : "bg-secondary border border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-xs font-semibold">{isAr ? size.nameAr : (size as any).nameEn || size.nameAr}</div>
                    <div className={`text-xs mt-0.5 ${selectedSize === size.nameAr ? "text-white/80" : "text-primary font-bold"}`}>
                      <span className="flex items-center justify-center gap-0.5">{size.price} <SarIcon /></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {inlineAddons.length > 0 && (
            <div className="space-y-3">
              {(() => {
                const sections: Record<string, number[]> = {};
                inlineAddons.forEach((addon, idx) => {
                  const sec = (addon as any).section || '';
                  if (!sections[sec]) sections[sec] = [];
                  sections[sec].push(idx);
                });
                return Object.entries(sections).map(([sec, indices]) => {
                  const isSingleSelectSection = indices.some(i => !!(inlineAddons[i] as any).isSingleSelect);
                  return (
                    <div key={sec} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-foreground">
                          {sec || (isAr ? "الإضافات" : "Extras")}
                        </Label>
                        {isSingleSelectSection && (
                          <span className="text-xs text-muted-foreground">{isAr ? "(اختر واحد)" : "(pick one)"}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {indices.map((idx) => {
                          const addon = inlineAddons[idx];
                          const selected = selectedItemAddonIndices.includes(idx);
                          const imgSrc = (addon as any).imageUrl;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (isSingleSelectSection) {
                                  setSelectedItemAddonIndices((prev) => {
                                    const withoutSection = prev.filter(i => !indices.includes(i));
                                    return selected ? withoutSection : [...withoutSection, idx];
                                  });
                                } else {
                                  setSelectedItemAddonIndices((prev) =>
                                    prev.includes(idx)
                                      ? prev.filter((i) => i !== idx)
                                      : [...prev, idx]
                                  );
                                }
                              }}
                              className={`rounded-xl text-xs font-medium transition-all flex items-center gap-2 px-3 py-2 ${
                                selected
                                  ? "bg-primary text-white shadow-md ring-2 ring-primary/30"
                                  : "bg-secondary text-foreground border border-border hover:border-primary/50"
                              }`}
                            >
                              {imgSrc && (
                                <img
                                  src={imgSrc.startsWith('/') ? imgSrc : '/' + imgSrc}
                                  alt={addon.nameAr}
                                  className="w-6 h-6 rounded object-cover"
                                />
                              )}
                              <span>{isAr ? addon.nameAr : ((addon as any).nameEn || addon.nameAr)}</span>
                              {addon.price > 0 && (
                                <span className={selected ? "text-white/80" : "text-primary font-bold"}>
                                  +{addon.price}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {specificAddons.length > 0 && (() => {
            const grouped: Record<string, IProductAddon[]> = {};
            specificAddons.forEach(addon => {
              const cat = (addon as any).category || 'other';
              if (!grouped[cat]) grouped[cat] = [];
              grouped[cat].push(addon);
            });
            const catLabels: Record<string, string> = {
              sugar: isAr ? "السكر" : "Sugar",
              milk: isAr ? "الحليب" : "Milk",
              shot: isAr ? "شوت" : "Shot",
              syrup: isAr ? "شراب" : "Syrup",
              topping: isAr ? "توبينج" : "Topping",
              size: isAr ? "الحجم" : "Size",
              flavor: isAr ? "النكهة" : "Flavor",
              other: isAr ? "إضافات" : "Addons",
            };
            return (
              <div className="space-y-3">
                {Object.entries(grouped).map(([cat, addons]) => {
                  const isSingleSelect = addons.some((a: any) => a.isSingleSelect === true) || cat === 'sugar' || cat === 'milk' || cat === 'size';
                  const label = catLabels[cat] || (isAr ? "إضافات" : "Addons");
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-foreground">{label}</Label>
                        {isSingleSelect && (
                          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">{isAr ? "اختر واحد" : "Select one"}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {addons.map((addon) => (
                          <button
                            key={addon.id}
                            onClick={() => {
                              if (isSingleSelect) {
                                const otherIdsInCat = addons.map(a => a.id).filter(id => id !== addon.id);
                                setSelectedAddons((prev) => {
                                  const withoutCat = prev.filter(id => !otherIdsInCat.includes(id) && id !== addon.id);
                                  return prev.includes(addon.id) ? withoutCat : [...withoutCat, addon.id];
                                });
                              } else {
                                setSelectedAddons((prev) =>
                                  prev.includes(addon.id)
                                    ? prev.filter((id) => id !== addon.id)
                                    : [...prev, addon.id]
                                );
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                              selectedAddons.includes(addon.id)
                                ? "bg-primary text-white shadow-md"
                                : "bg-secondary text-foreground border border-border hover:border-primary/50"
                            }`}
                          >
                            {isAr ? addon.nameAr : addon.nameEn || addon.nameAr}
                            {addon.price > 0 && (
                              <span className={selectedAddons.includes(addon.id) ? "text-white/80" : "text-primary"}>
                                +{addon.price}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {generalAddons.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{specificAddons.length > 0 ? (isAr ? "إضافات عامة" : "General Addons") : (isAr ? "إضافات عامة" : "General Addons")}</Label>
              <div className="flex flex-wrap gap-2">
                {generalAddons.slice(0, 6).map((addon) => (
                  <button
                    key={addon.id}
                    onClick={() => {
                      setSelectedAddons((prev) =>
                        prev.includes(addon.id)
                          ? prev.filter((id) => id !== addon.id)
                          : [...prev, addon.id]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      selectedAddons.includes(addon.id)
                        ? "bg-accent text-white shadow-md"
                        : "bg-secondary text-foreground border border-border hover:border-accent/50"
                    }`}
                  >
                    {isAr ? addon.nameAr : addon.nameEn || addon.nameAr}
                    <span className={selectedAddons.includes(addon.id) ? "text-white/80" : "text-accent"}>
                      +{addon.price}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {drinkAddons.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{isAr ? "إضافة مشروب" : "Add Drink"}</Label>
              <div className="flex flex-wrap gap-2">
                {drinkAddons.map((addon) => {
                  const linkedDrink = getLinkedDrinkInfo(addon);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => {
                        setSelectedAddons((prev) =>
                          prev.includes(addon.id)
                            ? prev.filter((id) => id !== addon.id)
                            : [...prev, addon.id]
                        );
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                        selectedAddons.includes(addon.id)
                          ? "bg-primary text-white shadow-md ring-2 ring-primary/50"
                          : "bg-secondary text-foreground border border-border hover:border-primary/50"
                      }`}
                    >
                      {linkedDrink?.imageUrl && (
                        <img 
                          src={linkedDrink.imageUrl.startsWith('/') ? linkedDrink.imageUrl : `/${linkedDrink.imageUrl}`}
                          alt={isAr ? addon.nameAr : addon.nameEn || addon.nameAr}
                          className="w-6 h-6 rounded object-cover"
                        />
                      )}
                      <span>{isAr ? addon.nameAr : addon.nameEn || addon.nameAr}</span>
                      <span className={selectedAddons.includes(addon.id) ? "text-white/80" : "text-primary font-bold"}>
                        +{addon.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3">
            <Label className="text-sm font-semibold text-foreground">{isAr ? "الكمية" : "Quantity"}</Label>
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-8 w-8 rounded-lg border-border"
                data-testid="button-decrease-quantity"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-6 text-center font-bold text-lg text-foreground">{quantity}</span>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(quantity + 1)}
                className="h-8 w-8 rounded-lg border-border"
                data-testid="button-increase-quantity"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-xs text-muted-foreground">{isAr ? "الإجمالي" : "Total"}</span>
              <div className="text-2xl font-bold text-primary">
                {totalPrice.toFixed(2)} <span className="text-sm"><SarIcon /></span>
              </div>
            </div>
            <Button
              onClick={handleAddToCart}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-5 rounded-xl font-bold shadow-lg"
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="w-4 h-4 ml-2" />
              {isAr ? "إضافة" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

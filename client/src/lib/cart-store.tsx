import { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { CoffeeItem } from "@shared/schema";

interface EnrichedCartItem {
  id: string;
  coffeeItemId: string;
  quantity: number;
  sessionId: string;
  coffeeItem?: CoffeeItem;
  selectedSize?: string;
  selectedAddons?: string[];
  enrichedAddons?: any[];
  selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>;
  selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null;
}

export interface DeliveryInfo {
  type: 'pickup' | 'delivery' | 'dine-in' | 'car-pickup' | 'scheduled-pickup';
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  productReservationDate?: string;
  productReservationFromTime?: string;
  productReservationToTime?: string;
  dineIn?: boolean;
  tableId?: string;
  tableNumber?: string;
  arrivalTime?: string;
  scheduledPickupTime?: string;
  carPickup?: boolean;
  carInfo?: {
    carType: string;
    carColor: string;
    plateNumber: string;
    parkingSlot?: string;
  };
  address?: {
    fullAddress: string;
    lat: number;
    lng: number;
    zone: string;
  };
  deliveryFee?: number;
  deliveryAddress?: string;
}

interface CartContextType {
  cartItems: EnrichedCartItem[];
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  sessionId: string;
  isLoading: boolean;
  deliveryInfo: DeliveryInfo | null;
  addToCart: (coffeeItemId: string, quantity?: number, selectedSize?: string | null, selectedAddons?: string[], selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>, selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  setDeliveryInfo: (info: DeliveryInfo) => void;
  clearDeliveryInfo: () => void;
  showCart: () => void;
  hideCart: () => void;
  showCheckout: () => void;
  hideCheckout: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  getFinalTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCartStore = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCartStore must be used within a CartProvider");
  return context;
};

function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json); }
  catch { return fallback; }
}

function buildCompositeId(coffeeItemId: string, selectedSize?: string | null, selectedAddons?: string[], selectedItemAddons?: Array<{nameAr: string; price: number}>) {
  const size = selectedSize || "default";
  const addons = (selectedAddons || []).sort().join(",");
  const inlineAddons = (selectedItemAddons || []).map(a => a.nameAr).sort().join(",");
  return `${coffeeItemId}-${size}-${addons}-${inlineAddons}`;
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [deliveryInfo, setDeliveryInfoState] = useState<DeliveryInfo | null>(() => {
    return safeJsonParse<DeliveryInfo | null>(localStorage.getItem("delivery-info"), null);
  });
  const [sessionId] = useState(() => {
    let id = localStorage.getItem("coffee-session-id");
    if (!id) {
      id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("coffee-session-id", id);
    }
    return id;
  });

  const queryClient = useQueryClient();
  const cartQueryKey = ["/api/cart", sessionId];

  const { data: cartItems = [], isLoading } = useQuery<EnrichedCartItem[]>({
    queryKey: cartQueryKey,
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // ── Add to cart — optimistic update ──────────────────────────────────────
  const addToCartMutation = useMutation({
    mutationFn: async ({ coffeeItemId, quantity, selectedSize, selectedAddons, selectedItemAddons, selectedReservationPackage }: {
      coffeeItemId: string; quantity: number; selectedSize?: string | null;
      selectedAddons?: string[]; selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>;
      selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null;
    }) => {
      const response = await apiRequest("POST", "/api/cart", {
        sessionId, coffeeItemId, quantity,
        selectedSize: selectedSize || "default",
        selectedAddons: selectedAddons || [],
        selectedItemAddons: selectedItemAddons || [],
        selectedReservationPackage: selectedReservationPackage || null,
      });
      return response.json();
    },
    // ── Optimistic: update cache immediately before server responds ──
    onMutate: async ({ coffeeItemId, quantity, selectedSize, selectedAddons, selectedItemAddons, selectedReservationPackage }) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousItems = queryClient.getQueryData<EnrichedCartItem[]>(cartQueryKey) ?? [];
      const compositeId = buildCompositeId(coffeeItemId, selectedSize, selectedAddons, selectedItemAddons);

      queryClient.setQueryData<EnrichedCartItem[]>(cartQueryKey, (old = []) => {
        const existing = old.find(item => item.id === compositeId);
        if (existing) {
          return old.map(item =>
            item.id === compositeId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        // Get cached coffee items to enrich the optimistic entry
        const allItems = queryClient.getQueryData<CoffeeItem[]>(["/api/coffee-items"]) ?? [];
        const coffeeItem = allItems.find((c: any) => c.id === coffeeItemId || c._id === coffeeItemId);
        return [...old, {
          id: compositeId,
          coffeeItemId,
          quantity,
          sessionId,
          selectedSize: selectedSize || undefined,
          selectedAddons: selectedAddons || [],
          selectedItemAddons: selectedItemAddons || [],
          selectedReservationPackage: selectedReservationPackage || null,
          coffeeItem: coffeeItem as CoffeeItem | undefined,
        }];
      });
      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(cartQueryKey, context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
    },
  });

  // ── Update quantity — optimistic update ───────────────────────────────────
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) => {
      const response = await apiRequest("PUT", `/api/cart/${sessionId}/${cartItemId}`, { quantity });
      return response.json();
    },
    onMutate: async ({ cartItemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousItems = queryClient.getQueryData<EnrichedCartItem[]>(cartQueryKey) ?? [];
      queryClient.setQueryData<EnrichedCartItem[]>(cartQueryKey, (old = []) =>
        old.map(item => item.id === cartItemId ? { ...item, quantity } : item)
      );
      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) queryClient.setQueryData(cartQueryKey, context.previousItems);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
    },
  });

  // ── Remove from cart — optimistic update ──────────────────────────────────
  const removeFromCartMutation = useMutation({
    mutationFn: async (cartItemId: string) => {
      const response = await apiRequest("DELETE", `/api/cart/${sessionId}/${cartItemId}`);
      return response.json();
    },
    onMutate: async (cartItemId) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousItems = queryClient.getQueryData<EnrichedCartItem[]>(cartQueryKey) ?? [];
      queryClient.setQueryData<EnrichedCartItem[]>(cartQueryKey, (old = []) =>
        old.filter(item => item.id !== cartItemId)
      );
      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) queryClient.setQueryData(cartQueryKey, context.previousItems);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
    },
  });

  // ── Clear cart ─────────────────────────────────────────────────────────────
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/cart/${sessionId}`);
      return response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousItems = queryClient.getQueryData<EnrichedCartItem[]>(cartQueryKey) ?? [];
      queryClient.setQueryData<EnrichedCartItem[]>(cartQueryKey, []);
      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) queryClient.setQueryData(cartQueryKey, context.previousItems);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
    },
  });

  // ── Public actions ────────────────────────────────────────────────────────
  const addToCart = (
    coffeeItemId: string, quantity: number = 1, selectedSize?: string | null,
    selectedAddons?: string[], selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>,
    selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null
  ) => {
    const formattedAddons = Array.isArray(selectedAddons) ? selectedAddons.map(id => String(id)) : [];
    addToCartMutation.mutate({
      coffeeItemId, quantity, selectedSize,
      selectedAddons: formattedAddons,
      selectedItemAddons: selectedItemAddons || [],
      selectedReservationPackage: selectedReservationPackage || null,
    });
  };

  const removeFromCart = (cartItemId: string) => removeFromCartMutation.mutate(cartItemId);

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) removeFromCart(cartItemId);
    else updateQuantityMutation.mutate({ cartItemId, quantity });
  };

  const clearCart = () => {
    clearCartMutation.mutate();
    clearDeliveryInfo();
  };

  const setDeliveryInfo = (info: DeliveryInfo) => {
    setDeliveryInfoState(info);
    localStorage.setItem("delivery-info", JSON.stringify(info));
  };

  const clearDeliveryInfo = () => {
    setDeliveryInfoState(null);
    localStorage.removeItem("delivery-info");
  };

  const showCart = () => setIsCartOpen(true);
  const hideCart = () => setIsCartOpen(false);
  const showCheckout = () => setIsCheckoutOpen(true);
  const hideCheckout = () => setIsCheckoutOpen(false);

  // ── Computed values ───────────────────────────────────────────────────────
  const getTotalPrice = (): number => {
    return cartItems.reduce((total, item) => {
      if (!item.coffeeItem?.price) return total;
      const basePrice = item.coffeeItem.price;
      let itemPrice = basePrice;
      if (item.selectedSize && item.coffeeItem.availableSizes) {
        const size = item.coffeeItem.availableSizes.find(s => s.nameAr === item.selectedSize);
        itemPrice = size ? size.price : basePrice;
      }
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
      const addonsPrice = (item.selectedAddons || []).reduce((sum, addonId) => {
        if (item.enrichedAddons) {
          const addon = item.enrichedAddons.find((a: any) => a.id === addonId || a._id === addonId);
          return sum + (addon?.price || 0);
        }
        return sum;
      }, 0);
      const inlineAddonsPrice = ((item as any).selectedItemAddons || []).reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
      const lineTotal = ((isNaN(price) ? 0 : price) + addonsPrice + inlineAddonsPrice) * item.quantity;
      return total + Math.round(lineTotal * 100) / 100;
    }, 0);
  };

  const getTotalItems = (): number => cartItems.reduce((total, item) => total + item.quantity, 0);

  const getFinalTotal = (): number => getTotalPrice() + (deliveryInfo?.deliveryFee || 0);

  useEffect(() => {
    if (isCheckoutOpen) setIsCartOpen(false);
  }, [isCheckoutOpen]);

  return (
    <CartContext.Provider value={{
      cartItems, isCartOpen, isCheckoutOpen, sessionId, isLoading, deliveryInfo,
      addToCart, removeFromCart, updateQuantity, clearCart,
      setDeliveryInfo, clearDeliveryInfo,
      showCart, hideCart, showCheckout, hideCheckout,
      getTotalPrice, getTotalItems, getFinalTotal,
    }}>
      {children}
    </CartContext.Provider>
  );
};

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Coffee, Minus, Plus, Search, ShoppingBag, Wifi, WifiOff } from "lucide-react";
import type { CoffeeItem } from "@shared/schema";
import DrinkCustomizationDialog, { type DrinkCustomization } from "@/components/drink-customization-dialog";
import SarIcon from "@/components/sar-icon";
import clunyLogo from "@assets/cluny-logo-customer.png";
import { useRealtimeEvent, useRealtimeSend, useRealtimeStatus } from "@/hooks/useRealtimeEngine";

type DisplayOrderItem = {
  lineItemId: string;
  productId?: string;
  nameAr: string;
  nameEn?: string;
  imageUrl?: string;
  selectedSize?: string;
  selectedAddons?: string[];
  price: number;
  quantity: number;
};

type DisplayUpdate = {
  event?: string;
  items?: DisplayOrderItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  controlEnabled?: boolean;
  enabled?: boolean;
  online?: boolean;
  orderNumber?: string;
};

export default function DualPOSDisplay() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const direction = isArabic ? "rtl" : "ltr";
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const branchId = params.get("branchId") || "";
  const terminalId = params.get("terminalId") || "";
  const isPaired = Boolean(branchId && terminalId);
  const { connected } = useRealtimeStatus();
  const { send } = useRealtimeSend();
  const [controlEnabled, setControlEnabled] = useState(false);
  const [pairedPosOnline, setPairedPosOnline] = useState(false);
  const [orderItems, setOrderItems] = useState<DisplayOrderItem[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderSubtotal, setOrderSubtotal] = useState(0);
  const [orderTax, setOrderTax] = useState(0);
  const [thankYouOrderNumber, setThankYouOrderNumber] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [customizing, setCustomizing] = useState<{ item: CoffeeItem; group: CoffeeItem[] } | null>(null);

  const { data: products = [], isLoading, isError } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
    staleTime: 5 * 60 * 1000,
  });
  const { data: menuCategories = [] } = useQuery<Array<{
    id: string;
    nameAr: string;
    nameEn?: string;
    isActive?: number;
    orderIndex?: number;
  }>>({
    queryKey: ["/api/menu-categories"],
    staleTime: 5 * 60 * 1000,
  });
  const { data: itemsWithAddons = [] } = useQuery<string[]>({
    queryKey: ["/api/coffee-items/with-addons"],
    staleTime: 5 * 60 * 1000,
  });
  const itemsWithAddonsSet = useMemo(() => new Set(itemsWithAddons.map(String)), [itemsWithAddons]);

  useRealtimeEvent("dual_pos_display_update", (message: any) => {
    const update: DisplayUpdate = message?.payload || message;
    if (!update) return;
    if (update.event === "terminal_status") {
      setPairedPosOnline(update.online === true);
      setControlEnabled(update.enabled === true);
      return;
    }
    if (update.event === "terminal_offline") {
      setPairedPosOnline(false);
      setControlEnabled(false);
      return;
    }
    if (update.event === "control_mode") {
      if (update.online !== false) setPairedPosOnline(true);
      setControlEnabled(update.enabled === true);
      return;
    }
    if (update.event === "payment_processing") {
      setControlEnabled(false);
      return;
    }
    setPairedPosOnline(true);
    if (update.controlEnabled !== undefined) setControlEnabled(update.controlEnabled === true);
    if (Array.isArray(update.items)) setOrderItems(update.items);
    if (typeof update.total === "number") setOrderTotal(update.total);
    if (typeof update.subtotal === "number") setOrderSubtotal(update.subtotal);
    if (typeof update.tax === "number") setOrderTax(update.tax);
    if (update.event === "order_cancelled") {
      setOrderItems([]);
      setOrderTotal(0);
      setOrderSubtotal(0);
      setOrderTax(0);
    }
    if (update.event === "payment_success") {
      setThankYouOrderNumber(String(update.orderNumber || "—"));
    }
  }, {
    clientType: "pos-display",
    branchId,
    dualPosTerminalId: terminalId,
  });

  useEffect(() => {
    if (connected && isPaired) send("dual_pos_request_state");
  }, [connected, isPaired, send]);

  useEffect(() => {
    if (!thankYouOrderNumber) return;
    const timer = window.setTimeout(() => {
      setThankYouOrderNumber("");
      setOrderItems([]);
      setOrderTotal(0);
      setOrderSubtotal(0);
      setOrderTax(0);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [thankYouOrderNumber]);

  const categories = useMemo(() => {
    const active = menuCategories
      .filter((category) => category.isActive !== 0)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    return [
      { id: "all", nameAr: "الكل", nameEn: "All" },
      ...active,
    ];
  }, [menuCategories]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      if (Number(product.isAvailable) !== 1) return false;
      if (product.availabilityStatus === "unavailable" || product.availabilityStatus === "out_of_stock" || product.availabilityStatus === "temporarily_unavailable") return false;
      const categoryMatches = selectedCategory === "all"
        || String(product.category) === selectedCategory
        || categories.some((category) =>
          category.id === selectedCategory &&
          (category.nameAr === product.category || category.nameEn === product.category)
        );
      const textMatches = !query
        || [product.nameAr, product.nameEn, product.description, product.descriptionEn]
          .some((value) => String(value || "").toLocaleLowerCase().includes(query));
      return categoryMatches && textMatches;
    });
  }, [products, categories, search, selectedCategory]);

  const canControl = controlEnabled && isPaired && connected && pairedPosOnline;
  const sendCustomerAction = (payload: Record<string, unknown>) => {
    if (!canControl) return;
    send("dual_pos_customer_action", { payload });
  };

  const imageFor = (url?: string) => {
    if (!url) return "";
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")
      ? url
      : `/${url}`;
  };

  const openProduct = (item: CoffeeItem) => {
    if (!canControl) return;
    const group = item.groupId
      ? products.filter((candidate) => candidate.groupId === item.groupId && Number(candidate.isAvailable) === 1)
      : [item];
    const hasOptions = group.length > 1
      || Boolean(item.availableSizes?.length)
      || Boolean((item as any).addons?.length)
      || itemsWithAddonsSet.has(String(item.id));
    if (!hasOptions) {
      sendCustomerAction({ action: "add", productId: item.id, quantity: 1, configured: false });
      return;
    }
    setCustomizing({ item, group });
  };

  const confirmCustomization = (
    customization: DrinkCustomization,
    quantity: number,
    selectedVariant?: CoffeeItem,
  ) => {
    if (!customizing) return;
    const targetItem = selectedVariant || customizing.item;
    const inlineAddons = Array.isArray((targetItem as any).addons) ? (targetItem as any).addons : [];
    const selectedInlineAddonIndices = (customization.selectedInlineAddons || [])
      .map((selected) => inlineAddons.findIndex((addon: any) =>
        addon.nameAr === selected.nameAr && (addon.section || "") === (selected.section || "")
      ))
      .filter((index) => index >= 0);
    sendCustomerAction({
      action: "add",
      productId: targetItem.id,
      quantity,
      configured: true,
      selectedSize: customization.selectedSize || "",
      selectedAddons: customization.selectedAddons.map((addon) => ({
        addonId: addon.addonId,
        quantity: addon.quantity,
      })),
      selectedInlineAddonIndices,
      notes: customization.notes || "",
    });
    setCustomizing(null);
  };

  const updateLineQuantity = (item: DisplayOrderItem, delta: number) => {
    const quantity = Math.max(0, Math.min(99, item.quantity + delta));
    sendCustomerAction({
      action: "set_quantity",
      lineItemId: item.lineItemId,
      quantity,
    });
  };

  const formattedPrice = (price: number) => Number(price || 0).toFixed(2);

  if (thankYouOrderNumber) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f0e7] p-6 text-center" dir={direction}>
        <section className="w-full max-w-2xl rounded-[2rem] border border-[#d9cba8] bg-white p-10 shadow-xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg">
            <CheckCircle2 className="h-11 w-11" />
          </div>
          <img src={clunyLogo} alt="CLUNY CAFE" className="mx-auto mb-4 h-12 object-contain" />
          <h1 className="text-4xl font-black text-emerald-950">{isArabic ? "شكراً لطلبكم" : "Thank you for your order"}</h1>
          <p className="mt-3 text-lg text-stone-600">{isArabic ? "تم تسجيل طلبكم بنجاح" : "Your order has been placed successfully"}</p>
          {thankYouOrderNumber && <p className="mt-4 font-bold text-emerald-800">{isArabic ? "رقم الطلب" : "Order"}: {thankYouOrderNumber}</p>}
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-dvh min-h-[520px] flex-col overflow-hidden bg-[#f5f2eb] text-stone-900" dir={direction}>
      <header className="z-10 flex shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <img src={clunyLogo} alt="CLUNY CAFE" className="h-10 w-auto object-contain sm:h-12" />
          <div>
            <h1 className="text-lg font-black tracking-wide text-emerald-950 sm:text-xl">CLUNY CAFE</h1>
            <p className="text-xs text-stone-500">{isArabic ? "قائمة الطلب" : "Order menu"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-600">
          {connected && pairedPosOnline ? <Wifi className="h-4 w-4 text-emerald-700" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
          <span>
            {!connected
              ? (isArabic ? "جاري الاتصال" : "Connecting")
              : pairedPosOnline
                ? (isArabic ? "متصل بنقطة البيع" : "Connected to POS")
                : (isArabic ? "بانتظار نقطة البيع" : "Waiting for POS")}
          </span>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <section className="flex min-h-0 flex-col border-b border-stone-200 lg:border-b-0 lg:border-e">
          <div className="flex shrink-0 flex-col gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-emerald-950 sm:text-2xl">{isArabic ? "اختر من المنيو" : "Choose from the menu"}</h2>
                <p className="mt-1 text-xs text-stone-500">{isArabic ? "تصفح المنتجات المتاحة" : "Browse available items"}</p>
              </div>
              <label className="flex h-10 w-full max-w-[220px] items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3">
                <Search className="h-4 w-4 shrink-0 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={isArabic ? "ابحث عن منتج" : "Search menu"}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
                  aria-label={isArabic ? "ابحث عن منتج" : "Search menu"}
                />
              </label>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={isArabic ? "تصنيفات المنيو" : "Menu categories"}>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                    selectedCategory === category.id
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-emerald-50 hover:text-emerald-900"
                  }`}
                >
                  {isArabic ? category.nameAr : category.nameEn || category.nameAr}
                </button>
              ))}
            </nav>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            {!canControl && (
              <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {isArabic ? "يمكنك تصفح القائمة. اطلب من الموظف تفعيل التحكم لإضافة المنتجات." : "Browse the menu. Ask staff to enable customer control to add items."}
              </div>
            )}
            {isLoading ? (
              <div className="flex h-full min-h-48 items-center justify-center text-stone-500">{isArabic ? "جاري تحميل المنتجات..." : "Loading menu..."}</div>
            ) : isError ? (
              <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-red-100 bg-white p-6 text-center text-red-700">
                {isArabic ? "تعذر تحميل المنتجات. حاول تحديث الشاشة." : "Could not load the menu. Please refresh the screen."}
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-stone-500">
                <Coffee className="h-10 w-10 opacity-40" />
                <p>{isArabic ? "لا توجد منتجات في هذا التصنيف" : "No items in this category"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openProduct(item)}
                    disabled={!canControl}
                    className={`group overflow-hidden rounded-2xl border border-stone-200 bg-white text-start shadow-sm transition ${
                      canControl ? "cursor-pointer hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md" : "cursor-default"
                    }`}
                    aria-label={`${isArabic ? item.nameAr : item.nameEn || item.nameAr} ${canControl ? (isArabic ? "إضافة للطلب" : "Add to order") : ""}`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#ece8df]">
                      {imageFor(item.imageUrl) ? (
                        <img
                          src={imageFor(item.imageUrl)}
                          alt={isArabic ? item.nameAr : item.nameEn || item.nameAr}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-emerald-800/40"><Coffee className="h-12 w-12" /></div>
                      )}
                      {canControl && (
                        <span className="absolute bottom-2 end-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-800 text-white shadow-lg">
                          <Plus className="h-5 w-5" />
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-1 font-bold text-stone-900">{isArabic ? item.nameAr : item.nameEn || item.nameAr}</h3>
                      {item.description && <p className="mt-1 line-clamp-1 text-xs text-stone-500">{isArabic ? item.description : item.descriptionEn || item.description}</p>}
                      <div className="mt-2 flex items-center gap-1 font-black text-emerald-800">
                        <span>{formattedPrice(item.price)}</span><SarIcon size={12} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><ShoppingBag className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-black text-emerald-950">{isArabic ? "طلبك الحالي" : "Your order"}</h2>
                <p className="text-xs text-stone-500">{orderItems.reduce((sum, item) => sum + item.quantity, 0)} {isArabic ? "منتج" : "items"}</p>
              </div>
            </div>
            {canControl && orderItems.length > 0 && (
              <button
                className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                onClick={() => sendCustomerAction({ action: "clear_order" })}
              >
                {isArabic ? "إفراغ الطلب" : "Clear order"}
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            {orderItems.length === 0 ? (
              <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-6 text-center">
                <ShoppingBag className="mb-3 h-10 w-10 text-stone-300" />
                <p className="font-bold text-stone-700">{isArabic ? "لم تتم إضافة منتجات بعد" : "Your order is empty"}</p>
                <p className="mt-1 text-sm text-stone-500">{isArabic ? "ستظهر المنتجات التي تختارها هنا" : "Items you choose will appear here"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderItems.map((item) => (
                  <article key={item.lineItemId} className="flex gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-200">
                      {imageFor(item.imageUrl) ? <img src={imageFor(item.imageUrl)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-emerald-800/40"><Coffee className="h-7 w-7" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold">{isArabic ? item.nameAr : item.nameEn || item.nameAr}</h3>
                      {(item.selectedSize || item.selectedAddons?.length) && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">
                          {[item.selectedSize, ...(item.selectedAddons || [])].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-sm font-black text-emerald-800">{formattedPrice(item.price * item.quantity)}<SarIcon size={11} /></span>
                        {canControl ? (
                          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white p-1">
                            <button aria-label={isArabic ? "تقليل الكمية" : "Decrease quantity"} className="rounded-full p-1 hover:bg-stone-100" onClick={() => updateLineQuantity(item, -1)}><Minus className="h-3.5 w-3.5" /></button>
                            <span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span>
                            <button aria-label={isArabic ? "زيادة الكمية" : "Increase quantity"} className="rounded-full p-1 hover:bg-stone-100" onClick={() => updateLineQuantity(item, 1)}><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : <span className="text-sm font-bold text-stone-500">× {item.quantity}</span>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-stone-200 bg-[#fbfaf7] p-4 sm:p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-stone-500"><span>{isArabic ? "المجموع قبل الضريبة" : "Subtotal"}</span><span className="flex items-center gap-1">{formattedPrice(orderSubtotal)}<SarIcon size={11} /></span></div>
              <div className="flex justify-between text-stone-500"><span>{isArabic ? "الضريبة" : "VAT"}</span><span className="flex items-center gap-1">{formattedPrice(orderTax)}<SarIcon size={11} /></span></div>
              <div className="flex justify-between border-t border-stone-200 pt-3 text-base font-black text-emerald-950"><span>{isArabic ? "الإجمالي" : "Total"}</span><span className="flex items-center gap-1">{formattedPrice(orderTotal)}<SarIcon size={13} /></span></div>
            </div>
            {!canControl && (
              <p className="mt-3 text-center text-xs text-stone-400">
                {!isPaired || !pairedPosOnline
                  ? (isArabic ? "افتح الشاشة من زر نقاط البيع لربطها" : "Open this display from the POS to pair it")
                  : (isArabic ? "الإضافة والتعديل متوقفان من نقطة البيع" : "Editing is disabled at the POS")}
              </p>
            )}
          </div>
        </aside>
      </main>

      <DrinkCustomizationDialog
        coffeeItem={customizing?.item || null}
        variants={customizing?.group || []}
        open={!!customizing}
        modal={false}
        onClose={() => setCustomizing(null)}
        onConfirm={confirmCustomization}
      />
    </div>
  );
}

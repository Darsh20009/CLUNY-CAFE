import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, Flame, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CoffeeItem {
  id: string;
  nameAr: string;
  nameEn?: string;
  imageUrl?: string;
  price: number | string;
  description?: string;
  isAvailable?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
}

interface MenuLayoutProps {
  items: CoffeeItem[];
  onAddItem: (item: CoffeeItem) => void;
  lang: string;
  currency: ReactNode;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (itemId: string) => void;
}

function getItemName(item: CoffeeItem, lang: string) {
  return lang === "ar" ? item.nameAr : (item.nameEn || item.nameAr);
}

const itemMotion = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export function ClassicMenuLayout({ items, onAddItem, lang, currency, favoriteIds, onToggleFavorite }: MenuLayoutProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const isFav = favoriteIds?.has(item.id);
          return (
            <motion.div
              key={item.id}
              layout
              {...itemMotion}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="bg-card rounded-2xl border border-border p-3 flex gap-3 items-center shadow-sm cursor-pointer group"
              onClick={() => onAddItem(item)}
              data-testid={`card-menu-${item.id}`}
            >
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                <img
                  src={item.imageUrl || "/placeholder-coffee.png"}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  alt={getItemName(item, lang)}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-coffee.png"; }}
                />
              </div>
              <div className="flex-1 min-w-0 py-1">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <h3 className="text-base font-semibold truncate text-foreground">{getItemName(item, lang)}</h3>
                  {item.isBestSeller && <Badge className="bg-amber-500 text-white text-[9px] px-1.5 h-4"><Star className="w-2.5 h-2.5 ml-0.5" />الأكثر طلباً</Badge>}
                  {item.isNew && <Badge className="bg-green-500 text-white text-[9px] px-1.5 h-4">جديد</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate mb-2">{item.description || "مشروب مميز"}</p>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-bold text-lg">{item.price} <small className="text-xs font-normal text-muted-foreground">{currency}</small></span>
                  <div className="flex items-center gap-1">
                    {onToggleFavorite && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                        className="h-8 w-8 p-0 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                        data-testid={`btn-fav-${item.id}`}
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
                      </button>
                    )}
                    <Button size="sm" className="h-8 w-8 p-0 rounded-lg bg-primary hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); onAddItem(item); }} data-testid={`button-add-${item.id}`}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function CardsMenuLayout({ items, onAddItem, lang, currency, favoriteIds, onToggleFavorite }: MenuLayoutProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const isFav = favoriteIds?.has(item.id);
          return (
            <motion.div
              key={item.id}
              layout
              {...itemMotion}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm cursor-pointer group flex flex-col"
              onClick={() => onAddItem(item)}
              data-testid={`card-menu-${item.id}`}
            >
              <div className="relative aspect-square overflow-hidden bg-secondary">
                <img
                  src={item.imageUrl || "/placeholder-coffee.png"}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  alt={getItemName(item, lang)}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-coffee.png"; }}
                />
                {item.isBestSeller && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5" />الأكثر طلباً
                  </div>
                )}
                {item.isNew && (
                  <div className="absolute top-2 left-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">جديد</div>
                )}
                {onToggleFavorite && (
                  <button
                    className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                    data-testid={`btn-fav-${item.id}`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
                  </button>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-sm font-bold text-foreground leading-tight mb-1 line-clamp-2">{getItemName(item, lang)}</h3>
                <p className="text-[10px] text-muted-foreground line-clamp-2 flex-1 mb-2">{item.description || "مشروب مميز"}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-primary font-black text-sm">{item.price} <span className="text-[9px] font-normal text-muted-foreground">{currency}</span></span>
                  <button
                    className="w-7 h-7 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all active:scale-90"
                    onClick={(e) => { e.stopPropagation(); onAddItem(item); }}
                    data-testid={`button-add-${item.id}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function ListMenuLayout({ items, onAddItem, lang, currency, favoriteIds, onToggleFavorite }: MenuLayoutProps) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const isFav = favoriteIds?.has(item.id);
          return (
            <motion.div
              key={item.id}
              layout
              {...itemMotion}
              whileTap={{ scale: 0.99 }}
              className="bg-card rounded-xl border border-border flex items-center gap-3 px-3 py-2 cursor-pointer group hover:border-primary/40 hover:shadow-sm transition-all"
              onClick={() => onAddItem(item)}
              data-testid={`card-menu-${item.id}`}
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                <img
                  src={item.imageUrl || "/placeholder-coffee.png"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  alt={getItemName(item, lang)}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-coffee.png"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{getItemName(item, lang)}</span>
                  {item.isBestSeller && <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px] px-1 h-3.5"><Star className="w-2 h-2 ml-0.5" />الأكثر</Badge>}
                  {item.isNew && <Badge className="bg-green-100 text-green-700 border-0 text-[9px] px-1 h-3.5">جديد</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{item.description || "مشروب مميز"}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onToggleFavorite && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                    className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded-lg transition-colors"
                    data-testid={`btn-fav-${item.id}`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
                  </button>
                )}
                <span className="text-primary font-black text-base whitespace-nowrap">{item.price} <span className="text-[9px] font-normal text-muted-foreground">{currency}</span></span>
                <button
                  className="w-8 h-8 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  onClick={(e) => { e.stopPropagation(); onAddItem(item); }}
                  data-testid={`button-add-${item.id}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

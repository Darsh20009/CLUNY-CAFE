import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Phone, Navigation, CheckCircle2, Coffee, Star, ChevronLeft } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { useTranslation } from "react-i18next";
import { brand } from "@/lib/brand";
import logoSrc from "@assets/cluny-logo-customer.png";
import AppleMap from "@/components/apple-map";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function BranchSelectorModal() {
  const { branches, showBranchSelector, selectBranch, selectedBranchId } = useBranch();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBranchSelector) return;
    setGeoLoading(true);
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 5000 }
    );
  }, [showBranchSelector]);

  const branchesWithDist = branches
    .filter(b => (b.isActive !== 0 && b.isActive !== false) || b.isActive === undefined)
    .map(b => ({
      ...b,
      dist:
        userCoords && b.location?.lat && b.location?.lng
          ? haversineKm(userCoords.lat, userCoords.lng, b.location.lat, b.location.lng)
          : null,
    }))
    .sort((a, b) => {
      if (a.dist !== null && b.dist !== null) return a.dist - b.dist;
      if (a.dist !== null) return -1;
      if (b.dist !== null) return 1;
      return 0;
    });

  // Auto-focus first branch on load
  useEffect(() => {
    if (branchesWithDist.length > 0 && !focusedBranchId) {
      setFocusedBranchId(selectedBranchId ?? branchesWithDist[0].id);
    }
  }, [branchesWithDist.length, showBranchSelector]);

  const focusedBranch = branchesWithDist.find(b => b.id === focusedBranchId) ?? branchesWithDist[0];
  const focusedLat = focusedBranch?.location?.lat;
  const focusedLng = focusedBranch?.location?.lng;

  const handleSelect = (branchId: string) => {
    setSelecting(branchId);
    setTimeout(() => {
      selectBranch(branchId);
      setSelecting(null);
    }, 500);
  };

  const handleFocus = (branchId: string) => {
    if (focusedBranchId !== branchId) {
      setFocusedBranchId(branchId);
    }
  };

  if (!showBranchSelector) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{
          fontFamily: "'IBM Plex Sans Arabic','Tajawal',sans-serif",
          background: "#0d0d0d",
        }}
        dir={isAr ? "rtl" : "ltr"}
      >

        {/* ── COMPACT HEADER ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3 px-4 pt-10 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
            <img src={logoSrc} alt={brand.nameAr} className="w-7 h-7 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-base font-black leading-tight">
              {isAr ? "اختر فرعك" : "Choose Your Branch"}
            </h1>
            <p className="text-white/40 text-xs leading-tight truncate">
              {isAr ? "اختر الفرع لعرض المنيو الصحيح" : "Select branch to see the correct menu"}
            </p>
          </div>
          {geoLoading && (
            <div className="flex items-center gap-1.5 text-primary/70 text-[11px] flex-shrink-0">
              <Navigation className="w-3 h-3 animate-pulse" />
              <span>{isAr ? "تحديد موقعك..." : "Locating..."}</span>
            </div>
          )}
        </motion.div>

        {/* ── MAP ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative flex-shrink-0"
          style={{ height: "42vh" }}
        >
          {focusedLat && focusedLng ? (
            <>
              <AppleMap
                key={focusedBranch?.id}
                mode="view"
                center={{
                  lat: focusedLat,
                  lng: focusedLng,
                  label: isAr ? focusedBranch?.nameAr : (focusedBranch?.nameEn || focusedBranch?.nameAr),
                }}
                height="42vh"
                showZoomControls={false}
                interactive={false}
                className="rounded-none"
              />
              {/* Map caption overlay */}
              <div
                className="absolute bottom-0 inset-x-0 flex items-end justify-between px-3 py-2 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(13,13,13,0.95) 0%, transparent 100%)" }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-white text-sm font-bold">
                    {focusedBranch ? (isAr ? focusedBranch.nameAr : (focusedBranch.nameEn || focusedBranch.nameAr)) : ""}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 text-sm gap-2">
              <MapPin className="w-5 h-5" />
              <span>{isAr ? "الخريطة غير متاحة" : "Map unavailable"}</span>
            </div>
          )}
        </motion.div>

        {/* ── BRANCHES LIST ──────────────────────────────────────── */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto scrollbar-none"
          style={{ background: "#0d0d0d" }}
        >
          {branchesWithDist.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
              <Coffee className="w-9 h-9 opacity-30" />
              <span className="text-sm">{isAr ? "لا توجد فروع متاحة" : "No branches available"}</span>
            </div>
          ) : (
            branchesWithDist.map((branch, idx) => {
              const name = isAr ? branch.nameAr : (branch.nameEn || branch.nameAr);
              const isSelecting = selecting === branch.id;
              const isCurrent = selectedBranchId === branch.id;
              const isFocused = focusedBranchId === branch.id;
              const nearest = idx === 0 && branch.dist !== null;

              return (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0, x: isAr ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + idx * 0.07 }}
                >
                  {/* Divider — between rows */}
                  {idx > 0 && (
                    <div
                      className="mx-4"
                      style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
                    />
                  )}

                  <button
                    onClick={() => {
                      handleFocus(branch.id);
                      handleSelect(branch.id);
                    }}
                    onMouseEnter={() => handleFocus(branch.id)}
                    className="w-full text-right transition-colors duration-200 active:bg-white/5"
                    style={{
                      background: isFocused
                        ? "rgba(45,155,110,0.08)"
                        : "transparent",
                    }}
                    data-testid={`button-branch-${branch.id}`}
                  >
                    <div className="flex items-center gap-3 px-4 py-4">

                      {/* Status dot / check */}
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                        style={{
                          background: isSelecting || isCurrent
                            ? "hsl(155 60% 38% / 0.2)"
                            : "rgba(255,255,255,0.06)",
                          border: isFocused
                            ? "1.5px solid hsl(155 60% 38% / 0.6)"
                            : "1.5px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {isSelecting ? (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          </motion.div>
                        ) : isCurrent ? (
                          <CheckCircle2 className="w-5 h-5 text-primary/80" />
                        ) : (
                          <Coffee className="w-4 h-4 text-white/40" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-bold text-[15px] leading-tight"
                            style={{ color: isFocused ? "hsl(155 60% 50%)" : "rgba(255,255,255,0.92)" }}
                          >
                            {name}
                          </span>
                          {nearest && (
                            <span className="flex items-center gap-0.5 text-[10px] bg-primary/20 border border-primary/30 text-primary rounded-full px-1.5 py-0.5 font-bold">
                              <Navigation className="w-2.5 h-2.5" />
                              {isAr ? "الأقرب" : "Nearest"}
                            </span>
                          )}
                          {isCurrent && !isSelecting && (
                            <span className="text-[10px] bg-white/10 text-white/50 rounded-full px-2 py-0.5 font-semibold">
                              {isAr ? "الحالي" : "Current"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {branch.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-white/30 flex-shrink-0" />
                              <span className="text-white/45 text-xs truncate max-w-[180px]">{branch.address}</span>
                            </div>
                          )}
                          {branch.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-white/25 flex-shrink-0" />
                              <span className="text-white/35 text-xs" dir="ltr">{branch.phone}</span>
                            </div>
                          )}
                          {branch.dist !== null && (
                            <div className="flex items-center gap-0.5">
                              <Navigation className="w-3 h-3 text-primary/60" />
                              <span className="text-primary/70 text-xs font-semibold">
                                {branch.dist! < 1
                                  ? `${Math.round(branch.dist! * 1000)} م`
                                  : `${branch.dist!.toFixed(1)} كم`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronLeft
                        className="w-4 h-4 flex-shrink-0"
                        style={{
                          color: isFocused ? "hsl(155 60% 38%)" : "rgba(255,255,255,0.2)",
                          transform: isAr ? "none" : "rotate(180deg)",
                        }}
                      />
                    </div>
                  </button>
                </motion.div>
              );
            })
          )}

          {/* Footer spacer */}
          <div className="flex items-center justify-center py-4 gap-1.5 text-white/20 text-[11px]">
            <Star className="w-3 h-3" />
            <span>{isAr ? "يمكنك تغيير الفرع في أي وقت من المنيو" : "Change branch anytime from the menu"}</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

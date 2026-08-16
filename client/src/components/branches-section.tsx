import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@/lib/useTranslate";
import { MapPin, Phone, Clock, Navigation, Globe, Wifi, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PublicBranch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  location?: { lat: number; lng: number };
  workingHours?: { open: string; close: string };
  allowOnlineOrders?: boolean;
  allowCarOrders?: boolean;
  allowTableOrders?: boolean;
  isOnline?: boolean;
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} م`;
  return `${km.toFixed(1)} كم`;
}

export function BranchesSection() {
  const tc = useTranslate();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [locationRequested, setLocationRequested] = useState(false);

  const { data: branches = [] } = useQuery<PublicBranch[]>({
    queryKey: ["/api/public/branches"],
    staleTime: 60000,
  });

  const requestLocation = () => {
    setLocationRequested(true);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(false);
      },
      () => setLocationError(true),
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const branchesWithDistance = (branches as PublicBranch[])
    .map((b) => ({
      ...b,
      distance:
        userLocation && b.location
          ? calcDistance(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng)
          : null,
    }))
    .sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });

  if ((branches as PublicBranch[]).length === 0) return null;

  const nearestBranch = branchesWithDistance[0];
  const restBranches = branchesWithDistance.slice(1);

  return (
    <section className="py-10 px-4 border-t border-border/40 bg-muted/20">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {tc("فروعنا", "Our Branches")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tc(`${(branches as PublicBranch[]).length} فرع متاح للطلب`, `${(branches as PublicBranch[]).length} branches available`)}
            </p>
          </div>

          {!locationRequested ? (
            <Button
              variant="outline"
              size="sm"
              onClick={requestLocation}
              className="text-xs gap-1.5"
              data-testid="button-detect-location"
            >
              <Navigation className="w-3.5 h-3.5" />
              {tc("أقرب فرع لي", "Nearest to Me")}
            </Button>
          ) : locationError ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {tc("تعذّر الموقع", "Location unavailable")}
            </Badge>
          ) : userLocation ? (
            <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20">
              <Navigation className="w-3 h-3 ml-1" />
              {tc("تم تحديد موقعك", "Location detected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground animate-pulse">
              {tc("جاري التحديد...", "Locating...")}
            </Badge>
          )}
        </div>

        {/* Branch cards */}
        <div className="space-y-3">
          {branchesWithDistance.slice(0, isExpanded ? undefined : 1).map((branch, idx) => (
            <div
              key={branch.id}
              className={`rounded-2xl border bg-background p-4 space-y-3 transition-all ${
                idx === 0 && userLocation && branch.distance !== null
                  ? "border-primary/30 shadow-sm shadow-primary/10"
                  : "border-border"
              }`}
              data-testid={`card-public-branch-${branch.id}`}
            >
              {/* Branch header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">{branch.nameAr}</h3>
                    {idx === 0 && userLocation && branch.distance !== null && (
                      <Badge className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5">
                        {tc("الأقرب إليك", "Nearest")}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20">
                      <Wifi className="w-2.5 h-2.5 ml-1" />
                      {tc("متاح", "Open")}
                    </Badge>
                  </div>
                  {branch.address && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {branch.address}
                    </p>
                  )}
                </div>
                {branch.distance !== null && (
                  <div className="text-center flex-shrink-0 bg-primary/5 rounded-xl px-3 py-1.5">
                    <p className="text-sm font-bold text-primary">{formatDistance(branch.distance!)}</p>
                    <p className="text-[10px] text-muted-foreground">{tc("منك", "away")}</p>
                  </div>
                )}
              </div>

              {/* Info row */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {branch.workingHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    {branch.workingHours.open} — {branch.workingHours.close}
                  </span>
                )}
                {branch.phone && (
                  <a href={`tel:${branch.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    {branch.phone}
                  </a>
                )}
              </div>

              {/* Order type tags */}
              <div className="flex flex-wrap gap-1.5">
                {branch.allowOnlineOrders !== false && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                    🌐 {tc("أونلاين", "Online")}
                  </span>
                )}
                {branch.allowCarOrders !== false && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                    🚗 {tc("على السيارة", "Curbside")}
                  </span>
                )}
                {branch.allowTableOrders !== false && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">
                    🪑 {tc("طاولة", "Table")}
                  </span>
                )}
              </div>

              {/* Map button */}
              {branch.location && (
                <a
                  href={`https://www.google.com/maps?q=${branch.location.lat},${branch.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-primary/20 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
                  data-testid={`link-branch-map-${branch.id}`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {tc("عرض على خرائط جوجل", "Open in Google Maps")}
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Show more / less */}
        {branchesWithDistance.length > 1 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            data-testid="button-toggle-branches"
          >
            {isExpanded ? (
              <><ChevronUp className="w-4 h-4" />{tc("عرض أقل", "Show Less")}</>
            ) : (
              <><ChevronDown className="w-4 h-4" />{tc(`عرض كل الفروع (${branchesWithDistance.length})`, `View All Branches (${branchesWithDistance.length})`)}</>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

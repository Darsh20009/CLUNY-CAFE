import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Check, X, Navigation, Store, Coffee, Map } from "lucide-react";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
import { DELIVERY_ZONES, getZoneForLocation, type DeliveryZone } from "@shared/zones";
import type { Branch } from "@shared/schema";
import AppleMap, { MapLocation } from "@/components/apple-map";

const PICKUP_RADIUS_METERS = 100000;

interface BranchWithDistance {
  branch: Branch;
  distanceMeters: number;
  isInRange: boolean;
}

function calculateDistanceMeters(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function checkPickupAvailability(
  userLocation: { lat: number; lng: number },
  branches: Branch[]
): {
  canPickup: boolean;
  nearestBranch: Branch | null;
  distanceMeters: number;
  allBranchesWithDistance: BranchWithDistance[];
} {
  if (!branches || branches.length === 0) {
    return { canPickup: false, nearestBranch: null, distanceMeters: 0, allBranchesWithDistance: [] };
  }
  const branchesWithDistance: BranchWithDistance[] = branches
    .filter((b) => b.location && b.location.lat && b.location.lng)
    .map((branch) => {
      const branchPoint = { lat: branch.location!.lat, lng: branch.location!.lng };
      const distanceMeters = calculateDistanceMeters(userLocation, branchPoint);
      return { branch, distanceMeters, isInRange: distanceMeters <= PICKUP_RADIUS_METERS };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (branchesWithDistance.length === 0) {
    return { canPickup: false, nearestBranch: null, distanceMeters: 0, allBranchesWithDistance: [] };
  }
  const nearest = branchesWithDistance[0];
  const inRangeBranches = branchesWithDistance.filter((b) => b.isInRange);
  if (inRangeBranches.length > 0) {
    return { canPickup: true, nearestBranch: inRangeBranches[0].branch, distanceMeters: Math.round(inRangeBranches[0].distanceMeters), allBranchesWithDistance: branchesWithDistance };
  }
  return { canPickup: false, nearestBranch: nearest.branch, distanceMeters: Math.round(nearest.distanceMeters), allBranchesWithDistance: branchesWithDistance };
}

interface MapAddressSelectorProps {
  onAddressSelected: (address: {
    fullAddress: string;
    lat: number;
    lng: number;
    zone: string;
    orderType?: "delivery" | "pickup";
    branchId?: string;
    branchName?: string;
  }) => void;
  onCancel: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapAddressSelector({ onAddressSelected, onCancel }: MapAddressSelectorProps) {
  const tc = useTranslate();
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [pickupInfo, setPickupInfo] = useState<ReturnType<typeof checkPickupAvailability> | null>(null);
  const [address, setAddress] = useState("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedOrderType, setSelectedOrderType] = useState<"delivery" | "pickup" | null>(null);

  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  const handleGetCurrentLocation = () => {
    setIsLoadingLocation(true);
    if (!navigator.geolocation) {
      alert(tc("المتصفح لا يدعم تحديد الموقع الجغرافي", "Browser does not support geolocation"));
      setIsLoadingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        setSelectedZone(getZoneForLocation(newPos));
        setPickupInfo(checkPickupAvailability(newPos, branches));
        setIsLoadingLocation(false);
      },
      (error) => {
        let errorMessage = "فشل في تحديد الموقع";
        if (error.code === error.PERMISSION_DENIED) errorMessage = "يرجى السماح بالوصول إلى الموقع من إعدادات التطبيق";
        else if (error.code === error.POSITION_UNAVAILABLE) errorMessage = "الموقع غير متاح حالياً";
        else if (error.code === error.TIMEOUT) errorMessage = "انتهت مهلة تحديد الموقع، يرجى المحاولة مرة أخرى";
        alert(errorMessage);
        setIsLoadingLocation(false);
      }
    );
  };

  const handleLocationPick = (lat: number, lng: number) => {
    const newPos = { lat, lng };
    setPosition(newPos);
    setSelectedZone(getZoneForLocation(newPos));
    setPickupInfo(checkPickupAvailability(newPos, branches));
  };

  const canDelivery = selectedZone !== null;
  const canPickup = pickupInfo?.canPickup ?? false;

  useEffect(() => {
    if (position) {
      if (canDelivery && !canPickup) setSelectedOrderType("delivery");
      else if (!canDelivery && canPickup) setSelectedOrderType("pickup");
      else if (!canDelivery && !canPickup) setSelectedOrderType(null);
    }
  }, [canDelivery, canPickup, position]);

  const handleConfirm = () => {
    if (!position) return;
    if (selectedOrderType === "delivery" && selectedZone) {
      onAddressSelected({
        fullAddress: address || `${selectedZone.nameAr}`,
        lat: position.lat, lng: position.lng,
        zone: selectedZone.nameAr, orderType: "delivery",
      });
    } else if (selectedOrderType === "pickup" && pickupInfo?.nearestBranch) {
      onAddressSelected({
        fullAddress: address || `استلام من فرع ${pickupInfo.nearestBranch.nameAr}`,
        lat: position.lat, lng: position.lng,
        zone: pickupInfo.nearestBranch.nameAr, orderType: "pickup",
        branchId: (pickupInfo.nearestBranch as any).id?.toString() || "",
        branchName: pickupInfo.nearestBranch.nameAr,
      });
    }
  };

  // Build pins for branch markers
  const branchPins: MapLocation[] = (branches as Branch[])
    .filter((b) => b.location?.lat && b.location?.lng)
    .map((b) => ({
      lat: b.location!.lat,
      lng: b.location!.lng,
      label: b.nameAr || b.nameEn || "فرع",
      color: "#f97316",
    }));

  const mapCenter = position
    ? { lat: position.lat, lng: position.lng, label: "موقعك", color: "#22c55e" }
    : { lat: 24.7093, lng: 46.6802 };

  return (
    <div className="space-y-4" data-testid="map-address-selector">
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-2">
            <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold">حدد موقعك</p>
              <p className="text-xs text-muted-foreground">
                اضغط على الخريطة لاختيار موقعك أو استخدم زر تحديد الموقع الحالي
              </p>
            </div>
          </div>

          {position && (
            <div className="space-y-3">
              {canDelivery && (
                <div
                  className={`border-2 rounded-lg p-3 flex items-start gap-2 cursor-pointer transition-all ${
                    selectedOrderType === "delivery"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-500"
                      : "bg-muted/50 border-muted hover-elevate"
                  }`}
                  onClick={() => setSelectedOrderType("delivery")}
                  data-testid="option-delivery"
                >
                  <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selectedOrderType === "delivery" ? "text-green-600" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className={`font-semibold ${selectedOrderType === "delivery" ? "text-green-700 dark:text-green-400" : ""}`}>
                      توصيل — {selectedZone?.nameAr}
                    </p>
                    <p className={`text-sm mt-1 ${selectedOrderType === "delivery" ? "text-green-600 dark:text-green-300" : "text-muted-foreground"}`}>
                      رسوم التوصيل: {selectedZone?.deliveryFee} <SarIcon size={12} />
                    </p>
                  </div>
                </div>
              )}

              {canPickup && pickupInfo?.nearestBranch && (
                <div
                  className={`border-2 rounded-lg p-3 flex items-start gap-2 cursor-pointer transition-all ${
                    selectedOrderType === "pickup"
                      ? "bg-orange-50 dark:bg-orange-900/20 border-orange-500"
                      : "bg-muted/50 border-muted hover-elevate"
                  }`}
                  onClick={() => setSelectedOrderType("pickup")}
                  data-testid="option-pickup"
                >
                  <Coffee className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selectedOrderType === "pickup" ? "text-orange-600" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className={`font-semibold ${selectedOrderType === "pickup" ? "text-orange-700 dark:text-orange-400" : ""}`}>
                      استلام من الفرع — {pickupInfo.nearestBranch.nameAr}
                    </p>
                    <p className={`text-sm mt-1 ${selectedOrderType === "pickup" ? "text-orange-600 dark:text-orange-300" : "text-muted-foreground"}`}>
                      على بعد {pickupInfo.distanceMeters} متر — بدون رسوم توصيل
                    </p>
                  </div>
                </div>
              )}

              {!canDelivery && !canPickup && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 rounded-lg p-3 flex items-start gap-2 cursor-pointer"
                     onClick={() => setSelectedOrderType("pickup")}>
                  <Coffee className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-orange-700 dark:text-orange-400">استلام من الفرع (خارج النطاق المعتاد)</p>
                    <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                      {pickupInfo?.nearestBranch
                        ? `أقرب فرع: ${pickupInfo.nearestBranch.nameAr} — على بعد ${pickupInfo.distanceMeters} متر`
                        : "يمكنك اختيار الفرع والمتابعة للاستلام"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGetCurrentLocation}
        disabled={isLoadingLocation}
        data-testid="button-get-current-location"
      >
        <Navigation className="w-4 h-4 ml-2" />
        {isLoadingLocation ? "جاري تحديد الموقع..." : "استخدام موقعي الحالي 📍"}
      </Button>

      {/* Apple MapKit JS embedded map — unified for all platforms */}
      <div className="h-64 rounded-lg overflow-hidden border-2 border-border" data-testid="map-container">
        <AppleMap
          mode="pick"
          center={mapCenter}
          pins={branchPins}
          height="256px"
          interactive={true}
          onLocationPick={handleLocationPick}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">العنوان التفصيلي (اختياري)</label>
        <Input
          placeholder="مثال: شارع الأمير سلطان، مبنى 123"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          data-testid="input-detailed-address"
        />
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={handleConfirm}
          disabled={!position}
          data-testid="button-confirm-address"
        >
          <Check className="w-4 h-4 ml-2" />
          تأكيد {selectedOrderType === "pickup" ? "الاستلام" : "التوصيل"}
        </Button>
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-address">
          إلغاء
        </Button>
      </div>

      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-green-500/30 border border-green-500" />
            <p className="text-xs text-muted-foreground">موقعك المحدد</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500/30 border border-orange-500" />
            <p className="text-xs text-muted-foreground">الفروع</p>
          </div>
        </div>
      </div>
    </div>
  );
}

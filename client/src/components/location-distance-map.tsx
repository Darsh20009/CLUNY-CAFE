import AppleMap, { MapLocation } from "@/components/apple-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { buildDirectionsUrl } from "@/components/apple-maps-view";

interface LocationDistanceMapProps {
  userLocation: { lat: number; lng: number };
  branchLocation: { lat: number; lng: number };
  distance: number;
  mapsUrl?: string;
  onClose?: () => void;
  allBranches?: Array<{ id: string; lat: number; lng: number; nameAr: string }>;
  selectedBranchId?: string;
}

export default function LocationDistanceMap({
  userLocation,
  branchLocation,
  distance,
  mapsUrl,
  onClose,
  allBranches,
  selectedBranchId,
}: LocationDistanceMapProps) {
  const getDistanceText = () => {
    if (distance < 1000) return `${distance} متر`;
    return `${(distance / 1000).toFixed(1)} كم`;
  };

  // Build pins list
  const userPin: MapLocation = {
    lat: userLocation.lat,
    lng: userLocation.lng,
    label: "موقعك",
    color: "#3b82f6",
  };

  const branchPin: MapLocation = {
    lat: branchLocation.lat,
    lng: branchLocation.lng,
    label: "الفرع",
    color: "#c41a2e",
  };

  const extraBranchPins: MapLocation[] = (allBranches || [])
    .filter((b) => b.id !== selectedBranchId)
    .map((b) => ({
      lat: b.lat,
      lng: b.lng,
      label: b.nameAr,
      color: "#6b7280",
    }));

  const directionsUrl = mapsUrl || buildDirectionsUrl(branchLocation.lat, branchLocation.lng);

  return (
    <>
      <div className="h-80 rounded-2xl overflow-hidden shadow-2xl">
        <AppleMap
          mode="route"
          origin={userPin}
          destination={branchPin}
          pins={extraBranchPins}
          height="320px"
          showDirectionsButton={false}
          interactive={true}
        />
      </div>

      {/* Distance badge + directions */}
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{getDistanceText()}</span>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Navigation className="w-3.5 h-3.5" />
          الاتجاهات في خرائط Apple
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </>
  );
}

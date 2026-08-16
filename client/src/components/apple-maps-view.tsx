/**
 * apple-maps-view.tsx
 *
 * On iOS native (Capacitor), renders an Apple Maps button instead of an
 * embedded Leaflet/Google map. On web, falls back to a plain Leaflet map link.
 *
 * Usage:
 *   <AppleMapsView lat={24.7} lng={46.7} label="الفرع الرئيسي" />
 */

import { MapPin, Navigation } from "lucide-react";
import { isCapacitorNative } from "@/lib/server-url";
import { isIOS } from "@/lib/platform";
import { useTranslate } from "@/lib/useTranslate";
import AppleMap from "@/components/apple-map";

interface AppleMapsViewProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
  /** Show an embedded thumbnail (Leaflet static tile) on web only */
  showEmbeddedOnWeb?: boolean;
}

/**
 * Build a maps URL appropriate for the current platform.
 * - iOS native → Apple Maps deep link (maps://...)
 * - Android native → Google Maps URL
 * - Web → Google Maps web link
 */
export function buildMapsUrl(lat: number, lng: number, label?: string): string {
  const encoded = label ? encodeURIComponent(label) : "";
  if (isCapacitorNative() && isIOS()) {
    return `maps://maps.apple.com/?q=${encoded}&ll=${lat},${lng}&z=16`;
  }
  // Fallback: Google Maps (works in Android WebView + web browser)
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Opens the location in Apple Maps (iOS) or Google Maps (Android/web). */
export function openInMaps(lat: number, lng: number, label?: string): void {
  const url = buildMapsUrl(lat, lng, label);
  window.open(url, "_blank");
}

/** Directions URL — navigates FROM current location TO the destination. */
export function buildDirectionsUrl(lat: number, lng: number): string {
  if (isCapacitorNative() && isIOS()) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function openDirections(lat: number, lng: number): void {
  const url = buildDirectionsUrl(lat, lng);
  window.open(url, "_blank");
}

/**
 * A map card component that shows location info and opens in Apple/Google Maps.
 */
export function AppleMapsView({ lat, lng, label, className = "" }: AppleMapsViewProps) {
  const tc = useTranslate();
  const mapsUrl = buildMapsUrl(lat, lng, label);
  const directionsUrl = buildDirectionsUrl(lat, lng);
  const isNative = isCapacitorNative();
  const ios = isIOS();

  return (
    <div
      className={`rounded-xl border border-gray-200 overflow-hidden bg-gray-50 ${className}`}
      dir="rtl"
    >
      {/* Embedded Apple Map — on web only */}
      {!isNative && (
        <AppleMap
          mode="view"
          center={{ lat, lng, label }}
          height="144px"
          showZoomControls={false}
          showDirectionsButton={false}
          interactive={false}
          className="rounded-none rounded-t-xl"
        />
      )}

      {/* Location info + action buttons */}
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-gray-800 truncate">
            {label || tc("موقع", "Location")}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <a
            href={directionsUrl}
            target={isNative ? "_self" : "_blank"}
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition"
            data-testid="button-get-directions"
          >
            <Navigation className="w-3.5 h-3.5" />
            {tc("الاتجاهات", "Directions")}
          </a>
          <a
            href={mapsUrl}
            target={isNative ? "_self" : "_blank"}
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100 transition"
            data-testid="button-open-maps"
          >
            <MapPin className="w-3.5 h-3.5" />
            {ios ? tc("خرائط أبل", "Apple Maps") : tc("خرائط", "Maps")}
          </a>
        </div>
      </div>
    </div>
  );
}

export default AppleMapsView;

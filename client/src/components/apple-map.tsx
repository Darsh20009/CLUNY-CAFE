/**
 * apple-map.tsx
 * Universal Apple Maps React component backed by MapKit JS.
 *
 * Modes:
 *   "view"   — static view of a single location with a pin
 *   "pick"   — interactive, user taps/clicks to choose a point
 *   "route"  — shows two points (origin + destination) with a dashed line
 *
 * All Leaflet / react-leaflet maps in this project are replaced with this component.
 */

import { useEffect, useRef, useState } from "react";
import { loadMapKit } from "@/lib/mapkit-js";
import { MapPin, Navigation, Loader2, AlertTriangle } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";
import { buildDirectionsUrl } from "@/components/apple-maps-view";

// ─── Prop types ──────────────────────────────────────────────────────────────

export interface MapLocation {
  lat: number;
  lng: number;
  label?: string;
  color?: string; // CSS hex string e.g. "#22c55e"
}

type MapMode = "view" | "pick" | "route";

interface AppleMapProps {
  mode?: MapMode;
  center?: MapLocation;
  /** For "route" mode: the origin point */
  origin?: MapLocation;
  /** For "route" mode: the destination point */
  destination?: MapLocation;
  /** Additional static pins */
  pins?: MapLocation[];
  height?: string;
  className?: string;
  showDirectionsButton?: boolean;
  showZoomControls?: boolean;
  /** Called when user picks a location (mode="pick") */
  onLocationPick?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AppleMap({
  mode = "view",
  center,
  origin,
  destination,
  pins = [],
  height = "240px",
  className = "",
  showDirectionsButton = false,
  showZoomControls = true,
  onLocationPick,
  interactive = true,
}: AppleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const annotationsRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tc = useTranslate();

  const mainLat = center?.lat ?? origin?.lat ?? destination?.lat ?? 24.7136;
  const mainLng = center?.lng ?? origin?.lng ?? destination?.lng ?? 46.6753;

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mk: any;
    let map: any;

    async function init() {
      if (!containerRef.current) return;
      try {
        mk = await loadMapKit();
        setLoading(false);

        const coord = new mk.Coordinate(mainLat, mainLng);
        const region = new mk.CoordinateRegion(
          coord,
          new mk.CoordinateSpan(0.02, 0.02)
        );

        map = new mk.Map(containerRef.current, {
          region,
          showsZoomControl: showZoomControls,
          showsMapTypeControl: false,
          showsCompass: mk.FeatureVisibility.Hidden,
          isScrollEnabled: interactive,
          isZoomEnabled: interactive,
          isRotationEnabled: false,
          mapType: mk.Map.MapTypes.Standard,
        });

        mapRef.current = map;

        // ── Add pins ─────────────────────────────────────────────────────
        const allPins: MapLocation[] = [];
        if (center) allPins.push(center);
        if (origin) allPins.push(origin);
        if (destination) allPins.push(destination);
        allPins.push(...pins);

        for (const pin of allPins) {
          const pinCoord = new mk.Coordinate(pin.lat, pin.lng);
          const ann = new mk.MarkerAnnotation(pinCoord, {
            title: pin.label || "",
            color: pin.color || "#c41a2e",
            glyphText: pin.color === "#0ea5e9" ? "🚗" : undefined,
          });
          map.addAnnotation(ann);
          annotationsRef.current.push(ann);
        }

        // ── Route line (dashed) ───────────────────────────────────────────
        if (mode === "route" && origin && destination) {
          const pts = [
            new mk.Coordinate(origin.lat, origin.lng),
            new mk.Coordinate(destination.lat, destination.lng),
          ];
          const style = new mk.Style({
            strokeColor: "#0ea5e9",
            lineWidth: 3,
            lineDash: [6, 6],
          });
          const line = new mk.PolylineOverlay(pts, { style });
          map.addOverlay(line);
          overlaysRef.current.push(line);

          // Fit both points in view
          const padding = new mk.Padding(60, 40, 60, 40);
          map.showItems([...annotationsRef.current], { padding });
        }

        // ── Pick mode: listen for click ───────────────────────────────────
        if (mode === "pick" && onLocationPick) {
          map.element.addEventListener("click", (e: MouseEvent) => {
            const rect = map.element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const coord = map.convertPointOnPageToCoordinate(
              new DOMPoint(e.clientX, e.clientY)
            );
            if (coord) {
              onLocationPick(coord.latitude, coord.longitude);
              // Update or replace the pick marker
              map.removeAnnotations(annotationsRef.current);
              annotationsRef.current = [];
              const picked = new mk.MarkerAnnotation(coord, {
                title: tc("موقع محدد", "Selected"),
                color: "#c41a2e",
              });
              map.addAnnotation(picked);
              annotationsRef.current.push(picked);
            }
          });
        }
      } catch (err: any) {
        console.error("[AppleMap] Init failed:", err);
        setError(err.message || "Failed to load map");
        setLoading(false);
      }
    }

    init();

    return () => {
      if (mapRef.current) {
        try { mapRef.current.destroy(); } catch {}
        mapRef.current = null;
        annotationsRef.current = [];
        overlaysRef.current = [];
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update driver marker in route mode ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mode !== "route" || !origin || !destination) return;
    const mk = window.mapkit;
    if (!mk) return;
    try {
      // Remove old
      mapRef.current.removeAnnotations(annotationsRef.current);
      mapRef.current.removeOverlays(overlaysRef.current);
      annotationsRef.current = [];
      overlaysRef.current = [];

      const allPins = [origin, destination, ...pins];
      for (const pin of allPins) {
        const coord = new mk.Coordinate(pin.lat, pin.lng);
        const ann = new mk.MarkerAnnotation(coord, {
          title: pin.label || "",
          color: pin.color || "#c41a2e",
        });
        mapRef.current.addAnnotation(ann);
        annotationsRef.current.push(ann);
      }
      // Re-draw route line
      const pts = [
        new mk.Coordinate(origin.lat, origin.lng),
        new mk.Coordinate(destination.lat, destination.lng),
      ];
      const style = new mk.Style({ strokeColor: "#0ea5e9", lineWidth: 3, lineDash: [6, 6] });
      const line = new mk.PolylineOverlay(pts, { style });
      mapRef.current.addOverlay(line);
      overlaysRef.current.push(line);
      const padding = new mk.Padding(60, 40, 60, 40);
      mapRef.current.showItems([...annotationsRef.current], { padding });
    } catch {}
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const directionsUrl = destination
    ? buildDirectionsUrl(destination.lat, destination.lng)
    : center
    ? buildDirectionsUrl(center.lat, center.lng)
    : "#";

  return (
    <div className={`relative rounded-xl overflow-hidden bg-gray-100 ${className}`} style={{ height }}>
      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
          <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
          <p className="text-xs text-gray-500">{tc("تحميل الخريطة...", "Loading map...")}</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 gap-2">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <p className="text-xs text-gray-500 text-center px-4">
            {tc("تعذّر تحميل الخريطة", "Map unavailable")}
          </p>
          {directionsUrl !== "#" && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium"
            >
              <Navigation className="w-3.5 h-3.5" />
              {tc("فتح في خرائط Apple", "Open in Apple Maps")}
            </a>
          )}
        </div>
      )}

      {/* MapKit JS canvas */}
      <div ref={containerRef} className="w-full h-full" style={{ display: loading || error ? "none" : "block" }} />

      {/* Directions overlay button */}
      {showDirectionsButton && !loading && !error && directionsUrl !== "#" && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-2 bg-white/90 backdrop-blur-sm text-gray-800 rounded-xl shadow-lg text-xs font-medium hover:bg-white transition border border-gray-200"
          data-testid="button-map-directions"
        >
          <Navigation className="w-3.5 h-3.5 text-primary" />
          {tc("الاتجاهات", "Directions")}
        </a>
      )}
    </div>
  );
}

export default AppleMap;

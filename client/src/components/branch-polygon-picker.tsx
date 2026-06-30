import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Trash2, Undo2, CheckCircle } from 'lucide-react';
import AppleMap, { MapLocation } from '@/components/apple-map';

interface PolygonPickerProps {
  initialPoints?: Array<{ lat: number; lng: number }>;
  centerLat?: number;
  centerLng?: number;
  onBoundaryChange: (points: Array<{ lat: number; lng: number }>) => void;
}

const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 };

export default function BranchPolygonPicker({
  initialPoints = [],
  centerLat,
  centerLng,
  onBoundaryChange,
}: PolygonPickerProps) {
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>(initialPoints);
  const [mapCenter, setMapCenter] = useState({
    lat: centerLat || DEFAULT_CENTER.lat,
    lng: centerLng || DEFAULT_CENTER.lng,
  });

  useEffect(() => {
    if (initialPoints.length > 0) setPoints(initialPoints);
  }, [initialPoints]);

  useEffect(() => {
    if (centerLat && centerLng) setMapCenter({ lat: centerLat, lng: centerLng });
  }, [centerLat, centerLng]);

  useEffect(() => {
    onBoundaryChange(points);
  }, [points, onBoundaryChange]);

  const handlePick = useCallback((lat: number, lng: number) => {
    const newPoints = [...points, { lat, lng }];
    setPoints(newPoints);
  }, [points]);

  const handleUndo = () => setPoints(points.slice(0, -1));
  const handleClear = () => setPoints([]);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => alert('لم نستطع الحصول على موقعك الحالي')
      );
    }
  };

  const polygonPins: MapLocation[] = points.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    label: `#${i + 1}`,
    color: '#2D9B6E',
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-foreground">ارسم حدود الفرع (اضغط لإضافة نقاط)</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation}>
            <Navigation className="w-4 h-4 ml-1" />
            موقعي
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={points.length === 0}>
            <Undo2 className="w-4 h-4 ml-1" />
            تراجع
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={handleClear} disabled={points.length === 0}>
            <Trash2 className="w-4 h-4 ml-1" />
            مسح
          </Button>
        </div>
      </div>

      <AppleMap
        mode="pick"
        center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
        pins={polygonPins}
        height="320px"
        className="border border-border"
        onLocationPick={handlePick}
      />

      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
        <div className="flex items-start gap-2">
          <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-foreground font-medium">تعليمات الرسم:</p>
            <ul className="text-muted-foreground text-xs space-y-1 mt-1">
              <li>• اضغط على الخريطة لإضافة نقاط الحدود</li>
              <li>• تحتاج 3 نقاط على الأقل لتكوين شكل</li>
              <li>• النقاط تتصل تلقائياً لتشكيل الحدود</li>
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {points.length >= 3 ? (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              {points.length} نقاط
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">{points.length}/3 نقاط</span>
          )}
        </div>
      </div>
    </div>
  );
}

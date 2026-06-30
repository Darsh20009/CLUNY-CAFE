import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation } from 'lucide-react';
import AppleMap from '@/components/apple-map';

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function BranchLocationPicker({ initialLat, initialLng, onLocationSelect }: LocationPickerProps) {
  const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 };

  const [position, setPosition] = useState({
    lat: initialLat || DEFAULT_CENTER.lat,
    lng: initialLng || DEFAULT_CENTER.lng,
  });

  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition({ lat: initialLat, lng: initialLng });
    }
  }, [initialLat, initialLng]);

  useEffect(() => {
    onLocationSelect(position.lat, position.lng);
  }, [position, onLocationSelect]);

  const handleManualInput = (lat: number, lng: number) => {
    setPosition({ lat, lng });
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          alert('لم نستطع الحصول على موقعك الحالي. تأكد من تفعيل خدمات الموقع.');
        }
      );
    } else {
      alert('متصفحك لا يدعم خدمات تحديد الموقع');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">حدد موقع الفرع على الخريطة</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          className="border-primary/50 text-primary hover:bg-primary/10"
        >
          <Navigation className="w-4 h-4 ml-1" />
          موقعي الحالي
        </Button>
      </div>

      <AppleMap
        mode="pick"
        center={{ lat: position.lat, lng: position.lng, label: "موقع الفرع" }}
        height="256px"
        className="border border-primary/30"
        onLocationPick={(lat, lng) => setPosition({ lat, lng })}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="lat" className="text-gray-300 text-sm">خط العرض (Latitude)</Label>
          <Input
            id="lat"
            type="number"
            step="0.0001"
            value={position.lat}
            onChange={(e) => handleManualInput(parseFloat(e.target.value) || 0, position.lng)}
            className="bg-[#1a1410] border-amber-500/30 text-white"
            dir="ltr"
          />
        </div>
        <div>
          <Label htmlFor="lng" className="text-gray-300 text-sm">خط الطول (Longitude)</Label>
          <Input
            id="lng"
            type="number"
            step="0.0001"
            value={position.lng}
            onChange={(e) => handleManualInput(position.lat, parseFloat(e.target.value) || 0)}
            className="bg-[#1a1410] border-amber-500/30 text-white"
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-primary font-medium">كيفية تحديد الموقع:</p>
          <ul className="text-gray-300 text-xs space-y-1 mt-1">
            <li>• اضغط على الخريطة لتحديد الموقع</li>
            <li>• أو أدخل الإحداثيات يدويًا</li>
            <li>• أو استخدم موقعك الحالي</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

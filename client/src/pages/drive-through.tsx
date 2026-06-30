import { useEffect } from "react";
import { useLocation } from "wouter";
import { Car } from "lucide-react";

export default function DriveThroughPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    try {
      sessionStorage.setItem("qirox_car_pickup_mode", "1");
    } catch {}
    setLocation("/delivery");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center text-white space-y-4">
        <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
          <Car className="w-8 h-8 text-black" />
        </div>
        <p className="text-amber-400 font-bold text-lg">جارٍ التوجيه لطلب السيارة...</p>
      </div>
    </div>
  );
}

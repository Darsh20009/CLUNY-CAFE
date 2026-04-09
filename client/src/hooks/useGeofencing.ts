import { useEffect, useRef } from "react";

interface GeofenceBranch {
  id: string;
  nameAr: string;
  nameEn?: string;
  lat: number;
  lng: number;
  radius: number;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes per branch
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // check every 3 minutes

function getLastNotified(branchId: string): number {
  try {
    return Number(localStorage.getItem(`geofence_notified_${branchId}`) || 0);
  } catch {
    return 0;
  }
}

function setLastNotified(branchId: string) {
  try {
    localStorage.setItem(`geofence_notified_${branchId}`, String(Date.now()));
  } catch {}
}

export function useGeofencing(customerId?: string) {
  const branchesRef = useRef<GeofenceBranch[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!customerId) return;
    if (!("geolocation" in navigator)) return;

    // Fetch branch locations once
    fetch("/api/geofence/branches")
      .then(r => r.json())
      .then((data: GeofenceBranch[]) => {
        branchesRef.current = data || [];
      })
      .catch(() => {});

    const checkLocation = () => {
      if (branchesRef.current.length === 0) return;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const now = Date.now();

          for (const branch of branchesRef.current) {
            const dist = haversineDistance(latitude, longitude, branch.lat, branch.lng);
            const radius = branch.radius || 100;

            if (dist <= radius) {
              const lastNotified = getLastNotified(branch.id);
              if (now - lastNotified > COOLDOWN_MS) {
                setLastNotified(branch.id);
                fetch("/api/geofence/notify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    customerId,
                    branchId: branch.id,
                    branchName: branch.nameAr
                  })
                }).catch(() => {});
                break; // only notify for one branch at a time
              }
            }
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    // First check after 10 seconds (give user time to settle)
    const firstCheck = setTimeout(checkLocation, 10000);
    intervalRef.current = setInterval(checkLocation, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(firstCheck);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [customerId]);
}

/**
 * native-app-init.tsx
 *
 * Mounted once inside the router — initialises all native iOS features:
 *   1. APNs push notification registration
 *   2. iOS Home Screen Quick Action deep-link handling
 *
 * This component renders nothing visible.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { isCapacitorNative } from "@/lib/server-url";
import { registerNativePush } from "@/lib/native-push";
import { initIOSShortcuts } from "@/lib/ios-shortcuts";

export function NativeAppInit() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    // Register for APNs push notifications
    registerNativePush();

    // Wire up iOS Home Screen Quick Actions (long-press shortcuts)
    initIOSShortcuts((path) => setLocation(path));
  }, [setLocation]);

  return null;
}

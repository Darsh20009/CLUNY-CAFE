/**
 * native-push.ts
 * Handles APNs (Apple Push Notifications) registration for the native iOS app.
 * On web / PWA the existing VAPID/web-push flow is used instead.
 */

import { isCapacitorNative } from "@/lib/server-url";
import { apiUrl } from "@/lib/server-url";

let _registered = false;

/** Register for APNs push notifications and store the device token on the server. */
export async function registerNativePush(): Promise<void> {
  if (!isCapacitorNative()) return;
  if (_registered) return;
  _registered = true;

  try {
    const { PushNotifications } = await import(/* @vite-ignore */ "@capacitor/push-notifications");

    // Check / request permission
    const permResult = await PushNotifications.checkPermissions();
    if (permResult.receive === "prompt" || permResult.receive === "prompt-with-rationale") {
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== "granted") {
        console.info("[NativePush] Permission denied");
        return;
      }
    } else if (permResult.receive !== "granted") {
      console.info("[NativePush] Permission not granted");
      return;
    }

    // Register with APNs
    await PushNotifications.register();

    // Listen for registration success → send token to server
    PushNotifications.addListener("registration", async (token) => {
      console.info("[NativePush] Got device token:", token.value.slice(0, 16) + "...");
      await saveTokenToServer(token.value);
    });

    // Listen for registration error
    PushNotifications.addListener("registrationError", (err) => {
      console.error("[NativePush] Registration error:", err.error);
    });

    // Handle foreground push notifications
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.info("[NativePush] Foreground notification:", notification.title);
      // Dispatch a custom DOM event so components can react
      window.dispatchEvent(
        new CustomEvent("nativePushReceived", { detail: notification })
      );
    });

    // Handle notification tap (app was in background)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data as Record<string, string> | undefined;
      if (data?.orderPath) {
        // Navigate to order tracking page
        window.location.hash = data.orderPath;
      }
    });
  } catch (err) {
    console.error("[NativePush] Init failed:", err);
  }
}

/** Send the APNs device token to the server for storage. */
async function saveTokenToServer(token: string): Promise<void> {
  try {
    const phone = localStorage.getItem("customerPhone") || "";
    const employeeId = localStorage.getItem("employeeId") || "";
    await fetch(apiUrl("/api/push/register-device"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: "ios", phone, employeeId }),
      credentials: "include",
    });
  } catch (err) {
    console.warn("[NativePush] Failed to save token:", err);
  }
}

/** Remove the APNs device token from the server (on logout). */
export async function unregisterNativePush(token?: string): Promise<void> {
  if (!token) return;
  try {
    await fetch(apiUrl("/api/push/unregister-device"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include",
    });
  } catch {}
}

import { useState, useEffect, useCallback, useRef } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface UseNotificationsOptions {
  userType: 'employee' | 'customer';
  userId?: string;
  branchId?: string;
  autoSubscribe?: boolean;
}

export function useNotifications(options?: UseNotificationsOptions) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.error('SW registration failed:', error);
      return null;
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const registration = await registerServiceWorker();
      if (!registration) {
        setIsLoading(false);
        return;
      }

      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        subscriptionRef.current = existingSub;
        setIsSubscribed(true);
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: existingSub.toJSON(),
            userType: options?.userType || 'customer',
            userId: options?.userId || 'anonymous',
            branchId: options?.branchId,
          }),
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/push/vapid-key');
      const { publicKey } = await response.json();

      if (!publicKey) {
        console.error('No VAPID public key available');
        setIsLoading(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      subscriptionRef.current = subscription;

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userType: options?.userType || 'customer',
          userId: options?.userId || 'anonymous',
          branchId: options?.branchId,
        }),
      });

      setIsSubscribed(true);
      console.log('[Push] Successfully subscribed');
    } catch (error) {
      console.error('[Push] Subscription failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [options?.userType, options?.userId, options?.branchId, isLoading, registerServiceWorker]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      if (subscriptionRef.current) {
        const endpoint = subscriptionRef.current.endpoint;
        await subscriptionRef.current.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
        subscriptionRef.current = null;
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      await subscribeToPush();
    }
    return result;
  }, [subscribeToPush]);

  const sendNotification = useCallback((title: string, notifOptions?: NotificationOptions) => {
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/logo.png',
          badge: '/favicon.png',
          ...({ vibrate: [200, 100, 200] } as any),
          ...notifOptions,
        });
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const checkExisting = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          subscriptionRef.current = existingSub;
          setIsSubscribed(true);
          if (options?.userId) {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: existingSub.toJSON(),
                userType: options?.userType || 'customer',
                userId: options?.userId,
                branchId: options?.branchId,
              }),
            }).catch(() => {});
          }
        }
      } catch (e) {
        // silently ignore
      }
    };
    checkExisting();
  }, [options?.userId, options?.userType, options?.branchId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    if (permission === 'granted' && options?.autoSubscribe && options?.userId) {
      subscribeToPush();
    }
  }, [permission, options?.autoSubscribe, options?.userId]);

  return {
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendNotification,
  };
}

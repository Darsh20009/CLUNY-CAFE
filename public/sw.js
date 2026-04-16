// CLUNY CAFE Service Worker - Handles push notifications and offline caching

const CACHE_NAME = 'cluny-cafe-v3';

// Install: cache essential assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/logo.png', '/manifest.json']).catch(() => {});
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Push notification handler - this fires on Android and iOS PWA
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'CLUNY CAFE', body: event.data ? event.data.text() : 'إشعار جديد' };
  }

  const title = data.title || 'CLUNY CAFE';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'cluny-notification',
    requireInteraction: data.requireInteraction !== false,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/employee/orders',
      ...data,
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || '/employee/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(url);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Background sync (for offline order queuing if needed)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    // Future: sync queued offline orders
  }
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and API requests (let them go to network)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // Skip Vite dev server paths (HMR, module imports, etc.) - never cache these
  if (
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.searchParams.has('t') ||
    url.searchParams.has('import') ||
    url.pathname.startsWith('/__')
  ) {
    return;
  }

  // For static image/font assets only: cache-first (not JS/CSS which change in dev)
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // For HTML pages: network-first with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

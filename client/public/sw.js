const CACHE_VERSION = 'v10';
const CACHE_NAME = `cluny-cache-${CACHE_VERSION}`;

// Essential shell files to pre-cache during install
// Vite-built assets (JS/CSS bundles) are cached at runtime via the fetch handler
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/employee-manifest.json',
  '/logo.png',
  '/employee-logo.png',
  '/favicon.ico',
  '/favicon.png',
  '/badge-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('[SW] Cache addAll error (non-fatal):', err);
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(e => console.log('[SW] Failed to cache:', url, e)))
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('cluny-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

const STATUS_CONFIG = {
  pending: {
    emoji: '🕐',
    labelAr: 'تم استلام الطلب',
    labelEn: 'Order Received',
    color: '#F59E0B',
  },
  payment_confirmed: {
    emoji: '✅',
    labelAr: 'تم تأكيد الدفع',
    labelEn: 'Payment Confirmed',
    color: '#10B981',
  },
  in_progress: {
    emoji: '☕',
    labelAr: 'جاري التحضير',
    labelEn: 'Preparing',
    color: '#3B82F6',
  },
  ready: {
    emoji: '🎉',
    labelAr: 'طلبك جاهز!',
    labelEn: 'Order Ready!',
    color: '#22C55E',
  },
  completed: {
    emoji: '✨',
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    color: '#8B5CF6',
  },
  cancelled: {
    emoji: '❌',
    labelAr: 'تم الإلغاء',
    labelEn: 'Cancelled',
    color: '#EF4444',
  },
};

const ORDER_TYPE_LABELS = {
  'dine_in': '🍽️ محلي',
  'dine-in': '🍽️ محلي',
  'takeaway': '🥤 سفري',
  'pickup': '🥤 سفري',
  'car_pickup': '🚗 سيارة',
  'car-pickup': '🚗 سيارة',
  'delivery': '🚚 توصيل',
};

function buildOrderStatusNotification(data) {
  const status = data.orderStatus || 'pending';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const orderNum = data.orderNumber || '---';
  const isEmployee = data.url && data.url.startsWith('/employee');
  
  let title = '';
  let body = '';
  let actions = [];
  
  if (data.type === 'new_order') {
    const customerName = data.customerName || 'عميل';
    const orderTypeLabel = ORDER_TYPE_LABELS[data.orderType] || '';
    const itemCount = data.itemCount || 0;
    
    title = `🔔 طلب جديد #${orderNum}`;
    body = `${customerName}`;
    if (orderTypeLabel) body += ` • ${orderTypeLabel}`;
    if (itemCount > 0) body += ` • ${itemCount} ${itemCount > 1 ? 'منتجات' : 'منتج'}`;
    if (data.totalAmount) body += `\n💰 ${Number(data.totalAmount).toFixed(2)} ر.س`;
    
    if (data.items && data.items.length > 0) {
      const itemsList = data.items.slice(0, 4).map(i => `  ${i.quantity}x ${i.name}`).join('\n');
      body += `\n${itemsList}`;
      if (data.items.length > 4) body += `\n  +${data.items.length - 4} أخرى`;
    }
    
    actions = [
      { action: 'accept', title: '✅ بدء التحضير' },
      { action: 'open', title: '📋 عرض التفاصيل' }
    ];
  } else {
    title = `${config.emoji} طلب #${orderNum}`;
    body = config.labelAr;
    
    if (status === 'in_progress') {
      body = '☕ جاري تحضير طلبك الآن...';
      if (data.estimatedTime) body += `\n⏱️ الوقت المتوقع: ${data.estimatedTime} دقيقة`;
      actions = [
        { action: 'open', title: '📋 متابعة الطلب' }
      ];
    } else if (status === 'ready') {
      title = `🎉 طلبك جاهز! #${orderNum}`;
      body = '✨ طلبك جاهز للاستلام الآن';
      if (data.orderType) {
        const typeLabel = ORDER_TYPE_LABELS[data.orderType];
        if (typeLabel) body += `\n${typeLabel}`;
      }
      actions = [
        { action: 'open', title: '📍 عرض التفاصيل' }
      ];
    } else if (status === 'completed') {
      body = '✅ شكراً لزيارتك! نتمنى لك يوماً سعيداً';
      if (data.totalAmount) body += `\n💰 المجموع: ${Number(data.totalAmount).toFixed(2)} ر.س`;
      actions = [
        { action: 'open', title: '⭐ تقييم الطلب' }
      ];
    } else if (status === 'cancelled') {
      body = '❌ نعتذر، تم إلغاء طلبك';
      actions = [
        { action: 'open', title: '📞 تواصل معنا' }
      ];
    }
  }
  
  return { title, body, actions, config };
}

self.addEventListener('push', function(event) {
  let data = { title: 'CLUNY CAFE', body: 'لديك إشعار جديد', url: '/', type: 'general' };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    try {
      if (event.data) {
        data.body = event.data.text();
      }
    } catch (e2) {
      console.error('[SW] Push data parse error:', e2);
    }
  }

  const isEmployee = data.url && data.url.startsWith('/employee');
  const icon = isEmployee ? '/employee-logo.png' : '/logo.png';
  let options = {};
  
  if (data.type === 'order_status' || data.type === 'new_order') {
    const notification = buildOrderStatusNotification(data);
    
    options = {
      body: notification.body,
      icon: icon,
      badge: '/badge-icon.png',
      vibrate: data.type === 'new_order' 
        ? [200, 100, 200, 100, 200, 100, 400]
        : (data.orderStatus === 'ready' ? [500, 200, 500] : [300, 100, 300]),
      data: {
        url: data.url || '/',
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        orderStatus: data.orderStatus,
        type: data.type,
        timestamp: Date.now()
      },
      tag: data.tag || `order-${data.orderNumber || 'notification'}`,
      renotify: true,
      requireInteraction: data.orderStatus === 'ready' || data.type === 'new_order',
      silent: false,
      actions: notification.actions,
      timestamp: data.timestamp || Date.now(),
      dir: 'rtl',
      lang: 'ar',
    };
    
    data.title = notification.title;
  } else if (data.type === 'geofence') {
    options = {
      body: data.body,
      icon: icon,
      badge: '/badge-icon.png',
      vibrate: [300, 100, 300],
      data: {
        url: data.url || '/',
        type: 'geofence',
        timestamp: Date.now()
      },
      tag: data.tag || 'geofence-notification',
      renotify: false,
      requireInteraction: false,
      silent: false,
      actions: [
        { action: 'open', title: '☕ اطلب الآن' },
        { action: 'dismiss', title: 'لاحقاً' }
      ],
      timestamp: data.timestamp || Date.now(),
      dir: 'rtl',
      lang: 'ar',
    };
  } else if (data.type === 'promo') {
    options = {
      body: data.body,
      icon: icon,
      badge: '/badge-icon.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        type: 'promo',
        timestamp: Date.now()
      },
      tag: data.tag || 'promo-notification',
      renotify: false,
      requireInteraction: false,
      silent: false,
      actions: [
        { action: 'open', title: '🎁 عرض العرض' },
        { action: 'dismiss', title: 'تجاهل' }
      ],
      timestamp: data.timestamp || Date.now(),
      dir: 'rtl',
      lang: 'ar',
    };
  } else {
    options = {
      body: data.body,
      icon: icon,
      badge: '/badge-icon.png',
      vibrate: [300, 100, 300, 100, 300],
      data: {
        url: data.url || '/',
        orderId: data.orderId,
        timestamp: Date.now()
      },
      tag: data.tag || 'cluny-notification',
      renotify: true,
      requireInteraction: true,
      silent: false,
      actions: [
        { action: 'open', title: '📋 عرض' },
        { action: 'dismiss', title: 'تجاهل' }
      ],
      timestamp: data.timestamp || Date.now(),
      dir: 'rtl',
      lang: 'ar',
    };
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const action = event.action;
  if (action === 'dismiss') return;

  let targetUrl = event.notification.data?.url || '/';
  
  if (action === 'accept' && event.notification.data?.type === 'new_order') {
    targetUrl = '/employee/pos';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('notificationclose', function(event) {
});

self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  try {
    const db = await openDB();
    const tx = db.transaction('pending-orders', 'readonly');
    const store = tx.objectStore('pending-orders');
    const orders = await getAllFromStore(store);

    for (const order of orders) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order.data),
        });

        if (response.ok) {
          const deleteTx = db.transaction('pending-orders', 'readwrite');
          deleteTx.objectStore('pending-orders').delete(order.id);
          console.log('[SW] Synced offline order:', order.id);
        }
      } catch (err) {
        console.error('[SW] Failed to sync order:', order.id, err);
      }
    }
  } catch (error) {
    console.log('[SW] Background sync - no pending orders or DB not available');
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cluny-offline', 1);
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-orders')) {
        db.createObjectStore('pending-orders', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept requests to external domains — let the browser handle them directly
  // This is critical for payment SDKs like Geidea (js.geidea.net) that are geo-restricted
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Never intercept Vite internal dev-server requests
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/node_modules/.vite') ||
    url.pathname.startsWith('/__vite')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  const isStaticAsset = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp3|webp)$/);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200) return response;
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return response;
          })
          .catch(() => {
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          const accept = event.request.headers.get('accept');
          if (accept && accept.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
    })
  );
});

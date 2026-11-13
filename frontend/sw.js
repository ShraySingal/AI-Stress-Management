/* ==========================================================================
   MindEase Cache Buster & Service Worker Purge (v2.0.0)
   Purges all stale legacy caches, unregisters legacy workers, and enforces fresh network load.
   ========================================================================== */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          if (client.url && 'navigate' in client) {
            client.navigate(client.url);
          }
        });
      });
    })
  );
});

// Always route all traffic directly to the fresh network response
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

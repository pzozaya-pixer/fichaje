const CACHE_NAME = 'fichaje-cache-v1';
const urlsToCache = [
  '/fichaje/pwa',
  '/fichaje/manifest.json'
];

// Instalar el Service Worker y cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activar el Service Worker y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Responder con recursos en caché o realizar la petición por red
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET locales
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).catch(() => {
        // Fallback cuando no hay red (offline)
        return caches.match('/fichaje/pwa');
      });
    })
  );
});

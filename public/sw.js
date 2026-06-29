const CACHE_NAME = 'fichaje-cache-v1';

// Instalar el Service Worker y forzar la activación inmediata
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activar el Service Worker y tomar el control de todos los clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Interceptador de peticiones (necesario para el cumplimiento de los criterios de PWA)
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET de origen local
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Responder directamente desde la red (passthrough dinámico para evitar cacheos conflictivos con Next.js)
  event.respondWith(fetch(event.request));
});

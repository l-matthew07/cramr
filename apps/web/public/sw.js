// Cramr Service Worker
// Minimal install-enabling service worker. Caches app shell for offline resilience.

const CACHE_NAME = "cramr-v1";
const PRECACHE_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first strategy: try network, fall back to cache for navigation requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only intercept same-origin navigation requests
  if (
    request.mode !== "navigate" ||
    !request.url.startsWith(self.location.origin)
  ) {
    return;
  }
  event.respondWith(
    fetch(request).catch(() => caches.match("/index.html")),
  );
});

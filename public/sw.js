/* Safe PWA service worker: cache static assets + public library metadata only. */
const CACHE = "song-an-40-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) {
    // Never cache API — personalized/sensitive responses
    return;
  }
  if (url.pathname.startsWith("/admin")) {
    return;
  }

  // Public library metadata may be cached briefly offline
  if (url.pathname === "/api/v1/library" || url.pathname.startsWith("/api/v1/library/")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets") || PRECACHE.includes(url.pathname))) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});

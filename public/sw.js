// VetCopilot — service worker (cache basique pour usage offline)
// Stratégie : network-first, cache-fallback.
// Au déploiement, change CACHE_VERSION pour forcer le rafraîchissement.
const CACHE_VERSION = "vetcopilot-v4";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Pour les requêtes HTML : network-first (pour avoir les mises à jour),
  // cache-fallback (pour l'offline).
  const accept = req.headers.get("accept") || "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy).catch(() => {}));
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html")),
        ),
    );
    return;
  }

  // Pour les autres assets : cache-first, network-fallback.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          // Cache uniquement les réponses OK et basic/cors (évite opaque errors)
          if (response.ok && (response.type === "basic" || response.type === "cors")) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy).catch(() => {}));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});

const CACHE = "next-watch-v6";
const SHELL = [
  "./index.html",
  "./assets/icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Let Simkl API and auth calls through untouched
  if (url.hostname === "api.simkl.com" || url.hostname === "simkl.com") return;

  // Let PostHog through untouched — event POSTs must not be cached,
  // and the SDK handles its own asset caching.
  if (url.hostname.endsWith(".i.posthog.com")) return;

  // Cache-first for CDN assets (Chart.js, image proxies)
  if (url.hostname !== self.location.hostname && url.protocol === "https:") {
    e.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Network-first for the app shell so updates propagate; fall back to cache offline
  e.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

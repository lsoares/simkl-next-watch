const CACHE = "simkl-nw-v1";
const SHELL = [
  "./simkl-next-watch.html",
  "./icon.svg",
  "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js",
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

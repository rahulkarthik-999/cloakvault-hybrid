/* CloakVault service worker — offline app shell (pairs with air-gap mode).
 * Only same-origin GETs are cached. Firebase / Gemini / App Check calls are cross-origin and
 * always go to the network, so no AI request or document data is ever cached here. */
const CACHE = 'cloakvault-shell-v1';
const SHELL = ['/', '/app', '/manifest.webmanifest', '/brand/mark.png', '/brand/wordmark.png', '/brand/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: network first (fresh deploys), fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/app', copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/app')))
    );
    return;
  }

  // Hashed build assets & brand files: cache first.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/brand/'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

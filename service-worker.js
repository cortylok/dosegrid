// service-worker.js
// Network-first strategy: when online, always fetch the latest and refresh the
// cache; when offline, serve the last-cached copy. This means updates reach the
// user automatically (no cache-version bump needed) while the app stays usable
// offline once it has been visited.
const CACHE = 'dosegrid-v7';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/app.js', './js/ui.js', './js/dosing.js', './js/storage.js', './js/data.js', './js/categories.js',
  './js/pain.js', './js/painview.js', './js/timeline.js', './js/safety.js', './js/helplines.js',
  './medications.json', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Refresh the cache with the freshest copy of same-origin GETs.
        if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

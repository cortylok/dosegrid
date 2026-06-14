// service-worker.js
const CACHE = 'dosegrid-v1';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/app.js', './js/ui.js', './js/dosing.js', './js/storage.js', './js/data.js',
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
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

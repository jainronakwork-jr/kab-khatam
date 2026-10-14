// Offline support: serve from cache, refresh in the background.
const CACHE = 'kab-khatam-v1';
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "fonts/fraunces-latin-600-normal.woff2",
  "fonts/fraunces-latin-800-normal.woff2",
  "fonts/public-sans-latin-400-normal.woff2",
  "fonts/public-sans-latin-600-normal.woff2",
  "fonts/public-sans-latin-800-normal.woff2"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});

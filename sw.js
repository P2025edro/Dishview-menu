// Offline cache: app shell cache-first, menu.json network-first, 3D models/photos cached after first view
const V = 'dishview-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png',
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.4.0/dist/model-viewer.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fresh = url.pathname.endsWith('menu.json') || req.mode === 'navigate';
  if (fresh) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.origin === location.origin || url.hostname.endsWith('jsdelivr.net') || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); }
    return r;
  })));
});

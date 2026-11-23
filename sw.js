const CACHE = 'wj-v26.11.23';
const SHELL = [
  './', './index.html', './manifest.json',
  './assets/css/styles.css', './assets/js/app.js',
  './images/icon.png', './images/icon-192.png', './images/icon-512.png',
  './images/icon-maskable-512.png', './images/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;
  // بيانات Supabase تُدار من الصفحة نفسها (localStorage)، ولا نخزّنها هنا
  if (url.hostname.endsWith('supabase.co')) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

// Utposten service worker. Bump VERSION to drop all old caches on the next activate.
const VERSION = 'v1';
const PAGES = `utposten-pages-${VERSION}`;
const ASSETS = `utposten-assets-${VERSION}`;
const FONTS = `utposten-fonts-${VERSION}`;
const KEEP = [PAGES, ASSETS, FONTS];
const INDEX = new URL('./', self.registration.scope).href;

// Precache the page and the hashed files it references, so the very first load already works offline.
async function precache() {
  const res = await fetch(new Request(INDEX, { cache: 'reload' }));
  if (!res.ok) return;
  const html = await res.clone().text();
  (await caches.open(PAGES)).put(INDEX, res);
  const files = [...new Set(html.match(/assets\/[\w.-]+\.(?:js|css)/g) || [])];
  const assets = await caches.open(ASSETS);
  await Promise.all(files.map((f) => assets.add(new URL(f, INDEX).href).catch(() => {})));
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('utposten-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(PAGES)).put(INDEX, res.clone());
    return res;
  } catch {
    const cache = await caches.open(PAGES);
    return (await cache.match(INDEX)) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  });
  if (hit) { fresh.catch(() => {}); return hit; }
  return fresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // In-app update check: always go straight to the network, never cache.
  if (url.searchParams.has('check')) return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(networkFirstPage(req));
    return;
  }
  const base = new URL('./', self.registration.scope).pathname;
  if (url.pathname.startsWith(base + 'assets/')) {
    e.respondWith(cacheFirst(req));
  }
});

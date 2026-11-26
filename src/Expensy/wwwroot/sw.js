// Service worker: makes Expensy installable and lets it open offline.
//
//   App files (HTML, CSS, JS, icons): network first, so updates show up immediately; every successful response
//                                     is cached, and the cache is used when offline.
//   Photos (/api/photos/...):         cache first — file names never change. Wiped on logout (js/photos.js).
//   Everything else under /api:       always the network; data must be fresh.
const APP_CACHE = 'expensy-app';
const PHOTO_CACHE = 'expensy-photos';

self.addEventListener('install', (event) => {
  // Cache the entry page right away, so the app opens offline even before the first reload.
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Drop caches from older versions of this file.
  const current = [APP_CACHE, PHOTO_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !current.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/photos/')) event.respondWith(cacheFirst(request, PHOTO_CACHE));
  else if (!url.pathname.startsWith('/api/')) event.respondWith(networkFirst(request, APP_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
    return response;
  } catch {
    // Offline: the cached copy, or the app shell for navigations to unknown URLs.
    return (await caches.match(request)) ?? (await caches.match('/'));
  }
}

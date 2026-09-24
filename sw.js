/* ============================================================
   Service Worker — LotoFácil PWA
   Versão compatível com Chrome Android (WebAPK)
   ============================================================ */

const CACHE_NAME = 'lotofacil-v2';
const CACHE_CDN = 'lotofacil-cdn-v2';

const ASSETS_LOCAIS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

const ASSETS_CDN = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cacheLocal = await caches.open(CACHE_NAME);
      await cacheLocal.addAll(ASSETS_LOCAIS);

      const cacheCDN = await caches.open(CACHE_CDN);
      await Promise.allSettled(
        ASSETS_CDN.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => res.ok ? cacheCDN.put(url, res) : null)
            .catch(() => null)
        )
      );

      self.skipWaiting();
    })()
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const cachesAtuais = await caches.keys();
      await Promise.all(
        cachesAtuais
          .filter(nome => nome !== CACHE_NAME && nome !== CACHE_CDN)
          .map(nome => caches.delete(nome))
      );
      self.clients.claim();
    })()
  );
});

/* ---------- FETCH (obrigatório para Chrome Android) ---------- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Locais → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(res => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
            return res;
          })
          .catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // CDN → cache-first
  if (ASSETS_CDN.some(u => request.url.startsWith(u.split('?')[0]))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_CDN).then(c => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Outros → network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

/* ---------- MENSAGENS ---------- */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

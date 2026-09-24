/* ============================================================
   Service Worker — LotoFácil PWA
   Cache-first para assets, network-first para CDN externos
   ============================================================ */

const CACHE_NAME = 'lotofacil-v1';
const CACHE_EXTERNOS = 'lotofacil-cdn-v1';

// Assets locais (obrigatórios para funcionar offline)
const ASSETS_LOCAIS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// CDN externos (Chart.js e XLSX) — cacheados na primeira visita
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

      const cacheCDN = await caches.open(CACHE_EXTERNOS);
      // Não falha se algum CDN não estiver disponível
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
          .filter(nome => nome !== CACHE_NAME && nome !== CACHE_EXTERNOS)
          .map(nome => caches.delete(nome))
      );
      self.clients.claim();
    })()
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora métodos não-GET
  if (request.method !== 'GET') return;

  // Assets locais → cache-first
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

  // CDN externos → cache-first com fallback para rede
  if (ASSETS_CDN.some(u => request.url.startsWith(u.split('?')[0]))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_EXTERNOS).then(c => c.put(request, clone));
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

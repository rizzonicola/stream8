// Stream8 — Service Worker
// -------------------------
// Obiettivo: lo "shell" dell'app (HTML, manifest, icone — tutto ciò che ha
// un nome di file fisso) viene precaricato all'installazione, così anche la
// primissima apertura offline dopo l'installazione funziona. I file
// JS/CSS generati dalla build (nomi con hash, sconosciuti a priori) vengono
// invece messi in cache "al volo" alla prima richiesta reale, con strategia
// stale-while-revalidate: dalla seconda visita in poi lo shell si apre
// istantaneamente, mentre in background si verifica se c'è una versione più
// recente. I dati dinamici (chiamate a TMDb) non vengono MAI cachati:
// passano sempre e solo in rete, per restare aggiornati.
//
// IMPORTANTE: ad ogni deploy con modifiche, incrementa CACHE_NAME (es. v1 →
// v2). Senza questo passaggio gli utenti che hanno già installato la PWA
// continuerebbero a vedere la shell precedente finché la cache non scade.

const CACHE_NAME = 'stream8-shell-v2';

// Risorse con nome file fisso, note in anticipo: precaricate subito
// all'installazione per garantire il funzionamento offline fin da subito.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Se una risorsa dovesse mancare (es. build senza alcune icone),
      // non blocchiamo comunque l'installazione dell'intero service worker.
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Cachiamo solo richieste GET.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Mai in cache: qualsiasi richiesta cross-origin (incluse le chiamate a
  // api.themoviedb.org e image.tmdb.org) — restano sempre network-only.
  if (url.origin !== self.location.origin) return;

  // Navigazioni (cambi di pagina/route dell'app, SPA): prova sempre prima
  // la rete per avere l'ultima versione; se offline, ripiega sulla shell
  // precaricata all'installazione, garantita presente.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () => caches.match('/index.html', { cacheName: CACHE_NAME })
      )
    );
    return;
  }

  // Asset statici stessa origine (JS/CSS/font/icone): stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

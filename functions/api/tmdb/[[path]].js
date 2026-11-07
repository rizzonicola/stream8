// Cloudflare Pages Function: proxy verso TMDb.
//
// Il token TMDb resta in env.TMDB_TOKEN (secret del progetto Pages) e non
// viene mai inviato al browser. Il frontend chiama /api/tmdb/... e questa
// Function aggiunge l'header Authorization lato server.
//
// Sono consentiti solo gli endpoint realmente usati dall'app: in questo modo
// la Function non diventa un proxy generico verso qualunque API TMDb.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const ALLOWED_PREFIXES = ['/discover/', '/movie/', '/tv/', '/search/'];
const CACHE_TTL_SECONDS = 300;

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
  }

  const url = new URL(request.url);
  const path = normalizedPath(url.pathname.slice('/api/tmdb'.length));

  if (!path) {
    return json({ error: 'Not found' }, 404);
  }

  if (!env.TMDB_TOKEN) {
    console.error('TMDB_TOKEN is not configured');
    return json({ error: 'Server configuration error' }, 500);
  }

  const target = new URL(TMDB_BASE + path);
  target.search = url.search;

  // Cache breve lato edge: riduce le chiamate a TMDb senza servire dati
  // troppo vecchi. La cache è per URL (i parametri lingua/regione sono
  // inclusi nella query string).
  const cache = caches.default;
  const cacheKey = new Request(target.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        Authorization: `Bearer ${env.TMDB_TOKEN}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    console.error('TMDb request failed:', err.message);
    return json({ error: 'Upstream request failed' }, 502);
  }

  if (!upstream.ok) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
  return response;
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

// Valida e normalizza il percorso richiesto. Restituisce null se non è uno
// degli endpoint TMDb usati dall'app. Il controllo avviene sul percorso
// decodificato e ogni segmento deve essere alfanumerico: così varianti
// percent-encoded (es. %2e%2e) non possono uscire dall'allowlist.
function normalizedPath(path) {
  if (!path.startsWith('/')) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }

  if (decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0')) {
    return null;
  }

  if (!ALLOWED_PREFIXES.some((prefix) => decoded.startsWith(prefix))) {
    return null;
  }

  const segments = decoded.split('/').slice(1);
  if (!segments.every((segment) => /^[A-Za-z0-9_-]+$/.test(segment))) {
    return null;
  }

  return decoded;
}

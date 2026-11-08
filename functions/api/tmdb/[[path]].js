// Cloudflare Pages Function: proxy verso TMDb.
//
// Il token TMDb resta in env.TMDB_TOKEN (secret del progetto Pages) e non
// viene mai inviato al browser. Il frontend chiama /api/tmdb/... e questa
// Function aggiunge l'header Authorization lato server.
//
// Sono consentiti solo gli endpoint e i parametri realmente usati dall'app:
// in questo modo la Function non diventa un proxy generico verso qualunque
// API TMDb né un modo per generare varianti arbitrarie che consumano quota
// e bypassano la cache edge. Un rate limit per IP va comunque configurato
// lato Cloudflare (WAF/Rate Limiting): un contatore in memoria dentro un
// Worker non sarebbe globale né affidabile.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL_SECONDS = 300;

const LANGUAGE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const REGION = /^[A-Z]{2}$/;
const SORT_BY = new Set(['popularity.desc', 'first_air_date.desc']);
const GENRE_LIST = /^\d{1,3}(?:,\d{1,3})*$/;
const ORIGINAL_LANGUAGE = /^[a-z]{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VOTE_COUNT = /^\d{1,6}$/;
const QUERY_MAX_LENGTH = 200;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// Endpoint e parametri accettati, nella forma esatta usata da src/api/tmdb.js.
const ALLOWED_ROUTES = [
  {
    pattern: /^\/discover\/movie$/,
    params: new Set(['language', 'sort_by', 'vote_count.gte']),
  },
  {
    pattern: /^\/discover\/tv$/,
    params: new Set([
      'language',
      'sort_by',
      'vote_count.gte',
      'without_genres',
      'with_genres',
      'with_original_language',
      'first_air_date.lte',
    ]),
  },
  { pattern: /^\/movie\/now_playing$/, params: new Set(['language', 'region']) },
  { pattern: /^\/tv\/on_the_air$/, params: new Set(['language']) },
  { pattern: /^\/search\/multi$/, params: new Set(['language', 'query', 'page']) },
  { pattern: /^\/movie\/\d{1,10}$/, params: new Set(['language']) },
  { pattern: /^\/tv\/\d{1,10}$/, params: new Set(['language']) },
  { pattern: /^\/movie\/\d{1,10}\/credits$/, params: new Set(['language']) },
  { pattern: /^\/tv\/\d{1,10}\/credits$/, params: new Set(['language']) },
  { pattern: /^\/tv\/\d{1,10}\/season\/\d{1,3}$/, params: new Set(['language']) },
  {
    pattern: /^\/movie\/\d{1,10}\/watch\/providers$/,
    params: new Set(),
  },
  {
    pattern: /^\/tv\/\d{1,10}\/watch\/providers$/,
    params: new Set(),
  },
];

const PARAM_VALIDATORS = {
  language: (value) => LANGUAGE.test(value),
  region: (value) => REGION.test(value),
  query: (value) =>
    value.length > 0 && value.length <= QUERY_MAX_LENGTH && !CONTROL_CHARS.test(value),
  page: (value) => {
    const page = Number(value);
    return Number.isInteger(page) && page >= 1 && page <= 500;
  },
  sort_by: (value) => SORT_BY.has(value),
  'vote_count.gte': (value) => VOTE_COUNT.test(value),
  without_genres: (value) => GENRE_LIST.test(value),
  with_genres: (value) => GENRE_LIST.test(value),
  with_original_language: (value) => ORIGINAL_LANGUAGE.test(value),
  'first_air_date.lte': (value) => DATE.test(value),
};

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

  const search = sanitizedSearch(url.searchParams, allowedParams(path));
  if (search === null) {
    return json({ error: 'Invalid query parameters' }, 400);
  }

  if (!env.TMDB_TOKEN) {
    console.error('TMDB_TOKEN is not configured');
    return json({ error: 'Server configuration error' }, 500);
  }

  const target = new URL(TMDB_BASE + path);
  target.search = search.toString();

  // Cache breve lato edge: riduce le chiamate a TMDb senza servire dati
  // troppo vecchi. I parametri sono normalizzati (ordine stabile, nessun
  // duplicato), quindi varianti equivalenti condividono la stessa cache key.
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
        'Referrer-Policy': 'no-referrer',
      },
    });
  }

  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
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
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
  });
}

function allowedParams(path) {
  const route = ALLOWED_ROUTES.find((candidate) => candidate.pattern.test(path));
  return route ? route.params : null;
}

// Valida e normalizza il percorso richiesto. Restituisce null se non è uno
// degli endpoint TMDb usati dall'app. Il controllo avviene sul percorso
// decodificato: varianti percent-encoded (es. %2e%2e) non possono quindi
// uscire dall'allowlist.
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

  return allowedParams(decoded) ? decoded : null;
}

// Costruisce una query string con soli parametri ammessi per quel path.
// Duplicati e nomi sconosciuti vengono rifiutati (non ignorati): un client
// legittimo non ne ha bisogno e accettarli renderebbe ambiguo il cache key.
function sanitizedSearch(searchParams, allowed) {
  if (!allowed) return null;
  const entries = [...searchParams.entries()];
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const result = new URLSearchParams();
  const seen = new Set();
  for (const [name, value] of entries) {
    if (!allowed.has(name) || seen.has(name)) return null;
    const validate = PARAM_VALIDATORS[name];
    if (!validate || !validate(value)) return null;
    seen.add(name);
    result.append(name, value);
  }
  return result;
}

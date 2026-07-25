// AniList API client
// -------------------
// Usato SOLO dal motore dei servizi custom, per risolvere l'ID AniList e/o
// l'ID MyAnimeList (MAL) di un anime quando il pattern di un servizio
// personalizzato li richiede (segnaposto {anilist_id} / {mal_id}).
//
// L'API pubblica di AniList (GraphQL) non richiede alcuna registrazione o
// chiave: espone anche `idMal`, quindi un'unica richiesta basta per
// entrambi gli ID. Per non introdurre rallentamenti quando la funzione non
// serve, questo modulo viene interrogato ESCLUSIVAMENTE al momento in cui
// l'utente sceglie un servizio il cui pattern contiene uno di questi
// segnaposto (mai in anticipo, mai per i titoli non-anime).

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 10_000;

const SEARCH_QUERY = `
  query ($search: String, $year: Int) {
    Media(search: $search, seasonYear: $year, type: ANIME) {
      id
      idMal
      title {
        romaji
        english
      }
    }
  }
`;

// Stessa strategia di cache/deduplica usata in api/tmdb.js: evita di
// interrogare due volte AniList per lo stesso titolo nella stessa sessione.
const cache = new Map(); // key -> { data, expiry }
const inFlight = new Map(); // key -> Promise
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minuti: questi ID non cambiano mai

function cacheKey(title, year) {
  return `${title.toLowerCase().trim()}::${year || ''}`;
}

async function queryAnilist(title, year) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { search: title, year: year || undefined },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`Errore AniList (${res.status})`);
  }
  const json = await res.json();
  const media = json?.data?.Media;
  if (!media) return null;
  return {
    anilistId: media.id,
    malId: media.idMal ?? null,
    title: media.title?.english || media.title?.romaji || title,
  };
}

/**
 * Cerca un anime su AniList per titolo (e anno, se disponibile) e restituisce
 * { anilistId, malId, title } oppure null se non trovato.
 * Non lancia mai eccezioni verso il chiamante: in caso di errore di rete
 * restituisce null, lasciando che sia il chiamante a decidere come
 * segnalarlo (es. icona rossa sul servizio, coerente col resto dell'app).
 */
export async function searchAnilistMedia(title, year) {
  if (!title) return null;
  const key = cacheKey(title, year);

  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = queryAnilist(title, year)
    .then((data) => {
      cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
      return data;
    })
    .catch((err) => {
      console.warn('[Stream8 AniList] ricerca fallita per', `"${title}"`, ':', err);
      return null;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

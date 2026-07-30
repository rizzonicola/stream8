// Replace "YOUR_TMDB_TOKEN" with your actual TMDB Bearer Token
const TMDB_TOKEN = 'YOUR_TMDB_TOKEN';

const BASE_URL = 'https://api.themoviedb.org/3';
export const IMAGE_BASE = 'https://image.tmdb.org/t/p';

// --- Ottimizzazioni di rete -------------------------------------------
// 1) Cache in memoria (5 min, mai su disco): evita richieste duplicate per
//    la stessa risorsa nella stessa sessione (es. tornando su Home dopo
//    aver visitato Film/Serie/Anime, o riaprendo lo stesso titolo).
// 2) Deduplica delle richieste "in volo": se la stessa URL viene richiesta
//    più volte prima che la prima risposta arrivi (tipico quando più
//    componenti montano insieme, es. Promise.all in Home), viene fatta
//    una sola vera richiesta di rete e il risultato condiviso.
// 3) Timeout (10s) via AbortController, per non restare bloccati su reti
//    lente o cadute.
// 4) Un solo retry automatico con breve backoff sugli errori di rete
//    transitori (non sugli errori HTTP 4xx/5xx espliciti del server).
const responseCache = new Map(); // url -> { data, expiry }
const inFlightRequests = new Map(); // url -> Promise
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 200; // limite morbido: una scheda tenuta aperta per ore/giorni non deve accumulare voci scadute all'infinito

// Rimuove le voci scadute quando la cache cresce oltre la soglia, invece di
// tenerla sotto controllo con un timer separato (che girerebbe anche
// quando l'app è in background, sprecando risorse per nulla).
function pruneExpiredCache() {
  if (responseCache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiry <= now) responseCache.delete(key);
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function doFetch(cacheKey, attempt = 0) {
  try {
    const res = await fetchWithTimeout(cacheKey, {
      headers: {
        Authorization: `Bearer ${TMDB_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
    });
    if (!res.ok) {
      throw new Error(`Errore TMDb (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    // Solo un retry, solo per errori di rete/timeout (non per risposte
    // HTTP esplicite come 404/429, che non trarrebbero beneficio da un
    // secondo tentativo immediato).
    const isNetworkIssue = err.name === 'AbortError' || err instanceof TypeError;
    if (isNetworkIssue && attempt < 1) {
      console.warn('[Stream8 TMDb] tentativo', attempt + 1, 'fallito, riprovo:', cacheKey, err.message);
      await new Promise((resolve) => setTimeout(resolve, 400));
      return doFetch(cacheKey, attempt + 1);
    }
    console.error('[Stream8 TMDb] richiesta fallita definitivamente:', cacheKey, err);
    throw err;
  }
}

async function tmdbFetch(path, params = {}) {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  const cacheKey = url.toString();

  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const pending = inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const request = doFetch(cacheKey)
    .then((data) => {
      responseCache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
      pruneExpiredCache();
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}

export function posterUrl(path, size = 'w500') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

// Genera un srcset per le locandine: il browser sceglie automaticamente la
// variante più piccola sufficiente per lo spazio disponibile, risparmiando
// banda soprattutto su mobile (dove le card sono strette).
export function posterSrcSet(path) {
  if (!path) return undefined;
  return [92, 154, 185, 342]
    .map((w) => `${IMAGE_BASE}/w${w}${path} ${w}w`)
    .join(', ');
}

export function backdropUrl(path, size = 'w1280') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

// Normalizza un risultato movie/tv TMDb in un formato comune usato dall'app
export function normalizeItem(raw, mediaType) {
  const type = mediaType || raw.media_type || (raw.title ? 'movie' : 'tv');
  const title = raw.title || raw.name || 'Senza titolo';
  const date = raw.release_date || raw.first_air_date || '';
  return {
    id: raw.id,
    mediaType: type, // 'movie' | 'tv' | 'anime' (anime è un sotto-tipo di tv)
    title,
    overview: raw.overview || '',
    tagline: raw.tagline || '',
    year: date ? date.slice(0, 4) : '',
    posterPath: raw.poster_path || null,
    backdropPath: raw.backdrop_path || null,
    voteAverage: raw.vote_average || 0,
    genreIds: raw.genre_ids || [],
    genreNames: Array.isArray(raw.genres) ? raw.genres.map((g) => g.name) : [],
    numberOfSeasons: raw.number_of_seasons || null,
    numberOfEpisodes: raw.number_of_episodes || null,
    runtimeMinutes: Array.isArray(raw.episode_run_time)
      ? raw.episode_run_time[0]
      : raw.runtime || null,
    status: raw.status || '',
    originalLanguage: raw.original_language || '',
    // Elenco stagioni (solo serie TV): evita di richiedere di nuovo
    // /tv/{id} altrove solo per leggere questo campo, che TMDb include già
    // nella risposta di dettaglio.
    seasons: Array.isArray(raw.seasons)
      ? raw.seasons
          .filter((s) => s.season_number > 0)
          .map((s) => ({
            seasonNumber: s.season_number,
            name: s.name,
            episodeCount: s.episode_count,
          }))
      : [],
  };
}

export async function fetchRecommendedMovies(lang) {
  const data = await tmdbFetch('/discover/movie', {
    language: lang,
    sort_by: 'popularity.desc',
    'vote_count.gte': 100,
  });
  return (data.results || []).map((r) => normalizeItem(r, 'movie'));
}

export async function fetchRecommendedSeries(lang) {
  const data = await tmdbFetch('/discover/tv', {
    language: lang,
    sort_by: 'popularity.desc',
    'vote_count.gte': 100,
    without_genres: '16', // esclude animazione per non sovrapporsi alla sezione anime
  });
  return (data.results || []).map((r) => normalizeItem(r, 'tv'));
}

// Anime: serie TV di genere Animation (16) con lingua originale giapponese
export async function fetchRecommendedAnime(lang) {
  const data = await tmdbFetch('/discover/tv', {
    language: lang,
    sort_by: 'popularity.desc',
    with_genres: '16',
    with_original_language: 'ja',
    'vote_count.gte': 20,
  });
  return (data.results || []).map((r) => normalizeItem(r, 'anime'));
}

export async function fetchRecentMoviesForHero(lang) {
  const data = await tmdbFetch('/movie/now_playing', { language: lang, region: 'IT' });
  return (data.results || []).map((r) => normalizeItem(r, 'movie'));
}

export async function fetchRecentSeriesForHero(lang) {
  const data = await tmdbFetch('/tv/on_the_air', { language: lang });
  return (data.results || []).map((r) => normalizeItem(r, 'tv'));
}

export async function fetchRecentAnimeForHero(lang) {
  const data = await tmdbFetch('/discover/tv', {
    language: lang,
    sort_by: 'first_air_date.desc',
    with_genres: '16',
    with_original_language: 'ja',
    'vote_count.gte': 5,
    'first_air_date.lte': new Date().toISOString().slice(0, 10),
  });
  return (data.results || []).map((r) => normalizeItem(r, 'anime'));
}

export async function searchMulti(query, lang) {
  const data = await tmdbFetch('/search/multi', { query, language: lang });
  return (data.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => {
      // TMDb non ha un "media_type" per l'anime: restituisce solo
      // 'movie'/'tv'. Senza questo controllo, un anime trovato tramite la
      // ricerca (invece che sfogliando la sezione Anime in Home) resterebbe
      // etichettato come 'tv' generico per sempre — e con
      // item.mediaType !== 'anime', WatchOnDialog salterebbe del tutto la
      // risoluzione via catena di sequel AniList, usando invece la ricerca
      // semplice per titolo/anno (che trova sempre la prima stagione).
      // Stesso identico criterio già usato in fetchRecommendedAnime /
      // fetchRecentAnimeForHero, per classificare allo stesso modo un
      // titolo indipendentemente da dove l'utente lo trova nell'app.
      const isAnime =
        r.media_type === 'tv' &&
        Array.isArray(r.genre_ids) &&
        r.genre_ids.includes(16) &&
        r.original_language === 'ja';
      return normalizeItem(r, isAnime ? 'anime' : r.media_type);
    });
}

export async function fetchDetails(id, mediaType, lang) {
  const path = mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`;
  const data = await tmdbFetch(path, { language: lang });
  return normalizeItem(data, mediaType);
}

// Cast principale (attori per i film, doppiatori/cast per le serie TV/anime)
export async function fetchCredits(id, mediaType, lang) {
  const path = mediaType === 'movie' ? `/movie/${id}/credits` : `/tv/${id}/credits`;
  try {
    const data = await tmdbFetch(path, { language: lang });
    return (data.cast || []).slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
    }));
  } catch {
    return [];
  }
}

// Elenco degli episodi di una specifica stagione
export async function fetchSeasonEpisodes(id, seasonNumber, lang) {
  try {
    const data = await tmdbFetch(`/tv/${id}/season/${seasonNumber}`, { language: lang });
    return (data.episodes || []).map((e) => ({
      episodeNumber: e.episode_number,
      name: e.name,
      overview: e.overview,
      stillPath: e.still_path,
      // Usato solo per derivare l'anno di uscita della stagione TMDb
      // selezionata, necessario al risolutore AniList per scegliere il ramo
      // corretto quando la catena dei sequel presenta un bivio (vedi
      // resolveAnilistForSeason in api/anilist.js).
      airDate: e.air_date || null,
    }));
  } catch {
    return [];
  }
}

// Restituisce sia i nomi dei provider disponibili (flatrate/ads/free/rent/buy)
// sia il link alla pagina "watch" di TMDb (powered by JustWatch) per quella
// regione: quest'ultimo porta a una pagina con i link diretti ai singoli
// servizi, il più vicino possibile a un deep-link reale che le sole API
// pubbliche di metadata possano offrire (TMDb non espone deep-link
// per-provider, solo questa pagina aggregata).
export async function fetchWatchProviders(id, mediaType, region = 'IT') {
  const path = mediaType === 'movie' ? `/movie/${id}/watch/providers` : `/tv/${id}/watch/providers`;
  try {
    const data = await tmdbFetch(path);
    const forRegion = data.results?.[region] || data.results?.US || {};
    const buckets = ['flatrate', 'ads', 'free', 'rent', 'buy'];
    const names = new Set();
    buckets.forEach((bucket) => {
      (forRegion[bucket] || []).forEach((p) => names.add(p.provider_name));
    });
    return { names: Array.from(names), link: forRegion.link || null };
  } catch {
    return { names: [], link: null };
  }
}

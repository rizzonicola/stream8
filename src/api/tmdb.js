// Le richieste passano dalla Pages Function /api/tmdb: il token TMDb resta
// nei secret di Cloudflare e non viene mai inserito nel bundle del browser.
import { LruCache } from '../utils/lruCache.js';
import { isSafeHttpUrl } from '../utils/urlSafety.js';

const BASE_URL = '/api/tmdb';

// --- Ottimizzazioni di rete -------------------------------------------
// 1) Cache in memoria (5 min, mai su disco) con limite rigido: evita
//    richieste duplicate nella stessa sessione senza crescere all'infinito.
// 2) Deduplica delle richieste "in volo" per le chiamate senza AbortSignal.
//    Le ricerche annullabili restano indipendenti: abortire una richiesta
//    condivisa farebbe fallire anche gli altri chiamanti.
// 3) Timeout (10s) via AbortController, per non restare bloccati su reti
//    lente o cadute.
// 4) Un solo retry automatico con breve backoff sugli errori di rete
//    transitori (non sugli errori HTTP 4xx/5xx espliciti del server).
const responseCache = new LruCache(200);
const inFlightRequests = new Map(); // url -> Promise
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const external = options.signal;
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onAbort, { once: true });
  }
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    external?.removeEventListener?.('abort', onAbort);
  });
}

async function doFetch(url, signal, attempt = 0) {
  try {
    const res = await fetchWithTimeout(url, { signal });
    if (!res.ok) {
      throw new Error(`Errore TMDb (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    // L'utente ha annullato (nuova query o dialog chiuso): nessun retry.
    if (signal?.aborted) throw err;
    // Solo un retry, solo per errori di rete/timeout (non per risposte
    // HTTP esplicite come 404/429, che non trarrebbero beneficio da un
    // secondo tentativo immediato).
    const isNetworkIssue = err.name === 'AbortError' || err instanceof TypeError;
    if (isNetworkIssue && attempt < 1) {
      console.warn('[Stream8 TMDb] tentativo', attempt + 1, 'fallito, riprovo:', url, err.message);
      await new Promise((resolve) => setTimeout(resolve, 400));
      return doFetch(url, signal, attempt + 1);
    }
    console.error('[Stream8 TMDb] richiesta fallita definitivamente:', url, err);
    throw err;
  }
}

async function tmdbFetch(path, params = {}, { signal } = {}) {
  const url = new URL(BASE_URL + path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  const cacheKey = url.toString();

  const cached = responseCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const pending = signal ? null : inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const request = doFetch(cacheKey, signal)
    .then((data) => {
      responseCache.set(cacheKey, data, CACHE_TTL_MS);
      return data;
    })
    .finally(() => {
      if (!signal) inFlightRequests.delete(cacheKey);
    });

  if (!signal) inFlightRequests.set(cacheKey, request);
  return request;
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
    voteCount: raw.vote_count || 0,
    releaseDate: date || '',
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

export async function searchMulti(query, lang, options = {}) {
  const { signal, page = 1 } = options;
  const data = await tmdbFetch(
    '/search/multi',
    { query, language: lang, page },
    { signal }
  );
  const items = (data.results || [])
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

  return {
    items,
    page: Number(data.page) || page,
    totalPages: Number(data.total_pages) || 1,
    totalResults: Number(data.total_results) || 0,
  };
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
      const providers = forRegion?.[bucket];
      if (!Array.isArray(providers)) return;
      providers.forEach((provider) => {
        if (typeof provider?.provider_name === 'string' && provider.provider_name) {
          names.add(provider.provider_name);
        }
      });
    });
    // Il link arriva da TMDb/JustWatch, cioè da dati esterni: non deve mai
    // diventare una destinazione `javascript:` o di altro schema eseguibile.
    const link = typeof forRegion.link === 'string' && isSafeHttpUrl(forRegion.link)
      ? forRegion.link
      : null;
    return { names: Array.from(names), link };
  } catch {
    return { names: [], link: null };
  }
}

// Modello della cronologia: identità, ordinamento, merge e compattazione.
// Vive fuori da syncClient perché è dominio, non trasporto: il client HTTP
// deve occuparsi solo di rete e autenticazione.
//
// La cronologia può arrivare anche da fonti non fidate (file importati,
// server di sync compromesso o configurato male): ogni campo viene quindi
// normalizzato al tipo atteso prima di essere salvato o mostrato. Senza
// questo, un `voteAverage` stringa o un `genreNames` oggetto può far
// crashare il rendering e lasciare l'app in uno stato irrecuperabile,
// perché la voce malformata viene ricaricata da localStorage ad ogni avvio.

export const HISTORY_MAX_ENTRIES = 100;
const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const MAX_TITLE_LENGTH = 500;
const MAX_SERVICE_NAME_LENGTH = 100;
const MAX_GENRES = 50;
const MAX_GENRE_LENGTH = 100;
const MAX_IMAGE_PATH_LENGTH = 200;
const TOMBSTONE_KEY = /^(?:movie|tv|anime)-\d+-(?:\d+)?-(?:\d+)?$/;

function toFiniteNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (value === null || value === '' || typeof value === 'boolean') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

function toInteger(value, range) {
  const number = toFiniteNumber(value, range);
  return Number.isInteger(number) ? number : undefined;
}

function toBoundedString(value, maxLength) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function toImagePath(value) {
  if (
    typeof value !== 'string' ||
    value.length > MAX_IMAGE_PATH_LENGTH ||
    !/^\/[A-Za-z0-9._-]+$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return undefined;
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().slice(0, MAX_GENRE_LENGTH);
    if (clean) out.push(clean);
    if (out.length >= MAX_GENRES) break;
  }
  return out.length > 0 ? out : undefined;
}

function toNumberArray(value) {
  if (!Array.isArray(value)) return undefined;
  const out = [];
  for (const item of value) {
    const number = toInteger(item, { min: 0, max: 1_000_000 });
    if (number === undefined) continue;
    out.push(number);
    if (out.length >= MAX_GENRES) break;
  }
  return out.length > 0 ? out : undefined;
}

export function isTombstone(entry) {
  return !!entry?.deleted;
}

export function entryKey(entry) {
  if (!entry || entry.id == null || !entry.mediaType) return null;
  return `${entry.mediaType}-${entry.id}-${entry.season ?? ''}-${entry.episode ?? ''}`;
}

export function showKey(entry) {
  if (!entry || entry.id == null || !entry.mediaType) return null;
  return `${entry.mediaType}-${entry.id}`;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  if (isTombstone(entry)) {
    const rawKey = typeof entry._key === 'string' ? entry._key : '';
    const key = TOMBSTONE_KEY.test(rawKey) ? rawKey : entryKey(entry);
    if (!key || !TOMBSTONE_KEY.test(key)) return null;
    return {
      _key: key,
      watchedAt: toFiniteNumber(entry.watchedAt, { min: 0 }) ?? 0,
      deleted: true,
    };
  }

  const id = toInteger(entry.id, { min: 1, max: Number.MAX_SAFE_INTEGER });
  const mediaType = ['movie', 'tv', 'anime'].includes(entry.mediaType)
    ? entry.mediaType
    : null;
  const title = toBoundedString(entry.title, MAX_TITLE_LENGTH);
  if (id === undefined || !mediaType || !title) return null;

  const season = toInteger(entry.season, { min: 0, max: 10_000 });
  const episode = toInteger(entry.episode, { min: 0, max: 10_000 });
  const key = entryKey({ id, mediaType, season, episode });
  if (!key) return null;

  const normalized = {
    id,
    mediaType,
    title,
    _key: key,
    watchedAt: toFiniteNumber(entry.watchedAt, { min: 0 }) ?? 0,
    deleted: false,
  };

  const year = toInteger(entry.year, { min: 1800, max: 2200 });
  if (year !== undefined) normalized.year = year;

  const posterPath = toImagePath(entry.posterPath);
  if (posterPath) normalized.posterPath = posterPath;

  const backdropPath = toImagePath(entry.backdropPath);
  if (backdropPath) normalized.backdropPath = backdropPath;

  const voteAverage = toFiniteNumber(entry.voteAverage, { min: 0, max: 10 });
  if (voteAverage !== undefined) normalized.voteAverage = voteAverage;

  const genreIds = toNumberArray(entry.genreIds);
  if (genreIds) normalized.genreIds = genreIds;

  const genreNames = toStringArray(entry.genreNames);
  if (genreNames) normalized.genreNames = genreNames;

  const originalLanguage = toBoundedString(entry.originalLanguage, 10);
  if (originalLanguage) normalized.originalLanguage = originalLanguage;

  const numberOfSeasons = toInteger(entry.numberOfSeasons, { min: 0, max: 10_000 });
  if (numberOfSeasons !== undefined) normalized.numberOfSeasons = numberOfSeasons;

  const numberOfEpisodes = toInteger(entry.numberOfEpisodes, { min: 0, max: 100_000 });
  if (numberOfEpisodes !== undefined) normalized.numberOfEpisodes = numberOfEpisodes;

  const runtimeMinutes = toInteger(entry.runtimeMinutes, { min: 0, max: 100_000 });
  if (runtimeMinutes !== undefined) normalized.runtimeMinutes = runtimeMinutes;

  if (season !== undefined) normalized.season = season;
  if (episode !== undefined) normalized.episode = episode;

  const viaService = toBoundedString(entry.viaService, MAX_SERVICE_NAME_LENGTH);
  if (viaService) normalized.viaService = viaService;

  return normalized;
}

export function normalizeHistory(entries, { limit = HISTORY_MAX_ENTRIES } = {}) {
  if (!Array.isArray(entries)) return [];
  const byKey = new Map();
  for (const raw of entries) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    const previous = byKey.get(entry._key);
    if (!previous || entry.watchedAt >= previous.watchedAt) byKey.set(entry._key, entry);
  }
  const out = [...byKey.values()].sort((a, b) => b.watchedAt - a.watchedAt);
  return Number.isFinite(limit) ? out.slice(0, limit) : out;
}

// Remote prima, locale dopo: a parità di watchedAt vince il locale, come
// nel vecchio merge basato su `>=`.
export function mergeHistories(local, remote) {
  return normalizeHistory(
    [...(Array.isArray(remote) ? remote : []), ...(Array.isArray(local) ? local : [])],
    { limit: Number.POSITIVE_INFINITY }
  );
}

export function pruneOldTombstones(entries, maxAgeMs = TOMBSTONE_MAX_AGE_MS) {
  if (!Array.isArray(entries)) return [];
  const cutoff = Date.now() - maxAgeMs;
  return entries.filter((entry) => !isTombstone(entry) || (entry.watchedAt ?? 0) >= cutoff);
}

// Una card per titolo: per le serie resta l'episodio visto più di recente.
export function groupHistoryByShow(history) {
  const seen = new Map();
  for (const entry of Array.isArray(history) ? history : []) {
    const key = showKey(entry);
    if (key && !seen.has(key)) seen.set(key, entry);
  }
  return [...seen.values()];
}

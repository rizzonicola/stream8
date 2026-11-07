// Modello della cronologia: identità, ordinamento, merge e compattazione.
// Vive fuori da syncClient perché è dominio, non trasporto: il client HTTP
// deve occuparsi solo di rete e autenticazione.

export const HISTORY_MAX_ENTRIES = 100;
const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

// Campi sufficienti per card, apertura del dettaglio (seed), sync e tombstone.
// overview, seasons e simili vengono richiesti di nuovo al dettaglio: sono
// pesanti e non servono alla Home.
const HISTORY_FIELDS = [
  'id',
  'mediaType',
  'title',
  'year',
  'posterPath',
  'backdropPath',
  'voteAverage',
  'genreIds',
  'genreNames',
  'originalLanguage',
  'numberOfSeasons',
  'numberOfEpisodes',
  'runtimeMinutes',
  'season',
  'episode',
  'viaService',
  'watchedAt',
  'deleted',
  '_key',
];

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

function compactEntry(entry) {
  const out = {};
  for (const key of HISTORY_FIELDS) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  if (isTombstone(entry)) {
    const key = entry._key || entryKey(entry);
    if (!key) return null;
    return { _key: key, watchedAt: Number(entry.watchedAt) || 0, deleted: true };
  }

  if (
    entry.id == null ||
    !['movie', 'tv', 'anime'].includes(entry.mediaType) ||
    typeof entry.title !== 'string' ||
    !entry.title
  ) {
    return null;
  }

  const key = entry._key || entryKey(entry);
  if (!key) return null;

  return {
    ...compactEntry(entry),
    _key: key,
    watchedAt: Number(entry.watchedAt) || 0,
    deleted: false,
  };
}

export function normalizeHistory(entries, { limit = HISTORY_MAX_ENTRIES } = {}) {
  const byKey = new Map();
  for (const raw of entries || []) {
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
  return normalizeHistory([...(remote || []), ...(local || [])], {
    limit: Number.POSITIVE_INFINITY,
  });
}

export function pruneOldTombstones(entries, maxAgeMs = TOMBSTONE_MAX_AGE_MS) {
  const cutoff = Date.now() - maxAgeMs;
  return (entries || []).filter((entry) => !isTombstone(entry) || (entry.watchedAt ?? 0) >= cutoff);
}

// Una card per titolo: per le serie resta l'episodio visto più di recente.
export function groupHistoryByShow(history) {
  const seen = new Map();
  for (const entry of history || []) {
    const key = showKey(entry);
    if (key && !seen.has(key)) seen.set(key, entry);
  }
  return [...seen.values()];
}

// Parametri e filtri della pagina /search.
// La ricerca vive nell'URL (?q=...&type=...&year=...): è condivisibile,
// sopravvive al reload e permette al tasto Indietro di tornare alla ricerca
// precedente senza creare una voce di cronologia per ogni lettera digitata.

export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 120;

export const SEARCH_TYPES = ['all', 'movie', 'tv', 'anime'];
export const SEARCH_YEAR_BUCKETS = ['all', '2020s', '2010s', '2000s', '1990s', 'older'];
export const SEARCH_RATINGS = ['all', '6', '7', '8'];
export const SEARCH_SORTS = ['relevance', 'rating', 'newest'];

export const DEFAULT_SEARCH_FILTERS = Object.freeze({
  type: 'all',
  year: 'all',
  rating: 'all',
  sort: 'relevance',
});

function pickAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function sanitizeSearchQuery(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_QUERY_MAX_LENGTH);
}

export function normalizeSearchFilters(filters = {}) {
  return {
    type: pickAllowed(filters.type, SEARCH_TYPES, DEFAULT_SEARCH_FILTERS.type),
    year: pickAllowed(filters.year, SEARCH_YEAR_BUCKETS, DEFAULT_SEARCH_FILTERS.year),
    rating: pickAllowed(filters.rating, SEARCH_RATINGS, DEFAULT_SEARCH_FILTERS.rating),
    sort: pickAllowed(filters.sort, SEARCH_SORTS, DEFAULT_SEARCH_FILTERS.sort),
  };
}

export function parseSearchParams(search = '') {
  const params = new URLSearchParams(search);
  return {
    q: sanitizeSearchQuery(params.get('q')),
    ...normalizeSearchFilters({
      type: params.get('type'),
      year: params.get('year'),
      rating: params.get('rating'),
      sort: params.get('sort'),
    }),
  };
}

export function parseSearchPath(path = '') {
  const questionMark = String(path).indexOf('?');
  return parseSearchParams(questionMark === -1 ? '' : String(path).slice(questionMark + 1));
}

export function buildSearchPath({ q, ...filters } = {}) {
  const query = sanitizeSearchQuery(q);
  // Senza una query la pagina è /search pulita: i filtri non hanno senso
  // finché non c'è qualcosa da filtrare.
  if (!query) return '/search';

  const normalized = normalizeSearchFilters(filters);
  const params = new URLSearchParams();
  params.set('q', query);
  if (normalized.type !== DEFAULT_SEARCH_FILTERS.type) params.set('type', normalized.type);
  if (normalized.year !== DEFAULT_SEARCH_FILTERS.year) params.set('year', normalized.year);
  if (normalized.rating !== DEFAULT_SEARCH_FILTERS.rating) {
    params.set('rating', normalized.rating);
  }
  if (normalized.sort !== DEFAULT_SEARCH_FILTERS.sort) params.set('sort', normalized.sort);
  return `/search?${params.toString()}`;
}

export function searchFiltersEqual(a, b) {
  const first = normalizeSearchFilters(a);
  const second = normalizeSearchFilters(b);
  return (
    first.type === second.type &&
    first.year === second.year &&
    first.rating === second.rating &&
    first.sort === second.sort
  );
}

function matchesYear(year, bucket) {
  const numeric = Number.parseInt(year, 10);
  if (!Number.isFinite(numeric)) return false;
  if (bucket === '2020s') return numeric >= 2020;
  if (bucket === '2010s') return numeric >= 2010 && numeric <= 2019;
  if (bucket === '2000s') return numeric >= 2000 && numeric <= 2009;
  if (bucket === '1990s') return numeric >= 1990 && numeric <= 1999;
  if (bucket === 'older') return numeric < 1990;
  return true;
}

function byRating(a, b) {
  return (
    Number(b.voteAverage || 0) - Number(a.voteAverage || 0) ||
    Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
    String(a.title || '').localeCompare(String(b.title || ''))
  );
}

export function filterAndSortSearchResults(items, filters = {}) {
  const normalized = normalizeSearchFilters(filters);
  const filtered = (Array.isArray(items) ? items : []).filter((item) => {
    if (!item) return false;
    if (normalized.type !== 'all' && item.mediaType !== normalized.type) return false;
    if (normalized.year !== 'all' && !matchesYear(item.year, normalized.year)) return false;
    if (
      normalized.rating !== 'all' &&
      Number(item.voteAverage || 0) < Number(normalized.rating)
    ) {
      return false;
    }
    return true;
  });

  if (normalized.sort === 'rating') return filtered.sort(byRating);
  if (normalized.sort === 'newest') {
    return filtered.sort((a, b) => {
      const dateA = a.releaseDate || (a.year ? `${a.year}-01-01` : '');
      const dateB = b.releaseDate || (b.year ? `${b.year}-01-01` : '');
      return String(dateB).localeCompare(String(dateA)) || byRating(a, b);
    });
  }
  // 'relevance': conserva l'ordine di TMDb.
  return filtered;
}

export function mergeSearchResults(current, incoming) {
  const merged = [];
  const seen = new Set();
  for (const item of [...(current || []), ...(incoming || [])]) {
    if (!item) continue;
    const key = `${item.mediaType}-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { t, tmdbLangCode } from '../i18n';
import { searchMulti } from '../api/tmdb';
import MediaCard from '../components/MediaCard';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { CARD_RADIUS } from '../theme';
import {
  DEFAULT_SEARCH_FILTERS,
  SEARCH_MIN_QUERY_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_RATINGS,
  buildSearchPath,
  filterAndSortSearchResults,
  mergeSearchResults,
  normalizeSearchFilters,
  parseSearchPath,
  sanitizeSearchQuery,
  searchFiltersEqual,
} from '../utils/searchParams';

// La ricerca parte poco dopo l'ultimo carattere: abbastanza per non
// martellare TMDb mentre si scrive, abbastanza poco per sembrare immediata.
const SEARCH_DEBOUNCE_MS = 350;
// Due pagine alla prima ricerca (fino a 40 titoli) e due per ogni "Carica
// altri": una pagina sola costringerebbe a cliccare troppo spesso, troppe
// pagine renderebbero il primo risultato lento da mostrare.
const PAGES_PER_REQUEST = 2;

// Cache dei risultati solo in memoria (mai su disco): serve a ripristinare
// all'istante la ricerca tornando da un dettaglio o usando Indietro/Avanti.
// Scade dopo 5 minuti e contiene al massimo poche ricerche, così non cresce
// senza controllo durante una sessione lunga.
const RESULT_CACHE_TTL_MS = 5 * 60 * 1000;
const RESULT_CACHE_MAX = 12;
const resultCache = new Map();

function cacheKey(query, lang) {
  return `${lang}|${query.toLocaleLowerCase()}`;
}

function readResultCache(query, lang) {
  const key = cacheKey(query, lang);
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > RESULT_CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  // Rinfresca la posizione nella Map: le voci usate di recente restano,
  // le più vecchie vengono scartate per prime.
  resultCache.delete(key);
  resultCache.set(key, entry);
  return entry;
}

function writeResultCache(query, lang, entry) {
  const key = cacheKey(query, lang);
  resultCache.delete(key);
  resultCache.set(key, { ...entry, storedAt: Date.now() });
  while (resultCache.size > RESULT_CACHE_MAX) {
    resultCache.delete(resultCache.keys().next().value);
  }
}

function filtersFromParsed(parsed) {
  return {
    type: parsed.type,
    year: parsed.year,
    rating: parsed.rating,
    sort: parsed.sort,
  };
}

function typeLabelFor(lang, mediaType) {
  if (mediaType === 'movie') return t(lang, 'media_movie');
  if (mediaType === 'anime') return t(lang, 'media_anime');
  return t(lang, 'media_tv');
}

function FilterSelect({ label, value, options, onChange, sx }) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={sx}>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

const resultsGridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
  gap: { xs: 1.5, sm: 2.5 },
};

function ResultsSkeleton({ count = 12 }) {
  return (
    <Box sx={resultsGridSx} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Box key={index}>
          <Skeleton
            variant="rounded"
            sx={{ width: '100%', aspectRatio: '2 / 3', borderRadius: `${CARD_RADIUS}px` }}
          />
          <Skeleton width="78%" height={20} sx={{ mt: 0.75 }} />
          <Skeleton width="42%" height={16} />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Pagina /search.
 *
 * La query e i filtri vivono nell'URL: la pagina è condivisibile (es.
 * /search?q=dune&type=movie), sopravvive al reload e il tasto Indietro
 * riporta alla ricerca precedente. L'URL viene aggiornato con replace solo
 * quando la ricerca parte davvero (dopo il debounce) o cambia un filtro:
 * non crea una voce di cronologia per ogni lettera digitata.
 */
export default function SearchPage({ lang, path, onOpenDetail, onPrefetch, replace }) {
  const initialRef = useRef(null);
  if (initialRef.current === null) initialRef.current = parseSearchPath(path);
  const initial = initialRef.current;
  const initialCache =
    initial.q.length >= SEARCH_MIN_QUERY_LENGTH ? readResultCache(initial.q, lang) : null;

  const [query, setQuery] = useState(initial.q);
  const [filters, setFilters] = useState(() => filtersFromParsed(initial));
  const [results, setResults] = useState(() => initialCache?.items ?? []);
  const [page, setPage] = useState(() => initialCache?.page ?? 0);
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages ?? 0);
  const [resultsQuery, setResultsQuery] = useState(initialCache ? initial.q : '');
  const [status, setStatus] = useState(
    initialCache
      ? 'success'
      : initial.q.length >= SEARCH_MIN_QUERY_LENGTH
        ? 'loading'
        : 'idle'
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  // Cambiare questo contatore forza l'effetto di ricerca a ripartire subito
  // (Invio, "Riprova", back/forward), saltando il debounce.
  const [searchNonce, setSearchNonce] = useState(0);

  const inputRef = useRef(null);
  const pathRef = useRef(path);
  const queryRef = useRef(query);
  const filtersRef = useRef(filters);
  const langRef = useRef(lang);
  const requestRef = useRef({ id: 0, controller: null });
  const loadMoreAbortRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const initialSearchRef = useRef(initial.q.length >= SEARCH_MIN_QUERY_LENGTH);
  const skipDebounceRef = useRef(false);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  // Solo su desktop con mouse/trackpad: su mobile il focus automatico
  // aprirebbe la tastiera appena si tocca l'icona di ricerca.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)')?.matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const syncUrl = useCallback(
    (rawQuery, nextFilters) => {
      const next = buildSearchPath({ q: rawQuery, ...nextFilters });
      if (next === pathRef.current) return;
      // Conserva lo state della voce corrente (posizione di scorrimento,
      // seed del dettaglio): replace non deve cancellarlo.
      replace(next, window.history.state);
    },
    [replace]
  );

  const applyResultSet = useCallback((entry, committedQuery) => {
    setResults(entry.items);
    setPage(entry.page);
    setTotalPages(entry.totalPages);
    setResultsQuery(committedQuery);
    setStatus('success');
    setLoadMoreError(false);
  }, []);

  const clearResults = useCallback(() => {
    requestRef.current.controller?.abort();
    requestRef.current.id += 1;
    loadMoreAbortRef.current?.abort();
    loadingMoreRef.current = false;
    skipDebounceRef.current = false;
    setResults([]);
    setPage(0);
    setTotalPages(0);
    setResultsQuery('');
    setStatus('idle');
    setLoadingMore(false);
    setLoadMoreError(false);
  }, []);

  const runSearch = useCallback(
    async (rawQuery) => {
      const q = sanitizeSearchQuery(rawQuery);
      if (q.length < SEARCH_MIN_QUERY_LENGTH) return;

      // Una nuova ricerca invalida sia quella precedente sia un eventuale
      // "Carica altri" ancora in volo.
      loadMoreAbortRef.current?.abort();
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setLoadMoreError(false);

      requestRef.current.controller?.abort();
      const controller = new AbortController();
      const id = requestRef.current.id + 1;
      requestRef.current = { id, controller };

      // Tornando su una ricerca recente i risultati sono già pronti: nessun
      // skeleton e nessuna richiesta di rete.
      const cached = readResultCache(q, lang);
      if (cached) {
        applyResultSet(cached, q);
        return;
      }

      setStatus('loading');
      try {
        const settled = await Promise.allSettled(
          Array.from({ length: PAGES_PER_REQUEST }, (_, index) =>
            searchMulti(q, tmdbLangCode(lang), {
              signal: controller.signal,
              page: index + 1,
            })
          )
        );
        // Una risposta arrivata dopo che l'utente ha già cambiato query non
        // deve mai sovrascrivere la UI.
        if (requestRef.current.id !== id) return;

        const loadedPages = settled
          .filter((outcome) => outcome.status === 'fulfilled')
          .map((outcome) => outcome.value);
        if (loadedPages.length === 0) {
          const failure = settled.find((outcome) => outcome.status === 'rejected');
          throw failure?.reason ?? new Error('Search failed');
        }

        const entry = {
          items: mergeSearchResults([], loadedPages.flatMap((result) => result.items)),
          page: Math.max(...loadedPages.map((result) => result.page)),
          totalPages: Math.max(...loadedPages.map((result) => result.totalPages)),
        };
        writeResultCache(q, lang, entry);
        applyResultSet(entry, q);
      } catch (error) {
        if (requestRef.current.id !== id || controller.signal.aborted) return;
        console.error('[Stream8 Search] ricerca fallita:', error);
        setStatus('error');
      }
    },
    [lang, applyResultSet]
  );

  // Debounce della digitazione. Invio, "Riprova" e i cambi di URL esterni
  // alzano searchNonce e saltano l'attesa.
  useEffect(() => {
    const q = sanitizeSearchQuery(query);
    if (q.length < SEARCH_MIN_QUERY_LENGTH) {
      clearResults();
      syncUrl('', filtersRef.current);
      return undefined;
    }

    const delay =
      initialSearchRef.current || skipDebounceRef.current ? 0 : SEARCH_DEBOUNCE_MS;
    const timer = setTimeout(() => {
      initialSearchRef.current = false;
      skipDebounceRef.current = false;
      runSearch(q);
      syncUrl(q, filtersRef.current);
    }, delay);
    return () => clearTimeout(timer);
  }, [query, lang, searchNonce, runSearch, syncUrl, clearResults]);

  // Il cambio di un filtro non richiede una nuova richiesta (i filtri sono
  // applicati ai risultati già caricati), ma deve finire subito nell'URL.
  useEffect(() => {
    const q = sanitizeSearchQuery(queryRef.current);
    syncUrl(q.length >= SEARCH_MIN_QUERY_LENGTH ? q : '', filters);
  }, [filters, syncUrl]);

  // Back/forward (o un link diretto) cambiano il path sotto la pagina: qui
  // riallineiamo input, filtri e risultati. Se i valori coincidono con
  // quelli già mostrati, è solo l'eco di un nostro replace: nessun lavoro.
  useEffect(() => {
    const parsed = parseSearchPath(path);
    if (
      parsed.q === queryRef.current &&
      searchFiltersEqual(parsed, filtersRef.current)
    ) {
      return;
    }

    const nextFilters = filtersFromParsed(parsed);
    queryRef.current = parsed.q;
    filtersRef.current = nextFilters;
    setQuery(parsed.q);
    setFilters(nextFilters);

    if (parsed.q.length < SEARCH_MIN_QUERY_LENGTH) {
      clearResults();
      return;
    }

    const cached = readResultCache(parsed.q, langRef.current);
    if (cached) {
      applyResultSet(cached, parsed.q);
    } else {
      clearResults();
      setStatus('loading');
    }
    // Dopo clearResults (che azzera il flag): il cambio di URL deve
    // ripartire subito, senza un secondo debounce.
    skipDebounceRef.current = true;
    setSearchNonce((value) => value + 1);
  }, [path, clearResults, applyResultSet]);

  const handleQueryChange = useCallback((event) => {
    const value = event.target.value;
    setQuery(value);
    if (sanitizeSearchQuery(value).length >= SEARCH_MIN_QUERY_LENGTH) {
      setStatus('loading');
    }
  }, []);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (sanitizeSearchQuery(queryRef.current).length < SEARCH_MIN_QUERY_LENGTH) return;
      skipDebounceRef.current = true;
      setSearchNonce((value) => value + 1);
    },
    []
  );

  const handleClearQuery = useCallback(() => {
    setQuery('');
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleEscape = useCallback((event) => {
    if (event.key === 'Escape' && event.target.value) {
      event.preventDefault();
      setQuery('');
    }
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFilters((current) =>
      current[key] === value ? current : normalizeSearchFilters({ ...current, [key]: value })
    );
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_SEARCH_FILTERS });
  }, []);

  const retrySearch = useCallback(() => {
    skipDebounceRef.current = true;
    setStatus('loading');
    setSearchNonce((value) => value + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !resultsQuery) return;
    const nextPage = page + 1;
    if (nextPage > totalPages) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);

    const controller = new AbortController();
    loadMoreAbortRef.current?.abort();
    loadMoreAbortRef.current = controller;

    const lastPage = Math.min(totalPages, nextPage + PAGES_PER_REQUEST - 1);
    const requestedPages = [];
    for (let p = nextPage; p <= lastPage; p += 1) requestedPages.push(p);

    try {
      const settled = await Promise.allSettled(
        requestedPages.map((p) =>
          searchMulti(resultsQuery, tmdbLangCode(langRef.current), {
            signal: controller.signal,
            page: p,
          })
        )
      );
      if (controller.signal.aborted) return;

      const loadedPages = settled
        .filter((outcome) => outcome.status === 'fulfilled')
        .map((outcome) => outcome.value);
      if (loadedPages.length === 0) {
        const failure = settled.find((outcome) => outcome.status === 'rejected');
        throw failure?.reason ?? new Error('Search failed');
      }

      const entry = {
        items: mergeSearchResults(results, loadedPages.flatMap((result) => result.items)),
        page: Math.max(...loadedPages.map((result) => result.page)),
        totalPages: Math.max(...loadedPages.map((result) => result.totalPages)),
      };
      writeResultCache(resultsQuery, langRef.current, entry);
      setResults(entry.items);
      setPage(entry.page);
      setTotalPages(entry.totalPages);
      setLoadMoreError(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('[Stream8 Search] caricamento altri risultati fallito:', error);
        setLoadMoreError(true);
      }
    } finally {
      loadingMoreRef.current = false;
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [resultsQuery, page, totalPages, results]);

  const visibleResults = useMemo(
    () => filterAndSortSearchResults(results, filters),
    [results, filters]
  );

  const filtersActive = !searchFiltersEqual(filters, DEFAULT_SEARCH_FILTERS);
  const trimmedQuery = sanitizeSearchQuery(query);
  const waitingForMinLength = trimmedQuery.length < SEARCH_MIN_QUERY_LENGTH;
  const hasMore = page > 0 && page < totalPages;

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: t(lang, 'search_type_all') },
      { value: 'movie', label: t(lang, 'media_movie') },
      { value: 'tv', label: t(lang, 'media_tv') },
      { value: 'anime', label: t(lang, 'media_anime') },
    ],
    [lang]
  );

  const yearOptions = useMemo(
    () => [
      { value: 'all', label: t(lang, 'search_year_all') },
      { value: '2020s', label: t(lang, 'search_year_2020s') },
      { value: '2010s', label: t(lang, 'search_year_2010s') },
      { value: '2000s', label: t(lang, 'search_year_2000s') },
      { value: '1990s', label: t(lang, 'search_year_1990s') },
      { value: 'older', label: t(lang, 'search_year_older') },
    ],
    [lang]
  );

  const ratingOptions = useMemo(
    () => [
      { value: 'all', label: t(lang, 'search_rating_all') },
      ...SEARCH_RATINGS.filter((value) => value !== 'all').map((value) => ({
        value,
        label: `${value}+`,
      })),
    ],
    [lang]
  );

  const sortOptions = useMemo(
    () => [
      { value: 'relevance', label: t(lang, 'search_sort_relevance') },
      { value: 'rating', label: t(lang, 'search_sort_rating') },
      { value: 'newest', label: t(lang, 'search_sort_newest') },
    ],
    [lang]
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, pb: { xs: 8, sm: 10 } }}>
      <PageHeader
        icon={<SearchRoundedIcon />}
        title={t(lang, 'search_title')}
        subtitle={t(lang, 'search_subtitle')}
      />

      <Box
        component="form"
        role="search"
        onSubmit={handleSubmit}
        sx={{ maxWidth: 760 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleEscape}
          placeholder={t(lang, 'search_placeholder')}
          type="text"
          autoComplete="off"
          spellCheck={false}
          inputProps={{
            'aria-label': t(lang, 'search_placeholder'),
            enterKeyHint: 'search',
            maxLength: SEARCH_QUERY_MAX_LENGTH,
          }}
          InputProps={{
            startAdornment: (
              <Box sx={{ display: 'flex', color: 'text.secondary', mr: 1 }}>
                <SearchRoundedIcon fontSize="small" />
              </Box>
            ),
            endAdornment: (
              <Stack direction="row" spacing={0.5} alignItems="center">
                {status === 'loading' && <CircularProgress size={16} />}
                {query && (
                  <IconButton
                    size="small"
                    onClick={handleClearQuery}
                    aria-label={t(lang, 'search_clear')}>
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: { xs: '1rem', sm: '1.0625rem' },
              py: { xs: 1, sm: 1.25 },
            },
          }}
        />
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mt: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filters.type}
          onChange={(_, value) => value && updateFilter('type', value)}
          aria-label={t(lang, 'search_filter_type')}
          sx={{
            flexWrap: 'wrap',
            gap: 0.75,
            '& .MuiToggleButtonGroup-grouped': {
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '9px !important',
              ml: '0 !important',
              px: 1.5,
              py: 0.5,
              fontSize: '0.8125rem',
            },
          }}>
          {typeOptions.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ flex: 1, minWidth: 0 }}>
          <FilterSelect
            label={t(lang, 'search_filter_year')}
            value={filters.year}
            options={yearOptions}
            onChange={(value) => updateFilter('year', value)}
            sx={{ flex: '1 1 116px', minWidth: 0 }}
          />
          <FilterSelect
            label={t(lang, 'search_filter_rating')}
            value={filters.rating}
            options={ratingOptions}
            onChange={(value) => updateFilter('rating', value)}
            sx={{ flex: '1 1 104px', minWidth: 0 }}
          />
          <FilterSelect
            label={t(lang, 'search_filter_sort')}
            value={filters.sort}
            options={sortOptions}
            onChange={(value) => updateFilter('sort', value)}
            sx={{ flex: '1 1 120px', minWidth: 0 }}
          />
        </Stack>

        {filtersActive && (
          <Button
            size="small"
            onClick={clearFilters}
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', md: 'center' } }}>
            {t(lang, 'search_clear_filters')}
          </Button>
        )}
      </Stack>

      <LinearProgress
        sx={{
          mt: 1.5,
          height: 3,
          borderRadius: 2,
          visibility: status === 'loading' || loadingMore ? 'visible' : 'hidden',
        }}
      />

      <Box sx={{ mt: { xs: 2.5, sm: 3.5 } }}>
        {status === 'error' ? (
          <EmptyState
            icon={<ErrorOutlineRoundedIcon />}
            title={t(lang, 'search_error_title')}
            body={t(lang, 'search_error_body')}
            action={
              <Button variant="contained" onClick={retrySearch}>
                {t(lang, 'retry')}
              </Button>
            }
          />
        ) : resultsQuery ? (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={0.25}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'baseline' }}
              sx={{ mb: 2 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700, minWidth: 0 }}>
                {t(lang, 'search_results_for')}{' '}
                <Box component="span" sx={{ color: 'primary.main' }}>
                  “{resultsQuery}”
                </Box>
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                role="status"
                aria-live="polite">
                {status === 'loading'
                  ? t(lang, 'search_loading')
                  : `${visibleResults.length} ${
                      visibleResults.length === 1
                        ? t(lang, 'search_result_one')
                        : t(lang, 'search_results_count')
                    }`}
              </Typography>
            </Stack>

            {visibleResults.length === 0 ? (
              status === 'loading' && results.length === 0 ? (
                <ResultsSkeleton />
              ) : (
                <EmptyState
                  icon={<SearchOffRoundedIcon />}
                  title={t(lang, 'search_no_results_title')}
                  body={t(lang, 'search_no_results_body')}
                  action={
                    filtersActive ? (
                      <Button variant="outlined" onClick={clearFilters}>
                        {t(lang, 'search_clear_filters')}
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <Box sx={resultsGridSx}>
                {visibleResults.map((item) => (
                  <Box
                    key={`${item.mediaType}-${item.id}`}
                    sx={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}>
                    <MediaCard
                      item={item}
                      fullWidth
                      onSelect={onOpenDetail}
                      onPrefetch={onPrefetch}
                      secondaryText={[typeLabelFor(lang, item.mediaType), item.year]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </Box>
                ))}
              </Box>
            )}

            {status === 'success' && hasMore && (
              <Stack alignItems="center" spacing={1.5} sx={{ mt: 4 }}>
                {loadMoreError && (
                  <Alert severity="error" sx={{ width: '100%', maxWidth: 480 }}>
                    {t(lang, 'search_load_error')}
                  </Alert>
                )}
                <Button
                  variant="outlined"
                  onClick={loadMore}
                  disabled={loadingMore}
                  startIcon={
                    loadingMore ? <CircularProgress size={16} color="inherit" /> : undefined
                  }>
                  {t(lang, 'search_load_more')}
                </Button>
              </Stack>
            )}
          </>
        ) : !waitingForMinLength ? (
          <ResultsSkeleton />
        ) : (
          <EmptyState
            icon={<SearchRoundedIcon />}
            title={t(lang, 'search_empty_title')}
            body={t(lang, 'search_empty_body')}
          />
        )}
      </Box>
    </Container>
  );
}

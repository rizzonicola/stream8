import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Container, Skeleton, Typography } from '@mui/material';
import HeroSlider from '../components/HeroSlider';
import HistorySection from '../components/HistorySection';
import HorizontalList from '../components/HorizontalList';
import { VIEWS } from '../utils/router';
import { useHistory } from '../context/HistoryContext';
import { t, tmdbLangCode } from '../i18n';
import {
  fetchRecentMoviesForHero,
  fetchRecentSeriesForHero,
  fetchRecentAnimeForHero,
  fetchRecommendedMovies,
  fetchRecommendedSeries,
  fetchRecommendedAnime,
} from '../api/tmdb';

// L'hero risale sotto la navbar flottante di esattamente la sua altezza.
// Su iPhone con notch/Dynamic Island quell'altezza cresce di
// env(safe-area-inset-top): senza tenerne conto l'hero risalirebbe troppo.
const NAVBAR_PULLUP = {
  xs: 'calc(-94px - env(safe-area-inset-top, 0px))',
  md: 'calc(-106px - env(safe-area-inset-top, 0px))',
};

const GUTTER = { xs: 2, sm: 3, md: 4 };

function interleave(...lists) {
  const max = Math.max(...lists.map((l) => l.length));
  const out = [];
  for (let i = 0; i < max; i++) {
    lists.forEach((l) => {
      if (l[i]) out.push(l[i]);
    });
  }
  return out;
}

function HeroSkeleton() {
  return (
    <Box aria-busy="true">
      <Skeleton variant="rectangular" height={{ xs: 440, md: 540 }} sx={{ borderRadius: 0 }} />
    </Box>
  );
}

function SectionSkeleton({ title }) {
  return (
    <Box component="section" aria-busy="true" sx={{ mb: { xs: 3.5, sm: 4.5 } }}>
      <Typography variant="h6" component="h2" sx={{ px: GUTTER, mb: 1.25 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, px: GUTTER, overflow: 'hidden' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} sx={{ width: { xs: 132, sm: 156 }, flexShrink: 0 }}>
            <Skeleton
              variant="rectangular"
              height={{ xs: 198, sm: 234 }}
              sx={{ borderRadius: '12px' }}
            />
            <Skeleton variant="text" width="82%" sx={{ mt: 1 }} />
            <Skeleton variant="text" width="35%" />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SectionError({ lang, title, onRetry }) {
  return (
    <Box component="section" sx={{ mb: { xs: 3.5, sm: 4.5 } }}>
      <Typography variant="h6" component="h2" sx={{ px: GUTTER, mb: 0.5 }}>
        {title}
      </Typography>
      <Box sx={{ px: GUTTER }}>
        <Typography variant="body2" color="text.secondary" component="span" sx={{ mr: 1.5 }}>
          {t(lang, 'load_error')}
        </Typography>
        <Button size="small" onClick={onRetry}>
          {t(lang, 'retry')}
        </Button>
      </Box>
    </Box>
  );
}

function useMediaItems(enabled, fetcher, lang) {
  const [state, setState] = useState({ items: [], loading: enabled, error: false, loaded: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: prev.items.length === 0, error: false }));
    fetcher(tmdbLangCode(lang))
      .then((items) => {
        if (!cancelled) setState({ items, loading: false, error: false, loaded: true });
      })
      .catch(() => {
        if (!cancelled) setState({ items: [], loading: false, error: true, loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetcher, lang, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}

export default function HomePage({ lang, view, onOpenDetail, onPrefetch }) {
  const { groupedHistory, removeShow } = useHistory();

  const needsMovies = view === VIEWS.HOME || view === VIEWS.MOVIES;
  const needsSeries = view === VIEWS.HOME || view === VIEWS.SERIES;
  const needsAnime = view === VIEWS.HOME || view === VIEWS.ANIME;

  const [hero, setHero] = useState({ items: [], loading: true, error: false });
  const [heroAttempt, setHeroAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setHero({ items: [], loading: true, error: false });
    const tmdbLang = tmdbLangCode(lang);

    const requests = [];
    if (needsMovies) requests.push(fetchRecentMoviesForHero(tmdbLang).catch(() => []));
    if (needsSeries) requests.push(fetchRecentSeriesForHero(tmdbLang).catch(() => []));
    if (needsAnime) requests.push(fetchRecentAnimeForHero(tmdbLang).catch(() => []));

    Promise.all(requests).then((lists) => {
      if (cancelled) return;
      let items = [];
      if (view === VIEWS.HOME) items = interleave(...lists).slice(0, 12);
      else items = (lists[0] || []).slice(0, 10);
      setHero({ items, loading: false, error: items.length === 0 });
    });

    return () => {
      cancelled = true;
    };
  }, [view, lang, heroAttempt, needsMovies, needsSeries, needsAnime]);

  const movies = useMediaItems(needsMovies, fetchRecommendedMovies, lang);
  const series = useMediaItems(needsSeries, fetchRecommendedSeries, lang);
  const anime = useMediaItems(needsAnime, fetchRecommendedAnime, lang);

  const heroIds = useMemo(
    () => new Set(hero.items.map((item) => `${item.mediaType}-${item.id}`)),
    [hero.items]
  );
  const withoutHero = useCallback(
    (items) => items.filter((item) => !heroIds.has(`${item.mediaType}-${item.id}`)),
    [heroIds]
  );
  const movieItems = useMemo(() => withoutHero(movies.items), [withoutHero, movies.items]);
  const seriesItems = useMemo(() => withoutHero(series.items), [withoutHero, series.items]);
  const animeItems = useMemo(() => withoutHero(anime.items), [withoutHero, anime.items]);

  const retryHero = useCallback(() => setHeroAttempt((value) => value + 1), []);

  return (
    <Box>
      <Box sx={{ mt: NAVBAR_PULLUP }}>
        {hero.loading ? (
          <HeroSkeleton />
        ) : hero.error ? (
          <Box
            sx={{
              height: { xs: 240, md: 300 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}>
            <Typography variant="body2" color="text.secondary">
              {t(lang, 'load_error')}
            </Typography>
            <Button size="small" onClick={retryHero}>
              {t(lang, 'retry')}
            </Button>
          </Box>
        ) : (
          <HeroSlider
            lang={lang}
            items={hero.items}
            onSelect={onOpenDetail}
            onPrefetch={onPrefetch}
          />
        )}
      </Box>

      <Container maxWidth="xl" disableGutters sx={{ pt: { xs: 2.5, sm: 3.5 }, pb: { xs: 6, sm: 8 } }}>
        <HistorySection
          lang={lang}
          history={groupedHistory}
          onSelect={onOpenDetail}
          onRemove={removeShow}
          onPrefetch={onPrefetch}
        />

        {needsMovies &&
          (movies.loading || !movies.loaded ? (
            <SectionSkeleton title={t(lang, 'section_movies')} />
          ) : movies.error ? (
            <SectionError lang={lang} title={t(lang, 'section_movies')} onRetry={movies.retry} />
          ) : (
            <HorizontalList
              lang={lang}
              title={t(lang, 'section_movies')}
              items={movieItems}
              onSelect={onOpenDetail}
              onPrefetch={onPrefetch}
            />
          ))}

        {needsSeries &&
          (series.loading || !series.loaded ? (
            <SectionSkeleton title={t(lang, 'section_series')} />
          ) : series.error ? (
            <SectionError lang={lang} title={t(lang, 'section_series')} onRetry={series.retry} />
          ) : (
            <HorizontalList
              lang={lang}
              title={t(lang, 'section_series')}
              items={seriesItems}
              onSelect={onOpenDetail}
              onPrefetch={onPrefetch}
            />
          ))}

        {needsAnime &&
          (anime.loading || !anime.loaded ? (
            <SectionSkeleton title={t(lang, 'section_anime')} />
          ) : anime.error ? (
            <SectionError lang={lang} title={t(lang, 'section_anime')} onRetry={anime.retry} />
          ) : (
            <HorizontalList
              lang={lang}
              title={t(lang, 'section_anime')}
              items={animeItems}
              onSelect={onOpenDetail}
              onPrefetch={onPrefetch}
            />
          ))}
      </Container>
    </Box>
  );
}

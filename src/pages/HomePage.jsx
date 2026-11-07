import { useEffect, useState } from 'react';
import { Box, Container, Skeleton } from '@mui/material';
import HeroSlider from '../components/HeroSlider';
import HistorySection from '../components/HistorySection';
import HorizontalList from '../components/HorizontalList';
import { VIEWS } from '../components/NavBar';
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

function HomeSkeleton() {
  return (
    <Box aria-busy="true">
      <Box sx={{ mt: NAVBAR_PULLUP }}>
        <Skeleton
          variant="rectangular"
          height={{ xs: 440, md: 540 }}
          sx={{ borderRadius: 0 }}
        />
      </Box>
      <Container maxWidth="xl" disableGutters sx={{ pt: 3.5 }}>
        <Skeleton
          variant="text"
          width={220}
          height={36}
          sx={{ ml: GUTTER, mb: 2, maxWidth: '60%' }}
        />
        <Box sx={{ display: 'flex', gap: 2, px: GUTTER, overflow: 'hidden' }}>
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
      </Container>
    </Box>
  );
}

export default function HomePage({ lang, view, onOpenDetail }) {
  const { groupedHistory, removeEntry } = useHistory();

  const [heroItems, setHeroItems] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [anime, setAnime] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const tmdbLang = tmdbLangCode(lang);

    async function load() {
      // Per le viste Film/Serie/Anime servono solo i dati di quella
      // categoria (hero + sezione), non tutte e sei le liste.
      const needsMovies = view === VIEWS.HOME || view === VIEWS.MOVIES;
      const needsSeries = view === VIEWS.HOME || view === VIEWS.SERIES;
      const needsAnime = view === VIEWS.HOME || view === VIEWS.ANIME;

      const [recentMovies, recentSeries, recentAnime, recMovies, recSeries, recAnime] =
        await Promise.all([
          needsMovies ? fetchRecentMoviesForHero(tmdbLang).catch(() => []) : Promise.resolve([]),
          needsSeries ? fetchRecentSeriesForHero(tmdbLang).catch(() => []) : Promise.resolve([]),
          needsAnime ? fetchRecentAnimeForHero(tmdbLang).catch(() => []) : Promise.resolve([]),
          needsMovies ? fetchRecommendedMovies(tmdbLang).catch(() => []) : Promise.resolve([]),
          needsSeries ? fetchRecommendedSeries(tmdbLang).catch(() => []) : Promise.resolve([]),
          needsAnime ? fetchRecommendedAnime(tmdbLang).catch(() => []) : Promise.resolve([]),
        ]);

      if (cancelled) return;

      let hero = [];
      if (view === VIEWS.HOME) hero = interleave(recentMovies, recentSeries, recentAnime).slice(0, 12);
      else if (view === VIEWS.MOVIES) hero = recentMovies.slice(0, 10);
      else if (view === VIEWS.SERIES) hero = recentSeries.slice(0, 10);
      else if (view === VIEWS.ANIME) hero = recentAnime.slice(0, 10);

      const heroIds = new Set(hero.map((h) => `${h.mediaType}-${h.id}`));
      const dedupe = (list) => list.filter((it) => !heroIds.has(`${it.mediaType}-${it.id}`));

      setHeroItems(hero);
      setMovies(dedupe(recMovies));
      setSeries(dedupe(recSeries));
      setAnime(dedupe(recAnime));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [view, lang]);

  if (loading) return <HomeSkeleton />;

  return (
    <Box>
      <Box sx={{ mt: NAVBAR_PULLUP }}>
        <HeroSlider lang={lang} items={heroItems} onSelect={onOpenDetail} />
      </Box>

      <Container maxWidth="xl" disableGutters sx={{ pt: { xs: 2.5, sm: 3.5 }, pb: { xs: 6, sm: 8 } }}>
        <HistorySection
          lang={lang}
          history={groupedHistory}
          onSelect={onOpenDetail}
          onRemove={removeEntry}
        />

        {(view === VIEWS.HOME || view === VIEWS.MOVIES) && (
          <HorizontalList
            lang={lang}
            title={t(lang, 'section_movies')}
            items={movies}
            onSelect={onOpenDetail}
          />
        )}
        {(view === VIEWS.HOME || view === VIEWS.SERIES) && (
          <HorizontalList
            lang={lang}
            title={t(lang, 'section_series')}
            items={series}
            onSelect={onOpenDetail}
          />
        )}
        {(view === VIEWS.HOME || view === VIEWS.ANIME) && (
          <HorizontalList
            lang={lang}
            title={t(lang, 'section_anime')}
            items={anime}
            onSelect={onOpenDetail}
          />
        )}
      </Container>
    </Box>
  );
}

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Container } from '@mui/material';
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

// L'hero risale sotto la navbar flottante di esattamente la sua altezza
// (padding + toolbar + padding). Su iPhone con notch/Dynamic Island quella
// altezza cresce di env(safe-area-inset-top): senza tenerne conto qui,
// l'hero risalirebbe troppo o troppo poco su quei dispositivi. Su
// Android/desktop l'inset vale 0px, quindi il valore resta invariato.
const NAVBAR_PULLUP = {
  xs: 'calc(-76px - env(safe-area-inset-top, 0px))',
  md: 'calc(-88px - env(safe-area-inset-top, 0px))',
};

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
      // Evita chiamate TMDb inutili: per le viste Film/Serie/Anime servono
      // solo i dati di quella categoria (hero + sezione), non tutte e sei
      // le liste come accadeva prima. Solo la vista Home le richiede tutte.
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

  if (loading) {
    return (
      <Box sx={{ mt: NAVBAR_PULLUP, display: 'flex', justifyContent: 'center', pt: '156px', pb: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mt: NAVBAR_PULLUP }}>
        <HeroSlider lang={lang} items={heroItems} onSelect={onOpenDetail} />
      </Box>

      <Container maxWidth="xl" disableGutters sx={{ pt: 3 }}>
        <HistorySection
          lang={lang}
          history={groupedHistory}
          onSelect={onOpenDetail}
          onRemove={removeEntry}
        />

        {(view === VIEWS.HOME || view === VIEWS.MOVIES) && (
          <HorizontalList
            title={t(lang, 'section_movies')}
            items={movies}
            onSelect={onOpenDetail}
          />
        )}
        {(view === VIEWS.HOME || view === VIEWS.SERIES) && (
          <HorizontalList
            title={t(lang, 'section_series')}
            items={series}
            onSelect={onOpenDetail}
          />
        )}
        {(view === VIEWS.HOME || view === VIEWS.ANIME) && (
          <HorizontalList
            title={t(lang, 'section_anime')}
            items={anime}
            onSelect={onOpenDetail}
          />
        )}
      </Container>
    </Box>
  );
}

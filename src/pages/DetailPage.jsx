import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  Select,
  MenuItem,
  Avatar,
  Skeleton,
  alpha,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import {
  backdropUrl,
  backdropSrcSet,
  posterUrl,
  posterSrcSet,
} from '../utils/images';
import {
  fetchDetails,
  fetchCredits,
  fetchSeasonEpisodes,
} from '../api/tmdb';
import { tmdbLangCode, t } from '../i18n';
import { useSettings } from '../context/SettingsContext';
import { useHistory } from '../context/HistoryContext';
import { useConnectionHints } from '../hooks/useConnectionHints';
import WatchOnDialog from '../components/WatchOnDialog';
import { MAINSTREAM_SEARCH_PATTERN } from '../utils/streamingServices';
import { buildCustomUrl, pickPatternForItem } from '../utils/customConfigParser';
import { parseHttpUrl } from '../utils/urlSafety';
import { clearPersistedAnilistChain } from '../api/anilist';

// Alcuni titoli di episodi/stagioni sono molto lunghi (es. anime lunghi
// come One Piece): questo stile evita che spezzino il layout del select,
// troncandoli con "..." sia nel valore chiuso sia nella lista aperta. Il
// titolo completo resta comunque leggibile al passaggio del mouse/pressione
// prolungata grazie all'attributo title nativo del browser.
const ELLIPSIS_SX = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export default function DetailPage({ lang, params, seed, onBack, onSeasonEpisodeChange }) {
  const { mediaType, id } = params;
  const { settings } = useSettings();
  const { addEntry } = useHistory();
  const connection = useConnectionHints();
  const lowData = connection.saveData || /2g/.test(connection.effectiveType);

  const [details, setDetails] = useState(seed || { mediaType, id, title: '', overview: '' });
  const [cast, setCast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  // Se si arriva da un episodio della cronologia (o da un URL già
  // sincronizzato, es. dopo che il browser ha ricaricato la scheda), si
  // parte già da quella stagione/episodio invece che sempre dal primo.
  const [season, setSeason] = useState(params.season || 1);
  const [episode, setEpisode] = useState(params.episode || 1);
  const [watchOpen, setWatchOpen] = useState(false);
  const [anilistCacheMsg, setAnilistCacheMsg] = useState('');
  const [failedBackdropPath, setFailedBackdropPath] = useState(null);
  const [failedPosterPath, setFailedPosterPath] = useState(null);
  const latestSeasonRequest = useRef(params.season || 1);

  const isSeries = mediaType === 'tv' || mediaType === 'anime';
  const tmdbType = mediaType === 'anime' ? 'tv' : mediaType;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const tmdbLang = tmdbLangCode(lang);

    async function load() {
      const [full, castList] = await Promise.all([
        fetchDetails(id, tmdbType, tmdbLang).catch(() => null),
        fetchCredits(id, tmdbType, tmdbLang),
      ]);
      if (cancelled) return;

      if (full) setDetails({ ...full, mediaType });
      setCast(castList);

      // TMDb include già l'elenco delle stagioni nella risposta di
      // dettaglio: nessuna richiesta separata necessaria.
      const seasonList = isSeries ? full?.seasons || [] : [];
      if (isSeries && seasonList.length > 0) {
        setSeasons(seasonList);
        // Se l'episodio/stagione richiesti (cronologia o URL) esistono
        // ancora tra quelli disponibili, si riparte esattamente da lì;
        // altrimenti si ripiega sulla prima stagione come prima.
        const requestedSeason = seasonList.some((s) => s.seasonNumber === params.season)
          ? params.season
          : seasonList[0].seasonNumber;
        setSeason(requestedSeason);
        latestSeasonRequest.current = requestedSeason;
        const eps = await fetchSeasonEpisodes(id, requestedSeason, tmdbLang);
        if (!cancelled && latestSeasonRequest.current === requestedSeason) {
          setEpisodes(eps);
          const requestedEpisode = eps.some((e) => e.episodeNumber === params.episode)
            ? params.episode
            : eps[0]?.episodeNumber || 1;
          setEpisode(requestedEpisode);
        }
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mediaType, lang]);

  // Mantiene l'URL sincronizzato con la selezione corrente, così tornando
  // indietro (anche dopo che il browser ha eventualmente ricaricato la
  // scheda mentre si era su un servizio esterno) si ritrova la stessa
  // stagione/episodio, non sempre il primo.
  useEffect(() => {
    if (!isSeries || seasons.length === 0) return;
    onSeasonEpisodeChange?.(season, episode);
  }, [isSeries, seasons.length, season, episode, onSeasonEpisodeChange]);

  const handleSeasonChange = async (newSeason) => {
    setSeason(newSeason);
    latestSeasonRequest.current = newSeason;
    const tmdbLang = tmdbLangCode(lang);
    const eps = await fetchSeasonEpisodes(id, newSeason, tmdbLang);
    // Guard anti-race: se nel frattempo l'utente ha scelto un'altra
    // stagione, questa risposta è ormai obsoleta e va ignorata (altrimenti
    // una risposta arrivata in ritardo mostrerebbe gli episodi sbagliati).
    if (latestSeasonRequest.current !== newSeason) return;
    setEpisodes(eps);
    setEpisode(eps[0]?.episodeNumber || 1);
  };

  const backdrop =
    backdropUrl(details.backdropPath, lowData ? 'w780' : 'w1280') ||
    posterUrl(details.posterPath, lowData ? 'w185' : 'w780');
  const backdropSet =
    details.backdropPath && !lowData ? backdropSrcSet(details.backdropPath) : undefined;
  const poster = posterUrl(details.posterPath, lowData ? 'w185' : 'w342');
  const posterSet = lowData ? undefined : posterSrcSet(details.posterPath, { large: true });
  const backdropFailed = failedBackdropPath === details.backdropPath;
  const posterFailed = failedPosterPath === details.posterPath;

  // Anno di uscita della stagione TMDb correntemente selezionata (dal primo
  // episodio disponibile): usato solo come "spareggio" quando la catena di
  // sequel AniList presenta un bivio (più sequel diretti, es. spin-off o
  // linee temporali separate) — vedi resolveAnilistForSeason in
  // api/anilist.js. Non blocca né rallenta nulla: è un semplice calcolo
  // locale su dati già scaricati.
  const currentSeasonYear = useMemo(() => {
    const airDate = episodes[0]?.airDate;
    return airDate ? Number(airDate.slice(0, 4)) : undefined;
  }, [episodes]);

  const runtimeLabel = useMemo(() => {
    if (!details.runtimeMinutes) return null;
    const h = Math.floor(details.runtimeMinutes / 60);
    const m = details.runtimeMinutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m} ${t(lang, 'runtime_minutes')}`;
  }, [details.runtimeMinutes, lang]);

  const handleConfirmWatch = useCallback(
    ({ kind, service, item: target, watchLink, anilist, pendingTab }) => {
      let url;
      if (kind === 'mainstream') {
        // Se TMDb fornisce il link "watch" (JustWatch) per la regione, è la
        // via più vicina a un deep-link reale verso il servizio scelto;
        // altrimenti si ripiega su una ricerca per titolo sul sito stesso.
        const searchPattern = MAINSTREAM_SEARCH_PATTERN[service.id];
        if (watchLink) {
          url = watchLink;
        } else if (typeof searchPattern === 'string') {
          const query = encodeURIComponent(target.title);
          url = searchPattern.replace('{query}', query);
        }
      } else {
        const pattern = pickPatternForItem(service.config || {}, target);
        if (typeof pattern === 'string' && typeof service.baseUrl === 'string') {
          url = buildCustomUrl({
            pattern,
            baseUrl: service.baseUrl,
            tmdbId: target.id,
            season: isSeries ? season : undefined,
            episode: isSeries ? episode : undefined,
            anilistId: anilist?.anilistId,
            malId: anilist?.malId,
            title: target.title,
          });
        }
      }

      // Punto unico in cui un URL esterno viene aperto: qualunque sia la
      // provenienza (link TMDb, ricerca mainstream o pattern personalizzato
      // anche importato da un link condiviso), qui si accettano solo URL
      // http(s). I relativi vengono risolti rispetto all'app.
      const safeUrl = parseHttpUrl(url, window.location.href);
      if (!safeUrl) {
        console.warn('[Stream8] destinazione non valida, apertura annullata:', url);
        pendingTab?.close();
        setWatchOpen(false);
        return;
      }

      addEntry({
        ...target,
        viaService: service.name,
        season: isSeries ? season : undefined,
        episode: isSeries ? episode : undefined,
      });

      if (pendingTab && !pendingTab.closed) {
        pendingTab.location.href = safeUrl.href;
      } else {
        window.open(safeUrl.href, '_blank', 'noopener,noreferrer');
      }
      setWatchOpen(false);
    },
    [isSeries, season, episode, addEntry]
  );

  const closeWatchDialog = useCallback(() => setWatchOpen(false), []);

  // Svuota l'albero AniList salvato in locale per QUESTO titolo (stessa
  // chiave Titolo+Anno usata per calcolarlo in api/anilist.js): la prossima
  // volta che si sceglie un servizio custom per un anime, verrà ricalcolato
  // da zero. Utile ad es. se AniList ha corretto nel frattempo una
  // relazione sbagliata tra le stagioni.
  const handleClearAnilistCache = useCallback(() => {
    const year = details.year ? Number(details.year) : undefined;
    clearPersistedAnilistChain(details.title, year);
    setAnilistCacheMsg(t(lang, 'anilist_cache_cleared'));
    setTimeout(() => setAnilistCacheMsg(''), 3000);
  }, [details.title, details.year, lang]);

  const metaItems = [];
  if (details.year) {
    metaItems.push({ key: 'year', node: <Typography variant="body2" color="text.secondary">{details.year}</Typography> });
  }
  if (runtimeLabel) {
    metaItems.push({
      key: 'runtime',
      node: (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <AccessTimeRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">{runtimeLabel}</Typography>
        </Stack>
      ),
    });
  }
  if (isSeries && details.numberOfSeasons) {
    metaItems.push({
      key: 'seasons',
      node: (
        <Typography variant="body2" color="text.secondary">
          {details.numberOfSeasons} {t(lang, 'seasons_count')}
        </Typography>
      ),
    });
  }
  if (isSeries && details.numberOfEpisodes) {
    metaItems.push({
      key: 'episodes',
      node: (
        <Typography variant="body2" color="text.secondary">
          {details.numberOfEpisodes} {t(lang, 'episodes_count')}
        </Typography>
      ),
    });
  }

  return (
    <Box>
      <Box sx={{ position: 'relative', width: '100%', height: { xs: 320, md: 420 }, overflow: 'hidden' }}>
        {backdrop && !backdropFailed && (
          <Box
            component="img"
            src={backdrop}
            srcSet={backdropSet}
            sizes="100vw"
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            fetchpriority="high"
            onError={() => setFailedBackdropPath(details.backdropPath)}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: (theme) => {
              const base = theme.palette.background.default;
              return [
                `linear-gradient(0deg, ${base} 0%, ${alpha(base, 0.9)} 20%, ${alpha(base, 0.45)} 52%, transparent 82%)`,
                `linear-gradient(180deg, ${alpha(base, 0.28)} 0%, transparent 24%)`,
              ].join(', ');
            },
          }}
        />
        <IconButton
          onClick={onBack}
          aria-label={t(lang, 'a11y_back')}
          sx={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            left: { xs: 16, md: 24 },
            width: 44,
            height: 44,
            bgcolor: 'rgba(10, 14, 13, 0.5)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            '&:hover': { bgcolor: 'rgba(10, 14, 13, 0.7)' },
          }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>

        {details.voteAverage > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              right: { xs: 16, md: 24 },
              px: 1.25,
              py: 0.5,
              borderRadius: '8px',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <StarRoundedIcon sx={{ fontSize: 17 }} />
            <Typography variant="subtitle2" fontWeight={700}>
              {details.voteAverage.toFixed(1)}
            </Typography>
          </Box>
        )}
      </Box>

      <Container maxWidth="md" sx={{ mt: { xs: -4, md: -7 }, position: 'relative', pb: 6 }}>
        <Stack direction="row" spacing={{ sm: 3, md: 4 }} alignItems="flex-start">
          {poster && !posterFailed && (
            <Box
              component="img"
              src={poster}
              srcSet={posterSet}
              sizes="(min-width: 900px) 180px, 150px"
              alt=""
              aria-hidden
              loading="eager"
              decoding="async"
              onError={() => setFailedPosterPath(details.posterPath)}
              sx={{
                display: { xs: 'none', sm: 'block' },
                width: { sm: 150, md: 180 },
                flexShrink: 0,
                aspectRatio: '2 / 3',
                objectFit: 'cover',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 18px 40px -24px rgba(0, 0, 0, 0.9)'
                    : '0 18px 40px -28px rgba(20, 24, 26, 0.45)',
              }}
            />
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {loading && !details.title ? (
              <Skeleton variant="text" width="70%" height={56} sx={{ mb: 1 }} />
            ) : (
              <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 42 }, mb: 1 }}>
                {details.title}
              </Typography>
            )}

            {metaItems.length > 0 && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ mb: 1.5, rowGap: 0.75 }}>
                {metaItems.map((item, index) => (
                  <Fragment key={item.key}>
                    {index > 0 && (
                      <Box
                        aria-hidden
                        sx={{
                          width: 3,
                          height: 3,
                          borderRadius: '50%',
                          bgcolor: 'text.disabled',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {item.node}
                  </Fragment>
                ))}
              </Stack>
            )}

            {details.genreNames?.length > 0 && (
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{ mb: 2, rowGap: 1 }}>
                {details.genreNames.map((g) => (
                  <Chip
                    key={g}
                    label={g}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: 'divider',
                      color: 'text.secondary',
                      bgcolor: 'transparent',
                    }}
                  />
                ))}
              </Stack>
            )}

            {loading && !details.overview ? (
              <>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="60%" sx={{ mb: 3 }} />
              </>
            ) : (
              details.overview && (
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mb: 3, maxWidth: '68ch', lineHeight: 1.7 }}>
                  {details.overview}
                </Typography>
              )
            )}

            {/* Stagione, episodio e CTA vivono nella colonna testo: così
                restano sempre sotto la descrizione e non finiscono mai
                agganciati alla locandina quando l'overview è corta. */}
            {isSeries && seasons.length > 0 && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
                <Box sx={{ flex: { sm: '1 1 0' }, maxWidth: { sm: 240 }, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t(lang, 'season_label')}
                  </Typography>
                  <Select
                    size="small"
                    fullWidth
                    value={season}
                    onChange={(e) => handleSeasonChange(Number(e.target.value))}
                    MenuProps={{ PaperProps: { sx: { maxWidth: 320 } } }}
                    renderValue={(val) => {
                      const current = seasons.find((s) => s.seasonNumber === val);
                      const label = current?.name || `${t(lang, 'season_label')} ${val}`;
                      return (
                        <Box component="span" sx={ELLIPSIS_SX}>
                          {label}
                        </Box>
                      );
                    }}
                  >
                    {seasons.map((s) => {
                      const label = s.name || `${t(lang, 'season_label')} ${s.seasonNumber}`;
                      return (
                        <MenuItem key={s.seasonNumber} value={s.seasonNumber}>
                          <Box component="span" sx={ELLIPSIS_SX} title={label}>
                            {label}
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </Box>
                <Box sx={{ flex: { sm: '1 1 0' }, maxWidth: { sm: 300 }, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t(lang, 'episode_label')}
                  </Typography>
                  <Select
                    size="small"
                    fullWidth
                    value={episode}
                    onChange={(e) => setEpisode(Number(e.target.value))}
                    MenuProps={{ PaperProps: { sx: { maxWidth: 360 } } }}
                    renderValue={(val) => {
                      const current = episodes.find((e) => e.episodeNumber === val);
                      const label = `${val}. ${current?.name || `${t(lang, 'episode_label')} ${val}`}`;
                      return (
                        <Box component="span" sx={ELLIPSIS_SX}>
                          {label}
                        </Box>
                      );
                    }}
                  >
                    {episodes.map((e) => {
                      const label = `${e.episodeNumber}. ${e.name || `${t(lang, 'episode_label')} ${e.episodeNumber}`}`;
                      return (
                        <MenuItem key={e.episodeNumber} value={e.episodeNumber}>
                          <Box component="span" sx={ELLIPSIS_SX} title={label}>
                            {label}
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </Box>
              </Stack>
            )}

            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => setWatchOpen(true)}
              disabled={!details.title}
              sx={{ mt: 3 }}
            >
              {t(lang, 'hero_watch_on')}
            </Button>
          </Box>
        </Stack>

        {cast.length > 0 && (
          <Box sx={{ mt: { xs: 5, sm: 6 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t(lang, 'cast_title')}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                overflowX: 'auto',
                pb: 1,
                '&::-webkit-scrollbar': { height: 6 },
                '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 3 },
              }}
            >
              {cast.map((person) => (
                <Box key={person.id} sx={{ width: 96, flexShrink: 0, textAlign: 'center' }}>
                  <Avatar
                    src={posterUrl(person.profilePath, 'w185') || undefined}
                    alt={person.name}
                    imgProps={{ loading: 'lazy', decoding: 'async' }}
                    sx={{ width: 72, height: 72, mx: 'auto', mb: 1 }}
                  >
                    {person.name?.[0]}
                  </Avatar>
                  <Typography variant="caption" fontWeight={700} sx={{ display: 'block' }} noWrap>
                    {person.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {person.character}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {details.mediaType === 'anime' && (
          <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Button
              size="small"
              color="inherit"
              onClick={handleClearAnilistCache}
              sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.8rem' }}
            >
              {t(lang, 'anilist_cache_clear')}
            </Button>
            {anilistCacheMsg && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {anilistCacheMsg}
              </Typography>
            )}
          </Box>
        )}
      </Container>

      <WatchOnDialog
        open={watchOpen}
        lang={lang}
        item={details}
        settings={settings}
        onClose={closeWatchDialog}
        onConfirmWatch={handleConfirmWatch}
        seasons={seasons}
        season={season}
        episode={episode}
        seasonYear={currentSeasonYear}
      />
    </Box>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  CircularProgress,
  Select,
  MenuItem,
  Avatar,
  Skeleton,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import {
  backdropUrl,
  posterUrl,
  fetchDetails,
  fetchCredits,
  fetchSeasonEpisodes,
} from '../api/tmdb';
import { tmdbLangCode, t } from '../i18n';
import { invertedCorner } from '../theme';
import { useSettings } from '../context/SettingsContext';
import { useHistory } from '../context/HistoryContext';
import WatchOnDialog from '../components/WatchOnDialog';
import { MAINSTREAM_SEARCH_PATTERN } from '../utils/streamingServices';
import { buildCustomUrl, pickPatternForItem } from '../utils/customConfigParser';

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

  const backdrop = backdropUrl(details.backdropPath, 'w1280') || posterUrl(details.posterPath);

  const runtimeLabel = useMemo(() => {
    if (!details.runtimeMinutes) return null;
    const h = Math.floor(details.runtimeMinutes / 60);
    const m = details.runtimeMinutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m} ${t(lang, 'runtime_minutes')}`;
  }, [details.runtimeMinutes, lang]);

  const handleConfirmWatch = useCallback(
    ({ kind, service, item: target, watchLink, anilist }) => {
      let url;
      if (kind === 'mainstream') {
        // Se TMDb fornisce il link "watch" (JustWatch) per la regione, è la
        // via più vicina a un deep-link reale verso il servizio scelto;
        // altrimenti si ripiega su una ricerca per titolo sul sito stesso.
        if (watchLink) {
          url = watchLink;
        } else {
          const query = encodeURIComponent(target.title);
          url = MAINSTREAM_SEARCH_PATTERN[service.id].replace('{query}', query);
        }
        addEntry({ ...target, viaService: service.name });
      } else {
        const pattern = pickPatternForItem(service.config, target);
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
        addEntry({
          ...target,
          viaService: service.name,
          season: isSeries ? season : undefined,
          episode: isSeries ? episode : undefined,
        });
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      setWatchOpen(false);
    },
    [isSeries, season, episode, addEntry]
  );

  const closeWatchDialog = useCallback(() => setWatchOpen(false), []);

  return (
    <Box>
      <Box sx={{ position: 'relative', width: '100%', height: { xs: 300, md: 440 }, overflow: 'hidden' }}>
        {backdrop && (
          <Box
            component="img"
            src={backdrop}
            alt=""
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
          sx={{
            position: 'absolute',
            inset: 0,
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(0deg, rgba(20,24,26,1) 10%, rgba(20,24,26,0.5) 65%, rgba(20,24,26,0.1) 100%)'
                : 'linear-gradient(0deg, rgba(247,245,241,1) 10%, rgba(247,245,241,0.55) 65%, rgba(247,245,241,0.1) 100%)',
          }}
        />
        <IconButton
          onClick={onBack}
          aria-label={t(lang, 'close')}
          sx={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            left: 16,
            bgcolor: 'rgba(10,14,13,0.5)',
            color: '#fff',
            backdropFilter: 'blur(6px)',
            '&:hover': { bgcolor: 'rgba(10,14,13,0.7)' },
          }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>

        {details.voteAverage > 0 && (
          <Box
            sx={{
              ...invertedCorner(12),
              position: 'absolute',
              top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              right: 16,
              px: 1.5,
              py: 0.75,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <StarRoundedIcon sx={{ fontSize: 18 }} />
            <Typography variant="subtitle2" fontWeight={800}>
              {details.voteAverage.toFixed(1)}
            </Typography>
          </Box>
        )}
      </Box>

      <Container maxWidth="md" sx={{ mt: { xs: -5, md: -8 }, position: 'relative', pb: 6 }}>
        {loading && !details.title ? (
          <Skeleton variant="text" width="70%" height={56} sx={{ mb: 1 }} />
        ) : (
          <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 28, md: 40 }, mb: 1 }}>
            {details.title}
          </Typography>
        )}

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2, rowGap: 1 }}>
          {details.year && (
            <Typography variant="body2" color="text.secondary">
              {details.year}
            </Typography>
          )}
          {runtimeLabel && (
            <Stack direction="row" spacing={0.4} alignItems="center">
              <AccessTimeRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {runtimeLabel}
              </Typography>
            </Stack>
          )}
          {isSeries && details.numberOfSeasons && (
            <Typography variant="body2" color="text.secondary">
              {details.numberOfSeasons} {t(lang, 'seasons_count')}
            </Typography>
          )}
          {isSeries && details.numberOfEpisodes && (
            <Typography variant="body2" color="text.secondary">
              {details.numberOfEpisodes} {t(lang, 'episodes_count')}
            </Typography>
          )}
          {details.genreNames?.slice(0, 3).map((g) => (
            <Chip key={g} label={g} size="small" variant="outlined" />
          ))}
        </Stack>

        {loading && !details.overview ? (
          <>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="60%" sx={{ mb: 3 }} />
          </>
        ) : (
          details.overview && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
              {details.overview}
            </Typography>
          )
        )}

        {isSeries && seasons.length > 0 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Box sx={{ width: { xs: '100%', sm: 240 } }}>
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
            <Box sx={{ width: { xs: '100%', sm: 300 } }}>
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
          sx={{ mb: 5 }}
        >
          {t(lang, 'hero_watch_on')}
        </Button>

        {cast.length > 0 && (
          <Box>
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
      </Container>

      <WatchOnDialog
        open={watchOpen}
        lang={lang}
        item={details}
        settings={settings}
        onClose={closeWatchDialog}
        onConfirmWatch={handleConfirmWatch}
      />
    </Box>
  );
}

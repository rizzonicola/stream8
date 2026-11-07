import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  useMediaQuery,
  alpha,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { backdropUrl } from '../api/tmdb';
import { t } from '../i18n';

const AUTOPLAY_MS = 5500;

const arrowSx = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 40,
  height: 40,
  color: 'text.primary',
  bgcolor: (theme) =>
    alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.82 : 0.9),
  border: '1px solid',
  borderColor: 'divider',
  display: { xs: 'none', sm: 'inline-flex' },
  '&:hover': {
    bgcolor: 'background.paper',
  },
};

function MetaDot() {
  return (
    <Box
      aria-hidden
      sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }}
    />
  );
}

export default function HeroSlider({ lang, items, onSelect }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const pausedRef = useRef(false);
  const touchStartX = useRef(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Se si cambia categoria, l'indice corrente potrebbe puntare oltre la
  // fine del nuovo elenco: si riparte da una posizione sempre valida.
  useEffect(() => {
    setIndex(0);
  }, [items]);

  const goTo = useCallback(
    (i) => {
      if (!items.length) return;
      setIndex(((i % items.length) + items.length) % items.length);
    },
    [items.length]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (reduceMotion) return;
    timerRef.current = setInterval(() => {
      // In pausa su hover/focus: il carosello non deve cambiare sotto il
      // puntatore o mentre l'utente legge con la tastiera.
      if (!pausedRef.current) {
        setIndex((i) => (items.length ? (i + 1) % items.length : 0));
      }
    }, AUTOPLAY_MS);
  }, [items.length, reduceMotion]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  if (!items || items.length === 0) return null;
  const current = items[index] || items[0];
  const bg = backdropUrl(current.backdropPath, 'w1280');

  const handleManual = (fn) => {
    fn();
    startTimer();
  };

  const mediaLabel =
    current.mediaType === 'movie'
      ? t(lang, 'media_movie')
      : current.mediaType === 'anime'
        ? t(lang, 'media_anime')
        : t(lang, 'media_tv');

  return (
    <Box
      role="region"
      aria-roledescription="carousel"
      aria-label={t(lang, 'home_featured')}
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: 440, md: 540 },
        overflow: 'hidden',
      }}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false;
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current == null) return;
        const delta = event.changedTouches[0].clientX - touchStartX.current;
        if (delta > 50) handleManual(prev);
        else if (delta < -50) handleManual(next);
        touchStartX.current = null;
      }}>
      <Box
        key={`${current.mediaType}-${current.id}-${index}`}
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: bg ? `url(${bg})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          animation: reduceMotion
            ? 'none'
            : 'stream8HeroFade 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      />

      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          background: (theme) => {
            const base = theme.palette.background.default;
            return [
              `linear-gradient(0deg, ${base} 0%, ${alpha(base, 0.92)} 18%, ${alpha(base, 0.55)} 45%, ${alpha(base, 0.12)} 78%, transparent 100%)`,
              `linear-gradient(90deg, ${alpha(base, 0.5)} 0%, ${alpha(base, 0.16)} 42%, transparent 72%)`,
            ].join(', ');
          },
        }}
      />

      <Box
        onClick={() => onSelect(current)}
        sx={{
          position: 'absolute',
          left: { xs: 20, md: 48 },
          right: { xs: 20, md: '44%' },
          bottom: { xs: 28, md: 48 },
          cursor: 'pointer',
          maxWidth: 680,
        }}>
        <Stack
          direction="row"
          spacing={0.9}
          alignItems="center"
          useFlexGap
          sx={{ flexWrap: 'wrap', rowGap: 0.5, mb: 1.25 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {mediaLabel}
          </Typography>
          {current.year && (
            <>
              <MetaDot />
              <Typography variant="body2" color="text.secondary">
                {current.year}
              </Typography>
            </>
          )}
          {current.voteAverage > 0 && (
            <>
              <MetaDot />
              <Stack direction="row" spacing={0.4} alignItems="center">
                <StarRoundedIcon sx={{ fontSize: 15, color: '#C99A3C' }} />
                <Typography variant="body2" color="text.secondary">
                  {current.voteAverage.toFixed(1)}
                </Typography>
              </Stack>
            </>
          )}
        </Stack>

        <Typography
          component="h1"
          variant="h3"
          sx={{ mb: 1, textWrap: 'balance', maxWidth: 620 }}>
          {current.title}
        </Typography>

        {current.overview && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2.25,
              maxWidth: 540,
              fontSize: { xs: '0.875rem', md: '0.9375rem' },
              lineHeight: 1.65,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}>
            {current.overview}
          </Typography>
        )}

        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrowRoundedIcon />}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(current);
          }}>
          {t(lang, 'hero_watch_on')}
        </Button>
      </Box>

      <IconButton
        onClick={() => handleManual(prev)}
        aria-label={t(lang, 'a11y_previous')}
        sx={{ ...arrowSx, left: { sm: 12, md: 20 } }}>
        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 17 }} />
      </IconButton>
      <IconButton
        onClick={() => handleManual(next)}
        aria-label={t(lang, 'a11y_next')}
        sx={{ ...arrowSx, right: { sm: 12, md: 20 } }}>
        <ArrowForwardIosRoundedIcon sx={{ fontSize: 17 }} />
      </IconButton>

      <Stack
        direction="row"
        spacing={0.25}
        sx={{
          position: 'absolute',
          bottom: { xs: 10, md: 16 },
          right: { xs: 10, md: 18 },
          zIndex: 2,
        }}>
        {items.map((it, i) => (
          <Box
            component="button"
            type="button"
            key={`${it.mediaType}-${it.id}-${i}`}
            onClick={() => handleManual(() => goTo(i))}
            aria-label={`${t(lang, 'a11y_go_to_slide')} ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
            sx={{
              width: 24,
              height: 24,
              p: 0,
              border: 0,
              background: 'transparent',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              borderRadius: '50%',
            }}>
            <Box
              aria-hidden
              sx={{
                width: i === index ? 20 : 7,
                height: 7,
                borderRadius: 4,
                bgcolor: (theme) =>
                  i === index
                    ? theme.palette.primary.main
                    : alpha(theme.palette.text.primary, 0.26),
                transition:
                  'width 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease',
              }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

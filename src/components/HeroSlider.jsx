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
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import {
  backdropUrl,
  backdropSrcSet,
  decodeImage,
  preloadImage,
} from '../utils/images';
import { useConnectionHints } from '../hooks/useConnectionHints';
import { t } from '../i18n';

const AUTOPLAY_MS = 5500;

// Il pager desktop/tablet resta nell'angolo in basso a destra, dentro la
// fascia di gradiente: non copre più titolo, descrizione e CTA come le
// vecchie frecce a metà altezza. Su touch resta disponibile lo swipe e il
// contatore è solo informativo.
const pagerSx = {
  position: 'absolute',
  right: { sm: 16, md: 48 },
  bottom: { sm: 18, md: 26 },
  zIndex: 2,
  display: { xs: 'none', sm: 'inline-flex' },
  alignItems: 'center',
  gap: 0.25,
  p: 0.5,
  borderRadius: '999px',
  border: '1px solid',
  borderColor: (theme) => alpha(theme.palette.text.primary, 0.14),
  bgcolor: (theme) =>
    alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.58 : 0.78),
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 12px 32px -20px rgba(0, 0, 0, 0.85)',
};

function MetaDot() {
  return (
    <Box
      aria-hidden
      sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }}
    />
  );
}

export default function HeroSlider({ lang, items, onSelect, onPrefetch }) {
  const [index, setIndex] = useState(0);
  const [loadedKey, setLoadedKey] = useState(null);
  const timerRef = useRef(null);
  const pausedRef = useRef(false);
  const touchStartX = useRef(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const connection = useConnectionHints();
  const lowData = connection.saveData || /2g/.test(connection.effectiveType);

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
      // In pausa su hover/focus e a scheda in background: il carosello non
      // deve cambiare sotto il puntatore né consumare risorse quando l'utente
      // non sta guardando la pagina.
      if (!pausedRef.current && document.visibilityState !== 'hidden') {
        setIndex((i) => (items.length ? (i + 1) % items.length : 0));
      }
    }, AUTOPLAY_MS);
  }, [items.length, reduceMotion]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  // Precarica in sottofondo le slide adiacenti: quando arriva il turno,
  // l'immagine è già nella cache HTTP e la decodifica parte subito.
  useEffect(() => {
    if (!items?.length || lowData) return;
    const neighbours = [
      items[(index + 1) % items.length],
      items[(index - 1 + items.length) % items.length],
    ];
    const seen = new Set();
    for (const item of neighbours) {
      const path = item?.backdropPath;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      preloadImage(backdropUrl(path, 'w1280'), {
        srcSet: backdropSrcSet(path),
        sizes: '100vw',
        fetchPriority: 'low',
      });
    }
  }, [items, index, lowData]);

  if (!items || items.length === 0) return null;
  const current = items[index] || items[0];
  const imageKey = `${current.mediaType}-${current.id}`;
  const imageLoaded = loadedKey === imageKey;
  // Con risparmio dati o rete molto lenta si evita la variante più pesante
  // e il browser non può sceglierla tramite srcset.
  const backdrop = backdropUrl(current.backdropPath, lowData ? 'w780' : 'w1280');

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
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'background.default' }} />
      {backdrop && (
        <Box
          key={imageKey}
          component="img"
          src={backdrop}
          srcSet={lowData ? undefined : backdropSrcSet(current.backdropPath)}
          sizes="100vw"
          alt=""
          aria-hidden
          loading="eager"
          decoding="async"
          fetchpriority={index === 0 ? 'high' : 'auto'}
          onLoad={(event) => {
            const img = event.currentTarget;
            decodeImage(img).then(() => {
              if (img.isConnected) setLoadedKey(imageKey);
            });
          }}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imageLoaded ? 1 : 0,
            transition: reduceMotion ? 'none' : 'opacity 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: imageLoaded ? 'auto' : 'opacity',
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
              `linear-gradient(0deg, ${base} 0%, ${alpha(base, 0.92)} 18%, ${alpha(base, 0.55)} 45%, ${alpha(base, 0.12)} 78%, transparent 100%)`,
              `linear-gradient(90deg, ${alpha(base, 0.5)} 0%, ${alpha(base, 0.16)} 42%, transparent 72%)`,
            ].join(', ');
          },
        }}
      />

      <Box
        onClick={() => onSelect(current)}
        onMouseEnter={onPrefetch}
        onFocusCapture={onPrefetch}
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
          sx={{ mb: { xs: 1.75, md: 2.25 }, textWrap: 'balance', maxWidth: 620 }}>
          {current.title}
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(current);
          }}>
          {t(lang, 'hero_view_details')}
        </Button>

        {/* Puntini compatti su telefono: stessa idea di prima, ma senza il
            muro largo 24px per pallino. Restano sotto la CTA, in una riga
            da ~170px, e non rubano spazio al contenuto. */}
        <Stack
          direction="row"
          spacing={0.5}
          role="group"
          aria-label={t(lang, 'home_featured')}
          onClick={(event) => event.stopPropagation()}
          sx={{
            display: { xs: 'flex', sm: 'none' },
            alignItems: 'center',
            mt: 1.5,
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
                width: i === index ? 20 : 10,
                height: 24,
                p: 0,
                border: 0,
                background: 'transparent',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                borderRadius: '999px',
              }}>
              <Box
                aria-hidden
                sx={{
                  width: i === index ? 16 : 4,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    i === index
                      ? theme.palette.primary.main
                      : alpha(theme.palette.text.primary, 0.28),
                  transition: reduceMotion
                    ? 'none'
                    : 'width 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease',
                }}
              />
            </Box>
          ))}
        </Stack>
      </Box>

      <Stack direction="row" alignItems="center" sx={pagerSx}>
        <IconButton
          size="small"
          onClick={() => handleManual(prev)}
          aria-label={t(lang, 'a11y_previous')}
          sx={{
            width: 30,
            height: 30,
            color: 'text.secondary',
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}>
          <ArrowBackIosNewRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Typography
          component="span"
          sx={{
            minWidth: 48,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'text.secondary',
          }}>
          {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </Typography>
        <IconButton
          size="small"
          onClick={() => handleManual(next)}
          aria-label={t(lang, 'a11y_next')}
          sx={{
            width: 30,
            height: 30,
            color: 'text.secondary',
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}>
          <ArrowForwardIosRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>
    </Box>
  );
}

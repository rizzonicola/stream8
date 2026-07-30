import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, IconButton, Stack } from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { backdropUrl } from '../api/tmdb';
import { t } from '../i18n';

const AUTOPLAY_MS = 5000;

export default function HeroSlider({ lang, items, onSelect }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const touchStartX = useRef(null);

  // Se si cambia categoria (es. da Home, che ne mostra fino a 12, a una
  // singola sezione che ne mostra fino a 10) e l'indice corrente puntava
  // oltre la fine del nuovo elenco, va resettato: altrimenti il carosello
  // riparte comunque da un punto sensato invece di restare "bloccato" su
  // una posizione che nel nuovo elenco non esiste più.
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

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (items.length ? (i + 1) % items.length : 0));
    }, AUTOPLAY_MS);
  }, [items.length]);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  if (!items || items.length === 0) return null;
  const current = items[index] || items[0];
  const bg = backdropUrl(current.backdropPath, 'w1280');

  const handleManual = (fn) => {
    fn();
    resetTimer();
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: 460, md: 600 },
        overflow: 'hidden',
        borderBottomLeftRadius: { xs: 28, md: 40 },
        borderBottomRightRadius: { xs: 28, md: 40 },
      }}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (delta > 50) handleManual(prev);
        else if (delta < -50) handleManual(next);
        touchStartX.current = null;
      }}
    >
      <Box
        key={current.id}
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: bg ? `url(${bg})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'opacity 0.6s ease',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(0deg, rgba(20,24,26,0.98) 5%, rgba(20,24,26,0.55) 55%, rgba(20,24,26,0.15) 100%)'
              : 'linear-gradient(0deg, rgba(247,245,241,0.98) 5%, rgba(247,245,241,0.5) 55%, rgba(247,245,241,0.1) 100%)',
        }}
      />

      <Box
        onClick={() => onSelect(current)}
        sx={{
          position: 'absolute',
          left: { xs: 20, md: 56 },
          right: { xs: 20, md: '40%' },
          bottom: { xs: 24, md: 56 },
          cursor: 'pointer',
        }}
      >
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: 28, md: 44 } }}>
          {current.title}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          {current.year && (
            <Typography variant="body2" color="text.secondary">
              {current.year}
            </Typography>
          )}
        </Stack>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            mb: 2.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {current.overview}
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrowRoundedIcon />}
          onClick={() => onSelect(current)}
        >
          {t(lang, 'hero_watch_on')}
        </Button>
      </Box>

      <IconButton
        onClick={() => handleManual(prev)}
        aria-label="previous"
        sx={{
          position: 'absolute',
          left: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          bgcolor: 'rgba(0,0,0,0.35)',
          color: '#fff',
          display: { xs: 'none', sm: 'inline-flex' },
          '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
        }}
      >
        <ArrowBackIosNewRoundedIcon fontSize="small" />
      </IconButton>
      <IconButton
        onClick={() => handleManual(next)}
        aria-label="next"
        sx={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          bgcolor: 'rgba(0,0,0,0.35)',
          color: '#fff',
          display: { xs: 'none', sm: 'inline-flex' },
          '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
        }}
      >
        <ArrowForwardIosRoundedIcon fontSize="small" />
      </IconButton>

      <Stack
        direction="row"
        spacing={0.75}
        sx={{ position: 'absolute', bottom: 16, right: 20, zIndex: 2 }}
      >
        {items.map((it, i) => (
          <Box
            key={it.id}
            onClick={() => handleManual(() => goTo(i))}
            sx={{
              width: i === index ? 22 : 8,
              height: 8,
              borderRadius: 4,
              bgcolor: i === index ? 'primary.main' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}

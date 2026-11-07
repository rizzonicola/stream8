import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import MediaCard from './MediaCard';
import { t } from '../i18n';

const GUTTER = { xs: 2, sm: 3, md: 4 };

function HorizontalList({ lang, title, items, onSelect, onRemove, removeLabel }) {
  const scrollerRef = useRef(null);
  const headingId = useId();
  const [canScroll, setCanScroll] = useState({ left: false, right: false });
  const isDesktop = useMediaQuery('(min-width:600px)');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < max - 4,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [items, updateScrollState]);

  if (!items || items.length === 0) return null;

  const scrollBy = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(el.clientWidth * 0.8, 260),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <Box component="section" aria-labelledby={headingId} sx={{ mb: { xs: 3.5, sm: 4.5 } }}>
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{ px: GUTTER, mb: 1.25 }}>
        <Typography
          id={headingId}
          variant="h6"
          component="h2"
          sx={{ flex: 1 }}>
          {title}
        </Typography>

        {isDesktop && (
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={() => scrollBy(-1)}
              disabled={!canScroll.left}
              aria-label={t(lang, 'a11y_previous')}
              sx={{
                width: 32,
                height: 32,
                border: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
                bgcolor: 'transparent',
                '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
                '&.Mui-disabled': { borderColor: 'divider', opacity: 0.4 },
              }}>
              <ArrowBackRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => scrollBy(1)}
              disabled={!canScroll.right}
              aria-label={t(lang, 'a11y_next')}
              sx={{
                width: 32,
                height: 32,
                border: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
                bgcolor: 'transparent',
                '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
                '&.Mui-disabled': { borderColor: 'divider', opacity: 0.4 },
              }}>
              <ArrowForwardRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Stack>
        )}
      </Stack>

      <Box
        ref={scrollerRef}
        role="list"
        sx={{
          display: 'flex',
          gap: { xs: 1.5, sm: 2 },
          overflowX: 'auto',
          px: GUTTER,
          pb: 1.5,
          scrollSnapType: 'x proximity',
          overscrollBehaviorX: 'contain',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { height: 5 },
          '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'divider',
            borderRadius: 4,
          },
        }}>
        {items.map((item) => (
          <Box
            key={`${item.mediaType}-${item.id}-${item._key || ''}`}
            role="listitem"
            sx={{ scrollSnapAlign: 'start' }}>
            <MediaCard item={item} onSelect={onSelect} onRemove={onRemove} removeLabel={removeLabel} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default memo(HorizontalList);

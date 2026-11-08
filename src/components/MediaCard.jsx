import { memo, useState } from 'react';
import { Box, Typography, IconButton, alpha } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { posterUrl, posterSrcSet } from '../utils/images';
import { useNearViewport } from '../hooks/useNearViewport';
import { CARD_RADIUS } from '../theme';

/**
 * MediaCard — card verticale usata nelle liste orizzontali e in cronologia.
 * L'intera card è un unico bersaglio cliccabile e raggiungibile da tastiera;
 * il pulsante di rimozione resta un controllo separato, non annidato.
 */
function MediaCard({
  item,
  onSelect,
  onRemove,
  removeLabel,
  fullWidth = false,
  scrollerRef,
  onPrefetch,
  secondaryText,
}) {
  const [failedPath, setFailedPath] = useState(null);
  const [cardRef, near] = useNearViewport({
    rootRef: scrollerRef,
    enabled: !fullWidth,
  });
  const poster = posterUrl(item.posterPath, 'w342');
  const imageFailed = failedPath === item.posterPath;
  const showImage = Boolean(poster) && !imageFailed && near;
  const episodeBadge =
    item.mediaType !== 'movie' && item.season != null && item.episode != null
      ? `S${item.season} · E${item.episode}`
      : null;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(item);
    }
  };

  return (
    <Box
      ref={cardRef}
      sx={{
        position: 'relative',
        width: fullWidth ? '100%' : { xs: 132, sm: 156 },
        flexShrink: fullWidth ? 1 : 0,
        '@media (hover: hover)': {
          '& .media-remove': { opacity: 0, transform: 'scale(0.9)' },
          '&:hover .media-remove, &:focus-within .media-remove': {
            opacity: 1,
            transform: 'scale(1)',
          },
        },
      }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onSelect(item)}
        onKeyDown={handleKeyDown}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
        aria-label={[item.title, item.year].filter(Boolean).join(', ')}
        sx={{
          cursor: 'pointer',
          borderRadius: `${CARD_RADIUS}px`,
          outlineOffset: 4,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
          },
        }}>
        <Box
          className="card-poster"
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '2 / 3',
            borderRadius: `${CARD_RADIUS}px`,
            overflow: 'hidden',
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            transition: 'border-color 180ms ease, box-shadow 180ms ease',
            '@media (hover: hover)': {
              '&:hover': {
                borderColor: 'text.disabled',
                boxShadow: '0 12px 26px -20px rgba(0, 0, 0, 0.5)',
              },
            },
          }}>
          {showImage ? (
            <Box
              component="img"
              src={poster}
              srcSet={posterSrcSet(item.posterPath)}
              sizes={
                fullWidth
                  ? '(min-width: 1200px) 200px, (min-width: 600px) 25vw, 45vw'
                  : '(min-width: 600px) 156px, 132px'
              }
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailedPath(item.posterPath)}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : !poster || imageFailed ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
              }}>
              <Typography variant="caption">{item.title?.[0]}</Typography>
            </Box>
          ) : null}

          {item.voteAverage > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                px: 0.6,
                py: 0.25,
                borderRadius: '6px',
                bgcolor: 'rgba(10, 14, 13, 0.62)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 0.3,
              }}>
              <StarRoundedIcon sx={{ fontSize: 12, color: '#E0B15E' }} />
              <Typography sx={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.4 }}>
                {item.voteAverage.toFixed(1)}
              </Typography>
            </Box>
          )}

          {episodeBadge && (
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                pt: 3,
                pb: 0.75,
                px: 1,
                background: 'linear-gradient(0deg, rgba(10, 14, 13, 0.86), transparent)',
                color: '#fff',
              }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>
                {episodeBadge}
              </Typography>
            </Box>
          )}
        </Box>

        <Typography
          variant="body2"
          component="p"
          sx={{
            mt: 1,
            mb: 0,
            fontWeight: 600,
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
          {item.title}
        </Typography>
        {(secondaryText || item.year) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {secondaryText || item.year}
          </Typography>
        )}
      </Box>

      {onRemove && (
        <IconButton
          className="media-remove"
          size="small"
          aria-label={removeLabel}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(item);
          }}
          sx={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 30,
            height: 30,
            bgcolor: 'rgba(10, 14, 13, 0.78)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            transition: 'opacity 150ms ease, transform 150ms ease, background-color 150ms ease',
            '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.9) },
            '&:focus-visible': { opacity: 1, transform: 'scale(1)' },
          }}>
          <CloseRoundedIcon sx={{ fontSize: 17 }} />
        </IconButton>
      )}
    </Box>
  );
}

export default memo(MediaCard);

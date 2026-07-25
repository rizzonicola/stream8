import React, { memo } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { posterUrl, posterSrcSet } from '../api/tmdb';
import { CARD_RADIUS } from '../theme';

/**
 * MediaCard — card verticale usata nelle liste orizzontali e in cronologia.
 * Usa un <img loading="lazy"> reale con srcset/sizes (invece di un
 * background-image), così il browser scarica solo la risoluzione che
 * serve davvero per lo spazio disponibile, risparmiando banda su mobile.
 */
function MediaCard({ item, onSelect, onRemove, removeLabel, fullWidth = false }) {
  const poster = posterUrl(item.posterPath, 'w342');
  const episodeBadge =
    item.mediaType !== 'movie' && item.season != null && item.episode != null
      ? `S${item.season} · E${item.episode}`
      : null;

  return (
    <Box
      onClick={() => onSelect(item)}
      sx={{
        position: 'relative',
        width: fullWidth ? '100%' : { xs: 132, sm: 158 },
        flexShrink: 0,
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        '&:hover': { transform: 'translateY(-4px)' },
        '&:hover .card-poster': {
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 14px 28px -12px rgba(0,0,0,0.6)'
              : '0 14px 28px -14px rgba(20,24,26,0.35)',
        },
      }}
    >
      <Box
        className="card-poster"
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: `${CARD_RADIUS}px`,
          overflow: 'hidden',
          backgroundColor: 'background.paper',
          transition: 'box-shadow 0.2s ease',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {poster ? (
          <Box
            component="img"
            src={poster}
            srcSet={posterSrcSet(item.posterPath)}
            sizes={fullWidth ? '(min-width: 600px) 33vw, 50vw' : '(min-width: 600px) 158px, 132px'}
            alt={item.title}
            loading="lazy"
            decoding="async"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="caption">{item.title?.[0]}</Typography>
          </Box>
        )}

        {item.voteAverage > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              px: 1,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(10, 14, 13, 0.6)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
            }}
          >
            <StarRoundedIcon sx={{ fontSize: 14, color: '#FFD666' }} />
            <Typography variant="caption" fontWeight={700}>
              {item.voteAverage.toFixed(1)}
            </Typography>
          </Box>
        )}

        {episodeBadge && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              px: 1,
              py: 0.4,
              bgcolor: 'rgba(10, 14, 13, 0.72)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
            }}
          >
            <Typography variant="caption" fontWeight={700}>
              {episodeBadge}
            </Typography>
          </Box>
        )}

        {onRemove && (
          <IconButton
            size="small"
            aria-label={removeLabel}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              bgcolor: 'rgba(0,0,0,0.55)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Typography
        variant="body2"
        fontWeight={600}
        sx={{
          mt: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {item.title}
      </Typography>
      {item.year && (
        <Typography variant="caption" color="text.secondary">
          {item.year}
        </Typography>
      )}
    </Box>
  );
}

export default memo(MediaCard);

import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import MediaCard from './MediaCard';

function HorizontalList({ title, items, onSelect, onRemove, removeLabel }) {
  if (!items || items.length === 0) return null;

  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 1.5, px: { xs: 2, md: 4 } }}>
        {title}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          px: { xs: 2, md: 4 },
          pb: 1,
          scrollSnapType: 'x mandatory',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'divider',
            borderRadius: 3,
          },
        }}
      >
        {items.map((item) => (
          <Box key={`${item.mediaType}-${item.id}-${item._key || ''}`} sx={{ scrollSnapAlign: 'start' }}>
            <MediaCard item={item} onSelect={onSelect} onRemove={onRemove} removeLabel={removeLabel} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default memo(HorizontalList);

import { useId } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { sectionPaperSx } from './tokens';

/**
 * Card di sezione con intestazione coerente: titolo, eventuale sottotitolo
 * e azione a destra. L'icona, se presente, resta un dettaglio monocromatico
 * accanto al titolo — non un badge colorato.
 */
export default function SectionCard({
  id,
  icon,
  title,
  subtitle,
  action,
  children,
  sx,
  ...paperProps
}) {
  const fallbackId = useId();
  const titleId = `${id || fallbackId}-title`;

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={titleId}
      sx={{ ...sectionPaperSx, ...sx }}
      {...paperProps}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: 2 }}>
        {icon && (
          <Box
            aria-hidden
            sx={{
              display: 'flex',
              color: 'text.secondary',
              mt: '1px',
              '& svg': { fontSize: 19 },
            }}>
            {icon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={titleId} variant="h6" component="h2">
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, lineHeight: 1.6 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>

      {children}
    </Paper>
  );
}

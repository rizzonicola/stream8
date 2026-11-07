import { Box, Stack, Typography } from '@mui/material';

/**
 * Intestazione di pagina condivisa: titolo, eventuale sottotitolo e azione.
 * Niente badge decorativi: la gerarchia la fanno tipografia e spaziatura.
 */
export default function PageHeader({ icon, eyebrow, title, subtitle, action, sx }) {
  return (
    <Stack
      component="header"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      justifyContent="space-between"
      sx={{ mb: { xs: 2.5, sm: 3 }, ...sx }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography
            variant="overline"
            color="text.secondary"
            component="p"
            sx={{ mb: 0.5, lineHeight: 1.4 }}>
            {eyebrow}
          </Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {icon && (
            <Box
              aria-hidden
              sx={{ display: 'flex', color: 'primary.main', '& svg': { fontSize: 22 } }}>
              {icon}
            </Box>
          )}
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
        </Stack>
        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75, maxWidth: 620, lineHeight: 1.6 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {action && (
        <Box sx={{ flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>{action}</Box>
      )}
    </Stack>
  );
}

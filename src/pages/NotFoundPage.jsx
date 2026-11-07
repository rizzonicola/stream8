import { Box, Button, Container, Typography } from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import { t } from '../i18n';

/**
 * Pagina per le route che non esistono. Volutamente sobria: un numero,
 * una spiegazione e una sola via d'uscita verso la Home.
 */
export default function NotFoundPage({ lang, onGoHome }) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 8, sm: 12 } }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="overline" color="text.secondary" component="p">
          404
        </Typography>
        <Typography
          variant="h3"
          component="h1"
          sx={{ mt: 1, mb: 1.5, fontSize: { xs: 28, md: 36 } }}>
          {t(lang, 'notfound_title')}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: 420, mx: 'auto', lineHeight: 1.7 }}>
          {t(lang, 'notfound_body')}
        </Typography>
        <Button variant="contained" startIcon={<HomeRoundedIcon />} onClick={onGoHome}>
          {t(lang, 'notfound_home')}
        </Button>
      </Box>
    </Container>
  );
}

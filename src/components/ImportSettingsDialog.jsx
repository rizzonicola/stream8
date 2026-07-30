import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button, Alert } from '@mui/material';
import { t } from '../i18n';

// Primo avviso mostrato quando si apre un link di importazione impostazioni
// (vedi utils/shareSettings.js e App.jsx). Va mostrato PRIMA di qualunque
// altra cosa — anche prima del consenso privacy per un nuovo utente — così
// l'utente sa cosa sta per succedere prima di prendere qualunque altra
// decisione nell'app.
export default function ImportSettingsDialog({ open, lang, onConfirm, onDecline }) {
  return (
    <Dialog open={open} disableEscapeKeyDown fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>{t(lang, 'import_settings_title')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(lang, 'import_settings_body')}
        </Typography>
        <Alert severity="info">{t(lang, 'import_settings_note')}</Alert>
      </DialogContent>
      <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        <Button fullWidth variant="outlined" onClick={onDecline}>
          {t(lang, 'import_settings_decline')}
        </Button>
        <Button fullWidth variant="contained" onClick={onConfirm}>
          {t(lang, 'import_settings_accept')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

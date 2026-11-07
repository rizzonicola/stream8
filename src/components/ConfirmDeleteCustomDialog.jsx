import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { t } from '../i18n';

/**
 * Conferma prima di eliminare un servizio personalizzato. Usato sia dalle
 * Impostazioni sia dall'onboarding, così un tocco accidentale sull'icona
 * del cestino non cancella subito la configurazione.
 */
export default function ConfirmDeleteCustomDialog({ lang, name, onCancel, onConfirm }) {
  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {t(lang, 'settings_custom_delete_title')}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2">
          {t(lang, 'settings_custom_delete_body').replace('{name}', () => name || '')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onCancel}>{t(lang, 'cancel')}</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          {t(lang, 'remove')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

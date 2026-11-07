import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import { dangerBadgeSx } from './customConfig/styles';
import { displayBaseUrl } from '../utils/customServiceDisplay';
import { t } from '../i18n';

/**
 * Conferma prima di eliminare un servizio personalizzato. Usato sia dalle
 * Impostazioni sia dall'onboarding, così un tocco accidentale sull'icona
 * del cestino non cancella subito la configurazione.
 */
export default function ConfirmDeleteCustomDialog({ lang, name, baseUrl, onCancel, onConfirm }) {
  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      aria-labelledby="delete-custom-title"
      aria-describedby="delete-custom-body"
      PaperProps={{
        sx: {
          m: { xs: 2, sm: 3 },
          backgroundImage: 'none',
        },
      }}>
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, textAlign: 'center' }}>
        <Box sx={dangerBadgeSx(52)} aria-hidden>
          <DeleteOutlineRoundedIcon />
        </Box>

        <Typography
          id="delete-custom-title"
          variant="h6"
          sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {t(lang, 'settings_custom_delete_title')}
        </Typography>
        <Typography
          id="delete-custom-body"
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, lineHeight: 1.6 }}>
          {t(lang, 'settings_custom_delete_body')}
        </Typography>

        <Box
          sx={{
            mt: 2.5,
            p: 1.5,
            borderRadius: '12px',
            bgcolor: 'action.hover',
            textAlign: 'left',
          }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              aria-hidden
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                bgcolor: 'background.paper',
                color: 'text.secondary',
              }}>
              <DnsRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                noWrap
                title={name}
                sx={{ fontWeight: 700 }}>
                {name}
              </Typography>
              {baseUrl && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  noWrap
                  title={baseUrl}>
                  {displayBaseUrl(baseUrl)}
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ mt: 3 }}>
          <Button
            autoFocus
            onClick={onCancel}
            sx={{ width: { xs: '100%', sm: 'auto' }, flex: 1 }}>
            {t(lang, 'cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={onConfirm}
            startIcon={<DeleteOutlineRoundedIcon />}
            sx={{ width: { xs: '100%', sm: 'auto' }, flex: 1 }}>
            {t(lang, 'remove')}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

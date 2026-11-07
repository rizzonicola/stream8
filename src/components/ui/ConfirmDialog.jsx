import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { dangerBadgeSx } from './tokens';

/**
 * Conferma per un'azione irreversibile. Stessa forma del dialogo di
 * eliminazione dei servizi custom: icona, titolo, spiegazione, due azioni.
 */
export default function ConfirmDialog({
  open = true,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
  icon,
  children,
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      PaperProps={{ sx: { m: { xs: 2, sm: 3 } } }}>
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, textAlign: 'center' }}>
        <Box sx={dangerBadgeSx(52)} aria-hidden>
          {icon || <WarningAmberRoundedIcon />}
        </Box>

        <Typography id="confirm-dialog-title" variant="h6" sx={{ lineHeight: 1.3 }}>
          {title}
        </Typography>
        {body && (
          <Typography
            id="confirm-dialog-body"
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, lineHeight: 1.6 }}>
            {body}
          </Typography>
        )}

        {children}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 3 }}>
          <Button
            autoFocus
            onClick={onCancel}
            sx={{ width: { xs: '100%', sm: 'auto' }, flex: 1 }}>
            {cancelLabel}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={onConfirm}
            sx={{ width: { xs: '100%', sm: 'auto' }, flex: 1 }}>
            {confirmLabel}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

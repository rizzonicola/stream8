import { Box, IconButton, Stack, Tooltip, Typography, alpha } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { displayBaseUrl, serviceInitials } from '../../utils/customServiceDisplay';
import { t } from '../../i18n';

/**
 * Riga di un servizio personalizzato. Usata sia nelle Impostazioni sia
 * nell'onboarding: l'unica differenza è la presenza del pulsante di
 * modifica (in onboarding il servizio non è ancora salvato).
 */
export default function CustomServiceRow({ lang, service, onEdit, onDelete, dense = false }) {
  const name = service?.name || '';
  const baseUrl = service?.baseUrl || '';
  const size = dense ? 36 : 42;

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.25, sm: 1.5 },
        p: dense ? 1 : 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        bgcolor: 'background.paper',
        transition: 'background-color 160ms ease, border-color 160ms ease',
        '&:hover': {
          bgcolor: 'action.hover',
          borderColor: 'text.disabled',
        },
      }}>
      <Box
        aria-hidden
        sx={{
          width: size,
          height: size,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          bgcolor: (theme) =>
            alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
          color: 'primary.main',
          fontFamily: (theme) => theme.typography.h6.fontFamily,
          fontWeight: 700,
          fontSize: dense ? 13 : 14,
          letterSpacing: 0.2,
        }}>
        {serviceInitials(name)}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          noWrap
          title={name}
          sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          noWrap
          title={baseUrl}
          sx={{ mt: 0.25 }}>
          {displayBaseUrl(baseUrl) || '—'}
        </Typography>
      </Box>

      {(onEdit || onDelete) && (
        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
          {onEdit && (
            <Tooltip title={t(lang, 'settings_custom_edit')}>
              <IconButton
                size="small"
                aria-label={t(lang, 'settings_custom_edit')}
                onClick={() => onEdit(service)}
                sx={{
                  width: 40,
                  height: 40,
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
                }}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title={t(lang, 'settings_custom_delete')}>
              <IconButton
                size="small"
                aria-label={t(lang, 'settings_custom_delete')}
                onClick={() => onDelete(service)}
                sx={{
                  width: 40,
                  height: 40,
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'error.main',
                    bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                  },
                }}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
    </Box>
  );
}

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import {
  CustomConfigError,
  downloadJsonFile,
  parseCustomConfig,
  serializeCustomConfig,
} from '../utils/customConfigParser';
import JsonConfigEditor from './customConfig/JsonConfigEditor';
import { infoNoteSx } from './customConfig/styles';
import { t } from '../i18n';

// Nome file leggibile e sicuro: niente separatori di percorso o caratteri
// strani, con fallback se il nome del servizio è vuoto o solo simboli.
function buildFileName(name) {
  const base = (name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return `${base || 'stream8-config'}.json`;
}

/**
 * Dialog di modifica di un servizio personalizzato.
 * Mostra sempre il JSON completo della configurazione, indipendentemente da
 * come è stato aggiunto in origine (file, link o editor): da qui si possono
 * cambiare nome, indirizzo base e pattern, e scaricare il JSON sul proprio
 * computer per riutilizzarlo o conservarlo come backup.
 */
export default function EditCustomServiceDialog({ lang, service, onClose, onSave }) {
  const [name, setName] = useState(service.name || '');
  const [baseUrl, setBaseUrl] = useState(service.baseUrl || '');
  const [jsonText, setJsonText] = useState(() =>
    serializeCustomConfig(service.config || {})
  );
  const [error, setError] = useState('');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const validation = useMemo(() => {
    if (!jsonText.trim()) return { ok: false, message: t(lang, 'custom_editor_empty') };
    try {
      parseCustomConfig(jsonText);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof CustomConfigError
            ? e.message
            : t(lang, 'custom_editor_invalid'),
      };
    }
  }, [jsonText, lang]);

  const handleSave = () => {
    setError('');
    if (!name.trim() || !baseUrl.trim()) {
      setError(t(lang, 'settings_custom_name_url_required'));
      return;
    }
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    try {
      onSave({
        ...service,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        config: parseCustomConfig(jsonText),
      });
    } catch (e) {
      setError(
        e instanceof CustomConfigError ? e.message : t(lang, 'custom_editor_invalid')
      );
    }
  };

  const handleDownload = () => {
    downloadJsonFile(buildFileName(name), jsonText);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      aria-labelledby="edit-custom-title"
      PaperProps={{
        sx: {
          backgroundImage: 'none',
        },
      }}>
      <DialogTitle
        id="edit-custom-title"
        sx={{ p: { xs: 2, sm: 3 }, pb: { xs: 1.5, sm: 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
              {t(lang, 'settings_custom_edit_title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              title={name || service.name}>
              {name || service.name}
            </Typography>
          </Box>
          <IconButton
            aria-label={t(lang, 'close')}
            onClick={onClose}
            sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          p: { xs: 2, sm: 3 },
          borderTop: '1px solid',
          borderColor: 'divider',
        }}>
        <Stack spacing={3}>
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
              {t(lang, 'settings_custom_details')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                mt: 0.75,
              }}>
              <TextField
                required
                autoFocus
                size="small"
                label={t(lang, 'onboarding_custom_name')}
                placeholder={t(lang, 'settings_custom_field_name_placeholder')}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DnsOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                required
                size="small"
                type="url"
                inputMode="url"
                label={t(lang, 'onboarding_custom_url')}
                placeholder={t(lang, 'settings_custom_field_url_placeholder')}
                helperText={t(lang, 'settings_custom_field_url_help')}
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  if (error) setError('');
                }}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Box>

          {error && (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          )}

          <JsonConfigEditor
            lang={lang}
            label={t(lang, 'custom_editor_label')}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              if (error) setError('');
            }}
            minRows={12}
            maxRows={24}
            status={{
              tone: validation.ok ? 'success' : 'error',
              message: validation.ok
                ? t(lang, 'custom_editor_valid')
                : validation.message,
            }}
            helperText={t(lang, 'settings_custom_json_help')}
            action={
              <Button
                size="small"
                variant="text"
                startIcon={<DownloadRoundedIcon />}
                onClick={handleDownload}
                disabled={!jsonText.trim()}
                sx={{ px: 1.25, py: 0.5, fontSize: '0.8125rem' }}>
                {t(lang, 'settings_custom_download_json')}
              </Button>
            }
          />

          <Box sx={infoNoteSx}>
            <InfoOutlinedIcon
              fontSize="small"
              sx={{ color: 'text.secondary', mt: '1px', flexShrink: 0 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {t(lang, 'settings_custom_edit_help')}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          p: { xs: 2, sm: 3 },
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' },
          '& > :not(style) ~ :not(style)': { ml: 0 },
        }}>
        <Button
          onClick={onClose}
          sx={{ width: { xs: '100%', sm: 'auto' } }}>
          {t(lang, 'cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!validation.ok}
          startIcon={<CheckRoundedIcon />}
          sx={{ width: { xs: '100%', sm: 'auto' } }}>
          {t(lang, 'settings_custom_save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

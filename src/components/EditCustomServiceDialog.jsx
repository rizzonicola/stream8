import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import {
  CustomConfigError,
  downloadJsonFile,
  parseCustomConfig,
  serializeCustomConfig,
} from '../utils/customConfigParser';
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
  const [jsonText, setJsonText] = useState(() => serializeCustomConfig(service.config || {}));
  const [error, setError] = useState('');

  const validation = useMemo(() => {
    if (!jsonText.trim()) return { ok: false, message: t(lang, 'custom_editor_empty') };
    try {
      parseCustomConfig(jsonText);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof CustomConfigError ? e.message : t(lang, 'custom_editor_invalid'),
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
      setError(e instanceof CustomConfigError ? e.message : t(lang, 'custom_editor_invalid'));
    }
  };

  const handleDownload = () => {
    downloadJsonFile(buildFileName(name), jsonText);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>{t(lang, 'settings_custom_edit_title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label={t(lang, 'onboarding_custom_name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            size="small"
            label={t(lang, 'onboarding_custom_url')}
            placeholder="https://mio-jellyfin.it"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            label={t(lang, 'custom_editor_label')}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            fullWidth
            multiline
            minRows={8}
            maxRows={20}
            spellCheck={false}
            sx={{ '& textarea': { fontFamily: '"Roboto Mono", ui-monospace, monospace', fontSize: 13 } }}
          />
          <Alert severity={validation.ok ? 'success' : 'warning'}>
            {validation.ok ? t(lang, 'custom_editor_valid') : validation.message}
          </Alert>
          <Typography variant="caption" color="text.secondary">
            {t(lang, 'settings_custom_edit_help')}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Button
          startIcon={<DownloadRoundedIcon />}
          onClick={handleDownload}
          disabled={!jsonText.trim()}
        >
          {t(lang, 'settings_custom_download_json')}
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>{t(lang, 'cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={!validation.ok}>
            {t(lang, 'save')}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

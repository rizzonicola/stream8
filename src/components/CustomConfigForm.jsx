import { useMemo, useState } from 'react';
import {
  Box,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Alert,
  Stack,
  CircularProgress,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import {
  parseCustomConfig,
  readJsonFile,
  fetchJsonFromUrl,
  CustomConfigError,
} from '../utils/customConfigParser';
import { t } from '../i18n';

/**
 * CustomConfigForm
 * ----------------
 * Form per aggiungere un servizio streaming personalizzato. La
 * configurazione JSON può arrivare da un file caricato dal dispositivo,
 * da un link diretto a un file JSON ospitato altrove, oppure essere
 * scritta/incollata direttamente in un editor integrato (terza opzione,
 * utile quando l'utente non ha né un file né un link pubblico a
 * disposizione, es. da mobile).
 */
export default function CustomConfigForm({ lang, onAdd, onCancel }) {
  const [source, setSource] = useState('file'); // 'file' | 'url' | 'editor'
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [file, setFile] = useState(null);
  const [configUrl, setConfigUrl] = useState('');
  const [editorText, setEditorText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validazione immediata (ad ogni tasto) del JSON scritto nell'editor,
  // così l'utente vede subito se la sintassi/schema è valida prima ancora
  // di premere "Salva" — non blocca la digitazione, mostra solo un
  // riscontro sotto il campo.
  const editorValidation = useMemo(() => {
    if (!editorText.trim()) return null;
    try {
      parseCustomConfig(editorText);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof CustomConfigError ? e.message : t(lang, 'custom_editor_invalid') };
    }
  }, [editorText, lang]);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim() || !baseUrl.trim()) {
      setError('Compila nome e indirizzo base.');
      return;
    }
    if (source === 'file' && !file) {
      setError('Carica il file di configurazione.');
      return;
    }
    if (source === 'url' && !configUrl.trim()) {
      setError('Inserisci il link al file di configurazione.');
      return;
    }
    if (source === 'editor' && !editorText.trim()) {
      setError(t(lang, 'custom_editor_empty'));
      return;
    }

    setLoading(true);
    try {
      const text =
        source === 'file'
          ? await readJsonFile(file)
          : source === 'url'
            ? await fetchJsonFromUrl(configUrl.trim())
            : editorText;
      const config = parseCustomConfig(text);
      onAdd({
        id: `custom-${Date.now()}`,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        config,
      });
      setName('');
      setBaseUrl('');
      setFile(null);
      setConfigUrl('');
      setEditorText('');
    } catch (e) {
      setError(e instanceof CustomConfigError ? e.message : 'Errore nella configurazione fornita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <TextField
        size="small"
        label={t(lang, 'onboarding_custom_name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
      />
      <TextField
        size="small"
        label={t(lang, 'onboarding_custom_url')}
        placeholder="https://mio-jellyfin.it"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        fullWidth
      />

      <ToggleButtonGroup exclusive size="small" value={source} onChange={(_, v) => v && setSource(v)}>
        <ToggleButton value="file">
          <UploadFileIcon fontSize="small" sx={{ mr: 0.75 }} />
          {t(lang, 'custom_source_file')}
        </ToggleButton>
        <ToggleButton value="url">
          <LinkRoundedIcon fontSize="small" sx={{ mr: 0.75 }} />
          {t(lang, 'custom_source_url')}
        </ToggleButton>
        <ToggleButton value="editor">
          <CodeRoundedIcon fontSize="small" sx={{ mr: 0.75 }} />
          {t(lang, 'custom_source_editor')}
        </ToggleButton>
      </ToggleButtonGroup>

      {source === 'file' && (
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
          {file ? file.name : t(lang, 'onboarding_custom_file')}
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Button>
      )}

      {source === 'url' && (
        <TextField
          size="small"
          label={t(lang, 'onboarding_custom_url_json')}
          placeholder="https://mio-server.it/stream8-config.json"
          value={configUrl}
          onChange={(e) => setConfigUrl(e.target.value)}
          fullWidth
        />
      )}

      {source === 'editor' && (
        <Box>
          <TextField
            size="small"
            label={t(lang, 'custom_editor_label')}
            placeholder={t(lang, 'custom_editor_placeholder')}
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            fullWidth
            multiline
            minRows={6}
            maxRows={16}
            spellCheck={false}
            sx={{ '& textarea': { fontFamily: '"Roboto Mono", ui-monospace, monospace', fontSize: 13 } }}
          />
          {editorValidation && (
            <Alert severity={editorValidation.ok ? 'success' : 'warning'} sx={{ mt: 1 }}>
              {editorValidation.ok ? t(lang, 'custom_editor_valid') : editorValidation.message}
            </Alert>
          )}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {t(lang, 'onboarding_custom_file_help')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
        {t(lang, 'custom_config_disclaimer')}
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {onCancel && (
          <Button onClick={onCancel} disabled={loading}>
            {t(lang, 'cancel')}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || (source === 'editor' && editorValidation && !editorValidation.ok)}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {loading ? t(lang, 'custom_config_loading') : t(lang, 'save')}
        </Button>
      </Stack>
    </Box>
  );
}

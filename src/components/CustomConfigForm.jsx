import { useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  CustomConfigError,
  fetchJsonFromUrl,
  parseCustomConfig,
  readJsonFile,
  validateCustomServiceBaseUrl,
} from '../utils/customConfigParser';
import JsonConfigEditor from './customConfig/JsonConfigEditor';
import { formCardSx, iconBadgeSx, infoNoteSx } from './customConfig/styles';
import { t } from '../i18n';

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

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
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const titleId = useId();

  const clearError = () => {
    if (error) setError('');
  };

  // Validazione immediata (ad ogni tasto) del JSON scritto nell'editor,
  // così l'utente vede subito se la sintassi/schema è valida prima ancora
  // di premere "Aggiungi" — non blocca la digitazione, mostra solo un
  // riscontro sotto il campo.
  const editorValidation = useMemo(() => {
    if (!editorText.trim()) return null;
    try {
      parseCustomConfig(editorText);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof CustomConfigError ? e.message : t(lang, 'custom_editor_invalid'),
      };
    }
  }, [editorText, lang]);

  const editorStatus = editorValidation
    ? {
        tone: editorValidation.ok ? 'success' : 'error',
        message: editorValidation.ok
          ? t(lang, 'custom_editor_valid')
          : editorValidation.message,
      }
    : null;

  const sources = [
    {
      value: 'file',
      label: t(lang, 'custom_source_file'),
      icon: <UploadFileRoundedIcon fontSize="small" />,
    },
    {
      value: 'url',
      label: t(lang, 'custom_source_url'),
      icon: <LinkRoundedIcon fontSize="small" />,
    },
    {
      value: 'editor',
      label: t(lang, 'custom_source_editor'),
      icon: <CodeRoundedIcon fontSize="small" />,
    },
  ];

  const sourceHint = {
    file: t(lang, 'settings_custom_source_hint_file'),
    url: t(lang, 'settings_custom_source_hint_url'),
    editor: t(lang, 'settings_custom_source_hint_editor'),
  }[source];

  const pickFile = (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    clearError();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0] || null);
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim() || !baseUrl.trim()) {
      setError(t(lang, 'settings_custom_name_url_required'));
      return;
    }
    if (source === 'file' && !file) {
      setError(t(lang, 'settings_custom_file_required'));
      return;
    }
    if (source === 'url' && !configUrl.trim()) {
      setError(t(lang, 'settings_custom_url_required'));
      return;
    }
    if (source === 'editor' && !editorText.trim()) {
      setError(t(lang, 'custom_editor_empty'));
      return;
    }

    try {
      validateCustomServiceBaseUrl(baseUrl.trim());
    } catch (e) {
      setError(e.message);
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
      setError(
        e instanceof CustomConfigError
          ? e.message
          : t(lang, 'settings_custom_error_generic')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="section" aria-labelledby={titleId} aria-busy={loading} sx={formCardSx}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id={titleId}
            variant="subtitle1"
            sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {t(lang, 'settings_custom_add_title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t(lang, 'settings_custom_add_subtitle')}
          </Typography>
        </Box>
        {onCancel && (
          <IconButton
            aria-label={t(lang, 'close')}
            onClick={onCancel}
            disabled={loading}
            sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseRoundedIcon />
          </IconButton>
        )}
      </Stack>

      <Stack spacing={2}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
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
              clearError();
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
              clearError();
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

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {t(lang, 'settings_custom_source')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={source}
            onChange={(_, next) => {
              if (next) {
                setSource(next);
                clearError();
              }
            }}
            aria-label={t(lang, 'settings_custom_source')}
            sx={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 0.5,
              p: 0.5,
              bgcolor: 'action.hover',
              borderRadius: '12px',
              '& .MuiToggleButtonGroup-grouped': {
                border: '0 !important',
                borderRadius: '10px !important',
                m: 0,
                py: 1,
                px: 0.5,
                gap: 0.75,
                color: 'text.secondary',
                fontWeight: 600,
                fontSize: '0.8125rem',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                },
                '&.Mui-selected': {
                  bgcolor: 'background.paper',
                  color: 'primary.main',
                  boxShadow: (theme) =>
                    theme.palette.mode === 'dark'
                      ? '0 1px 2px rgba(0, 0, 0, 0.4)'
                      : '0 1px 2px rgba(16, 24, 40, 0.08)',
                  '&:hover': { bgcolor: 'background.paper' },
                },
              },
            }}>
            {sources.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.icon}
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.75, lineHeight: 1.5 }}>
            {sourceHint}
          </Typography>
        </Box>

        {source === 'file' && (
          <Box
            role="group"
            aria-label={t(lang, 'settings_custom_drop_title')}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setDragging(false);
              }
            }}
            onDrop={handleDrop}
            sx={{
              border: '1.5px dashed',
              borderColor: dragging ? 'primary.main' : file ? 'primary.main' : 'divider',
              borderRadius: '14px',
              p: { xs: 2, sm: 2.5 },
              bgcolor: (theme) =>
                dragging
                  ? alpha(theme.palette.primary.main, 0.08)
                  : file
                    ? alpha(theme.palette.primary.main, 0.04)
                    : 'transparent',
              transition: 'border-color 160ms ease, background-color 160ms ease',
            }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                pickFile(event.target.files?.[0] || null);
                event.target.value = '';
              }}
            />

            {file ? (
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Box sx={iconBadgeSx(44)} aria-hidden>
                  <InsertDriveFileRoundedIcon />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    title={file.name}
                    sx={{ fontWeight: 600 }}>
                    {file.name}
                  </Typography>
                  {formatFileSize(file.size) && (
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(file.size)}
                    </Typography>
                  )}
                </Box>
                <Tooltip title={t(lang, 'settings_custom_drop_replace')}>
                  <IconButton
                    size="small"
                    aria-label={t(lang, 'settings_custom_drop_replace')}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ flexShrink: 0 }}>
                    <SwapHorizRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t(lang, 'settings_custom_drop_remove')}>
                  <IconButton
                    size="small"
                    aria-label={t(lang, 'settings_custom_drop_remove')}
                    onClick={() => setFile(null)}
                    sx={{ flexShrink: 0 }}>
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center' }}>
                <Box sx={iconBadgeSx(44)} aria-hidden>
                  <CloudUploadRoundedIcon />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t(lang, 'settings_custom_drop_title')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(lang, 'settings_custom_drop_hint')}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}>
                  {t(lang, 'settings_custom_drop_browse')}
                </Button>
              </Stack>
            )}
          </Box>
        )}

        {source === 'url' && (
          <TextField
            size="small"
            type="url"
            inputMode="url"
            label={t(lang, 'onboarding_custom_url_json')}
            placeholder="https://mio-server.it/stream8-config.json"
            helperText={t(lang, 'settings_custom_url_json_help')}
            value={configUrl}
            onChange={(e) => {
              setConfigUrl(e.target.value);
              clearError();
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
        )}

        {source === 'editor' && (
          <JsonConfigEditor
            lang={lang}
            label={t(lang, 'custom_editor_label')}
            placeholder={t(lang, 'custom_editor_placeholder')}
            value={editorText}
            onChange={(e) => {
              setEditorText(e.target.value);
              clearError();
            }}
            minRows={8}
            maxRows={20}
            status={editorStatus}
            helperText={t(lang, 'settings_custom_json_help')}
          />
        )}

        <Box sx={infoNoteSx}>
          <InfoOutlinedIcon
            fontSize="small"
            sx={{ color: 'text.secondary', mt: '1px', flexShrink: 0 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {t(lang, 'custom_config_disclaimer')}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="flex-end">
          {onCancel && (
            <Button
              onClick={onCancel}
              disabled={loading}
              sx={{ width: { xs: '100%', sm: 'auto' } }}>
              {t(lang, 'cancel')}
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={
              loading ||
              (source === 'editor' && editorValidation && !editorValidation.ok)
            }
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <AddRoundedIcon />
              )
            }
            sx={{ width: { xs: '100%', sm: 'auto' } }}>
            {loading
              ? t(lang, 'custom_config_loading')
              : t(lang, 'settings_custom_add_submit')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

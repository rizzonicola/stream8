import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Stack,
  Chip,
  Avatar,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { useSettings } from '../context/SettingsContext';
import { useConsent } from '../context/ConsentContext';
import { useHistory } from '../context/HistoryContext';
import { MAINSTREAM_SERVICES } from '../utils/streamingServices';
import CustomConfigForm from '../components/CustomConfigForm';
import SyncSettings from '../components/SyncSettings';
import { buildShareUrl } from '../utils/shareSettings';
import { t, SUPPORTED_LANGS } from '../i18n';

export default function SettingsPage({ lang }) {
  const { settings, updateMainstream, addCustomService, removeCustomService, setTheme, setLanguage, updateSync } =
    useSettings();
  const { historyEnabled, setHistoryConsent } = useConsent();
  const { syncing, syncNow } = useHistory();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleMainstream = (id) => {
    const set = new Set(settings.selectedMainstream);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateMainstream(Array.from(set));
  };

  const openShareDialog = () => {
    // Ricalcolato al momento dell'apertura (non memorizzato) così riflette
    // sempre lo stato più recente delle impostazioni condivisibili.
    setShareUrl(buildShareUrl(settings));
    setCopied(false);
    setShareOpen(true);
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch (err) {
      console.error('[Stream8 Settings] copia negli appunti fallita:', err);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        {t(lang, 'settings_title')}
      </Typography>

      {/* Servizi streaming */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t(lang, 'settings_services')}
        </Typography>
        <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
          {MAINSTREAM_SERVICES.map((svc) => (
            <FormControlLabel
              key={svc.id}
              control={
                <Checkbox
                  checked={settings.selectedMainstream.includes(svc.id)}
                  onChange={() => toggleMainstream(svc.id)}
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ width: 20, height: 20, bgcolor: svc.color, fontSize: 10 }}>
                    {svc.name[0]}
                  </Avatar>
                  <Typography variant="body2">{svc.name}</Typography>
                </Stack>
              }
            />
          ))}
        </FormGroup>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t(lang, 'settings_custom_reload')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {settings.customServices.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              onDelete={() => removeCustomService(c.id)}
              deleteIcon={<DeleteOutlineRoundedIcon />}
            />
          ))}
        </Box>

        <CustomConfigForm lang={lang} onAdd={addCustomService} />
      </Paper>

      {/* Privacy */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t(lang, 'settings_privacy_title')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={historyEnabled}
              onChange={(e) => setHistoryConsent(e.target.checked)}
            />
          }
          label={t(lang, 'settings_privacy_history_label')}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t(lang, 'settings_privacy_note')}
        </Typography>
      </Paper>

      {/* Sincronizzazione cronologia (opzionale, server auto-ospitato) */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t(lang, 'settings_sync_title')}
        </Typography>
        {historyEnabled ? (
          <SyncSettings
            lang={lang}
            sync={settings.sync}
            onUpdateSync={updateSync}
            syncing={syncing}
            onSyncNow={syncNow}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t(lang, 'settings_sync_requires_history')}
          </Typography>
        )}
      </Paper>

      {/* Aspetto */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <FormControl>
          <FormLabel sx={{ mb: 1, fontWeight: 700 }}>{t(lang, 'settings_theme')}</FormLabel>
          <RadioGroup value={settings.theme} onChange={(e) => setTheme(e.target.value)}>
            <FormControlLabel value="auto" control={<Radio />} label={t(lang, 'theme_auto')} />
            <FormControlLabel value="light" control={<Radio />} label={t(lang, 'theme_light')} />
            <FormControlLabel value="dark" control={<Radio />} label={t(lang, 'theme_dark')} />
            <FormControlLabel value="amoled" control={<Radio />} label={t(lang, 'theme_amoled')} />
          </RadioGroup>
        </FormControl>
      </Paper>

      {/* Lingua */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Typography sx={{ mb: 1, fontWeight: 700 }}>{t(lang, 'settings_language')}</Typography>
        <Select
          value={settings.language}
          onChange={(e) => setLanguage(e.target.value)}
          size="small"
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="auto">{t(lang, 'lang_auto')}</MenuItem>
          {SUPPORTED_LANGS.map((l) => (
            <MenuItem key={l} value={l}>
              {t(lang, `lang_${l}`)}
            </MenuItem>
          ))}
        </Select>
      </Paper>

      {/* Condividi impostazioni */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Button variant="outlined" startIcon={<IosShareRoundedIcon />} onClick={openShareDialog}>
          {t(lang, 'share_settings_button')}
        </Button>
      </Paper>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>{t(lang, 'share_settings_title')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(lang, 'share_settings_body')}
          </Typography>
          <TextField
            value={shareUrl}
            fullWidth
            size="small"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={copyShareUrl}
                    startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                  >
                    {copied ? t(lang, 'share_settings_copied') : t(lang, 'share_settings_copy')}
                  </Button>
                </InputAdornment>
              ),
            }}
            onFocus={(e) => e.target.select()}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShareOpen(false)}>{t(lang, 'share_settings_close')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

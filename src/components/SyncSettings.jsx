import React, { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { checkSyncServer, SyncError } from '../api/syncClient';
import { t } from '../i18n';

/**
 * SyncSettings
 * ------------
 * Configura la sincronizzazione opzionale della cronologia verso un
 * server auto-ospitato dall'utente (mai un server di Stream8 — vedi
 * stream8-sync-server/). L'indirizzo e la chiave restano bozza finché non
 * si preme "Salva": il salvataggio verifica prima la connessione
 * (GET /v1/health) per evitare di salvare dati sbagliati senza accorgersene.
 */
export default function SyncSettings({ lang, sync, onUpdateSync, syncing, onSyncNow }) {
  const [draftUrl, setDraftUrl] = useState(sync.serverUrl);
  const [draftKey, setDraftKey] = useState(sync.apiKey);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [checkSuccess, setCheckSuccess] = useState(false);

  const handleToggleEnabled = (enabled) => {
    onUpdateSync({ enabled });
  };

  const handleSave = async () => {
    setChecking(true);
    setCheckError(null);
    setCheckSuccess(false);
    try {
      await checkSyncServer(draftUrl.trim());
      onUpdateSync({ serverUrl: draftUrl.trim(), apiKey: draftKey.trim(), lastError: null });
      setCheckSuccess(true);
    } catch (err) {
      setCheckError(err instanceof SyncError ? err.message : 'Errore imprevisto durante la verifica.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch checked={sync.enabled} onChange={(e) => handleToggleEnabled(e.target.checked)} />
        }
        label={t(lang, 'settings_sync_enable_label')}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 2 }}>
        {t(lang, 'settings_sync_note')}
      </Typography>

      {sync.enabled && (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label={t(lang, 'settings_sync_server_url')}
            placeholder="https://mio-server.it:8081"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            type="password"
            label={t(lang, 'settings_sync_api_key')}
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            fullWidth
          />

          {checkError && <Alert severity="error">{checkError}</Alert>}
          {checkSuccess && <Alert severity="success">{t(lang, 'settings_sync_check_success')}</Alert>}
          {sync.lastError && !checkError && <Alert severity="warning">{sync.lastError}</Alert>}

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={checking || !draftUrl.trim() || !draftKey.trim()}
              startIcon={checking ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {checking ? t(lang, 'settings_sync_checking') : t(lang, 'save')}
            </Button>

            {sync.serverUrl && sync.apiKey && (
              <Button
                variant="outlined"
                startIcon={<SyncRoundedIcon />}
                onClick={onSyncNow}
                disabled={syncing}
              >
                {syncing ? t(lang, 'settings_sync_syncing') : t(lang, 'settings_sync_now')}
              </Button>
            )}
          </Stack>

          {sync.serverUrl && sync.apiKey && (
            <FormControlLabel
              control={
                <Switch
                  checked={sync.autoSync}
                  onChange={(e) => onUpdateSync({ autoSync: e.target.checked })}
                />
              }
              label={t(lang, 'settings_sync_auto_label')}
            />
          )}

          {sync.lastSyncAt && (
            <Typography variant="caption" color="text.secondary">
              {t(lang, 'settings_sync_last')}: {new Date(sync.lastSyncAt).toLocaleString()}
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}

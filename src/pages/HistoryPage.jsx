import React, { useCallback, useRef, useState } from 'react';
import { Container, Typography, Box, Button, Stack, Alert, Paper } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import MediaCard from '../components/MediaCard';
import { useHistory } from '../context/HistoryContext';
import { readJsonFile } from '../utils/customConfigParser';
import { t } from '../i18n';

export default function HistoryPage({ lang, onOpenDetail }) {
  const { history, removeEntry, clearHistory, exportHistory, importHistory } = useHistory();
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  // Un solo handler stabile condiviso da tutte le card, invece di una
  // chiusura per ogni voce della cronologia ricreata ad ogni render
  // (la cronologia può contenere fino a 100 elementi).
  const handleRemove = useCallback((item) => removeEntry(item._key), [removeEntry]);

  const handleImport = async (file) => {
    if (!file) return;
    try {
      const text = await readJsonFile(file);
      importHistory(text);
      setMessage({ type: 'success', text: 'Cronologia importata con successo.' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message || "Errore durante l'importazione." });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {t(lang, 'section_history')}
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={() => setConfirmClear(true)}
            disabled={history.length === 0}
          >
            {t(lang, 'settings_history_clear')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={exportHistory}
            disabled={history.length === 0}
          >
            {t(lang, 'settings_history_export')}
          </Button>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
            {t(lang, 'settings_history_import')}
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </Button>
        </Stack>
      </Stack>

      {confirmClear && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => setConfirmClear(false)}>
                {t(lang, 'cancel')}
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => {
                  clearHistory();
                  setConfirmClear(false);
                }}
              >
                {t(lang, 'remove')}
              </Button>
            </Stack>
          }
        >
          {t(lang, 'confirm_clear_history')}
        </Alert>
      )}

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {history.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">{t(lang, 'empty_history')}</Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 2.5,
          }}
        >
          {history.map((entry) => (
            <MediaCard
              key={entry._key}
              item={entry}
              fullWidth
              onSelect={onOpenDetail}
              onRemove={handleRemove}
              removeLabel={t(lang, 'history_remove')}
            />
          ))}
        </Box>
      )}
    </Container>
  );
}

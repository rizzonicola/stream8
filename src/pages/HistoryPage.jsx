import { useCallback, useState } from 'react';
import { Container, Box, Button, Stack, Alert } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import MediaCard from '../components/MediaCard';
import PageHeader from '../components/ui/PageHeader';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { useHistory } from '../context/HistoryContext';
import { readJsonFile } from '../utils/customConfigParser';
import { t } from '../i18n';

export default function HistoryPage({ lang, onOpenDetail, onPrefetch }) {
  const { history, removeEntry, clearHistory, exportHistory, importHistory } = useHistory();
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState(null);

  // Un solo handler stabile condiviso da tutte le card, invece di una
  // chiusura per ogni voce della cronologia ricreata ad ogni render
  // (la cronologia può contenere fino a 100 elementi).
  const handleRemove = useCallback((item) => removeEntry(item._key), [removeEntry]);

  const handleImport = async (file) => {
    if (!file) return;
    try {
      const text = await readJsonFile(file);
      importHistory(text);
      setMessage({ type: 'success', text: t(lang, 'history_import_success') });
    } catch (e) {
      setMessage({
        type: 'error',
        text: e.message || t(lang, 'history_import_error'),
      });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, pb: { xs: 8, sm: 10 } }}>
      <PageHeader
        title={t(lang, 'history_title')}
        subtitle={t(lang, 'history_subtitle')}
        action={
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Button
              color="error"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => setConfirmClear(true)}
              disabled={history.length === 0}
              size="small">
              {t(lang, 'settings_history_clear')}
            </Button>
            <Button
              startIcon={<DownloadRoundedIcon />}
              onClick={exportHistory}
              disabled={history.length === 0}
              size="small">
              {t(lang, 'settings_history_export')}
            </Button>
            <Button component="label" startIcon={<UploadFileIcon />} size="small">
              {t(lang, 'settings_history_import')}
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  handleImport(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </Button>
          </Stack>
        }
      />

      {message && (
        <Alert severity={message.type} sx={{ mb: 2.5 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {history.length === 0 ? (
        <EmptyState title={t(lang, 'empty_history')} body={t(lang, 'empty_history_body')} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: { xs: 2, sm: 2.5 },
          }}>
          {history.map((entry) => (
            <Box
              key={entry._key}
              sx={{ contentVisibility: 'auto', containIntrinsicSize: '0 300px' }}>
              <MediaCard
                item={entry}
                fullWidth
                onSelect={onOpenDetail}
                onRemove={handleRemove}
                removeLabel={t(lang, 'history_remove')}
                onPrefetch={onPrefetch}
              />
            </Box>
          ))}
        </Box>
      )}

      <ConfirmDialog
        open={confirmClear}
        title={t(lang, 'settings_history_clear')}
        body={t(lang, 'confirm_clear_history')}
        confirmLabel={t(lang, 'remove')}
        cancelLabel={t(lang, 'cancel')}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearHistory();
          setConfirmClear(false);
        }}
      />
    </Container>
  );
}

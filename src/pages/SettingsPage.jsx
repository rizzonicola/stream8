import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  InputAdornment,
  Collapse,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { useSettings } from '../context/SettingsContext';
import { useConsent } from '../context/ConsentContext';
import { useHistory } from '../context/HistoryContext';
import { MAINSTREAM_SERVICES } from '../utils/streamingServices';
import CustomConfigForm from '../components/CustomConfigForm';
import CustomServiceRow from '../components/customConfig/CustomServiceRow';
import EditCustomServiceDialog from '../components/EditCustomServiceDialog';
import ConfirmDeleteCustomDialog from '../components/ConfirmDeleteCustomDialog';
import SyncSettings from '../components/SyncSettings';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import ServiceChoiceGrid from '../components/ui/ServiceChoiceGrid';
import ToggleRow from '../components/ui/ToggleRow';
import EmptyState from '../components/ui/EmptyState';
import { buildShareUrl } from '../utils/shareSettings';
import { t, SUPPORTED_LANGS } from '../i18n';

export default function SettingsPage({ lang }) {
  const {
    settings,
    updateMainstream,
    addCustomService,
    updateCustomService,
    removeCustomService,
    setTheme,
    setLanguage,
    updateSync,
  } = useSettings();
  const { historyEnabled, setHistoryConsent } = useConsent();
  const { syncing, syncNow } = useHistory();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceToDelete, setServiceToDelete] = useState(null);

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
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 }, pb: { xs: 8, sm: 10 } }}>
      <PageHeader
        title={t(lang, 'settings_title')}
        subtitle={t(lang, 'settings_subtitle')}
      />

      <SectionCard title={t(lang, 'settings_services')} sx={{ mb: 2 }}>
        <ServiceChoiceGrid
          services={MAINSTREAM_SERVICES}
          selected={settings.selectedMainstream}
          onToggle={toggleMainstream}
        />
      </SectionCard>

      <SectionCard
        id="custom-config"
        title={t(lang, 'settings_custom_title')}
        subtitle={t(lang, 'settings_custom_subtitle')}
        sx={{ mb: 2 }}>
        {settings.customServices.length === 0 && !showCustomForm && (
          <EmptyState
            icon={<DnsRoundedIcon />}
            title={t(lang, 'settings_custom_empty_title')}
            body={t(lang, 'settings_custom_empty_body')}
            action={
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => setShowCustomForm(true)}>
                {t(lang, 'settings_custom_empty_action')}
              </Button>
            }
          />
        )}

        {settings.customServices.length > 0 && (
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {settings.customServices.map((c) => (
              <CustomServiceRow
                key={c.id}
                lang={lang}
                service={c}
                onEdit={setEditingService}
                onDelete={setServiceToDelete}
              />
            ))}
          </Stack>
        )}

        {!showCustomForm && settings.customServices.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => setShowCustomForm(true)}
            sx={{ mt: 2, width: { xs: '100%', sm: 'auto' } }}>
            {t(lang, 'settings_custom_add')}
          </Button>
        )}

        <Collapse in={showCustomForm} timeout={220} unmountOnExit>
          <Box sx={{ mt: settings.customServices.length > 0 ? 2 : 0 }}>
            <CustomConfigForm
              lang={lang}
              onAdd={(service) => {
                addCustomService(service);
                setShowCustomForm(false);
              }}
              onCancel={() => setShowCustomForm(false)}
            />
          </Box>
        </Collapse>
      </SectionCard>

      <SectionCard title={t(lang, 'settings_privacy_title')} sx={{ mb: 2 }}>
        <ToggleRow
          label={t(lang, 'settings_privacy_history_label')}
          description={t(lang, 'settings_privacy_note')}
          checked={historyEnabled}
          onChange={setHistoryConsent}
        />
      </SectionCard>

      <SectionCard title={t(lang, 'settings_sync_title')} sx={{ mb: 2 }}>
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
      </SectionCard>

      <SectionCard title={t(lang, 'settings_appearance_language')} sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
          }}>
          <TextField
            select
            size="small"
            fullWidth
            label={t(lang, 'settings_theme')}
            value={settings.theme}
            onChange={(e) => setTheme(e.target.value)}>
            <MenuItem value="auto">{t(lang, 'theme_auto')}</MenuItem>
            <MenuItem value="light">{t(lang, 'theme_light')}</MenuItem>
            <MenuItem value="dark">{t(lang, 'theme_dark')}</MenuItem>
            <MenuItem value="amoled">{t(lang, 'theme_amoled')}</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            fullWidth
            label={t(lang, 'settings_language')}
            value={settings.language}
            onChange={(e) => setLanguage(e.target.value)}>
            <MenuItem value="auto">{t(lang, 'lang_auto')}</MenuItem>
            {SUPPORTED_LANGS.map((l) => (
              <MenuItem key={l} value={l}>
                {t(lang, `lang_${l}`)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </SectionCard>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ pt: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{t(lang, 'share_settings_button')}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {t(lang, 'settings_share_hint')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<IosShareRoundedIcon />}
          onClick={openShareDialog}
          sx={{ flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
          {t(lang, 'share_settings_button')}
        </Button>
      </Stack>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t(lang, 'share_settings_title')}</DialogTitle>
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
                    startIcon={<ContentCopyRoundedIcon fontSize="small" />}>
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

      {editingService && (
        <EditCustomServiceDialog
          lang={lang}
          service={editingService}
          onClose={() => setEditingService(null)}
          onSave={(updated) => {
            updateCustomService(updated);
            setEditingService(null);
          }}
        />
      )}

      {serviceToDelete && (
        <ConfirmDeleteCustomDialog
          lang={lang}
          name={serviceToDelete.name}
          baseUrl={serviceToDelete.baseUrl}
          onCancel={() => setServiceToDelete(null)}
          onConfirm={() => {
            removeCustomService(serviceToDelete.id);
            setServiceToDelete(null);
          }}
        />
      )}
    </Container>
  );
}

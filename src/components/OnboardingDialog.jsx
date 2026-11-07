import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  Divider,
  Alert,
  Stack,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { MAINSTREAM_SERVICES } from '../utils/streamingServices';
import CustomConfigForm from './CustomConfigForm';
import CustomServiceRow from './customConfig/CustomServiceRow';
import ConfirmDeleteCustomDialog from './ConfirmDeleteCustomDialog';
import ServiceChoiceGrid from './ui/ServiceChoiceGrid';
import { t } from '../i18n';

export default function OnboardingDialog({ open, lang, onComplete }) {
  const [selected, setSelected] = useState([]);
  const [customServices, setCustomServices] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [serviceToDelete, setServiceToDelete] = useState(null);

  const toggleService = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleConfirm = () => {
    if (selected.length === 0 && customServices.length === 0) {
      setFormError(t(lang, 'onboarding_select_at_least_one'));
      return;
    }
    onComplete(selected, customServices);
  };

  return (
    <>
      <Dialog open={open} disableEscapeKeyDown fullWidth maxWidth="sm">
        <DialogTitle>{t(lang, 'onboarding_title')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
            {t(lang, 'onboarding_subtitle')}
          </Typography>

          <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 1 }}>
            {t(lang, 'onboarding_mainstream')}
          </Typography>
          <ServiceChoiceGrid
            services={MAINSTREAM_SERVICES}
            selected={selected}
            onToggle={toggleService}
          />

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 1 }}>
            {t(lang, 'onboarding_custom_services')}
          </Typography>

          {customServices.length > 0 && (
            <Stack
              component="ul"
              spacing={1}
              sx={{ listStyle: 'none', p: 0, m: 0, my: 1.5 }}
            >
              {customServices.map((c) => (
                <CustomServiceRow
                  key={c.id}
                  lang={lang}
                  service={c}
                  onDelete={setServiceToDelete}
                  dense
                />
              ))}
            </Stack>
          )}

          {!showCustomForm ? (
            <Button
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={() => setShowCustomForm(true)}
              sx={{ mt: customServices.length > 0 ? 0 : 1 }}
            >
              {t(lang, 'onboarding_custom_add')}
            </Button>
          ) : (
            <CustomConfigForm
              lang={lang}
              onAdd={(service) => {
                setCustomServices((prev) => [...prev, service]);
                setShowCustomForm(false);
              }}
              onCancel={() => setShowCustomForm(false)}
            />
          )}

          {formError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" size="large" onClick={handleConfirm}>
            {t(lang, 'onboarding_confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {serviceToDelete && (
        <ConfirmDeleteCustomDialog
          lang={lang}
          name={serviceToDelete.name}
          baseUrl={serviceToDelete.baseUrl}
          onCancel={() => setServiceToDelete(null)}
          onConfirm={() => {
            setCustomServices((prev) => prev.filter((s) => s.id !== serviceToDelete.id));
            setServiceToDelete(null);
          }}
        />
      )}
    </>
  );
}

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Divider,
  Chip,
  Alert,
  Avatar,
  Stack,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { MAINSTREAM_SERVICES } from '../utils/streamingServices';
import CustomConfigForm from './CustomConfigForm';
import { t } from '../i18n';

export default function OnboardingDialog({ open, lang, onComplete }) {
  const [selected, setSelected] = useState([]);
  const [customServices, setCustomServices] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [formError, setFormError] = useState('');

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
    <Dialog open={open} disableEscapeKeyDown fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontFamily: 'inherit', fontWeight: 800 }}>
        {t(lang, 'onboarding_title')}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(lang, 'onboarding_subtitle')}
        </Typography>

        <Typography variant="overline" color="primary">
          {t(lang, 'onboarding_mainstream')}
        </Typography>
        <FormGroup sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          {MAINSTREAM_SERVICES.map((svc) => (
            <FormControlLabel
              key={svc.id}
              control={
                <Checkbox
                  checked={selected.includes(svc.id)}
                  onChange={() => toggleService(svc.id)}
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

        <Typography variant="overline" color="primary">
          {t(lang, 'onboarding_custom_add')}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
          {customServices.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              onDelete={() =>
                setCustomServices((prev) => prev.filter((s) => s.id !== c.id))
              }
            />
          ))}
        </Box>

        {!showCustomForm ? (
          <Button
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setShowCustomForm(true)}
            sx={{ mt: 1 }}
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
        <Button variant="contained" size="large" fullWidth onClick={handleConfirm}>
          {t(lang, 'onboarding_confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

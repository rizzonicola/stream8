import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Collapse,
  Box,
  Link,
} from '@mui/material';
import { t } from '../i18n';

export default function ConsentDialog({ open, lang, onChoose }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Dialog open={open} disableEscapeKeyDown fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>{t(lang, 'consent_title')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(lang, 'consent_body')}
        </Typography>

        <Link
          component="button"
          type="button"
          variant="body2"
          underline="hover"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? t(lang, 'consent_hide_info') : t(lang, 'consent_more_info')}
        </Link>

        <Collapse in={expanded}>
          <Box
            sx={{
              mt: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
              whiteSpace: 'pre-line',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t(lang, 'consent_details')}
            </Typography>
          </Box>
        </Collapse>
      </DialogContent>
      <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        <Button fullWidth variant="outlined" onClick={() => onChoose(false)}>
          {t(lang, 'consent_decline')}
        </Button>
        <Button fullWidth variant="contained" onClick={() => onChoose(true)}>
          {t(lang, 'consent_accept')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

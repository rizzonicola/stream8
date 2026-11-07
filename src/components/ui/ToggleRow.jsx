import { Box, FormControlLabel, Switch, Typography } from '@mui/material';

/**
 * Riga con interruttore: tutta la superficie è cliccabile, non solo il
 * piccolo switch. Usata per privacy e sincronizzazione.
 */
export default function ToggleRow({ label, description, checked, onChange, disabled = false }) {
  return (
    <FormControlLabel
      labelPlacement="start"
      disabled={disabled}
      control={
        <Switch
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          inputProps={{ 'aria-label': label }}
        />
      }
      label={
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" component="span" sx={{ display: 'block' }}>
            {label}
          </Typography>
          {description && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ display: 'block', mt: 0.25, lineHeight: 1.55 }}>
              {description}
            </Typography>
          )}
        </Box>
      }
      sx={{
        m: 0,
        p: 1.5,
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        transition: 'border-color 160ms ease, background-color 160ms ease',
        '&:hover': { bgcolor: 'action.hover' },
        '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0, pr: 2 },
      }}
    />
  );
}

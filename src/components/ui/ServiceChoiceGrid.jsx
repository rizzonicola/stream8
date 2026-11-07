import {
  Avatar,
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
  alpha,
} from '@mui/material';

/**
 * Griglia di scelte per i servizi mainstream. Stessa superficie e stesso
 * comportamento in Impostazioni e onboarding: una card selezionabile invece
 * di una fila di checkbox anonime.
 *
 * Le card usano intenzionalmente iniziale e colore, non i loghi ufficiali:
 * i marchi e le opere grafiche dei servizi richiedono un'autorizzazione che
 * il progetto non ha. Il nome resta un riferimento identificativo.
 */
export default function ServiceChoiceGrid({ services, selected, onToggle, dense = false }) {
  return (
    <Box
      role="group"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
      }}>
      {services.map((svc) => {
        const checked = selected.includes(svc.id);
        return (
          <FormControlLabel
            key={svc.id}
            labelPlacement="start"
            control={
              <Checkbox
                checked={checked}
                onChange={() => onToggle(svc.id)}
                size="small"
                sx={{ p: 0.75 }}
              />
            }
            label={
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar
                  aria-hidden
                  sx={{
                    width: dense ? 28 : 32,
                    height: dense ? 28 : 32,
                    borderRadius: '6px',
                    bgcolor: svc.color,
                    color: svc.id === 'appletv' ? '#14181A' : '#FFFFFF',
                    fontSize: dense ? 11 : 12,
                    fontWeight: 700,
                  }}>
                  {svc.name[0]}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {svc.name}
                </Typography>
              </Stack>
            }
            sx={{
              m: 0,
              p: dense ? 0.75 : 1,
              pr: dense ? 1 : 1.25,
              justifyContent: 'space-between',
              border: '1px solid',
              borderColor: checked ? 'primary.main' : 'divider',
              borderRadius: '10px',
              bgcolor: (theme) =>
                checked
                  ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06)
                  : 'transparent',
              transition: 'border-color 160ms ease, background-color 160ms ease',
              '&:hover': {
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.5),
                bgcolor: 'action.hover',
              },
              '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 },
            }}
          />
        );
      })}
    </Box>
  );
}

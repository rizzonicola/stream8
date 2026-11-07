import { Box, Button, Typography } from '@mui/material';
import { emptyStateSx } from './tokens';

/**
 * Stato vuoto riutilizzabile: icona, titolo, una frase utile e una sola
 * azione. Il vuoto deve spiegare il passo successivo, non riempire spazio.
 */
export default function EmptyState({ icon, title, body, action, sx }) {
  return (
    <Box sx={{ ...emptyStateSx, ...sx }}>
      {icon && (
        <Box
          aria-hidden
          sx={{
            display: 'flex',
            justifyContent: 'center',
            color: 'text.secondary',
            mb: 1,
            '& svg': { fontSize: 26 },
          }}>
          {icon}
        </Box>
      )}
      <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {body && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: action ? 2 : 0, maxWidth: 440, mx: 'auto', lineHeight: 1.6 }}>
          {body}
        </Typography>
      )}
      {action}
    </Box>
  );
}

export function EmptyStateButton(props) {
  return <Button variant="contained" {...props} />;
}

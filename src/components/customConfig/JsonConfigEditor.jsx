import { useId } from 'react';
import { Box, Chip, Stack, TextField, Typography, alpha } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { t } from '../../i18n';

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

const codeSurface = (theme) =>
  theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.black, 0.28)
    : alpha(theme.palette.primary.main, 0.035);

/**
 * Editor JSON condiviso tra il form di aggiunta e il dialog di modifica.
 * Oltre al campo monospace mostra uno stato leggibile (valido / da
 * correggere) e lascia spazio a un'azione secondaria, come il download.
 */
export default function JsonConfigEditor({
  lang,
  label,
  value,
  onChange,
  placeholder,
  minRows = 10,
  maxRows = 24,
  status,
  helperText,
  action,
}) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const statusId = `${baseId}-status`;
  const helpId = `${baseId}-help`;

  const describedBy = [
    status?.tone === 'error' ? statusId : null,
    helperText ? helpId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        sx={{ flexWrap: 'wrap', rowGap: 0.75, mb: 1 }}>
        <CodeRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography
          component="label"
          htmlFor={inputId}
          variant="subtitle2"
          sx={{ flex: 1, minWidth: 0, fontWeight: 700, cursor: 'text' }}>
          {label}
        </Typography>

        {status && (
          <Box role="status" aria-live="polite">
            <Chip
              size="small"
              variant="outlined"
              color={status.tone === 'error' ? 'error' : 'success'}
              icon={
                status.tone === 'error' ? (
                  <ErrorOutlineRoundedIcon />
                ) : (
                  <CheckCircleRoundedIcon />
                )
              }
              label={
                status.tone === 'error'
                  ? t(lang, 'settings_custom_json_invalid')
                  : t(lang, 'settings_custom_json_valid')
              }
              sx={{
                height: 24,
                fontSize: '0.75rem',
                fontWeight: 600,
                '& .MuiChip-icon': { fontSize: 15, ml: 0.75 },
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
        )}

        {action}
      </Stack>

      <TextField
        id={inputId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        fullWidth
        multiline
        minRows={minRows}
        maxRows={maxRows}
        spellCheck={false}
        inputProps={{
          'aria-describedby': describedBy || undefined,
          'aria-invalid': status?.tone === 'error' || undefined,
          spellCheck: false,
          autoCapitalize: 'off',
          autoCorrect: 'off',
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            alignItems: 'flex-start',
            borderRadius: '10px',
            bgcolor: codeSurface,
            fontFamily: MONO_FONT,
            fontSize: 13,
            lineHeight: 1.65,
            '& textarea': {
              fontFamily: MONO_FONT,
              fontSize: 13,
              lineHeight: 1.65,
              tabSize: 2,
            },
            '& fieldset': {
              borderColor:
                status?.tone === 'error'
                  ? (theme) => alpha(theme.palette.error.main, 0.55)
                  : 'divider',
            },
            '&:hover fieldset': {
              borderColor: status?.tone === 'error' ? 'error.main' : 'primary.main',
            },
            '&.Mui-focused fieldset': {
              borderColor: status?.tone === 'error' ? 'error.main' : 'primary.main',
            },
          },
        }}
      />

      {(status?.tone === 'error' || helperText) && (
        <Stack spacing={0.5} sx={{ mt: 1.25 }}>
          {status?.tone === 'error' && (
            <Stack
              id={statusId}
              direction="row"
              spacing={0.75}
              alignItems="flex-start"
              role="alert">
              <ErrorOutlineRoundedIcon
                sx={{ fontSize: 16, color: 'error.main', mt: '1px', flexShrink: 0 }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'error.main', fontWeight: 500, lineHeight: 1.5 }}>
                {status.message}
              </Typography>
            </Stack>
          )}
          {helperText && (
            <Typography
              id={helpId}
              variant="caption"
              color="text.secondary"
              sx={{ lineHeight: 1.55 }}>
              {helperText}
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}

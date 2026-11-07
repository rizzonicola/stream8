import { alpha } from '@mui/material/styles';
import { INNER_RADIUS, SURFACE_RADIUS } from '../../theme';

// Token condivisi dalle superfici dell'app. Stanno fuori dai singoli
// componenti così Settings, onboarding, dialoghi e pagine non divergono.

const TONES = {
  primary: 'primary',
  secondary: 'secondary',
  error: 'error',
  neutral: null,
};

export const iconBadgeSx = (size = 40, tone = 'primary') => {
  const key = TONES[tone];
  return {
    width: size,
    height: size,
    borderRadius: 0,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    bgcolor: 'transparent',
    color: key ? `${key}.main` : 'text.secondary',
  };
};

export const dangerBadgeSx = (size = 44) => ({
  width: size,
  height: size,
  mx: 'auto',
  mb: 1.5,
  display: 'grid',
  placeItems: 'center',
  color: 'error.main',
  '& svg': { fontSize: 30 },
});

export const formCardSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: `${SURFACE_RADIUS}px`,
  p: { xs: 2, sm: 2.5 },
  bgcolor: (theme) =>
    alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.02 : 0.012),
};

export const infoNoteSx = {
  display: 'flex',
  gap: 1,
  alignItems: 'flex-start',
  p: 1.5,
  borderRadius: `${INNER_RADIUS}px`,
  bgcolor: 'action.hover',
};

export const sectionPaperSx = {
  p: { xs: 2, sm: 2.75 },
  mb: 2.5,
  borderRadius: `${SURFACE_RADIUS}px`,
};

export const emptyStateSx = {
  py: { xs: 3, sm: 4 },
  px: 2,
  textAlign: 'center',
  border: '1px dashed',
  borderColor: 'divider',
  borderRadius: `${SURFACE_RADIUS}px`,
};

export const focusRingSx = (theme) => ({
  outline: `2px solid ${alpha(theme.palette.primary.main, 0.65)}`,
  outlineOffset: 2,
});

export const hiddenScrollbarSx = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
};

export const thinScrollbarSx = {
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': { height: 5 },
  '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'divider',
    borderRadius: 4,
  },
};

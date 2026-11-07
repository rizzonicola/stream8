import { createTheme, alpha } from '@mui/material/styles';

/**
 * Stream8 — Design tokens
 * -----------------------
 * Un unico linguaggio visivo per tutta l'app:
 *  - superfici calde e piatte, con bordi sottili invece di ombre pesanti;
 *  - raggi piccoli e coerenti (10 / 12 / 14 / 16 px);
 *  - Manrope per i titoli, Roboto Flex per il testo;
 *  - accento acquamarina, corallo per errori e azioni distruttive;
 *  - movimento breve e sobrio, con rispetto per prefers-reduced-motion.
 *
 * I componenti non devono inventare raggi o colori propri: qui ci sono i
 * token (CARD_RADIUS, SURFACE_RADIUS, CONTROL_RADIUS, MOTION) e gli override
 * globali di MUI, così ogni superficie resta coerente nel tempo.
 */

const fontDisplay = '"Manrope", "Roboto Flex", sans-serif';
const fontBody = '"Roboto Flex", "Manrope", sans-serif';
const fontMono =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export const CARD_RADIUS = 10;
export const INNER_RADIUS = 12;
export const SURFACE_RADIUS = 14;
export const DIALOG_RADIUS = 16;
export const CONTROL_RADIUS = 10;
export const PILL_RADIUS = 10;

export const MOTION = {
  fast: '120ms',
  base: '180ms',
  slow: '280ms',
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

const shape = {
  // I valori numerici di `borderRadius` in sx vengono moltiplicati per
  // questo numero. 8 rende `borderRadius: 2` = 16px, una misura umana:
  // prima 14 lo trasformava in 28px e ogni Paper sembrava una bolla.
  borderRadius: 8,
};

const typography = {
  fontFamily: fontBody,
  h1: {
    fontFamily: fontDisplay,
    fontWeight: 700,
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    lineHeight: 1.08,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontFamily: fontDisplay,
    fontWeight: 700,
    fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
    lineHeight: 1.12,
    letterSpacing: '-0.018em',
  },
  h3: {
    fontFamily: fontDisplay,
    fontWeight: 700,
    fontSize: 'clamp(1.5rem, 3.4vw, 2.25rem)',
    lineHeight: 1.15,
    letterSpacing: '-0.016em',
  },
  h4: {
    fontFamily: fontDisplay,
    fontWeight: 700,
    fontSize: 'clamp(1.375rem, 2.6vw, 1.75rem)',
    lineHeight: 1.2,
    letterSpacing: '-0.012em',
  },
  h5: {
    fontFamily: fontDisplay,
    fontWeight: 600,
    fontSize: 'clamp(1.125rem, 2vw, 1.375rem)',
    lineHeight: 1.25,
    letterSpacing: '-0.008em',
  },
  h6: {
    fontFamily: fontDisplay,
    fontWeight: 600,
    fontSize: '1.0625rem',
    lineHeight: 1.35,
    letterSpacing: 0,
  },
  subtitle1: { fontWeight: 600, lineHeight: 1.5 },
  subtitle2: { fontWeight: 600, lineHeight: 1.4 },
  body1: { fontSize: '1rem', lineHeight: 1.65 },
  body2: { fontSize: '0.875rem', lineHeight: 1.6 },
  caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: '0.005em' },
  overline: {
    fontFamily: fontBody,
    fontWeight: 700,
    fontSize: '0.6875rem',
    lineHeight: 1.6,
    letterSpacing: '0.08em',
  },
  button: {
    fontFamily: fontDisplay,
    fontWeight: 700,
    fontSize: '0.875rem',
    lineHeight: 1.2,
    textTransform: 'none',
    letterSpacing: 0,
  },
};

function buildTheme(mode) {
  const isAmoled = mode === 'amoled';
  const isDarkFamily = mode === 'dark' || isAmoled;

  const palette = isDarkFamily
    ? {
        mode: 'dark',
        primary: { main: '#4FD1C5', dark: '#0F8B8D', contrastText: '#0A1211' },
        secondary: { main: '#8CE5DB' },
        error: { main: '#E2725B' },
        warning: { main: '#E0B15E' },
        success: { main: '#6FCF97' },
        info: { main: '#63B3ED' },
        background: {
          default: isAmoled ? '#000000' : '#14181A',
          paper: isAmoled ? '#0A0A0A' : '#1B211F',
        },
        divider: 'rgba(79, 209, 197, 0.16)',
        text: { primary: '#EAF3F1', secondary: '#9FB4B0' },
        action: {
          hover: 'rgba(234, 243, 241, 0.06)',
          selected: 'rgba(79, 209, 197, 0.12)',
          focus: 'rgba(79, 209, 197, 0.16)',
        },
      }
    : {
        mode: 'light',
        primary: { main: '#0F8B8D', dark: '#0B6567', contrastText: '#FFFFFF' },
        secondary: { main: '#D97757' },
        error: { main: '#C4432D' },
        warning: { main: '#9A6700' },
        success: { main: '#227A4E' },
        info: { main: '#1967A8' },
        background: { default: '#F7F5F1', paper: '#FFFFFF' },
        divider: 'rgba(15, 139, 141, 0.14)',
        text: { primary: '#161A19', secondary: '#5B6664' },
        action: {
          hover: 'rgba(22, 26, 25, 0.045)',
          selected: 'rgba(15, 139, 141, 0.10)',
          focus: 'rgba(15, 139, 141, 0.14)',
        },
      };

  const focusRing = alpha(palette.primary.main, isDarkFamily ? 0.72 : 0.65);

  return createTheme({
    palette,
    shape,
    typography,
    transitions: {
      duration: {
        shortest: 100,
        shorter: 140,
        short: 180,
        standard: 220,
        complex: 280,
        enteringScreen: 220,
        leavingScreen: 160,
      },
      easing: {
        easeOut: MOTION.ease,
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          html: { scrollBehavior: 'smooth' },
          body: {
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility',
            WebkitTapHighlightColor: 'transparent',
          },
          '#root': { minHeight: '100%' },
          '::selection': {
            backgroundColor: alpha(theme.palette.primary.main, 0.28),
          },
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: `${alpha(theme.palette.text.primary, 0.18)} transparent`,
          },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.text.primary, 0.16),
            borderRadius: 8,
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
          '*::-webkit-scrollbar-thumb:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.28),
          },
          ':where(a, button, [role="button"], [tabindex]):focus-visible': {
            outline: `2px solid ${focusRing}`,
            outlineOffset: 2,
          },
          '@media (prefers-reduced-motion: reduce)': {
            html: { scrollBehavior: 'auto' },
            '*, *::before, *::after': {
              animationDuration: '0.001ms !important',
              transitionDuration: '0.001ms !important',
              scrollBehavior: 'auto !important',
            },
          },
        }),
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: CONTROL_RADIUS,
            minHeight: 40,
            paddingInline: 18,
            paddingBlock: 8,
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: 'none',
            transition: theme.transitions.create(
              ['background-color', 'border-color', 'box-shadow', 'transform', 'color'],
              { duration: 160, easing: MOTION.ease }
            ),
            '&:active': { transform: 'scale(0.98)' },
            '&.Mui-focusVisible': {
              outline: `2px solid ${focusRing}`,
              outlineOffset: 2,
            },
          }),
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
            '&:active': { boxShadow: 'none' },
          },
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
            '&:hover': {
              borderColor: alpha(theme.palette.primary.main, 0.45),
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
            },
          }),
          text: { paddingInline: 12 },
          sizeLarge: {
            minHeight: 46,
            paddingInline: 24,
            fontSize: '0.9375rem',
            borderRadius: INNER_RADIUS,
          },
          sizeSmall: {
            minHeight: 34,
            paddingInline: 12,
            fontSize: '0.8125rem',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            transition: theme.transitions.create(
              ['background-color', 'color', 'transform', 'border-color'],
              { duration: 150, easing: MOTION.ease }
            ),
            '&:active': { transform: 'scale(0.92)' },
            '&.Mui-focusVisible': {
              outline: `2px solid ${focusRing}`,
              outlineOffset: 2,
            },
          }),
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            // Il tap highlight blu di default è il dettaglio che fa
            // sembrare un sito web una pagina nativa.
            WebkitTapHighlightColor: 'transparent',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', borderRadius: SURFACE_RADIUS },
          outlined: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: DIALOG_RADIUS,
            backgroundImage: 'none',
            border: '1px solid',
            borderColor: theme.palette.divider,
          }),
          backdrop: {
            backgroundColor: 'rgba(8, 12, 11, 0.52)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: fontDisplay,
            fontWeight: 600,
            fontSize: '1.125rem',
            lineHeight: 1.35,
            padding: '22px 24px 12px',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: '20px 24px' },
          dividers: ({ theme }) => ({
            borderTopColor: theme.palette.divider,
            borderBottomColor: theme.palette.divider,
          }),
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: '16px 24px 22px', gap: 8 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: CONTROL_RADIUS,
            transition: theme.transitions.create(
              ['border-color', 'box-shadow', 'background-color'],
              { duration: 160, easing: MOTION.ease }
            ),
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(theme.palette.primary.main, 0.45),
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2,
            },
          }),
          notchedOutline: ({ theme }) => ({ borderColor: theme.palette.divider }),
          multiline: { padding: 0 },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { fontWeight: 500 },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            height: 26,
            fontFamily: fontBody,
            fontWeight: 600,
            fontSize: '0.8125rem',
            letterSpacing: 0,
          },
          sizeSmall: { height: 22, fontSize: '0.75rem' },
          label: { paddingInline: 10 },
          outlined: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 3, borderRadius: 3 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 40,
            minWidth: 0,
            paddingInline: 14,
            borderRadius: 0,
            textTransform: 'none',
            fontWeight: 600,
            transition: theme.transitions.create(
              ['background-color', 'color', 'transform'],
              { duration: 160, easing: MOTION.ease }
            ),
            '&:active': { transform: 'scale(0.98)' },
          }),
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: INNER_RADIUS,
            border: '1px solid',
            borderColor: theme.palette.divider,
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 18px 40px -20px rgba(0,0,0,0.85)'
                : '0 18px 40px -24px rgba(20,24,26,0.35)',
          }),
          list: { padding: 6 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            minHeight: 40,
            marginInline: 4,
            fontSize: '0.875rem',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            borderRadius: 8,
            fontFamily: fontBody,
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '5px 9px',
          }),
          arrow: ({ theme }) => ({ color: theme.palette.text.primary }),
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ theme, ownerState }) => {
            const tone =
              theme.palette[ownerState.severity]?.main || theme.palette.info.main;
            return {
              borderRadius: CONTROL_RADIUS,
              border: '1px solid',
              borderColor: alpha(tone, 0.28),
              alignItems: 'center',
            };
          },
          message: { fontSize: '0.84375rem', lineHeight: 1.5 },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            backgroundColor: alpha(theme.palette.text.primary, 0.07),
          }),
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            fontFamily: fontDisplay,
            fontWeight: 700,
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: { borderRadius: INNER_RADIUS },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
            color: theme.palette.text.secondary,
            borderColor: theme.palette.divider,
            '&.Mui-selected': {
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.14),
              },
            },
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 10,
            transition: theme.transitions.create(
              ['background-color', 'color'],
              { duration: 150, easing: MOTION.ease }
            ),
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiLink: {
        styleOverrides: {
          root: { textUnderlineOffset: 3 },
        },
      },
    },
  });
}

export const themes = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
  amoled: buildTheme('amoled'),
};

export function resolveThemeMode(preference) {
  if (preference === 'auto') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return preference;
}

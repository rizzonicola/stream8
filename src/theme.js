import { createTheme } from '@mui/material/styles';

/**
 * Stream8 — Design tokens (Material Design 3 inspired)
 * -----------------------------------------------------
 * Palette:
 *  - ink        #14181A  sfondo scuro primario
 *  - surfaceDk  #1B211F  superfici scure (card)
 *  - teal       #4FD1C5  accento acquamarina (dark theme)
 *  - tealDeep   #0F8B8D  accento profondo / hover
 *  - paper      #F7F5F1  sfondo chiaro caldo
 *  - coral      #E2725B  errori / badge "non disponibile"
 *
 * Tipografia:
 *  - Display: Manrope (titoli, hero, badge numerici)
 *  - Body/Utility: "Roboto Flex" (corpo testo, metadata)
 *
 * Firma visiva: angoli invertiti ("inverted corners") sulle card e sui
 * pulsanti primari, che richiamano il taglio di un biglietto da cinema.
 */

const fontDisplay = '"Manrope", "Roboto Flex", sans-serif';
const fontBody = '"Roboto Flex", "Manrope", sans-serif';

const shape = {
  borderRadius: 14,
};

// Radius uniforme riutilizzato da card, superfici e contenitori.
// Ridotto rispetto alla versione precedente per un look più squadrato e
// moderno: la "morbidezza" M3 resta ma senza eccessi da bolla.
export const CARD_RADIUS = 12;
export const SURFACE_RADIUS = 18;
export const PILL_RADIUS = 12; // usato da bottoni/chip: arrotondato ma non a pillola

const typography = {
  fontFamily: fontBody,
  h1: { fontFamily: fontDisplay, fontWeight: 800, letterSpacing: -0.5 },
  h2: { fontFamily: fontDisplay, fontWeight: 800, letterSpacing: -0.5 },
  h3: { fontFamily: fontDisplay, fontWeight: 700 },
  h4: { fontFamily: fontDisplay, fontWeight: 700 },
  h5: { fontFamily: fontDisplay, fontWeight: 700 },
  h6: { fontFamily: fontDisplay, fontWeight: 600 },
  button: { fontFamily: fontDisplay, fontWeight: 700, textTransform: 'none', letterSpacing: 0.2 },
  overline: { fontFamily: fontBody, fontWeight: 600, letterSpacing: 1.5 },
};

// Angoli invertiti: usiamo mask CSS per "ritagliare" l'angolo in alto a
// sinistra e in basso a destra, tipico motivo M3 "scalloped / cut corner".
export const invertedCorner = (size = 18) => ({
  clipPath: `polygon(
    ${size}px 0%, 100% 0%, 100% calc(100% - ${size}px),
    calc(100% - ${size}px) 100%, 0% 100%, 0% ${size}px
  )`,
});

function buildTheme(mode) {
  const isAmoled = mode === 'amoled';
  const isDarkFamily = mode === 'dark' || isAmoled;

  const palette = isDarkFamily
    ? {
        mode: 'dark',
        primary: { main: '#4FD1C5', dark: '#0F8B8D', contrastText: '#0A1211' },
        secondary: { main: '#8CE5DB' },
        error: { main: '#E2725B' },
        background: {
          default: isAmoled ? '#000000' : '#14181A',
          paper: isAmoled ? '#0A0A0A' : '#1B211F',
        },
        divider: 'rgba(79, 209, 197, 0.16)',
        text: { primary: '#EAF3F1', secondary: '#9FB4B0' },
      }
    : {
        mode: 'light',
        primary: { main: '#0F8B8D', dark: '#0B6567', contrastText: '#FFFFFF' },
        secondary: { main: '#D97757' },
        error: { main: '#C4432D' },
        background: { default: '#F7F5F1', paper: '#FFFFFF' },
        divider: 'rgba(15, 139, 141, 0.14)',
        text: { primary: '#161A19', secondary: '#5B6664' },
      };

  return createTheme({
    palette,
    shape,
    typography,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: PILL_RADIUS,
            paddingInline: 22,
            paddingBlock: 10,
            boxShadow: 'none',
          },
          contained: {
            boxShadow: isDarkFamily
              ? '0 8px 24px -8px rgba(79, 209, 197, 0.45)'
              : '0 8px 24px -8px rgba(15, 139, 141, 0.35)',
            '&:hover': {
              boxShadow: isDarkFamily
                ? '0 10px 28px -6px rgba(79, 209, 197, 0.55)'
                : '0 10px 28px -6px rgba(15, 139, 141, 0.45)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: SURFACE_RADIUS,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontFamily: fontBody, fontWeight: 600, borderRadius: PILL_RADIUS },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: SURFACE_RADIUS,
            backgroundImage: 'none',
            backgroundColor: isAmoled ? '#0A0A0A' : undefined,
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { borderRadius: 10 },
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

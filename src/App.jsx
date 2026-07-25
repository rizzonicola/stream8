import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeProvider, CssBaseline, Box, CircularProgress, Collapse, Alert } from '@mui/material';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { HistoryProvider } from './context/HistoryContext';
import { ConsentProvider, useConsent } from './context/ConsentContext';
import { themes, resolveThemeMode } from './theme';
import { resolveLang, t } from './i18n';
import OnboardingDialog from './components/OnboardingDialog';
import ConsentDialog from './components/ConsentDialog';
import ImportSettingsDialog from './components/ImportSettingsDialog';
import NavBar, { VIEWS } from './components/NavBar';
import SearchDialog from './components/SearchDialog';
import { useRouter, detailPath, parseDetailPath, ROUTES } from './utils/router';
import { decodeSettingsPayload } from './utils/shareSettings';
import { useOnlineStatus } from './utils/useOnlineStatus';

// Le pagine sono caricate on-demand (code-splitting): la Home resta
// immediata, le altre schermate vengono scaricate solo quando servono.
const HomePage = lazy(() => import('./pages/HomePage'));
const DetailPage = lazy(() => import('./pages/DetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const InfoPage = lazy(() => import('./pages/InfoPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
      <CircularProgress />
    </Box>
  );
}

function pathToView(path) {
  if (path.startsWith(ROUTES.MOVIES)) return VIEWS.MOVIES;
  if (path.startsWith(ROUTES.SERIES)) return VIEWS.SERIES;
  if (path.startsWith(ROUTES.ANIME)) return VIEWS.ANIME;
  return VIEWS.HOME;
}

const VIEW_TO_ROUTE = {
  [VIEWS.HOME]: ROUTES.HOME,
  [VIEWS.MOVIES]: ROUTES.MOVIES,
  [VIEWS.SERIES]: ROUTES.SERIES,
  [VIEWS.ANIME]: ROUTES.ANIME,
};

function AppShell() {
  const { settings, completeOnboarding, importSettings } = useSettings();
  const { hasDecided, setHistoryConsent } = useConsent();
  const { path, navigate, replace, state } = useRouter();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const isOnline = useOnlineStatus();

  // ---- Importazione impostazioni da link condiviso (vedi utils/shareSettings.js) ----
  // Un link con path `/import-settings?data=...` deve mostrare un avviso di
  // conferma PRIMA di qualunque altra cosa (anche prima del consenso privacy
  // per un utente nuovo): l'utente deve sapere cosa sta per succedere prima
  // di prendere qualsiasi altra decisione nell'app. Solo dopo la conferma, e
  // solo dopo che il consenso privacy è stato dato (subito se già dato in
  // passato, altrimenti tramite il normale ConsentDialog), le impostazioni
  // importate vengono davvero applicate.
  const [importPayload, setImportPayload] = useState(null); // impostazioni decodificate, in attesa di essere applicate
  const [importDialogOpen, setImportDialogOpen] = useState(false); // dialog di conferma "sei sicuro?"
  const importHandledRef = useRef(false);

  useEffect(() => {
    if (importHandledRef.current) return;
    if (!path.startsWith(ROUTES.IMPORT_SETTINGS)) return;
    importHandledRef.current = true;
    const search = path.split('?')[1] || '';
    const payload = decodeSettingsPayload(new URLSearchParams(search).get('data'));
    if (payload) {
      setImportPayload(payload);
      setImportDialogOpen(true);
    } else {
      console.error('[Stream8 Settings] link di importazione mancante o corrotto, ignorato.');
    }
    // Ripulisce subito l'URL (il payload resta comunque in memoria nello
    // stato React): evita che un refresh della pagina ridichieda
    // l'importazione, e non lascia i dati delle impostazioni nella barra
    // degli indirizzi/cronologia del browser più del necessario.
    replace(ROUTES.HOME);
  }, [path, replace]);

  // Applica le impostazioni importate non appena sono soddisfatte entrambe
  // le condizioni: dialog di conferma già chiuso (utente ha detto "sì") e
  // consenso privacy già deciso (dato ora o in passato).
  useEffect(() => {
    if (importPayload && !importDialogOpen && hasDecided) {
      importSettings(importPayload);
      setImportPayload(null);
    }
  }, [importPayload, importDialogOpen, hasDecided, importSettings]);

  const handleImportConfirm = useCallback(() => setImportDialogOpen(false), []);
  const handleImportDecline = useCallback(() => {
    setImportDialogOpen(false);
    setImportPayload(null);
  }, []);

  const lang = resolveLang(settings.language);
  const themeMode = resolveThemeMode(settings.theme);
  const activeTheme = themes[themeMode] || themes.dark;

  // Tiene sincronizzato il colore della barra di stato/indirizzo (e della
  // splash screen in modalità PWA installata) con lo sfondo del tema
  // effettivamente in uso, incluso AMOLED (nero puro).
  useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', activeTheme.palette.background.default);
  }, [activeTheme]);

  const detailParams = parseDetailPath(path);
  const isSettings = path === ROUTES.SETTINGS;
  const isInfo = path === ROUTES.INFO;
  const isHistory = path === ROUTES.HISTORY;
  const view = pathToView(path);

  const openDetail = useCallback((item) => navigate(detailPath(item), item), [navigate]);
  const changeView = useCallback((v) => navigate(VIEW_TO_ROUTE[v]), [navigate]);
  const openSettings = useCallback(() => navigate(ROUTES.SETTINGS), [navigate]);
  const openInfo = useCallback(() => navigate(ROUTES.INFO), [navigate]);
  const openHistory = useCallback(() => navigate(ROUTES.HISTORY), [navigate]);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const goBack = useCallback(() => window.history.back(), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Tiene stagione/episodio sincronizzati nell'URL mentre si è sulla pagina
  // di dettaglio (replaceState: non aggiunge voci alla cronologia del
  // browser per ogni cambio, aggiorna solo quella corrente).
  const updateDetailUrl = useCallback(
    (season, episode) => {
      if (!detailParams) return;
      const base = `/title/${detailParams.mediaType}/${detailParams.id}`;
      const qs = new URLSearchParams();
      if (season != null) qs.set('s', season);
      if (episode != null) qs.set('e', episode);
      const query = qs.toString();
      // Passa lo state corrente (letto al momento della chiamata, non
      // catturato in chiusura) invece di lasciarlo implicitamente a null:
      // altrimenti ogni cambio di stagione/episodio cancellerebbe il seed
      // usato per l'anteprima istantanea di titolo/poster.
      replace(query ? `${base}?${query}` : base, window.history.state);
    },
    // Dipende solo dall'identità del titolo (non dall'intero oggetto
    // detailParams, che include season/episode e cambierebbe riferimento
    // ad ogni loro variazione, causando un giro a vuoto in più).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replace, detailParams?.mediaType, detailParams?.id]
  );

  const content = useMemo(() => {
    if (detailParams) {
      return (
        <DetailPage
          key={`${detailParams.mediaType}-${detailParams.id}`}
          lang={lang}
          params={detailParams}
          seed={state && state.id === detailParams.id ? state : null}
          onBack={goBack}
          onSeasonEpisodeChange={updateDetailUrl}
        />
      );
    }
    if (isSettings) return <SettingsPage lang={lang} />;
    if (isInfo) return <InfoPage lang={lang} />;
    if (isHistory) return <HistoryPage lang={lang} onOpenDetail={openDetail} />;
    return <HomePage lang={lang} view={view} onOpenDetail={openDetail} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, lang]);

  const showNavBar = !detailParams;

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />

      <ImportSettingsDialog
        open={importDialogOpen}
        lang={lang}
        onConfirm={handleImportConfirm}
        onDecline={handleImportDecline}
      />

      <ConsentDialog
        open={!hasDecided && !importDialogOpen}
        lang={lang}
        onChoose={(acceptHistory) => setHistoryConsent(acceptHistory)}
      />

      {hasDecided && !importDialogOpen && !importPayload && (
        <OnboardingDialog
          open={!settings.onboardingComplete}
          lang={lang}
          onComplete={(selectedMainstream, customServices) =>
            completeOnboarding(selectedMainstream, customServices)
          }
        />
      )}

      {hasDecided && settings.onboardingComplete && !importDialogOpen && !importPayload && (
        <>
          <Collapse in={!isOnline}>
            <Alert severity="warning" square sx={{ borderRadius: 0 }}>
              {t(lang, 'offline_banner')}
            </Alert>
          </Collapse>

          {showNavBar && (
            <NavBar
              lang={lang}
              activeView={view}
              onChangeView={changeView}
              onOpenSettings={openSettings}
              onOpenInfo={openInfo}
              onOpenHistory={openHistory}
              onOpenSearch={openSearch}
            />
          )}

          <Suspense fallback={<PageLoader />}>{content}</Suspense>

          <SearchDialog
            open={searchOpen}
            lang={lang}
            onClose={closeSearch}
            onSelect={openDetail}
          />
        </>
      )}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ConsentProvider>
      <SettingsProvider>
        <HistoryProvider>
          <AppShell />
        </HistoryProvider>
      </SettingsProvider>
    </ConsentProvider>
  );
}

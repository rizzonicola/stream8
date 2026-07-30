import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../utils/storageKeys';

// Le preferenze (servizi di streaming, tema, lingua) sono dati tecnicamente
// necessari al funzionamento di un'app senza server: senza salvarle in
// locale, l'utente dovrebbe rifare l'onboarding ad ogni visita. Per questo
// vengono sempre salvate, senza bisogno di un consenso esplicito (a
// differenza della cronologia, gestita da ConsentContext/HistoryContext).

const DEFAULT_SETTINGS = {
  onboardingComplete: false,
  selectedMainstream: [], // array di id da MAINSTREAM_SERVICES
  customServices: [], // [{ id, name, baseUrl, config: {movie_pattern,...} }]
  theme: 'auto', // auto | light | dark | amoled
  language: 'auto', // auto | it | en | fr
  // Sincronizzazione cronologia (opzionale, disattivata di default): verso
  // un server auto-ospitato dall'utente stesso, mai un server di Stream8.
  sync: {
    enabled: false,
    serverUrl: '',
    apiKey: '',
    autoSync: true, // sincronizza automaticamente ad ogni nuovo episodio
    lastSyncAt: null,
    lastError: null,
  },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      sync: { ...DEFAULT_SETTINGS.sync, ...(parsed.sync || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // storage non disponibile (es. modalità privata): ignoriamo silenziosamente
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Ogni funzione esposta è avvolta in useCallback con `setSettings` come
  // unica dipendenza (stabile, da useState): l'identità resta la stessa tra
  // un render e l'altro invece di essere ricreata ad ogni cambio di
  // `settings`. Senza questo, ogni consumatore che usa una di queste
  // funzioni in un array di dipendenze (es. updateSync in HistoryContext) si
  // ritroverebbe con un nuovo riferimento ad ogni impostazione modificata,
  // propagando ricalcoli/re-render inutili a valle e vanificando i memo()
  // sui componenti figli.
  const completeOnboarding = useCallback(
    (selectedMainstream, customServices) =>
      setSettings((s) => ({
        ...s,
        onboardingComplete: true,
        selectedMainstream,
        customServices,
      })),
    []
  );
  const updateMainstream = useCallback(
    (selectedMainstream) => setSettings((s) => ({ ...s, selectedMainstream })),
    []
  );
  const addCustomService = useCallback(
    (service) => setSettings((s) => ({ ...s, customServices: [...s.customServices, service] })),
    []
  );
  const removeCustomService = useCallback(
    (id) =>
      setSettings((s) => ({
        ...s,
        customServices: s.customServices.filter((c) => c.id !== id),
      })),
    []
  );
  const setTheme = useCallback((theme) => setSettings((s) => ({ ...s, theme })), []);
  const setLanguage = useCallback((language) => setSettings((s) => ({ ...s, language })), []);
  // Aggiorna anche solo un sottoinsieme dei campi di sincronizzazione
  // (usato sia dalla UI in Impostazioni sia, internamente, da
  // HistoryContext per registrare l'esito dell'ultimo sync).
  const updateSync = useCallback(
    (partial) => setSettings((s) => ({ ...s, sync: { ...s.sync, ...partial } })),
    []
  );
  // Applica impostazioni ricevute da un link di condivisione
  // (vedi utils/shareSettings.js). Sovrascrive SOLO i campi presenti
  // in `partial` (già filtrati in whitelist dal chiamante): non tocca
  // mai `sync` — anche se per qualche motivo fosse presente in
  // `partial`, viene esplicitamente ignorato qui come ultima difesa —
  // e non tocca la cronologia, che vive in un contesto separato.
  // L'onboarding viene marcato completo: chi importa una
  // configurazione funzionante non deve rifare il wizard iniziale.
  const importSettings = useCallback(
    (partial) =>
      setSettings((s) => ({
        ...s,
        ...partial,
        sync: s.sync,
        onboardingComplete: true,
      })),
    []
  );

  const api = useMemo(
    () => ({
      settings,
      completeOnboarding,
      updateMainstream,
      addCustomService,
      removeCustomService,
      setTheme,
      setLanguage,
      updateSync,
      importSettings,
    }),
    [
      settings,
      completeOnboarding,
      updateMainstream,
      addCustomService,
      removeCustomService,
      setTheme,
      setLanguage,
      updateSync,
      importSettings,
    ]
  );

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings deve essere usato dentro <SettingsProvider>');
  return ctx;
}

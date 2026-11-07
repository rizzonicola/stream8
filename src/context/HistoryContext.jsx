import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../utils/storageKeys';
import { readJson, writeJson, removeKey } from '../utils/storage';
import {
  entryKey,
  groupHistoryByShow,
  isTombstone,
  mergeHistories,
  normalizeHistory,
  pruneOldTombstones,
  showKey,
} from '../utils/historyModel';
import { useConsent } from './ConsentContext';
import { useSettings } from './SettingsContext';
import { fetchRemoteHistory, pushRemoteHistory } from '../api/syncClient';

function log(...args) {
  console.info('[Stream8 History]', ...args);
}

function loadHistory() {
  const parsed = readJson(STORAGE_KEYS.HISTORY, []);
  if (!Array.isArray(parsed)) return [];
  return normalizeHistory(pruneOldTombstones(parsed));
}

function saveHistory(history) {
  return writeJson(STORAGE_KEYS.HISTORY, history, {
    // Quota esaurita: salva la metà più recente invece di perdere tutto.
    onQuota: (value) => value.slice(0, Math.max(1, Math.floor(value.length / 2))),
  });
}

const HistoryContext = createContext(null);

export function HistoryProvider({ children }) {
  const { historyEnabled } = useConsent();
  const { settings, updateSync } = useSettings();
  // La cronologia funziona sempre durante la sessione; solo la scrittura su
  // disco è condizionata al consenso. `rawHistory` include i tombstone,
  // necessari alla propagazione delle cancellazioni; la vista pubblica li filtra.
  const [rawHistory, setRawHistory] = useState(() => (historyEnabled ? loadHistory() : []));
  const [syncing, setSyncing] = useState(false);

  // Ref sincrono: le funzioni sotto devono leggere lo stato più recente anche
  // quando vengono chiamate nello stesso tick di un setState.
  const rawHistoryRef = useRef(rawHistory);
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const pushQueueRef = useRef(Promise.resolve());
  const syncSettingsRef = useRef(settings.sync);
  syncSettingsRef.current = settings.sync;

  // Le scritture verso il server vengono accodate: un push diretto di
  // cancellazione e il push finale di una sync non devono sovrascriversi a
  // vicenda in base all'ordine di arrivo delle risposte HTTP.
  const enqueuePush = useCallback((task) => {
    const next = pushQueueRef.current.catch(() => {}).then(task);
    pushQueueRef.current = next.catch(() => {});
    return next;
  }, []);

  const setRaw = useCallback((next) => {
    rawHistoryRef.current = next;
    setRawHistory(next);
  }, []);

  // Scrittura debounced: una raffica di aggiunte/rimozioni non deve
  // serializzare l'intera cronologia sul thread principale ad ogni evento.
  useEffect(() => {
    if (!historyEnabled) return undefined;
    const timer = setTimeout(() => saveHistory(rawHistoryRef.current), 200);
    return () => clearTimeout(timer);
  }, [rawHistory, historyEnabled]);

  // Flush quando la pagina sta per essere chiusa o passa in background.
  useEffect(() => {
    if (!historyEnabled) return undefined;
    const flush = () => saveHistory(rawHistoryRef.current);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [historyEnabled]);

  // Disattivando il salvataggio, rimuoviamo subito quanto già su disco.
  const wasEnabled = useRef(historyEnabled);
  useEffect(() => {
    if (wasEnabled.current && !historyEnabled) removeKey(STORAGE_KEYS.HISTORY);
    wasEnabled.current = historyEnabled;
  }, [historyEnabled]);

  const history = useMemo(() => rawHistory.filter((e) => !isTombstone(e)), [rawHistory]);

  // ---- Sincronizzazione opzionale verso un server auto-ospitato ----
  const pushDirect = useCallback(
    async (entries) => {
      const sync = syncSettingsRef.current;
      if (!historyEnabled || !sync.enabled || !sync.serverUrl || !sync.apiKey) return;
      try {
        await enqueuePush(() => pushRemoteHistory(sync.serverUrl, sync.apiKey, entries));
        updateSync({ lastSyncAt: Date.now(), lastError: null });
        log('push diretto completato,', entries.length, 'voci inviate');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore di sincronizzazione';
        console.error('[Stream8 History] push diretto fallito:', err);
        updateSync({ lastError: message });
      }
    },
    [updateSync, historyEnabled, enqueuePush]
  );

  // Sync completo: legge il remoto, unisce con la cronologia locale PIÙ
  // RECENTE (riletta dal ref dopo l'attesa di rete) e riscrive entrambi.
  // Rileggere il ref a merge avvenuto è essenziale: una rimozione o
  // un'importazione fatta mentre la richiesta era in volo non deve essere
  // sovrascritta da uno snapshot precedente.
  const runSync = useCallback(
    async () => {
      const sync = syncSettingsRef.current;
      if (!historyEnabled || !sync.enabled || !sync.serverUrl || !sync.apiKey) return;

      if (syncInFlightRef.current) {
        log('sync già in corso: la richiesta verrà rieseguita al termine');
        pendingSyncRef.current = true;
        return;
      }

      syncInFlightRef.current = true;
      setSyncing(true);
      try {
        const remote = await fetchRemoteHistory(sync.serverUrl, sync.apiKey);
        const merged = normalizeHistory(
          pruneOldTombstones(mergeHistories(rawHistoryRef.current, remote))
        );
        setRaw(merged);
        await enqueuePush(() => pushRemoteHistory(sync.serverUrl, sync.apiKey, merged));
        updateSync({ lastSyncAt: Date.now(), lastError: null });
        log('sync completata,', merged.length, 'voci (di cui tombstone:', merged.filter(isTombstone).length, ')');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore di sincronizzazione';
        console.error('[Stream8 History] sync fallita:', err);
        updateSync({ lastError: message });
      } finally {
        syncInFlightRef.current = false;
        setSyncing(false);
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false;
          runSync();
        }
      }
    },
    [updateSync, historyEnabled, setRaw, enqueuePush]
  );

  const syncNow = useCallback(() => runSync(), [runSync]);

  const addEntry = useCallback(
    (entry) => {
      const candidate = { ...entry, watchedAt: Date.now(), deleted: false };
      const key = entryKey(candidate);
      if (!key) return;
      const next = normalizeHistory([{ ...candidate, _key: key }, ...rawHistoryRef.current]);
      setRaw(next);
      log('voce aggiunta:', key);
      const sync = syncSettingsRef.current;
      if (sync.enabled && sync.autoSync) {
        runSync();
      }
    },
    [setRaw, runSync]
  );

  const removeEntry = useCallback(
    (key) => {
      if (!key) return;
      const tombstone = { _key: key, watchedAt: Date.now(), deleted: true };
      const next = normalizeHistory([
        tombstone,
        ...rawHistoryRef.current.filter((e) => e._key !== key),
      ]);
      setRaw(next);
      log('voce cancellata (tombstone creato):', key);
      if (syncSettingsRef.current.enabled) pushDirect(next);
    },
    [setRaw, pushDirect]
  );

  // La card raggruppata in Home rappresenta l'intera serie: rimuoverla deve
  // creare un tombstone per ogni episodio visibile, non solo per l'ultimo.
  const removeShow = useCallback(
    (item) => {
      const key = showKey(item);
      if (!key) return;
      const keys = new Set(
        rawHistoryRef.current
          .filter((e) => !isTombstone(e) && showKey(e) === key)
          .map((e) => e._key)
      );
      if (keys.size === 0) return;
      const now = Date.now();
      const tombstones = [...keys].map((_key) => ({ _key, watchedAt: now, deleted: true }));
      const next = normalizeHistory([
        ...tombstones,
        ...rawHistoryRef.current.filter((e) => !keys.has(e._key)),
      ]);
      setRaw(next);
      log('serie cancellata (tombstone creati):', keys.size);
      if (syncSettingsRef.current.enabled) pushDirect(next);
    },
    [setRaw, pushDirect]
  );

  const clearHistory = useCallback(() => {
    const now = Date.now();
    const tombstones = rawHistoryRef.current
      .filter((e) => !isTombstone(e))
      .map((e) => ({ _key: e._key, watchedAt: now, deleted: true }));
    const next = normalizeHistory([
      ...tombstones,
      ...rawHistoryRef.current.filter((e) => isTombstone(e)),
    ]);
    setRaw(next);
    log('cronologia svuotata,', tombstones.length, 'tombstone creati');
    if (syncSettingsRef.current.enabled) pushDirect(next);
  }, [setRaw, pushDirect]);

  const exportHistory = useCallback(() => {
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stream8-cronologia-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [history]);

  const importHistory = useCallback(
    (jsonText) => {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error('Il file di cronologia non è valido.');
      // Importa solo voci valide, poi unisce con i tombstone locali: una
      // cancellazione esplicita non deve "risorgere" da un file vecchio.
      const imported = normalizeHistory(
        parsed.map((e) => ({ ...e, deleted: false })),
        { limit: Number.POSITIVE_INFINITY }
      );
      const merged = normalizeHistory(
        pruneOldTombstones(mergeHistories(imported, rawHistoryRef.current))
      );
      setRaw(merged);
      log('cronologia importata,', imported.length, 'voci valide nel file');
      if (syncSettingsRef.current.enabled) pushDirect(merged);
    },
    [setRaw, pushDirect]
  );

  const api = useMemo(
    () => ({
      history,
      // Vista compatta: una card per show (l'ultimo episodio visto).
      groupedHistory: groupHistoryByShow(history),
      syncing,
      syncNow,
      addEntry,
      removeEntry,
      removeShow,
      clearHistory,
      exportHistory,
      importHistory,
    }),
    [
      history,
      syncing,
      syncNow,
      addEntry,
      removeEntry,
      removeShow,
      clearHistory,
      exportHistory,
      importHistory,
    ]
  );

  return <HistoryContext.Provider value={api}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory deve essere usato dentro <HistoryProvider>');
  return ctx;
}

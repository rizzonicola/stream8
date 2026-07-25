import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../utils/storageKeys';
import { useConsent } from './ConsentContext';
import { useSettings } from './SettingsContext';
import {
  fetchRemoteHistory,
  pushRemoteHistory,
  mergeHistories,
  isTombstone,
  pruneOldTombstones,
} from '../api/syncClient';

function log(...args) {
  console.info('[Stream8 History]', ...args);
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // I tombstone molto vecchi (cancellazioni già propagate ovunque da
    // tempo) vengono ripuliti anche in locale, per non far crescere la
    // cronologia salvata all'infinito.
    return pruneOldTombstones(parsed);
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch {
    // ignora se lo storage non è disponibile
  }
}

// Raggruppa la cronologia per titolo (film o serie): per le serie/anime
// tiene solo l'episodio visto più di recente, così in Home non si accumulano
// card duplicate per ogni episodio della stessa stagione guardato di seguito.
// Riceve sempre e solo la cronologia già filtrata dai tombstone (le voci
// cancellate non devono mai comparire in UI).
function groupHistoryByShow(history) {
  const seen = new Map();
  const ordered = [];
  for (const entry of history) {
    const groupKey = `${entry.mediaType}-${entry.id}`;
    if (!seen.has(groupKey)) {
      seen.set(groupKey, entry);
      ordered.push(entry);
    }
  }
  return ordered;
}

const HistoryContext = createContext(null);

export function HistoryProvider({ children }) {
  const { historyEnabled } = useConsent();
  const { settings, updateSync } = useSettings();
  // La cronologia funziona sempre normalmente durante la sessione (così
  // "Continua a guardare" e il flusso "Guarda su..." restano pienamente
  // funzionanti anche senza consenso); solo la scrittura su disco è
  // condizionata alla scelta dell'utente.
  //
  // `rawHistory` è la VERA fonte di verità: include anche i tombstone
  // (voci con `deleted: true`) delle cancellazioni, necessari per far
  // propagare correttamente le rimozioni durante i merge (vedi
  // syncClient.mergeHistories). Tutto ciò che è rivolto all'utente
  // (`history`, `groupedHistory`, export) deve invece usare la versione
  // filtrata, mai `rawHistory` direttamente.
  const [rawHistory, setRawHistory] = useState(() => (historyEnabled ? loadHistory() : []));
  const [syncing, setSyncing] = useState(false);

  // `rawHistoryRef` rispecchia sempre `rawHistory` in modo SINCRONO. È il
  // pezzo che risolve il bug principale: prima, `syncNow` leggeva `history`
  // dalla closure di React (valore "congelato" al render in cui la funzione
  // è stata creata). Se `addEntry` chiamava `setHistory(next)` e subito dopo
  // `syncNow()` nello stesso tick, `syncNow` vedeva ancora lo stato PRIMA
  // dell'aggiunta, faceva il merge con quello stato vecchio, e infine
  // sovrascriveva lo stato con un risultato che non includeva la voce appena
  // aggiunta — motivo per cui, con l'auto-sync attivo, guardare un contenuto
  // a volte non veniva segnato nemmeno in locale. Usando il ref, ogni
  // funzione legge/scrive sempre il valore più recente, indipendentemente
  // dal ciclo di render di React.
  const rawHistoryRef = useRef(rawHistory);
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(null); // null | funzione base da ri-sincronizzare dopo quella in corso

  const setRaw = useCallback((next) => {
    rawHistoryRef.current = next;
    setRawHistory(next);
  }, []);

  useEffect(() => {
    if (historyEnabled) saveHistory(rawHistory);
  }, [rawHistory, historyEnabled]);

  // Se l'utente disattiva il salvataggio, rimuoviamo subito quanto già
  // presente sul dispositivo (diritto alla cancellazione); la sessione
  // corrente resta visibile in memoria finché non si ricarica la pagina.
  const wasEnabled = useRef(historyEnabled);
  useEffect(() => {
    if (wasEnabled.current && !historyEnabled) {
      try {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
      } catch {
        // ignora
      }
    }
    wasEnabled.current = historyEnabled;
  }, [historyEnabled]);

  // Vista pubblica: mai tombstone visibili all'utente.
  const history = useMemo(() => rawHistory.filter((e) => !isTombstone(e)), [rawHistory]);

  // ---- Sincronizzazione opzionale verso un server auto-ospitato ----
  // Vedi stream8-sync-server/server.md per il protocollo. Funzione
  // interamente opzionale: queste funzioni non toccano la rete se
  // settings.sync.enabled è false, o se url/chiave non sono impostati.

  // Push diretto (sostituisce, non unisce) usato per le rimozioni
  // esplicite: propaga subito l'intenzione dell'utente invece di rischiare
  // che un merge la faccia ricomparire da un altro dispositivo. `entries`
  // deve già includere gli eventuali tombstone appena creati.
  const pushDirect = useCallback(
    async (entries) => {
      const { sync } = settings;
      if (!historyEnabled || !sync.enabled || !sync.serverUrl || !sync.apiKey) return;
      try {
        await pushRemoteHistory(sync.serverUrl, sync.apiKey, entries);
        updateSync({ lastSyncAt: Date.now(), lastError: null });
        log('push diretto completato,', entries.length, 'voci inviate');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore di sincronizzazione';
        console.error('[Stream8 History] push diretto fallito:', err);
        updateSync({ lastError: message });
      }
    },
    [settings, updateSync, historyEnabled]
  );

  // Sync completo: legge il remoto, unisce con una base locale (di default
  // lo stato più aggiornato disponibile, letto dal ref e non dalla
  // closure), scrive entrambi. Usato dal pulsante "Sincronizza ora" e dalla
  // sincronizzazione automatica ad ogni nuovo episodio guardato.
  //
  // Se viene chiamata mentre una sync è già in corso, invece di abortire
  // silenziosamente (come accadeva prima — causa primaria dell'"auto sync
  // instabile", perché una sync scattata da un episodio poteva sparire nel
  // nulla senza traccia), la richiesta viene accodata e rieseguita
  // automaticamente subito dopo, sulla base più recente disponibile.
  const runSync = useCallback(
    async (baseList) => {
      const { sync } = settings;
      if (!historyEnabled || !sync.enabled || !sync.serverUrl || !sync.apiKey) return;

      if (syncInFlightRef.current) {
        log('sync già in corso: la richiesta verrà rieseguita al termine');
        pendingSyncRef.current = () => rawHistoryRef.current;
        return;
      }

      syncInFlightRef.current = true;
      setSyncing(true);
      try {
        const base = baseList ?? rawHistoryRef.current;
        const remote = await fetchRemoteHistory(sync.serverUrl, sync.apiKey);
        const merged = pruneOldTombstones(mergeHistories(base, remote)).slice(0, 100);
        setRaw(merged);
        await pushRemoteHistory(sync.serverUrl, sync.apiKey, merged);
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
          const getBase = pendingSyncRef.current;
          pendingSyncRef.current = null;
          runSync(getBase());
        }
      }
    },
    [settings, updateSync, historyEnabled, setRaw]
  );

  const syncNow = useCallback(() => runSync(undefined), [runSync]);

  const api = useMemo(
    () => ({
      history,
      // Vista compatta: un'unica card per show (l'ultimo episodio visto),
      // usata in Home e nelle altre sezioni. La cronologia completa con
      // ogni episodio separato resta disponibile in `history`.
      groupedHistory: groupHistoryByShow(history),
      syncing,
      syncNow,
      addEntry: (entry) => {
        const key = `${entry.mediaType}-${entry.id}-${entry.season ?? ''}-${entry.episode ?? ''}`;
        const next = [
          { ...entry, _key: key, watchedAt: Date.now(), deleted: false },
          ...rawHistoryRef.current.filter((e) => e._key !== key),
        ].slice(0, 100);
        setRaw(next);
        log('voce aggiunta:', key);
        if (settings.sync.enabled && settings.sync.autoSync) {
          // Fire-and-forget: non blocca l'azione dell'utente. Passiamo
          // esplicitamente `next` come base del merge, invece di lasciare
          // che runSync rilegga lo stato da solo in un momento successivo:
          // questo è ciò che garantisce che la voce appena aggiunta sia
          // sempre presente nel merge, eliminando la race condition.
          runSync(next);
        }
      },
      removeEntry: (key) => {
        // Cancellazione = tombstone, non rimozione secca dell'elemento.
        // Un tombstone è una normale voce con `deleted: true` e un
        // `watchedAt` aggiornato ad "adesso": è quello che permette al
        // last-write-wins di mergeHistories di far vincere la
        // cancellazione su qualunque copia più vecchia della stessa voce
        // presente su altri dispositivi, invece di lasciare che "riappaia"
        // al sync successivo.
        const next = [
          { _key: key, watchedAt: Date.now(), deleted: true },
          ...rawHistoryRef.current.filter((e) => e._key !== key),
        ];
        setRaw(next);
        log('voce cancellata (tombstone creato):', key);
        if (settings.sync.enabled) {
          pushDirect(next);
        }
      },
      clearHistory: () => {
        const now = Date.now();
        // Un tombstone per ogni voce attualmente visibile, così la
        // cancellazione di massa si propaga voce per voce come una
        // cancellazione singola; i tombstone già esistenti restano intatti.
        const tombstones = rawHistoryRef.current
          .filter((e) => !isTombstone(e))
          .map((e) => ({ _key: e._key, watchedAt: now, deleted: true }));
        const next = [...tombstones, ...rawHistoryRef.current.filter((e) => isTombstone(e))];
        setRaw(next);
        log('cronologia svuotata,', tombstones.length, 'tombstone creati');
        if (settings.sync.enabled) {
          pushDirect(next);
        }
      },
      exportHistory: () => {
        // Solo le voci visibili: i tombstone sono un dettaglio interno di
        // sincronizzazione e non hanno senso in un export per l'utente.
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
      },
      importHistory: (jsonText) => {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) throw new Error('Il file di cronologia non è valido.');
        // Il file importato non conosce i tombstone locali: li uniamo con
        // mergeHistories (stesso last-write-wins usato per la rete) invece
        // di sovrascrivere `rawHistory` di netto, così un'importazione non
        // fa "risorgere" per sbaglio voci che erano state cancellate di
        // proposito e non erano presenti nel file esportato in precedenza.
        const merged = mergeHistories(
          parsed.map((e) => ({ ...e, deleted: false })),
          rawHistoryRef.current
        );
        setRaw(merged);
        log('cronologia importata,', parsed.length, 'voci nel file');
        if (settings.sync.enabled) {
          pushDirect(merged);
        }
      },
    }),
    [history, syncing, syncNow, pushDirect, runSync, settings.sync.enabled, settings.sync.autoSync, setRaw]
  );

  return <HistoryContext.Provider value={api}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory deve essere usato dentro <HistoryProvider>');
  return ctx;
}

// Stream8 Sync — client
// -----------------------
// Comunica con un server di sincronizzazione auto-ospitato dall'utente
// (vedi stream8-sync-server/server.md per il protocollo completo).
// Funzionalità interamente opzionale: questo modulo non viene mai
// interrogato a meno che l'utente non abbia esplicitamente attivato e
// configurato la sincronizzazione nelle Impostazioni.

const REQUEST_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(serverUrl) {
  return serverUrl.replace(/\/+$/, '');
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class SyncError extends Error {}

// Log centralizzato per la sincronizzazione: senza questo, un fallimento di
// rete o un 401 spariva silenziosamente (catch che scartava l'errore
// originale), rendendo la sync "a intermittenza" impossibile da diagnosticare
// dalla console del browser.
function logSync(level, ...args) {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  fn('[Stream8 Sync]', ...args);
}

// Verifica che l'URL inserito dall'utente punti a un server Stream8 Sync
// raggiungibile, prima di salvare le impostazioni.
export async function checkSyncServer(serverUrl) {
  let res;
  try {
    res = await fetchWithTimeout(`${normalizeBaseUrl(serverUrl)}/v1/health`);
  } catch (err) {
    logSync('error', 'health check fallito:', err);
    throw new SyncError('Server non raggiungibile: controlla l\'indirizzo e che sia online.');
  }
  if (!res.ok) {
    throw new SyncError(`Il server ha risposto con un errore (HTTP ${res.status}).`);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new SyncError('Risposta del server non valida.');
  }
  if (data?.protocol !== 'stream8-sync-v1') {
    throw new SyncError('Questo indirizzo non sembra un server Stream8 Sync compatibile.');
  }
  return true;
}

async function authorizedFetch(serverUrl, apiKey, path, options = {}) {
  let res;
  try {
    res = await fetchWithTimeout(`${normalizeBaseUrl(serverUrl)}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    logSync('error', `${options.method || 'GET'} ${path} — rete/timeout:`, err);
    throw new SyncError('Impossibile contattare il server di sincronizzazione.');
  }
  if (res.status === 401) {
    logSync('warn', `${options.method || 'GET'} ${path} — 401 chiave non valida/revocata`);
    throw new SyncError('Chiave API non valida o revocata.');
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    logSync('error', `${options.method || 'GET'} ${path} — HTTP ${res.status}:`, bodyText);
    throw new SyncError(`Il server ha risposto con un errore (HTTP ${res.status}).`);
  }
  try {
    return await res.json();
  } catch (err) {
    logSync('error', `${options.method || 'GET'} ${path} — risposta JSON non valida:`, err);
    throw new SyncError('Risposta del server non valida.');
  }
}

export async function fetchRemoteHistory(serverUrl, apiKey) {
  const data = await authorizedFetch(serverUrl, apiKey, '/v1/history');
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  logSync('info', `GET /v1/history — ${entries.length} voci ricevute`);
  return entries;
}

export async function pushRemoteHistory(serverUrl, apiKey, entries) {
  const data = await authorizedFetch(serverUrl, apiKey, '/v1/history', {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
  logSync('info', `PUT /v1/history — inviate ${entries.length}, confermate ${Array.isArray(data?.entries) ? data.entries.length : 0}`);
  return Array.isArray(data?.entries) ? data.entries : [];
}

// Una voce è un "tombstone": non rappresenta più un titolo visto, ma il
// ricordo esplicito di un'eliminazione. Deve continuare a viaggiare nei
// merge/push (altrimenti la cancellazione non si propaga mai agli altri
// dispositivi), ma va nascosta da qualunque elenco mostrato all'utente.
export function isTombstone(entry) {
  return !!entry?.deleted;
}

// Rimuove i tombstone più vecchi di `maxAgeMs` (default 90 giorni): una volta
// trascorso un tempo ragionevole tutti i dispositivi attivi avranno già
// visto la cancellazione, quindi il tombstone può essere fatto sparire
// anche localmente senza rischiare che l'elemento "risorga".
export function pruneOldTombstones(entries, maxAgeMs = 90 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  return entries.filter((e) => !isTombstone(e) || (e.watchedAt ?? 0) >= cutoff);
}

// Unisce cronologia locale e remota per "_key", tenendo per ciascuna la
// voce con "watchedAt" più recente. Usato prima di ogni sync automatico o
// manuale (non per le rimozioni esplicite, che vanno propagate dirette:
// vedi server.md sezione 6).
//
// IMPORTANTE — cancellazioni: una cancellazione è rappresentata come una
// normale voce con `deleted: true` e `watchedAt` aggiornato al momento
// della cancellazione (un "tombstone"), non come l'assenza della voce.
// Questo è ciò che permette a questa stessa funzione last-write-wins di
// gestire correttamente sia le aggiunte sia le rimozioni con un unico
// confronto per timestamp: un tombstone più recente batte una visione
// vecchia (la cancellazione vince, come atteso), mentre una nuova visione
// successiva alla cancellazione batte il tombstone (ri-guardare un titolo
// dopo averlo rimosso lo fa correttamente ricomparire). Se una cancellazione
// venisse invece rappresentata come semplice "assenza della voce" (come
// accadeva nella versione precedente), un merge con qualunque replica che
// non ha ancora ricevuto la cancellazione la farebbe risorgere per sempre:
// è la causa principale del bug "gli elementi cancellati riappaiono".
export function mergeHistories(local, remote) {
  const byKey = new Map();
  const noKeyOrder = [];

  for (const entry of [...remote, ...local]) {
    const key = entry?._key;
    if (!key) {
      noKeyOrder.push(entry);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing || (entry.watchedAt ?? 0) >= (existing.watchedAt ?? 0)) {
      byKey.set(key, entry);
    }
  }

  const merged = [...byKey.values(), ...noKeyOrder];
  merged.sort((a, b) => (b.watchedAt ?? 0) - (a.watchedAt ?? 0));
  return merged;
}

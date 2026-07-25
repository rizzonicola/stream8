// shareSettings
// -------------
// Serializza un sottoinsieme delle Impostazioni in un parametro di query
// URL-safe, per generare un link condivisibile (`/import-settings?data=...`)
// che un altro utente può aprire per importare la stessa configurazione.
//
// IMPORTANTE — cosa viene incluso: SOLO preferenze "di configurazione"
// (lingua, tema, servizi mainstream selezionati, servizi personalizzati).
// La sincronizzazione (`settings.sync`: URL del server e chiave API) non
// viene MAI inclusa, per due motivi: è un segreto personale del
// mittente (la chiave API dà accesso in scrittura alla sua cronologia), e
// non avrebbe senso per il destinatario, che avrebbe bisogno del proprio
// server. La cronologia dei titoli guardati non fa parte di questo
// oggetto in primo luogo (vive in HistoryContext/localStorage separato),
// quindi non viene mai toccata da un'importazione di impostazioni.

export const SHARE_SETTINGS_KEYS = ['language', 'theme', 'selectedMainstream', 'customServices'];

function base64UrlEncode(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const padLength = (4 - (str.length % 4)) % 4;
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return decodeURIComponent(escape(atob(b64)));
}

// Estrae solo i campi condivisibili da un oggetto settings completo,
// scartando esplicitamente `sync` e qualunque altro campo non in whitelist.
export function pickShareableSettings(settings) {
  const picked = {};
  for (const key of SHARE_SETTINGS_KEYS) {
    if (key in settings) picked[key] = settings[key];
  }
  return picked;
}

export function encodeSettingsPayload(settings) {
  const json = JSON.stringify(pickShareableSettings(settings));
  return base64UrlEncode(json);
}

// Ritorna l'oggetto impostazioni decodificato (solo chiavi in whitelist),
// oppure null se il payload è mancante, corrotto, o non è un JSON valido.
// La whitelist viene riapplicata anche in decodifica: anche se qualcuno
// costruisse a mano un link con altri campi (es. "sync"), verrebbero
// scartati qui, non solo lato codifica.
export function decodeSettingsPayload(data) {
  if (!data) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(data));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const safe = {};
    for (const key of SHARE_SETTINGS_KEYS) {
      if (key in parsed) safe[key] = parsed[key];
    }
    return Object.keys(safe).length > 0 ? safe : null;
  } catch (err) {
    console.error('[Stream8 Settings] link di importazione non valido:', err);
    return null;
  }
}

// Costruisce l'URL completo e condivisibile per lo stato attuale delle
// impostazioni, basato sull'origine corrente della pagina.
export function buildShareUrl(settings) {
  const data = encodeSettingsPayload(settings);
  const url = new URL('/import-settings', window.location.origin);
  url.searchParams.set('data', data);
  return url.toString();
}

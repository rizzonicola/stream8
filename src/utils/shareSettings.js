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

import { parseCustomConfig } from './customConfigParser.js';
import { MAINSTREAM_SERVICES } from './streamingServices.js';

export const SHARE_SETTINGS_KEYS = ['language', 'theme', 'selectedMainstream', 'customServices'];

const VALID_LANGS = new Set(['auto', 'it', 'en', 'fr']);
const VALID_THEMES = new Set(['auto', 'light', 'dark', 'amoled']);
const MAINSTREAM_IDS = new Set(MAINSTREAM_SERVICES.map((service) => service.id));
const MAX_CUSTOM_SERVICES = 30;
const MAX_SHARE_PAYLOAD_LENGTH = 20_000;
// Un link di condivisione è input non fidato: gli schemi che eseguono
// codice non devono mai finire in un URL aperto da window.open.
const UNSAFE_URL_SCHEME = /^\s*(?:javascript|data|vbscript)\s*:/i;

function sanitizeCustomService(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (typeof raw.baseUrl !== 'string' || !raw.baseUrl.trim()) return null;
  if (UNSAFE_URL_SCHEME.test(raw.baseUrl)) return null;
  try {
    const config = parseCustomConfig(JSON.stringify(raw.config ?? {}));
    if (
      [config.movie_pattern, config.episode_pattern, config.anime_pattern].some((pattern) =>
        UNSAFE_URL_SCHEME.test(pattern)
      )
    ) {
      return null;
    }
    return {
      id: raw.id.slice(0, 100),
      name: raw.name.slice(0, 100),
      baseUrl: raw.baseUrl.slice(0, 2048),
      config,
    };
  } catch {
    return null;
  }
}

function sanitizeSettings(raw) {
  const safe = {};
  if (VALID_LANGS.has(raw.language)) safe.language = raw.language;
  if (VALID_THEMES.has(raw.theme)) safe.theme = raw.theme;
  if (Array.isArray(raw.selectedMainstream)) {
    const valid = [...new Set(raw.selectedMainstream.filter((id) => MAINSTREAM_IDS.has(id)))];
    if (valid.length > 0 || raw.selectedMainstream.length === 0) {
      safe.selectedMainstream = valid;
    }
  }
  if (Array.isArray(raw.customServices)) {
    const valid = raw.customServices
      .map(sanitizeCustomService)
      .filter(Boolean)
      .slice(0, MAX_CUSTOM_SERVICES);
    if (valid.length > 0 || raw.customServices.length === 0) {
      safe.customServices = valid;
    }
  }
  return safe;
}

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
  if (!data || data.length > MAX_SHARE_PAYLOAD_LENGTH) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(data));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const safe = sanitizeSettings(parsed);
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

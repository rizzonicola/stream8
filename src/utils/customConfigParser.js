// CustomConfigParser
// -------------------
// Valida e interpreta il file JSON di configurazione di un servizio
// streaming personalizzato (es. Jellyfin, Plex, server proprietario, o un
// aggregatore/redirect di terze parti).
//
// Schema di base (compatibile con le versioni precedenti):
// {
//   "movie_pattern":   "{base_url}/movie/{tmdb_id}",
//   "episode_pattern": "{base_url}/series/{tmdb_id}/s{season}/e{episode}",
//   "anime_pattern":   "{base_url}/anime/{tmdb_id}/ep{episode}"
// }
//
// Segnaposto disponibili in ogni pattern:
//   {base_url}    indirizzo base inserito a parte dall'utente
//   {tmdb_id}     ID TMDb del titolo (sempre disponibile, nessuna richiesta aggiuntiva)
//   {season}      numero di stagione (solo episode_pattern/anime_pattern)
//   {episode}     numero di episodio (solo episode_pattern/anime_pattern)
//   {anilist_id}  ID AniList dell'anime — risolto automaticamente al volo
//                 interrogando la API pubblica di AniList (nessuna chiave
//                 richiesta), SOLO se il pattern scelto lo contiene
//   {mal_id}      ID MyAnimeList dell'anime — fornito dalla stessa risposta
//                 di AniList (che espone anche idMal), stesso meccanismo
//   {title}       titolo del contenuto, con codifica URL — utile per i
//                 servizi che offrono una ricerca per titolo invece di un
//                 link diretto per ID
//
// Ogni pattern deve contenere almeno uno tra {tmdb_id}, {anilist_id},
// {mal_id}, {title}: senza nessuno di questi non ci sarebbe modo di
// identificare quale titolo aprire.

import { isSafeHttpUrl, isSafeUrlTemplate } from './urlSafety.js';

const ID_PLACEHOLDERS = ['{tmdb_id}', '{anilist_id}', '{mal_id}', '{title}'];

export class CustomConfigError extends Error {}

// L'indirizzo base è inserito dall'utente o arriva da un file/link: deve
// essere un URL assoluto http(s), non uno schema eseguibile o relativo.
export function validateCustomServiceBaseUrl(baseUrl) {
  if (!isSafeHttpUrl(baseUrl)) {
    throw new CustomConfigError(
      'L\'indirizzo base deve essere un URL valido che inizia con http:// o https://.'
    );
  }
}

export function parseCustomConfig(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new CustomConfigError('Il file non è un JSON valido.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CustomConfigError('Il file JSON deve essere un oggetto.');
  }

  for (const key of ['movie_pattern', 'episode_pattern', 'anime_pattern']) {
    if (typeof parsed[key] !== 'string' || !parsed[key].trim()) {
      throw new CustomConfigError(`Chiave mancante o non valida: "${key}".`);
    }
    if (!ID_PLACEHOLDERS.some((ph) => parsed[key].includes(ph))) {
      throw new CustomConfigError(
        `Il pattern "${key}" deve contenere almeno uno tra: ${ID_PLACEHOLDERS.join(', ')}.`
      );
    }
    if (!isSafeUrlTemplate(parsed[key])) {
      throw new CustomConfigError(
        `Il pattern "${key}" deve produrre un URL http:// o https:// valido.`
      );
    }
  }

  return {
    movie_pattern: parsed.movie_pattern,
    episode_pattern: parsed.episode_pattern,
    anime_pattern: parsed.anime_pattern,
  };
}

// Serializza una configurazione già validata nel formato JSON leggibile
// usato dall'editor e dal download: stesso schema del file originale, con
// indentazione a 2 spazi e newline finale.
export function serializeCustomConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

// Scarica un file JSON sul dispositivo dell'utente. Usato dall'editor delle
// configurazioni personalizzate per esportare il JSON anche quando in
// origine era stato caricato da un file o da un link.
export function downloadJsonFile(filename, jsonText) {
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const MAX_JSON_FILE_BYTES = 2 * 1024 * 1024;

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size > MAX_JSON_FILE_BYTES) {
      reject(new CustomConfigError('Il file JSON è troppo grande (massimo 2 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsText(file);
  });
}

// Scarica il testo di un file JSON di configurazione da un URL remoto,
// come alternativa al caricamento diretto del file. Può fallire per CORS
// se il server dell'utente non espone gli header necessari: in quel caso
// segnaliamo un errore chiaro invece di un fallimento silenzioso. Un
// timeout evita che un server remoto lento blocchi la UI indefinitamente.
export async function fetchJsonFromUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch {
    throw new CustomConfigError(
      'Impossibile raggiungere il link (URL non valido, offline, troppo lento o bloccato da CORS). Prova a scaricare il file e caricarlo direttamente.'
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new CustomConfigError(`Il server ha risposto con un errore (HTTP ${res.status}).`);
  }
  const text = await res.text();
  if (text.length > MAX_JSON_FILE_BYTES) {
    throw new CustomConfigError('Il file JSON è troppo grande (massimo 2 MB).');
  }
  return text;
}

// Vero se il pattern richiede una risoluzione AniList/MAL: usato per
// decidere se vale la pena interrogare l'API di AniList prima di comporre
// il link (mai in anticipo, solo quando l'utente sceglie davvero quel
// servizio, per non introdurre rallentamenti quando non serve).
export function patternNeedsAnilist(pattern) {
  return pattern.includes('{anilist_id}') || pattern.includes('{mal_id}');
}

// Compone l'URL finale sostituendo i segnaposto disponibili nel pattern.
export function buildCustomUrl({ pattern, baseUrl, tmdbId, season, episode, anilistId, malId, title }) {
  return pattern
    .replaceAll('{base_url}', baseUrl.replace(/\/+$/, ''))
    .replaceAll('{tmdb_id}', tmdbId != null ? String(tmdbId) : '')
    .replaceAll('{season}', season != null ? String(season) : '')
    .replaceAll('{episode}', episode != null ? String(episode) : '')
    .replaceAll('{anilist_id}', anilistId != null ? String(anilistId) : '')
    .replaceAll('{mal_id}', malId != null ? String(malId) : '')
    .replaceAll('{title}', title != null ? encodeURIComponent(title) : '');
}

export function pickPatternForItem(config, item) {
  if (item.mediaType === 'anime') return config.anime_pattern;
  if (item.mediaType === 'tv') return config.episode_pattern;
  return config.movie_pattern;
}

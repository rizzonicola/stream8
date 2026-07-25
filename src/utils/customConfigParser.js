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

const ID_PLACEHOLDERS = ['{tmdb_id}', '{anilist_id}', '{mal_id}', '{title}'];

export class CustomConfigError extends Error {}

export function parseCustomConfig(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
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
  }

  return {
    movie_pattern: parsed.movie_pattern,
    episode_pattern: parsed.episode_pattern,
    anime_pattern: parsed.anime_pattern,
  };
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
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
  return res.text();
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

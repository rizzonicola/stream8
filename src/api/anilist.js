// AniList API client
// -------------------
// Usato SOLO dal motore dei servizi custom, per risolvere l'ID AniList e/o
// l'ID MyAnimeList (MAL) di un anime quando il pattern di un servizio
// personalizzato li richiede (segnaposto {anilist_id} / {mal_id}).
//
// L'API pubblica di AniList (GraphQL) non richiede alcuna registrazione o
// chiave: espone anche `idMal`, quindi un'unica richiesta basta per
// entrambi gli ID. Per non introdurre rallentamenti quando la funzione non
// serve, questo modulo viene interrogato ESCLUSIVAMENTE al momento in cui
// l'utente sceglie un servizio il cui pattern contiene uno di questi
// segnaposto (mai in anticipo, mai per i titoli non-anime).
//
// --------------------------------------------------------------------------
// Mapping stagioni secondarie / split-cour (TMDb -> AniList)
// --------------------------------------------------------------------------
// TMDb accorpa tutte le stagioni di un anime sotto un unico show,
// numerandole "Stagione 1, 2, 3...". AniList invece assegna un ID
// indipendente a ogni singola stagione/parte, concatenate tra loro come una
// catena lineare di sequel (es. per "That Time I Got Reincarnated as a
// Slime": S1 -> S2 Parte 1 [12 ep] -> S2 Parte 2 [12 ep] -> S3...).
//
// `resolveAnilistForSeason` percorre quindi la catena di sequel un nodo
// alla volta (una piccola richiesta per nodo, non un'unica query annidata:
// vedi il commento più sotto sul perché), seguendo i sequel anche
// attraverso nodi "ponte" non-TV quando necessario (es. un film che collega
// due stagioni TV — vedi il commento su walkSequelChain), e determina in
// quale stagione TV della catena ricade l'episodio TMDb selezionato,
// sommando progressivamente gli episodi delle sole stagioni TV precedenti.

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 10_000;

// --------------------------------------------------------------------------
// Retry / backoff (CAUSA RADICE del fallimento sistematico sulle stagioni
// successive — vedi il commit che ha introdotto questo blocco)
// --------------------------------------------------------------------------
// L'API pubblica di AniList applica un rate limit (attualmente ridotto a 30
// richieste/minuto, invece delle 90 documentate — la stessa AniList lo
// segnala come stato "degradato" in corso: https://docs.anilist.co/guide/rate-limiting)
// E, sopra a quello, un "burst limiter" separato pensato apposta per
// penalizzare richieste consecutive ravvicinate — esattamente il pattern con
// cui `walkSequelChain` percorre la catena di sequel: una richiesta di rete
// per ogni nodo, una dopo l'altra, senza alcuna pausa tra l'una e l'altra.
// La ricerca iniziale (root = Stagione 1) è quasi sempre la PRIMA richiesta
// AniList della sessione/risoluzione e quindi tipicamente va a buon fine;
// sono le richieste AGGIUNTIVE necessarie solo per raggiungere la Stagione 2
// e successive a incappare quasi sempre nel burst limiter. Senza alcun
// retry, `postToAnilist` lanciava un'eccezione al primo 429, la camminata
// si interrompeva lì (nodo non raggiungibile), e la risoluzione ripiegava
// sulla ricerca semplice per titolo — che, quando anche il tentativo
// vincolato all'anno fallisce, ripiega a sua volta sul solo titolo e
// restituisce quasi sempre la Stagione 1. Risultato osservato: "ID AniList
// delle stagioni successive introvabile, si torna sempre alla Stagione 1" —
// non per un errore nella logica di attraversamento della catena (corretta,
// verificata con test), ma perché ogni hop aggiuntivo di quella logica non
// sopravviveva al primo 429 incontrato lungo il percorso.
//
// Soluzione: un retry con backoff esponenziale + jitter, applicato SOLO a
// errori transitori (429 e 5xx — mai a un 400, che su AniList indica una
// query non valida e non sparirebbe ritentando). Il campo Retry-After di
// AniList indica quanto attendere, ma non è affidabile lato browser (non è
// tra gli header esposti di default in CORS senza che il server lo
// dichiari esplicitamente in Access-Control-Expose-Headers): quando c'è, lo
// si usa; quando manca (caso comune in browser), si ricade su un backoff
// crescente con jitter, lo stesso approccio adottato da altri client AniList
// per lo stesso identico problema.
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 600;
const MAX_BACKOFF_MS = 8_000;

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Piccola pausa fissa PRIMA di ogni richiesta successiva alla prima in una
// stessa camminata della catena: difesa "in anticipo" contro il burst
// limiter (che scatta su richieste troppo ravvicinate), per non dover fare
// sempre affidamento sul solo retry reattivo dopo un 429 già ricevuto.
const INTER_HOP_DELAY_MS = 350;

// Stessa strategia di cache/deduplica usata in api/tmdb.js: evita di
// interrogare due volte AniList per lo stesso titolo nella stessa sessione.
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minuti: questi ID non cambiano mai
// Limite morbido, come in api/tmdb.js: una scheda tenuta aperta per ore
// (o una sessione in cui si esplorano centinaia di anime diversi) non deve
// far crescere le cache all'infinito. Vengono ripulite le sole voci scadute
// quando si supera la soglia, senza timer separati che girerebbero anche in
// background.
const MAX_CACHE_ENTRIES = 200;

function pruneExpiredEntries(cache) {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiry <= now) cache.delete(key);
  }
}

function cacheKey(title, year) {
  return `${title.toLowerCase().trim()}::${year || ''}`;
}

async function postToAnilistOnce(query, variables) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  // Un 429/5xx di AniList (spesso servito da Cloudflare) non sempre ha un
  // corpo JSON valido: non deve far fallire il parsing degli errori sottostanti.
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json?.errors?.[0]?.message || `Errore AniList (${res.status})`);
    err.status = res.status;
    // Retry-After spesso non è leggibile lato browser in CORS se il server
    // non lo espone esplicitamente: si prova comunque, senza contarci.
    const retryAfter = res.headers?.get?.('Retry-After');
    err.retryAfterMs = retryAfter && !Number.isNaN(Number(retryAfter)) ? Number(retryAfter) * 1000 : null;
    throw err;
  }
  if (json?.errors) {
    const err = new Error(json.errors[0]?.message || 'Errore AniList');
    err.status = json.errors[0]?.status;
    throw err;
  }
  return json;
}

// Riprova SOLO gli errori transitori (429 rate/burst limit, 5xx): un 400
// (query non valida) o un 404 (nessun risultato) non cambierebbero ritentando.
// Vedi il blocco di commenti sopra MAX_RETRIES per il perché questo retry è
// la causa radice del fix: senza, un solo 429 durante la camminata della
// catena di sequel bastava a interromperla definitivamente.
async function postToAnilist(query, variables) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await postToAnilistOnce(query, variables);
    } catch (err) {
      lastErr = err;
      if (!isRetryableStatus(err.status) || attempt === MAX_RETRIES) throw err;
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      const jitter = Math.random() * backoff * 0.3;
      const wait = err.retryAfterMs ?? backoff + jitter;
      console.info(
        `[Stream8 AniList] richiesta limitata (status ${err.status}), nuovo tentativo tra ${Math.round(wait)}ms (${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------
// 1) Ricerca semplice per titolo/anno (fallback di sicurezza, e unico
//    percorso usato per i film, che non hanno stagioni da mappare).
// ---------------------------------------------------------------------

const SEARCH_QUERY = `
  query ($search: String, $year: Int) {
    Media(search: $search, seasonYear: $year, type: ANIME) {
      id
      idMal
      title {
        romaji
        english
      }
    }
  }
`;

const searchCache = new Map(); // key -> { data, expiry }
const searchInFlight = new Map(); // key -> Promise

async function queryAnilistSearch(title, year) {
  const json = await postToAnilist(SEARCH_QUERY, { search: title, year: year || undefined });
  let media = json?.data?.Media;
  if (!media && year) {
    // Stesso ragionamento di fetchNodeBySearch più sotto: la stagione
    // AniList può non coincidere esattamente con l'anno TMDb.
    const json2 = await postToAnilist(SEARCH_QUERY, { search: title, year: undefined });
    media = json2?.data?.Media;
  }
  if (!media) return null;
  return {
    anilistId: media.id,
    malId: media.idMal ?? null,
    title: media.title?.english || media.title?.romaji || title,
  };
}

/**
 * Cerca un anime su AniList per titolo (e anno, se disponibile) e restituisce
 * { anilistId, malId, title } oppure null se non trovato.
 * Non lancia mai eccezioni verso il chiamante: in caso di errore di rete
 * restituisce null, lasciando che sia il chiamante a decidere come
 * segnalarlo (es. icona rossa sul servizio, coerente col resto dell'app).
 *
 * Usata direttamente per i film (senza stagioni da mappare) e come
 * fallback di sicurezza da `resolveAnilistForSeason` quando la catena dei
 * sequel non è risolvibile.
 */
export async function searchAnilistMedia(title, year) {
  if (!title) return null;
  const key = cacheKey(title, year);

  const cached = searchCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const pending = searchInFlight.get(key);
  if (pending) return pending;

  const request = queryAnilistSearch(title, year)
    .then((data) => {
      searchCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
      pruneExpiredEntries(searchCache);
      return data;
    })
    .catch((err) => {
      console.warn('[Stream8 AniList] ricerca fallita per', `"${title}"`, ':', err);
      return null;
    })
    .finally(() => {
      searchInFlight.delete(key);
    });

  searchInFlight.set(key, request);
  return request;
}

// ---------------------------------------------------------------------
// 2) Catena di sequel (split-cour) per le serie anime.
// ---------------------------------------------------------------------
//
// NOTA IMPORTANTE (revisione): la primissima versione di questo modulo
// provava a scaricare l'INTERA catena di sequel annidando il campo
// `relations` dentro se stesso fino a 5 livelli in un'unica richiesta
// GraphQL. In pratica questo approccio non è affidabile: `relations`
// restituisce OGNI tipo di relazione (prequel, sequel, spin-off, source,
// adattamenti, personaggi condivisi...), non solo i sequel TV che ci
// interessano, quindi annidarlo più volte fa esplodere combinatoriamente
// la query (ogni nodo trascina con sé tutti i suoi vicini, che a loro
// volta trascinano i propri) fino a superare i limiti di complessità/
// profondità imposti dall'API pubblica di AniList. Quando questo accade,
// AniList rifiuta l'intera richiesta con un errore: il codice lo
// intercettava correttamente, ma il risultato pratico era che la catena
// non veniva MAI risolta e si finiva sempre nel fallback per Titolo+Anno
// (che restituisce quasi sempre la prima stagione) — cioè esattamente il
// problema che questa funzione doveva risolvere.
//
// Soluzione adottata: percorrere la catena "un salto alla volta", con una
// query GraphQL piccola e poco profonda per ciascun nodo (il nodo stesso
// più UN solo livello di relazioni dirette, senza annidare ulteriormente).
// Una query così piccola resta ben al di sotto di qualunque limite di
// complessità ragionevole. Il numero di richieste di rete non è quindi
// sempre "1 per titolo", ma pari al numero di stagioni/parti reali che si
// devono attraversare per arrivare a quella richiesta (tipicamente 1-4 per
// una split-cour): ciascun nodo viene comunque messo in cache per ID, così
// scegliere un'altra stagione/episodio dello stesso titolo più tardi nella
// stessa sessione non genera nuove richieste per i nodi già visitati.

// --------------------------------------------------------------------------
// Persistenza locale dell'albero (localStorage)
// --------------------------------------------------------------------------
// Le cache `nodeCache`/`searchCache` sopra sono in memoria: durano solo
// quanto la scheda del browser resta aperta. Qui invece si salva su disco
// (localStorage, come il resto dell'app 100% client-side) l'albero di
// sequel GIÀ percorso per un anime, così che riaprendo lo stesso titolo in
// un'altra sessione (anche il giorno dopo) non si riparta mai dalla radice:
// si riprende dall'ultimo nodo raggiunto la volta precedente, e si
// percorrono solo gli eventuali salti NUOVI necessari per la stagione
// richiesta ora (es.: ieri salvata la catena fino alla Stagione 4, oggi si
// seleziona la Stagione 5 → si riparte dal nodo della Stagione 4 già in
// cache e si fa UNA sola richiesta aggiuntiva per raggiungere la 5, non da
// capo dalla Stagione 1).
const CHAIN_STORAGE_PREFIX = 'stream8:anilistChain:v1:';

function chainStorageKey(title, year) {
  return CHAIN_STORAGE_PREFIX + cacheKey(title, year);
}

function loadPersistedChain(title, year) {
  try {
    const raw = localStorage.getItem(chainStorageKey(title, year));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.chain) && parsed.chain.length > 0 ? parsed.chain : null;
  } catch {
    // Storage non disponibile (modalità privata, quota esaurita, contesto
    // senza `window`...): si ricalcola da zero, nessun crash per l'utente.
    return null;
  }
}

function savePersistedChain(title, year, chain) {
  try {
    localStorage.setItem(chainStorageKey(title, year), JSON.stringify({ chain, updatedAt: Date.now() }));
  } catch {
    // Idem: se non si riesce a scrivere, l'app continua a funzionare,
    // semplicemente senza il beneficio della cache tra una sessione e l'altra.
  }
}

/**
 * Cancella l'albero AniList salvato in locale per un titolo (Titolo + anno
 * della prima stagione, stessa chiave usata per calcolarlo). Pensata per un
 * pulsante "svuota cache" nella pagina dell'opera: la volta successiva la
 * catena verrà ricalcolata da zero, utile ad es. se AniList ha corretto nel
 * frattempo una relazione sbagliata. Non lancia mai eccezioni.
 */
export function clearPersistedAnilistChain(title, year) {
  try {
    localStorage.removeItem(chainStorageKey(title, year));
    return true;
  } catch {
    return false;
  }
}

const TV_FORMATS = new Set(['TV', 'TV_SHORT']);

// Campi di un nodo, con UN solo livello di relazioni dirette (i nodi delle
// relazioni stesse non hanno a loro volta un campo `relations`: per
// proseguire lungo la catena si esegue una nuova query per id sul nodo
// successivo). Tenere la selezione piatta così è ciò che mantiene ogni
// singola richiesta piccola e sicura.
const NODE_QUERY_FIELDS = `
      id
      idMal
      format
      episodes
      seasonYear
      title { romaji english }
      relations {
        edges {
          relationType
          node {
            id
            idMal
            format
            episodes
            seasonYear
            title { romaji english }
          }
        }
      }`;

const SEARCH_NODE_QUERY = `
  query ($search: String, $year: Int) {
    Media(search: $search, seasonYear: $year, type: ANIME) {${NODE_QUERY_FIELDS}
    }
  }
`;

const BY_ID_NODE_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {${NODE_QUERY_FIELDS}
    }
  }
`;

const nodeCache = new Map(); // key -> { data, expiry } (key: "search::title::year" oppure "id::123")
const nodeInFlight = new Map(); // key -> Promise

function fetchNodeCached(key, queryFn) {
  const cached = nodeCache.get(key);
  if (cached && cached.expiry > Date.now()) return Promise.resolve(cached.data);

  const pending = nodeInFlight.get(key);
  if (pending) return pending;

  const request = queryFn()
    .then((data) => {
      nodeCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
      pruneExpiredEntries(nodeCache);
      return data;
    })
    .catch((err) => {
      console.warn('[Stream8 AniList] risoluzione nodo catena fallita:', key, err);
      return null;
    })
    .finally(() => {
      nodeInFlight.delete(key);
    });

  nodeInFlight.set(key, request);
  return request;
}

function fetchNodeBySearch(title, year) {
  return fetchNodeCached(`search::${cacheKey(title, year)}`, async () => {
    const json = await postToAnilist(SEARCH_NODE_QUERY, { search: title, year: year || undefined });
    const media = json?.data?.Media || null;
    if (media || !year) return media;
    // La classificazione "seasonYear" di AniList (inverno/primavera/estate/
    // autunno) può differire di un anno da quello della prima messa in onda
    // secondo TMDb, per i titoli usciti a cavallo di un confine di
    // stagione: se la ricerca vincolata all'anno non trova nulla, si
    // ritenta una volta senza quel vincolo prima di arrendersi, così un
    // titolo valido non va perso solo per una differenza di un anno tra le
    // due fonti.
    const json2 = await postToAnilist(SEARCH_NODE_QUERY, { search: title, year: undefined });
    return json2?.data?.Media || null;
  });
}

function fetchNodeById(id) {
  return fetchNodeCached(`id::${id}`, async () => {
    const json = await postToAnilist(BY_ID_NODE_QUERY, { id });
    return json?.data?.Media || null;
  });
}

// Ricerca per titolo vincolata RIGOROSAMENTE all'anno indicato, senza alcun
// ritento senza vincolo (a differenza di fetchNodeBySearch sopra). Usata
// solo come recupero mirato per una stagione specifica che la camminata
// lungo la catena di sequel non è riuscita a raggiungere (vedi
// resolveAnilistForSeason più sotto): un ritento senza l'anno qui sarebbe
// controproducente, perché AniList su una ricerca per solo titolo restituisce
// tipicamente la entry più popolare della saga — quasi sempre la prima
// stagione — vanificando esattamente il tentativo di trovare una stagione
// successiva.
function fetchNodeByYearOnly(title, year) {
  if (!year) return Promise.resolve(null);
  return fetchNodeCached(`year-only::${cacheKey(title, year)}`, async () => {
    const json = await postToAnilist(SEARCH_NODE_QUERY, { search: title, year });
    return json?.data?.Media || null;
  });
}

// Limite di sicurezza sul numero di salti percorsi (non sulla profondità di
// UNA query, come nella versione precedente): evita loop in caso di dati
// ciclici inattesi. Nessuna split-cour reale nota si avvicina a questo
// numero di parti concatenate.
const MAX_HOPS = 10;

// Applica il filtro TV/TV_SHORT e la somma progressiva degli episodi a un
// albero già ottenuto, per capire se copre già l'episodio TMDb richiesto
// (`target`, vedi cumulativeEpisodeTarget più sotto). Usata sia sull'albero
// appena caricato da localStorage (per evitare QUALSIASI richiesta di rete
// se copre già ciò che serve) sia dopo ogni singolo salto aggiunto durante
// l'estensione della catena, per poter uscire il prima possibile.
// Restituisce: il nodo-risultato se trovato; `null` se la catena nota finora
// non basta (bisogna provare a estenderla); la stringa 'blocked' se un nodo
// intermedio (non l'ultimo) ha un numero di episodi ancora sconosciuto — in
// quel caso proseguire sarebbe una somma inaffidabile, meglio fermarsi.
function matchInChain(chain, target) {
  const tvNodes = chain.filter((n) => TV_FORMATS.has(n.format));
  let cumulative = 0;
  for (let i = 0; i < tvNodes.length; i++) {
    const node = tvNodes[i];
    const isLastKnown = i === tvNodes.length - 1;
    if (node.episodes == null) {
      return isLastKnown ? node : 'blocked';
    }
    if (target <= cumulative + node.episodes) return node;
    cumulative += node.episodes;
  }
  return null;
}

// Percorre la catena di sequel un nodo alla volta, seguendo le relazioni di
// tipo SEQUEL, MA a differenza di una versione "ingenua" fa due cose in più
// pensate per ridurre al minimo le richieste di rete verso un'API oggi a
// quota limitata (vedi il blocco di commenti su MAX_RETRIES più sopra):
//
// 1) Riprende da un albero già salvato in locale (`loadPersistedChain`),
//    invece di ripartire sempre dalla radice/Stagione 1: se ieri è stata
//    già percorsa la catena fino alla Stagione 4, oggi selezionare la
//    Stagione 5 fa scattare UNA sola richiesta aggiuntiva (il salto verso
//    la 5), non l'intera camminata da capo. Se invece la stagione richiesta
//    è già COPERTA dall'albero salvato (es. richiesta la Stagione 3 quando
//    in cache c'è già fino alla 5), il risultato arriva SENZA ALCUNA
//    richiesta di rete: il controllo su ciò che è già noto avviene prima di
//    qualunque chiamata. Solo quando la stagione richiesta non è ancora
//    coperta, il nodo "di coda" dell'albero salvato viene ri-scaricato una
//    volta (una singola richiesta) prima di provare a estendere la catena,
//    per accorgersi di eventuali NUOVE stagioni annunciate su AniList da
//    quando l'albero è stato salvato l'ultima volta.
// 2) Si ferma appena trova il nodo che copre l'episodio richiesto
//    (`target`), invece di percorrere sempre l'intera catena fino in fondo:
//    scegliere la Stagione 1 di un anime con 10 stagioni non fa più scattare
//    10 richieste, ne fa scattare giusto quelle necessarie a raggiungere la
//    Stagione 1 (spesso zero, essendo la radice).
//
// IMPORTANTE: qui non si filtra per formato durante l'attraversamento — un
// sequel può "passare" attraverso un nodo non-TV (tipicamente un film)
// prima di arrivare alla stagione TV successiva. Un caso reale osservato:
// "Saga of Tanya the Evil" (TV) ha come SEQUEL diretto solo il film "Youjo
// Senki Movie" (MOVIE), e la vera Stagione 2 (TV) è collegata solo a QUEL
// film, non alla Stagione 1. Filtrare per formato direttamente qui avrebbe
// interrotto la catena al primo salto, senza mai scoprire la Stagione 2. Il
// filtro TV/TV_SHORT viene applicato in `matchInChain` sopra: i nodi non-TV
// restano nella catena come semplice "ponte", ma non sono mai un risultato
// finale né contano nella somma degli episodi.
//
// Se un nodo presenta più sequel diretti (bivio, es. linee temporali
// separate o spin-off), sceglie il ramo il cui anno di uscita corrisponde a
// `seasonYearHint`; se l'anno non è disponibile o non corrisponde a nessun
// ramo, ripiega sul primo per sicurezza.
//
// Restituisce `{ chain, match }`: `chain` è l'albero (aggiornato e salvato
// in locale prima di ritornare), `match` è il nodo trovato oppure `null` se
// non è stato possibile trovarlo (titolo iniziale introvabile, catena
// esaurita, o nodo intermedio con episodi sconosciuti).
async function resolveChainForTarget(title, year, seasonYearHint, target) {
  let chain = loadPersistedChain(title, year);

  if (!chain) {
    const root = await fetchNodeBySearch(title, year);
    if (!root) return { chain: null, match: null };
    chain = [root];
  } else {
    // Se la stagione richiesta è già coperta dall'albero salvato così
    // com'è, la si restituisce SUBITO, prima di qualunque richiesta di
    // rete: non serve ri-scaricare nulla per rispondere a "che ID ha la
    // Stagione 3?" quando in cache c'è già l'albero fino alla Stagione 5.
    const knownMatch = matchInChain(chain, target);
    if (knownMatch && knownMatch !== 'blocked') {
      return { chain, match: knownMatch };
    }

    // Non ancora coperta: SOLO a questo punto vale la pena aggiornare il
    // nodo di coda con una richiesta fresca (singola), per accorgersi di
    // sequel aggiunti nel frattempo su AniList prima di estendere la catena.
    const tail = chain[chain.length - 1];
    const freshTail = await fetchNodeById(tail.id);
    if (freshTail) chain = [...chain.slice(0, -1), freshTail];
  }

  const visited = new Set(chain.map((n) => n.id));

  let match = matchInChain(chain, target);
  if (match && match !== 'blocked') {
    savePersistedChain(title, year, chain);
    return { chain, match };
  }
  if (match === 'blocked') {
    savePersistedChain(title, year, chain);
    return { chain, match: null };
  }

  // Non ancora coperto dall'albero conosciuto: prosegue SOLO da dove si era
  // fermato (mai dalla radice), un salto alla volta, uscendo il prima
  // possibile appena trovato un match.
  let current = chain[chain.length - 1];
  while (chain.length < MAX_HOPS) {
    const candidates = (current.relations?.edges || [])
      .filter((e) => e.relationType === 'SEQUEL' && e.node && !visited.has(e.node.id))
      .map((e) => e.node);

    if (candidates.length === 0) break;

    const chosen =
      candidates.length === 1
        ? candidates[0]
        : candidates.find((n) => n.seasonYear === seasonYearHint) || candidates[0];

    // Piccola pausa prima dell'hop successivo (vedi INTER_HOP_DELAY_MS sopra):
    // riduce la probabilità di incappare nel burst limiter di AniList,
    // invece di affidarsi solo al retry reattivo dopo un 429 già arrivato.
    await sleep(INTER_HOP_DELAY_MS);

    // `chosen` arriva dal campo relations del nodo precedente, che include
    // solo un livello di relazioni: per continuare a camminare lungo la
    // catena serve un'altra piccola richiesta per id, che porta con sé le
    // SUE relazioni dirette.
    const next = await fetchNodeById(chosen.id);
    if (!next) break; // nodo non raggiungibile: la catena si ferma qui

    chain.push(next);
    visited.add(next.id);
    current = next;

    const m = matchInChain(chain, target);
    if (m) {
      match = m === 'blocked' ? null : m;
      break;
    }
  }

  // Si salva l'albero raggiunto finora in ogni caso (anche se il target non
  // è stato trovato): i nodi già scoperti restano comunque utili — es. se
  // oggi si esce dalla catena senza trovare la Stagione 5 perché non ancora
  // annunciata, i nodi fino alla Stagione 4 restano in cache, ed è solo
  // l'eventuale nuovo salto verso la 5 che dovrà essere rifatto in futuro.
  savePersistedChain(title, year, chain);
  return { chain, match };
}

// Ricava, a partire dall'elenco delle stagioni TMDb (numero + conteggio
// episodi) e dalla stagione/episodio selezionati, il numero di episodio
// "cumulativo" nella serie intera: somma degli episodi di tutte le stagioni
// precedenti più l'episodio scelto nella stagione corrente. È questo il
// valore che viene confrontato con la somma progressiva degli episodi dei
// nodi della catena AniList per capire in quale parte ricade.
function cumulativeEpisodeTarget(seasons, season, episode) {
  const prior = (seasons || [])
    .filter((s) => s.seasonNumber < season)
    .reduce((sum, s) => sum + (s.episodeCount || 0), 0);
  return prior + episode;
}

/**
 * Risolve l'ID AniList/MAL corretto per una specifica stagione+episodio
 * TMDb di una serie anime, gestendo sia il caso classico 1:1 sia le
 * stagioni divise in più parti (split-cour).
 *
 * Parametri:
 *  - title, year: titolo e anno della prima stagione (per ancorare la
 *    ricerca iniziale su AniList, come già avveniva prima).
 *  - seasons: elenco delle stagioni TMDb [{ seasonNumber, episodeCount }].
 *  - season, episode: stagione/episodio TMDb correntemente selezionati.
 *  - seasonYear: anno di uscita della stagione TMDb selezionata (se noto),
 *    usato solo per risolvere un eventuale bivio nella catena.
 *
 * Non lancia mai eccezioni: in caso di problemi ripiega sempre su
 * `searchAnilistMedia` (Titolo + Anno della stagione specifica) e, se anche
 * questo fallisce, restituisce null senza bloccare l'interfaccia.
 */
export async function resolveAnilistForSeason({ title, year, seasons, season, episode, seasonYear }) {
  if (!title) return null;

  // Fallback in due fasi:
  // 1) se conosciamo l'anno della stagione TMDb richiesta, un tentativo
  //    mirato con ricerca vincolata SOLO a quell'anno — questo è ciò che
  //    permette di recuperare la stagione giusta quando la camminata lungo
  //    la catena di sequel si è fermata prima di raggiungerla (es. un nodo
  //    "ponte" senza un sequel dichiarato in avanti);
  // 2) solo se anche questo fallisce, la ricerca semplice per titolo/anno
  //    "di sicurezza" già esistente (che può ripiegare fino al titolo da
  //    solo, e quindi tipicamente sulla prima stagione — è l'ultima
  //    spiaggia esplicitamente prevista, non il primo tentativo).
  const fallback = async () => {
    if (seasonYear) {
      const recovered = await fetchNodeByYearOnly(title, seasonYear).catch(() => null);
      if (recovered && TV_FORMATS.has(recovered.format)) {
        console.info(
          '[Stream8 AniList] stagione recuperata con ricerca mirata per anno (la catena non l\'aveva raggiunta):',
          recovered.id,
          title,
          seasonYear
        );
        return {
          anilistId: recovered.id,
          malId: recovered.idMal ?? null,
          title: recovered.title?.english || recovered.title?.romaji || title,
        };
      }
    }
    return searchAnilistMedia(title, seasonYear || year);
  };

  // Caso base: nessun elenco stagioni disponibile (non dovrebbe accadere
  // per una serie, ma niente crash) o prima stagione senza nulla da sommare
  // prima: la ricerca semplice per titolo/anno è già sufficiente e più
  // economica di camminare lungo la catena.
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return fallback();
  }

  const target = cumulativeEpisodeTarget(seasons, season, episode);
  const { chain, match } = await resolveChainForTarget(title, year, seasonYear, target);

  if (!chain) {
    // Il titolo iniziale non è stato nemmeno trovato (errore di rete,
    // titolo non presente su AniList, oppure — il caso più comune — il
    // titolo passato non corrisponde a nessun titolo/sinonimo indicizzato
    // da AniList per quell'anime): fallback per Titolo + Anno della
    // stagione specifica.
    console.info('[Stream8 AniList] titolo iniziale non trovato, fallback per titolo/anno:', title, year);
    return fallback();
  }

  if (!match) {
    // La catena (eventualmente ripresa da quella salvata in locale) non
    // copre l'episodio richiesto: incompleta, non ancora annunciata su
    // AniList, o un nodo intermedio con episodi sconosciuti impedisce una
    // somma affidabile oltre quel punto. Fallback di sicurezza.
    console.info(
      '[Stream8 AniList] catena non sufficiente a raggiungere la stagione richiesta, fallback:',
      title,
      `stagione=${season} episodio=${episode} target_cumulativo=${target} nodi_in_catena=${chain.length}`
    );
    return fallback();
  }

  return {
    anilistId: match.id,
    malId: match.idMal ?? null,
    title: match.title?.english || match.title?.romaji || title,
  };
}

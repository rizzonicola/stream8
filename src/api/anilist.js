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

async function postToAnilist(query, variables) {
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
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.errors) {
    const msg = json?.errors?.[0]?.message || `Errore AniList (${res.status})`;
    throw new Error(msg);
  }
  return json;
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

// Percorre la catena di sequel un nodo alla volta, a partire dal titolo
// iniziale, seguendo le relazioni di tipo SEQUEL. IMPORTANTE: qui non si
// filtra per formato — un sequel può "passare" attraverso un nodo non-TV
// (tipicamente un film) prima di arrivare alla stagione TV successiva. Un
// caso reale osservato: "Saga of Tanya the Evil" (TV) ha come SEQUEL diretto
// solo il film "Youjo Senki Movie" (MOVIE), e la vera Stagione 2 (TV) è
// collegata solo a QUEL film, non alla Stagione 1. Filtrare per formato
// direttamente qui avrebbe interrotto la catena al primo salto, senza mai
// scoprire la Stagione 2. Il filtro TV/TV_SHORT (per ignorare film, OVA,
// ONA e special come possibili risposte finali) viene applicato più avanti,
// in resolveAnilistForSeason, quando si sommano gli episodi: i nodi non-TV
// restano nella catena come semplice "ponte" verso il nodo successivo, ma
// non vengono mai considerati come destinazione finale né contano nella
// somma progressiva degli episodi.
// Ogni salto costa una piccola richiesta di rete aggiuntiva (in cache per
// ID). Se un nodo presenta più sequel diretti (bivio, es. linee temporali
// separate o spin-off), sceglie il ramo il cui anno di uscita corrisponde a
// `seasonYearHint`; se l'anno non è disponibile o non corrisponde a nessun
// ramo, ripiega sul primo per sicurezza. Restituisce l'elenco ordinato dei
// nodi (radice inclusa), oppure null se anche il primo titolo non è stato
// trovato.
async function walkSequelChain(title, year, seasonYearHint) {
  const root = await fetchNodeBySearch(title, year);
  if (!root) return null;

  const chain = [root];
  const visited = new Set([root.id]);
  let current = root;

  while (chain.length < MAX_HOPS) {
    const candidates = (current.relations?.edges || [])
      .filter((e) => e.relationType === 'SEQUEL' && e.node && !visited.has(e.node.id))
      .map((e) => e.node);

    if (candidates.length === 0) break;

    const chosen =
      candidates.length === 1
        ? candidates[0]
        : candidates.find((n) => n.seasonYear === seasonYearHint) || candidates[0];

    // `chosen` arriva dal campo relations del nodo precedente, che include
    // solo un livello di relazioni: per continuare a camminare lungo la
    // catena serve un'altra piccola richiesta per id, che porta con sé le
    // SUE relazioni dirette.
    const next = await fetchNodeById(chosen.id);
    if (!next) break; // nodo non raggiungibile: la catena si ferma qui

    chain.push(next);
    visited.add(next.id);
    current = next;
  }

  return chain;
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

  const chain = await walkSequelChain(title, year, seasonYear);
  if (!chain) {
    // Il titolo iniziale non è stato nemmeno trovato (errore di rete,
    // titolo non presente su AniList, oppure — il caso più comune — il
    // titolo passato non corrisponde a nessun titolo/sinonimo indicizzato
    // da AniList per quell'anime): fallback per Titolo + Anno della
    // stagione specifica.
    console.info('[Stream8 AniList] titolo iniziale non trovato, fallback per titolo/anno:', title, year);
    return fallback();
  }

  const target = cumulativeEpisodeTarget(seasons, season, episode);

  // Il filtro per formato si applica QUI, non durante l'attraversamento
  // (walkSequelChain sopra): i nodi non-TV incontrati lungo il percorso
  // (film, OVA, ONA, special) sono serviti solo da ponte per raggiungere la
  // stagione TV successiva e non hanno una numerazione episodio comparabile
  // con quella di TMDb, quindi non vanno né sommati né restituiti come
  // risultato.
  const tvNodes = chain.filter((n) => TV_FORMATS.has(n.format));

  let cumulative = 0;
  for (let i = 0; i < tvNodes.length; i++) {
    const node = tvNodes[i];
    const isLastKnown = i === tvNodes.length - 1;

    if (node.episodes == null) {
      // Il conteggio totale degli episodi non è ancora noto su AniList
      // (stagione uscita da poco e ancora in corso). Se è l'ULTIMA
      // stagione TV conosciuta della catena (nessun sequel successivo
      // trovato finora), è anche l'unica candidata plausibile per
      // qualunque episodio richiesto da qui in avanti: meglio restituirla
      // come miglior risposta possibile piuttosto che rinunciare e tornare
      // sempre alla prima stagione. Se invece ci sono altre stagioni TV
      // dopo questa nella catena, il conteggio mancante ci impedisce di
      // calcolare con certezza l'offset di quelle successive: qui sì,
      // meglio il fallback.
      if (isLastKnown) {
        return {
          anilistId: node.id,
          malId: node.idMal ?? null,
          title: node.title?.english || node.title?.romaji || title,
        };
      }
      console.info('[Stream8 AniList] episodi del nodo sconosciuti (non ultimo della catena), fallback:', node.id, title);
      return fallback();
    }
    if (target <= cumulative + node.episodes) {
      return {
        anilistId: node.id,
        malId: node.idMal ?? null,
        title: node.title?.english || node.title?.romaji || title,
      };
    }
    cumulative += node.episodes;
  }

  // La catena si è esaurita prima di raggiungere l'episodio richiesto
  // (incompleta o il titolo non ha altri sequel TV su AniList): fallback
  // di sicurezza.
  console.info(
    '[Stream8 AniList] catena esaurita prima di raggiungere la stagione richiesta, fallback:',
    title,
    `stagione=${season} episodio=${episode} target_cumulativo=${target} episodi_coperti=${cumulative}`
  );
  return fallback();
}

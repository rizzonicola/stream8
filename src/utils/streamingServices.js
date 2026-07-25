// Elenco dei servizi di streaming mainstream proposti in onboarding.
// `color` è usato come accento del logo testuale (nessun asset esterno,
// per restare 100% client-side e senza dipendenze da loghi protetti).
export const MAINSTREAM_SERVICES = [
  { id: 'netflix', name: 'Netflix', color: '#E50914' },
  { id: 'prime', name: 'Prime Video', color: '#00A8E1' },
  { id: 'disney', name: 'Disney+', color: '#113CCF' },
  { id: 'appletv', name: 'Apple TV+', color: '#A2AAAD' },
  { id: 'crunchyroll', name: 'Crunchyroll', color: '#F47521' },
  { id: 'skynow', name: 'Sky / NOW', color: '#00205B' },
  { id: 'paramount', name: 'Paramount+', color: '#0064FF' },
  { id: 'hbo', name: 'HBO Max', color: '#8A2BE2' },
];

// Pattern di ricerca "search-first" usati per i servizi mainstream:
// dato che non abbiamo un'API di disponibilità reale per ciascuno di essi,
// generiamo un link di ricerca sul servizio stesso (comportamento dichiarato
// in Impostazioni / Info). I servizi custom invece usano i pattern esatti
// caricati dall'utente per generare URL di riproduzione diretti.
export const MAINSTREAM_SEARCH_PATTERN = {
  netflix: 'https://www.netflix.com/search?q={query}',
  prime: 'https://www.amazon.com/s?k={query}&i=instant-video',
  disney: 'https://www.disneyplus.com/search?q={query}',
  appletv: 'https://tv.apple.com/search?term={query}',
  crunchyroll: 'https://www.crunchyroll.com/search?q={query}',
  skynow: 'https://www.nowtv.it/cerca?q={query}',
  paramount: 'https://www.paramountplus.com/search/?q={query}',
  hbo: 'https://play.max.com/search?q={query}',
};

// Mappa id servizio -> nomi provider TMDb (usati da /watch/providers) per
// verificare la disponibilità reale di un titolo su quel servizio.
export const MAINSTREAM_TMDB_PROVIDER_NAMES = {
  netflix: ['Netflix'],
  prime: ['Amazon Prime Video', 'Prime Video'],
  disney: ['Disney Plus', 'Disney+'],
  appletv: ['Apple TV Plus', 'Apple TV+', 'Apple TV'],
  crunchyroll: ['Crunchyroll'],
  skynow: ['Now TV', 'Sky', 'NOW'],
  paramount: ['Paramount Plus', 'Paramount+'],
  hbo: ['HBO Max', 'Max'],
};

// Chiavi di localStorage centralizzate, condivise tra i vari context.
// STORAGE_KEYS.CONSENT è l'unica sempre scritta (anche in modalità "solo
// necessari"): serve a ricordare la scelta privacy dell'utente e non
// richiederla ad ogni visita, come da prassi GDPR/e-Privacy per i dati
// tecnicamente necessari al funzionamento del sito.
export const STORAGE_KEYS = {
  CONSENT: 'stream8_consent_v1',
  SETTINGS: 'stream8_settings_v1',
  HISTORY: 'stream8_history_v1',
};

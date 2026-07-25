import React, { createContext, useContext, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../utils/storageKeys';

/**
 * ConsentContext
 * --------------
 * Stream8 non ha un server proprio: le preferenze (servizi di streaming,
 * tema, lingua) sono salvate in locale perché necessarie al funzionamento
 * stesso dell'app, che altrimenti richiederebbe di riconfigurarla ad ogni
 * visita. Per questo tipo di dato tecnico, strettamente necessario al
 * servizio richiesto dall'utente, non è richiesto un consenso preventivo
 * (GDPR/e-Privacy).
 *
 * L'unico dato "opzionale" è la cronologia dei titoli guardati: per quanto
 * resti anch'essa solo sul dispositivo (mai su un server), viene chiesto
 * esplicitamente all'utente se vuole salvarla. Se rifiuta, l'app continua a
 * funzionare normalmente nella sessione corrente ma nulla viene scritto sul
 * dispositivo, quindi la cronologia sparisce alla chiusura/ricarica della
 * pagina.
 */

function loadConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONSENT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.historyEnabled === 'boolean' ? parsed : null;
  } catch {
    return null;
  }
}

function saveConsent(consent) {
  try {
    // Questa è l'unica scrittura sempre consentita: memorizza la scelta
    // dell'utente per non richiederla ad ogni visita (dato tecnico
    // necessario, non un dato di profilazione).
    localStorage.setItem(STORAGE_KEYS.CONSENT, JSON.stringify(consent));
  } catch {
    // ignora se lo storage non è disponibile
  }
}

const ConsentContext = createContext(null);

export function ConsentProvider({ children }) {
  const [consent, setConsentState] = useState(loadConsent);

  const setHistoryConsent = (historyEnabled) => {
    const next = { historyEnabled, decidedAt: Date.now() };
    saveConsent(next);
    setConsentState(next);
  };

  const value = useMemo(
    () => ({
      hasDecided: !!consent,
      historyEnabled: consent?.historyEnabled ?? false,
      setHistoryConsent,
    }),
    [consent]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent deve essere usato dentro <ConsentProvider>');
  return ctx;
}

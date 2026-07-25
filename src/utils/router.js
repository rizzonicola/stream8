import { useCallback, useEffect, useState } from 'react';

/**
 * Router minimale basato sulla History API nativa del browser.
 * -------------------------------------------------------------
 * Non usa nessuna libreria esterna: aggiorna `window.history` con
 * pushState/replaceState e ascolta l'evento `popstate`, così il tasto
 * "indietro" del sistema (o del browser) riporta correttamente alla
 * schermata precedente dell'app, invece di uscire dal sito.
 */

export function useRouter() {
  const [path, setPath] = useState(() => window.location.pathname + window.location.search);

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((to, state) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState(state ?? null, '', to);
    setPath(to);
  }, []);

  const replace = useCallback((to, state) => {
    window.history.replaceState(state ?? null, '', to);
    setPath(to);
  }, []);

  return { path, navigate, replace, state: window.history.state };
}

// --- Helper per costruire/leggere i percorsi usati dall'app ---

// Se l'item ha stagione/episodio (es. proviene dalla cronologia, o l'utente
// li ha già selezionati in pagina), li porta nell'URL come query string.
// Questo permette a due cose di funzionare correttamente:
//  1. Cliccando un episodio dalla cronologia si apre già su quell'episodio,
//     non sempre sul primo della prima stagione.
//  2. Se il browser sospende/ricarica la scheda mentre si è su un servizio
//     esterno (es. su mobile, per risparmio memoria) e si torna indietro,
//     la stagione/episodio selezionati si ripristinano dall'URL stesso,
//     non solo dallo stato in memoria (che a quel punto sarebbe perso).
export function detailPath(item) {
  const base = `/title/${item.mediaType}/${item.id}`;
  const params = new URLSearchParams();
  if (item.season != null) params.set('s', item.season);
  if (item.episode != null) params.set('e', item.episode);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parseDetailPath(path) {
  const [pathname, search] = path.split('?');
  const match = pathname.match(/^\/title\/(movie|tv|anime)\/(\d+)/);
  if (!match) return null;
  const result = { mediaType: match[1], id: Number(match[2]) };
  if (search) {
    const params = new URLSearchParams(search);
    if (params.has('s')) result.season = Number(params.get('s'));
    if (params.has('e')) result.episode = Number(params.get('e'));
  }
  return result;
}

export const ROUTES = {
  HOME: '/',
  MOVIES: '/movies',
  SERIES: '/series',
  ANIME: '/anime',
  HISTORY: '/history',
  SETTINGS: '/settings',
  INFO: '/info',
  IMPORT_SETTINGS: '/import-settings',
};

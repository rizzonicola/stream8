import { useCallback, useEffect, useState } from 'react';

// Mappa unica tra viste della Home e percorsi: evita che App, NavBar e
// HomePage tengano ciascuno la propria copia della stessa tabella.
export const VIEWS = { HOME: 'home', MOVIES: 'movies', SERIES: 'series', ANIME: 'anime' };

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

const VIEW_ROUTES = {
  [VIEWS.HOME]: ROUTES.HOME,
  [VIEWS.MOVIES]: ROUTES.MOVIES,
  [VIEWS.SERIES]: ROUTES.SERIES,
  [VIEWS.ANIME]: ROUTES.ANIME,
};

export function pathToView(pathname) {
  if (pathname === ROUTES.MOVIES) return VIEWS.MOVIES;
  if (pathname === ROUTES.SERIES) return VIEWS.SERIES;
  if (pathname === ROUTES.ANIME) return VIEWS.ANIME;
  return VIEWS.HOME;
}

export function viewToRoute(view) {
  return VIEW_ROUTES[view] ?? ROUTES.HOME;
}

function currentPath() {
  return window.location.pathname + window.location.search;
}

function scrollToTop() {
  window.scrollTo(0, 0);
}

// Router minimale basato sulla History API nativa del browser.
// La posizione di scorrimento viene salvata nella voce di cronologia prima
// di ogni push e ripristinata su back/forward: senza questo, tornando
// indietro da un dettaglio si finirebbe sempre in cima alla Home.
export function useRouter() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

    const handlePop = (event) => {
      setPath(currentPath());
      const target = Number(event.state?.scrollY) || 0;
      requestAnimationFrame(() => window.scrollTo(0, target));
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((to, state) => {
    if (to === currentPath()) return;
    // Conserva la posizione attuale nella voce che stiamo lasciando.
    window.history.replaceState(
      { ...(window.history.state || {}), scrollY: window.scrollY },
      ''
    );
    window.history.pushState({ ...(state || {}), scrollY: 0 }, '', to);
    setPath(to);
    requestAnimationFrame(scrollToTop);
  }, []);

  const replace = useCallback((to, state) => {
    window.history.replaceState(state ?? null, '', to);
    setPath(to);
  }, []);

  return { path, navigate, replace, state: window.history.state };
}

// --- Helper per costruire/leggere i percorsi usati dall'app ---

// Se l'item ha stagione/episodio (es. proviene dalla cronologia, o l'utente
// li ha già selezionati in pagina), li porta nell'URL come query string:
// così il dettaglio si riapre sull'episodio giusto anche dopo un reload.
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
  const match = pathname.match(/^\/title\/(movie|tv|anime)\/(\d+)\/?$/);
  if (!match) return null;
  const result = { mediaType: match[1], id: Number(match[2]) };
  if (search) {
    const params = new URLSearchParams(search);
    if (params.has('s')) result.season = Number(params.get('s'));
    if (params.has('e')) result.episode = Number(params.get('e'));
  }
  return result;
}

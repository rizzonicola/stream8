// URL e caricamento delle immagini TMDb.
// Tenere qui le varianti evita che ogni componente inventi la propria size
// e permette di cambiare la strategia responsive in un solo punto.

export const IMAGE_BASE = 'https://image.tmdb.org/t/p';

const POSTER_WIDTHS = [92, 154, 185, 342];
const POSTER_LARGE_WIDTHS = [185, 342, 500];
const BACKDROP_WIDTHS = [780, 1280];

function srcSet(path, widths) {
  if (!path) return undefined;
  return widths.map((w) => `${IMAGE_BASE}/w${w}${path} ${w}w`).join(', ');
}

export function imageUrl(path, size = 'w342') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function posterUrl(path, size = 'w342') {
  return imageUrl(path, size);
}

export function backdropUrl(path, size = 'w1280') {
  return imageUrl(path, size);
}

export function posterSrcSet(path, { large = false } = {}) {
  return srcSet(path, large ? POSTER_LARGE_WIDTHS : POSTER_WIDTHS);
}

export function backdropSrcSet(path) {
  return srcSet(path, BACKDROP_WIDTHS);
}

export function preloadImage(url, { srcSet: set, sizes, fetchPriority = 'low' } = {}) {
  if (!url) return null;
  const img = new Image();
  if (set) img.srcset = set;
  if (sizes) img.sizes = sizes;
  if ('fetchPriority' in img) img.fetchPriority = fetchPriority;
  img.decoding = 'async';
  img.src = url;
  return img;
}

// Attende la decodifica senza bloccare la UI per sempre: se il browser non
// espone decode() o l'immagine non arriva, si prosegue comunque.
export function decodeImage(img, timeoutMs = 1500) {
  if (!img || typeof img.decode !== 'function') return Promise.resolve();
  return Promise.race([
    img.decode().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

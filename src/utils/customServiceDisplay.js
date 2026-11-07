// Helper di presentazione per i servizi personalizzati. Non contengono
// logica di configurazione: servono solo a mostrare nome e URL in modo
// leggibile nella lista e nel dialog di eliminazione.

export function serviceInitials(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return '?';

  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toUpperCase();
}

// Mostra l'URL senza schema e senza slash finale: è più leggibile in una
// riga stretta e resta comunque riconoscibile (host + eventuale percorso).
export function displayBaseUrl(baseUrl) {
  const value = String(baseUrl || '').trim();
  if (!value) return '';
  return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

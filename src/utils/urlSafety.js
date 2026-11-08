// Controlli centralizzati sugli URL aperti dall'app.
//
// `new URL()` normalizza i caratteri di controllo come tab, newline e NUL
// prima di interpretare lo schema: per questo `java\tscript:` diventa
// `javascript:`. Fare il controllo con una regex sullo schema, quindi, non
// basta: qui si lascia che sia il parser del browser a decidere e si
// accettano esclusivamente http: e https:. I caratteri di controllo grezzi
// vengono rifiutati prima ancora del parsing, perché non hanno alcun uso
// legittimo in un URL e sono il veicolo classico di questo bypass.

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// URL assoluto http(s) valido. `base` è opzionale: quando indicato, accetta
// anche URL relativi e li risolve rispetto a quella base (utile per validare
// la destinazione finale di un pattern personalizzato).
export function parseHttpUrl(value, base) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return null;

  try {
    const url = base === undefined ? new URL(trimmed) : new URL(trimmed, base);
    if (!HTTP_PROTOCOLS.has(url.protocol)) return null;
    // Le credenziali nell'URL finirebbero nella barra degli indirizzi e
    // nella cronologia: non sono necessarie per i servizi supportati.
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(value) {
  return parseHttpUrl(value) !== null;
}

// Modello di URL che può contenere i segnaposto dei servizi personalizzati
// (`{base_url}`, `{tmdb_id}`, ...). I segnaposto vengono sostituiti con un
// valore innocuo e il risultato viene risolto rispetto a un'origine fittizia:
// in questo modo `javascript:{title}` e varianti con caratteri di controllo
// vengono rifiutati, mentre restano validi i pattern relativi e quelli
// assoluti http(s).
export function isSafeUrlTemplate(template) {
  if (typeof template !== 'string') return false;
  const probe = template.replace(/\{[a-z_]+\}/gi, 'x');
  if (CONTROL_CHARS.test(probe)) return false;
  try {
    const url = new URL(probe, 'https://stream8.invalid/');
    if (!HTTP_PROTOCOLS.has(url.protocol)) return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

// Accesso a localStorage centralizzato: JSON non valido o storage non
// disponibile (modalità privata, quota) non devono mai far fallire l'app.

export function readJson(key, fallback = null) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// `onQuota` può restituire un valore più piccolo da salvare al posto di
// quello originale (es. metà cronologia). undefined = nessun ripiego.
export function writeJson(key, value, { onQuota } = {}) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (!onQuota) return false;
    const fallback = onQuota(value, err);
    if (fallback === undefined) return false;
    try {
      localStorage.setItem(key, JSON.stringify(fallback));
      return true;
    } catch {
      return false;
    }
  }
}

export function removeKey(key) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    // storage non disponibile: nulla da rimuovere
  }
}

export function keysWithPrefix(prefix) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

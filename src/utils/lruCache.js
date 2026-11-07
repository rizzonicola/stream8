// Cache in memoria con scadenza e limite rigido (LRU).
// Una Map nativa mantiene l'ordine di inserimento: spostando una voce in
// fondo ad ogni lettura, la prima chiave è sempre la meno usata di recente.
export class LruCache {
  constructor(maxEntries) {
    this.maxEntries = maxEntries;
    this.map = new Map();
  }

  get size() {
    return this.map.size;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiry <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    this.map.delete(key);
    this.map.set(key, { value, expiry: Date.now() + ttlMs });
    while (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value);
    }
  }

  delete(key) {
    return this.map.delete(key);
  }

  deleteMatching(predicate) {
    for (const key of this.map.keys()) {
      if (predicate(key)) this.map.delete(key);
    }
  }

  clear() {
    this.map.clear();
  }
}

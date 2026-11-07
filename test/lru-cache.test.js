import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LruCache } from '../src/utils/lruCache.js';

test('LruCache scarta il valore dopo la scadenza', () => {
  const cache = new LruCache(2);
  cache.set('a', 1, -1);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 0);
});

test('LruCache espelle la voce meno usata quando supera il limite', () => {
  const cache = new LruCache(2);
  cache.set('a', 1, 60_000);
  cache.set('b', 2, 60_000);
  assert.equal(cache.get('a'), 1); // 'a' diventa la più recente
  cache.set('c', 3, 60_000);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
});

test('LruCache elimina tutte le chiavi che corrispondono a un predicato', () => {
  const cache = new LruCache(10);
  cache.set('search::one', 1, 60_000);
  cache.set('search::two', 2, 60_000);
  cache.set('id::3', 3, 60_000);
  cache.deleteMatching((key) => key.startsWith('search::'));
  assert.deepEqual([...cache.map.keys()], ['id::3']);
});

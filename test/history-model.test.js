import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entryKey,
  groupHistoryByShow,
  mergeHistories,
  normalizeHistory,
  pruneOldTombstones,
  showKey,
} from '../src/utils/historyModel.js';

const base = {
  mediaType: 'tv',
  id: 10,
  title: 'Esempio',
  posterPath: '/p.jpg',
  season: 1,
  episode: 2,
};

test('entryKey distingue episodi diversi dello stesso titolo', () => {
  assert.equal(entryKey(base), 'tv-10-1-2');
  assert.notEqual(entryKey(base), entryKey({ ...base, episode: 3 }));
  assert.equal(showKey(base), 'tv-10');
});

test('normalizeHistory tiene la visione più recente per chiave e compatta i campi', () => {
  const result = normalizeHistory([
    { ...base, watchedAt: 100, overview: 'testo pesante non necessario' },
    { ...base, watchedAt: 200, title: 'Aggiornato' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Aggiornato');
  assert.equal(result[0].watchedAt, 200);
  assert.equal('overview' in result[0], false);
});

test('normalizeHistory scarta voci prive di identità valida', () => {
  assert.deepEqual(
    normalizeHistory([
      { title: 'senza id', mediaType: 'movie' },
      { id: 1, mediaType: 'sconosciuto', title: 'Tipo errato' },
      { id: 2, mediaType: 'movie', title: '' },
    ]),
    []
  );
});

test('mergeHistories fa vincere il tombstone più recente sulla visione vecchia', () => {
  const local = [{ _key: 'movie-5--', watchedAt: 300, deleted: true }];
  const remote = [{ _key: 'movie-5--', mediaType: 'movie', id: 5, title: 'Film', watchedAt: 100 }];
  const [entry] = mergeHistories(local, remote);
  assert.equal(entry.deleted, true);
  assert.equal(entry.watchedAt, 300);
});

test('mergeHistories fa vincere la visione successiva al tombstone', () => {
  const local = [{ _key: 'movie-5--', mediaType: 'movie', id: 5, title: 'Film', watchedAt: 400 }];
  const remote = [{ _key: 'movie-5--', watchedAt: 300, deleted: true }];
  const [entry] = mergeHistories(local, remote);
  assert.equal(entry.title, 'Film');
  assert.equal(entry.deleted, false);
});

test('pruneOldTombstones rimuove solo le cancellazioni scadute', () => {
  const now = Date.now();
  const result = pruneOldTombstones([
    { _key: 'movie-1--', watchedAt: 1, deleted: true },
    { _key: 'movie-2--', watchedAt: 1, deleted: false },
    { _key: 'movie-3--', watchedAt: now - 1000, deleted: true },
  ]);
  assert.deepEqual(
    result.map((entry) => entry._key),
    ['movie-2--', 'movie-3--']
  );
});

test('groupHistoryByShow restituisce una card per titolo, la più recente', () => {
  const history = [
    { ...base, episode: 2, watchedAt: 300 },
    { ...base, episode: 1, watchedAt: 200 },
    { mediaType: 'movie', id: 7, title: 'Film', watchedAt: 100 },
  ];
  const grouped = groupHistoryByShow(history);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].episode, 2);
  assert.equal(grouped[1].id, 7);
});

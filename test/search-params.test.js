import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSearchPath,
  filterAndSortSearchResults,
  mergeSearchResults,
  parseSearchPath,
  sanitizeSearchQuery,
} from '../src/utils/searchParams.js';

test('parseSearchPath restituisce i valori di default senza query', () => {
  assert.deepEqual(parseSearchPath('/search'), {
    q: '',
    type: 'all',
    year: 'all',
    rating: 'all',
    sort: 'relevance',
  });
});

test('parseSearchPath normalizza query e scarta filtri non validi', () => {
  const parsed = parseSearchPath(
    '/search?q=%20%20Dune%20%20Part%20Two%20&type=movie&year=2020s&rating=8&sort=rating&extra=1'
  );
  assert.equal(parsed.q, 'Dune Part Two');
  assert.equal(parsed.type, 'movie');
  assert.equal(parsed.year, '2020s');
  assert.equal(parsed.rating, '8');
  assert.equal(parsed.sort, 'rating');

  const invalid = parseSearchPath(
    '/search?q=x&type=person&year=1800s&rating=10&sort=random'
  );
  assert.equal(invalid.type, 'all');
  assert.equal(invalid.year, 'all');
  assert.equal(invalid.rating, 'all');
  assert.equal(invalid.sort, 'relevance');
});

test('sanitizeSearchQuery limita lunghezza e caratteri di controllo', () => {
  assert.equal(sanitizeSearchQuery('  a\n\tb  '), 'a b');
  assert.equal(sanitizeSearchQuery('x'.repeat(200)).length, 120);
});

test('buildSearchPath omette i default e codifica la query', () => {
  assert.equal(buildSearchPath({ q: '' }), '/search');
  assert.equal(buildSearchPath({ q: 'Dune', type: 'all' }), '/search?q=Dune');
  assert.equal(
    buildSearchPath({ q: 'Dune & Part Two', type: 'movie', year: '2020s', rating: '8', sort: 'rating' }),
    '/search?q=Dune+%26+Part+Two&type=movie&year=2020s&rating=8&sort=rating'
  );
});

test('parse e build fanno round-trip', () => {
  const path = buildSearchPath({
    q: 'Città di Dio',
    type: 'movie',
    year: '2000s',
    rating: '7',
    sort: 'newest',
  });
  const parsed = parseSearchPath(path);
  assert.equal(parsed.q, 'Città di Dio');
  assert.equal(parsed.type, 'movie');
  assert.equal(parsed.year, '2000s');
  assert.equal(parsed.rating, '7');
  assert.equal(parsed.sort, 'newest');
});

const ITEMS = [
  { id: 1, mediaType: 'movie', title: 'A', year: '2024', voteAverage: 6.1, voteCount: 100 },
  { id: 2, mediaType: 'tv', title: 'B', year: '2015', voteAverage: 8.4, voteCount: 50 },
  { id: 3, mediaType: 'anime', title: 'C', year: '1995', voteAverage: 9.1, voteCount: 10 },
  { id: 4, mediaType: 'movie', title: 'D', year: '2021', voteAverage: 8.4, voteCount: 500 },
];

test('filtra per tipo, decennio e voto minimo', () => {
  assert.deepEqual(
    filterAndSortSearchResults(ITEMS, { type: 'movie' }).map((item) => item.id),
    [1, 4]
  );
  assert.deepEqual(
    filterAndSortSearchResults(ITEMS, { year: '2020s' }).map((item) => item.id),
    [1, 4]
  );
  assert.deepEqual(
    filterAndSortSearchResults(ITEMS, { year: '1990s' }).map((item) => item.id),
    [3]
  );
  assert.deepEqual(
    filterAndSortSearchResults(ITEMS, { rating: '8' }).map((item) => item.id),
    [2, 3, 4]
  );
});

test('ordina per voto (con voteCount come spareggio) e per data', () => {
  assert.deepEqual(
    filterAndSortSearchResults(ITEMS, { sort: 'rating' }).map((item) => item.id),
    [3, 4, 2, 1]
  );
  assert.deepEqual(
    filterAndSortSearchResults(ITEMS, { sort: 'newest' }).map((item) => item.id),
    [1, 4, 2, 3]
  );
  assert.deepEqual(
    filterAndSortSearchResults(ITEMS, { sort: 'relevance' }).map((item) => item.id),
    [1, 2, 3, 4]
  );
});

test('mergeSearchResults elimina i duplicati mantenendo il primo ordine', () => {
  const merged = mergeSearchResults(
    [{ id: 1, mediaType: 'movie' }],
    [
      { id: 1, mediaType: 'movie' },
      { id: 2, mediaType: 'tv' },
      { id: 2, mediaType: 'tv' },
    ]
  );
  assert.deepEqual(
    merged.map((item) => `${item.mediaType}-${item.id}`),
    ['movie-1', 'tv-2']
  );
});

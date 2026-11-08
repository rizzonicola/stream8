import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCustomUrl,
  CustomConfigError,
  parseCustomConfig,
  pickPatternForItem,
  serializeCustomConfig,
  validateCustomServiceBaseUrl,
} from '../src/utils/customConfigParser.js';

const CONFIG = {
  movie_pattern: '{base_url}/movie/{tmdb_id}',
  episode_pattern: '{base_url}/tv/{tmdb_id}/{season}/{episode}',
  anime_pattern: '{base_url}/anime/{anilist_id}',
};

test('serializeCustomConfig produce JSON leggibile e rileggibile', () => {
  const text = serializeCustomConfig(CONFIG);
  assert.equal(text.endsWith('\n'), true);
  assert.deepEqual(JSON.parse(text), CONFIG);
});

test('serializeCustomConfig e parseCustomConfig fanno round-trip', () => {
  assert.deepEqual(parseCustomConfig(serializeCustomConfig(CONFIG)), CONFIG);
});

test('parseCustomConfig rifiuta un pattern senza segnaposto identificativo', () => {
  assert.throws(
    () => parseCustomConfig(JSON.stringify({ ...CONFIG, movie_pattern: '{base_url}/movie' })),
    CustomConfigError
  );
});

test('parseCustomConfig rifiuta pattern con schemi eseguibili o caratteri di controllo', () => {
  const unsafePatterns = [
    'javascript:{title}',
    'java\tscript:{title}',
    'java\nscript:{title}',
    '\u0000javascript:{title}',
    'data:text/html,{title}',
    'vbscript:{title}',
  ];
  for (const moviePattern of unsafePatterns) {
    assert.throws(
      () =>
        parseCustomConfig(JSON.stringify({ ...CONFIG, movie_pattern: moviePattern })),
      CustomConfigError,
      `doveva essere rifiutato: ${JSON.stringify(moviePattern)}`
    );
  }
});

test('validateCustomServiceBaseUrl accetta solo URL http(s) assoluti senza credenziali', () => {
  assert.doesNotThrow(() => validateCustomServiceBaseUrl('https://example.test/base'));
  assert.doesNotThrow(() => validateCustomServiceBaseUrl('http://192.168.1.10:8096'));

  const rejected = [
    'javascript:alert(1)',
    'java\tscript:alert(1)',
    '\u0000javascript:alert(1)',
    'data:text/html,x',
    'ftp://example.test',
    '/solo/percorso',
    'https://user:pass@example.test',
  ];
  for (const value of rejected) {
    assert.throws(
      () => validateCustomServiceBaseUrl(value),
      CustomConfigError,
      `doveva essere rifiutato: ${JSON.stringify(value)}`
    );
  }
});

test('buildCustomUrl sostituisce i segnaposto e normalizza lo slash finale', () => {
  assert.equal(
    buildCustomUrl({
      pattern: CONFIG.episode_pattern,
      baseUrl: 'https://example.test/',
      tmdbId: 1,
      season: 2,
      episode: 3,
    }),
    'https://example.test/tv/1/2/3'
  );
});

test('pickPatternForItem sceglie il pattern in base al tipo di contenuto', () => {
  assert.equal(pickPatternForItem(CONFIG, { mediaType: 'anime' }), CONFIG.anime_pattern);
  assert.equal(pickPatternForItem(CONFIG, { mediaType: 'tv' }), CONFIG.episode_pattern);
  assert.equal(pickPatternForItem(CONFIG, { mediaType: 'movie' }), CONFIG.movie_pattern);
});

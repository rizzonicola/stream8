import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeSettingsPayload,
  encodeSettingsPayload,
  pickShareableSettings,
} from '../src/utils/shareSettings.js';

const CONFIG = {
  movie_pattern: '{base_url}/movie/{tmdb_id}',
  episode_pattern: '{base_url}/tv/{tmdb_id}/{season}/{episode}',
  anime_pattern: '{base_url}/anime/{anilist_id}',
};

// Ricostruisce un payload arbitrario come farebbe un link creato a mano.
function rawPayload(value) {
  const json = JSON.stringify(value);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

test('pickShareableSettings scarta sincronizzazione e campi sconosciuti', () => {
  const picked = pickShareableSettings({
    language: 'it',
    theme: 'dark',
    selectedMainstream: ['netflix'],
    customServices: [],
    sync: { enabled: true, apiKey: 'segreta' },
    onboardingComplete: true,
  });
  assert.deepEqual(Object.keys(picked).sort(), [
    'customServices',
    'language',
    'selectedMainstream',
    'theme',
  ]);
  assert.equal('sync' in picked, false);
});

test('decodeSettingsPayload valida lingua, tema, servizi e configurazioni', () => {
  const decoded = decodeSettingsPayload(
    encodeSettingsPayload({
      language: 'de', // non supportata
      theme: 'neon', // non valido
      selectedMainstream: ['netflix', 'inesistente', 'netflix'],
      customServices: [
        { id: 'ok', name: 'Servizio', baseUrl: 'https://example.test', config: CONFIG },
        { id: 'rotto', name: 'Rotto', baseUrl: '', config: {} },
      ],
    })
  );

  assert.deepEqual(decoded, {
    selectedMainstream: ['netflix'],
    customServices: [
      { id: 'ok', name: 'Servizio', baseUrl: 'https://example.test', config: CONFIG },
    ],
  });
});

test('decodeSettingsPayload rifiuta URL con schemi eseguibili', () => {
  const decoded = decodeSettingsPayload(
    rawPayload({
      customServices: [
        { id: 'js', name: 'JS', baseUrl: 'javascript:alert(1)//', config: CONFIG },
        {
          id: 'pattern',
          name: 'Pattern',
          baseUrl: 'https://example.test',
          config: { ...CONFIG, movie_pattern: 'javascript:{title}' },
        },
      ],
    })
  );
  assert.equal(decoded, null);
});

test('decodeSettingsPayload rifiuta varianti con tab, newline e NUL', () => {
  const variants = [
    'java\tscript:alert(1)//',
    'java\nscript:alert(1)//',
    '\u0000javascript:alert(1)//',
  ];
  for (const baseUrl of variants) {
    assert.equal(
      decodeSettingsPayload(
        rawPayload({
          customServices: [{ id: 'x', name: 'X', baseUrl, config: CONFIG }],
        })
      ),
      null,
      `baseUrl doveva essere rifiutato: ${JSON.stringify(baseUrl)}`
    );
  }

  for (const moviePattern of ['java\tscript:{title}', '\u0000javascript:{title}']) {
    assert.equal(
      decodeSettingsPayload(
        rawPayload({
          customServices: [
            {
              id: 'x',
              name: 'X',
              baseUrl: 'https://example.test',
              config: { ...CONFIG, movie_pattern: moviePattern },
            },
          ],
        })
      ),
      null,
      `pattern doveva essere rifiutato: ${JSON.stringify(moviePattern)}`
    );
  }
});

test('decodeSettingsPayload scarta servizi duplicati e URL base troppo lunghi', () => {
  const decoded = decodeSettingsPayload(
    rawPayload({
      customServices: [
        { id: 'dup', name: 'Primo', baseUrl: 'https://example.test', config: CONFIG },
        { id: 'dup', name: 'Secondo', baseUrl: 'https://evil.test', config: CONFIG },
        {
          id: 'lungo',
          name: 'Lungo',
          baseUrl: `https://example.test/${'a'.repeat(2100)}`,
          config: CONFIG,
        },
      ],
    })
  );
  assert.equal(decoded.customServices.length, 1);
  assert.equal(decoded.customServices[0].name, 'Primo');
});

test('decodeSettingsPayload scarta un payload fatto a mano con soli campi non validi', () => {
  assert.equal(
    decodeSettingsPayload(
      rawPayload({
        language: 'de',
        theme: 'neon',
        selectedMainstream: 'netflix',
        customServices: [{ id: 'x' }],
        sync: { enabled: true, apiKey: 'segreta' },
      })
    ),
    null
  );
});

test('decodeSettingsPayload ignora sync anche in un payload costruito a mano', () => {
  assert.deepEqual(decodeSettingsPayload(rawPayload({ theme: 'light', sync: { apiKey: 'x' } })), {
    theme: 'light',
  });
});

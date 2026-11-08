import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { fetchWatchProviders } from '../src/api/tmdb.js';

const originalFetch = globalThis.fetch;
const hadWindow = 'window' in globalThis;
const originalWindow = globalThis.window;

globalThis.window = { location: { origin: 'https://stream8.example' } };

afterEach(() => {
  globalThis.fetch = originalFetch;
});

after(() => {
  if (hadWindow) globalThis.window = originalWindow;
  else delete globalThis.window;
});

function stubProviders(payload) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
}

test('fetchWatchProviders scarta un link non http(s) proveniente da TMDb', async () => {
  stubProviders({
    results: {
      IT: {
        link: 'java\tscript:alert(1)',
        flatrate: [{ provider_name: 'Netflix' }, { provider_name: 42 }, null],
        rent: 'non-un-array',
      },
    },
  });

  const data = await fetchWatchProviders(901, 'movie');
  assert.deepEqual(data.names, ['Netflix']);
  assert.equal(data.link, null);
});

test('fetchWatchProviders conserva un link https valido', async () => {
  stubProviders({
    results: {
      IT: {
        link: 'https://www.themoviedb.org/movie/902/watch?locale=IT',
        ads: [{ provider_name: 'YouTube' }],
      },
    },
  });

  const data = await fetchWatchProviders(902, 'movie');
  assert.deepEqual(data.names, ['YouTube']);
  assert.equal(data.link, 'https://www.themoviedb.org/movie/902/watch?locale=IT');
});

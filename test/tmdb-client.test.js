import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { fetchWatchProviders, searchMulti } from '../src/api/tmdb.js';

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

test('searchMulti invia la pagina richiesta e restituisce i metadati di paginazione', async () => {
  let captured;
  globalThis.fetch = async (url) => {
    captured = String(url);
    return new Response(
      JSON.stringify({
        page: 2,
        total_pages: 5,
        total_results: 100,
        results: [
          {
            id: 1,
            media_type: 'movie',
            title: 'Dune',
            release_date: '2024-02-29',
            vote_average: 8.2,
            vote_count: 1200,
            genre_ids: [878],
          },
          {
            id: 2,
            media_type: 'tv',
            name: 'Frieren',
            first_air_date: '2023-09-29',
            vote_average: 8.9,
            vote_count: 300,
            genre_ids: [16],
            original_language: 'ja',
          },
          { id: 3, media_type: 'person', name: 'Someone' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const data = await searchMulti('dune', 'en-US', { page: 2 });

  assert.match(captured, /[?&]page=2(?:&|$)/);
  assert.equal(data.page, 2);
  assert.equal(data.totalPages, 5);
  assert.equal(data.totalResults, 100);
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].mediaType, 'movie');
  assert.equal(data.items[0].releaseDate, '2024-02-29');
  assert.equal(data.items[0].voteCount, 1200);
  assert.equal(data.items[1].mediaType, 'anime');
});

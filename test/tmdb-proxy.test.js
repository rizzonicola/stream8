import assert from 'node:assert/strict';
import { before, test } from 'node:test';

let onRequest;

before(async () => {
  globalThis.caches = {
    default: {
      match: async () => undefined,
      put: async () => {},
    },
  };
  ({ onRequest } = await import('../functions/api/tmdb/[[path]].js'));
});

function context(request, env = { TMDB_TOKEN: 'test-token' }) {
  return {
    request,
    env,
    waitUntil: (promise) => promise,
  };
}

test('inoltra la richiesta a TMDb aggiungendo il token lato server', async (t) => {
  const originalFetch = globalThis.fetch;
  let captured;

  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await onRequest(
    context(new Request('https://stream8.example/api/tmdb/movie/603?language=it-IT'))
  );

  assert.equal(response.status, 200);
  assert.equal(captured.url, 'https://api.themoviedb.org/3/movie/603?language=it-IT');
  assert.equal(captured.init.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(await response.json(), { results: [] });
});

test('rifiuta gli endpoint non usati dall app', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch non deve essere chiamato');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await onRequest(
    context(new Request('https://stream8.example/api/tmdb/account'))
  );

  assert.equal(response.status, 404);
});

test('rifiuta i tentativi di path traversal anche percent-encoded', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch non deve essere chiamato');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const paths = [
    '/api/tmdb/movie/%2e%2e/account',
    '/api/tmdb/movie/%2e%2e%2faccount',
    '/api/tmdb/movie/%252e%252e',
    '/api/tmdb/movie/%00',
    '/api/tmdb/movie/%E0%A4%A',
    '/api/tmdb//movie/603',
  ];

  for (const path of paths) {
    const response = await onRequest(context(new Request(`https://stream8.example${path}`)));
    assert.equal(response.status, 404, `atteso 404 per ${path}`);
  }
});

test('rifiuta endpoint TMDb validi ma non usati dall app', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch non deve essere chiamato');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const paths = [
    '/api/tmdb/movie/popular',
    '/api/tmdb/movie/top_rated',
    '/api/tmdb/tv/airing_today',
    '/api/tmdb/discover/keyword',
    '/api/tmdb/search/person',
    '/api/tmdb/movie/603/images',
    '/api/tmdb/tv/1399/season/1/aggregate_credits',
  ];

  for (const path of paths) {
    const response = await onRequest(context(new Request(`https://stream8.example${path}`)));
    assert.equal(response.status, 404, `atteso 404 per ${path}`);
  }
});

test('rifiuta parametri di query sconosciuti, duplicati o non validi', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch non deve essere chiamato');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const urls = [
    'https://stream8.example/api/tmdb/movie/603?language=it-IT&append_to_response=images',
    'https://stream8.example/api/tmdb/movie/603?language=it-IT&language=en-US',
    'https://stream8.example/api/tmdb/search/multi?query=x&query=y',
    'https://stream8.example/api/tmdb/movie/603?language=%3Cscript%3E',
    'https://stream8.example/api/tmdb/search/multi?query=',
    'https://stream8.example/api/tmdb/discover/movie?sort_by=revenue.desc',
    'https://stream8.example/api/tmdb/discover/movie?vote_count.gte=abc',
    'https://stream8.example/api/tmdb/tv/on_the_air?region=IT',
    'https://stream8.example/api/tmdb/tv/1399/watch/providers?language=it-IT',
  ];

  for (const url of urls) {
    const response = await onRequest(context(new Request(url)));
    assert.equal(response.status, 400, `atteso 400 per ${url}`);
  }
});

test('normalizza l ordine dei parametri per condividere la cache key', async (t) => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url) => {
    captured = url;
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await onRequest(
    context(
      new Request(
        'https://stream8.example/api/tmdb/movie/now_playing?region=IT&language=it-IT'
      )
    )
  );

  assert.equal(response.status, 200);
  assert.equal(
    captured,
    'https://api.themoviedb.org/3/movie/now_playing?language=it-IT&region=IT'
  );
});

test('accetta gli endpoint usati dal client e aggiunge gli header di sicurezza', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const allowed = [
    '/api/tmdb/discover/movie?language=it-IT&sort_by=popularity.desc&vote_count.gte=100',
    '/api/tmdb/discover/tv?language=it-IT&with_genres=16&with_original_language=ja&first_air_date.lte=2026-01-01',
    '/api/tmdb/movie/now_playing?language=it-IT&region=IT',
    '/api/tmdb/tv/on_the_air?language=it-IT',
    '/api/tmdb/search/multi?query=matrix&language=it-IT',
    '/api/tmdb/movie/603?language=it-IT',
    '/api/tmdb/tv/1399/credits?language=it-IT',
    '/api/tmdb/tv/1399/season/1?language=it-IT',
    '/api/tmdb/movie/603/watch/providers',
  ];

  for (const path of allowed) {
    const response = await onRequest(context(new Request(`https://stream8.example${path}`)));
    assert.equal(response.status, 200, `atteso 200 per ${path}`);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  }
});

test('rifiuta i metodi diversi da GET', async () => {
  const response = await onRequest(
    context(new Request('https://stream8.example/api/tmdb/movie/603', { method: 'POST' }))
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET');
});

test('risponde con errore generico se il secret non è configurato', async () => {
  const response = await onRequest(
    context(new Request('https://stream8.example/api/tmdb/movie/603'), {})
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Server configuration error' });
});

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

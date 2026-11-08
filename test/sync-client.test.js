import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  checkSyncServer,
  pushRemoteHistory,
  SyncError,
} from '../src/api/syncClient.js';

const originalFetch = globalThis.fetch;
const hadWindow = 'window' in globalThis;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (hadWindow) globalThis.window = originalWindow;
  else delete globalThis.window;
});

function stubHealthCheck() {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ protocol: 'stream8-sync-v1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return calls;
}

test('checkSyncServer rifiuta schemi non http(s), credenziali e query', async () => {
  globalThis.fetch = async () => {
    throw new Error('fetch non deve essere chiamato');
  };

  const rejected = [
    'javascript:alert(1)',
    'java\tscript:alert(1)',
    '\u0000javascript:alert(1)',
    'data:text/plain,x',
    'ftp://example.test',
    'https://user:pass@example.test',
    'https://example.test/?token=segreto',
    'https://example.test/#frammento',
  ];

  for (const serverUrl of rejected) {
    await assert.rejects(
      () => checkSyncServer(serverUrl),
      SyncError,
      `doveva essere rifiutato: ${JSON.stringify(serverUrl)}`
    );
  }
});

test('checkSyncServer vieta HTTP in chiaro da una pagina HTTPS, salvo loopback', async () => {
  globalThis.window = { location: { protocol: 'https:' } };
  globalThis.fetch = async () => {
    throw new Error('fetch non deve essere chiamato');
  };

  await assert.rejects(
    () => checkSyncServer('http://192.168.1.20:8787'),
    /localhost/
  );

  const calls = stubHealthCheck();
  await checkSyncServer('http://localhost:8787/');
  assert.deepEqual(calls, ['http://localhost:8787/v1/health']);
});

test('checkSyncServer conserva un eventuale prefisso di percorso', async () => {
  const calls = stubHealthCheck();
  await checkSyncServer('https://example.test/stream8/');
  assert.deepEqual(calls, ['https://example.test/stream8/v1/health']);
});

test('pushRemoteHistory valida l URL prima di inviare la chiave API', async () => {
  globalThis.fetch = async () => {
    throw new Error('fetch non deve essere chiamato');
  };

  await assert.rejects(
    () => pushRemoteHistory('javascript:alert(1)', 'chiave', []),
    SyncError
  );
});

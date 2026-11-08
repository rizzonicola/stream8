import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isSafeHttpUrl,
  isSafeUrlTemplate,
  parseHttpUrl,
} from '../src/utils/urlSafety.js';

test('parseHttpUrl accetta solo http/https e rifiuta le varianti con caratteri di controllo', () => {
  assert.equal(parseHttpUrl('https://example.test/path')?.href, 'https://example.test/path');
  assert.equal(parseHttpUrl('http://localhost:8787')?.href, 'http://localhost:8787/');

  const rejected = [
    'javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java\rscript:alert(1)',
    '\u0000javascript:alert(1)',
    ' \u0001javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'ftp://example.test/file',
    'https://user:pass@example.test/',
  ];
  for (const value of rejected) {
    assert.equal(parseHttpUrl(value), null, `doveva essere rifiutato: ${JSON.stringify(value)}`);
  }
});

test('parseHttpUrl risolve gli URL relativi rispetto a una base http(s)', () => {
  assert.equal(
    parseHttpUrl('/title/movie/603', 'https://stream8.example/history')?.href,
    'https://stream8.example/title/movie/603'
  );
  assert.equal(parseHttpUrl('javascript:alert(1)', 'https://stream8.example/'), null);
});

test('isSafeUrlTemplate rifiuta schemi eseguibili anche con caratteri di controllo', () => {
  assert.equal(isSafeUrlTemplate('{base_url}/movie/{tmdb_id}'), true);
  assert.equal(isSafeUrlTemplate('https://example.test/anime/{anilist_id}'), true);
  assert.equal(isSafeUrlTemplate('javascript:{title}'), false);
  assert.equal(isSafeUrlTemplate('java\tscript:{title}'), false);
  assert.equal(isSafeUrlTemplate('\u0000javascript:{title}'), false);
  assert.equal(isSafeUrlTemplate('data:text/html,{title}'), false);
  assert.equal(isSafeUrlTemplate('vbscript:{title}'), false);
});

test('isSafeHttpUrl non accetta credenziali incorporate', () => {
  assert.equal(isSafeHttpUrl('https://example.test'), true);
  assert.equal(isSafeHttpUrl('https://token@example.test'), false);
});

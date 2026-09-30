import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLinks } from '../tools/check-links.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('reports missing relative and off-base absolute links, accepts the rest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'links-'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'b.html'), '');
  writeFileSync(join(dir, 'sub', 'index.html'), '');
  writeFileSync(join(dir, 'a.html'), [
    '<a href="b.html">ok</a>',
    '<a href="missing.html">broken</a>',
    '<a href="sub/">dir index</a>',
    '<a href="b.html#top">hash</a>',
    '<a href="https://example.com">external</a>',
    '<a href="mailto:x@example.com">mail</a>',
    '<a href="#local">local</a>',
    '<link href="/portfolio-zen/b.html">',
    '<img src="/elsewhere.png">',
  ].join('\n'));
  assert.deepEqual(checkLinks(dir), [
    { file: 'a.html', ref: 'missing.html' },
    { file: 'a.html', ref: '/elsewhere.png' },
  ]);
});

test('links inside HTML comments are ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'links-'));
  writeFileSync(join(dir, 'a.html'), '<!-- example: <a href="notes/<slug>.html">x</a> -->\n<a href="gone.html">y</a>');
  assert.deepEqual(checkLinks(dir), [{ file: 'a.html', ref: 'gone.html' }]);
});

test('the site has no broken internal links', () => {
  assert.deepEqual(checkLinks(repoRoot), []);
});

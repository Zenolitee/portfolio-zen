import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const css = read('css/style.css');

test('card text stays readable by screen readers on desktop; posters are decorative', () => {
  assert.doesNotMatch(css, /\.show-info\s*\{\s*display:\s*none/, '.show-info must not be display: none');
  assert.match(css, /\.visually-hidden,\s*\.show-info\s*\{/, '.show-info should use the visually-hidden technique');
  const posters = [...read('projects/index.html').matchAll(/<img class="show-poster"[^>]*>/g)].map(m => m[0]);
  assert.equal(posters.length, 4);
  for (const img of posters) assert.match(img, /alt=""/);
});

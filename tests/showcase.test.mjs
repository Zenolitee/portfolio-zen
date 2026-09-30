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

test('phones and touch-only screens (no hover) get the stacked cards with their info shown', () => {
  const block = css.split('@media (max-width: 620px), (hover: none) {')[1];
  assert.ok(block, 'expected a "(max-width: 620px), (hover: none)" block');
  const rules = block.slice(0, block.indexOf('\n}'));
  assert.match(rules, /\.showcase \{ flex-direction: column/);
  assert.match(rules, /\.peek \{ display: none/);
  assert.match(rules, /\.show-info \{/);
});

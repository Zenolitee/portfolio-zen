import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const css = read('css/style.css');

test('card text is always visible (not hidden until hover); posters are decorative', () => {
  assert.doesNotMatch(css, /\.show-info\s*\{[^}]*(display:\s*none|clip-path)/);
  assert.doesNotMatch(css, /\.visually-hidden,\s*\.show-info/);
  const posters = [...read('projects/index.html').matchAll(/<img class="show-poster"[^>]*>/g)].map(m => m[0]);
  assert.equal(posters.length, 4);
  for (const img of posters) assert.match(img, /alt=""/);
});

test('the grid drops to two columns, then one, on narrow screens', () => {
  assert.match(css, /@media \(max-width: 860px\) \{\s*\.showcase \{ grid-template-columns: repeat\(2/);
  assert.match(css, /@media \(max-width: 560px\) \{\s*\.showcase \{ grid-template-columns: 1fr/);
});

test('looping detail-page clips can be paused (WCAG 2.2.2)', () => {
  for (const slug of ['project-athena', 'relicore']) {
    const video = read(`projects/${slug}.html`).match(/<video[^>]*data-autoplay[^>]*>/)[0];
    assert.match(video, /\scontrols[\s>]/, `${slug} hero video needs controls`);
  }
});

test('stopping a card clip releases it (src removed and load() called); reduced motion never plays', () => {
  const js = read('js/showcase.js');
  assert.match(js.match(/const stop = [^\n]+/)[0], /removeAttribute\('src'\);.*\.load\(\)/);
  assert.match(js, /if \(reduceMotion\.matches \|\|.*\) return;/);
});

test('detail-page screenshots all have alt text', () => {
  for (const slug of ['project-athena', 'asciify-ps']) {
    for (const [img] of read(`projects/${slug}.html`).matchAll(/<img [^>]*>/g)) assert.match(img, /alt="[^"]+"/, img);
  }
});

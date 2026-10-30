import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeStars, shimmer, flare } from '../js/stars.js';
import { ENABLED } from '../js/trail.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('stars fill the area, scale with its size, and stay inside it', () => {
  const stars = makeStars(1400, 700);
  assert.equal(stars.length, Math.round(1400 * 700 / 7000));
  for (const s of stars) assert.ok(s.x >= 0 && s.x <= 1400 && s.y >= 0 && s.y <= 700);
});

test('twinkle stays a valid opacity; flares are short peaks', () => {
  for (const s of makeStars(800, 600)) {
    for (let t = 0; t < 20; t += 0.37) {
      const a = shimmer(s, t);
      assert.ok(a >= 0 && a <= 1, `alpha ${a}`);
    }
  }
  const s = { phase: 0, flareSpeed: 1 };
  const samples = Array.from({ length: 1000 }, (_, i) => flare(s, i * 0.0063));   // one full cycle
  assert.ok(Math.max(...samples) > 0.99);
  assert.ok(samples.filter(v => v > 0.1).length < 250, 'flare should be lit for a small part of the cycle');
});

test('home page loads the starfield; the ASCII cursor trail is switched off but kept', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(page, /<canvas class="stars"/);
  assert.match(page, /js\/stars\.js/);
  assert.match(page, /js\/trail\.js/);
  assert.equal(ENABLED, false);
});

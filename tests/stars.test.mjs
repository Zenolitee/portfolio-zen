import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeStars, scintillate, placed, dragOffset, lens } from '../js/stars.js';
import { ENABLED } from '../js/trail.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the sky fills the screen, mostly faint stars with a few bright ones', () => {
  const stars = makeStars(1400, 700);
  for (const s of stars) assert.ok(s.x >= 0 && s.x < 1400 && s.y >= 0 && s.y < 700);
  const bright = stars.filter(s => s.m > 0.5).length, faint = stars.filter(s => s.m < 0.1).length;
  assert.ok(faint > stars.length * 0.6, 'most stars are faint');
  assert.ok(bright > 0 && bright < stars.length * 0.1, 'a few are bright');
});

test('twinkle is a gentle brightness wobble around 1', () => {
  for (const s of makeStars(800, 600)) for (let t = 0; t < 20; t += 0.37) {
    const f = scintillate(s, t);
    assert.ok(f > 0.7 && f < 1.3, `factor ${f}`);
  }
});

test('panning moves every star by the same amount (distant stars: no parallax) and wraps', () => {
  assert.deepEqual(placed({ x: 100, y: 100 }, 20, 10, 800, 600), { x: 80, y: 90 });
  assert.deepEqual(placed({ x: 5, y: 595 }, 20, -20, 800, 600), { x: 785, y: 15 });
});

test('the sky follows a drag pixel for pixel, and stays put without one', () => {
  const home = { az: 0, incl: 1.4 }, h = 800;
  assert.deepEqual(dragOffset(home, home, h), { x: 0, y: 0 });
  const view = { az: -100 * 4 / h, incl: 1.4 - 50 * 4 / h };    // blackhole.js after a 100 px right, 50 px down drag
  const o = dragOffset(view, home, h);
  assert.deepEqual(placed({ x: 300, y: 300 }, o.x, o.y, 1000, 800), { x: 400, y: 350 });
});

test('lensing: two images on opposite sides; the main one outside the Einstein ring, near-invisible far away', () => {
  const E = 100;
  const [a, b] = lens(30, 40, E);                                // a star 50 px from the hole
  assert.ok(a.r > E && b.r < E, 'main image outside the ring, the second inside');
  assert.ok(Math.sign(a.x) !== Math.sign(b.x), 'images on opposite sides');
  assert.ok(Math.abs(a.r - b.r - 50) < 1e-9, 'θ+ − |θ−| = β');
  const [far, farB] = lens(2000, 0, E);
  assert.ok(Math.abs(far.x - 2000) < 10 && Math.abs(far.mu - 1) < 0.01, 'far stars are barely moved');
  assert.ok(farB.mu < 0.001, 'their second image is negligible');
});

test('home page draws the canvas sky; the ASCII cursor trail is switched off but kept', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(page, /<canvas class="stars"/);
  assert.match(page, /js\/stars\.js/);
  assert.match(page, /js\/trail\.js/);
  assert.equal(ENABLED, false);
});

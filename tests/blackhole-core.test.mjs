import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlackHole, layout, renderFrame, charFor, RAMP, PARAMS } from '../js/blackhole-core.js';

const TAU = Math.PI * 2;

// best shift (in samples) that maps series a onto series b, by normalised cross-correlation
function bestShift(a, b, maxShift) {
  let best = -Infinity, shift = 0;
  for (let d = -maxShift; d <= maxShift; d++) {
    const xs = [], ys = [];
    for (let k = maxShift; k < a.length - maxShift; k++) { xs.push(a[k]); ys.push(b[k + d]); }
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
    let num = 0, nx = 0, ny = 0;
    for (let k = 0; k < xs.length; k++) { num += (xs[k] - mx) * (ys[k] - my); nx += (xs[k] - mx) ** 2; ny += (ys[k] - my) ** 2; }
    const c = num / Math.sqrt(nx * ny + 1e-12);
    if (c > best) { best = c; shift = d; }
  }
  return shift;
}

test('disk texture rotates rigidly toward -phi at every radius (no shear)', () => {
  const bh = createBlackHole({ hotspots: false });
  const dt = 0.37, t = 12.5;
  for (const rho of [1.5, 2.0, 2.7, 3.6]) {
    for (let k = 0; k < 64; k++) {
      const phi = (k / 64) * TAU;
      const now = bh.disk(rho, phi, t);
      const later = bh.disk(rho, phi - bh.textureOmega * dt, t + dt);
      assert.ok(Math.abs(now - later) < 1e-9, `rho ${rho} phi ${phi.toFixed(2)}: ${now} vs ${later}`);
    }
  }
});

test('front band moves right, top arc moves left on screen', () => {
  const bh = createBlackHole({ hotspots: false });
  const t = 20, dt = 0.15;
  // front band: row just below centre, x from -2 to 2
  const xs = Array.from({ length: 201 }, (_, k) => -2 + k * 0.02);
  const f0 = xs.map(x => bh.shade(x, 0.35, t)), f1 = xs.map(x => bh.shade(x, 0.35, t + dt));
  assert.ok(bestShift(f0, f1, 25) > 0, 'front band should move right');
  // top arc: circle r = 1.3, angle from -160deg to -20deg (left to right across the top)
  const th = Array.from({ length: 281 }, (_, k) => (-160 + k * 0.5) * Math.PI / 180);
  const a0 = th.map(a => bh.shade(1.3 * Math.cos(a), 1.3 * Math.sin(a), t));
  const a1 = th.map(a => bh.shade(1.3 * Math.cos(a), 1.3 * Math.sin(a), t + dt));
  assert.ok(bestShift(a0, a1, 30) < 0, 'top arc should move left');
});

test('everything drawn fits inside the bounding box (skip never clips)', () => {
  const bh = createBlackHole();
  const { BOX_X, BOX_Y } = PARAMS;
  for (const t of [0, 3.3, 17.9]) {
    for (let y = -BOX_Y + 0.01; y < BOX_Y; y += 0.01) {
      assert.ok(bh.shade(BOX_X - 0.01, y, t) < 1e-3 && bh.shade(-BOX_X + 0.01, y, t) < 1e-3, `x edge at y ${y}`);
    }
    for (let x = -BOX_X + 0.01; x < BOX_X; x += 0.01) {
      assert.ok(bh.shade(x, BOX_Y - 0.01, t) < 1e-3 && bh.shade(x, -BOX_Y + 0.01, t) < 1e-3, `y edge at x ${x}`);
    }
    assert.equal(bh.shade(BOX_X + 1, 0, t), 0);
  }
});

test('shadow is black and photon ring is bright', () => {
  const bh = createBlackHole();
  assert.equal(bh.shade(0, -0.5, 4), 0);                // inside shadow, above the front band
  assert.ok(bh.shade(0, -1.035, 4) > 0.5);              // photon ring at the top
});

test('layout caps the grid at 260 columns and grows the font instead', () => {
  const huge = layout({ width: 10000, height: 6000, charAspect: 0.6 });
  assert.equal(huge.cols, 260);
  assert.ok(huge.fontSize > 60);
  const laptop = layout({ width: 1440, height: 900, charAspect: 0.6 });
  assert.equal(laptop.cols, 260);
  assert.ok(laptop.cols * laptop.rows <= 260 * 100);
});

test('layout: desktop fits the whole disk, phone lets it run off the sides', () => {
  const extent = PARAMS.ROUT + 0.6;
  const laptop = layout({ width: 1440, height: 900, charAspect: 0.6 });
  assert.ok(extent * laptop.R <= (laptop.cols * laptop.charAspect) / 2, 'desktop disk fits');
  const phone = layout({ width: 390, height: 844, charAspect: 0.6 });
  assert.equal(phone.fontSize, 7);
  assert.ok(phone.cols < 260);
  assert.ok(extent * phone.R > (phone.cols * phone.charAspect) / 2, 'phone disk runs off the sides');
});

test('renderFrame returns rows x cols characters from the ramp', () => {
  const bh = createBlackHole();
  const grid = { cols: 80, rows: 30, charAspect: 0.6, R: 5 };
  const lines = renderFrame(bh, grid, 1.5).split('\n');
  assert.equal(lines.length, 30);
  for (const line of lines) {
    assert.equal(line.length, 80);
    for (const ch of line) assert.ok(RAMP.includes(ch), `unexpected char ${ch}`);
  }
});

test('charFor clamps to the ramp ends', () => {
  assert.equal(charFor(-1), ' ');
  assert.equal(charFor(0), ' ');
  assert.equal(charFor(1), '@');
  assert.equal(charFor(5), '@');
});

test('loop mode: last frame flows into the first', () => {
  const bh = createBlackHole({ loop: true });
  const grid = { cols: 96, rows: 26, charAspect: 0.6, R: 5.8 };
  assert.equal(renderFrame(bh, grid, bh.loopSeconds), renderFrame(bh, grid, 0));
  assert.notEqual(renderFrame(bh, grid, bh.loopSeconds / 2), renderFrame(bh, grid, 0));
  for (const w of bh.hotspotOmegas) {
    const turns = (w * bh.loopSeconds) / TAU;
    assert.ok(Math.abs(turns - Math.round(turns)) < 1e-9, 'hot spots complete whole turns per loop');
  }
});

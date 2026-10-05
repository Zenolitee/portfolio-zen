import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFrame3d, escAt, BC, STARLESS, DEFAULT_VIEW } from '../js/blackhole.js';
import { createBlackHole, layout } from '../js/blackhole-core.js';

const grid = layout({ width: 1440, height: 900, charAspect: 0.6 });
const cells = frame => frame.split('\n').flatMap((line, j) => [...line].map((c, i) => ({ c, i, j })));
// screen distance from the centre, in M (the frame's zoom depends on the view)
const bOf = ({ i, j }, incl) => {
  const zoom = BC * (1 + 0.3 * Math.abs(Math.cos(incl)));
  return Math.hypot((i - grid.cols / 2 + 0.5) * grid.charAspect, j - grid.rows / 2 + 0.5) / grid.R * zoom;
};

test('rays inside the critical impact parameter fall in; just outside, they escape', () => {
  assert.ok(Number.isNaN(escAt(BC * 0.99)), 'inside BC is captured');
  assert.ok(Number.isFinite(escAt(BC * 1.01)), 'outside BC escapes');
  assert.ok(escAt(BC * 1.01) > escAt(BC * 1.5), 'rays closer in are bent further');
});

test('far from the hole, bending matches the Schwarzschild series 4/b + 15pi/4b^2 + 128/3b^3', () => {
  for (const b of [12, 15, 20]) {
    const bend = escAt(b) - Math.PI, series = 4 / b + 15 * Math.PI / 4 / b ** 2 + 128 / 3 / b ** 3;
    assert.ok(Math.abs(bend - series) / series < 0.03, `b = ${b}: bent ${bend.toFixed(4)}, series ${series.toFixed(4)}`);
  }
});

test('the shadow is black: only the disk in front of it is ever drawn there', () => {
  // seen from well above or below, nothing is in front of the shadow
  const bh = createBlackHole({ hotspots: false });
  for (const incl of [0.15, 0.3, Math.PI - 0.3, Math.PI - 0.15]) {
    const drawn = cells(renderFrame3d(bh, grid, 0, { incl, az: 0 })).filter(cell => cell.c !== ' ' && bOf(cell, incl) < BC * 0.9);
    assert.equal(drawn.length, 0, `incl ${incl.toFixed(2)}: ${drawn.length} cells drawn in the shadow`);
  }
  // edge-on, with no disk, nothing else (stars, ring) leaks into it
  const noDisk = { disk: () => 0, twinkle: () => 0.2 };
  for (const incl of [DEFAULT_VIEW.incl, Math.PI / 2]) {
    const drawn = cells(renderFrame3d(noDisk, grid, 0, { incl, az: 0 })).filter(cell => cell.c !== ' ' && bOf(cell, incl) < BC * 0.9);
    assert.equal(drawn.length, 0, `incl ${incl.toFixed(2)}: ${drawn.length} cells drawn in the shadow`);
  }
});

test('no stars inside the starless zone', () => {
  // stars are the cells that light up when they twinkle (the photon ring is there either way)
  const lit = { disk: () => 0, twinkle: () => 0.2 }, dark = { disk: () => 0, twinkle: () => 0 };
  for (const incl of [0.3, DEFAULT_VIEW.incl, 2.4]) {
    const off = renderFrame3d(dark, grid, 0, { incl, az: 0.7 }).replaceAll('\n', '');
    const stars = cells(renderFrame3d(lit, grid, 0, { incl, az: 0.7 })).filter((cell, k) => cell.c !== ' ' && off[k] === ' ');
    assert.ok(stars.length > 0, 'some stars are drawn');
    const inside = stars.filter(cell => bOf(cell, incl) <= STARLESS * 0.98);
    assert.equal(inside.length, 0, `incl ${incl.toFixed(2)}: ${inside.length} stars inside`);
  }
});

test('viewed from below, the hole is the mirror image of the view from above', () => {
  // a disk with no texture (brightness by radius only) and no Doppler, so only geometry differs
  const plain = { disk: rho => (rho > 1.4 && rho < 4.5 ? 1 / rho : 0), twinkle: () => 0 };
  const above = renderFrame3d(plain, grid, 0, { incl: 1.2, az: 0, doppler: 0 }).split('\n');
  const below = renderFrame3d(plain, grid, 0, { incl: Math.PI - 1.2, az: 0, doppler: 0 }).split('\n').reverse();
  let diff = 0;
  above.forEach((line, j) => { for (let i = 0; i < line.length; i++) if (line[i] !== below[j][i]) diff++; });
  assert.ok(diff / (grid.cols * grid.rows) < 0.005, `${diff} cells differ`);
});

test('the side spinning toward the camera is brighter with Doppler on', () => {
  const plain = { disk: rho => (rho > 1.4 && rho < 4.5 ? 1 / rho : 0), twinkle: () => 0 };
  const weight = (frame, side) => cells(frame)
    .filter(({ i }) => (side < 0 ? i < grid.cols / 2 : i >= grid.cols / 2))
    .reduce((s, { c }) => s + ' .·:-=+*#%@'.indexOf(c), 0);
  const frame = renderFrame3d(plain, grid, 0, { ...DEFAULT_VIEW, doppler: 4 });
  assert.ok(weight(frame, -1) > weight(frame, 1) * 1.2, 'left (approaching) side is brighter');
  const flat = renderFrame3d(plain, grid, 0, { ...DEFAULT_VIEW, doppler: 0 });
  assert.ok(Math.abs(weight(flat, -1) - weight(flat, 1)) < weight(flat, 1) * 0.05, 'symmetric without Doppler');
});

test('a still view reuses its geometry: same frame, and much faster than a fresh view', () => {
  const bh = createBlackHole();
  const t0 = performance.now(); const a = renderFrame3d(bh, grid, 1, { incl: 1.3, az: 0.4 }); const fresh = performance.now() - t0;
  const t1 = performance.now(); const b = renderFrame3d(bh, grid, 1, { incl: 1.3, az: 0.4 }); const cached = performance.now() - t1;
  assert.equal(a, b);
  assert.ok(cached < fresh, `cached ${cached.toFixed(1)} ms vs fresh ${fresh.toFixed(1)} ms`);
});

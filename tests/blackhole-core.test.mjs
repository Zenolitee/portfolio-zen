import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlackHole, layout, charFor, PARAMS } from '../js/blackhole-core.js';

const TAU = Math.PI * 2;

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

test('layout caps the grid at 380 columns and grows the font instead', () => {
  const huge = layout({ width: 10000, height: 6000, charAspect: 0.6 });
  assert.equal(huge.cols, 380);
  assert.ok(huge.fontSize > 40);
  const laptop = layout({ width: 1440, height: 900, charAspect: 0.6 });
  assert.equal(laptop.cols, 380);
  assert.ok(laptop.fontSize < 7, 'laptop characters are under 7px');
  assert.ok(laptop.cols * laptop.rows <= 380 * 145);
});

test('layout: desktop fits the whole disk, phone lets it run off the sides', () => {
  const extent = PARAMS.ROUT + 0.6;
  const laptop = layout({ width: 1440, height: 900, charAspect: 0.6 });
  assert.ok(extent * laptop.R <= (laptop.cols * laptop.charAspect) / 2, 'desktop disk fits');
  const phone = layout({ width: 390, height: 844, charAspect: 0.6 });
  assert.equal(phone.fontSize, 5);
  assert.ok(phone.cols < 260);
  assert.ok(extent * phone.R > (phone.cols * phone.charAspect) / 2, 'phone disk runs off the sides');
});

test('charFor clamps to the ramp ends', () => {
  assert.equal(charFor(-1), ' ');
  assert.equal(charFor(0), ' ');
  assert.equal(charFor(1), '@');
  assert.equal(charFor(5), '@');
});

test('loop mode: last frame flows into the first', () => {
  const bh = createBlackHole({ loop: true });
  assert.equal(bh.disk(2.5, 1, bh.loopSeconds), bh.disk(2.5, 1, 0));
  assert.notEqual(bh.disk(2.5, 1, bh.loopSeconds / 2), bh.disk(2.5, 1, 0));
  for (const w of bh.hotspotOmegas) {
    const turns = (w * bh.loopSeconds) / TAU;
    assert.ok(Math.abs(turns - Math.round(turns)) < 1e-9, 'hot spots complete whole turns per loop');
  }
});

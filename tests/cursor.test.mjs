import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orbitPoint, fallRadius, angularSpeed, TILT } from '../js/cursor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('orbit is a tilted ellipse; the far (upper) half is behind the hole', () => {
  for (let t = 0; t < 2 * Math.PI; t += 0.1) {
    const p = orbitPoint(t, 100, 100, 50, TILT);
    assert.ok(Math.abs(p.x - 100) <= 50 + 1e-9);
    assert.ok(Math.abs(p.y - 100) <= 50 * TILT + 1e-9);
    assert.equal(p.behind, p.y < 100 - 1e-9);
  }
});

test('falling radius starts at r0, ends at r1, and speeds up near the end', () => {
  assert.equal(fallRadius(0, 400, 80), 400);
  assert.equal(fallRadius(1, 400, 80), 80);
  const early = fallRadius(0, 400, 80) - fallRadius(0.1, 400, 80);
  const late = fallRadius(0.9, 400, 80) - fallRadius(1, 400, 80);
  assert.ok(late > early);
});

test('angular speed grows as the radius shrinks, capped at 4x', () => {
  assert.ok(angularSpeed(100, 80, 1) < angularSpeed(80, 80, 1));
  assert.equal(angularSpeed(80, 80, 1), 1);
  assert.equal(angularSpeed(1, 80, 1), 4);
});

test('every page loads the cursor script', () => {
  const pages = [
    ...readdirSync(root).filter(f => f.endsWith('.html')),
    ...readdirSync(join(root, 'projects')).filter(f => f.endsWith('.html')).map(f => `projects/${f}`),
    ...readdirSync(join(root, '_templates')).map(f => `_templates/${f}`),
  ];
  for (const page of pages) assert.match(readFileSync(join(root, page), 'utf8'), /<script type="module" src="[^"]*js\/cursor\.js"><\/script>/, page);
});

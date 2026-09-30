import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snap, CELL } from '../js/trail.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('pointer positions snap to the 20px trail grid', () => {
  assert.equal(CELL, 20);
  assert.deepEqual([0, 19.9, 20, 47, 399].map(snap), [0, 0, 20, 40, 380]);
});

test('the home page opts into the trail, except over the name and copyright', () => {
  const home = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(home, /<main class="landing" data-trail>/);
  assert.match(home, /<script type="module" src="js\/trail\.js"><\/script>/);
  assert.match(home, /<p class="identity" data-trail-ignore>/);
  assert.match(home, /<p class="copyright" data-trail-ignore>/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrap, panelFromHash, tiltFor } from '../js/stage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const page = read('projects/index.html');
const css = read('css/style.css');

test('projects page lists Athena, Seer, ReliCore, AgentPresence and asciify-ps, in that order', () => {
  const titles = [...page.matchAll(/<h2 class="stage-title">([^<]+)<\/h2>/g)].map(m => m[1]);
  assert.deepEqual(titles, ['Athena', 'Seer', 'ReliCore', 'AgentPresence', 'asciify-ps']);
});

test('every tab controls a panel that points back at it; only the first starts selected', () => {
  const tabs = [...page.matchAll(/<button class="stage-tab[^"]*" role="tab" id="([^"]+)" aria-controls="([^"]+)" aria-selected="(true|false)"/g)];
  assert.equal(tabs.length, 5);
  tabs.forEach(([, tabId, panelId, selected], i) => {
    assert.match(page, new RegExp(`<section class="stage-panel" id="${panelId}" role="tabpanel" aria-labelledby="${tabId}"`));
    assert.equal(selected, i === 0 ? 'true' : 'false');
  });
});

test('Athena and Seer link to their live sites; every screenshot exists and has alt text', () => {
  assert.match(page, /href="https:\/\/athenabdo\.com\/"/);
  assert.match(page, /href="https:\/\/seer\.athenabdo\.com\/"/);
  for (const [img, src] of page.matchAll(/<img src="\.\.\/([^"]+)"[^>]*>/g)) {
    assert.ok(existsSync(join(root, src)), `missing ${src}`);
    assert.match(img, /alt="[^"]+"/, img);
  }
});

test('without JS every panel shows; hidden panels really hide; reduced motion stops animation', () => {
  assert.match(css, /\.stage:not\(\.is-enhanced\) \.stage-panel \+ \.stage-panel/);
  assert.match(css, /\.stage-panel\[hidden\] \{ display: none; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^}]*animation: none !important/);
});

test('wrap goes round both ends', () => {
  assert.equal(wrap(5, 5), 0);
  assert.equal(wrap(-1, 5), 4);
  assert.equal(wrap(2, 5), 2);
});

test('the URL hash picks a panel, and anything else falls back to the first', () => {
  const ids = ['athena', 'seer', 'relicore'];
  assert.equal(panelFromHash('#seer', ids), 'seer');
  assert.equal(panelFromHash('', ids), 'athena');
  assert.equal(panelFromHash('#nope', ids), 'athena');
});

test('tilt is flat in the middle, capped at the edges, and leans toward the pointer', () => {
  assert.deepEqual(tiltFor(50, 50, 100, 100), { rx: 0, ry: 0 });
  assert.deepEqual(tiltFor(100, 0, 100, 100, 5), { rx: 5, ry: 5 });
  assert.deepEqual(tiltFor(500, -500, 100, 100, 5), { rx: 5, ry: 5 });
  assert.equal(tiltFor(0, 50, 100, 100, 5).ry, -5);
});

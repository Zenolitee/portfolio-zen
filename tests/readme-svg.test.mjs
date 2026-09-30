import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFrames, buildSvg, README_GRID, FRAMES } from '../tools/render-readme-svg.mjs';
import { RAMP } from '../js/blackhole-core.js';

const { frames, loopSeconds, stars } = renderFrames();
const svg = buildSvg(frames, loopSeconds, README_GRID, stars);

test('renders FRAMES frames of README_GRID size using only ramp characters', () => {
  assert.equal(frames.length, FRAMES);
  for (const f of frames) {
    const lines = f.split('\n');
    assert.equal(lines.length, README_GRID.rows);
    for (const line of lines) {
      assert.equal(line.length, README_GRID.cols);
      for (const ch of line) assert.ok(RAMP.includes(ch));      // nothing needs XML escaping
    }
  }
});

test('detailed and zoomed out: at least 160 columns, disk spans at most 80% of the width', () => {
  assert.ok(README_GRID.cols >= 160);
  const diskWidth = 2 * 4.9 * README_GRID.R, gridWidth = README_GRID.cols * README_GRID.charAspect;
  assert.ok(diskWidth / gridWidth <= 0.8, `disk fills ${(100 * diskWidth / gridWidth).toFixed(0)}%`);
});

test('stars are drawn once, not in every frame', () => {
  assert.equal(svg.match(/<g class="stars"/g).length, 1);
  assert.ok(stars.replace(/[\s]/g, '').length > 20, 'star layer has stars');
  const starCells = new Set([...stars].map((c, k) => (c.trim() ? k : -1)).filter(k => k >= 0));
  for (const f of frames) for (const k of starCells) assert.equal(f[k], ' ', 'frames leave star cells empty');
});

test('rows are trimmed and blank rows are omitted', () => {
  assert.doesNotMatch(svg, /<text[^>]*> /, 'no leading spaces');
  assert.doesNotMatch(svg, / <\/text>/, 'no trailing spaces');
  assert.doesNotMatch(svg, /<text[^>]*><\/text>/, 'no empty rows');
});

test('svg has one group per frame and a stepped animation', () => {
  assert.equal(svg.match(/<g class="f"/g).length, FRAMES);
  assert.match(svg, /@keyframes s\{/);
  assert.match(svg, new RegExp(`animation:s ${loopSeconds.toFixed(3)}s steps\\(1,end\\) infinite`));
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
});

test('svg stays within the 600 KB budget', () => {
  assert.ok(Buffer.byteLength(svg, 'utf8') < 600_000, `${Buffer.byteLength(svg, 'utf8')} bytes`);
});

test('consecutive frames differ (it actually animates)', () => {
  assert.notEqual(frames[0], frames[1]);
});

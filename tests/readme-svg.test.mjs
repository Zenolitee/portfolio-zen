import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFrames, buildSvg, README_GRID, FRAMES } from '../tools/render-readme-svg.mjs';
import { RAMP } from '../js/blackhole-core.js';

const { frames, loopSeconds } = renderFrames();
const svg = buildSvg(frames, loopSeconds);

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

test('svg has one group per frame, one text row per grid row, and a stepped animation', () => {
  assert.equal(svg.match(/<g class="f"/g).length, FRAMES);
  assert.equal(svg.match(/<text /g).length, FRAMES * README_GRID.rows);
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

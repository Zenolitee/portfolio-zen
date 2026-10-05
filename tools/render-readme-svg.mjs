// Pre-renders the black hole as a seamlessly looping animated SVG for the GitHub
// profile README (GitHub can't run JavaScript). Run: npm run readme-svg
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBlackHole } from '../js/blackhole-core.js';
import { renderFrame3d } from '../js/blackhole.js';

export const README_GRID = Object.freeze({ cols: 340, rows: 84, charAspect: 0.6, R: 11.5 });
export const FRAMES = 90;
const FONT = 12;                                    // px; one cell is 0.6 x 1 font size
const CELL_W = FONT * README_GRID.charAspect;

// Stars are drawn once as a static layer; the animated frames hold only the black hole.
export function renderFrames(n = FRAMES, grid = README_GRID) {
  const bh = createBlackHole({ loop: true });
  const dt = bh.loopSeconds / n;
  const hole = { ...bh, twinkle: () => 0 };
  const frames = Array.from({ length: n }, (_, k) => renderFrame3d(hole, grid, k * dt));
  // no star where the black hole ever draws, or the two layers would overlap
  const stars = [...renderFrame3d({ disk: () => 0, twinkle: () => 0.14 }, grid, 0)]
    .map((c, k) => (c !== '\n' && frames.some(f => f[k] !== ' ') ? ' ' : c)).join('');
  return { frames, stars, loopSeconds: bh.loopSeconds };
}

// one <text> per non-blank row, trimmed and placed at its first character
function rowsOf(text, pad) {
  return text.split('\n').map((line, j) => {
    const body = line.trim();
    if (!body) return '';
    const x = pad + (line.length - line.trimStart().length) * CELL_W;
    return `<text x="${x.toFixed(1)}" y="${pad + (j + 0.85) * FONT}" textLength="${(body.length * CELL_W).toFixed(1)}">${body}</text>`;
  }).join('');
}

export function buildSvg(frames, loopSeconds, grid = README_GRID, stars = '') {
  const pad = 14;
  const textW = grid.cols * CELL_W;
  const W = textW + pad * 2, H = grid.rows * FONT + pad * 2;
  const step = loopSeconds / frames.length;
  const showFor = (100 / frames.length).toFixed(4);
  const groups = frames.map((frame, k) => `<g class="f" style="animation-delay:${(k * step).toFixed(3)}s">${rowsOf(frame, pad)}</g>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xml:space="preserve" role="img" aria-label="Animated ASCII black hole">`,
    `<defs><radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${H / 2}" r="${W * 0.45}">`,
    '<stop offset="0" stop-color="#fff1d6"/><stop offset=".2" stop-color="#ffd9a0"/><stop offset=".45" stop-color="#f0dcc0"/>',
    '<stop offset=".75" stop-color="#bdb6a8"/><stop offset="1" stop-color="#6f6b63"/></radialGradient></defs>',
    '<style>',
    `text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:${FONT}px;white-space:pre;fill:url(#glow)}`,
    `.f{visibility:hidden;animation:s ${loopSeconds.toFixed(3)}s steps(1,end) infinite}`,
    `@keyframes s{0%{visibility:visible}${showFor}%,100%{visibility:hidden}}`,
    '</style>',
    `<rect width="${W}" height="${H}" rx="12" fill="#0b0b0c"/>`,
    `<g class="stars">${rowsOf(stars, pad)}</g>`,
    ...groups,
    '</svg>',
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/readme/blackhole.svg');
  const { frames, loopSeconds, stars } = renderFrames();
  const svg = buildSvg(frames, loopSeconds, README_GRID, stars);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg);
  const kb = (Buffer.byteLength(svg, 'utf8') / 1024).toFixed(0);
  console.log(`wrote ${out} (${kb} KB, ${frames.length} frames, ${loopSeconds.toFixed(2)} s loop)`);
}

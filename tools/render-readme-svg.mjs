// Pre-renders the black hole as a seamlessly looping animated SVG for the GitHub
// profile README (GitHub can't run JavaScript). Run: npm run readme-svg
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBlackHole, renderFrame } from '../js/blackhole-core.js';

export const README_GRID = Object.freeze({ cols: 96, rows: 26, charAspect: 0.6, R: 5.8 });
export const FRAMES = 90;
const FONT = 12;                                    // px; one cell is 0.6 x 1 font size
const CELL_W = FONT * README_GRID.charAspect;

export function renderFrames(n = FRAMES, grid = README_GRID) {
  const bh = createBlackHole({ loop: true });
  const dt = bh.loopSeconds / n;
  return {
    frames: Array.from({ length: n }, (_, k) => renderFrame(bh, grid, k * dt)),
    loopSeconds: bh.loopSeconds,
  };
}

export function buildSvg(frames, loopSeconds, grid = README_GRID) {
  const pad = 14;
  const textW = grid.cols * CELL_W;
  const W = textW + pad * 2, H = grid.rows * FONT + pad * 2;
  const step = loopSeconds / frames.length;
  const showFor = (100 / frames.length).toFixed(4);
  const groups = frames.map((frame, k) => {
    const rows = frame.split('\n')
      .map((line, j) => `<text x="${pad}" y="${pad + (j + 0.85) * FONT}" textLength="${textW}">${line}</text>`)
      .join('');
    return `<g class="f" style="animation-delay:${(k * step).toFixed(3)}s">${rows}</g>`;
  });
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
    ...groups,
    '</svg>',
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/readme/blackhole.svg');
  const { frames, loopSeconds } = renderFrames();
  const svg = buildSvg(frames, loopSeconds);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg);
  const kb = (Buffer.byteLength(svg, 'utf8') / 1024).toFixed(0);
  console.log(`wrote ${out} (${kb} KB, ${frames.length} frames, ${loopSeconds.toFixed(2)} s loop)`);
}

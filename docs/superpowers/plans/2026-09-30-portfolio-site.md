# Portfolio Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dark, typographic portfolio (live ASCII black hole home, clean inner pages, image-grid Projects) plus a pre-rendered black hole SVG for the GitHub profile README.

**Architecture:** Plain multi-page static site. The black hole is split into a pure ES module (`js/blackhole-core.js`, no DOM — unit-tested in Node and reused by the README generator) and a thin DOM mount (`js/blackhole.js`). Content pages are hand-written HTML sharing one stylesheet; Node scripts (no dependencies) check links and generate the README SVG.

**Tech Stack:** HTML, CSS, vanilla JS (ES modules), Node 22 (`node --test`, no npm dependencies), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-30-portfolio-design.md`

**Convention:** every code block is preceded by `**File:** \`path\`` and holds that file's **complete** content.

## Global Constraints

- No frameworks, no build step for the site, no npm dependencies; system fonts only.
- Tokens: `--bg #0b0b0c`, `--ink #e8e6e1`, `--muted #807d75`, `--line #26262a`, `--accent #f0a45a`.
- Inner-page column: `width: min(100% - 32px, 860px)`; breakpoint 620px; 16px phone gutter; no horizontal scroll at any width.
- Black hole: `TILT 0.12`, disk 1.4–4.3, rigid texture at ω(2.0), Keplerian speed only in hot spots, grid ≤ 260 columns, box |x| < 5.0, |y| < 2.0, 30 fps cap, ≤ 10 ms/frame at 260×90, pause when hidden/off-screen, still frame for reduced motion.
- Internal links relative (site lives at `https://zenolitee.github.io/portfolio-zen/`); only `404.html` uses absolute `/portfolio-zen/…` paths.
- Content must be factual: projects are the owner's own repos (NW-Helper, AgentPresence, asciify-ps, playwright-scout), described only from their READMEs/descriptions. No email published.
- Work on branch `feat/site`; PR into `main`. Commit messages end with the Co-Authored-By line.

## Review Focus

1. **Deep link / 404 on the Pages sub-path** — a missing nested URL (`/portfolio-zen/projects/nope.html`) must render a styled 404 with working links → `404.html` uses absolute base paths; link checker understands the base (Task 3 test).
2. **Project image missing or slow** — card keeps its 16:10 box and shows alt text, grid doesn't collapse (Task 3 browser check).
3. **Phone portrait 320px and landscape 844×390** — no horizontal scroll; name doesn't collide with corner links (Task 2 browser check).
4. **Reduced motion / hidden tab / scrolled away** — animation loop stops, one still frame shows (Task 2: `isRunning()` false under emulated reduced motion).
5. **Zoomed out / 4K screens** — cost stays constant (Task 1 `layout` cap tests + Task 5 timing at 3× viewport).

---

### Task 1: Tooling + pure black hole core

**Files:**
- Create: `package.json`, `js/blackhole-core.js`, `tests/blackhole-core.test.mjs`
- Modify: `docs/superpowers/specs/2026-09-30-portfolio-design.md` (record core/mount split, README card background, seed content)

**Interfaces:**
- Produces (from `js/blackhole-core.js`):
  - `RAMP: string` (`' .·:-=+*#%@'`), `PARAMS` (frozen: `RS, RIN, ROUT, TILT, GAIN, SPIN, RREF, BOX_X, BOX_Y, STAR_DENSITY`)
  - `createBlackHole({ loop?: boolean = false, hotspots?: boolean = true }) → { shade(x, y, t): number, disk(rho, phi, t): number, twinkle(s, t): number, textureOmega: number, loopSeconds: number, hotspotOmegas: number[] }`
  - `layout({ width, height, charAspect, maxCols = 260, minFont = 7 }) → { fontSize, cols, rows, R, charAspect }`
  - `renderFrame(bh, { cols, rows, charAspect, R }, t) → string` (rows joined by `\n`, each exactly `cols` chars)
  - `charFor(v: number) → string`, `starAt(i, j) → number` (0 or star seed in (0,1])

- [ ] **Step 1: Write the failing tests**

**File:** `package.json`
```json
{
  "name": "portfolio-zen",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "readme-svg": "node tools/render-readme-svg.mjs",
    "check-links": "node tools/check-links.mjs"
  }
}
```

**File:** `tests/blackhole-core.test.mjs`
```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/blackhole-core.js'`.

- [ ] **Step 3: Implement the core**

**File:** `js/blackhole-core.js`
```js
// Pure ASCII black hole renderer: no DOM. Shared by the site (js/blackhole.js) and the
// README generator (tools/render-readme-svg.mjs). Screen units: shadow radius = 1,
// x to the right, y downward.

export const RAMP = ' .·:-=+*#%@';

export const PARAMS = Object.freeze({
  RS: 1.0,             // shadow radius
  RIN: 1.4,            // accretion disk inner edge
  ROUT: 4.3,           // outer edge (fades out over a further 0.6)
  TILT: 0.12,          // disk seen nearly edge-on
  GAIN: 1.9,
  SPIN: 2.0,           // Keplerian scale: omega(rho) = SPIN * rho^-1.5
  RREF: 2.0,           // the disk texture turns rigidly at omega(RREF)
  BOX_X: 5.0,          // everything drawn lies inside |x| < BOX_X, |y| < BOX_Y
  BOX_Y: 2.0,
  STAR_DENSITY: 0.012,
});

// bright clumps orbiting at fixed radii: [radius, starting angle, strength]
const HOTSPOTS = [[1.7, 0.4, 1.0], [2.3, 2.6, 0.8], [3.0, 4.4, 0.6], [2.0, 5.3, 0.7]];
const TAU = Math.PI * 2;

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// value noise that wraps every P cells in y, so texture is seamless around the orbit
function pnoise(x, y, P) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const y0 = ((yi % P) + P) % P, y1 = (y0 + 1) % P;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, y0), b = hash(xi + 1, y0), c = hash(xi, y1), d = hash(xi + 1, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function createBlackHole({ loop = false, hotspots = true } = {}) {
  const { RS, RIN, ROUT, TILT, SPIN, RREF, BOX_X, BOX_Y } = PARAMS;
  const textureOmega = SPIN * Math.pow(RREF, -1.5);
  const loopSeconds = TAU / textureOmega;
  // In loop mode every periodic motion completes a whole number of turns per loop,
  // so the last frame flows into the first.
  const quantize = w => (loop ? (TAU * Math.max(1, Math.round((w * loopSeconds) / TAU))) / loopSeconds : w);
  const wrap = t => (loop ? ((t % loopSeconds) + loopSeconds) % loopSeconds : t);
  const spots = hotspots
    ? HOTSPOTS.map(([r, a0, s]) => ({ r, a0, s, w: quantize(SPIN * Math.pow(r, -1.5)) }))
    : [];

  // emission of the disk at radius rho and orbital angle phi (material moves toward -phi)
  function disk(rho, phi, t) {
    if (rho < RIN - 0.25 || rho > ROUT + 0.6) return 0;
    const base = Math.pow(RIN / rho, 1.6) * smooth(RIN - 0.25, RIN + 0.15, rho) * (1 - smooth(ROUT - 1.2, ROUT + 0.6, rho));
    // The texture turns rigidly. Per-radius speed would shear clumps into slanted streaks,
    // which read as motion across the orbit (barber-pole) and make the edge-on sides seem
    // to spread outward. Keplerian speed lives only in the round hot spots.
    const u = ((((phi + t * textureOmega) / TAU) % 1) + 1) % 1;
    const n = 0.65 * pnoise(rho * 4, u * 36, 36) + 0.35 * pnoise(rho * 8.5, u * 72, 72);
    let e = base * (0.15 + 1.35 * n * n * 2.6);
    for (const s of spots) {
      const a = phi + t * s.w - s.a0;
      const da = Math.atan2(Math.sin(a), Math.cos(a)) * s.r;   // arc distance along the orbit
      e += s.s * Math.exp(-(da * da) / 0.35 - ((rho - s.r) ** 2) / 0.02);
    }
    return e;
  }

  // brightness at screen point (x, y), before GAIN and stars
  function shade(x, y, time) {
    if (Math.abs(x) >= BOX_X || Math.abs(y) >= BOX_Y) return 0;
    const t = wrap(time), r = Math.hypot(x, y);
    let v = 0;

    // lensed image of the far disk: arc over the top (strong) and under the bottom (thin)
    if (r > RS) {
      const top = y < 0;
      const rh = RIN + (r - RS * 1.04) * (top ? 4.2 : 6.0);
      const w = top ? 0.45 + 0.55 * smooth(0.1, -0.9, y / r) : 0.45 * smooth(0.2, 0.95, y / r);
      const dop = 1 + 0.45 * (-x / r);
      v += disk(rh, Math.atan2(y, x), t) * w * dop * 1.15;
    }

    // photon ring
    v += 1.1 * Math.exp(-Math.pow((r - RS * 1.035) / 0.03, 2));

    // flat disk seen nearly edge-on; its far half is hidden inside the shadow
    const dy = y / TILT, rho = Math.hypot(x, dy);
    if (!(y < 0 && r < RS)) {
      const dop = 1 + 0.6 * (-x / rho);                        // approaching (left) side brighter
      const wisp = 1 - 0.55 * smooth(2.0, ROUT, rho);          // outer disk thins into streaks
      v += disk(rho, Math.atan2(dy, x), t) * dop * wisp * (y > 0 ? 1.5 : 1.1);
    }

    // the shadow swallows everything behind it
    if (r < RS * 0.985 && !(y > 0 && rho < ROUT + 0.6 && rho > RIN - 0.25)) v = 0;
    return v;
  }

  function twinkle(s, time) {
    return 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(wrap(time) * quantize(1 + s * 3) + s * 40));
  }

  return {
    shade,
    disk: (rho, phi, t) => disk(rho, phi, wrap(t)),
    twinkle,
    textureOmega,
    loopSeconds,
    hotspotOmegas: spots.map(s => s.w),
  };
}

// sparse deterministic star field on the character grid
export function starAt(i, j) {
  const h = hash(i * 0.731 + 11.3, j * 1.379 + 5.1);
  return h < PARAMS.STAR_DENSITY ? h / PARAMS.STAR_DENSITY + 1e-6 : 0;
}

export function charFor(v) {
  const c = Math.min(1, Math.max(0, v));
  return RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(c, 0.7) * RAMP.length))];
}

// Cost is per character, so the grid is capped: past maxCols the font grows instead
// (zooming out shows bigger characters, not more of them).
export function layout({ width, height, charAspect, maxCols = 260, minFont = 7 }) {
  const fontSize = Math.max(minFont, width / (maxCols * charAspect));
  const cols = Math.min(maxCols, Math.ceil(width / (fontSize * charAspect)));
  const rows = Math.ceil(height / fontSize);
  const narrow = width < 620;                                   // phones: bigger, runs off the sides
  const R = Math.min(cols * charAspect * (narrow ? 0.17 : 0.095), rows * 0.15);
  return { fontSize, cols, rows, R, charAspect };
}

export function renderFrame(bh, { cols, rows, charAspect, R }, t) {
  const cx = cols / 2, cy = rows / 2, lines = new Array(rows);
  for (let j = 0; j < rows; j++) {
    const y = (j - cy + 0.5) / R;
    let line = '';
    for (let i = 0; i < cols; i++) {
      const x = ((i - cx + 0.5) * charAspect) / R;
      let v = bh.shade(x, y, t) * PARAMS.GAIN;
      if (v < 0.05) {
        const s = starAt(i, j);
        if (s) v = bh.twinkle(s, t);                           // after GAIN so stars stay faint
      }
      line += charFor(v);
    }
    lines[j] = line;
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 9 passing, 0 failing.

- [ ] **Step 5: Record decisions in the spec**

Edit the spec: §3 lists `js/blackhole-core.js` (pure core) + `js/blackhole.js` (DOM mount); §7 README SVG has its own dark rounded background (light text can't read on GitHub's light theme); §4 seed projects are NW-Helper, AgentPresence, asciify-ps, playwright-scout; Notes starts empty; Contact lists GitHub only until the owner adds email/LinkedIn.

- [ ] **Step 6: Commit**

```bash
git add package.json js/blackhole-core.js tests/blackhole-core.test.mjs docs/superpowers/specs/2026-09-30-portfolio-design.md
git commit -m "feat: pure black hole renderer core with tests"
```

---

### Task 2: Stylesheet, DOM mount and home page

**Files:**
- Create: `css/style.css`, `js/blackhole.js`, `index.html`, `assets/favicon.svg`

**Interfaces:**
- Consumes: `createBlackHole`, `layout`, `renderFrame` from `js/blackhole-core.js`.
- Produces: `mount(pre) → { isRunning(): boolean, draw(): void }` (auto-mounts `#blackhole`, exposed as `window.blackhole` for checks); CSS classes used by all pages: `.page`, `.page-nav`, `.page-title`, `.lead`, `.meta-list`, `.site-footer`, `.project-grid`, `.card`, `.frame`, `.card-head`, `.card-year`, `.detail-title`, `.detail-summary`, `.detail-hero`, `.prose`, `.image-pair`, `.back-link`, `.note-list`, `.empty`, `.visually-hidden`.

- [ ] **Step 1: Write the stylesheet**

**File:** `css/style.css`
```css
:root {
  --bg: #0b0b0c;
  --ink: #e8e6e1;
  --muted: #807d75;
  --line: #26262a;
  --accent: #f0a45a;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color-scheme: dark;
}

* { box-sizing: border-box; }

html { background: var(--bg); }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: var(--accent); }
:focus-visible { outline: 1px solid var(--accent); outline-offset: 4px; }
img { display: block; max-width: 100%; height: auto; }

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---------- home ---------- */

.landing { position: relative; height: 100vh; height: 100svh; overflow: hidden; }

.blackhole {
  position: absolute;
  inset: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--mono);
  line-height: 1;
  white-space: pre;
  user-select: none;
  pointer-events: none;
  background: radial-gradient(ellipse 38% 30% at 50% 50%, #fff1d6 0%, #ffd9a0 20%, #f0dcc0 38%, #bdb6a8 62%, #6f6b63 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.corner {
  position: absolute;
  z-index: 2;
  font-family: var(--mono);
  font-size: clamp(11px, 0.9vw, 14px);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 0.18s ease, transform 0.18s ease;
}
.corner span { margin-left: 0.6em; letter-spacing: 0; }
.corner:hover { transform: translateY(-2px); }
.corner:focus-visible { outline-offset: 8px; }
.corner--tl { top: 6vh; left: 3.3vw; }
.corner--tr { top: 6vh; right: 3.4vw; }
.corner--bl { bottom: 7vh; left: 3.3vw; }
.corner--br { bottom: 7vh; right: 3.4vw; }

.identity,
.copyright {
  position: absolute;
  z-index: 2;
  left: 50%;
  margin: 0;
  font-family: var(--mono);
  white-space: nowrap;
  transform: translateX(-50%);
}
.identity { top: 6vh; font-size: clamp(9px, 0.74vw, 12px); font-weight: 600; letter-spacing: 0.43em; text-transform: uppercase; }
.copyright { bottom: 7vh; font-size: 9px; letter-spacing: 0.08em; color: var(--muted); }

/* ---------- inner pages ---------- */

.page { width: min(100% - 32px, 860px); margin: 0 auto; padding: 52px 0 96px; }

.page-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.page-nav a { color: var(--muted); text-decoration: none; }
.page-nav a:hover,
.page-nav a[aria-current="page"] { color: var(--ink); }

.page-title { margin: 72px 0 32px; font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }

.lead p { max-width: 620px; margin: 0 0 16px; font-size: clamp(18px, 2.6vw, 24px); line-height: 1.45; }

.meta-list { display: grid; grid-template-columns: max-content 1fr; gap: 4px 24px; margin: 40px 0 0; font-size: 13px; }
.meta-list dt { color: var(--muted); }
.meta-list dd { margin: 0; }

.site-footer {
  margin-top: 96px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.site-footer p { margin: 0; }

/* ---------- projects grid ---------- */

.project-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 44px 28px; margin: 0; padding: 0; list-style: none; }
.card { display: block; text-decoration: none; }
.card:hover { color: inherit; }
.frame {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid var(--line);
  background: #111113;
  color: var(--muted);
  font-size: 12px;
  transition: transform 0.25s ease, border-color 0.25s ease;
}
.frame img { width: 100%; height: 100%; object-fit: cover; }
.card:hover .frame,
.card:focus-visible .frame { transform: translateY(-3px); border-color: #3a3a40; }
.card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-top: 14px; }
.card-head h2 { margin: 0; font-size: 17px; font-weight: 500; letter-spacing: -0.015em; transition: color 0.18s ease; }
.card:hover h2 { color: var(--accent); }
.card-year { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--muted); }
.card p { margin: 4px 0 0; color: var(--muted); font-size: 14px; }

/* ---------- project detail ---------- */

.detail-title { margin: 72px 0 6px; font-size: clamp(30px, 5vw, 48px); font-weight: 500; letter-spacing: -0.04em; line-height: 1.1; }
.detail-summary { margin: 0; color: var(--muted); font-size: 18px; }
.detail-hero { margin: 44px 0; aspect-ratio: 16 / 9; }
.prose p,
.prose li { max-width: 680px; }
.prose p { margin: 0 0 16px; }
.prose h2 { margin: 44px 0 16px; font-size: 20px; font-weight: 500; letter-spacing: -0.015em; }
.prose ul { margin: 0 0 16px; padding-left: 1.2em; }
.image-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin: 32px 0; }
.back-link { display: inline-block; margin-top: 56px; font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; color: var(--muted); }

/* ---------- notes ---------- */

.note-list { margin: 0; padding: 0; list-style: none; }
.note-list li { padding: 20px 0; border-top: 1px solid var(--line); }
.note-list time { display: block; font-family: var(--mono); font-size: 11px; color: var(--muted); }
.empty { color: var(--muted); }

/* ---------- small screens ---------- */

@media (max-width: 620px) {
  .project-grid,
  .image-pair { grid-template-columns: 1fr; }
  .corner--tl,
  .corner--bl { left: 16px; }
  .corner--tr,
  .corner--br { right: 16px; }
  .identity { top: calc(6vh + 32px); }
  .copyright { bottom: calc(7vh + 32px); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
```

- [ ] **Step 2: Write the DOM mount**

**File:** `js/blackhole.js`
```js
// Mounts the ASCII black hole into a <pre>: sizing, 30 fps loop, pausing.
import { createBlackHole, layout, renderFrame } from './blackhole-core.js';

const FRAME_MS = 1000 / 30;

export function mount(pre) {
  const bh = createBlackHole();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let grid = null, raf = 0, last = -Infinity, onScreen = true, resizeTimer = 0;

  // character width in em for the <pre>'s monospace font
  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(100);
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px';
  pre.appendChild(probe);
  const charAspect = probe.getBoundingClientRect().width / 100 / 100;
  probe.remove();

  const isRunning = () => onScreen && !document.hidden && !reduceMotion.matches;

  function draw() {
    pre.textContent = renderFrame(bh, grid, reduceMotion.matches ? 0 : performance.now() / 1000);
  }

  function resize() {
    grid = layout({ width: pre.clientWidth, height: pre.clientHeight, charAspect });
    pre.style.fontSize = `${grid.fontSize}px`;
    draw();
  }

  function tick(now) {
    raf = 0;
    if (!isRunning()) return;
    if (now - last >= FRAME_MS) { last = now; draw(); }
    raf = requestAnimationFrame(tick);
  }

  function update() {
    if (isRunning() && !raf) raf = requestAnimationFrame(tick);
    if (!isRunning() && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  }).observe(pre);
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }).observe(pre);
  document.addEventListener('visibilitychange', update);
  reduceMotion.addEventListener('change', () => { draw(); update(); });

  resize();
  update();
  return { isRunning: () => raf !== 0, draw };
}

const el = document.getElementById('blackhole');
if (el) window.blackhole = mount(el);
```

- [ ] **Step 3: Write the home page and favicon**

**File:** `assets/favicon.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0b0b0c"/>
  <ellipse cx="16" cy="17" rx="14" ry="2.6" fill="#f0a45a" opacity=".8"/>
  <circle cx="16" cy="16" r="7.6" fill="none" stroke="#ffd9a0" stroke-width="1.4"/>
  <circle cx="16" cy="16" r="6.6" fill="#0b0b0c"/>
  <path d="M5 17.6 Q16 20.4 27 17.6" fill="none" stroke="#ffd9a0" stroke-width="1.6"/>
</svg>
```

**File:** `index.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zenolitee</title>
  <meta name="description" content="Zenolitee builds small, sharp tools for the web.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/style.css">
  <script type="module" src="js/blackhole.js"></script>
</head>
<body>
  <main class="landing">
    <h1 class="visually-hidden">Zenolitee — portfolio</h1>
    <pre id="blackhole" class="blackhole" aria-hidden="true"></pre>
    <p class="identity">Zenolitee</p>
    <nav aria-label="Site">
      <a class="corner corner--tl" href="about.html">About<span aria-hidden="true">↗</span></a>
      <a class="corner corner--tr" href="projects/index.html">Projects<span aria-hidden="true">↗</span></a>
      <a class="corner corner--bl" href="notes.html">Notes<span aria-hidden="true">↗</span></a>
      <a class="corner corner--br" href="contact.html">Contact<span aria-hidden="true">↗</span></a>
    </nav>
    <p class="copyright">© 2026 Zenolitee</p>
  </main>
</body>
</html>
```

- [ ] **Step 4: Verify in a browser**

Run: `python -m http.server 8765` in the repo root, open `http://localhost:8765/` with Playwright.
Expected:
- 1440×900 screenshot shows the black hole (thin sides, top arc, photon ring) and four corner links; console has 0 errors.
- `window.blackhole.isRunning()` → `true`; after emulating `prefers-reduced-motion: reduce` and reloading → `false` and the `<pre>` still shows a frame.
- 390×844, 320×568 and 844×390: no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), the identity text's bounding box does not intersect any corner link's box.

- [ ] **Step 5: Commit**

```bash
git add css/style.css js/blackhole.js index.html assets/favicon.svg
git commit -m "feat: home page with live ASCII black hole"
```

---

### Task 3: Inner pages, project showcase and link checker

**Files:**
- Create: `tools/check-links.mjs`, `tests/check-links.test.mjs`, `about.html`, `projects/index.html`, `projects/nw-helper.html`, `projects/agent-presence.html`, `projects/asciify-ps.html`, `projects/playwright-scout.html`, `assets/projects/{nw-helper,agent-presence,asciify-ps,playwright-scout}/cover.svg`, `notes.html`, `contact.html`, `404.html`, `_templates/project.html`, `_templates/note.html`

**Interfaces:**
- Consumes: CSS classes from Task 2.
- Produces: `checkLinks(root: string, base = '/portfolio-zen/') → Array<{ file: string, ref: string }>` (empty = all good); `SITE_BASE`.

- [ ] **Step 1: Write the failing link-checker tests**

**File:** `tests/check-links.test.mjs`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLinks } from '../tools/check-links.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('reports missing relative and off-base absolute links, accepts the rest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'links-'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'b.html'), '');
  writeFileSync(join(dir, 'sub', 'index.html'), '');
  writeFileSync(join(dir, 'a.html'), [
    '<a href="b.html">ok</a>',
    '<a href="missing.html">broken</a>',
    '<a href="sub/">dir index</a>',
    '<a href="b.html#top">hash</a>',
    '<a href="https://example.com">external</a>',
    '<a href="mailto:x@example.com">mail</a>',
    '<a href="#local">local</a>',
    '<link href="/portfolio-zen/b.html">',
    '<img src="/elsewhere.png">',
  ].join('\n'));
  assert.deepEqual(checkLinks(dir), [
    { file: 'a.html', ref: 'missing.html' },
    { file: 'a.html', ref: '/elsewhere.png' },
  ]);
});

test('the site has no broken internal links', () => {
  assert.deepEqual(checkLinks(repoRoot), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../tools/check-links.mjs'`.

- [ ] **Step 3: Implement the link checker**

**File:** `tools/check-links.mjs`
```js
// Verifies every internal href/src in the site's HTML points at a file that exists.
// Relative links resolve from the page; absolute links must live under the Pages base.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SITE_BASE = '/portfolio-zen/';
const SKIP_DIRS = new Set(['.git', 'node_modules', '_templates']);

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function exists(target) {
  if (!existsSync(target)) return false;
  return statSync(target).isDirectory() ? existsSync(join(target, 'index.html')) : true;
}

export function checkLinks(root, base = SITE_BASE) {
  const broken = [];
  for (const file of htmlFiles(root)) {
    const html = readFileSync(file, 'utf8');
    for (const [, ref] of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      if (ref === '' || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) continue;
      const path = ref.split(/[?#]/)[0];
      let target = null;
      if (path.startsWith(base)) target = join(root, path.slice(base.length));
      else if (!path.startsWith('/')) target = resolve(dirname(file), path);
      if (!target || !exists(target)) broken.push({ file: relative(root, file).replaceAll('\\', '/'), ref });
    }
  }
  return broken;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const broken = checkLinks(root);
  for (const { file, ref } of broken) console.log(`${file}: ${ref}`);
  console.log(broken.length ? `${broken.length} broken link(s)` : 'all internal links resolve');
  process.exitCode = broken.length ? 1 : 0;
}
```

- [ ] **Step 4: Run tests — unit test passes, site test fails**

Run: `npm test`
Expected: link-checker unit test PASS; "the site has no broken internal links" FAIL listing `index.html: about.html`, `projects/index.html`, `notes.html`, `contact.html`.

- [ ] **Step 5: Write the pages**

**File:** `about.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>About — Zenolitee</title>
  <meta name="description" content="About Zenolitee: small, sharp tools for the web.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="index.html">← Home</a>
      <a href="about.html" aria-current="page">About</a>
      <a href="projects/index.html">Projects</a>
      <a href="notes.html">Notes</a>
      <a href="contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="page-title">About</h1>
      <div class="lead">
        <p>I build small, sharp tools for the web.</p>
        <p>TypeScript and JavaScript mostly, React when it needs a UI, Python when it is the fastest path to done.</p>
        <p>Currently studying Computer Science.</p>
      </div>
      <dl class="meta-list">
        <dt>Focus</dt><dd>Web tools / Automation</dd>
        <dt>Stack</dt><dd>TypeScript, JavaScript, React, Python</dd>
        <dt>Currently</dt><dd>Studying Computer Science</dd>
      </dl>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `projects/index.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Projects — Zenolitee</title>
  <meta name="description" content="Selected projects by Zenolitee.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="../index.html">← Home</a>
      <a href="../about.html">About</a>
      <a href="index.html" aria-current="page">Projects</a>
      <a href="../notes.html">Notes</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="page-title">Projects</h1>
      <ul class="project-grid">
        <li>
          <a class="card" href="nw-helper.html">
            <div class="frame"><img src="../assets/projects/nw-helper/cover.svg" alt="NW-Helper cover" width="1600" height="1000" loading="lazy"></div>
            <div class="card-head"><h2>NW-Helper</h2><span class="card-year">2026</span></div>
            <p>Discord bot and web dashboard for Black Desert Online Node War rosters.</p>
          </a>
        </li>
        <li>
          <a class="card" href="agent-presence.html">
            <div class="frame"><img src="../assets/projects/agent-presence/cover.svg" alt="AgentPresence cover" width="1600" height="1000" loading="lazy"></div>
            <div class="card-head"><h2>AgentPresence</h2><span class="card-year">2026</span></div>
            <p>Shows which AI coding agent you're using as your Discord status.</p>
          </a>
        </li>
        <li>
          <a class="card" href="asciify-ps.html">
            <div class="frame"><img src="../assets/projects/asciify-ps/cover.svg" alt="asciify-ps cover" width="1600" height="1000" loading="lazy"></div>
            <div class="card-head"><h2>asciify-ps</h2><span class="card-year">2026</span></div>
            <p>Windows desktop app that turns images into coloured ASCII art.</p>
          </a>
        </li>
        <li>
          <a class="card" href="playwright-scout.html">
            <div class="frame"><img src="../assets/projects/playwright-scout/cover.svg" alt="playwright-scout cover" width="1600" height="1000" loading="lazy"></div>
            <div class="card-head"><h2>playwright-scout</h2><span class="card-year">2026</span></div>
            <p>Crawls web apps and generates Playwright tests.</p>
          </a>
        </li>
      </ul>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `projects/nw-helper.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NW-Helper — Zenolitee</title>
  <meta name="description" content="NW-Helper: Discord bot and web dashboard for Black Desert Online Node War rosters.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="../index.html">← Home</a>
      <a href="../about.html">About</a>
      <a href="index.html" aria-current="page">Projects</a>
      <a href="../notes.html">Notes</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="detail-title">NW-Helper</h1>
      <p class="detail-summary">Discord bot and web dashboard for planning Black Desert Online Node War rosters.</p>
      <dl class="meta-list">
        <dt>Year</dt><dd>2026</dd>
        <dt>Role</dt><dd>Design &amp; build</dd>
        <dt>Stack</dt><dd>TypeScript · Discord · Supabase</dd>
        <dt>Source</dt><dd>Private repository</dd>
      </dl>
      <div class="frame detail-hero"><img src="../assets/projects/nw-helper/cover.svg" alt="NW-Helper cover" width="1600" height="1000"></div>
      <div class="prose">
        <p>NW-Helper creates scheduled raid announcements in Discord, lets guild members sign up from buttons on the announcement, tracks specialist slot limits, and gives server administrators a browser dashboard for schedules and rosters.</p>
        <h2>Features</h2>
        <ul>
          <li>One-time and weekly recurring Node War rosters, with tier and weekday capacity presets.</li>
          <li>Discord creation and editing wizards built from buttons, select menus and modals.</li>
          <li>Roster groups (Mainball/FFA, Defense, Zerker, Shai, Bench, custom) with automatic overflow to Bench.</li>
          <li>Guild Boss Raid scheduling with a configurable boss order.</li>
          <li>A minute-based scheduler with restart recovery and duplicate-post prevention.</li>
          <li>Discord OAuth dashboard login; JSON-file or Supabase storage.</li>
        </ul>
      </div>
      <a class="back-link" href="index.html">← All projects</a>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `projects/agent-presence.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentPresence — Zenolitee</title>
  <meta name="description" content="AgentPresence: publishes local AI coding-agent activity to Discord Rich Presence.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="../index.html">← Home</a>
      <a href="../about.html">About</a>
      <a href="index.html" aria-current="page">Projects</a>
      <a href="../notes.html">Notes</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="detail-title">AgentPresence</h1>
      <p class="detail-summary">A small local Rust runtime that publishes AI coding-agent activity to Discord Rich Presence.</p>
      <dl class="meta-list">
        <dt>Year</dt><dd>2026</dd>
        <dt>Role</dt><dd>Design &amp; build</dd>
        <dt>Stack</dt><dd>Rust · Discord Rich Presence</dd>
        <dt>Source</dt><dd><a href="https://github.com/Zenolitee/AgentPresence">GitHub ↗</a></dd>
      </dl>
      <div class="frame detail-hero"><img src="../assets/projects/agent-presence/cover.svg" alt="AgentPresence cover" width="1600" height="1000"></div>
      <div class="prose">
        <p>AgentPresence detects which AI coding agent — Codex, Pi or OpenCode — is active in your terminals and updates your Discord status automatically. Switch between agents and your status follows.</p>
      </div>
      <a class="back-link" href="index.html">← All projects</a>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `projects/asciify-ps.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>asciify-ps — Zenolitee</title>
  <meta name="description" content="asciify-ps: Windows desktop GUI that turns images into coloured ASCII art.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="../index.html">← Home</a>
      <a href="../about.html">About</a>
      <a href="index.html" aria-current="page">Projects</a>
      <a href="../notes.html">Notes</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="detail-title">asciify-ps</h1>
      <p class="detail-summary">A Windows desktop GUI that turns images into coloured ASCII art with a live preview.</p>
      <dl class="meta-list">
        <dt>Year</dt><dd>2026</dd>
        <dt>Role</dt><dd>Design &amp; build</dd>
        <dt>Stack</dt><dd>Python · asciify-them</dd>
        <dt>Source</dt><dd><a href="https://github.com/Zenolitee/asciify-ps">GitHub ↗</a></dd>
      </dl>
      <div class="frame detail-hero"><img src="../assets/projects/asciify-ps/cover.svg" alt="asciify-ps cover" width="1600" height="1000"></div>
      <div class="prose">
        <p>asciify-ps is a desktop front end for the asciify-them rendering library: load an image, adjust the output and watch the coloured ASCII version update live.</p>
      </div>
      <a class="back-link" href="index.html">← All projects</a>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `projects/playwright-scout.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>playwright-scout — Zenolitee</title>
  <meta name="description" content="playwright-scout: deterministic Playwright QA scout that crawls web apps and generates tests.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="../index.html">← Home</a>
      <a href="../about.html">About</a>
      <a href="index.html" aria-current="page">Projects</a>
      <a href="../notes.html">Notes</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="detail-title">playwright-scout</h1>
      <p class="detail-summary">A deterministic Playwright QA scout and AI-agent skill that crawls web apps and generates Playwright tests.</p>
      <dl class="meta-list">
        <dt>Year</dt><dd>2026</dd>
        <dt>Role</dt><dd>Design &amp; build</dd>
        <dt>Stack</dt><dd>TypeScript · Playwright</dd>
        <dt>Source</dt><dd><a href="https://github.com/Zenolitee/playwright-scout">GitHub ↗</a></dd>
      </dl>
      <div class="frame detail-hero"><img src="../assets/projects/playwright-scout/cover.svg" alt="playwright-scout cover" width="1600" height="1000"></div>
      <div class="prose">
        <p>playwright-scout explores a web app on its own, then writes Playwright tests from what it found — usable directly or as a skill for AI coding agents.</p>
      </div>
      <a class="back-link" href="index.html">← All projects</a>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `assets/projects/nw-helper/cover.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
  <rect width="1600" height="1000" fill="#111113"/>
  <g fill="none" stroke="#1f1f24" stroke-width="2"><circle cx="800" cy="500" r="200"/><circle cx="800" cy="500" r="320"/><ellipse cx="800" cy="500" rx="620" ry="80"/></g>
  <text x="800" y="512" fill="#e8e6e1" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="60" letter-spacing="14" text-anchor="middle">NW-HELPER</text>
  <text x="800" y="580" fill="#807d75" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="22" letter-spacing="7" text-anchor="middle">SCREENSHOT SOON</text>
</svg>
```

**File:** `assets/projects/agent-presence/cover.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
  <rect width="1600" height="1000" fill="#111113"/>
  <g fill="none" stroke="#1f1f24" stroke-width="2"><circle cx="800" cy="500" r="200"/><circle cx="800" cy="500" r="320"/><ellipse cx="800" cy="500" rx="620" ry="80"/></g>
  <text x="800" y="512" fill="#e8e6e1" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="60" letter-spacing="14" text-anchor="middle">AGENTPRESENCE</text>
  <text x="800" y="580" fill="#807d75" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="22" letter-spacing="7" text-anchor="middle">SCREENSHOT SOON</text>
</svg>
```

**File:** `assets/projects/asciify-ps/cover.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
  <rect width="1600" height="1000" fill="#111113"/>
  <g fill="none" stroke="#1f1f24" stroke-width="2"><circle cx="800" cy="500" r="200"/><circle cx="800" cy="500" r="320"/><ellipse cx="800" cy="500" rx="620" ry="80"/></g>
  <text x="800" y="512" fill="#e8e6e1" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="60" letter-spacing="14" text-anchor="middle">ASCIIFY-PS</text>
  <text x="800" y="580" fill="#807d75" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="22" letter-spacing="7" text-anchor="middle">SCREENSHOT SOON</text>
</svg>
```

**File:** `assets/projects/playwright-scout/cover.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
  <rect width="1600" height="1000" fill="#111113"/>
  <g fill="none" stroke="#1f1f24" stroke-width="2"><circle cx="800" cy="500" r="200"/><circle cx="800" cy="500" r="320"/><ellipse cx="800" cy="500" rx="620" ry="80"/></g>
  <text x="800" y="512" fill="#e8e6e1" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="60" letter-spacing="14" text-anchor="middle">PLAYWRIGHT-SCOUT</text>
  <text x="800" y="580" fill="#807d75" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="22" letter-spacing="7" text-anchor="middle">SCREENSHOT SOON</text>
</svg>
```

**File:** `notes.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Notes — Zenolitee</title>
  <meta name="description" content="Notes and write-ups by Zenolitee.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="index.html">← Home</a>
      <a href="about.html">About</a>
      <a href="projects/index.html">Projects</a>
      <a href="notes.html" aria-current="page">Notes</a>
      <a href="contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="page-title">Notes</h1>
      <!-- Add a note: copy _templates/note.html to notes/<slug>.html, then add
           <li><time datetime="YYYY-MM-DD">Mon DD, YYYY</time><a href="notes/<slug>.html">Title</a></li>
           to the list below and remove the empty-state paragraph. -->
      <ul class="note-list"></ul>
      <p class="empty">Nothing here yet — writing soon.</p>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `contact.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contact — Zenolitee</title>
  <meta name="description" content="How to reach Zenolitee.">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="index.html">← Home</a>
      <a href="about.html">About</a>
      <a href="projects/index.html">Projects</a>
      <a href="notes.html">Notes</a>
      <a href="contact.html" aria-current="page">Contact</a>
    </nav>
    <main>
      <h1 class="page-title">Contact</h1>
      <div class="lead"><p>The best way to reach me is on GitHub.</p></div>
      <dl class="meta-list">
        <dt>GitHub</dt><dd><a href="https://github.com/Zenolitee">github.com/Zenolitee ↗</a></dd>
        <!-- Add more rows, e.g.:
        <dt>Email</dt><dd><a href="mailto:you@example.com">you@example.com</a></dd>
        <dt>LinkedIn</dt><dd><a href="https://www.linkedin.com/in/you/">linkedin.com/in/you ↗</a></dd> -->
      </dl>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `404.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Not found — Zenolitee</title>
  <meta name="theme-color" content="#0b0b0c">
  <!-- Absolute paths: GitHub Pages serves this file at whatever URL was missing. -->
  <link rel="icon" href="/portfolio-zen/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/portfolio-zen/css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="/portfolio-zen/index.html">← Home</a>
      <a href="/portfolio-zen/about.html">About</a>
      <a href="/portfolio-zen/projects/index.html">Projects</a>
      <a href="/portfolio-zen/notes.html">Notes</a>
      <a href="/portfolio-zen/contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="page-title">404</h1>
      <div class="lead"><p>This page fell past the event horizon.</p></div>
      <a class="back-link" href="/portfolio-zen/index.html">← Back home</a>
    </main>
  </div>
</body>
</html>
```

**File:** `_templates/project.html`
```html
<!doctype html>
<html lang="en">
<!-- New project: copy to projects/<slug>.html, replace every UPPERCASE placeholder,
     put images in assets/projects/<slug>/, and add a card to projects/index.html. -->
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PROJECT NAME — Zenolitee</title>
  <meta name="description" content="PROJECT NAME: ONE-LINE SUMMARY">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="../index.html">← Home</a>
      <a href="../about.html">About</a>
      <a href="index.html" aria-current="page">Projects</a>
      <a href="../notes.html">Notes</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="detail-title">PROJECT NAME</h1>
      <p class="detail-summary">ONE-LINE SUMMARY</p>
      <dl class="meta-list">
        <dt>Year</dt><dd>YEAR</dd>
        <dt>Role</dt><dd>ROLE</dd>
        <dt>Stack</dt><dd>STACK</dd>
        <dt>Source</dt><dd><a href="https://github.com/Zenolitee/REPO">GitHub ↗</a></dd>
      </dl>
      <div class="frame detail-hero"><img src="../assets/projects/SLUG/cover.png" alt="PROJECT NAME screenshot" width="1600" height="900"></div>
      <div class="prose">
        <p>WHAT IT IS AND WHY YOU BUILT IT.</p>
        <h2>How it works</h2>
        <p>THE TECHNICAL STORY.</p>
        <div class="image-pair">
          <div class="frame"><img src="../assets/projects/SLUG/detail-1.png" alt="DESCRIBE IMAGE" width="1600" height="1000" loading="lazy"></div>
          <div class="frame"><img src="../assets/projects/SLUG/detail-2.png" alt="DESCRIBE IMAGE" width="1600" height="1000" loading="lazy"></div>
        </div>
      </div>
      <a class="back-link" href="index.html">← All projects</a>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

**File:** `_templates/note.html`
```html
<!doctype html>
<html lang="en">
<!-- New note: copy to notes/<slug>.html, replace the UPPERCASE placeholders,
     and add it to the list in notes.html. -->
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NOTE TITLE — Zenolitee</title>
  <meta name="description" content="ONE-LINE SUMMARY">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="page">
    <nav class="page-nav" aria-label="Site">
      <a href="../index.html">← Home</a>
      <a href="../about.html">About</a>
      <a href="../projects/index.html">Projects</a>
      <a href="../notes.html" aria-current="page">Notes</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <main>
      <h1 class="detail-title">NOTE TITLE</h1>
      <p class="detail-summary"><time datetime="YYYY-MM-DD">MON DD, YYYY</time></p>
      <div class="prose">
        <p>FIRST PARAGRAPH.</p>
        <h2>SECTION HEADING</h2>
        <p>MORE TEXT.</p>
      </div>
      <a class="back-link" href="../notes.html">← All notes</a>
    </main>
    <footer class="site-footer"><p>© 2026 Zenolitee</p></footer>
  </div>
</body>
</html>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test` and `npm run check-links`
Expected: all tests PASS; `all internal links resolve`.

- [ ] **Step 7: Browser checks (Review Focus 2 and page layout)**

At 1440×900 and 390×844 screenshot about, projects, one detail page, notes, contact, 404: nav row present, single column, grid 2-up desktop / 1-up phone, no horizontal scroll, 0 console errors. Then in DevTools set one card's `img.src` to a missing file: the `.frame` box keeps its 16:10 height (±1px) and the alt text is inside it.

- [ ] **Step 8: Commit**

```bash
git add tools/check-links.mjs tests/check-links.test.mjs about.html projects notes.html contact.html 404.html _templates assets/projects
git commit -m "feat: about, projects showcase, notes, contact and 404 pages"
```

---

### Task 4: README animated SVG generator

**Files:**
- Create: `tools/render-readme-svg.mjs`, `tests/readme-svg.test.mjs`, `assets/readme/blackhole.svg` (generated)

**Interfaces:**
- Consumes: `createBlackHole({ loop: true })`, `renderFrame`, `RAMP` from `js/blackhole-core.js`.
- Produces: `README_GRID`, `FRAMES`, `renderFrames(n?, grid?) → { frames: string[], loopSeconds: number }`, `buildSvg(frames, loopSeconds, grid?) → string`.

- [ ] **Step 1: Write the failing tests**

**File:** `tests/readme-svg.test.mjs`
```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../tools/render-readme-svg.mjs'`.

- [ ] **Step 3: Implement the generator**

**File:** `tools/render-readme-svg.mjs`
```js
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
```

- [ ] **Step 4: Run tests to verify they pass, then generate**

Run: `npm test` → all PASS. Run: `npm run readme-svg` → `wrote .../assets/readme/blackhole.svg (… KB, 90 frames, 8.89 s loop)`.

- [ ] **Step 5: Look at it**

Open `http://localhost:8765/assets/readme/blackhole.svg` in the browser: the black hole animates, loops without a visible jump, and the characters line up in columns.

- [ ] **Step 6: Commit**

```bash
git add tools/render-readme-svg.mjs tests/readme-svg.test.mjs assets/readme/blackhole.svg
git commit -m "feat: generate looping black hole SVG for the GitHub profile README"
```

---

### Task 5: Verification pass, repo README, PR

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the repo README**

**File:** `README.md`
````markdown
# portfolio-zen

Personal portfolio — dark, typographic, with a live ASCII black hole on the home page.
Live at https://zenolitee.github.io/portfolio-zen/

![ASCII black hole](assets/readme/blackhole.svg)

## Run locally

ES modules need a server (not `file://`):

```sh
python -m http.server 8765
# open http://localhost:8765/
```

## Checks

```sh
npm test              # renderer, link checker and README-SVG tests (Node 22+, no dependencies)
npm run check-links   # every internal link resolves
```

## Add a project

1. Copy `_templates/project.html` to `projects/<slug>.html` and fill in the UPPERCASE placeholders.
2. Put images in `assets/projects/<slug>/` (cover is shown at 16:10).
3. Add a card to `projects/index.html`, then run `npm run check-links`.

Notes work the same way with `_templates/note.html` and `notes.html`.

## Black hole

- `js/blackhole-core.js` — pure renderer (no DOM), shared by the site and the README generator.
- `js/blackhole.js` — mounts it into the home page: sizing, 30 fps loop, pausing.
- `npm run readme-svg` — regenerates `assets/readme/blackhole.svg` for the GitHub profile.

Design notes: `docs/superpowers/specs/2026-09-30-portfolio-design.md`.
````

- [ ] **Step 2: Full verification**

Run `npm test` (all pass) and `npm run check-links`. In the browser (served locally): every page at 1440×900 and 390×844 with 0 console errors; home frame time via `renderFrame` median ≤ 10 ms at 260×90 and within 1.5× that at a 3× viewport; reduced motion stops the loop; keyboard Tab reaches all four corner links with a visible focus ring.

- [ ] **Step 3: Commit, push, open PR**

```bash
git add README.md
git commit -m "docs: repo README"
git push
gh pr create --base main --head feat/site --title "Portfolio site: black hole home, projects showcase, README animation" --body "<summary + test results + 🤖 footer>"
```

- [ ] **Step 4: Turn on GitHub Pages (serves `main`, so the site goes live when the PR merges)**

```bash
gh api -X POST repos/Zenolitee/portfolio-zen/pages -f "source[branch]=main" -f "source[path]=/"
gh api repos/Zenolitee/portfolio-zen/pages --jq .html_url
```
Expected: `https://zenolitee.github.io/portfolio-zen/`. After merge, check the live home page, a project page, and a missing URL (styled 404).

---

### Task 6: Profile README animation (repo `Zenolitee/Zenolitee`)

**Files (in a clone of `Zenolitee/Zenolitee`):**
- Create: `assets/blackhole.svg` (copy of `assets/readme/blackhole.svg`)
- Modify: `README.md` (insert the animation at the top, linking to the site)

- [ ] **Step 1: Clone and branch**

```bash
gh repo clone Zenolitee/Zenolitee <scratchpad>/profile && cd <scratchpad>/profile
git switch -c feat/blackhole
cp D:/Portfolio-Website/assets/readme/blackhole.svg assets/blackhole.svg
```

- [ ] **Step 2: Insert at the top of `README.md`**

```html
<p align="center">
  <a href="https://zenolitee.github.io/portfolio-zen/">
    <img src="assets/blackhole.svg" alt="Animated ASCII black hole — links to my portfolio" width="100%"/>
  </a>
</p>
```

- [ ] **Step 3: Commit, push, open PR (not merged — owner reviews the rendered preview)**

```bash
git add assets/blackhole.svg README.md
git commit -m "Add animated ASCII black hole header"
git push -u origin feat/blackhole
gh pr create --title "Add animated ASCII black hole header" --body "<what + preview note + 🤖 footer>"
```
Expected: PR "Files changed" rich diff shows the README with the animated black hole. If GitHub strips the animation, fall back to a GIF rendered from the same frames and note it in the PR.

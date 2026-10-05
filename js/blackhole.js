// The home page's ASCII black hole: a real 3D scene you can orbit by dragging (or arrow keys).
// Light is traced through Schwarzschild geometry (units G = c = M = 1): each character's
// ray is looked up in a table of bent photon paths, where it crosses the disk plane is
// where the disk is seen (front image, then the lensed images behind it). The disk's
// look (texture, hot spots) is the 2D renderer's, laid onto the real disk.
import { createBlackHole, layout, charFor, starAt, PARAMS } from './blackhole-core.js';

const PI = Math.PI;
export const BC = 3 * Math.sqrt(3);           // critical impact parameter = shadow radius
export const RIN = 6;                         // innermost stable orbit: the disk's inner edge
const SCALE = RIN / PARAMS.RIN;               // M units -> the 2D texture's units
const ROUT = (PARAMS.ROUT + 0.6) * SCALE;     // the texture has faded out past here
const GAIN = 1.9, OPACITY = 0.8, DCAM = 60;   // DCAM: camera distance (only bends the sky)
export const STARLESS = 1.5 * BC;             // keep the hole clean: no lensed stars this close in
export const DEFAULT_VIEW = Object.freeze({ incl: 80 * PI / 180, az: 0, doppler: 4 });   // doppler 4: the real g^4 beaming
const K = 2;                                  // disk images animated per ray: the direct one and the first lensed one
const RING_K = 5, RING_S = 8;                 // further images (the photon ring) up to RING_K, averaged over RING_S samples

// ---------- photon paths: u = 1/r against orbit angle phi, for each impact parameter b ----------
// u'' = 3u^2 - u, from u = 0, u' = 1/b at the camera (phi = 0). Rays inside BC fall in.
const DB = 0.02, B_MAX = ROUT + 2, NB = Math.ceil(B_MAX / DB) + 1;
const DPHI = 0.01, PHI_MAX = (RING_K + 1) * PI, NP = Math.ceil(PHI_MAX / DPHI) + 1;
const CAPTURED = 10, ESCAPED = -1, SUB = 4;
const U = new Float32Array(NB * NP).fill(CAPTURED);
const ESC = new Float32Array(NB).fill(NaN);   // angle at which the ray leaves for the sky

for (let ib = 1; ib < NB; ib++) {
  const row = ib * NP, h = DPHI / SUB;
  let u = 0, w = 1 / (ib * DB), phi = 0, state = 0;
  U[row] = 0;
  for (let k = 1; k < NP; k++) {
    for (let s = 0; s < SUB && state === 0; s++) {
      const f = x => 3 * x * x - x;
      const k1u = w, k1w = f(u);
      const k2u = w + h / 2 * k1w, k2w = f(u + h / 2 * k1u);
      const k3u = w + h / 2 * k2w, k3w = f(u + h / 2 * k2u);
      const k4u = w + h * k3w, k4w = f(u + h * k3u);
      const prev = u;
      u += h / 6 * (k1u + 2 * k2u + 2 * k3u + k4u);
      w += h / 6 * (k1w + 2 * k2w + 2 * k3w + k4w);
      phi += h;
      if (u >= 0.5) state = 1;                                   // inside the horizon
      else if (u < 0) { state = 2; ESC[ib] = phi - h + h * prev / (prev - u); }
    }
    U[row + k] = state === 0 ? u : state === 1 ? CAPTURED : ESCAPED;
  }
}

function uAt(b, phi) {
  const fb = b / DB, ib = Math.min(NB - 2, fb | 0), tb = fb - ib;
  const fp = phi / DPHI, ip = Math.min(NP - 2, fp | 0), tp = fp - ip;
  const r0 = ib * NP + ip, r1 = r0 + NP;
  const a = U[r0] + (U[r0 + 1] - U[r0]) * tp, c = U[r1] + (U[r1 + 1] - U[r1]) * tp;
  return a + (c - a) * tb;
}

// angle at which a ray leaves for the sky (NaN: it fell in); weak-field bending past the table
export function escAt(b) {
  if (b >= B_MAX - DB) return PI + 4 / b;
  const fb = b / DB, ib = fb | 0, a = ESC[ib], c = ESC[ib + 1];
  return a !== a ? NaN : c !== c ? a : a + (c - a) * (fb - ib);
}

// the disk's brightness averaged around each orbit (texture units), for the photon ring
const DR = 0.02, MEAN = (() => {
  const flat = createBlackHole({ hotspots: false }), n = Math.ceil((PARAMS.ROUT + 0.7) / DR) + 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let sum = 0; for (let a = 0; a < 96; a++) sum += flat.disk(i * DR, a * PI / 48, 0); out[i] = sum / 96; }
  return out;
})();
const meanAt = rho => MEAN[Math.min(MEAN.length - 1, Math.round(rho / DR))];

// ---------- per-view geometry: everything that only changes when the camera moves ----------
// Per character: where its ray crosses the disk (texture radius + angle) with the redshift
// weight there, and which (lensed) star it sees. Frames then only animate the texture.
function geometry({ cols, rows, charAspect, R }, { incl, az, doppler }) {
  const n = cols * rows;
  const cnt = new Uint8Array(n), cr = new Float32Array(n * K), ca = new Float32Array(n * K);
  const cg = new Float32Array(n * K), star = new Float32Array(n), ring = new Float32Array(n);
  const si = Math.sin(incl), ci = Math.cos(incl), sa = Math.sin(az), cs = Math.cos(az);
  const o = [si * cs, si * sa, ci];                           // toward the camera
  const X = [-sa, cs, 0];                                     // screen right
  const Y = [o[1] * X[2] - o[2] * X[1], o[2] * X[0] - o[0] * X[2], o[0] * X[1] - o[1] * X[0]];  // screen up
  const zoom = BC * (1 + 0.3 * Math.abs(ci));                 // pull back as the disk opens up
  const cell = zoom / R, pix = cell / DCAM;                   // one character's size: in M, and on the sky
  const cx = cols / 2, cy = rows / 2;

  for (let j = 0, p = 0; j < rows; j++) {
    const beta = -((j - cy + 0.5) / R) * zoom;
    for (let i = 0; i < cols; i++, p++) {
      const alpha = ((i - cx + 0.5) * charAspect / R) * zoom;
      const b = Math.hypot(alpha, beta) || 1e-6, ex = alpha / b, ey = beta / b;
      const e0 = ex * X[0] + ey * Y[0], e1 = ex * X[1] + ey * Y[1], e2 = ex * X[2] + ey * Y[2];

      if (b < B_MAX) {
        // the ray's plane meets the disk plane where cos(phi) o.z + sin(phi) e.z = 0
        let phi0 = Math.atan2(-o[2], e2);
        if (phi0 <= 0) phi0 += PI;
        const lz = b * (e0 * o[1] - e1 * o[0]);               // photon angular momentum about the axis
        // near the shadow even the first lensed image is thinner than a character: average it with the ring
        const nearRing = b > BC - cell && b < BC * 1.25, kAnim = nearRing ? 1 : K;
        for (let k = 0; k < kAnim; k++) {
          const phi = phi0 + k * PI;
          if (phi >= PHI_MAX) break;
          const u = uAt(b, phi);
          if (u >= 0.5 || u <= 0) break;                       // fell in / left before crossing
          const r = 1 / u;
          if (r > ROUT || r < RIN * 0.8) continue;
          const c = Math.cos(phi), s = Math.sin(phi);
          // redshift of a circular orbit: gravity dims the inner disk, Doppler brightens the near side
          const g = Math.sqrt(Math.max(0, 1 - 3 / r)) / Math.max(0.2, 1 - Math.pow(r, -1.5) * lz);
          const q = p * K + cnt[p]++;
          cr[q] = r / SCALE;
          ca[q] = -Math.atan2(r * (c * o[1] + s * e1), r * (c * o[0] + s * e0));  // material orbits toward +angle
          cg[q] = Math.pow(g, doppler);
        }
        // the higher images crowd into rings far thinner than a character: average them
        // across the character (as a camera pixel would), against the disk's mean brightness
        if (nearRing) {
          for (let si = 0; si < RING_S; si++) {
            const bs = b + ((si + 0.5) / RING_S - 0.5) * cell;
            for (let k = kAnim; k < RING_K; k++) {
              const phi = phi0 + k * PI, u = uAt(bs, phi);
              if (u >= 0.5 || u <= 0) break;
              const r = 1 / u;
              if (r > ROUT || r < RIN * 0.8) continue;
              const g = Math.sqrt(Math.max(0, 1 - 3 / r)) / Math.max(0.2, 1 - Math.pow(r, -1.5) * lz * bs / b);
              ring[p] += meanAt(r / SCALE) * Math.pow(g, doppler) / RING_S;
            }
          }
        }
      }

      if (b > STARLESS) {
        // the sky, bent: a ray that escapes shows the star in the direction it leaves toward
        const pe = escAt(b) - b / DCAM, c = Math.cos(pe), s = Math.sin(pe);
        const lat = Math.asin(Math.max(-1, Math.min(1, c * o[2] + s * e2)));
        const lon = Math.atan2(c * o[1] + s * e1, c * o[0] + s * e0);
        star[p] = starAt(Math.floor(lon * Math.cos(lat) / pix), Math.floor(lat / pix));
      }
    }
  }
  return { cnt, cr, ca, cg, star, ring };
}

let cache = { key: '', geo: null };
function geometryFor(grid, view) {
  const key = [grid.cols, grid.rows, grid.charAspect, grid.R, view.incl, view.az, view.doppler].join();
  if (cache.key !== key) cache = { key, geo: geometry(grid, view) };
  return cache.geo;
}

// view: { incl (angle from the disk's axis), az, doppler (exponent on the redshift: 0 off, 4 real) }
export function renderFrame3d(bh, grid, t, view = DEFAULT_VIEW) {
  const { cols, rows } = grid, { cnt, cr, ca, cg, star, ring } = geometryFor(grid, { ...DEFAULT_VIEW, ...view });
  const lines = new Array(rows);
  for (let j = 0, p = 0; j < rows; j++) {
    let line = '';
    for (let i = 0; i < cols; i++, p++) {
      let I = 0, A = 0;
      for (let k = 0, q = p * K; k < cnt[p]; k++, q++) {
        const em = bh.disk(cr[q], ca[q], t);
        if (em <= 0) continue;
        I += (1 - A) * em * cg[q];
        A += (1 - A) * Math.min(1, em * OPACITY);
      }
      I += (1 - A) * ring[p];
      let v = I * GAIN;
      if (v < 0.05 && star[p]) v = bh.twinkle(star[p], t);
      line += v <= 0 ? ' ' : charFor(v);
    }
    lines[j] = line;
  }
  return lines.join('\n');
}

// ---------- page: sizing, loop, drag / keys to look around ----------
const FRAME_MS = 1000 / 30, IDLE_MS = 4000, STEP = 0.08;

export function mount(pre, surface) {
  const bh = createBlackHole();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const view = { ...DEFAULT_VIEW };
  let grid = null, last = -Infinity, dirty = true;
  let drag = null, vel = { az: 0, incl: 0 }, lastInput = -Infinity;

  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(100);
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px';
  pre.appendChild(probe);
  const charAspect = probe.getBoundingClientRect().width / 100 / 100;
  probe.remove();

  const still = () => reduceMotion.matches;
  const clampIncl = x => Math.min(PI - 0.03, Math.max(0.03, x));
  const turn = (daz, dincl) => { view.az += daz; view.incl = clampIncl(view.incl + dincl); dirty = true; };
  const reset = () => {
    lastInput = -Infinity; vel = { az: 0, incl: 0 };
    if (still()) { view.az = DEFAULT_VIEW.az; view.incl = DEFAULT_VIEW.incl; dirty = true; }  // no glide
  };
  const draw = now => { pre.textContent = renderFrame3d(bh, grid, still() ? 0 : now / 1000, view); dirty = false; };

  function resize() {
    grid = layout({ width: pre.clientWidth, height: pre.clientHeight, charAspect });
    pre.style.fontSize = `${grid.fontSize}px`;
    dirty = true;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!drag && !still()) {
      // coast after a flick, then glide home once left alone
      if (Math.abs(vel.az) + Math.abs(vel.incl) > 1e-4) {
        turn(vel.az, vel.incl);
        vel.az *= 0.92; vel.incl *= 0.92;
      } else if (now - lastInput > IDLE_MS) {
        const da = Math.atan2(Math.sin(DEFAULT_VIEW.az - view.az), Math.cos(DEFAULT_VIEW.az - view.az));
        const di = DEFAULT_VIEW.incl - view.incl;
        if (Math.abs(da) + Math.abs(di) > 1e-3) turn(da * 0.04, di * 0.04);
      }
    }
    if ((dirty || !still()) && !document.hidden && now - last >= FRAME_MS) { last = now; draw(now); }
  }

  surface.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('a, button')) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    vel = { az: 0, incl: 0 };
    try { surface.setPointerCapture(e.pointerId); } catch {}  // keep the drag even if capture isn't possible
    surface.classList.add('is-dragging');
    surface.setAttribute('data-trail-ignore', '');            // the cursor trail sits out the drag
  });
  surface.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const k = 4 / Math.max(400, surface.clientHeight);         // ~ one drag across the screen = a full turn
    vel = { az: -(e.clientX - drag.x) * k, incl: -(e.clientY - drag.y) * k };
    turn(vel.az, vel.incl);
    drag.x = e.clientX; drag.y = e.clientY;
    lastInput = performance.now();
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null; lastInput = performance.now();
    if (still()) vel = { az: 0, incl: 0 };                    // no coasting
    surface.classList.remove('is-dragging');
    surface.removeAttribute('data-trail-ignore');
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('dblclick', e => { if (!e.target.closest('a, button')) reset(); });

  // arrow keys orbit, Home resets (ignored while typing or with modifier keys)
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
    const moves = { ArrowLeft: [STEP, 0], ArrowRight: [-STEP, 0], ArrowUp: [0, STEP], ArrowDown: [0, -STEP] };
    if (e.key === 'Home') reset();
    else if (moves[e.key]) { turn(...moves[e.key]); vel = { az: 0, incl: 0 }; lastInput = performance.now(); }
    else return;
    e.preventDefault();
  });
  reduceMotion.addEventListener('change', () => { dirty = true; });

  new ResizeObserver(resize).observe(pre);
  resize();
  requestAnimationFrame(tick);
  return { view };
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('blackhole');
  if (el) window.blackhole = mount(el, el.closest('.landing'));
}

// MOCK: the ASCII black hole as a real 3D scene you can orbit by dragging.
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
export const DEFAULT_VIEW = Object.freeze({ incl: 80 * PI / 180, az: 0 });
const STARLESS = 1.5 * BC;                     // keep the hole clean: no lensed stars this close in

// ---------- photon paths: u = 1/r against orbit angle phi, for each impact parameter b ----------
// u'' = 3u^2 - u, from u = 0, u' = 1/b at the camera (phi = 0). Rays inside BC fall in.
const DB = 0.02, B_MAX = ROUT + 2, NB = Math.ceil(B_MAX / DB) + 1;
const DPHI = 0.01, PHI_MAX = 3 * PI, NP = Math.ceil(PHI_MAX / DPHI) + 1;
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

// exit angle for the sky; weak-field bending (4M/b) past the table
function escAt(b) {
  if (b >= B_MAX - DB) return PI + 4 / b;
  const fb = b / DB, ib = fb | 0, a = ESC[ib], c = ESC[ib + 1];
  return a !== a ? NaN : c !== c ? a : a + (c - a) * (fb - ib);  // NaN: fell in
}

// ---------- frame ----------
// view: { incl (angle from the disk's axis), az, doppler (exponent on the redshift: 0 off, 4 real) }
export function renderFrame3d(bh, { cols, rows, charAspect, R }, t, { incl, az, doppler = 2.5 }) {
  const si = Math.sin(incl), ci = Math.cos(incl), sa = Math.sin(az), ca = Math.cos(az);
  const o = [si * ca, si * sa, ci];                           // toward the camera
  const X = [-sa, ca, 0];                                     // screen right
  const Y = [o[1] * X[2] - o[2] * X[1], o[2] * X[0] - o[0] * X[2], o[0] * X[1] - o[1] * X[0]];  // screen up
  const zoom = BC * (1 + 0.3 * Math.abs(ci));                 // pull back as the disk opens up
  const pix = zoom / R / DCAM;                                // one character's angle on the sky
  const cx = cols / 2, cy = rows / 2, lines = new Array(rows);

  for (let j = 0; j < rows; j++) {
    const beta = -((j - cy + 0.5) / R) * zoom;
    let line = '';
    for (let i = 0; i < cols; i++) {
      const alpha = ((i - cx + 0.5) * charAspect / R) * zoom;
      const b = Math.hypot(alpha, beta) || 1e-6, ex = alpha / b, ey = beta / b;
      const e = [ex * X[0] + ey * Y[0], ex * X[1] + ey * Y[1], ex * X[2] + ey * Y[2]];
      let I = 0, A = 0;

      if (b < B_MAX) {
        // the ray's plane meets the disk plane where cos(phi) o.z + sin(phi) e.z = 0
        let phi0 = Math.atan2(-o[2], e[2]);
        if (phi0 <= 0) phi0 += PI;
        const lz = b * (e[0] * o[1] - e[1] * o[0]);           // photon angular momentum about the axis
        for (let k = 0; k < 3; k++) {
          const phi = phi0 + k * PI;
          if (phi >= PHI_MAX) break;
          const u = uAt(b, phi);
          if (u >= 0.5 || u <= 0) break;                       // fell in / left before crossing
          const r = 1 / u;
          if (r > ROUT || r < RIN * 0.8) continue;
          const c = Math.cos(phi), s = Math.sin(phi);
          const px = r * (c * o[0] + s * e[0]), py = r * (c * o[1] + s * e[1]);
          const em = bh.disk(r / SCALE, -Math.atan2(py, px), t);  // material orbits toward +angle
          if (em <= 0) continue;
          // redshift of a circular orbit: gravity dims the inner disk, Doppler brightens the near side
          const g = Math.sqrt(Math.max(0, 1 - 3 / r)) / Math.max(0.2, 1 - Math.pow(r, -1.5) * lz);
          I += (1 - A) * em * Math.pow(g, doppler);
          A += (1 - A) * Math.min(1, em * OPACITY);
        }
      }

      // photon ring: light that circles the hole many times piles up just outside BC
      // (the traced crossings stop at three, so its sum is drawn directly)
      I += (1 - A) * 0.6 * Math.exp(-(((b - BC * 1.01) / 0.18) ** 2));
      let v = I * GAIN;
      if (v < 0.05 && b > STARLESS) {
        // the sky, bent: a ray that escapes shows the star in the direction it leaves toward
        const pe = escAt(b) - b / DCAM;
        if (pe === pe) {
          const c = Math.cos(pe), s = Math.sin(pe);
          const dz = c * o[2] + s * e[2];
          const lat = Math.asin(Math.max(-1, Math.min(1, dz)));
          const lon = Math.atan2(c * o[1] + s * e[1], c * o[0] + s * e[0]);
          const st = starAt(Math.floor(lon * Math.cos(lat) / pix), Math.floor(lat / pix));
          if (st) v = bh.twinkle(st, t);
        }
      }
      line += v <= 0 ? ' ' : charFor(v);
    }
    lines[j] = line;
  }
  return lines.join('\n');
}

// ---------- page: sizing, loop, drag to orbit ----------
const FRAME_MS = 1000 / 30, IDLE_MS = 4000;

export function mount(pre, surface) {
  const bh = createBlackHole();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const view = { ...DEFAULT_VIEW, doppler: 2.5 };
  let grid = null, raf = 0, last = -Infinity, dirty = true;
  let drag = null, vel = { az: 0, incl: 0 }, lastInput = -Infinity;

  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(100);
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px';
  pre.appendChild(probe);
  const charAspect = probe.getBoundingClientRect().width / 100 / 100;
  probe.remove();

  const clampIncl = x => Math.min(PI - 0.03, Math.max(0.03, x));
  const draw = now => { pre.textContent = renderFrame3d(bh, grid, reduceMotion.matches ? 0 : now / 1000, view); dirty = false; };

  function resize() {
    grid = layout({ width: pre.clientWidth, height: pre.clientHeight, charAspect });
    pre.style.fontSize = `${grid.fontSize}px`;
    dirty = true;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!drag) {
      // coast after a flick, then drift home once left alone
      if (Math.abs(vel.az) + Math.abs(vel.incl) > 1e-4) {
        view.az += vel.az; view.incl = clampIncl(view.incl + vel.incl);
        vel.az *= 0.92; vel.incl *= 0.92; dirty = true;
      } else if (now - lastInput > IDLE_MS) {
        const da = Math.atan2(Math.sin(DEFAULT_VIEW.az - view.az), Math.cos(DEFAULT_VIEW.az - view.az));
        const di = DEFAULT_VIEW.incl - view.incl;
        if (Math.abs(da) + Math.abs(di) > 1e-3) { view.az += da * 0.04; view.incl += di * 0.04; dirty = true; }
      }
    }
    const animate = !reduceMotion.matches && !document.hidden;
    if ((animate || dirty) && now - last >= FRAME_MS) { last = now; draw(now); }
  }

  surface.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('a, button')) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    vel = { az: 0, incl: 0 };
    surface.setPointerCapture(e.pointerId);
    surface.classList.add('is-dragging');
    surface.setAttribute('data-trail-ignore', '');            // the cursor trail sits out the drag
  });
  surface.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const k = 4 / Math.max(400, surface.clientHeight);         // ~ one drag across the screen = a full turn
    vel = { az: -(e.clientX - drag.x) * k, incl: -(e.clientY - drag.y) * k };
    view.az += vel.az; view.incl = clampIncl(view.incl + vel.incl);
    drag.x = e.clientX; drag.y = e.clientY;
    lastInput = performance.now(); dirty = true;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null; lastInput = performance.now();
    surface.classList.remove('is-dragging');
    surface.removeAttribute('data-trail-ignore');
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('dblclick', e => { if (!e.target.closest('a, button')) lastInput = -Infinity; });

  new ResizeObserver(resize).observe(pre);
  resize();
  raf = requestAnimationFrame(tick);
  return { view, redraw: () => { dirty = true; } };
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('blackhole');
  if (el) window.blackhole = mount(el, el.closest('.landing'));
}

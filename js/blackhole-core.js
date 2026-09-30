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

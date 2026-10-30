// The home page sky, behind the ASCII black hole: real-looking stars (a magnitude spread with most of
// them faint, coloured by spectral type), a faint Milky Way band, and gravitational lensing — near the
// hole each star is seen twice (the main image pushed out toward the Einstein ring and a small mirrored
// one just outside the shadow), both stretched into arcs. Dragging the black hole (js/blackhole.js)
// pans the sky with it, so the stars swirl around the hole. Stars gently scintillate.
// Reduced motion: drawn once, still.

// star colours by spectral class (M, K, G, F, A, B) and how common each looks in a photo
export const SPECTRAL = [
  ['255, 196, 140', 0.22], ['255, 221, 180', 0.24], ['255, 244, 232', 0.22],
  ['248, 247, 255', 0.16], ['210, 222, 255', 0.10], ['170, 191, 255', 0.06],
];
const pickColor = r => {
  let acc = 0;
  for (const [c, w] of SPECTRAL) if (r < (acc += w)) return c;
  return SPECTRAL[0][0];
};
const wrap = (v, n) => ((v % n) + n) % n;

function star(x, y, rand, dim = 1) {
  // m: 0..1 brightness; rand^8 gives many faint stars and a handful of bright ones
  return { x, y, m: rand() ** 8 * dim, color: pickColor(rand()), speed: 1.5 + rand() * 4, phase: rand() * Math.PI * 2 };
}

export function makeStars(w, h, rand = Math.random) {
  const field = Math.round((w * h) / 2600), stars = [];
  for (let i = 0; i < field; i++) stars.push(star(rand() * w, rand() * h, rand));
  // the Milky Way: a diagonal band of extra, fainter stars
  const ang = -0.45, len = Math.hypot(w, h), cos = Math.cos(ang), sin = Math.sin(ang);
  for (let i = 0; i < field * 0.8; i++) {
    const t = (rand() - 0.5) * len, off = (rand() + rand() + rand() - 1.5) * h * 0.12;
    stars.push(star(wrap(w / 2 + t * cos - off * sin, w), wrap(h / 2 + t * sin + off * cos, h), rand, 0.5));
  }
  return stars;
}

// soft glow patches along the same band (unresolved starlight)
export function makeGlow(w, h, rand = Math.random) {
  const ang = -0.45, len = Math.hypot(w, h), cos = Math.cos(ang), sin = Math.sin(ang);
  // many large, very faint patches overlap into a smooth band instead of visible blotches
  return Array.from({ length: 160 }, () => {
    const t = (rand() - 0.5) * len, off = (rand() + rand() + rand() - 1.5) * h * 0.08;
    return { x: wrap(w / 2 + t * cos - off * sin, w), y: wrap(h / 2 + t * sin + off * cos, h), r: 90 + rand() * 120, a: 0.005 + rand() * 0.006 };
  });
}

// gentle twinkle: a brightness factor around 1; brighter stars flicker a little more
export const scintillate = (s, t) => 1 + (0.06 + 0.2 * s.m) * Math.sin(t * s.speed + s.phase);

// sky position after panning by (ox, oy), wrapped so the sky never shows a gap
export const placed = (s, ox, oy, w, h) => ({ x: wrap(s.x - ox, w), y: wrap(s.y - oy, h) });

// blackhole.js turns the view by 4 / height radians per dragged pixel; undo that to get pixels back
export const dragOffset = (view, home, h) => ({
  x: (view.az - home.az) * Math.max(400, h) / 4,
  y: (view.incl - home.incl) * Math.max(400, h) / 4,
});

// Point-mass lens: a star at (dx, dy) from the hole appears as two images on the same line, at
// θ± = (β ± √(β² + 4θE²)) / 2, magnified by μ± = (u² + 2) / (2u√(u² + 4)) ± ½ with u = β / θE.
export function lens(dx, dy, thetaE) {
  const beta = Math.hypot(dx, dy);
  if (beta < 1e-6) return [];
  const u = beta / thetaE, root = Math.sqrt(u * u + 4), ux = dx / beta, uy = dy / beta;
  const base = (u * u + 2) / (2 * u * root);
  const tp = thetaE * (u + root) / 2, tm = thetaE * (u - root) / 2;   // tm < 0: the far side
  return [
    { x: ux * tp, y: uy * tp, r: tp, mu: base + 0.5 },
    { x: ux * tm, y: uy * tm, r: -tm, mu: base - 0.5 },
  ];
}

if (typeof window !== 'undefined') {
  const canvas = document.querySelector('canvas.stars');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let stars = [], glow = [], w = 0, h = 0, home = null;

    // pre-rendered soft glows: one per star colour, one for the Milky Way haze
    const sprite = rgb => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${rgb}, 1)`); grad.addColorStop(0.18, `rgba(${rgb}, 0.35)`); grad.addColorStop(1, `rgba(${rgb}, 0)`);
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      return c;
    };
    const glows = Object.fromEntries(SPECTRAL.map(([c]) => [c, sprite(c)]));
    const haze = sprite('255, 238, 220');

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(w, h); glow = makeGlow(w, h);
    };

    // the hole's shadow radius on screen, from the ASCII renderer's own layout
    const shadowRadius = view => {
      const g = window.blackhole?.grid;
      if (!g) return Math.min(w, h) * 0.11;
      return g.R * g.fontSize / (1 + 0.3 * Math.abs(Math.cos(view?.incl ?? 1.4)));
    };

    function drawImage(s, x, y, mu, angle, twinkle) {
      const k = Math.min(mu, 5);                                  // lensing brightens and stretches
      const a = Math.min(1, (0.28 + 0.72 * s.m) * twinkle * Math.sqrt(k));
      const r = 0.45 + 1.4 * s.m;
      if (a < 0.03) return;
      if (s.m > 0.5) {                                            // bright star: glow, maybe spikes
        const g = 10 + 26 * s.m;
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(glows[s.color], x - g / 2, y - g / 2, g, g);
        if (s.m > 0.8) {
          const L = 7 + 12 * s.m;
          ctx.globalAlpha = a * 0.35;
          ctx.strokeStyle = `rgb(${s.color})`; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
        }
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${s.color})`;
      ctx.beginPath();
      if (k > 1.15) ctx.ellipse(x, y, r, r * Math.min(k, 4), angle, 0, Math.PI * 2);   // arc along the ring
      else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const draw = t => {
      const view = window.blackhole?.view;
      if (view && !home) home = { ...view };
      const off = view ? dragOffset(view, home, h) : { x: 0, y: 0 };
      const cx = w / 2, cy = h / 2, shadow = shadowRadius(view), thetaE = shadow * 1.35;
      ctx.clearRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (const g of glow) {
        const p = placed(g, off.x, off.y, w, h);
        ctx.globalAlpha = g.a;
        ctx.drawImage(haze, p.x - g.r, p.y - g.r, g.r * 2, g.r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';

      for (const s of stars) {
        const p = placed(s, off.x, off.y, w, h);
        const twinkle = still ? 1 : scintillate(s, t);
        for (const img of lens(p.x - cx, p.y - cy, thetaE)) {
          if (img.r < shadow * 1.02) continue;                    // falls into the shadow
          if (img.mu < 0.02) continue;                            // too faint to see
          drawImage(s, cx + img.x, cy + img.y, img.mu, Math.atan2(img.y, img.x), twinkle);
        }
      }
      ctx.globalAlpha = 1;
    };

    resize();
    addEventListener('resize', () => { resize(); if (still) draw(0); });
    if (still) requestAnimationFrame(() => draw(0));
    else {
      let last = 0;
      const loop = now => {
        requestAnimationFrame(loop);
        if (now - last < 33) return;          // ~30 fps is plenty
        last = now;
        draw(now / 1000);
      };
      requestAnimationFrame(loop);
    }
  }
}

// Twinkling starfield behind the home page's black hole: small warm dots that shimmer at their own
// pace, plus a few brighter ones that now and then flare into a soft four-point sparkle.
// The black hole's shadow is masked out (css .stars) so its centre stays dark.
// Reduced motion: drawn once, still.

export const COLORS = ['255, 241, 214', '255, 217, 160', '240, 220, 192', '189, 182, 168'];

// alpha for a star at time t (seconds): a slow shimmer around its base brightness
export const shimmer = (s, t) => s.base + s.amp * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));

// 0..1 sparkle strength: mostly 0, a sharp short peak once per cycle
export const flare = (s, t) => Math.max(0, Math.sin(t * s.flareSpeed + s.phase)) ** 24;

export function makeStars(w, h, rand = Math.random) {
  const n = Math.round((w * h) / 7000);
  return Array.from({ length: n }, () => {
    const bright = rand() < 0.06;
    return {
      x: rand() * w, y: rand() * h,
      r: bright ? 1 + rand() * 0.6 : 0.4 + rand() * 0.7,
      base: bright ? 0.45 : 0.15 + rand() * 0.25,
      amp: bright ? 0.4 : 0.15 + rand() * 0.35,
      speed: 0.4 + rand() * 1.6,
      phase: rand() * Math.PI * 2,
      flareSpeed: bright ? 0.25 + rand() * 0.35 : 0,
      color: COLORS[Math.floor(rand() * COLORS.length)],
    };
  });
}

if (typeof window !== 'undefined') {
  const canvas = document.querySelector('canvas.stars');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let stars = [], w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(w, h);
    };

    const draw = t => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = still ? s.base + s.amp / 2 : shimmer(s, t);
        ctx.fillStyle = `rgba(${s.color}, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        const f = still || !s.flareSpeed ? 0 : flare(s, t);
        if (f > 0.02) {                       // four-point sparkle
          const len = s.r * 9 * f;
          ctx.strokeStyle = `rgba(${s.color}, ${0.8 * f})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
          ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
          ctx.stroke();
        }
      }
    };

    resize();
    addEventListener('resize', () => { resize(); if (still) draw(0); });
    if (still) draw(0);
    else {
      let last = 0;
      const loop = now => {
        requestAnimationFrame(loop);
        if (now - last < 33) return;          // ~30 fps is plenty for a twinkle
        last = now;
        draw(now / 1000);
      };
      requestAnimationFrame(loop);
    }
  }
}

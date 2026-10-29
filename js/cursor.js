// Custom cursor: a dot that sits on the pointer and a ring that lags behind it, stretching with speed
// and wrapping around links. On the home page, 5 s without moving pulls the cursor into the black hole:
// it spirals in (faster as it falls) and settles on a tilted orbit that dims while behind the hole.
// Any movement snaps it back. Browsers can't move the real pointer, so this animates our own drawing.
// Off for touch-only devices and reduced motion (the normal cursor stays).

export const IDLE_MS = 5000, FALL_MS = 2600, PERIOD_MS = 3400;
export const TILT = 0.28;              // orbit's minor/major axis: flattened like the accretion disk

// point on the tilted orbit at angle theta; the far half (above the centre line) is behind the hole
export const orbitPoint = (theta, cx, cy, r, flat) =>
  ({ x: cx + r * Math.cos(theta), y: cy + r * flat * Math.sin(theta), behind: Math.sin(theta) < 0 });

// radius while falling: eases in, so the drop speeds up near the end
export const fallRadius = (p, r0, r1) => r0 + (r1 - r0) * p * p;

// Kepler-ish: angular speed grows as the radius shrinks (w ∝ r^-1.5), capped so it stays readable
export const angularSpeed = (r, r1, w1) => w1 * Math.min(4, (r1 / Math.max(r, 1)) ** 1.5);

const lerp = (a, b, k) => a + (b - a) * k;

if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
  const make = cls => Object.assign(document.createElement('div'), { className: cls, ariaHidden: 'true' });
  const layer = make('cursor-layer'), dot = make('cursor-dot'), ring = make('cursor-ring');
  layer.append(ring, dot);
  document.body.append(layer);   // clipped full-screen layer, so a far-off cursor never widens the page
  document.documentElement.classList.add('has-cursor');

  const hole = document.getElementById('blackhole');
  const W1 = 2 * Math.PI / PERIOD_MS;
  const ptr = { x: innerWidth / 2, y: innerHeight / 2 };
  const pos = { x: ptr.x, y: ptr.y };            // where the dot is drawn (== ptr unless orbiting / returning)
  const rp = { x: ptr.x, y: ptr.y, w: 28, h: 28 }; // ring
  let link = null, inside = false, lastMove = performance.now(), last = lastMove;
  let mode = 'follow', fall = null, returnUntil = 0;

  const wake = () => {
    lastMove = performance.now();
    if (mode !== 'follow') { mode = 'follow'; returnUntil = lastMove + 160; dot.classList.remove('is-behind'); ring.classList.remove('is-behind'); }
  };

  addEventListener('pointermove', e => {
    ptr.x = e.clientX; ptr.y = e.clientY; inside = true; wake();
    link = e.target.closest('a, button, summary, [role="button"]');
  }, { passive: true });
  addEventListener('pointerdown', wake);
  addEventListener('keydown', wake);
  document.addEventListener('pointerleave', () => { inside = false; });
  document.documentElement.addEventListener('mouseleave', () => { inside = false; });

  function startFall(now) {
    const r = hole.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const r1 = Math.min(r.width, r.height) * 0.2;
    const dx = pos.x - cx, dy = pos.y - cy;
    fall = { cx, cy, r0: Math.max(Math.hypot(dx, dy), r1), r1, theta: Math.atan2(dy, dx), t0: now };
    mode = 'orbit';
  }

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(now - last, 50); last = now;
    const px = pos.x, py = pos.y;

    if (mode === 'follow' && hole && inside && !document.hidden && now - lastMove > IDLE_MS) startFall(now);

    let behind = false;
    if (mode === 'orbit') {
      const p = Math.min(1, (now - fall.t0) / FALL_MS);
      const r = fallRadius(p, fall.r0, fall.r1);
      // same way round as the disk: the Doppler-bright left side comes toward us (down the screen)
      fall.theta -= angularSpeed(r, fall.r1, W1) * dt;
      const flat = lerp(1, TILT, p * p);
      const o = orbitPoint(fall.theta, fall.cx, fall.cy, r, flat);
      pos.x = o.x; pos.y = o.y; behind = o.behind && p > 0.6;
    } else if (now < returnUntil) {
      pos.x = lerp(pos.x, ptr.x, 0.4); pos.y = lerp(pos.y, ptr.y, 0.4);
    } else {
      pos.x = ptr.x; pos.y = ptr.y;
    }
    dot.classList.toggle('is-behind', behind);
    ring.classList.toggle('is-behind', behind);

    // dot: stretched along its own motion while orbiting
    const vx = pos.x - px, vy = pos.y - py, v = Math.hypot(vx, vy);
    const ds = mode === 'orbit' ? 1 + Math.min(v / 6, 1.4) : 1;
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${Math.atan2(vy, vx)}rad) scale(${ds}, ${1 / Math.sqrt(ds)})`;

    // ring: wraps the hovered link, otherwise trails the dot and stretches with its speed
    const target = link && mode === 'follow' ? link.getBoundingClientRect() : null;
    const tx = target ? target.left + target.width / 2 : pos.x, ty = target ? target.top + target.height / 2 : pos.y;
    const k = target ? 0.25 : 0.18;
    const rvx = tx - rp.x, rvy = ty - rp.y;
    rp.x += rvx * k; rp.y += rvy * k;
    rp.w = lerp(rp.w, target ? target.width + 18 : 28, 0.2);
    rp.h = lerp(rp.h, target ? target.height + 14 : 28, 0.2);
    const rs = target ? 1 : 1 + Math.min(Math.hypot(rvx, rvy) / 120, 0.5);
    ring.style.width = `${rp.w}px`; ring.style.height = `${rp.h}px`;
    ring.style.transform = `translate(${rp.x}px, ${rp.y}px) rotate(${target ? 0 : Math.atan2(rvy, rvx)}rad) scale(${rs}, ${1 / rs})`;
    ring.classList.toggle('is-link', !!target);
    const show = inside || mode === 'orbit';
    dot.style.opacity = ring.style.opacity = show ? '' : '0';
  }
  requestAnimationFrame(tick);
}

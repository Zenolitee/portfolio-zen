// Cursor trail: a pool of 28 small blocks that pop up on an 8px grid under the pointer, each
// in the black hole's white / pale-yellow / grey palette with an ASCII glyph, then fade.
// Runs over [data-trail] areas only; skips links, buttons and [data-trail-ignore]; off for
// reduced motion and touch-only devices.
// (After the one on githubuniverse.com.)
export const CELL = 8;
export const snap = v => CELL * Math.floor(v / CELL);

const POOL = 28;
// [block, glyph]: warm whites, pale yellows and greys (all visible on the dark backdrop)
const COLORS = [['#fff1d6', '#0b0b0c'], ['#e8e6e1', '#0b0b0c'], ['#ffd9a0', '#0b0b0c'], ['#f0dcc0', '#0b0b0c'], ['#bdb6a8', '#0b0b0c'], ['#8d897f', '#fff1d6']];
const GLYPHS = ['.', ':', '-', '=', '+', '*', '#', '%', '@', '/', '<', '>'];
const pick = list => list[Math.floor(Math.random() * list.length)];

if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
  const blocks = Array.from({ length: POOL }, () => {
    const b = document.createElement('div');
    b.className = 'trail-block';
    b.setAttribute('aria-hidden', 'true');
    document.body.append(b);
    return b;
  });
  let next = 0, lastX = NaN, lastY = NaN;

  const onMove = e => {
    if (e.target.closest('a, button, [data-trail-ignore]')) return;
    const x = snap(e.clientX), y = snap(e.clientY);
    if (x === lastX && y === lastY) return;               // only when the pointer enters a new cell
    lastX = x; lastY = y;
    const b = blocks[next = (next + 1) % POOL];           // recycle the pool round-robin
    b.style.transform = `translate(${x}px, ${y}px)`;
    [b.style.backgroundColor, b.style.color] = pick(COLORS);
    b.textContent = Math.random() < 0.3 ? '' : pick(GLYPHS);
    b.classList.add('active');
    clearTimeout(b.fade);
    b.fade = setTimeout(() => b.classList.remove('active'), 300 + 500 * Math.random());
  };

  for (const area of document.querySelectorAll('[data-trail]')) area.addEventListener('mousemove', onMove);
}

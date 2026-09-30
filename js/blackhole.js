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

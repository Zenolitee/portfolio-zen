// Projects page "stage": one big viewer, a tab per project.
// - tabs: click or arrow keys; a sliding ink line follows the active tab; the URL hash (#seer) picks the tab
// - each project's screenshots crossfade, auto-advance with a progress bar, and pause on hover/focus
// - the screen tilts a little toward the pointer, with a soft glare in the project's colour
// Without JS every project is simply listed. Reduced motion: no autoplay, no tilt, instant swaps.

export const AUTOPLAY_MS = 5000;
export const MAX_TILT = 5; // degrees

// index that wraps around both ends
export const wrap = (i, n) => ((i % n) + n) % n;

// which panel a URL hash points to, or the fallback when it names none
export const panelFromHash = (hash, ids, fallback = ids[0]) => {
  const id = decodeURIComponent((hash || '').replace(/^#/, ''));
  return ids.includes(id) ? id : fallback;
};

// pointer position inside a box -> tilt in degrees (pointer right/down tips that edge away)
export const tiltFor = (x, y, w, h, max = MAX_TILT) => {
  const nx = Math.min(Math.max(x / w, 0), 1) - 0.5;
  const ny = Math.min(Math.max(y / h, 0), 1) - 0.5;
  return { rx: +(-ny * 2 * max).toFixed(2), ry: +(nx * 2 * max).toFixed(2) };
};

if (typeof window !== 'undefined') {
  const stage = document.querySelector('[data-stage]');
  if (stage) mount(stage);
}

function mount(stage) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tabs = [...stage.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  const ids = panels.map(p => p.id);
  const ink = stage.querySelector('.stage-ink');
  stage.classList.add('is-enhanced');

  // ---- per-panel screenshot viewer ----
  const viewers = new Map(panels.map(p => [p, viewer(p, still)]));

  // ---- tabs ----
  let current = null;
  function select(id, { focus = false, push = false } = {}) {
    const i = Math.max(ids.indexOf(id), 0);
    tabs.forEach((t, j) => {
      const on = j === i;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, j) => {
      const on = j === i;
      p.hidden = !on;
      if (on) { p.classList.remove('is-entering'); void p.offsetWidth; p.classList.add('is-entering'); }
      viewers.get(p)[on ? 'start' : 'stop']();
    });
    stage.style.setProperty('--tint', getComputedStyle(tabs[i]).getPropertyValue('--tint'));
    moveInk(tabs[i]);
    if (focus) tabs[i].focus();
    if (push && current !== null) history.replaceState(null, '', `#${ids[i]}`);
    current = i;
  }
  function moveInk(tab) {
    if (!ink) return;
    ink.style.width = `${tab.offsetWidth}px`;
    ink.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(ids[i], { push: true }));
    t.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (step) { e.preventDefault(); select(ids[wrap(i + step, ids.length)], { focus: true, push: true }); }
      if (e.key === 'Home') { e.preventDefault(); select(ids[0], { focus: true, push: true }); }
      if (e.key === 'End') { e.preventDefault(); select(ids.at(-1), { focus: true, push: true }); }
    });
  });
  addEventListener('hashchange', () => select(panelFromHash(location.hash, ids)));
  addEventListener('resize', () => current !== null && moveInk(tabs[current]));
  document.addEventListener('visibilitychange', () => {
    const v = viewers.get(panels[current]);
    document.hidden ? v.stop() : v.start();
  });

  select(panelFromHash(location.hash, ids));
  // a #hash link jumps the browser to the panel itself, past the tabs; show the whole stage instead
  if (ids.includes(location.hash.slice(1))) scrollTo(0, Math.max(0, stage.offsetTop - 24));
  requestAnimationFrame(() => stage.classList.add('is-ready')); // enable ink transition after first paint
}

function viewer(panel, still) {
  const screen = panel.querySelector('.stage-screen');
  const shots = [...panel.querySelectorAll('.stage-shot')];
  const bar = panel.querySelector('.stage-bar span');
  let index = 0, timer = 0, startedAt = 0, remaining = AUTOPLAY_MS, running = false, paused = false;

  // thumbnails, built from the shots themselves
  let thumbs = [];
  if (shots.length > 1) {
    const list = document.createElement('ol');
    list.className = 'stage-thumbs';
    shots.forEach((shot, i) => {
      const media = shot.querySelector('img');
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'stage-thumb';
      b.setAttribute('aria-label', `Show: ${shot.querySelector('figcaption')?.textContent ?? `screenshot ${i + 1}`}`);
      if (media) { const img = document.createElement('img'); img.src = media.currentSrc || media.src; img.alt = ''; img.loading = 'lazy'; b.append(img); }
      const cap = document.createElement('span'); cap.textContent = shot.querySelector('figcaption')?.textContent ?? ''; b.append(cap);
      b.addEventListener('click', () => { show(i); restart(); });
      li.append(b); list.append(li);
    });
    panel.querySelector('.stage-view').append(list);
    thumbs = [...list.querySelectorAll('button')];
  }

  function show(i) {
    index = i;
    shots.forEach((s, j) => {
      const on = j === i;
      s.classList.toggle('is-active', on);
      s.setAttribute('aria-hidden', !on);
      const v = s.querySelector('video');
      if (v) on && running && !still ? v.play().catch(() => {}) : v.pause();
    });
    thumbs.forEach((b, j) => b.setAttribute('aria-current', j === i));
  }

  // ---- autoplay with a progress bar that pauses where it is ----
  const canAuto = () => shots.length > 1 && !still;
  function tick() { show(wrap(index + 1, shots.length)); restart(); }
  function run() {
    clearTimeout(timer);
    if (!canAuto() || !running || paused) return;
    startedAt = performance.now();
    timer = setTimeout(tick, remaining);
    if (bar) { bar.style.transition = `transform ${remaining}ms linear`; bar.style.transform = 'scaleX(1)'; }
  }
  function hold() {
    clearTimeout(timer);
    if (!canAuto() || !bar) return;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
    const done = 1 - remaining / AUTOPLAY_MS;
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${done})`;
  }
  function restart() {
    remaining = AUTOPLAY_MS;
    if (bar) { bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)'; void bar.offsetWidth; }
    run();
  }
  const pause = () => { if (!paused) { paused = true; hold(); } };
  const resume = () => { if (paused) { paused = false; run(); } };
  panel.querySelector('.stage-view').addEventListener('mouseenter', pause);
  panel.querySelector('.stage-view').addEventListener('mouseleave', resume);
  panel.addEventListener('focusin', pause);
  panel.addEventListener('focusout', e => { if (!panel.contains(e.relatedTarget)) resume(); });

  // ---- pointer tilt + glare ----
  if (!still && window.matchMedia('(pointer: fine)').matches) {
    screen.addEventListener('pointermove', e => {
      const r = screen.getBoundingClientRect();
      const { rx, ry } = tiltFor(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      screen.style.setProperty('--rx', `${rx}deg`);
      screen.style.setProperty('--ry', `${ry}deg`);
      screen.style.setProperty('--gx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      screen.style.setProperty('--gy', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
      screen.classList.add('is-tilting');
    });
    screen.addEventListener('pointerleave', () => {
      screen.classList.remove('is-tilting');
      screen.style.setProperty('--rx', '0deg');
      screen.style.setProperty('--ry', '0deg');
    });
  }

  show(0);
  return {
    start() { running = true; show(index); restart(); },
    stop() { running = false; clearTimeout(timer); show(index); },
  };
}

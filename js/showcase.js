// Projects page: hovering (or focusing) a card pops out one shared preview window over it and
// plays that project's clip. Detail-page clips marked data-autoplay play on their own.
// Reduced motion keeps everything still (the window shows the poster instead).
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const canPeek = window.matchMedia('(hover: hover) and (min-width: 621px)');   // phones get stacked cards

const wrap = document.querySelector('.showcase-wrap');
if (wrap) {
  const peek = wrap.querySelector('.peek');
  const video = peek.querySelector('.peek-video');
  const poster = peek.querySelector('.peek-poster');
  let current = null, hovered = null, focused = null;

  // centre the window over the card, kept inside the row; scale it out of the card's centre
  const place = card => {
    const box = wrap.getBoundingClientRect(), c = card.getBoundingClientRect();
    const centre = c.left - box.left + c.width / 2;
    const left = Math.min(Math.max(centre - peek.offsetWidth / 2, 0), box.width - peek.offsetWidth);
    peek.style.left = `${left}px`;
    peek.style.setProperty('--origin', `${centre - left}px`);
  };

  // drop the previous clip entirely, so a still-only card never inherits it (or its progress bar)
  const stop = () => { video.pause(); video.removeAttribute('src'); video.load(); };

  const open = card => {
    if (!canPeek.matches || card === current) return;
    stop();
    current = card;
    peek.querySelector('.peek-url').textContent = card.dataset.url;
    peek.querySelector('.peek-caption').innerHTML = card.querySelector('.show-info').innerHTML;
    poster.src = card.querySelector('.show-poster').src;
    peek.classList.remove('is-playing');
    peek.style.setProperty('--progress', 0);
    place(card);
    peek.classList.add('is-open');
    // projects without footage (no data-preview) just show their still
    if (card.dataset.preview && !reduceMotion.matches) { video.src = card.dataset.preview; video.play().catch(() => {}); }
  };

  const close = () => {
    current = null;
    peek.classList.remove('is-open', 'is-playing');
    stop();
  };

  // the window follows whichever card the pointer or focus last moved to; when one lets go,
  // fall back to the card the other still holds, and close only when neither holds one
  const release = () => { const card = hovered || focused; if (card) open(card); else close(); };

  video.addEventListener('playing', () => peek.classList.add('is-playing'));   // fade in once frames exist
  video.addEventListener('timeupdate', () => peek.style.setProperty('--progress', video.currentTime / video.duration || 0));

  for (const card of wrap.querySelectorAll('.show')) {
    card.addEventListener('mouseenter', () => { hovered = card; open(card); });
    card.addEventListener('mouseleave', () => { hovered = null; release(); });
    card.addEventListener('focus', () => { focused = card; open(card); });
    card.addEventListener('blur', () => { focused = null; release(); });
  }

  // Escape dismisses the pop-out without moving the pointer or focus (WCAG 1.4.13)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && current) close(); });

  // the window's width is a percentage but its left is in pixels: re-place it on resize,
  // or close it once the layout switches to stacked cards (where CSS hides it)
  window.addEventListener('resize', () => {
    if (!current) return;
    if (canPeek.matches) place(current); else close();
  });
}

for (const video of document.querySelectorAll('video[data-autoplay]')) {
  if (!reduceMotion.matches) video.play().catch(() => {});
}

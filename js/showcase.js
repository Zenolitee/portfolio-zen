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
  let current = null;

  // centre the window over the card, kept inside the row; scale it out of the card's centre
  const place = card => {
    const box = wrap.getBoundingClientRect(), c = card.getBoundingClientRect();
    const centre = c.left - box.left + c.width / 2;
    const left = Math.min(Math.max(centre - peek.offsetWidth / 2, 0), box.width - peek.offsetWidth);
    peek.style.left = `${left}px`;
    peek.style.setProperty('--origin', `${centre - left}px`);
  };

  const open = card => {
    if (!canPeek.matches) return;
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

  const close = card => {
    if (current !== card) return;
    current = null;
    peek.classList.remove('is-open', 'is-playing');
    video.pause();
    video.removeAttribute('src');
  };

  video.addEventListener('playing', () => peek.classList.add('is-playing'));   // fade in once frames exist
  video.addEventListener('timeupdate', () => peek.style.setProperty('--progress', video.currentTime / video.duration || 0));

  for (const card of wrap.querySelectorAll('.show')) {
    card.addEventListener('mouseenter', () => open(card));
    card.addEventListener('mouseleave', () => close(card));
    card.addEventListener('focus', () => open(card));
    card.addEventListener('blur', () => close(card));
  }
}

for (const video of document.querySelectorAll('video[data-autoplay]')) {
  if (!reduceMotion.matches) video.play().catch(() => {});
}

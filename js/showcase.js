// Projects page: hovering (or focusing) a card that has footage plays its clip over the poster.
// Detail-page clips marked data-autoplay play on their own.
// Reduced motion keeps everything still (the poster stays).
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// drop the clip entirely when it stops, so it doesn't keep downloading or holding memory
const stop = (card, video) => { card.classList.remove('is-playing'); video.pause(); video.removeAttribute('src'); video.load(); };

for (const link of document.querySelectorAll('.show-link[data-preview]')) {
  const card = link.closest('.show');
  const video = card.querySelector('.show-video');
  const play = () => {
    if (reduceMotion.matches || video.getAttribute('src')) return;
    video.src = link.dataset.preview;
    video.play().catch(() => {});
  };
  video.addEventListener('playing', () => card.classList.add('is-playing'));   // fade in once frames exist
  link.addEventListener('mouseenter', play);
  link.addEventListener('focus', play);
  link.addEventListener('mouseleave', () => { if (document.activeElement !== link) stop(card, video); });
  link.addEventListener('blur', () => { if (!link.matches(':hover')) stop(card, video); });
}

for (const video of document.querySelectorAll('video[data-autoplay]')) {
  if (!reduceMotion.matches) video.play().catch(() => {});
}

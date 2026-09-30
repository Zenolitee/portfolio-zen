// Project previews: a row's clip plays only while it's hovered or focused (posters otherwise);
// detail-page clips marked data-autoplay play on their own. Reduced motion keeps everything still.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

for (const row of document.querySelectorAll('.show')) {
  const video = row.querySelector('video');
  const play = () => { if (!reduceMotion.matches) video.play().catch(() => {}); };
  const stop = () => { row.classList.remove('is-playing'); video.pause(); video.currentTime = 0; };
  video.addEventListener('playing', () => row.classList.add('is-playing'));   // fade in once frames exist
  row.addEventListener('mouseenter', play);
  row.addEventListener('mouseleave', stop);
  row.addEventListener('focus', play);
  row.addEventListener('blur', stop);
}

for (const video of document.querySelectorAll('video[data-autoplay]')) {
  if (!reduceMotion.matches) video.play().catch(() => {});
}

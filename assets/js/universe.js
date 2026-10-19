/* Shared progressive enhancements; destinations remain ordinary HTML links. */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = document.getElementById('portal-portrait');
  if (portrait) {
    const photos = [...(window.UNIVERSE_PHOTOS || [])];
    const storageKey = 'marsfan.home.lastPortrait';
    let previous = '';
    try { previous = sessionStorage.getItem(storageKey) || ''; } catch { /* Storage is optional. */ }
    for (let i = photos.length - 1; i > 0; i--) {
      const other = Math.floor(Math.random() * (i + 1));
      [photos[i], photos[other]] = [photos[other], photos[i]];
    }
    photos.sort((a, b) => Number(a.src === previous) - Number(b.src === previous));
    const loadPortrait = (position = 0) => {
      if (position >= photos.length) {
        portrait.hidden = true;
        document.body.dataset.portrait = 'unavailable';
        return;
      }
      const photo = photos[position];
      const candidate = new Image();
      let settled = false;
      const timeout = window.setTimeout(() => finish(false), 8000);
      function finish(success) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        candidate.onload = candidate.onerror = null;
        if (!success) { loadPortrait(position + 1); return; }
        portrait.src = candidate.src;
        portrait.style.setProperty('--portrait-position', photo.position || '50% 32%');
        portrait.classList.add('is-loaded');
        document.body.dataset.portrait = photo.src;
        try { sessionStorage.setItem(storageKey, photo.src); } catch { /* Storage is optional. */ }
      }
      candidate.onload = () => finish(candidate.naturalWidth > 0);
      candidate.onerror = () => finish(false);
      candidate.decoding = 'async';
      candidate.fetchPriority = 'high';
      candidate.src = photo.src;
    };
    loadPortrait();
  }
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.portal').forEach((portal) => {
    let frame = 0;
    portal.addEventListener('pointermove', (event) => {
      if (reducedMotion.matches || !finePointer.matches || frame) return;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        const bounds = portal.getBoundingClientRect();
        portal.style.setProperty('--pointer-x', `${clientX - bounds.left}px`);
        portal.style.setProperty('--pointer-y', `${clientY - bounds.top}px`);
        frame = 0;
      });
    }, { passive: true });
  });
  let leaving = false;
  document.querySelectorAll('a[data-transition]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) return;
      if (link.target && link.target !== '_self') return;
      const target = new URL(link.href, location.href);
      if (target.origin !== location.origin) return;
      event.preventDefault();
      if (leaving) return;
      leaving = true;
      document.body.classList.add('is-leaving');
      window.setTimeout(() => location.assign(target.href), 380);
    });
  });
  window.addEventListener('pageshow', () => {
    leaving = false;
    document.body.classList.remove('is-leaving');
  });
})();

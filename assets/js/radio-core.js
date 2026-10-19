/* Pure playlist and preference helpers, shared with the regression tests. */
((root) => {
  'use strict';
  function shuffle(count, previous = -1, random = Math.random) {
    const order = Array.from({ length: count }, (_, index) => index);
    for (let index = count - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    if (count > 1 && order[0] === previous) [order[0], order[1]] = [order[1], order[0]];
    return order;
  }
  function preferences(raw) {
    let saved;
    try { saved = JSON.parse(raw); } catch { /* Invalid or absent storage is harmless. */ }
    return {
      volume: typeof saved?.volume === 'number' && Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : .35,
      muted: saved?.muted === true
    };
  }
  root.MarsRadioCore = { shuffle, preferences };
})(typeof window === 'undefined' ? globalThis : window);

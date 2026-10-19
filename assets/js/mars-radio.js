/* One page, one audio element. No playback before an explicit user gesture. */
(() => {
  'use strict';
  const player = document.getElementById('mars-player');
  if (!player) return;
  const tracks = window.MARS_TRACKS || [];
  const { shuffle, preferences } = window.MarsRadioCore;
  const $ = (id) => document.getElementById(id);
  const audio = $('mars-audio');
  const siteBase = new URL('../../', document.currentScript.src);
  const storageKey = 'marsfan.radio.preferences.v1';
  let saved = null;
  try { saved = localStorage.getItem(storageKey); } catch { /* Private browsing can block storage. */ }
  const prefs = preferences(saved);
  audio.volume = prefs.volume;
  audio.muted = prefs.muted;
  let order = shuffle(tracks.length);
  let position = 0;
  let desiredPlaying = false;
  let revision = 0;
  let resumeVolume = prefs.volume || .35;
  const failed = new Set();
  const currentIndex = () => order[position];
  const currentURL = () => new URL(tracks[currentIndex()].src, siteBase).href;
  const status = (text) => { $('mars-status').textContent = text; };

  function renderVolume() {
    const silent = audio.muted || audio.volume === 0;
    $('mars-volume').value = String(Math.round(audio.volume * 100));
    $('mars-volume-value').textContent = `${Math.round(audio.volume * 100)}%`;
    $('mars-mute').setAttribute('aria-pressed', String(silent));
    $('mars-mute').setAttribute('aria-label', silent ? '取消静音' : '静音');
    $('mars-sound-icon').setAttribute('href', silent ? '#radio-muted' : '#radio-sound');
  }
  function persistVolume() {
    if (audio.volume > 0) resumeVolume = audio.volume;
    renderVolume();
    try { localStorage.setItem(storageKey, JSON.stringify({ volume: audio.volume, muted: audio.muted })); } catch { /* Controls still work without persistence. */ }
  }
  function renderPlayback(playing) {
    player.dataset.state = playing ? 'playing' : 'paused';
    $('mars-play').setAttribute('aria-pressed', String(playing));
    $('mars-play').setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
    $('mars-play-icon').setAttribute('href', playing ? '#radio-pause' : '#radio-play');
  }
  function renderTrack() {
    const track = tracks[currentIndex()];
    $('mars-title').textContent = track.title;
    $('mars-title').title = track.title;
    $('mars-artist').textContent = track.artist;
    $('mars-track').value = String(currentIndex());
    $('mars-track-count').textContent = `${tracks.length} TRACKS / SHUFFLE`;
  }
  function pause(message = '已暂停 · 点播放继续') {
    desiredPlaying = false;
    revision++;
    audio.pause();
    renderPlayback(false);
    status(message);
  }
  function play() {
    if (document.hidden) { pause('页面在后台 · 返回后点播放继续'); return; }
    desiredPlaying = true;
    const request = ++revision;
    if (audio.src !== currentURL()) audio.src = currentURL();
    status('音乐载入中…');
    // Call play synchronously inside the user's click/key event, before any await.
    try {
      Promise.resolve(audio.play()).then(() => {
        if (request !== revision) return;
        if (document.hidden || !desiredPlaying) { pause(); return; }
        failed.clear();
        renderPlayback(true);
        status('随机循环播放中');
      }).catch((error) => {
        if (request !== revision || error.name === 'AbortError') return;
        if (error.name === 'NotAllowedError') pause('浏览器暂未允许播放 · 请再点播放');
        else recover();
      });
    } catch (error) {
      if (error.name === 'NotAllowedError') pause('浏览器暂未允许播放 · 请再点播放');
      else recover();
    }
  }
  function select(nextPosition, resume) {
    revision++;
    desiredPlaying = false;
    audio.pause();
    position = nextPosition;
    audio.src = currentURL();
    renderTrack();
    renderPlayback(false);
    if (resume) play();
    else status('已选好这首 · 点播放开始');
  }
  function step(direction, resume = desiredPlaying) {
    let next = position + direction;
    if (next >= order.length) {
      order = shuffle(tracks.length, currentIndex());
      next = 0;
    }
    if (next < 0) next = order.length - 1;
    select(next, resume);
  }
  function recover() {
    if (!desiredPlaying || document.hidden) return;
    failed.add(currentIndex());
    const next = order.findIndex((index) => !failed.has(index));
    if (next < 0) { pause('音乐暂时无法加载 · 请稍后重试'); return; }
    select(next, true);
  }

  if (!tracks.length) {
    status('暂时没有可播放的音乐');
    player.querySelectorAll('button, select, input').forEach((control) => { control.disabled = true; });
    return;
  }
  tracks.forEach((track, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${track.title} — ${track.artist}`;
    $('mars-track').append(option);
  });
  renderTrack();
  renderVolume();
  renderPlayback(false);
  player.hidden = false;
  status('点播放，开启这段随机旅程');
  $('mars-play').addEventListener('click', () => {
    if (desiredPlaying) pause();
    else { failed.clear(); play(); }
  });
  $('mars-prev').addEventListener('click', () => { failed.clear(); step(-1); });
  $('mars-next').addEventListener('click', () => { failed.clear(); step(1); });
  $('mars-track').addEventListener('change', () => {
    const next = order.indexOf(Number($('mars-track').value));
    if (next >= 0) { failed.clear(); select(next, desiredPlaying); }
  });
  $('mars-mute').addEventListener('click', () => {
    if (audio.volume === 0) { audio.volume = resumeVolume; audio.muted = false; }
    else audio.muted = !audio.muted;
    persistVolume();
  });
  $('mars-volume').addEventListener('input', () => {
    audio.volume = Math.min(1, Math.max(0, Number($('mars-volume').value) / 100));
    audio.muted = false;
    persistVolume();
  });
  $('mars-fold').addEventListener('click', () => {
    const expanded = $('mars-fold').getAttribute('aria-expanded') !== 'true';
    $('mars-details').hidden = !expanded;
    document.body.classList.toggle('radio-expanded', expanded);
    $('mars-fold').setAttribute('aria-expanded', String(expanded));
    $('mars-fold').setAttribute('aria-label', expanded ? '收起播放器' : '展开播放器');
  });
  audio.addEventListener('ended', () => { if (desiredPlaying && !document.hidden) step(1, true); });
  audio.addEventListener('error', () => {
    // Ignore errors belonging to a superseded source after a rapid track change.
    if (audio.currentSrc === currentURL()) recover();
  });
  audio.addEventListener('pause', () => {
    if (!audio.paused) return;
    renderPlayback(false);
    if (desiredPlaying && !audio.ended) {
      desiredPlaying = false;
      revision++;
      status('音乐已暂停 · 点播放继续');
    }
  });
  audio.addEventListener('play', () => {
    if (document.hidden || !desiredPlaying) { audio.pause(); return; }
    renderPlayback(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('页面已离开 · 点播放继续');
  });
  window.addEventListener('pagehide', () => pause('页面已离开 · 点播放继续'));
  window.addEventListener('beforeunload', () => pause());
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin || target.pathname !== location.pathname || target.search !== location.search) pause('页面已离开 · 点播放继续');
  }, true);
})();

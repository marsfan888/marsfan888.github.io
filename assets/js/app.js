/* A buildless, dependency-free love museum. */
(() => {
  'use strict';
  const config = window.LOVE_CONFIG || {};
  const { parseDay, togetherDays, millisecondsUntilShanghaiMidnight, swipeDirection } = window.LoveUtils;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const total = 12;
  // Shuffle once per visit. Every view shares this order; original IDs stay stable.
  const photoOrder = Array.from({ length: total }, (_, number) => number);
  for (let position = total - 1; position > 0; position--) {
    const other = Math.floor(Math.random() * (position + 1));
    [photoOrder[position], photoOrder[other]] = [photoOrder[other], photoOrder[position]];
  }
  const mediaBase = new URL('../images/', document.currentScript.src);
  const originalPhotoPath = (number, kind = 'display') => new URL(`${kind}/photo-${String(number + 1).padStart(2, '0')}.${kind === 'originals' ? 'jpg' : 'webp'}`, mediaBase).href;
  const photoPath = (position, kind = 'display') => originalPhotoPath(photoOrder[position], kind);
  const countText = (index) => `${String(index + 1).padStart(2, '0')} / ${total}`;
  const noteFor = (position) => config.photoNotes?.[photoOrder[position]] || '把每一个可爱的你，都收藏在心里。';
  const names = config.names || { recipient: '小叮当', author: '火星凡' };
  document.querySelectorAll('[data-recipient]').forEach((node) => { node.textContent = names.recipient; });
  document.querySelectorAll('[data-author]').forEach((node) => { node.textContent = names.author; });
  $('main-photo').src = photoPath(0);
  $('photo-note').textContent = noteFor(0);

  let index = 0;
  let requestId = 0;
  let autoplay = false;
  let flipped = false;
  let completed = false;
  let interval = null;
  let elapsed = 0;
  let lastTick = 0;
  let loading = false;
  let introClosing = false;
  let toastTimer;
  const duration = Math.max(3000, (Number(config.slideshowSeconds) || 6.4) * 1000);
  const audio = $('music');
  audio.volume = 0.45;
  const dialogs = [$('intro-dialog'), $('lightbox'), $('letter-dialog')];
  const anyModal = () => dialogs.some((dialog) => dialog.open);
  const showToast = (message) => {
    $('toast').textContent = message;
    $('toast').hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { $('toast').hidden = true; }, 4200);
  };

  function setProgress(value) {
    $('progress-fill').style.width = `${value}%`;
    $('slide-progress').setAttribute('aria-valuenow', String(Math.round(value)));
  }
  function resetProgress() { elapsed = 0; lastTick = performance.now(); setProgress(0); }
  function syncTimer() {
    if (interval !== null) window.clearInterval(interval);
    interval = null;
    lastTick = performance.now();
    if (!autoplay || flipped || loading || document.hidden || anyModal()) return;
    interval = window.setInterval(() => {
      const now = performance.now();
      elapsed += Math.min(now - lastTick, 400);
      lastTick = now;
      setProgress(Math.min(100, elapsed / duration * 100));
      if (elapsed >= duration) {
        if (index === total - 1) setAutoplay(false);
        else showPhoto(index + 1);
      }
    }, 200);
  }
  function setAutoplay(value) {
    autoplay = value;
    $('autoplay').setAttribute('aria-pressed', String(value));
    $('autoplay-label').textContent = value ? '暂停播放' : '自动播放';
    $('autoplay-icon').setAttribute('href', value ? '#i-pause' : '#i-play');
    syncTimer();
  }
  function setFlipped(value) {
    flipped = value;
    $('photo-card').classList.toggle('is-flipped', value);
    $('flip').setAttribute('aria-pressed', String(value));
    $('flip').querySelector('span').textContent = value ? '翻回照片' : '背面情话';
    $('card-front').inert = value;
    $('card-front').setAttribute('aria-hidden', String(value));
    $('card-back').inert = !value;
    $('card-back').setAttribute('aria-hidden', String(!value));
    syncTimer();
  }
  function markCompleted() {
    completed = true;
    $('final-access').hidden = false;
    $('ending-button').innerHTML = '拆开最后一封信 <svg aria-hidden="true"><use href="#i-heart"/></svg>';
    $('gallery-help').textContent = '最后一个瞬间，还有一封信等你拆开。';
  }
  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = path;
    });
  }
  function preloadNext() {
    if (index + 1 < total) {
      const next = new Image();
      next.decoding = 'async';
      next.src = photoPath(index + 1);
    }
  }
  async function showPhoto(next) {
    const target = (next + total) % total;
    const id = ++requestId;
    loading = true;
    setFlipped(false);
    $('photo-open').classList.add('is-loading');
    $('photo-open').setAttribute('aria-busy', 'true');
    syncTimer();
    try {
      const [image] = await Promise.all([
        loadImage(photoPath(target)),
        new Promise((resolve) => window.setTimeout(resolve, reduceMotion.matches ? 0 : 220))
      ]);
      // Rapid taps may finish out of order; only commit the most recent request.
      if (id !== requestId) return;
      index = target;
      $('main-photo').src = image.src;
      $('main-photo').alt = `${names.recipient}的珍藏照片，第 ${index + 1} 张，共 ${total} 张`;
      $('main-photo').width = image.naturalWidth;
      $('main-photo').height = image.naturalHeight;
      $('photo-open').setAttribute('aria-label', `放大第 ${index + 1} 张照片`);
      $('gallery-count').textContent = countText(index);
      $('frame-count').textContent = `MOMENT ${countText(index)}`;
      $('photo-note').textContent = noteFor(index);
      document.querySelectorAll('.photo-dot').forEach((dot, number) => dot.setAttribute('aria-current', String(number === index)));
      if ($('lightbox').open) updateLightbox();
      if (index === total - 1) { markCompleted(); setAutoplay(false); }
      else if (!completed) $('gallery-help').textContent = '左右滑动换页 · 轻点照片放大 · 翻到背面读情话';
      resetProgress();
      preloadNext();
    } catch (error) {
      if (id === requestId) {
        setAutoplay(false);
        showToast('这张照片暂时没有加载成功，请再试一次。');
      }
    } finally {
      if (id === requestId) {
        loading = false;
        $('photo-open').classList.remove('is-loading');
        $('photo-open').removeAttribute('aria-busy');
        syncTimer();
      }
    }
  }
  function navigate(delta) { showPhoto(index + delta); }
  $('prev').addEventListener('click', () => navigate(-1));
  $('next').addEventListener('click', () => navigate(1));
  $('flip').addEventListener('click', () => setFlipped(!flipped));
  $('unflip').addEventListener('click', () => { setFlipped(false); $('flip').focus({ preventScroll: true }); });
  function startSlideshow() {
    if (index === total - 1) showPhoto(0);
    resetProgress(); setAutoplay(true);
  }
  $('autoplay').addEventListener('click', () => { if (autoplay) setAutoplay(false); else startSlideshow(); });
  $('album').addEventListener('keydown', (event) => {
    if (anyModal()) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
    else if (event.code === 'Space' && event.target === $('album')) { event.preventDefault(); setAutoplay(!autoplay); }
  });

  for (let number = 0; number < total; number++) {
    const dot = document.createElement('button');
    dot.type = 'button'; dot.className = 'photo-dot';
    dot.setAttribute('aria-label', `查看第 ${number + 1} 张照片`);
    dot.setAttribute('aria-current', String(number === 0));
    dot.addEventListener('click', () => showPhoto(number));
    $('photo-dots').append(dot);
    const thumbnail = document.createElement('button');
    thumbnail.type = 'button'; thumbnail.className = 'mini-photo';
    thumbnail.style.setProperty('--tilt', `${[-3, 2, -1.5, 2.7, -2, 1.5][number % 6]}deg`);
    thumbnail.setAttribute('aria-label', `在相册中查看第 ${number + 1} 张照片`);
    const image = document.createElement('img');
    image.src = photoPath(number, 'thumbs'); image.alt = `${names.recipient}的珍藏照片 ${number + 1}`;
    image.width = 420; image.height = 480; image.loading = 'lazy'; image.decoding = 'async';
    const caption = document.createElement('span'); caption.textContent = `MOMENT ${String(number + 1).padStart(2, '0')}`;
    thumbnail.append(image, caption);
    thumbnail.addEventListener('click', () => {
      setAutoplay(false); showPhoto(number); $('album').scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'center' });
      $('album').focus({ preventScroll: true });
    });
    (number < 6 ? $('photo-strip') : $('collection-extra')).append(thumbnail);
  }
  $('collection-toggle').addEventListener('click', () => {
    const expand = $('collection-extra').hidden;
    $('collection-extra').hidden = !expand;
    $('collection-toggle').setAttribute('aria-expanded', String(expand));
    $('collection-toggle').textContent = expand ? '收起后六个瞬间 −' : '展开全部 12 个瞬间 ＋';
  });

  // Passive touch handling leaves vertical scrolling and pinch zoom to the browser.
  function swipe(surface) {
    let start = null;
    let swiped = false;
    surface.addEventListener('touchstart', (event) => {
      start = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
      swiped = false;
    }, { passive: true });
    surface.addEventListener('touchmove', (event) => { if (event.touches.length !== 1) start = null; }, { passive: true });
    surface.addEventListener('touchend', (event) => {
      if (start && event.changedTouches.length) {
        const direction = swipeDirection(start, { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY });
        if (direction) { swiped = true; navigate(direction); }
      }
      start = null;
    }, { passive: true });
    surface.addEventListener('touchcancel', () => { start = null; }, { passive: true });
    surface.addEventListener('click', (event) => {
      if (swiped) { event.preventDefault(); event.stopImmediatePropagation(); swiped = false; }
    }, true);
  }
  swipe($('album-stage')); swipe($('lightbox-stage'));

  function syncMusic() {
    const playing = !audio.paused && !audio.ended;
    document.body.classList.toggle('is-playing', playing);
    $('music-label').textContent = playing ? '音乐开' : '音乐关';
    $('music-toggle').setAttribute('aria-pressed', String(playing));
    $('music-toggle').setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
  }
  function audioFallback() {
    $('audio-fallback').hidden = false;
    audio.controls = true;
    $('audio-message').textContent = audio.error ? '音乐暂时无法加载，请检查音乐文件后重试。' : '轻点下方播放键，让音乐继续陪你。';
    syncMusic();
  }
  function playMusic() {
    // Call play directly inside the click handler, before any animation or await (iOS).
    try { const promise = audio.play(); if (promise) promise.catch(audioFallback); }
    catch (error) { audioFallback(); }
  }
  audio.addEventListener('play', syncMusic);
  audio.addEventListener('pause', syncMusic);
  audio.addEventListener('playing', () => { syncMusic(); $('audio-fallback').hidden = true; });
  audio.addEventListener('error', () => { if (audio.currentSrc) audioFallback(); });
  $('music-toggle').addEventListener('click', () => { if (audio.paused) playMusic(); else audio.pause(); });
  $('dismiss-audio').addEventListener('click', () => { $('audio-fallback').hidden = true; $('music-toggle').focus(); });
  $('start-album').addEventListener('click', () => {
    playMusic(); startSlideshow();
    $('album').scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'center' });
    $('album').focus({ preventScroll: true });
  });

  function lockScroll() {
    if (anyModal()) {
      if (!document.body.dataset.scrollLocked) {
        document.body.dataset.scrollLocked = 'true';
        document.body.style.overflow = 'hidden';
      }
    } else {
      delete document.body.dataset.scrollLocked;
      document.body.style.overflow = '';
    }
    syncTimer();
  }
  function openDialog(dialog) {
    if (!dialog.open) { dialog.showModal(); lockScroll(); }
  }
  function closeDialog(dialog) { dialog.close(); }
  dialogs.forEach((dialog) => {
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], audio[controls], [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
    dialog.addEventListener('close', () => {
      lockScroll();
      if (dialog === $('intro-dialog')) {
        dialog.classList.remove('is-opening'); introClosing = false;
        $('start-album').focus({ preventScroll: true });
      }
    });
    dialog.addEventListener('click', (event) => {
      if (dialog === $('intro-dialog') || event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog(dialog);
    });
  });
  function enterMuseum(withMusic) {
    if (introClosing) return;
    introClosing = true;
    if (withMusic) { playMusic(); startSlideshow(); }
    $('intro-dialog').classList.add('is-opening');
    window.setTimeout(() => closeDialog($('intro-dialog')), reduceMotion.matches ? 0 : 650);
  }
  $('open-envelope').addEventListener('click', () => enterMuseum(true));
  $('skip-intro').addEventListener('click', () => enterMuseum(false));
  $('replay-intro').addEventListener('click', () => {
    audio.pause(); setAutoplay(false); openDialog($('intro-dialog'));
  });
  $('intro-dialog').addEventListener('cancel', (event) => { event.preventDefault(); enterMuseum(false); });

  function updateLightbox() {
    $('lightbox-image').src = photoPath(index);
    $('lightbox-image').alt = `${names.recipient}的珍藏照片，第 ${index + 1} 张，共 ${total} 张`;
    $('lightbox-count').textContent = countText(index);
    $('lightbox-note').textContent = noteFor(index);
    $('original-link').href = photoPath(index, 'originals');
  }
  $('photo-open').addEventListener('click', () => { updateLightbox(); openDialog($('lightbox')); });
  $('close-lightbox').addEventListener('click', () => closeDialog($('lightbox')));
  $('lightbox-prev').addEventListener('click', () => navigate(-1));
  $('lightbox-next').addEventListener('click', () => navigate(1));
  $('lightbox').addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
  });
  $('close-letter').addEventListener('click', () => closeDialog($('letter-dialog')));
  function openLetter() { setAutoplay(false); openDialog($('letter-dialog')); }
  $('final-access').addEventListener('click', openLetter);
  $('ending-button').addEventListener('click', () => {
    if (completed) openLetter();
    else {
      showToast('先翻到相册最后一张吧，信已经替你收好。');
      $('album').scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'center' });
      $('album').focus({ preventScroll: true });
    }
  });
  const letter = config.finalLetter || {};
  $('letter-salutation').textContent = letter.salutation || `亲爱的${names.recipient}：`;
  (letter.paragraphs || ['把每一个可爱的你，都收藏在心里。']).forEach((text) => {
    const paragraph = document.createElement('p'); paragraph.textContent = text; $('letter-paragraphs').append(paragraph);
  });
  $('letter-closing').textContent = letter.closing || `${names.author} · 写给${names.recipient}`;

  let previousNote = -1;
  const notes = config.sweetNotes?.length ? config.sweetNotes : ['今日份的偏爱，也全部属于你。'];
  $('new-note').addEventListener('click', () => {
    let choice = Math.floor(Math.random() * notes.length);
    if (notes.length > 1 && choice === previousNote) choice = (choice + 1) % notes.length;
    previousNote = choice;
    $('sweet-note').textContent = notes[choice];
    $('note-paper').classList.remove('unfold');
    void $('note-paper').offsetWidth;
    $('note-paper').classList.add('unfold');
  });
  let secretClicks = 0;
  $('secret-text').textContent = config.secretLetter || '你就是我最喜欢的样子。';
  $('secret-heart').addEventListener('click', () => {
    secretClicks++;
    $('secret-heart').classList.remove('pulse');
    void $('secret-heart').offsetWidth;
    $('secret-heart').classList.add('pulse');
    if (secretClicks >= 3) {
      $('secret-letter').hidden = false;
      $('secret-heart').setAttribute('aria-expanded', 'true');
      $('secret-hint').textContent = '你发现了，藏起来的那一点偏爱。';
    } else {
      $('secret-hint').textContent = secretClicks === 1 ? '好像有一封信，再轻触两下心印试试。' : '再轻轻碰一下，就告诉你。';
    }
  });

  function renderAnniversary() {
    const dayCount = togetherDays(config.relationshipStart);
    if (dayCount === null) return;
    const number = $('day-number');
    const nextText = dayCount.toLocaleString('zh-CN');
    if (number.textContent !== nextText) {
      number.textContent = nextText;
      if (!reduceMotion.matches) {
        number.classList.remove('is-updated');
        void number.offsetWidth;
        number.classList.add('is-updated');
      }
    }
    $('anniversary-date').dateTime = config.relationshipStart;
    $('anniversary-date').textContent = config.relationshipStart.replaceAll('-', '.');
  }
  let anniversaryTimer;
  function refreshAnniversary() {
    window.clearTimeout(anniversaryTimer);
    renderAnniversary();
    // Re-arm at each Beijing midnight; a small buffer avoids firing just before the boundary.
    anniversaryTimer = window.setTimeout(refreshAnniversary, millisecondsUntilShanghaiMidnight() + 50);
  }
  refreshAnniversary();
  document.addEventListener('visibilitychange', () => { syncTimer(); if (!document.hidden) refreshAnniversary(); });
  window.addEventListener('pageshow', refreshAnniversary);
  window.addEventListener('focus', refreshAnniversary);

  const memories = Array.isArray(config.memories) ? config.memories : [];
  const emptyMemories = [
    { title: '故事的开始', story: '留一个位置，写下我们故事开始的那一天。' },
    { title: '想珍藏的日常', story: '某一个值得记下的瞬间，等我们亲手放进这里。' },
    { title: '下一次心动', story: '未来还有好多页，慢慢走，也慢慢写。' }
  ];
  if (memories.length) $('timeline-description').textContent = '沿着时间的线，重温那些认真收藏的瞬间。';
  (memories.length ? memories : emptyMemories).forEach((memory) => {
    const entry = document.createElement('article'); entry.className = `memory-entry${memories.length ? '' : ' is-empty'}`;
    const date = document.createElement('p'); date.className = 'memory-date';
    if (memories.length && parseDay(memory.date) !== null) {
      const time = document.createElement('time'); time.dateTime = memory.date; time.textContent = memory.date.replaceAll('-', '.'); date.append(time);
    } else date.textContent = memories.length ? '日期待填写' : '留白页 · 尚未填写真实回忆';
    const title = document.createElement('h3'); title.textContent = memory.title || '我们的回忆';
    const story = document.createElement('p'); story.textContent = memory.story || '';
    entry.append(date, title, story);
    if (Number.isInteger(memory.photo) && memory.photo >= 1 && memory.photo <= total) {
      const image = document.createElement('img'); image.src = originalPhotoPath(memory.photo - 1, 'thumbs'); image.alt = `${title.textContent}，照片 ${memory.photo}`;
      image.loading = 'lazy'; image.decoding = 'async'; entry.append(image);
    }
    $('timeline').append(entry);
  });
  openDialog($('intro-dialog'));
})();

(function () {
  const slides = [
    'index.html',
    'slide-1-existing.html',
    'slide-1-updated.html',
    'slide-2.html',
    'slide-3.html',
    'slide-4-existing.html',
    'slide-4-updated.html'
  ];

  function detectCurrent() {
    const ds = document.body && document.body.dataset && document.body.dataset.slide;
    if (ds) {
      const byData = ds + '.html';
      if (slides.indexOf(byData) !== -1) return byData;
    }
    const path = location.pathname.toLowerCase();
    for (let i = 0; i < slides.length; i++) {
      if (path.endsWith('/' + slides[i]) || path.endsWith(slides[i])) return slides[i];
    }
    if (path === '' || path === '/' || path.endsWith('/')) return 'index.html';
    return 'index.html';
  }
  const current = detectCurrent();
  const idx = slides.indexOf(current);

  function go(delta) {
    if (idx < 0) return;
    const next = idx + delta;
    if (next < 0 || next >= slides.length) return;
    location.href = slides[next];
  }
  const forward = () => go(1);
  const back = () => go(-1);

  function isInteractive(el) {
    return !!(el && el.closest && el.closest('a, button, input, textarea, select, label, [data-nav-ignore]'));
  }
  function hasSelection() {
    const sel = window.getSelection && window.getSelection();
    return !!(sel && sel.toString && sel.toString().length > 0);
  }

  // Keyboard: right/space → forward; left/backspace/delete → back
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.code === 'Space' || e.key === 'PageDown') {
      e.preventDefault();
      forward();
    } else if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'PageUp') {
      e.preventDefault();
      back();
    }
  });

  // Left click → forward (unless on link/button or selecting text)
  document.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    if (isInteractive(e.target)) return;
    if (hasSelection()) return;
    forward();
  });

  // Right click → back (suppress context menu)
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    back();
  });

  // Touch: swipe left → forward, swipe right → back
  let tsX = null, tsY = null, tsT = 0;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tsX = null; return; }
    tsX = e.touches[0].clientX;
    tsY = e.touches[0].clientY;
    tsT = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (tsX === null) return;
    const dx = e.changedTouches[0].clientX - tsX;
    const dy = e.changedTouches[0].clientY - tsY;
    const dt = Date.now() - tsT;
    tsX = null;
    if (dt > 800) return;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) forward();
    else back();
  }, { passive: true });

  // Scroll wheel at edges: down → forward, up → back
  let wheelLock = false;
  document.addEventListener('wheel', (e) => {
    if (wheelLock) return;
    const doc = document.documentElement;
    const atTop = window.scrollY <= 2;
    const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 2;
    const threshold = 24;
    if (e.deltaY > threshold && atBottom) {
      wheelLock = true;
      setTimeout(() => { wheelLock = false; }, 900);
      forward();
    } else if (e.deltaY < -threshold && atTop) {
      wheelLock = true;
      setTimeout(() => { wheelLock = false; }, 900);
      back();
    }
  }, { passive: true });

  // Edge hover arrows
  function makeArrow(side, handler, canGo) {
    const btn = document.createElement('button');
    btn.className = 'nav-arrow nav-arrow-' + side + (canGo ? '' : ' nav-arrow-disabled');
    btn.setAttribute('aria-label', side === 'left' ? 'Previous slide' : 'Next slide');
    btn.setAttribute('data-nav-ignore', '');
    btn.innerHTML = side === 'left'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (canGo) handler();
    });
    btn.addEventListener('contextmenu', (e) => {
      e.stopPropagation();
      e.preventDefault();
      back();
    });
    document.body.appendChild(btn);
  }

  function init() {
    if (idx < 0) return;
    makeArrow('left', back, idx > 0);
    makeArrow('right', forward, idx < slides.length - 1);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

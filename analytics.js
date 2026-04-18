(function () {
  if (window.__pitchAnalyticsLoaded) return;
  window.__pitchAnalyticsLoaded = true;

  // ── CONFIG ────────────────────────────────────────────────────────────
  var WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwVQQ73tge2QdXaFirAUIM0q9BmNnoV5v45OwIejBkxpMVsl0b-k5XP-RoEVEWNpWM-jw/exec';
  var MAX_SLIDE_SECS = 30 * 60; // cap at 30 min — handles tabs left open for days
  // ─────────────────────────────────────────────────────────────────────

  var SLIDES = {
    'index.html':           '00 - Cover',
    'slide-1-updated.html': '01 \u00b7 The Market',
    'slide-2.html':         '02 \u00b7 The Network',
    'slide-3.html':         '03 \u00b7 The Opportunity',
    'slide-4-updated.html': '04 \u00b7 The Plan',
    'slide-5.html':         '05 \u00b7 The Team'
  };

  var COOKIE = 'pitch_viewer';
  var LS_KEY = 'pitch_analytics';
  var SS_KEY = 'pitch_session';

  // Prefer the explicit data-slide attribute on <body> — pathname can be unreliable
  // depending on hosting rewrites, trailing slashes, etc.
  function detectFile() {
    var ds = document.body && document.body.dataset && document.body.dataset.slide;
    if (ds) {
      var candidate = ds + '.html';
      if (SLIDES[candidate]) return candidate;
    }
    var raw = (location.pathname.split('/').pop() || '').toLowerCase();
    if (SLIDES[raw]) return raw;
    return 'index.html';
  }
  var curFile = detectFile();
  var curName = SLIDES[curFile];

  // ── Active-time tracking (ignores backgrounded tabs) ─────────────────
  var activeMs   = 0;
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : null;

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      visibleSince = Date.now();
    } else {
      if (visibleSince !== null) { activeMs += Date.now() - visibleSince; visibleSince = null; }
    }
  });

  function activeSecs() {
    var ms = activeMs + (visibleSince !== null ? Date.now() - visibleSince : 0);
    return Math.min(MAX_SLIDE_SECS, Math.max(1, Math.round(ms / 1000)));
  }

  // ── Cookies ───────────────────────────────────────────────────────────
  function getCookie(name) {
    var found = document.cookie.split(';').map(function (c) { return c.trim(); })
      .find(function (c) { return c.startsWith(name + '='); });
    return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
  }
  function setCookie(name, value, days) {
    var exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + exp + '; path=/; SameSite=Lax';
  }

  // ── Viewer identity ───────────────────────────────────────────────────
  function resolveViewer() {
    var p = new URLSearchParams(location.search);
    var q = (p.get('viewer') || p.get('name') || '').trim();
    if (q) { setCookie(COOKIE, q, 30); return q; }
    var c = getCookie(COOKIE);
    if (c) return c;
    return null;
  }

  // ── Session ───────────────────────────────────────────────────────────
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SS_KEY)); } catch (e) { return null; }
  }
  function createSession(viewer) {
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), viewer: viewer, startedAt: new Date().toISOString(), slides: [] };
  }
  function persist(session) {
    sessionStorage.setItem(SS_KEY, JSON.stringify(session));
    try {
      var all = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      var i = all.findIndex(function (s) { return s.id === session.id; });
      if (i >= 0) all[i] = session; else all.push(session);
      localStorage.setItem(LS_KEY, JSON.stringify(all));
    } catch (e) {}
  }
  function stamp(session) {
    var dur = activeSecs();
    var i   = session.slides.findIndex(function (s) { return s.file === curFile; });
    var rec = { file: curFile, name: curName, duration: dur, at: new Date().toISOString() };
    if (i >= 0) session.slides[i] = rec; else session.slides.push(rec);
  }

  // ── Webhook ───────────────────────────────────────────────────────────
  function dispatch(session) {
    if (!WEBHOOK_URL) return;
    var body = JSON.stringify({ event: 'pitch_viewed', session: session });
    try {
      // sendBeacon is designed for beforeunload — browser guarantees delivery even mid-navigation
      if (navigator.sendBeacon) {
        navigator.sendBeacon(WEBHOOK_URL, new Blob([body], { type: 'text/plain' }));
      } else {
        fetch(WEBHOOK_URL, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: body });
      }
    } catch (e) {}
  }

  // ── Name popup ────────────────────────────────────────────────────────
  function showPopup(cb) {
    var o = document.createElement('div');
    o.id = 'pan-overlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(13,13,13,0.85);backdrop-filter:blur(8px)';
    o.innerHTML = [
      '<div style="background:#111;border:1px solid #D4A574;border-radius:16px;padding:36px 32px;',
        'max-width:360px;width:calc(100% - 48px);font-family:Manrope,sans-serif;text-align:center">',
        '<div style="font-size:11px;color:#D4A574;letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px">InTouch</div>',
        '<h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px">Who are you?</h2>',
        '<p style="color:#777;font-size:14px;line-height:1.5;margin:0 0 24px">Your name lets the founders know who\'s reviewing this deck.</p>',
        '<input id="pan-inp" type="text" placeholder="Your name" autocomplete="name" style="width:100%;box-sizing:border-box;background:#0d0d0d;border:1px solid #333;color:#fff;padding:12px 14px;border-radius:8px;font-size:15px;font-family:inherit;outline:none;margin-bottom:16px;transition:border-color .2s">',
        '<button id="pan-go" style="width:100%;padding:11px;background:#D4A574;border:none;color:#000;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit">Continue \u2192</button>',
      '</div>'
    ].join('');
    document.body.appendChild(o);

    var inp  = document.getElementById('pan-inp');
    var go   = document.getElementById('pan-go');

    inp.addEventListener('focus', function () { inp.style.borderColor = '#D4A574'; });
    inp.addEventListener('blur',  function () { inp.style.borderColor = '#333'; });

    function done(raw) {
      var name = (raw || '').trim() || 'Anonymous';
      if (name !== 'Anonymous') setCookie(COOKIE, name, 30);
      o.remove();
      cb(name);
    }
    go.addEventListener('click',   function () { done(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') done(inp.value);
      e.stopPropagation();
    });
    o.addEventListener('click',       function (e) { e.stopPropagation(); });
    o.addEventListener('contextmenu', function (e) { e.stopPropagation(); });
    setTimeout(function () { inp.focus(); }, 60);
  }

  // ── Boot ──────────────────────────────────────────────────────────────
  function flush(session) { stamp(session); persist(session); dispatch(session); }

  function start(viewer) {
    var session = loadSession() || createSession(viewer);
    session.viewer = session.viewer || viewer;
    persist(session);

    // Fire immediately so even a 1-second bounce is captured
    dispatch(session);

    // Heartbeat every 3s — upserts the same row, so no duplicates
    setInterval(function () { flush(session); }, 3000);

    // Fires on mobile when tab is backgrounded (more reliable than beforeunload on iOS/Android)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush(session);
    });

    // Fires on page hide (covers bfcache navigation)
    window.addEventListener('pagehide', function () { flush(session); });

    // Last-ditch — sendBeacon inside
    window.addEventListener('beforeunload', function () { flush(session); });
  }

  var known = resolveViewer();
  if (known) {
    start(known);
  } else {
    setTimeout(function () { showPopup(start); }, 400);
  }
})();

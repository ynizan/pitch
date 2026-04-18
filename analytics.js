(function () {
  // ── CONFIG ────────────────────────────────────────────────────────────
  // Free webhook: create a unique topic at https://ntfy.sh/your-topic-name
  // Then open https://ntfy.sh/your-topic-name in a browser to receive alerts.
  // Or point to any HTTP endpoint that accepts POST — including a Claude agent.
  var WEBHOOK_URL = '';
  // ─────────────────────────────────────────────────────────────────────

  var SLIDES = {
    'index.html':           'Cover',
    'slide-1-updated.html': '01 · The Market',
    'slide-2.html':         '02 · The Network',
    'slide-3.html':         '03 · The Opportunity',
    'slide-4-updated.html': '04 · The Plan',
    'slide-5.html':         '05 · The Team'
  };

  var COOKIE = 'pitch_viewer';
  var LS_KEY = 'pitch_analytics';
  var SS_KEY = 'pitch_session';

  var rawFile   = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var curFile   = SLIDES[rawFile] !== undefined ? rawFile : 'index.html';
  var curName   = SLIDES[curFile];
  var enteredAt = Date.now();

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
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      viewer: viewer,
      startedAt: new Date().toISOString(),
      slides: []
    };
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
    var dur = Math.max(1, Math.round((Date.now() - enteredAt) / 1000));
    var i   = session.slides.findIndex(function (s) { return s.file === curFile; });
    var rec = { file: curFile, name: curName, duration: dur, at: new Date().toISOString() };
    if (i >= 0) session.slides[i] = rec; else session.slides.push(rec);
  }

  // ── Webhook ───────────────────────────────────────────────────────────
  function buildText(session) {
    var lines = [
      'Viewer: ' + session.viewer,
      'Session: ' + session.id,
      'Started: ' + new Date(session.startedAt).toLocaleString(),
      ''
    ];
    session.slides.forEach(function (s) {
      lines.push(s.name + ': ' + s.duration + 's');
    });
    return lines.join('\n');
  }
  function dispatch(session) {
    if (!WEBHOOK_URL) return;
    var isNtfy = WEBHOOK_URL.includes('ntfy.sh');
    try {
      fetch(WEBHOOK_URL, {
        method: 'POST',
        keepalive: true,
        headers: isNtfy
          ? { 'Content-Type': 'text/plain', 'Title': 'Pitch viewed · ' + session.viewer, 'Tags': 'bar_chart' }
          : { 'Content-Type': 'application/json' },
        body: isNtfy
          ? buildText(session)
          : JSON.stringify({ event: 'pitch_viewed', session: session })
      });
    } catch (e) {}
  }

  // ── Name popup ────────────────────────────────────────────────────────
  function showPopup(cb) {
    var o = document.createElement('div');
    o.id = 'pan-overlay';
    o.style.cssText = [
      'position:fixed;inset:0;z-index:10000;display:flex;align-items:center',
      'justify-content:center;background:rgba(13,13,13,0.85);backdrop-filter:blur(8px)'
    ].join(';');
    o.innerHTML = [
      '<div style="background:#111;border:1px solid #D4A574;border-radius:16px;padding:36px 32px;',
        'max-width:360px;width:calc(100% - 48px);font-family:Manrope,sans-serif;text-align:center">',
        '<div style="font-size:11px;color:#D4A574;letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px">InTouch</div>',
        '<h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px">Who are you?</h2>',
        '<p style="color:#777;font-size:14px;line-height:1.5;margin:0 0 24px">',
          'Your name lets the founders know who\'s reviewing this deck.',
        '</p>',
        '<input id="pan-inp" type="text" placeholder="Your name" autocomplete="name" style="',
          'width:100%;box-sizing:border-box;background:#0d0d0d;border:1px solid #333;color:#fff;',
          'padding:12px 14px;border-radius:8px;font-size:15px;font-family:inherit;outline:none;',
          'margin-bottom:16px;transition:border-color .2s">',
        '<div style="display:flex;gap:8px">',
          '<button id="pan-skip" style="flex:1;padding:11px;background:transparent;border:1px solid #333;',
            'color:#666;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit">Skip</button>',
          '<button id="pan-go" style="flex:2;padding:11px;background:#D4A574;border:none;color:#000;',
            'border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit">Continue →</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(o);

    var inp  = document.getElementById('pan-inp');
    var skip = document.getElementById('pan-skip');
    var go   = document.getElementById('pan-go');

    inp.addEventListener('focus', function () { inp.style.borderColor = '#D4A574'; });
    inp.addEventListener('blur',  function () { inp.style.borderColor = '#333'; });

    function done(raw) {
      var name = (raw || '').trim() || 'Anonymous';
      if (name !== 'Anonymous') setCookie(COOKIE, name, 30);
      o.remove();
      cb(name);
    }
    go.addEventListener('click',  function () { done(inp.value); });
    skip.addEventListener('click', function () { done(''); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter')  done(inp.value);
      if (e.key === 'Escape') done('');
      e.stopPropagation();
    });
    // Block slide navigation events while popup is open
    o.addEventListener('click',       function (e) { e.stopPropagation(); });
    o.addEventListener('contextmenu', function (e) { e.stopPropagation(); });

    setTimeout(function () { inp.focus(); }, 60);
  }

  // ── Boot ──────────────────────────────────────────────────────────────
  function start(viewer) {
    var session = loadSession() || createSession(viewer);
    session.viewer = session.viewer || viewer;
    persist(session);

    window.addEventListener('beforeunload', function () {
      stamp(session);
      persist(session);
      dispatch(session);
    });
    setInterval(function () { stamp(session); persist(session); }, 15000);
  }

  var known = resolveViewer();
  if (known) {
    start(known);
  } else if (curFile === 'index.html') {
    setTimeout(function () { showPopup(start); }, 400);
  } else {
    start('Anonymous');
  }
})();

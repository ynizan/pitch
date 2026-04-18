(function () {
  const btn = document.querySelector('.copy-html-btn');
  if (!btn) return;
  const tooltip = btn.querySelector('.copy-html-tooltip');
  const defaultTooltip = tooltip ? tooltip.textContent : '';
  let busy = false;

  function setTooltip(text, state) {
    if (tooltip) tooltip.textContent = text;
    btn.classList.remove('copy-html-btn-ok', 'copy-html-btn-err');
    if (state) btn.classList.add('copy-html-btn-' + state);
  }

  function resetTooltip() {
    setTooltip(defaultTooltip, null);
  }

  function collectUrls() {
    const cards = document.querySelectorAll('.deck-nav .nav-card');
    const urls = [];
    cards.forEach((a) => {
      const href = a.getAttribute('href');
      if (href) urls.push(href);
    });
    return urls;
  }

  function heroHtml() {
    const hero = document.querySelector('.slide-hero');
    if (!hero) return '';
    const clone = hero.cloneNode(true);
    clone.querySelectorAll('.deck-nav, .archive-links, .copy-html-btn').forEach((n) => n.remove());
    return clone.outerHTML;
  }

  async function build() {
    const parts = [];
    const hero = heroHtml();
    if (hero) parts.push(hero);

    const urls = collectUrls();
    const htmls = await Promise.all(
      urls.map((u) => fetch(u, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error('Fetch failed: ' + u);
        return r.text();
      }))
    );

    htmls.forEach((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const slide = doc.querySelector('.slide');
      if (slide) parts.push(slide.outerHTML);
    });

    return parts.join('\n\n');
  }

  async function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (_) {
        // fall through to execCommand fallback
      }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    if (!document.execCommand('copy')) throw new Error('copy failed');
    document.body.removeChild(ta);
  }

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    busy = true;
    try {
      const out = await build();
      await copy(out);
      setTooltip('Copied!', 'ok');
    } catch (err) {
      setTooltip('Failed', 'err');
    } finally {
      setTimeout(() => { resetTooltip(); busy = false; }, 1500);
    }
  });

  btn.addEventListener('contextmenu', (e) => { e.stopPropagation(); });
})();

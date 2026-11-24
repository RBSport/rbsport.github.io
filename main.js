/* RB Sport · interfaccia: scroll morbido, voli tra le pagine, menu, comparse, cursore, modulo */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePtr = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement, body = document.body;
  const PAGE = body.dataset.page || 'index';
  const PLACES = JSON.parse(document.getElementById('places').textContent);
  const store = { set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  /* ---------- scroll morbido ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: .085, wheelMultiplier: .9, touchMultiplier: 1.2, smoothWheel: true, syncTouch: false });
    root.classList.add('lenis', 'lenis-smooth');
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }
  const scrollToY = (y, immediate) => lenis ? lenis.scrollTo(y, { immediate: !!immediate, duration: 1.4 }) : scrollTo({ top: y, behavior: immediate || reduce ? 'auto' : 'smooth' });
  const centerOf = el => el.getBoundingClientRect().top + scrollY + (el.hasAttribute('data-cam') ? el.offsetHeight / 2 - innerHeight / 2 : -90);

  /* ---------- sipario: primo ingresso, arrivo da un'altra pagina ---------- */
  const curtain = document.querySelector('.curtain');
  const tagPlace = curtain.querySelector('.c-place'), tagName = curtain.querySelector('.c-name');
  function setTag(p) { tagPlace.textContent = p.place; tagName.textContent = p.name; }
  function open() {
    requestAnimationFrame(() => setTimeout(() => {
      body.classList.add('ready');
      setTimeout(() => body.classList.remove('arrived'), 450);
    }, root.classList.contains('arriving') ? 120 : 60));
  }
  if (window.RB && window.RB.ready) open();
  else { document.addEventListener('rb:ready', open, { once: true }); setTimeout(open, 1600); }
  addEventListener('pageshow', e => { if (e.persisted) { body.classList.remove('leaving', 'flying'); body.classList.add('ready'); lenis && lenis.start(); } });

  /* ---------- voli tra le pagine ---------- */
  const pageOf = href => {
    const file = href.split('#')[0].split('?')[0].split('/').pop();
    if (!file) return null;
    const id = file.replace('.html', '');
    return PLACES[id] ? id : null;
  };
  let busy = false;
  function go(href, dest) {
    if (busy) return; busy = true;
    store.set('rb-arrive', dest);
    if (window.RB && window.RB.pose) store.set('rb-from', JSON.stringify(window.RB.pose().map(v => Math.round(v * 100) / 100)));
    lenis && lenis.stop();
    body.classList.add('leaving');
    setTimeout(() => { location.href = href; }, reduce ? 0 : 180);
  }
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || /^(mailto:|tel:|https?:)/.test(href) || a.target) return;
    if (href.startsWith('#')) {
      a.addEventListener('click', e => { const el = document.querySelector(href); if (!el) return; e.preventDefault(); scrollToY(href === '#top' ? 0 : centerOf(el)); });
      return;
    }
    const dest = pageOf(href);
    if (!dest) return;
    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      if (dest === PAGE && !href.includes('#')) { scrollToY(0); return; }
      if (dest === PAGE) { const id = href.split('#')[1]; const el = document.getElementById(id); if (el) scrollToY(centerOf(el)); else if (location.hash !== '#' + id) location.hash = id; return; }
      go(href, dest);
    });
    // precarica la pagina di destinazione
    const pre = () => { if (a.dataset.pre) return; a.dataset.pre = 1; const l = document.createElement('link'); l.rel = 'prefetch'; l.href = href.split('#')[0]; document.head.appendChild(l); };
    a.addEventListener('pointerenter', pre, { passive: true }); a.addEventListener('touchstart', pre, { passive: true }); a.addEventListener('focus', pre);
    // il menu indica il luogo nel centro
    if (finePtr) {
      a.addEventListener('mouseenter', () => { if (!busy && window.RB) window.RB.highlight(PLACES[dest].area); });
      a.addEventListener('mouseleave', () => { if (!busy && window.RB) window.RB.highlight(null); });
    }
  });

  /* ---------- menu mobile ---------- */
  const toggle = document.querySelector('.menu-toggle'), nav = document.getElementById('nav');
  if (toggle && nav) {
    const set = o => { nav.classList.toggle('open', o); toggle.setAttribute('aria-expanded', o); toggle.textContent = o ? 'Chiudi' : 'Menu'; o ? lenis && lenis.stop() : lenis && lenis.start(); };
    toggle.addEventListener('click', () => set(!nav.classList.contains('open')));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  /* ---------- titoli parola per parola ---------- */
  if (!reduce) document.querySelectorAll('main h1:not(.display), main h2').forEach(h => {
    if (!h.closest('[data-reveal]')) return;
    const text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.innerHTML = text.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true"><span style="--wi:${i}">${w}</span></span>`).join(' ');
    h.classList.add('split');
  });

  /* ---------- comparse in entrambe le direzioni ---------- */
  const els = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(en => en.forEach(e => {
      const el = e.target;
      if (e.isIntersecting) { el.classList.add('in'); el.classList.remove('above'); }
      else { el.classList.remove('in'); el.classList.toggle('above', e.boundingClientRect.top < 0); }
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
  } else els.forEach(el => el.classList.add('in'));

  /* ---------- header, avanzamento, indice delle fasi ---------- */
  const header = document.querySelector('.site-header'), bar = document.querySelector('.progress'), hint = document.querySelector('.hint');
  const secs = [...document.querySelectorAll('[data-cam]')];
  const stepItems = [...document.querySelectorAll('.steps-index li')], stepsIndex = document.querySelector('.steps-index');
  let lastStep = null;
  function onScroll() {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    header.classList.toggle('compact', y > 40);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (hint) hint.classList.toggle('gone', y > 80);
    if (stepsIndex) {
      const c = innerHeight * .5; let cur = null;
      secs.forEach(s => { const r = s.getBoundingClientRect(); if (r.top < c && r.bottom > c) cur = s.dataset.step; });
      if (cur !== lastStep) {
        lastStep = cur;
        stepItems.forEach(li => li.classList.toggle('on', cur !== undefined && cur !== null && li.dataset.step === cur));
        stepsIndex.classList.toggle('off', cur === undefined || cur === null);
      }
    }
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- barra "Proponi un impianto" su telefono ---------- */
  const mcta = document.querySelector('.mobile-cta');
  if (mcta) {
    const ends = [document.querySelector('.next-page'), document.querySelector('.site-footer')].filter(Boolean);
    const upd = () => {
      const past = scrollY > innerHeight * .7;
      const atEnd = ends.some(el => el.getBoundingClientRect().top < innerHeight);
      mcta.classList.toggle('show', past && !atEnd);
    };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  }

  /* ---------- arrivo con ancora (es. per-chi-lavoriamo.html#comuni) ---------- */
  if (location.hash.length > 1) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      const toAnchor = () => scrollToY(centerOf(target), true);
      setTimeout(toAnchor, 60);
      document.addEventListener('rb:ready', () => setTimeout(toAnchor, 30), { once: true });
    }
  }
  stepItems.forEach(li => {
    li.tabIndex = 0; li.setAttribute('role', 'button');
    const goStep = () => { const s = secs.find(x => x.dataset.step === li.dataset.step); if (s) scrollToY(centerOf(s)); };
    li.addEventListener('click', goStep); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goStep(); } });
  });

  /* ---------- mappa esplorabile e selettore: muovono la telecamera ---------- */
  const focusIn = (section, btn) => { if (window.RB && window.RB.focus) window.RB.focus(section, JSON.parse(btn.dataset.key), (btn.dataset.fx || '').split(/\s+/).filter(Boolean)); };
  const focusOut = section => { if (window.RB && window.RB.focus) window.RB.focus(section, null); };

  const explore = document.querySelector('[data-explore]');
  if (explore) {
    const hotspots = [...document.querySelectorAll('.hotspot')];
    const card = explore.querySelector('.explore-card'), intro = explore.querySelector('.explore-intro');
    const cPlace = card.querySelector('.label'), cTitle = card.querySelector('h3'), cText = card.querySelector('p'), cLink = card.querySelector('.link');
    const list = [...explore.querySelectorAll('.explore-list button')];
    let current = null;
    function select(id) {
      const btn = hotspots.find(h => h.dataset.id === id);
      current = id;
      hotspots.forEach(h => h.classList.toggle('on', h.dataset.id === id));
      list.forEach(l => l.setAttribute('aria-pressed', l.dataset.id === id));
      if (!btn) { card.hidden = true; intro.hidden = false; focusOut(explore); window.RB && window.RB.highlight(null); return; }
      cPlace.textContent = btn.dataset.place; cTitle.textContent = btn.dataset.title; cText.textContent = btn.dataset.text;
      cLink.setAttribute('href', btn.dataset.href);
      intro.hidden = true; card.hidden = false;
      card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
      focusIn(explore, btn);
      window.RB && window.RB.highlight(btn.dataset.area);
    }
    hotspots.forEach(h => h.addEventListener('click', () => select(current === h.dataset.id ? null : h.dataset.id)));
    list.forEach(l => l.addEventListener('click', () => select(current === l.dataset.id ? null : l.dataset.id)));
    explore.querySelector('.explore-back').addEventListener('click', () => select(null));
  }

  const selector = document.querySelector('[data-select]');
  if (selector) {
    const tabs = [...selector.querySelectorAll('[role="tab"]')];
    const panels = [...selector.querySelectorAll('[role="tabpanel"]')];
    function pick(i, focusTab) {
      tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => { p.hidden = k !== i; if (k === i) { p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); } });
      if (focusTab) tabs[i].focus();
      focusIn(selector, tabs[i]);
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(i));
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    const hashIdx = tabs.findIndex(t => '#' + t.dataset.anchor === location.hash);
    const start = () => pick(hashIdx >= 0 ? hashIdx : 0);
    if (window.RB && window.RB.ready) start(); else document.addEventListener('rb:ready', start, { once: true });
    if (hashIdx >= 0) setTimeout(() => scrollToY(centerOf(selector), true), 50);
    // link interni alla stessa pagina (#comuni ecc.)
    addEventListener('hashchange', () => { const k = tabs.findIndex(t => '#' + t.dataset.anchor === location.hash); if (k >= 0) { pick(k); scrollToY(centerOf(selector)); } });
  }

  /* ---------- modulo contatti (Formspree) ---------- */
  const form = document.getElementById('contact-form');
  if (form) {
    const msg = document.getElementById('form-msg');
    const show = (t, c) => { msg.textContent = t; msg.className = 'form-msg ' + c; };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.checkValidity()) { show("Compilate nome, email e messaggio e accettate l'informativa privacy.", 'err'); const bad = form.querySelector(':invalid'); bad && bad.focus(); return; }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Invio in corso';
      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (res.ok) { form.reset(); show("Richiesta inviata. Vi risponderemo all'indirizzo email indicato.", 'ok'); }
        else show('Invio non riuscito. Riprovate tra qualche minuto oppure scriveteci via email.', 'err');
      } catch (err) {
        show('Invio non riuscito da questa anteprima. Scriveteci a aronzoni@rbsportgroup.it o aballone@rbsportgroup.it.', 'err');
      }
      btn.disabled = false; btn.textContent = 'Invia richiesta';
    });
  }
})();

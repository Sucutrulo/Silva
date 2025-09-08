/* =========================================================
   PINTURERÍA SILVA – JS BASE (Optimizado)
   ========================================================= */

/* ---------- Utils ---------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Scroll/Resize bus: un solo listener con RAF ---------- */
const ScrollBus = (() => {
  const tasks = new Set();
  let rafId = null;
  const run = () => { rafId = null; tasks.forEach(fn => fn()); };
  const schedule = () => { if (!rafId) rafId = requestAnimationFrame(run); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  return { on(fn){ tasks.add(fn); fn(); return () => tasks.delete(fn); } };
})();

/* =========================================================
   MENÚ MÓVIL (toggle + cierre al elegir ancla + ESC)
   ========================================================= */
(() => {
  const nav    = $('.nav');
  const toggle = $('.nav-toggle');
  if (!nav || !toggle) return;

  const setExpanded = v => toggle.setAttribute('aria-expanded', String(v));

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    setExpanded(open);
  });

  nav.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      setExpanded(false);
    }
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      setExpanded(false);
    }
  });
})();

/* =========================================================
   HEADER: estado "scrolled" + barra de progreso
   ========================================================= */
(() => {
  const header   = $('.header');
  const progress = $('.header__progress .bar');
  if (!header && !progress) return;

  ScrollBus.on(() => {
    if (header) header.classList.toggle('header--scrolled', (scrollY || 0) > 6);
    if (progress) {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      progress.style.width = pct.toFixed(2) + '%';
    }
  });
})();

/* =========================================================
   CARRUSEL: auto, dots, controles y barra de tiempo
   ========================================================= */
(() => {
  const root = $('.carousel');
  if (!root) return;

  const slides = $$('.slide', root);
  const dots   = $$('.dot',   root);
  const prev   = $('.prev',   root);
  const next   = $('.next',   root);
  const bar    = $('.carousel__progress .bar', root);

  const DURATION = 8000; // ms por slide
  let index = 0;
  let timer = null;

  const setActive = n => {
    slides[index]?.classList.remove('is-active');
    dots[index]?.classList.remove('is-active');
    index = (n + slides.length) % slides.length;
    slides[index]?.classList.add('is-active');
    dots[index]?.classList.add('is-active');
  };

  const to = n => { setActive(n); resetProgress(); };
  const nextSlide = () => to(index + 1);
  const prevSlide = () => to(index - 1);

  const stop = () => { if (timer) clearTimeout(timer); timer = null; };
  const schedule = () => {
    if (prefersReducedMotion) return; // respeta reduced-motion
    stop();
    timer = setTimeout(() => { nextSlide(); schedule(); }, DURATION);
  };

  const resetProgress = () => {
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!prefersReducedMotion) {
          bar.style.transition = `width ${Math.max(DURATION - 100, 300)}ms linear`;
          bar.style.width = '100%';
        }
      });
    });
  };

  next?.addEventListener('click', () => { nextSlide(); schedule(); });
  prev?.addEventListener('click', () => { prevSlide(); schedule(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { to(i); schedule(); }));

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else schedule();
  });

  // Teclado: ← →
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { nextSlide(); schedule(); }
    if (e.key === 'ArrowLeft')  { prevSlide(); schedule(); }
  });

  // Init
  setActive(0);
  resetProgress();
  schedule();
})();

/* =========================================================
   REVEAL-ON-SCROLL (aparición suave)
   ========================================================= */
(() => {
  const items = $$('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    items.forEach(el => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.18 });

  items.forEach(el => io.observe(el));
})();

/* =========================================================
   LINK ACTIVO POR SECCIÓN (is-active + aria-current)
   ========================================================= */
(() => {
  const navLinks = $$('.nav a[href^="#"]'); // solo internos
  if (!navLinks.length) return;

  const sections = navLinks
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (!sections.length || !('IntersectionObserver' in window)) return;

  const markActive = (id) => {
    navLinks.forEach(l => {
      const active = l.getAttribute('href') === id;
      l.classList.toggle('is-active', active);
      l.setAttribute('aria-current', active ? 'page' : 'false');
    });
  };

  const io = new IntersectionObserver((entries) => {
    let best = null;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
    }
    if (best) markActive('#' + best.target.id);
  }, { threshold: 0.55 });

  sections.forEach(sec => io.observe(sec));
})();

/* =========================================================
   NAV MODERNA: indicador "pill" deslizante
   ========================================================= */
(() => {
  const nav = $('.nav.nav--modern');
  if (!nav) return;

  const indicator = $('.nav__indicator', nav);
  if (!indicator) return;

  const links = $$('a:not(.btn--store)', nav);
  if (!links.length) return;

  let current = null;

  const moveTo = (el) => {
    if (!el) return;
    const linkRect = el.getBoundingClientRect();
    const navRect  = nav.getBoundingClientRect();
    const left = (linkRect.left - navRect.left) + nav.scrollLeft;
    const top  = (linkRect.top  - navRect.top)  + nav.scrollTop;

    indicator.style.opacity = '1';
    indicator.style.height  = `${linkRect.height}px`;
    indicator.style.width   = `${linkRect.width}px`;
    indicator.style.transform =
      `translate(${Math.round(left)}px, ${Math.round(top + linkRect.height / 2)}px) translateY(-50%)`;
  };

  const getActiveLink = () =>
    links.find(a => a.classList.contains('is-active') || a.getAttribute('aria-current') === 'page') || links[0];

  const syncToActive = () => { current = getActiveLink(); moveTo(current); };

  links.forEach(a => {
    a.addEventListener('mouseenter', () => moveTo(a));
    a.addEventListener('focus',     () => moveTo(a));
  });
  nav.addEventListener('mouseleave', syncToActive);

  ScrollBus.on(syncToActive);

  const mo = new MutationObserver(syncToActive);
  links.forEach(a => mo.observe(a, { attributes: true, attributeFilter: ['class','aria-current'] }));

  addEventListener('load', () => setTimeout(syncToActive, 0));
  syncToActive();
})();

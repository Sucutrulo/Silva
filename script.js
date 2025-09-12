/* =========================================================
   PINTURERÍA SILVA – JS BASE (Corregido y endurecido)
   - Utilidades
   - Bus de scroll/resize con RAF
   - Menú móvil
   - Header: estado scrolled + progreso de lectura
   - Carrusel con dots, controles y barra de tiempo
   - Reveal-on-scroll
   - Link activo por sección (is-active + aria-current)
   - Nav moderna: indicador deslizante (pill)
   ========================================================= */

/* =============== Utils =============== */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const prefersReducedMotion = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

/* =============== Scroll/Resize bus (único handler con RAF) =============== */
const ScrollBus = (() => {
  const tasks = new Set();
  let rafId = null;

  const run = () => { rafId = null; tasks.forEach(fn => { try { fn(); } catch(e) { /* no-op */ } }); };
  const schedule = () => { if (!rafId) rafId = requestAnimationFrame(run); };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);

  return {
    on(fn) { tasks.add(fn); try { fn(); } catch(e) {} return () => tasks.delete(fn); }
  };
})();

/* =========================================================
   MENÚ MÓVIL (toggle + cierre al elegir ancla)
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

  // Cierra al clickear un enlace interno
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      setExpanded(false);
    }
  });

  // Accesibilidad: cerrar con Esc
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      setExpanded(false);
    }
  });
})();

/* =========================================================
   HEADER: estado "scrolled" + barra de progreso de lectura
   ========================================================= */
(() => {
  const header   = $('.header');
  const progress = $('.header__progress .bar');
  if (!header && !progress) return;

  ScrollBus.on(() => {
    // Fallback scrollTop para navegadores viejos
    const y = typeof window.scrollY === 'number'
      ? window.scrollY
      : (document.documentElement.scrollTop || 0);

    // Estado compacto del header
    if (header) header.classList.toggle('header--scrolled', y > 6);

    // Progreso de lectura
    if (progress) {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
      const pct = Math.min(100, Math.max(0, (doc.scrollTop / max) * 100));
      progress.style.width = pct.toFixed(2) + '%';
    }
  });
})();

/* =========================================================
   CARRUSEL / SLIDER (auto + dots + controles + progreso)
   ========================================================= */
(() => {
  const root = $('.carousel');
  if (!root) return;

  const slides = $$('.slide', root);
  const dots   = $$('.dot',   root);
  const prev   = $('.prev',   root);
  const next   = $('.next',   root);
  const bar    = $('.carousel__progress .bar', root);

  if (!slides.length) return; // nada que hacer si no hay slides

  const DURATION = 8000; // ms por slide
  let index = 0;
  let timer = null;

  const setActive = n => {
    if (!slides.length) return;
    slides[index]?.classList.remove('is-active');
    dots[index]?.classList.remove('is-active');

    index = ((n % slides.length) + slides.length) % slides.length;

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
    // Reiniciar barra de tiempo
    bar.style.transition = 'none';
    bar.style.width = '0%';
    // Forzar reflow y animar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!prefersReducedMotion) {
          bar.style.transition = `width ${Math.max(DURATION - 100, 300)}ms linear`;
          bar.style.width = '100%';
        }
      });
    });
  };

  // Controles
  next?.addEventListener('click', () => { nextSlide(); schedule(); });
  prev?.addEventListener('click', () => { prevSlide(); schedule(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { to(i); schedule(); }));

  // Pausa al hover y cuando la pestaña no está visible
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else schedule();
  });

  // Init
  setActive(0);
  resetProgress();
  schedule();

  // (Opcional) teclas ← →
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { nextSlide(); schedule(); }
    if (e.key === 'ArrowLeft')  { prevSlide(); schedule(); }
  });
})();

/* =========================================================
   REVEAL-ON-SCROLL (aparición suave al entrar al viewport)
   ========================================================= */
(() => {
  const items = $$('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    // Fallback: revelar todo si no hay IO o reduced-motion
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
   - Corrige aria-current: se elimina cuando no está activo
   ========================================================= */
(() => {
  const navLinks = $$('.nav a[href^="#"]'); // excluye tienda (no empieza con #)
  if (!navLinks.length) return;

  const sections = navLinks
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (!sections.length || !('IntersectionObserver' in window)) return;

  const markActive = (id) => {
    navLinks.forEach(l => {
      const active = l.getAttribute('href') === id;
      l.classList.toggle('is-active', active);
      if (active) {
        l.setAttribute('aria-current', 'page');
      } else {
        l.removeAttribute('aria-current'); // <-- corrección
      }
    });
  };

  const io = new IntersectionObserver((entries) => {
    // elegimos la que más área visible tenga
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
   - Más defensivo ante layout changes
   ========================================================= */
(() => {
  const nav = $('.nav.nav--modern');
  if (!nav) return;

  const indicator = $('.nav__indicator', nav);
  if (!indicator) return;

  // Links a seguir (excluye botón Tienda)
  const links = $$('a:not(.btn--store)', nav);
  if (!links.length) return;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  let current = null;

  const moveTo = (el) => {
    if (!el || !indicator.isConnected) return;
    const linkRect = el.getBoundingClientRect();
    const navRect  = nav.getBoundingClientRect();

    const x = (linkRect.left - navRect.left) + nav.scrollLeft;
    const y = (linkRect.top  - navRect.top)  + nav.scrollTop + linkRect.height / 2;

    // Evitar tamaños/posiciones negativas si aún no layoutó
    const w = clamp(linkRect.width, 0, navRect.width);
    const h = clamp(linkRect.height, 0, navRect.height);

    indicator.style.opacity = '1';
    indicator.style.height  = `${h}px`;
    indicator.style.width   = `${w}px`;
    indicator.style.transform =
      `translate(${Math.round(x)}px, ${Math.round(y)}px) translateY(-50%)`;
  };

  const getActiveLink = () =>
    links.find(a => a.classList.contains('is-active') || a.getAttribute('aria-current') === 'page') || links[0];

  const syncToActive = () => { current = getActiveLink(); moveTo(current); };

  // Hover/Focus sigue el cursor; al salir, vuelve al activo
  links.forEach(a => {
    a.addEventListener('mouseenter', () => moveTo(a));
    a.addEventListener('focus',     () => moveTo(a));
  });
  nav.addEventListener('mouseleave', syncToActive);

  // Recalcular con scroll/resize (usando el bus global)
  ScrollBus.on(syncToActive);

  // Observar cambios de clase/aria-current en los links
  const mo = new MutationObserver(syncToActive);
  links.forEach(a => mo.observe(a, { attributes: true, attributeFilter: ['class','aria-current'] }));

  // Primera posición
  if (document.readyState === 'complete') {
    setTimeout(syncToActive, 0);
  } else {
    addEventListener('load', () => setTimeout(syncToActive, 0));
  }
})();

// Page behaviour: the zoom walkthrough, the URL anatomy card and scroll reveals.
// Everything degrades to a static, readable page without JavaScript.

const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Zoom walkthrough: four real captures, one per representation. Stepping
// forward dives in (the old frame grows past the viewer, the new one settles
// from slightly small); stepping back reverses it.
function zoomTour() {
  const root = document.querySelector('.zoom');
  if (!root) return;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const imgs = [...root.querySelectorAll('.zoom-imgs img')];
  const metas = [...root.querySelectorAll('.zm')];
  const DWELL = 5200;
  let cur = 0, timer = 0, userTook = false, inView = false, hovering = false;
  root.style.setProperty('--dur', DWELL + 'ms');

  function show(next, fromUser) {
    if (next === cur) return;
    const forward = next > cur;
    const out = imgs[cur], inn = imgs[next];
    if (!still) {
      inn.style.transition = 'none';
      inn.style.transform = `scale(${forward ? 0.9 : 1.2})`;
      inn.offsetWidth; // commit the start state before transitioning
      inn.style.transition = '';
      out.style.transform = `scale(${forward ? 1.25 : 0.9})`;
    }
    out.classList.remove('on');
    inn.classList.add('on');
    inn.style.transform = '';
    setTimeout(() => { if (!out.classList.contains('on')) out.style.transform = ''; }, 1400);

    tabs.forEach((t, i) => t.setAttribute('aria-selected', String(i === next)));
    metas.forEach((m, i) => m.classList.toggle('on', i === next));
    cur = next;
    if (fromUser) { userTook = true; root.classList.add('paused'); }
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    const run = !still && !userTook && inView && !hovering;
    root.classList.toggle('paused', !run);
    // restart the progress bar on the selected tab
    const bar = tabs[cur].querySelector('.bar i');
    if (bar) { bar.style.animation = 'none'; bar.offsetWidth; bar.style.animation = ''; }
    if (run) timer = setTimeout(() => show((cur + 1) % imgs.length), DWELL);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i, true));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = (i + d + tabs.length) % tabs.length;
      tabs[n].focus();
      show(n, true);
    });
    t.tabIndex = i === 0 ? 0 : -1;
  });
  // roving tabindex follows the selection
  new MutationObserver(() => tabs.forEach(t => { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1; }))
    .observe(root.querySelector('.zoom-tabs'), { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });

  const stage = root.querySelector('.zoom-stage');
  stage.addEventListener('mouseenter', () => { hovering = true; schedule(); });
  stage.addEventListener('mouseleave', () => { hovering = false; schedule(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule(); }, { threshold: 0.35 }).observe(root);

  // warm the lazy images once the section is near, so the first dive is smooth
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return;
    imgs.forEach(img => { img.loading = 'eager'; });
    o.disconnect();
  }, { rootMargin: '600px' }).observe(root);
}

// URL anatomy: hover a parameter or its legend row to pair them.
function urlCard() {
  document.querySelectorAll('.url-card [data-i]').forEach(el => {
    const on = v => document.querySelectorAll(`.url-card [data-i="${el.dataset.i}"]`)
      .forEach(p => p.classList.toggle('on', v));
    el.addEventListener('mouseenter', () => on(true));
    el.addEventListener('mouseleave', () => on(false));
  });
}

// Fade sections in as they arrive. Added from JS so the page is complete without it.
function reveals() {
  if (still || !('IntersectionObserver' in window)) return;
  const els = document.querySelectorAll('.head, .split > *, .card, .pipe li, .design, .found, .gate, .stories blockquote, .road li, .final-in');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el, i) => {
    el.classList.add('reveal');
    // stagger siblings in a grid a little
    const idx = [...el.parentElement.children].indexOf(el);
    el.style.transitionDelay = Math.min(idx, 5) * 60 + 'ms';
    io.observe(el);
  });
}

zoomTour();
urlCard();
reveals();

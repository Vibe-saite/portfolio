/* motion.js – лёгкий движок анимаций для одностраничных сайтов, версия 2.
   Без зависимостей. Управляется data-атрибутами, подробности и рецепты в references/motion-guide.md.

   ПОЯВЛЕНИЕ
   data-reveal="up|left|right|scale|fade"  появление при попадании в экран; data-stagger на родителе даёт очередь
   data-split                              заголовок появляется по словам
   data-count="1700"                       число считается от нуля (data-decimals, data-duration)
   data-stars="4.7"                        заливка звёзд рейтинга (класс .rating-stars)
   ПРОКРУТКА
   data-parallax="-0.2"                    сдвиг слоя при прокрутке
   data-progress                           полоса прогресса страницы
   data-header                             шапка получает is-scrolled после 40 px
   data-drift="#f4f1ea"                    секция плавно перекрашивает фон страницы, когда проходит середину экрана
   data-drift-ink="#241e18"                цвет текста шапки и точек-глав на этом фоне (обязателен, если фон тёмный)
   data-spy                                ссылка-якорь подсвечивается, пока её секция на экране (меню, точки-главы)
   data-sticky-cta data-after data-until   липкая кнопка: видна после одного элемента и до другого
   СЦЕНЫ (закреплённый экран на N высот)
   data-scene="2.4" > [data-stage]         внутри ведётся --p от 0 до 1
   data-cue="0.1 0.4"                      блок виден в этом промежутке прогресса
   data-pan                                лента внутри сцены едет вбок
   data-stack > [data-frame]               кадры лежат стопкой и перетекают друг в друга по прогрессу
   data-goto="2"                           кнопка внутри сцены: прокрутить к кадру №2; получает is-active
   data-for="2"                            подпись, видимая (is-active) только на кадре №2
   data-compare="drag|scroll"              было/стало: делитель тянется мышью или ведётся прогрессом сцены
   УКРАШЕНИЯ ДЛЯ МЫШИ (отключены на телефоне и при «уменьшить движение»)
   data-tilt="6"   наклон карточки    data-magnet="0.25"   кнопка тянется к курсору    data-spotlight   подсветка за курсором
   ГАЛЕРЕЯ
   a[data-zoom]                            фото открывается крупно в нативном <dialog>
   img[data-slot]                          слот картинки: если файла нет, остаётся заглушка .slot с подписью (см. references/images.md)

   Если скрипт не загрузился, контент остаётся видимым (сторожок в <head>). */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var vh = window.innerHeight;

  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function ru(v, dec) { return v.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

  window.Motion = { refresh: init };

  /* ---------- появление, слова, счётчики, звёзды ---------- */
  var io = null;

  function splitWords(el) {
    if (el.dataset.splitDone) return;
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split(' ').forEach(function (word, i, all) {
      var w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('span'); inner.className = 'wi';
      inner.style.setProperty('--w', i); inner.textContent = word;
      w.appendChild(inner); el.appendChild(w);
      if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.dataset.splitDone = '1';
  }

  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target) || el.dataset.counted) return;
    el.dataset.counted = '1';
    var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var dur = parseInt(el.getAttribute('data-duration') || '1400', 10);
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = ru(target * e, dec);
      if (k < 1) requestAnimationFrame(step); else el.textContent = ru(target, dec);
    }
    requestAnimationFrame(step);
  }

  function onEnter(entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add('is-in');
      if (el.hasAttribute('data-count')) runCount(el);
      io.unobserve(el);
    });
  }

  function initReveal() {
    qsa('[data-stagger]').forEach(function (p) {
      Array.prototype.forEach.call(p.children, function (c, i) {
        if (!c.hasAttribute('data-reveal')) c.setAttribute('data-reveal', 'up');
        c.style.setProperty('--i', i);
      });
    });
    qsa('[data-split]').forEach(splitWords);
    qsa('[data-stars]').forEach(function (el) {
      var r = parseFloat(String(el.getAttribute('data-stars')).replace(',', '.')) || 0;
      el.style.setProperty('--r', r); el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'рейтинг ' + ru(r, 1) + ' из 5');
    });
    qsa('[data-count]').forEach(function (el) {
      if (!el.dataset.counted && !reduce) el.textContent = ru(0, parseInt(el.getAttribute('data-decimals') || '0', 10));
    });
    if (reduce || !('IntersectionObserver' in window)) {
      qsa('[data-reveal],[data-split],[data-count]').forEach(function (el) {
        el.classList.add('is-in');
        if (el.hasAttribute('data-count')) el.textContent = ru(parseFloat(el.getAttribute('data-count')), parseInt(el.getAttribute('data-decimals') || '0', 10));
      });
      return;
    }
    if (io) io.disconnect();
    io = new IntersectionObserver(onEnter, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    qsa('[data-reveal],[data-split],[data-count]').forEach(function (el) { if (!el.classList.contains('is-in')) io.observe(el); });
  }

  /* ---------- сцены, параллакс, фон, меню, липкая кнопка ---------- */
  var scenes = [], parallax = [], drifts = [], spies = [], stickies = [], bar = null, header = null, ticking = false;

  function collect() {
    scenes = qsa('[data-scene]').map(function (s) {
      var span = parseFloat(s.getAttribute('data-scene')) || 2;
      s.style.setProperty('--span', span);
      var stacks = qsa('[data-stack]', s).map(function (st) { return { el: st, frames: qsa('[data-frame]', st) }; });
      return {
        el: s, stacks: stacks,
        cues: qsa('[data-cue]', s).map(function (c) { var a = c.getAttribute('data-cue').split(/\s+/).map(parseFloat); return { el: c, from: a[0], to: a[1] }; }),
        pan: qsa('[data-pan]', s),
        compares: qsa('[data-compare="scroll"]', s),
        gotos: qsa('[data-goto]', s), fors: qsa('[data-for]', s)
      };
    });
    parallax = qsa('[data-parallax]').map(function (el) { return { el: el, k: parseFloat(el.getAttribute('data-parallax')) || 0 }; });
    drifts = qsa('[data-drift]').map(function (el) { return { el: el, color: el.getAttribute('data-drift'), ink: el.getAttribute('data-drift-ink') }; });
    spies = qsa('a[data-spy]').map(function (a) { var id = (a.getAttribute('href') || '').replace('#', ''); return { a: a, sec: id ? document.getElementById(id) : null }; }).filter(function (s) { return s.sec; });
    stickies = qsa('[data-sticky-cta]').map(function (el) { return { el: el, after: document.querySelector(el.getAttribute('data-after') || ''), until: document.querySelector(el.getAttribute('data-until') || '') }; });
    bar = document.querySelector('[data-progress]');
    header = document.querySelector('[data-header]');
  }

  function stackFrames(st, p, gotos, fors) {
    var n = st.frames.length; if (!n) return;
    var f = p * (n - 1), active = Math.round(f);
    st.frames.forEach(function (fr, i) {
      var d = Math.abs(f - i);
      if (i > 0) fr.style.opacity = clamp((0.75 - d) / 0.5, 0, 1).toFixed(3);   // плато ±0.25 кадра, кроссфейд между; нижний кадр всегда непрозрачен
      fr.classList.toggle('is-active', i === active);
    });
    gotos.forEach(function (g) { g.classList.toggle('is-active', parseInt(g.getAttribute('data-goto'), 10) === active); });
    fors.forEach(function (g) { g.classList.toggle('is-active', parseInt(g.getAttribute('data-for'), 10) === active); });
  }

  function frame() {
    ticking = false;
    vh = window.innerHeight;
    var y = window.scrollY || window.pageYOffset;

    if (bar) { var max = root.scrollHeight - vh; bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ')'; }
    if (header) header.classList.toggle('is-scrolled', y > 40);

    spies.forEach(function (s) { s.on = false; });
    for (var i = spies.length - 1; i >= 0; i--) { if (spies[i].sec.getBoundingClientRect().top <= vh * 0.4) { spies[i].on = true; break; } }
    spies.forEach(function (s) { s.a.classList.toggle('is-active', !!s.on); if (s.on) s.a.setAttribute('aria-current', 'true'); else s.a.removeAttribute('aria-current'); });

    stickies.forEach(function (s) {
      var after = s.after ? s.after.getBoundingClientRect().bottom < 0 : true;
      var until = s.until ? s.until.getBoundingClientRect().top > vh * 0.6 : true;
      s.el.classList.toggle('is-shown', after && until);
    });

    if (reduce) return;

    var center = vh * 0.5, hit = null;
    drifts.forEach(function (d) { var r = d.el.getBoundingClientRect(); if (r.top <= center && r.bottom > center) hit = d; });
    if (hit) { document.body.style.setProperty('--page-bg', hit.color); if (hit.ink) document.body.style.setProperty('--page-ink', hit.ink); else document.body.style.removeProperty('--page-ink'); }

    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > 2 * vh) return;
      var total = r.height - vh, p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
      s.el.style.setProperty('--p', p.toFixed(4));
      var fade = 0.06;
      s.cues.forEach(function (c) {
        var fin = c.from <= 0 ? 1 : clamp((p - c.from) / fade, 0, 1);
        var fout = c.to >= 1 ? 1 : clamp((c.to - p) / fade, 0, 1);
        c.el.style.setProperty('--cue', (fin * fout).toFixed(3));
      });
      s.pan.forEach(function (el) {
        var dist = Math.max(0, el.scrollWidth - el.parentElement.clientWidth);
        el.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
      });
      s.stacks.forEach(function (st) { stackFrames(st, p, s.gotos, s.fors); });
      s.compares.forEach(function (el) {
        var a = parseFloat(el.getAttribute('data-from') || '50'), b = parseFloat(el.getAttribute('data-to') || '0');
        el.style.setProperty('--split', (a + (b - a) * p).toFixed(1) + '%');
      });
    });

    parallax.forEach(function (p) {
      var r = p.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      p.el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * p.k).toFixed(1) + 'px,0)';
    });
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  /* ---------- кнопки «к кадру» внутри сцен ---------- */
  function bindGoto() {
    scenes.forEach(function (s) {
      var n = s.stacks.length ? s.stacks[0].frames.length : 0;
      s.gotos.forEach(function (g) {
        if (g.dataset.bound) return; g.dataset.bound = '1';
        g.addEventListener('click', function (e) {
          e.preventDefault();
          var idx = parseInt(g.getAttribute('data-goto'), 10) || 0;
          var top = s.el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
          var total = s.el.offsetHeight - window.innerHeight;
          window.scrollTo({ top: top + (n > 1 ? idx / (n - 1) : 0) * total, behavior: reduce ? 'auto' : 'smooth' });
        });
      });
    });
  }

  /* ---------- было / стало (перетаскивание) ---------- */
  function bindCompare() {
    qsa('[data-compare]').forEach(function (el) {
      if (el.dataset.bound || el.getAttribute('data-compare') === 'scroll') return; el.dataset.bound = '1';
      var handle = el.querySelector('.compare__handle') || el, dragging = false;
      function set(pct) { pct = clamp(pct, 0, 100); el.style.setProperty('--split', pct.toFixed(1) + '%'); if (handle.setAttribute) handle.setAttribute('aria-valuenow', Math.round(pct)); }
      function fromEvent(e) { var r = el.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); }
      el.addEventListener('pointerdown', function (e) { dragging = true; el.setPointerCapture(e.pointerId); fromEvent(e); });
      el.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
      el.addEventListener('pointerup', function () { dragging = false; });
      el.addEventListener('pointercancel', function () { dragging = false; });
      handle.addEventListener('keydown', function (e) {
        var cur = parseFloat(getComputedStyle(el).getPropertyValue('--split')) || 50;
        if (e.key === 'ArrowLeft') { set(cur - 5); e.preventDefault(); } else if (e.key === 'ArrowRight') { set(cur + 5); e.preventDefault(); }
      });
    });
  }

  /* ---------- украшения для мыши ---------- */
  function bindPointer() {
    if (reduce || !canHover) return;
    qsa('[data-tilt]').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      var k = parseFloat(el.getAttribute('data-tilt')) || 6;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = 'perspective(900px) rotateX(' + (-y * k).toFixed(2) + 'deg) rotateY(' + (x * k).toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
    qsa('[data-magnet]').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      var k = parseFloat(el.getAttribute('data-magnet')) || .25;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * k).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * k).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
    qsa('[data-spotlight]').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px'); el.style.setProperty('--spot', 1);
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--spot', 0); });
    });
  }

  /* ---------- фото крупно ---------- */
  function bindZoom() {
    var links = qsa('a[data-zoom]');
    if (!links.length || typeof HTMLDialogElement === 'undefined') return;
    var dlg = document.getElementById('zoom-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'zoom-dialog'; dlg.className = 'zoom'; dlg.setAttribute('aria-label', 'Фото крупно');
      dlg.innerHTML = '<button class="zoom__close" type="button" aria-label="Закрыть">×</button><img alt="">';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function () { dlg.close(); });
      dlg.addEventListener('close', function () { dlg.querySelector('img').removeAttribute('src'); });
    }
    links.forEach(function (a) {
      if (a.dataset.bound) return; a.dataset.bound = '1';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var im = a.querySelector('img'), big = dlg.querySelector('img');
        big.src = a.getAttribute('href'); big.alt = im ? im.alt : '';
        dlg.showModal();
      });
    });
  }

  /* ---------- слоты картинок: нет файла, значит оформленная заглушка вместо битого значка ---------- */
  function bindSlots() {
    qsa('img[data-slot]').forEach(function (img) {
      if (img.dataset.slotBound) return; img.dataset.slotBound = '1';
      function miss() { img.classList.add('is-missing'); var p = img.closest('.slot'); if (p) p.classList.add('is-missing'); }
      function ok() { img.classList.remove('is-missing'); var p = img.closest('.slot'); if (p) p.classList.remove('is-missing'); }
      img.addEventListener('error', miss);
      img.addEventListener('load', ok);
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) miss();
    });
  }

  var bound = false;
  function init() {
    initReveal();
    collect();
    bindGoto(); bindCompare(); bindPointer(); bindZoom(); bindSlots();
    frame();
    if (!bound) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      bound = true;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', onScroll);
})();

/* Comly Network — i18n + shared UI behaviour (prototype) */
(function () {
  'use strict';

  var STORAGE_KEY = 'comly-lang';
  var html = document.documentElement;
  var lang = 'ar';

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') lang = saved;
  } catch (e) { /* ignore */ }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function apply(next) {
    lang = next;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    var title = html.getAttribute('data-title-' + lang);
    if (title) document.title = title;

    var desc = html.getAttribute('data-desc-' + lang);
    var meta = document.querySelector('meta[name="description"]');
    if (desc && meta) meta.setAttribute('content', desc);

    document.querySelectorAll('[data-en]').forEach(function (el) {
      if (el.dataset.ar === undefined) el.dataset.ar = el.textContent;
      el.textContent = lang === 'ar' ? el.dataset.ar : el.dataset.en;
    });

    document.querySelectorAll('[data-en-placeholder]').forEach(function (el) {
      if (el.dataset.arPlaceholder === undefined) {
        el.dataset.arPlaceholder = el.getAttribute('placeholder') || '';
      }
      el.setAttribute('placeholder', lang === 'ar' ? el.dataset.arPlaceholder : el.dataset.enPlaceholder);
    });

    document.querySelectorAll('[data-en-title]').forEach(function (el) {
      if (el.dataset.arTitle === undefined) el.dataset.arTitle = el.getAttribute('title') || '';
      el.setAttribute('title', lang === 'ar' ? el.dataset.arTitle : el.dataset.enTitle);
    });

    document.querySelectorAll('[data-en-aria]').forEach(function (el) {
      if (el.dataset.arAria === undefined) el.dataset.arAria = el.getAttribute('aria-label') || '';
      el.setAttribute('aria-label', lang === 'ar' ? el.dataset.arAria : el.dataset.enAria);
    });

    var toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.textContent = lang === 'ar' ? 'EN' : 'عربي';
      toggle.setAttribute('aria-label', lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
    }

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }

    window.dispatchEvent(new CustomEvent('comly:lang', { detail: { lang: lang } }));
  }

  window.comlyI18n = {
    get lang() { return lang; },
    apply: apply
  };

  var toggleBtn = document.getElementById('langToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      apply(lang === 'ar' ? 'en' : 'ar');
    });
  }

  /* Mobile nav */
  var burger = document.getElementById('navBurger');
  var mobile = document.getElementById('navMobile');
  if (burger && mobile) {
    burger.addEventListener('click', function () {
      var open = mobile.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobile.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { mobile.classList.remove('open'); });
    });
  }

  /* Reveal on scroll */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* Toast helper */
  var toastTimer;
  window.comlyToast = function (message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2000);
  };

  apply(lang);
})();

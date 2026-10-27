/* Comly Network — 3-state theme engine (light / dark / system) */
(function () {
  'use strict';

  var KEY = 'comly-theme';
  var VALID = ['light', 'dark', 'system'];
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var mode = 'light';

  function resolve(value) {
    if (value === 'system') return mq && mq.matches ? 'dark' : 'light';
    return value === 'dark' ? 'dark' : 'light';
  }

  function paint(value) {
    var theme = resolve(value);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', value);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#05060a' : '#ffffff');

    document.querySelectorAll('[data-theme-option]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-theme-option') === value ? 'true' : 'false');
    });
  }

  function stored() {
    try {
      var fromUrl = new URLSearchParams(location.search).get('theme');
      if (fromUrl && VALID.indexOf(fromUrl) >= 0) return fromUrl;
      var saved = localStorage.getItem(KEY);
      if (saved && VALID.indexOf(saved) >= 0) return saved;
    } catch (e) { /* ignore */ }
    return 'system'; /* default = system preference */
  }

  mode = stored();
  paint(mode);

  document.querySelectorAll('[data-theme-option]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      mode = btn.getAttribute('data-theme-option');
      paint(mode);
      try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
    });
  });

  function onSystemChange() {
    if (mode === 'system') paint('system');
  }
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  window.comlyTheme = {
    paint: paint,
    get mode() { return mode; },
    get theme() { return root.getAttribute('data-theme'); }
  };
})();

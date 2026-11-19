/* Comly Network — API playground (docs / #api). Real same-origin requests. */
(function () {
  'use strict';

  var root = document.getElementById('apiTool');
  if (!root) return;

  var $ = function (id) { return document.getElementById(id); };
  var endpoint = $('apiEndpoint');
  var methodBadge = $('apiMethod');
  var query = $('apiQuery');
  var body = $('apiBody');
  var langSelect = $('apiLang');
  var runBtn = $('apiRun');
  var errorBox = $('apiError');
  var statusBadge = $('apiStatus');
  var timeNode = $('apiTime');
  var response = $('apiResponse');
  var snippet = $('apiSnippet');
  var copySnippetBtn = $('apiCopySnippet');
  var copyResponseBtn = $('apiCopyResponse');

  var COPY = {
    ar: {
      run: 'إرسال', running: 'جارٍ الإرسال…',
      badJson: 'JSON غير صالح — تحقق من الأقواس والفواصل.',
      badJsonObject: 'يجب أن يكون جسم الطلب كائناً JSON.',
      networkError: 'تعذّر الاتصال بالخادم.',
      httpError: 'استجابة الخادم: HTTP',
      failed: 'فشل', noFetch: 'المتصفح لا يدعم fetch.',
      ms: 'ms', copiedSnippet: 'تم نسخ الكود ✓', copiedResponse: 'تم نسخ الاستجابة ✓'
    },
    en: {
      run: 'Send request', running: 'Sending…',
      badJson: 'Invalid JSON — check brackets and commas.',
      badJsonObject: 'The request body must be a JSON object.',
      networkError: 'Could not reach the server.',
      httpError: 'Server responded: HTTP',
      failed: 'Failed', noFetch: 'This browser does not support fetch.',
      ms: 'ms', copiedSnippet: 'Snippet copied ✓', copiedResponse: 'Response copied ✓'
    }
  };

  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'ar'; }
  function t(key) { return COPY[lang()][key]; }

  function toast(message) {
    if (typeof window.comlyToast === 'function') { window.comlyToast(message); return; }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2000);
  }
  if (typeof window.comlyToast !== 'function') window.comlyToast = toast;

  var SAMPLES = {
    '/api/shorten': { body: '{\n  "url": "https://example.com/page",\n  "expiresIn": 24\n}' },
    '/api/lookup': { query: 'https://comm.ly/AbC123' }
  };

  var pending = false;
  var lastResponse = '';

  function config() {
    var ep = endpoint ? endpoint.value : '/api/health';
    return {
      endpoint: ep,
      method: ep === '/api/shorten' ? 'POST' : 'GET',
      post: ep === '/api/shorten',
      hasQuery: ep === '/api/lookup'
    };
  }

  function setError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || '';
    errorBox.classList.toggle('show', !!message);
  }

  function setShown(node, show) {
    if (!node) return;
    node.classList.toggle('is-hidden', !show);
    node.style.display = show ? '' : 'none';
  }

  function origin() {
    return window.location.origin || (window.location.protocol + '//' + window.location.host);
  }

  function queryValue() { return query ? String(query.value || '').trim() : ''; }
  function bodyValue() { return body ? String(body.value || '') : ''; }

  function shownUrl(cfg) {
    var url = origin() + cfg.endpoint;
    if (cfg.hasQuery && queryValue()) url += '?url=' + encodeURIComponent(queryValue());
    return url;
  }

  function requestUrl(cfg) {
    var url = cfg.endpoint;
    if (cfg.hasQuery && queryValue()) url += '?url=' + encodeURIComponent(queryValue());
    return url;
  }

  function jsQuote(value) { return JSON.stringify(String(value)); }

  function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
  }

  function pyQuote(value) {
    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      .replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
  }

  function pyValue(value) {
    if (value === null) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return pyQuote(value);
    if (Object.prototype.toString.call(value) === '[object Array]') {
      var items = [];
      for (var i = 0; i < value.length; i += 1) items.push(pyValue(value[i]));
      return '[' + items.join(', ') + ']';
    }
    if (value && typeof value === 'object') {
      var pairs = [];
      for (var key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) pairs.push(pyQuote(key) + ': ' + pyValue(value[key]));
      }
      return '{' + pairs.join(', ') + '}';
    }
    return pyQuote(String(value));
  }

  function curlSnippet(cfg) {
    var cmd = 'curl -X ' + cfg.method + ' "' + shownUrl(cfg) + '"';
    if (cfg.post) {
      cmd += ' -H "Content-Type: application/json"';
      cmd += ' -d ' + shellQuote(bodyValue());
    }
    return cmd;
  }

  function jsSnippet(cfg) {
    var lines = ['fetch(' + jsQuote(shownUrl(cfg)) + ', {', '  method: ' + jsQuote(cfg.method)];
    if (cfg.post) {
      lines.push('  headers: { "Content-Type": "application/json" },');
      lines.push('  body: ' + jsQuote(bodyValue()));
    }
    lines.push('})');
    lines.push('  .then(function (res) { return res.json(); })');
    lines.push('  .then(function (data) { console.log(data); });');
    return lines.join('\n');
  }

  function pySnippet(cfg) {
    var lines = ['import requests', ''];
    if (cfg.post) {
      var payload = pyQuote(bodyValue());
      try { payload = pyValue(JSON.parse(bodyValue())); } catch (e) { /* keep raw string */ }
      lines.push('payload = ' + payload);
      lines.push('r = requests.post(' + pyQuote(origin() + cfg.endpoint) + ', json=payload)');
    } else {
      var args = pyQuote(origin() + cfg.endpoint);
      if (cfg.hasQuery && queryValue()) args += ', params={' + pyQuote('url') + ': ' + pyQuote(queryValue()) + '}';
      lines.push('r = requests.get(' + args + ')');
    }
    lines.push('print(r.status_code, r.json())');
    return lines.join('\n');
  }

  function renderSnippet() {
    if (!snippet) return;
    var cfg = config();
    var kind = langSelect ? langSelect.value : 'curl';
    if (kind === 'javascript') snippet.textContent = jsSnippet(cfg);
    else if (kind === 'python') snippet.textContent = pySnippet(cfg);
    else snippet.textContent = curlSnippet(cfg);
  }

  function sync(withSamples) {
    var cfg = config();
    if (methodBadge) methodBadge.textContent = cfg.method;
    setShown(query, cfg.hasQuery);
    setShown(body, cfg.post);
    var sample = SAMPLES[cfg.endpoint] || {};
    if (withSamples && cfg.hasQuery && query) query.value = sample.query || '';
    if (withSamples && cfg.post && body) body.value = sample.body || '';
    renderSnippet();
  }

  function readBody(res) {
    if (res && typeof res.text === 'function') return res.text();
    if (res && typeof res.json === 'function') {
      return res.json().then(function (data) { return JSON.stringify(data); });
    }
    return Promise.resolve('');
  }

  function run() {
    if (pending) return;
    if (typeof window.fetch !== 'function') { setError(t('noFetch')); return; }
    var cfg = config();
    setError('');
    var payload = null;
    if (cfg.post) {
      try { payload = JSON.parse(bodyValue()); } catch (e) { setError(t('badJson')); return; }
      if (!payload || typeof payload !== 'object' || Object.prototype.toString.call(payload) === '[object Array]') {
        setError(t('badJsonObject'));
        return;
      }
    }

    pending = true;
    if (runBtn) { runBtn.disabled = true; runBtn.classList.add('is-loading'); }
    var label = runBtn && runBtn.querySelector('.btn-label');
    if (label) label.textContent = t('running');
    if (statusBadge) { statusBadge.textContent = '…'; statusBadge.classList.remove('live'); }
    if (timeNode) timeNode.textContent = '';
    if (response) response.textContent = '';
    lastResponse = '';

    var init = cfg.post
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      : { method: 'GET', headers: { Accept: 'application/json' } };
    var started = Date.now();

    window.fetch(requestUrl(cfg), init).then(function (res) {
      if (statusBadge) {
        statusBadge.textContent = 'HTTP ' + res.status;
        statusBadge.classList.toggle('live', !!res.ok);
      }
      return readBody(res).then(function (raw) {
        var text = String(raw == null ? '' : raw);
        try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* raw text fallback */ }
        lastResponse = text;
        if (response) response.textContent = text;
        if (!res.ok && !errorBox.textContent) setError(t('httpError') + ' ' + res.status);
      });
    }).catch(function (err) {
      setError(t('networkError') + (err && err.message ? ' ' + err.message : ''));
      if (statusBadge) { statusBadge.textContent = t('failed'); statusBadge.classList.remove('live'); }
    }).finally(function () {
      if (timeNode) timeNode.textContent = (Date.now() - started) + ' ' + t('ms');
      pending = false;
      if (runBtn) { runBtn.disabled = false; runBtn.classList.remove('is-loading'); }
      if (label) label.textContent = t('run');
    });
  }

  function copyText(text, message) {
    var done = function () { toast(message); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  if (endpoint) endpoint.addEventListener('change', function () { sync(true); });
  if (langSelect) langSelect.addEventListener('change', renderSnippet);
  if (query) {
    query.addEventListener('input', renderSnippet);
    query.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); run(); }
    });
  }
  if (body) body.addEventListener('input', renderSnippet);
  if (runBtn) runBtn.addEventListener('click', run);
  if (copySnippetBtn) copySnippetBtn.addEventListener('click', function () {
    copyText(snippet ? snippet.textContent : '', t('copiedSnippet'));
  });
  if (copyResponseBtn) copyResponseBtn.addEventListener('click', function () {
    copyText(lastResponse, t('copiedResponse'));
  });

  sync(true);
})();

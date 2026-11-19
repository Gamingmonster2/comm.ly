/* Comly Network — link lookup / safety inspector (docs / #lookup). */
(function () {
  'use strict';

  var root = document.getElementById('lookupTool');
  if (!root) return;

  var $ = function (id) { return document.getElementById(id); };
  var input = $('lookupInput');
  var lookupBtn = $('lookupButton');
  var errorBox = $('lookupError');
  var result = $('lookupResult');
  var destinationNode = $('lookupDestination');
  var hostNode = $('lookupHost');
  var codeNode = $('lookupCode');
  var statusNode = $('lookupStatus');
  var expiryNode = $('lookupExpiry');
  var sourceNode = $('lookupSource');
  var openBtn = $('lookupOpen');
  var copyBtn = $('lookupCopy');
  var shortenBtn = $('lookupShorten');

  var COPY = {
    ar: {
      empty: 'أدخل رابطاً للفحص.',
      invalid: 'أدخل رابطاً صالحاً يبدأ بـ http:// أو https://',
      lookup: 'افحص الرابط', checking: 'جارٍ الفحص…',
      verified: 'مؤكّد', expired: 'منتهي', inactive: 'غير نشط', notFound: 'غير موجود', external: 'خارجي',
      none: '—', never: 'لا ينتهي',
      sourceNetwork: 'شبكة comm.ly', sourceExternal: 'مصدر خارجي',
      sigHttpsOk: 'اتصال آمن (HTTPS)', sigHttpsWarn: 'رابط غير آمن (HTTP)',
      sigNetworkOk: 'نطاق معروف في شبكة comm.ly', sigNetworkWarn: 'النطاق ليس ضمن شبكة comm.ly',
      sigActiveOk: 'الرابط نشط', sigActiveWarn: 'الرابط غير نشط', sigActiveBad: 'الرابط منتهي',
      sigActiveUnknown: 'لا توجد حالة متاحة',
      sigKnownWarn: 'مختصر روابط معروف — تحقق من الوجهة النهائية', sigKnownOk: 'لا يوجد مختصر روابط معروف',
      invalidUrlServer: 'الرابط الذي أدخلته غير صالح.',
      unsupportedHost: 'هذا النطاق ليس ضمن شبكة comm.ly، لا يمكن فحصه.',
      notFoundServer: 'لم يتم العثور على رابط مختصر لهذا العنوان.',
      networkError: 'تعذّر فحص الرابط الآن.', httpError: 'استجابة الخادم: HTTP',
      shortenFailed: 'تعذّر إنشاء رابط مختصر.',
      shorten: 'اختصار', shortening: 'جارٍ الإنشاء…',
      shortened: 'رابطك المختصر:', shortenedToast: 'تم إنشاء الرابط المختصر ✓',
      copied: 'تم نسخ الوجهة ✓'
    },
    en: {
      empty: 'Enter a link to look up.',
      invalid: 'Enter a valid link starting with http:// or https://',
      lookup: 'Look up', checking: 'Checking…',
      verified: 'Verified', expired: 'Expired', inactive: 'Inactive', notFound: 'Not found', external: 'External',
      none: '—', never: 'Never',
      sourceNetwork: 'comm.ly network', sourceExternal: 'External source',
      sigHttpsOk: 'Secure connection (HTTPS)', sigHttpsWarn: 'Insecure link (HTTP)',
      sigNetworkOk: 'Known comm.ly network domain', sigNetworkWarn: 'Domain is not on the comm.ly network',
      sigActiveOk: 'Link is active', sigActiveWarn: 'Link is inactive', sigActiveBad: 'Link has expired',
      sigActiveUnknown: 'No status available',
      sigKnownWarn: 'Known shortener — check the final destination', sigKnownOk: 'No known shortener detected',
      invalidUrlServer: 'That link is not valid.',
      unsupportedHost: 'This host is not on the comm.ly network, so it cannot be expanded.',
      notFoundServer: 'No short link was found for that URL.',
      networkError: 'Could not check the link right now.', httpError: 'Server responded: HTTP',
      shortenFailed: 'Could not create a short link.',
      shorten: 'Shorten', shortening: 'Creating…',
      shortened: 'Your short link:', shortenedToast: 'Short link created ✓',
      copied: 'Destination copied ✓'
    }
  };

  var KNOWN_SHORTENERS = [
    'bit.ly', 'bitly.com', 't.co', 'tinyurl.com', 'tiny.cc', 'goo.gl', 'is.gd', 'ow.ly',
    'buff.ly', 'cutt.ly', 'cutt.us', 'rebrand.ly', 'shorte.st', 's.id', 't.ly', 'short.link',
    'clck.ru', 'lnkd.in', 'fb.me', 'j.mp', 'soo.gd', 'v.gd', 'x.co', 'q.gs'
  ];

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

  var pending = false;
  var currentDestination = '';

  function setError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || '';
    errorBox.classList.toggle('show', !!message);
  }

  function showResult(show) {
    if (!result) return;
    if (show) {
      result.classList.remove('is-hidden');
      result.removeAttribute('hidden');
      result.style.display = '';
    } else {
      result.classList.add('is-hidden');
      result.setAttribute('hidden', '');
      result.style.display = 'none';
    }
  }

  function normalize(raw) {
    var value = String(raw || '').trim();
    if (!value) return { error: t('empty') };
    if (!/^https?:\/\//i.test(value)) {
      if (/^[^\s]+\.[^\s]{2,}/.test(value)) value = 'https://' + value;
      else return { error: t('invalid') };
    }
    var host = '';
    try {
      var parsed = new window.URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: t('invalid') };
      host = parsed.hostname.toLowerCase();
      if (!host) return { error: t('invalid') };
      return { value: parsed.toString(), host: host };
    } catch (e) {
      var match = /^https?:\/\/([^\/?#:]+)/i.exec(value);
      if (!match) return { error: t('invalid') };
      host = match[1].toLowerCase();
      return { value: value, host: host };
    }
  }

  function isNetworkHost(host) {
    var value = String(host || '').toLowerCase();
    return value === 'comm.ly' || /^[0-9]+\.com\.ly$/.test(value);
  }

  function isKnownShortener(host) {
    var value = String(host || '').toLowerCase();
    for (var i = 0; i < KNOWN_SHORTENERS.length; i += 1) {
      if (value === KNOWN_SHORTENERS[i] || value === 'www.' + KNOWN_SHORTENERS[i]) return true;
    }
    return false;
  }

  function signal(node, state, text) {
    if (!node) return;
    node.classList.remove('signal-ok', 'signal-warn', 'signal-bad');
    node.classList.add('signal-' + state);
    node.textContent = text;
  }

  function setText(node, value) { if (node) node.textContent = String(value); }

  function formatDate(iso) {
    if (!iso) return t('never');
    try {
      return new Date(iso).toLocaleString(lang() === 'en' ? 'en-GB' : 'ar-LY', {
        dateStyle: 'medium', timeStyle: 'short'
      });
    } catch (e) { return String(iso); }
  }

  function statusFor(data) {
    if (!data || typeof data !== 'object') return { key: 'notFound', state: 'signal-bad' };
    if (data.error === 'unsupported_host' || data.external === true) return { key: 'external', state: 'signal-warn' };
    if (data.error === 'invalid_url') return { key: 'notFound', state: 'signal-bad' };
    if (data.found === false) return { key: 'notFound', state: 'signal-bad' };
    if (data.expired) return { key: 'expired', state: 'signal-bad' };
    if (data.active === false) return { key: 'inactive', state: 'signal-warn' };
    return { key: 'verified', state: 'live' };
  }

  function renderSignals(data, parsed, known) {
    var info = data || {};
    var https = info.safeProtocol === undefined ? /^https:\/\//i.test(parsed.value) : !!info.safeProtocol;
    signal($('signalHttps'), https ? 'ok' : 'warn', https ? t('sigHttpsOk') : t('sigHttpsWarn'));

    var host = info.host || parsed.host;
    var network = info.external === true ? false : isNetworkHost(host);
    signal($('signalNetwork'), network ? 'ok' : 'warn', network ? t('sigNetworkOk') : t('sigNetworkWarn'));

    if (info.expired) signal($('signalActive'), 'bad', t('sigActiveBad'));
    else if (info.active === false) signal($('signalActive'), 'warn', t('sigActiveWarn'));
    else if (info.found === false || info.error) signal($('signalActive'), 'warn', t('sigActiveUnknown'));
    else signal($('signalActive'), 'ok', t('sigActiveOk'));

    var shortener = known || !!info.knownShortener;
    signal($('signalKnownShortener'), shortener ? 'warn' : 'ok', shortener ? t('sigKnownWarn') : t('sigKnownOk'));
  }

  function render(data, parsed) {
    var info = data && typeof data === 'object' ? data : {};
    var found = info.found === true && !!info.destination;
    currentDestination = found && /^https?:\/\//i.test(String(info.destination)) ? String(info.destination) : '';

    setText(destinationNode, found ? info.destination : t('none'));
    setText(hostNode, info.host || parsed.host || t('none'));
    setText(codeNode, info.code || t('none'));
    setText(expiryNode, found ? formatDate(info.expiresAt) : (info.expiresAt ? formatDate(info.expiresAt) : t('none')));
    setText(sourceNode, info.external === true || info.error === 'unsupported_host' ? t('sourceExternal') : t('sourceNetwork'));

    if (statusNode) {
      var status = statusFor(info);
      statusNode.className = 'status-pill ' + status.state;
      statusNode.textContent = t(status.key);
    }

    renderSignals(info, parsed, isKnownShortener(parsed.host));
    showResult(true);
  }

  function parseBody(res) {
    if (res && typeof res.text === 'function') {
      return res.text().then(function (raw) {
        try { return JSON.parse(raw); } catch (e) { return null; }
      });
    }
    if (res && typeof res.json === 'function') return res.json().catch(function () { return null; });
    return Promise.resolve(null);
  }

  function setLoading(loading) {
    pending = loading;
    if (lookupBtn) { lookupBtn.disabled = loading; lookupBtn.classList.toggle('is-loading', loading); }
    var label = lookupBtn && lookupBtn.querySelector('.btn-label');
    if (label) label.textContent = loading ? t('checking') : t('lookup');
  }

  function lookup() {
    if (pending) return;
    var parsed = normalize(input ? input.value : '');
    if (parsed.error) { setError(parsed.error); return; }
    if (typeof window.fetch !== 'function') { setError(t('networkError')); return; }

    setError('');
    currentDestination = '';
    setLoading(true);
    if (statusNode) { statusNode.className = 'status-pill'; statusNode.textContent = '…'; }
    renderSignals({}, parsed, isKnownShortener(parsed.host));

    window.fetch('/api/lookup?url=' + encodeURIComponent(parsed.value), {
      method: 'GET', headers: { Accept: 'application/json' }
    }).then(function (res) {
      return parseBody(res).then(function (data) {
        if (!data || typeof data !== 'object') {
          showResult(false);
          setError(t('httpError') + ' ' + (res && res.status ? res.status : ''));
          return;
        }
        if (data.error === 'invalid_url') setError(t('invalidUrlServer'));
        else if (data.error === 'unsupported_host') setError(t('unsupportedHost'));
        else if (data.found === false) setError(t('notFoundServer'));
        else setError('');
        render(data, parsed);
      });
    }).catch(function () {
      showResult(false);
      setError(t('networkError'));
    }).finally(function () {
      setLoading(false);
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

  function openDestination() {
    if (!currentDestination) return;
    var win = window.open(currentDestination, '_blank', 'noopener,noreferrer');
    if (win && typeof win.opener !== 'undefined') { try { win.opener = null; } catch (e) { /* ignore */ } }
  }

  function shorten() {
    if (!currentDestination || !shortenBtn || shortenBtn.disabled) return;
    setError('');
    shortenBtn.disabled = true;
    shortenBtn.classList.add('is-loading');
    var label = shortenBtn.querySelector('.btn-label');
    if (label) label.textContent = t('shortening');

    window.fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentDestination, expiresIn: 0 })
    }).then(function (res) {
      return parseBody(res).then(function (data) {
        if (!data || !data.shortUrl) throw new Error(data && data.error ? data.error : 'shorten-failed');
        var node = $('lookupShortUrl');
        if (!node) {
          node = document.createElement('div');
          node.id = 'lookupShortUrl';
          node.className = 'lookup-short-url';
          if (result) result.appendChild(node);
        }
        node.textContent = t('shortened') + ' ' + data.shortUrl;
        toast(t('shortenedToast'));
      });
    }).catch(function (err) {
      setError(t('shortenFailed') + (err && err.message ? ' ' + err.message : ''));
    }).finally(function () {
      shortenBtn.disabled = false;
      shortenBtn.classList.remove('is-loading');
      if (label) label.textContent = t('shorten');
    });
  }

  if (lookupBtn) lookupBtn.addEventListener('click', lookup);
  if (input) input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); lookup(); }
  });
  if (openBtn) openBtn.addEventListener('click', openDestination);
  if (copyBtn) copyBtn.addEventListener('click', function () { copyText(currentDestination, t('copied')); });
  if (shortenBtn) shortenBtn.addEventListener('click', shorten);

  showResult(false);
  renderSignals({}, { value: 'https://', host: '' }, false);
})();

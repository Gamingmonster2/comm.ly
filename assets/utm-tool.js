/* Comly Network — UTM campaign builder (n4). */
(function () {
  'use strict';

  var root = document.getElementById('utmTool');
  if (!root) return;

  var $ = function (id) { return document.getElementById(id); };
  var urlInput = $('utmUrl');
  var sourceInput = $('utmSource');
  var mediumInput = $('utmMedium');
  var campaignInput = $('utmCampaign');
  var termInput = $('utmTerm');
  var contentInput = $('utmContent');
  var shortenCheck = $('utmShorten');
  var generateBtn = $('utmGenerate');
  var errorBox = $('utmError');
  var resultBox = $('utmResult');
  var fullUrlNode = $('utmFullUrl');
  var shortUrlNode = $('utmShortUrl');
  var copyFullBtn = $('utmCopyFull');
  var copyShortBtn = $('utmCopyShort');
  var openBtn = $('utmOpen');
  var codeNode = $('utmCode');
  var metaNode = $('utmMeta');

  var COPY = {
    ar: {
      emptyUrl: 'أدخل رابطاً أولاً.',
      invalidUrl: 'أدخل رابطاً صالحاً يبدأ بـ http:// أو https://',
      shortenFailed: 'تعذّر اختصار الرابط. تم عرض الرابط المُوسوم بدلاً منه.',
      generating: 'جارٍ التوليد…',
      generate: 'أنشئ الرابط',
      copiedFull: 'تم نسخ الرابط المُوسوم ✓',
      copiedShort: 'تم نسخ الرابط المختصر ✓',
      presetApplied: 'تم تطبيق الإعداد المسبق ✓',
      noParams: 'بدون معاملات إضافية',
      codeLabel: 'الرمز',
      ready: 'جاهز',
      openLabel: 'افتح الرابط'
    },
    en: {
      emptyUrl: 'Enter a URL first.',
      invalidUrl: 'Enter a valid http:// or https:// URL.',
      shortenFailed: 'Could not shorten the link. Showing the tagged URL instead.',
      generating: 'Generating…',
      generate: 'Generate URL',
      copiedFull: 'Tagged URL copied ✓',
      copiedShort: 'Short URL copied ✓',
      presetApplied: 'Preset applied ✓',
      noParams: 'No extra parameters',
      codeLabel: 'Code',
      ready: 'Ready',
      openLabel: 'Open link'
    }
  };

  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'ar'; }
  function t(key) { return COPY[lang()][key] || COPY.ar[key] || ''; }

  /* window.comlyToast when the host page provides it; otherwise the local #toast. */
  function toast(message) {
    if (typeof window.comlyToast === 'function' && window.comlyToast !== toast) {
      window.comlyToast(message);
      return;
    }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2000);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    try { ta.select(); } catch (e) { /* ignore */ }
    try { if (document.execCommand) document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function copyText(text, message) {
    if (!text) return;
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(message);
      }, function () {
        fallbackCopy(text);
        toast(message);
      });
    } else {
      fallbackCopy(text);
      toast(message);
    }
  }

  function setError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || '';
    errorBox.classList.toggle('show', !!message);
  }

  function reveal(node, show) {
    if (!node) return;
    node.classList.toggle('is-hidden', !show);
    if (show) node.removeAttribute('hidden');
    else node.setAttribute('hidden', 'hidden');
  }

  function setLoading(on) {
    if (!generateBtn) return;
    generateBtn.disabled = on;
    generateBtn.classList.toggle('is-loading', on);
    generateBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    var label = generateBtn.querySelector('.btn-label');
    if (label) label.textContent = t(on ? 'generating' : 'generate');
  }

  function normalize(raw) {
    var value = String(raw || '').trim();
    if (!value) return { error: t('emptyUrl') };
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && /^[^\s]+\.[^\s]{2,}/.test(value)) {
      value = 'https://' + value;
    }
    var parsed;
    try { parsed = new URL(value); } catch (e) { return { error: t('invalidUrl') }; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: t('invalidUrl') };
    if (!parsed.hostname) return { error: t('invalidUrl') };
    return { url: parsed };
  }

  var UTM_FIELDS = [
    { key: 'utm_source', node: sourceInput },
    { key: 'utm_medium', node: mediumInput },
    { key: 'utm_campaign', node: campaignInput },
    { key: 'utm_term', node: termInput },
    { key: 'utm_content', node: contentInput }
  ];

  /* Keep every non-UTM param (and the hash); replace the UTM set wholesale. */
  function taggedUrl(url) {
    var params = url.searchParams;
    var keys = [];
    params.forEach(function (value, key) { keys.push(key); });
    keys.forEach(function (key) {
      if (/^utm_/i.test(key)) params.delete(key);
    });
    UTM_FIELDS.forEach(function (field) {
      if (!field.node) return;
      var value = String(field.node.value || '').trim();
      if (value) params.append(field.key, value);
    });
    url.search = params.toString();
    return url.toString();
  }

  function buildMeta() {
    var applied = [];
    UTM_FIELDS.forEach(function (field) {
      var value = field.node ? String(field.node.value || '').trim() : '';
      if (value) applied.push(field.key.replace(/^utm_/, '') + '=' + value);
    });
    return applied.length ? applied.join('  ·  ') : t('noParams');
  }

  function render(fullUrl, short, meta) {
    if (fullUrlNode) {
      fullUrlNode.textContent = fullUrl;
      if (fullUrlNode.tagName === 'A') fullUrlNode.href = fullUrl;
    }
    if (short && short.shortUrl) {
      if (shortUrlNode) {
        shortUrlNode.textContent = short.shortUrl;
        if (shortUrlNode.tagName === 'A') shortUrlNode.href = short.shortUrl;
      }
      if (codeNode) codeNode.textContent = short.code || '—';
      reveal(shortUrlNode, true);
      reveal(copyShortBtn, true);
    } else {
      if (shortUrlNode) shortUrlNode.textContent = '';
      if (codeNode) codeNode.textContent = '—';
      reveal(shortUrlNode, false);
      reveal(copyShortBtn, false);
    }
    if (openBtn) {
      openBtn.href = (short && short.shortUrl) ? short.shortUrl : fullUrl;
      openBtn.setAttribute('aria-label', t('openLabel'));
    }
    if (metaNode) {
      metaNode.textContent = meta + (short && short.code ? '  ·  ' + t('codeLabel') + ': ' + short.code : '');
    }
    reveal(resultBox, true);
  }

  var pending = false;

  function generate() {
    if (pending) return;
    setError('');
    var parsed = normalize(urlInput ? urlInput.value : '');
    if (parsed.error) {
      setError(parsed.error);
      if (urlInput) urlInput.focus();
      return;
    }
    var fullUrl = taggedUrl(parsed.url);
    var meta = buildMeta();

    pending = true;
    setLoading(true);

    var maybeShorten = function () {
      if (!shortenCheck || !shortenCheck.checked) return Promise.resolve(null);
      return fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl, expiresIn: 0 })
      }).then(function (res) {
        if (!res.ok) throw new Error('shorten-failed');
        return res.json();
      }).then(function (data) {
        if (!data || !data.shortUrl) throw new Error('shorten-failed');
        return { shortUrl: data.shortUrl, code: data.code || '' };
      });
    };

    maybeShorten().then(function (short) {
      render(fullUrl, short, meta);
      setError('');
    }).catch(function () {
      /* The tagged URL is still useful even when the API is unavailable. */
      render(fullUrl, null, meta);
      setError(t('shortenFailed'));
      toast(t('shortenFailed'));
    }).finally(function () {
      pending = false;
      setLoading(false);
    });
  }

  var PRESETS = {
    google: { source: 'google', medium: 'cpc', campaign: 'search_ads' },
    whatsapp: { source: 'whatsapp', medium: 'social', campaign: 'share' },
    facebook: { source: 'facebook', medium: 'social', campaign: 'share' },
    instagram: { source: 'instagram', medium: 'social', campaign: 'share' },
    x: { source: 'x', medium: 'social', campaign: 'share' },
    email: { source: 'newsletter', medium: 'email', campaign: 'newsletter' },
    tiktok: { source: 'tiktok', medium: 'social', campaign: 'share' }
  };

  function setSelectValue(select, value) {
    if (!select) return;
    select.value = value;
    if (select.value !== value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
      select.value = value;
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-utm-preset]'), function (button) {
    button.addEventListener('click', function () {
      var preset = PRESETS[button.getAttribute('data-utm-preset')];
      if (!preset) return;
      if (sourceInput) sourceInput.value = preset.source;
      setSelectValue(mediumInput, preset.medium);
      if (campaignInput) campaignInput.value = preset.campaign;
      toast(t('presetApplied'));
    });
  });

  if (urlInput) urlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); generate(); }
  });
  if (generateBtn) generateBtn.addEventListener('click', generate);
  if (copyFullBtn) copyFullBtn.addEventListener('click', function () {
    if (fullUrlNode) copyText(fullUrlNode.textContent, t('copiedFull'));
  });
  if (copyShortBtn) copyShortBtn.addEventListener('click', function () {
    if (shortUrlNode) copyText(shortUrlNode.textContent, t('copiedShort'));
  });
})();

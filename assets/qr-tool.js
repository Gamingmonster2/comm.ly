/* Comly Network — interactive QR generator (3.com.ly / #tool). */
(function () {
  'use strict';

  var root = document.getElementById('qrTool');
  var QR = window.ComlyQR;
  if (!root || !QR) return;

  var $ = function (id) { return document.getElementById(id); };
  var input = $('qrInput');
  var shortenFirst = $('qrShortenFirst');
  var sizeSelect = $('qrSize');
  var levelSelect = $('qrLevel');
  var fgInput = $('qrFg');
  var bgInput = $('qrBg');
  var generateBtn = $('qrGenerate');
  var errorBox = $('qrError');
  var preview = $('qrPreview');
  var actions = $('qrActions');
  var resultUrl = $('qrResultUrl');
  var pngBtn = $('qrDownloadPng');
  var svgBtn = $('qrDownloadSvg');
  var copyBtn = $('qrCopy');

  var COPY = {
    ar: {
      placeholder: 'الصق رابطاً أو نصاً…',
      empty: 'أدخل رابطاً أو نصاً أولاً.',
      long: 'النص طويل جداً لأكواد QR (الحد الأقصى 150 حرفاً تقريباً).',
      shortenFailed: 'تعذّر اختصار الرابط. سيتم استخدام رابطك الأصلي.',
      invalidColor: 'اللون غير صالح.',
      ready: 'جاهز — جرّب التنزيل أو النسخ.',
      copied: 'تم نسخ رمز QR ✓',
      copiedLink: 'تم نسخ الرابط ✓',
      encoded: 'الرمز يُشفّر هذا الرابط:',
      png: 'تنزيل PNG', svg: 'تنزيل SVG', copy: 'نسخ الصورة',
      generating: 'جارٍ التوليد…', generate: 'أنشئ رمز QR',
      hint: 'يعمل محلياً في متصفحك — لا تُرسل بياناتك إلى أي خدمة خارجية.'
    },
    en: {
      placeholder: 'Paste a link or text…',
      empty: 'Enter a link or some text first.',
      long: 'That is too long for a QR code (about 150 characters max).',
      shortenFailed: 'Could not shorten the link. Using your original URL instead.',
      invalidColor: 'Invalid colour.',
      ready: 'Ready — download or copy it.',
      copied: 'QR code copied ✓',
      copiedLink: 'Link copied ✓',
      encoded: 'This code encodes:',
      png: 'Download PNG', svg: 'Download SVG', copy: 'Copy image',
      generating: 'Generating…', generate: 'Generate QR code',
      hint: 'Runs locally in your browser — your data is never sent to an external service.'
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

  var state = { payload: '', level: 'M', fg: '#09090b', bg: '#ffffff', px: 512 };
  var pending = false;

  function setError(message) {
    errorBox.textContent = message || '';
    errorBox.classList.toggle('show', !!message);
  }

  function color(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback;
  }

  function options(targetPx) {
    var base = QR.matrix(state.payload, { level: state.level });
    var margin = 4;
    var scale = Math.max(1, Math.round((targetPx || 256) / (base.size + margin * 2)));
    return {
      level: state.level,
      scale: scale,
      quiet: margin,
      foreground: state.fg,
      background: state.bg
    };
  }

  function svgFor(px) {
    return QR.svg(state.payload, options(px));
  }

  function dataUrlFor(px) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgFor(px));
  }

  function normalize(raw) {
    var value = String(raw || '').trim();
    if (!value) return { error: t('empty') };
    if (!/^https?:\/\//i.test(value) && /^[^\s]+\.[^\s]{2,}/.test(value)) value = 'https://' + value;
    return { value: value };
  }

  function generate() {
    if (pending) return;
    setError('');
    var parsed = normalize(input.value);
    if (parsed.error) { setError(parsed.error); input.focus(); return; }

    var payload = parsed.value;
    state.level = levelSelect.value || 'M';
    state.px = Number(sizeSelect.value) || 512;
    state.fg = color(fgInput.value, '#09090b');
    state.bg = color(bgInput.value, '#ffffff');

    pending = true;
    generateBtn.disabled = true;
    generateBtn.classList.add('is-loading');
    var label = generateBtn.querySelector('.btn-label');
    if (label) label.textContent = t('generating');

    var maybeShorten = function () {
      if (!shortenFirst.checked || !/^https?:\/\//i.test(payload)) return Promise.resolve(payload);
      return fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: payload, expiresIn: 0 })
      }).then(function (res) {
        if (!res.ok) throw new Error('shorten-failed');
        return res.json();
      }).then(function (data) {
        return data.shortUrl || payload;
      }).catch(function () {
        toast(t('shortenFailed'));
        return payload;
      });
    };

    maybeShorten().then(function (finalPayload) {
      if (finalPayload !== payload) {
        // Short URLs are much nicer to encode than a long destination.
        resultUrl.setAttribute('data-encoded-original', payload);
      } else {
        resultUrl.removeAttribute('data-encoded-original');
      }
      state.payload = finalPayload;
      preview.innerHTML = svgFor(Math.max(240, state.px));
      preview.classList.add('has-qr');
      resultUrl.textContent = t('encoded') + ' ' + finalPayload;
      actions.classList.remove('is-hidden');
      setError('');
    }).catch(function (err) {
      setError(err && err.message === 'QR_TOO_LONG' ? t('long') : t('empty'));
    }).finally(function () {
      pending = false;
      generateBtn.disabled = false;
      generateBtn.classList.remove('is-loading');
      if (label) label.textContent = t('generate');
    });
  }

  function download(href, name) {
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function pngBlob() {
    return new Promise(function (resolve, reject) {
      if (!window.Image || !document.createElement('canvas').getContext) return reject(new Error('no-canvas'));
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = state.px;
        canvas.height = state.px;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = state.bg;
        ctx.fillRect(0, 0, state.px, state.px);
        ctx.drawImage(img, 0, 0, state.px, state.px);
        if (canvas.toBlob) canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('no-blob')); }, 'image/png');
        else reject(new Error('no-blob'));
      };
      img.onerror = function () { reject(new Error('image-failed')); };
      img.src = dataUrlFor(state.px);
    });
  }

  function saveSvg() {
    if (!state.payload) return;
    var blob = new Blob([svgFor(state.px)], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    download(url, 'commly-qr.svg');
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function savePng() {
    if (!state.payload) return;
    pngBlob().then(function (blob) {
      var url = URL.createObjectURL(blob);
      download(url, 'commly-qr.png');
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(saveSvg);
  }

  function copy() {
    if (!state.payload) return;
    pngBlob().then(function (blob) {
      if (navigator.clipboard && window.ClipboardItem) {
        return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
          toast(t('copied'));
        }, function () { return copyLink(); });
      }
      return copyLink();
    }).catch(copyLink);
  }

  function copyLink() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.payload).then(function () { toast(t('copiedLink')); });
    }
  }

  if (input) input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); generate(); }
  });
  if (generateBtn) generateBtn.addEventListener('click', generate);
  if (pngBtn) pngBtn.addEventListener('click', savePng);
  if (svgBtn) svgBtn.addEventListener('click', saveSvg);
  if (copyBtn) copyBtn.addEventListener('click', copy);
})();

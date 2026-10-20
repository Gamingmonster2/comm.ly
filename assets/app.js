/* Comly Network — landing page interactions (prototype) */
(function () {
  'use strict';

  var api = {
    shorten: function (payload) {
      return fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'request-failed');
          return data;
        });
      });
    }
  };

  var form = document.getElementById('shortenForm');
  var urlInput = document.getElementById('urlInput');
  var slugInput = document.getElementById('slugInput');
  var expirySelect = document.getElementById('expirySelect');
  var submitBtn = document.getElementById('submitBtn');
  var errorBox = document.getElementById('errorMsg');
  var resultCard = document.getElementById('resultCard');
  var shortLink = document.getElementById('shortLink');
  var openBtn = document.getElementById('openBtn');
  var copyBtn = document.getElementById('copyBtn');
  var qrImg = document.getElementById('qrImg');
  var resultMeta = document.getElementById('resultMeta');
  var lastResult = null;
  var pending = false;

  var COPY = {
    ar: {
      invalid: 'أدخل رابطاً صالحاً يبدأ بـ http:// أو https://',
      slug: 'الكود المخصص يقبل الأحرف الإنجليزية والأرقام والشرطة فقط (3–24 حرفاً)',
      failed: 'تعذّر الاختصار الآن. تأكد من الرابط وحاول مجدداً.',
      copied: 'تم نسخ الرابط ✓',
      expires: 'ينتهي',
      never: 'بلا انتهاء',
      network: 'يعمل أيضاً على النطاقات',
      copiedSite: 'تم نسخ رابط الموقع ✓'
    },
    en: {
      invalid: 'Enter a valid link starting with http:// or https://',
      slug: 'Custom code accepts letters, numbers and dashes only (3–24 chars)',
      failed: 'Could not shorten right now. Check the link and try again.',
      copied: 'Link copied ✓',
      expires: 'Expires',
      never: 'Never expires',
      network: 'Also resolves on',
      copiedSite: 'Site link copied ✓'
    }
  };

  function t() { return COPY[document.documentElement.lang === 'en' ? 'en' : 'ar']; }
  function money() { return 'http://' + location.host + '/'; }

  function setError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg || '';
    errorBox.classList.toggle('show', !!msg);
  }

  function setLoading(loading) {
    pending = loading;
    submitBtn.classList.toggle('is-loading', loading);
    submitBtn.disabled = loading;
  }

  function formatDate(iso) {
    if (!iso) return t().never;
    try {
      return new Date(iso).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-LY', {
        dateStyle: 'medium', timeStyle: 'short'
      });
    } catch (e) { return iso; }
  }

  function renderMeta() {
    if (!lastResult || !resultMeta) return;
    var parts = [t().expires + ': ' + formatDate(lastResult.expiresAt)];
    if (lastResult.network && lastResult.network.length) {
      parts.push(t().network + ': ' + lastResult.network.join(' · '));
    }
    resultMeta.textContent = parts.join('  ·  ');
  }

  function copyText(text, message) {
    var done = function () { window.comlyToast(message); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text); done();
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

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (pending) return;
      setError('');

      var raw = (urlInput.value || '').trim();
      var valid = false;
      try {
        var parsed = new URL(raw);
        valid = (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname;
      } catch (e) { valid = false; }
      if (!valid) { setError(t().invalid); urlInput.focus(); return; }

      var slug = (slugInput.value || '').trim();
      if (slug && !/^[A-Za-z0-9_-]{3,24}$/.test(slug)) { setError(t().slug); slugInput.focus(); return; }

      setLoading(true);
      api.shorten({ url: raw, slug: slug || undefined, expiresIn: Number(expirySelect.value) })
        .then(function (data) {
          lastResult = data;
          shortLink.textContent = data.shortUrl;
          shortLink.href = data.shortUrl;
          openBtn.href = data.shortUrl;
          if (qrImg) qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=' + encodeURIComponent(data.shortUrl);
          renderMeta();
          resultCard.classList.remove('is-hidden');
        })
        .catch(function () { setError(t().failed); })
        .finally(function () { setLoading(false); });
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!lastResult) return;
      copyText(lastResult.shortUrl, t().copied);
    });
  }

  window.addEventListener('comly:lang', function () { renderMeta(); });

  /* Animated counters */
  function compact(n) {
    if (n >= 1e6) {
      var m = n / 1e6;
      return (m >= 10 ? Math.round(m) : (+m.toFixed(1))) + 'M';
    }
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }

  function animateCounter(el) {
    var target = Number(el.getAttribute('data-count')) || 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = compact(target); return; }
    var start = performance.now();
    var duration = 1400;
    function frame(now) {
      var p = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = compact(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var co = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            co.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { co.observe(el); });
    } else {
      counters.forEach(animateCounter);
    }
  }
})();

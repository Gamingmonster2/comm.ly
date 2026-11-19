/* Comly Network — bulk shortener (n6). */
(function () {
  'use strict';

  var root = document.getElementById('bulkTool');
  if (!root) return;

  var $ = function (id) { return document.getElementById(id); };
  var input = $('bulkInput');
  var expiry = $('bulkExpiry');
  var shortenBtn = $('bulkShorten');
  var errorBox = $('bulkError');
  var progress = $('bulkProgress');
  var results = $('bulkResults');
  var totalNode = $('bulkTotal');
  var doneNode = $('bulkDone');
  var failedNode = $('bulkFailed');
  var rowsBody = $('bulkRows');
  var copyAllBtn = $('bulkCopyAll');
  var csvBtn = $('bulkDownloadCsv');
  var resetBtn = $('bulkReset');

  var MAX_URLS = 100;
  var CONCURRENCY = 3;
  var FALLBACK_STATUSES = [404, 405, 501];

  var COPY = {
    ar: {
      linesLabel: 'أسطر', validLabel: 'صالح', invalidLabel: 'غير صالح',
      duplicateLabel: 'مكرر', cappedLabel: 'تجاوز الحد',
      noUrls: 'لم يتم العثور على روابط صالحة (الحد الأقصى 100 رابط).',
      starting: 'جارٍ التحضير…',
      fallback: 'الاختصار الجماعي غير متاح — جارٍ المعالجة الفردية…',
      working: 'جارٍ الاختصار',
      finished: 'اكتمل',
      failed: 'تعذّر الاختصار.',
      allFailed: 'لم يتم إنشاء أي رابط مختصر.',
      rateLimited: 'تم تجاوز حد الطلبات — تمت إعادة المحاولة.',
      ok: 'نجح', failedPill: 'فشل',
      copiedAll: 'تم نسخ الروابط ✓', nothingToCopy: 'لا توجد روابط للنسخ.',
      downloaded: 'تم تنزيل ملف CSV ✓',
      btnWorking: 'جارٍ المعالجة…', btnIdle: 'اختصار الروابط'
    },
    en: {
      linesLabel: 'lines', validLabel: 'valid', invalidLabel: 'invalid',
      duplicateLabel: 'duplicates', cappedLabel: 'over limit',
      noUrls: 'No valid URLs found (maximum 100 URLs).',
      starting: 'Preparing…',
      fallback: 'Bulk endpoint unavailable — shortening individually…',
      working: 'Shortening',
      finished: 'Finished',
      failed: 'Could not shorten right now.',
      allFailed: 'No short links were created.',
      rateLimited: 'Rate limited — retried automatically.',
      ok: 'ok', failedPill: 'failed',
      copiedAll: 'Links copied ✓', nothingToCopy: 'No links to copy.',
      downloaded: 'CSV downloaded ✓',
      btnWorking: 'Working…', btnIdle: 'Shorten URLs'
    }
  };

  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'ar'; }
  function t(key) { return COPY[lang()][key] || COPY.ar[key] || ''; }

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

  function setProgress(text) { if (progress) progress.textContent = text || ''; }

  function reveal(node, show) {
    if (!node) return;
    node.classList.toggle('is-hidden', !show);
    if (show) node.removeAttribute('hidden');
    else node.setAttribute('hidden', 'hidden');
  }

  function setCounts(total, done, failed) {
    if (totalNode) totalNode.textContent = String(total || 0);
    if (doneNode) doneNode.textContent = String(done || 0);
    if (failedNode) failedNode.textContent = String(failed || 0);
  }

  function setLoading(on) {
    if (!shortenBtn) return;
    shortenBtn.disabled = on;
    shortenBtn.classList.toggle('is-loading', on);
    shortenBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    var label = shortenBtn.querySelector('.btn-label');
    if (label) label.textContent = t(on ? 'btnWorking' : 'btnIdle');
  }

  /* Minimal CSV line parser: honours quoted cells and doubled quotes. */
  function parseCsvLine(line) {
    var cells = [];
    var cell = '';
    var quoted = false;
    for (var i = 0; i < line.length; i += 1) {
      var ch = line.charAt(i);
      if (ch === '"') {
        if (quoted && line.charAt(i + 1) === '"') { cell += '"'; i += 1; }
        else quoted = !quoted;
      } else if (!quoted && (ch === ',' || ch === ';' || ch === '\t')) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function looksUrl(value) {
    return /^https?:\/\//i.test(value) || /^[^\s]+\.[^\s]{2,}/.test(value);
  }

  function normalizeUrl(raw) {
    var value = String(raw || '').trim();
    if (!value) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && /^[^\s]+\.[^\s]{2,}/.test(value)) {
      value = 'https://' + value;
    }
    try {
      var parsed = new URL(value);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
        return parsed.toString();
      }
    } catch (e) { /* not a URL */ }
    return null;
  }

  function parseInput(text) {
    var lines = String(text || '').split(/\r?\n/);
    var nonEmpty = [];
    lines.forEach(function (line) { if (line.trim()) nonEmpty.push(line); });

    /* A header row is one with no URL-looking cell but a url/link column name. */
    var urlColumn = -1;
    var start = 0;
    if (nonEmpty.length) {
      var head = parseCsvLine(nonEmpty[0]);
      var hasUrlCell = false;
      head.forEach(function (cell) { if (looksUrl(cell)) hasUrlCell = true; });
      if (!hasUrlCell) {
        for (var c = 0; c < head.length; c += 1) {
          if (/(url|link|رابط)/i.test(head[c])) { urlColumn = c; break; }
        }
        if (urlColumn >= 0) start = 1;
      }
    }

    var urls = [];
    var seen = Object.create(null);
    var invalid = 0;
    var duplicates = 0;
    var capped = 0;

    for (var i = start; i < nonEmpty.length; i += 1) {
      var cells = parseCsvLine(nonEmpty[i]);
      var pick = '';
      if (urlColumn >= 0) {
        pick = cells[urlColumn] || '';
      } else {
        for (var j = 0; j < cells.length; j += 1) {
          if (looksUrl(cells[j])) { pick = cells[j]; break; }
        }
        if (!pick && cells.length === 1) pick = cells[0];
      }
      var normalized = normalizeUrl(pick);
      if (!normalized) { invalid += 1; continue; }
      if (seen[normalized]) { duplicates += 1; continue; }
      seen[normalized] = true;
      if (urls.length >= MAX_URLS) { capped += 1; continue; }
      urls.push(normalized);
    }

    return { urls: urls, lines: nonEmpty.length, invalid: invalid, duplicates: duplicates, capped: capped };
  }

  function parseSummary(parsed) {
    var parts = [t('linesLabel') + ': ' + parsed.lines, t('validLabel') + ': ' + parsed.urls.length];
    if (parsed.invalid) parts.push(t('invalidLabel') + ': ' + parsed.invalid);
    if (parsed.duplicates) parts.push(t('duplicateLabel') + ': ' + parsed.duplicates);
    if (parsed.capped) parts.push(t('cappedLabel') + ': ' + parsed.capped);
    return parts.join('  ·  ');
  }

  function friendlyError(value) {
    var text = String(value || '');
    if (!text) return t('failed');
    if (/rate.?limit|429/i.test(text)) return t('rateLimited');
    return text;
  }

  function post(path, payload) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error('http-' + res.status);
        err.status = res.status;
        if (path.indexOf('/bulk') >= 0) err.bulkStatus = res.status;
        throw err;
      }
      return res.json();
    });
  }

  function mapBulkResults(urls, results) {
    return urls.map(function (url, i) {
      var item = null;
      for (var k = 0; k < results.length; k += 1) {
        if (Number(results[k].index) === i) { item = results[k]; break; }
      }
      if (!item && results[i]) item = results[i];
      var ok = !!(item && item.ok && item.shortUrl);
      return {
        index: i,
        original: (item && item.url) || url,
        shortUrl: ok ? item.shortUrl : '',
        code: ok ? (item.code || '') : '',
        ok: ok,
        error: ok ? '' : friendlyError(item && item.error)
      };
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function retryShorten(url, expiresIn, attempt) {
    var n = attempt || 0;
    return post('/api/shorten', { url: url, expiresIn: expiresIn }).catch(function (err) {
      if (err && err.status === 429 && n < 3) {
        return delay(150 * (n + 1)).then(function () {
          return retryShorten(url, expiresIn, n + 1);
        });
      }
      throw err;
    });
  }

  /* Fixed pool of 3 workers, with automatic retry on 429. */
  function sequential(urls, expiresIn) {
    var out = new Array(urls.length);
    var next = 0;
    var done = 0;
    var failed = 0;

    function worker() {
      function step() {
        if (next >= urls.length) return Promise.resolve();
        var i = next;
        next += 1;
        return retryShorten(urls[i], expiresIn).then(function (data) {
          var ok = !!(data && data.shortUrl);
          out[i] = {
            index: i, original: urls[i],
            shortUrl: ok ? data.shortUrl : '',
            code: ok ? (data.code || '') : '',
            ok: ok, error: ok ? '' : t('failed')
          };
          if (ok) done += 1; else failed += 1;
        }).catch(function (err) {
          out[i] = {
            index: i, original: urls[i], shortUrl: '', code: '', ok: false,
            error: (err && err.status === 429) ? t('rateLimited') : t('failed')
          };
          failed += 1;
        }).then(function () {
          setProgress(t('working') + ' ' + (done + failed) + '/' + urls.length);
          setCounts(urls.length, done, failed);
          return step();
        });
      }
      return step();
    }

    var workers = [];
    for (var w = 0; w < Math.min(CONCURRENCY, urls.length); w += 1) workers.push(worker());
    return Promise.all(workers).then(function () { return out; });
  }

  function bulkShorten(urls, expiresIn) {
    return post('/api/shorten/bulk', { urls: urls, expiresIn: expiresIn }).then(function (data) {
      if (!data || !Array.isArray(data.results)) throw new Error('bad-bulk-response');
      return mapBulkResults(urls, data.results);
    }).catch(function (err) {
      /* 404/405/501 mean "no bulk route"; any other failure is handled the
         same way so one bad response never blocks the whole batch. */
      if (err && FALLBACK_STATUSES.indexOf(err.bulkStatus) >= 0) toast(t('fallback'));
      setProgress(t('fallback'));
      return sequential(urls, expiresIn);
    });
  }

  function textCell(text, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text == null ? '' : String(text);
    return td;
  }

  function linkCell(text, href, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    if (href && /^https?:\/\//i.test(href)) {
      var a = document.createElement('a');
      a.href = href;
      a.textContent = text || href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      td.appendChild(a);
    } else {
      td.textContent = text || '';
    }
    return td;
  }

  function statusCell(ok) {
    var td = document.createElement('td');
    var pill = document.createElement('span');
    pill.className = 'status-pill ' + (ok ? 'live' : 'failed');
    pill.textContent = ok ? t('ok') : t('failedPill');
    td.appendChild(pill);
    return td;
  }

  function renderRows(data) {
    if (!rowsBody) return;
    while (rowsBody.firstChild) rowsBody.removeChild(rowsBody.firstChild);
    data.forEach(function (row) {
      var tr = document.createElement('tr');
      var original = textCell(row.original, 'bulk-original');
      original.title = row.original;
      tr.appendChild(original);
      tr.appendChild(linkCell(row.shortUrl, row.shortUrl, 'bulk-short'));
      tr.appendChild(textCell(row.code, 'bulk-code'));
      tr.appendChild(statusCell(!!row.ok));
      tr.appendChild(textCell(row.error, 'bulk-error-text'));
      rowsBody.appendChild(tr);
    });
  }

  var pending = false;
  var rows = [];

  function shorten() {
    if (pending) return;
    if (!input) return;
    setError('');

    var parsed = parseInput(input.value);
    rows = [];
    setCounts(parsed.urls.length, 0, 0);

    if (!parsed.urls.length) {
      setError(t('noUrls') + '  ·  ' + parseSummary(parsed));
      setProgress('');
      return;
    }
    if (parsed.invalid || parsed.duplicates || parsed.capped) setError(parseSummary(parsed));

    pending = true;
    setLoading(true);
    renderRows([]);
    reveal(results, true);
    setProgress(t('starting') + ' 0/' + parsed.urls.length);

    var expiresIn = expiry ? (Number(expiry.value) || 0) : 0;

    bulkShorten(parsed.urls, expiresIn).then(function (data) {
      rows = data;
      renderRows(rows);
      var okCount = 0;
      var failCount = 0;
      rows.forEach(function (row) { if (row.ok) okCount += 1; else failCount += 1; });
      setCounts(rows.length, okCount, failCount);
      setProgress(t('finished') + '  ·  ' + parseSummary(parsed));
      if (!okCount) setError(t('allFailed'));
      else if (!(parsed.invalid || parsed.duplicates || parsed.capped)) setError('');
      toast(t('finished'));
    }).catch(function () {
      setError(t('failed'));
      setProgress('');
    }).finally(function () {
      pending = false;
      setLoading(false);
    });
  }

  function copyAll() {
    var list = [];
    rows.forEach(function (row) { if (row.ok && row.shortUrl) list.push(row.shortUrl); });
    if (!list.length) { toast(t('nothingToCopy')); return; }
    copyText(list.join('\n'), t('copiedAll'));
  }

  function csvField(value) {
    var text = value == null ? '' : String(value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function downloadCsv() {
    if (!rows.length) { toast(t('nothingToCopy')); return; }
    var lines = ['original,shortUrl,code,status,error'];
    rows.forEach(function (row) {
      lines.push([
        row.original, row.shortUrl, row.code,
        row.ok ? 'ok' : 'failed', row.error
      ].map(csvField).join(','));
    });
    var csv = lines.join('\r\n');
    var href;
    if (window.URL && window.URL.createObjectURL) {
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      href = window.URL.createObjectURL(blob);
      if (window.URL.revokeObjectURL) {
        setTimeout(function () { window.URL.revokeObjectURL(href); }, 1000);
      }
    } else {
      href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    }
    var a = document.createElement('a');
    a.href = href;
    a.download = 'comly-bulk-links.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(t('downloaded'));
  }

  function reset() {
    rows = [];
    if (input) input.value = '';
    if (expiry) expiry.selectedIndex = 0;
    setError('');
    setProgress('');
    setCounts(0, 0, 0);
    renderRows([]);
    reveal(results, false);
    if (shortenBtn) shortenBtn.disabled = false;
  }

  if (shortenBtn) shortenBtn.addEventListener('click', shorten);
  if (copyAllBtn) copyAllBtn.addEventListener('click', copyAll);
  if (csvBtn) csvBtn.addEventListener('click', downloadCsv);
  if (resetBtn) resetBtn.addEventListener('click', reset);
})();

/**
 * Self-contained checks for the UTM builder (n4) and bulk shortener (n6).
 * Fixtures are built inline — no generated build output is required.
 * Run: node tools/check-utm-bulk.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const utmSource = await readFile(path.join(root, 'assets', 'utm-tool.js'), 'utf8');
const bulkSource = await readFile(path.join(root, 'assets', 'bulk-tool.js'), 'utf8');

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  ✔ ${name}`); }
  else { failed += 1; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`); }
}
const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

function makeDom(body, evalSource) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>
    <div id="toast" class="toast"></div>${body}</body></html>`;
  const dom = new JSDOM(html, {
    url: 'https://app.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  dom.window.eval(evalSource);
  return dom;
}

const UTM_MARKUP = `
<section id="utmTool">
  <input id="utmUrl">
  <input id="utmSource">
  <select id="utmMedium"><option value="">—</option><option value="cpc">cpc</option><option value="social">social</option><option value="email">email</option></select>
  <input id="utmCampaign">
  <input id="utmTerm">
  <input id="utmContent">
  <label><input id="utmShorten" type="checkbox"></label>
  <button id="utmGenerate" type="button"><span class="btn-label">Generate URL</span><span class="spinner"></span></button>
  <button type="button" data-utm-preset="google">Google</button>
  <button type="button" data-utm-preset="whatsapp">WhatsApp</button>
  <button type="button" data-utm-preset="facebook">Facebook</button>
  <button type="button" data-utm-preset="instagram">Instagram</button>
  <button type="button" data-utm-preset="x">X</button>
  <button type="button" data-utm-preset="email">Email</button>
  <button type="button" data-utm-preset="tiktok">TikTok</button>
  <p id="utmError" class="error-msg"></p>
  <div id="utmResult" class="is-hidden">
    <span id="utmFullUrl"></span>
    <span id="utmShortUrl" class="is-hidden"></span>
    <button type="button" id="utmCopyFull">Copy full</button>
    <button type="button" id="utmCopyShort" class="is-hidden">Copy short</button>
    <a id="utmOpen"></a>
    <span id="utmCode"></span>
    <p id="utmMeta"></p>
  </div>
</section>`;

const BULK_MARKUP = `
<section id="bulkTool">
  <textarea id="bulkInput"></textarea>
  <select id="bulkExpiry"><option value="0">Never</option><option value="24">24 hours</option></select>
  <button id="bulkShorten" type="button"><span class="btn-label">Shorten URLs</span><span class="spinner"></span></button>
  <p id="bulkError" class="error-msg"></p>
  <p id="bulkProgress"></p>
  <div id="bulkResults" class="is-hidden">
    <span id="bulkTotal">0</span><span id="bulkDone">0</span><span id="bulkFailed">0</span>
    <table><thead><tr><th>Original</th><th>Short</th><th>Code</th><th>Status</th><th>Error</th></tr></thead>
      <tbody id="bulkRows"></tbody></table>
    <button type="button" id="bulkCopyAll">Copy all</button>
    <button type="button" id="bulkDownloadCsv">Download CSV</button>
    <button type="button" id="bulkReset">Reset</button>
  </div>
</section>`;

/* ------------------------------------------------------------------ UTM */
console.log('\nUTM tool (n4)');
{
  const dom = makeDom(UTM_MARKUP, utmSource);
  const win = dom.window;
  const $ = (id) => win.document.getElementById(id);
  let clipboardValue = '';
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => { clipboardValue = text; } }
  });

  const calls = [];
  win.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      json: async () => ({ shortUrl: 'https://s.test/abc123', code: 'abc123' })
    };
  };

  $('utmUrl').value = 'example.com/menu?keep=yes&utm_source=old&utm_campaign=old#section';
  $('utmSource').value = 'google';
  $('utmMedium').value = 'cpc';
  $('utmCampaign').value = 'summer sale';
  $('utmTerm').value = 'shoes';
  $('utmContent').value = 'banner a/b';
  $('utmShorten').checked = true;
  $('utmGenerate').click();
  await tick();

  const full = $('utmFullUrl').textContent;
  const parsed = new win.URL(full);
  let utmCount = 0;
  parsed.searchParams.forEach((value, key) => { if (/^utm_/i.test(key)) utmCount += 1; });

  check('URL normalized with https://', full.startsWith('https://example.com/'));
  check('existing non-UTM query param preserved', parsed.searchParams.get('keep') === 'yes');
  check('existing utm_source replaced', parsed.searchParams.get('utm_source') === 'google');
  check('stale utm_campaign removed', parsed.searchParams.getAll('utm_campaign').length === 1 && parsed.searchParams.get('utm_campaign') === 'summer sale');
  check('only the 5 non-empty UTM fields present', utmCount === 5, `got ${utmCount}`);
  check('values encoded via URLSearchParams', parsed.searchParams.get('utm_campaign') === 'summer sale' && parsed.searchParams.get('utm_content') === 'banner a/b');
  check('hash fragment preserved', parsed.hash === '#section');
  check('shorten called with tagged URL and expiresIn 0', calls.length === 1 && calls[0].url === '/api/shorten' && calls[0].body.url === full && calls[0].body.expiresIn === 0);
  check('short URL and code rendered', $('utmShortUrl').textContent === 'https://s.test/abc123' && $('utmCode').textContent === 'abc123');
  check('#utmOpen.href points at short URL', $('utmOpen').getAttribute('href') === 'https://s.test/abc123');
  check('result container revealed', !$('utmResult').classList.contains('is-hidden') && !$('utmResult').hasAttribute('hidden'));
  check('loading state cleared', $('utmGenerate').disabled === false && !$('utmGenerate').classList.contains('is-loading'));

  $('utmCopyFull').click();
  await tick(5);
  check('copy full uses clipboard', clipboardValue === full);
  $('utmCopyShort').click();
  await tick(5);
  check('copy short uses clipboard', clipboardValue === 'https://s.test/abc123');

  win.document.querySelector('[data-utm-preset="facebook"]').click();
  check('preset sets source / medium / campaign', $('utmSource').value === 'facebook' && $('utmMedium').value === 'social' && $('utmCampaign').value === 'share');
  win.document.querySelector('[data-utm-preset="x"]').click();
  check('x preset uses source x', $('utmSource').value === 'x' && $('utmMedium').value === 'social');

  $('utmUrl').value = 'https://example.org/enter-test';
  $('utmUrl').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await tick();
  check('Enter in URL input generates', $('utmFullUrl').textContent.includes('example.org/enter-test'));

  /* Shorten failure must not discard the tagged URL. */
  win.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  $('utmShorten').checked = true;
  $('utmUrl').value = 'https://example.org/fail';
  $('utmGenerate').click();
  await tick();
  check('shorten failure keeps full tagged URL', $('utmFullUrl').textContent.includes('example.org/fail'));
  check('shorten failure shows an error', $('utmError').classList.contains('show') && $('utmError').textContent.length > 0);
  check('shorten failure hides short URL section', $('utmShortUrl').classList.contains('is-hidden'));
  check('open link falls back to full URL', $('utmOpen').getAttribute('href') === $('utmFullUrl').textContent);

  $('utmUrl').value = 'javascript:alert(1)';
  $('utmGenerate').click();
  await tick(5);
  check('non-http scheme rejected', $('utmError').classList.contains('show'));
  dom.window.close();
}

/* Presets must work even if the markup's <select> lacks the medium option. */
{
  const markup = UTM_MARKUP.replace('<option value="social">social</option>', '');
  const dom = makeDom(markup, utmSource);
  dom.window.document.querySelector('[data-utm-preset="whatsapp"]').click();
  check('preset adds a missing medium option', dom.window.document.getElementById('utmMedium').value === 'social');
  dom.window.close();
}

/* ----------------------------------------------------------------- Bulk */
console.log('\nBulk tool (n6) — bulk endpoint');
{
  const dom = makeDom(BULK_MARKUP, bulkSource);
  const win = dom.window;
  const $ = (id) => win.document.getElementById(id);
  let clipboardValue = '';
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => { clipboardValue = text; } }
  });

  const bulkCalls = [];
  win.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    bulkCalls.push({ url, body });
    if (url === '/api/shorten/bulk') {
      return {
        ok: true,
        json: async () => ({
          created: 2,
          failed: 1,
          results: [
            { index: 0, url: body.urls[0], ok: true, shortUrl: 'https://s.test/a1', code: 'a1' },
            { index: 1, url: body.urls[1], ok: true, shortUrl: 'https://s.test/b2', code: 'b2' },
            { index: 2, url: body.urls[2], ok: false, error: 'invalid_url, retry' }
          ]
        })
      };
    }
    throw new Error('unexpected /api/shorten call');
  };

  $('bulkInput').value = [
    'url,name',
    '"https://example.com/one?a=1,2",First',
    'example.com/two,Second',
    'https://example.com/three,Third',
    'not a url,Bad',
    '"https://example.com/one?a=1,2",Duplicate'
  ].join('\n');
  $('bulkExpiry').value = '0';
  $('bulkShorten').click();
  await tick(60);

  check('bulk endpoint called once', bulkCalls.length === 1 && bulkCalls[0].url === '/api/shorten/bulk');
  check('bulk payload carries unique URLs and expiresIn', bulkCalls[0].body.expiresIn === 0 && bulkCalls[0].body.urls.length === 3, JSON.stringify(bulkCalls[0].body));
  check('host-like cell normalized', bulkCalls[0].body.urls[1] === 'https://example.com/two');
  check('quoted CSV cell with comma kept intact', bulkCalls[0].body.urls[0] === 'https://example.com/one?a=1,2');
  check('rows created for every submitted URL', $('bulkRows').children.length === 3);

  const row0 = $('bulkRows').children[0];
  const row2 = $('bulkRows').children[2];
  check('original URL rendered as text (not HTML)', row0.cells[0].textContent === 'https://example.com/one?a=1,2' && !row0.cells[0].querySelector('a'));
  check('short URL rendered as link', row0.cells[1].querySelector('a')?.getAttribute('href') === 'https://s.test/a1');
  check('code cell populated', row0.cells[2].textContent === 'a1');
  check('status pills reflect ok/failed', row0.cells[3].textContent === 'ok' && row2.cells[3].textContent === 'failed');
  check('API error surfaced as text', row2.cells[4].textContent === 'invalid_url, retry');
  check('summary counts updated', $('bulkTotal').textContent === '3' && $('bulkDone').textContent === '2' && $('bulkFailed').textContent === '1');
  check('invalid + duplicate line counts reported', /invalid:\s*1/.test($('bulkError').textContent) && /duplicates:\s*1/.test($('bulkError').textContent), $('bulkError').textContent);
  check('results revealed and button re-enabled', !$('bulkResults').classList.contains('is-hidden') && $('bulkShorten').disabled === false);

  $('bulkCopyAll').click();
  await tick(5);
  check('copy all copies only successful short URLs', clipboardValue === 'https://s.test/a1\nhttps://s.test/b2', JSON.stringify(clipboardValue));

  let csvParts = null;
  const RealBlob = win.Blob;
  win.Blob = function (parts, options) { csvParts = parts; return new RealBlob(parts, options); };
  win.URL.createObjectURL = () => 'blob:test';
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function () {};
  $('bulkDownloadCsv').click();
  const csv = csvParts.join('');
  const csvLines = csv.split('\r\n');
  check('CSV header exact', csvLines[0] === 'original,shortUrl,code,status,error', csvLines[0]);
  check('CSV has header + one line per row', csvLines.length === 4);
  check('CSV quotes a field containing a comma', csv.includes('"https://example.com/one?a=1,2"'));
  check('CSV quotes an error containing a comma', csv.includes('"invalid_url, retry"'));

  $('bulkReset').click();
  check('reset clears input, rows, counts and result panel', $('bulkInput').value === '' && $('bulkRows').children.length === 0 && $('bulkTotal').textContent === '0' && $('bulkResults').classList.contains('is-hidden'));
  dom.window.close();
}

/* ------------------------------------------- Bulk fallback + 429 + cap */
console.log('\nBulk tool (n6) — fallback, 429 retry, 100 cap');
{
  const dom = makeDom(BULK_MARKUP, bulkSource);
  const win = dom.window;
  const $ = (id) => win.document.getElementById(id);
  const attempts = Object.create(null);
  const singleCalls = [];

  win.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url === '/api/shorten/bulk') return { ok: false, status: 501, json: async () => ({}) };
    singleCalls.push(body);
    attempts[body.url] = (attempts[body.url] || 0) + 1;
    if (attempts[body.url] === 1) return { ok: false, status: 429, json: async () => ({}) };
    const code = 'k' + singleCalls.length;
    return { ok: true, json: async () => ({ shortUrl: 'https://s.test/' + code, code }) };
  };

  $('bulkInput').value = [
    'https://one.test/', 'https://two.test/', 'https://three.test/', 'https://four.test/'
  ].join('\n');
  $('bulkShorten').click();
  await tick(900);

  const uniqueFallbackUrls = new Set(singleCalls.map((call) => call.url));
  check('fallback calls /api/shorten for every URL', uniqueFallbackUrls.size === 4, `calls=${singleCalls.length}`);
  check('429 responses retried', Object.keys(attempts).length === 4 && Object.keys(attempts).every((key) => attempts[key] >= 2));
  check('fallback renders 4 successful rows', $('bulkRows').children.length === 4 && $('bulkDone').textContent === '4' && $('bulkFailed').textContent === '0');
  check('fallback sets progress to finished', /Finished/.test($('bulkProgress').textContent), $('bulkProgress').textContent);
  dom.window.close();
}

{
  const dom = makeDom(BULK_MARKUP, bulkSource);
  const win = dom.window;
  const $ = (id) => win.document.getElementById(id);
  let submitted = [];
  win.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    submitted = body.urls;
    return { ok: true, json: async () => ({ created: submitted.length, failed: 0, results: submitted.map((u, i) => ({ index: i, url: u, ok: true, shortUrl: 'https://s.test/' + i, code: 'c' + i })) }) };
  };
  const lines = [];
  for (let i = 0; i < 105; i += 1) lines.push(`https://cap.test/${i}`);
  $('bulkInput').value = lines.join('\n');
  $('bulkShorten').click();
  await tick(80);
  check('parsing capped at 100 unique URLs', submitted.length === 100, `got ${submitted.length}`);
  check('over-limit lines counted', /over limit:\s*5/.test($('bulkError').textContent), $('bulkError').textContent);
  check('button re-enabled after capped run', $('bulkShorten').disabled === false);
  dom.window.close();
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

/**
 * Link-in-bio builder tests (n9 / #bioTool).
 * Run: node tools/check-bio.mjs
 * Uses a minimal in-test DOM contract; no external runtime deps.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = await readFile(path.join(root, 'assets', 'bio-tool.js'), 'utf8');

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`); }
}

const MARKUP = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>
<div id="toast"></div>
<section id="bioTool">
  <input id="bioName" type="text">
  <input id="bioHandle" type="text">
  <textarea id="bioBio"></textarea>
  <select id="bioTheme">
    <option value="midnight">Midnight</option>
    <option value="sunrise">Sunrise</option>
    <option value="mint">Mint</option>
    <option value="rose">Rose</option>
  </select>
  <input id="bioAvatar" type="text">
  <div id="bioLinks"></div>
  <button type="button" id="bioAddLink">Add link</button>
  <button type="button" id="bioPublish"><span class="btn-label">Publish page</span><span class="spinner"></span></button>
  <button type="button" id="bioPreviewToggle">Toggle width</button>
  <button type="button" id="bioReset">Reset</button>
  <div id="bioPreview"></div>
  <div id="bioError"></div>
  <div id="bioResult" hidden class="is-hidden">
    <a id="bioShortUrl"></a>
    <button type="button" id="bioCopyUrl">Copy</button>
    <a id="bioOpenUrl">Open</a>
    <span id="bioSlug"></span>
  </div>
</section>
</body></html>`;

function boot(seedDraft, fetchImpl) {
  const dom = new JSDOM(MARKUP, {
    url: 'http://127.0.0.1:4179/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const win = dom.window;
  if (seedDraft !== undefined && seedDraft !== null) {
    win.localStorage.setItem('comly-bio-draft', JSON.stringify(seedDraft));
  }
  win.fetch = fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({}) }));
  win.eval(script);
  const $ = (id) => win.document.getElementById(id);
  const set = (id, value, type = 'input') => {
    const el = $(id);
    el.value = value;
    el.dispatchEvent(new win.Event(type, { bubbles: true }));
  };
  const rows = () => Array.from(win.document.querySelectorAll('#bioLinks .bio-link-row'));
  const pv = (cls) => win.document.querySelector('#bioPreview .' + cls);
  return { dom, win, $, set, rows, pv };
}

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('\nBio tool (jsdom)');

/* ---------- main flow ---------- */
const calls = [];
const { dom, win, $, set, rows, pv } = boot(null, async (url, init) => {
  calls.push({ url, init, payload: JSON.parse(init.body) });
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      slug: 'demo-page',
      url: 'http://127.0.0.1:4179/b/demo-page',
      shortUrl: 'http://127.0.0.1:4179/b/demo-page'
    })
  };
});

console.log('\nInitial state');
check('3 editable link rows generated', rows().length === 3, `got ${rows().length}`);
check('each row has title, URL and remove controls', rows().every((r) =>
  r.querySelector('.bio-link-title') && r.querySelector('.bio-link-url') && r.querySelector('.bio-link-remove')));
check('preview starts with no links', win.document.querySelectorAll('#bioPreview .bio-preview-link').length === 0);
check('default theme applied to preview', $('bioPreview').classList.contains('bio-theme-midnight'));

console.log('\nValidation');
$('bioPublish').click();
check('empty name blocks publish (error shown)', $('bioError').classList.contains('show') && $('bioError').textContent.length > 0);
check('no API call on invalid input', calls.length === 0, `got ${calls.length}`);

console.log('\nLive preview + handle derivation');
set('bioName', 'John Doe');
check('handle auto-derived from latin name', $('bioHandle').value === 'john-doe', $('bioHandle').value);
set('bioName', 'سارة');
check('arabic-only name falls back to page- handle', /^page-/.test($('bioHandle').value), $('bioHandle').value);
set('bioName', 'Sara Ali');
check('handle re-derived from new name', $('bioHandle').value === 'sara-ali', $('bioHandle').value);
set('bioHandle', 'sara-ali');
set('bioBio', 'Hello world');
set('bioAvatar', 'SA');
set('bioTheme', 'sunrise', 'change');

const firstTitle = rows()[0].querySelector('.bio-link-title');
const firstUrl = rows()[0].querySelector('.bio-link-url');
firstTitle.value = 'My site';
firstTitle.dispatchEvent(new win.Event('input', { bubbles: true }));
firstUrl.value = 'https://example.com';
firstUrl.dispatchEvent(new win.Event('input', { bubbles: true }));

check('preview name updates live', pv('bio-preview-name').textContent === 'Sara Ali', pv('bio-preview-name').textContent);
check('preview handle updates live', pv('bio-preview-handle').textContent === '@sara-ali', pv('bio-preview-handle').textContent);
check('preview bio updates live', pv('bio-preview-bio').textContent === 'Hello world', pv('bio-preview-bio').textContent);
check('preview avatar updates live', pv('bio-preview-avatar').textContent === 'SA', pv('bio-preview-avatar').textContent);
check('theme class switched on preview',
  $('bioPreview').classList.contains('bio-theme-sunrise') && !$('bioPreview').classList.contains('bio-theme-midnight'));
check('preview link rendered from row', (() => {
  const links = win.document.querySelectorAll('#bioPreview .bio-preview-link');
  return links.length === 1 && links[0].textContent === 'My site' && links[0].getAttribute('href') === 'https://example.com';
})());

console.log('\nAutosave');
await tick(320);
let draft = null;
try { draft = JSON.parse(win.localStorage.getItem('comly-bio-draft')); } catch (e) { /* not saved */ }
check('draft autosaved to localStorage', !!draft && draft.name === 'Sara Ali' && draft.links[0].url === 'https://example.com');

console.log('\nPublish');
$('bioPublish').click();
await tick();
check('POST /api/bio called once', calls.length === 1 && calls[0].url === '/api/bio' && calls[0].init.method === 'POST');
const payload = calls.length ? calls[0].payload : {};
check('payload fields correct', payload.title === 'Sara Ali' && payload.handle === 'sara-ali' &&
  payload.bio === 'Hello world' && payload.theme === 'sunrise' && payload.avatar === 'SA', JSON.stringify(payload));
check('payload only includes filled links', JSON.stringify(payload.links) === JSON.stringify([{ title: 'My site', url: 'https://example.com' }]), JSON.stringify(payload.links));
check('result container revealed', $('bioResult').hidden === false && !$('bioResult').classList.contains('is-hidden'));
check('short URL + slug rendered', $('bioShortUrl').textContent.includes('/b/demo-page') && $('bioSlug').textContent === 'demo-page');
check('open button points at short URL', $('bioOpenUrl').getAttribute('href') === 'http://127.0.0.1:4179/b/demo-page');
check('publish button restored after success', $('bioPublish').disabled === false && !$('bioPublish').classList.contains('is-loading') &&
  $('bioPublish').querySelector('.btn-label').textContent.length > 0);

console.log('\nLinks editor + preview toggle + reset');
for (let i = rows().length; i < 12; i++) $('bioAddLink').click();
check('add link caps at 12 rows', rows().length === 12 && $('bioAddLink').disabled === true, `rows=${rows().length}`);
$('bioAddLink').click();
check('extra add click ignored at cap', rows().length === 12);
rows()[11].querySelector('.bio-link-remove').click();
check('remove link works and re-enables add', rows().length === 11 && $('bioAddLink').disabled === false);
$('bioPreviewToggle').click();
check('preview toggle sets is-wide', $('bioPreview').classList.contains('is-wide'));
$('bioPreviewToggle').click();
check('preview toggle removes is-wide', !$('bioPreview').classList.contains('is-wide'));
$('bioReset').click();
check('reset restores 3 default rows', rows().length === 3 && rows().every((r) => !r.querySelector('.bio-link-url').value));
check('reset clears draft', win.localStorage.getItem('comly-bio-draft') === null);
check('reset hides result and clears fields', $('bioResult').hidden === true && $('bioName').value === '');

dom.window.close();

/* ---------- draft restore in a fresh instance ---------- */
console.log('\nDraft restore');
const saved = {
  name: 'Draft User', handle: 'draft-user', handleDirty: true,
  bio: 'restored bio', theme: 'mint', avatar: 'DU',
  links: [{ title: 'Docs', url: 'https://docs.example.com' }]
};
const restored = boot(saved);
check('restore fills name / handle / bio / avatar',
  restored.$('bioName').value === 'Draft User' && restored.$('bioHandle').value === 'draft-user' &&
  restored.$('bioBio').value === 'restored bio' && restored.$('bioAvatar').value === 'DU');
check('restore applies saved theme', restored.$('bioTheme').value === 'mint' && restored.$('bioPreview').classList.contains('bio-theme-mint'));
check('restore rebuilds link rows', restored.rows().length === 1 &&
  restored.rows()[0].querySelector('.bio-link-title').value === 'Docs' &&
  restored.rows()[0].querySelector('.bio-link-url').value === 'https://docs.example.com');
check('restore updates preview', restored.pv('bio-preview-name').textContent === 'Draft User' &&
  restored.pv('bio-preview-link').textContent === 'Docs');
restored.dom.window.close();

/* ---------- 409 retry ---------- */
console.log('\nDuplicate-handle retry');
let attempt = 0;
const retryCalls = [];
const retry = boot(null, async (url, init) => {
  attempt++;
  const payload = JSON.parse(init.body);
  retryCalls.push(payload);
  if (attempt === 1) return { ok: false, status: 409, json: async () => ({ error: 'handle-taken' }) };
  return { ok: true, status: 200, json: async () => ({ ok: true, slug: 'sara-x1', shortUrl: 'http://127.0.0.1:4179/b/sara-x1' }) };
});
retry.set('bioName', 'Retry User');
retry.set('bioHandle', 'taken');
const rurl = retry.rows()[0].querySelector('.bio-link-url');
rurl.value = 'https://example.org';
rurl.dispatchEvent(new retry.win.Event('input', { bubbles: true }));
retry.$('bioPublish').click();
await tick(40);
check('409 triggers exactly one automatic retry', retryCalls.length === 2);
check('retry handle has a random suffix', attempt === 2 && /^taken-[a-z0-9]+$/.test(retryCalls[1].handle), retryCalls[1] && retryCalls[1].handle);
check('retry result rendered', retry.$('bioShortUrl').textContent.includes('/b/sara-x1'));
retry.dom.window.close();

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

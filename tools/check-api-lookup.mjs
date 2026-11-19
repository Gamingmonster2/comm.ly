/**
 * API playground + lookup tool checks (jsdom, mocked fetch).
 * Run: node tools/check-api-lookup.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`); }
}

const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"></head><body>
<div id="toast"></div>
<section id="apiTool">
  <select id="apiEndpoint">
    <option value="/api/health">health</option>
    <option value="/api/shorten">shorten</option>
    <option value="/api/lookup">lookup</option>
    <option value="/api/stats">stats</option>
  </select>
  <span id="apiMethod"></span>
  <input id="apiQuery">
  <textarea id="apiBody"></textarea>
  <select id="apiLang">
    <option value="curl">curl</option>
    <option value="javascript">javascript</option>
    <option value="python">python</option>
  </select>
  <button id="apiRun"><span class="btn-label">Send request</span><span class="spinner"></span></button>
  <div id="apiError"></div>
  <span id="apiStatus"></span><span id="apiTime"></span>
  <pre id="apiResponse"></pre><pre id="apiSnippet"></pre>
  <button id="apiCopySnippet"></button><button id="apiCopyResponse"></button>
</section>
<section id="lookupTool">
  <input id="lookupInput">
  <button id="lookupButton"><span class="btn-label">Look up</span><span class="spinner"></span></button>
  <div id="lookupError"></div>
  <div id="lookupResult" hidden>
    <span id="lookupDestination"></span><span id="lookupHost"></span><span id="lookupCode"></span>
    <span id="lookupStatus" class="status-pill"></span><span id="lookupExpiry"></span>
    <span id="lookupSource"></span>
    <span id="signalHttps" class="signal-chip"></span>
    <span id="signalNetwork" class="signal-chip"></span>
    <span id="signalActive" class="signal-chip"></span>
    <span id="signalKnownShortener" class="signal-chip"></span>
    <button id="lookupOpen"></button><button id="lookupCopy"></button>
    <button id="lookupShorten"><span class="btn-label">Shorten</span><span class="spinner"></span></button>
  </div>
</section>
</body></html>`;

const dom = new JSDOM(HTML, {
  url: 'http://127.0.0.1:4175/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
const $ = (id) => window.document.getElementById(id);
const fire = (node, type) => node.dispatchEvent(new window.Event(type, { bubbles: true }));
const key = (node, value) => node.dispatchEvent(new window.KeyboardEvent('keydown', {
  key: value, bubbles: true, cancelable: true
}));
const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };

const calls = [];
let nextResponse = () => ({ ok: true, status: 200, text: async () => '{}' });
window.fetch = async (url, init) => { calls.push({ url, init }); return nextResponse(url, init); };
const toasts = [];
window.comlyToast = (message) => { toasts.push(message); };
const copied = [];
const clipboard = { writeText: async (text) => { copied.push(text); } };
try {
  Object.defineProperty(window.navigator, 'clipboard', { value: clipboard, configurable: true });
} catch {
  window.navigator.clipboard = clipboard;
}

function jsonResponse(status, data) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) };
}
function textResponse(status, text) {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

for (const file of ['api-playground.js', 'lookup-tool.js']) {
  window.eval(await readFile(path.join(root, 'assets', file), 'utf8'));
}

console.log('\nAPI playground — snippet generation');
check('initial method badge is GET', $('apiMethod').textContent === 'GET');
check('query hidden for health', $('apiQuery').style.display === 'none');
check('body hidden for health', $('apiBody').style.display === 'none');

$('apiEndpoint').value = '/api/shorten';
fire($('apiEndpoint'), 'change');
check('method badge updates to POST', $('apiMethod').textContent === 'POST');
check('JSON body sample loaded', $('apiBody').value.includes('"expiresIn": 24'));
check('query hidden for POST', $('apiQuery').style.display === 'none');
check('body visible for POST', $('apiBody').style.display !== 'none');
check('cURL POST snippet', (() => {
  const s = $('apiSnippet').textContent;
  return s.includes('curl -X POST "http://127.0.0.1:4175/api/shorten"') &&
    s.includes('-H "Content-Type: application/json"') && s.includes('-d ');
})());

$('apiLang').value = 'javascript';
fire($('apiLang'), 'change');
check('JavaScript fetch snippet', (() => {
  const s = $('apiSnippet').textContent;
  return s.includes('fetch("http://127.0.0.1:4175/api/shorten"') &&
    s.includes('method: "POST"') && s.includes('body: "');
})());

$('apiLang').value = 'python';
fire($('apiLang'), 'change');
check('Python requests snippet', (() => {
  const s = $('apiSnippet').textContent;
  return s.includes('import requests') && s.includes('requests.post') &&
    s.includes('"url": "https://example.com/page"');
})());

$('apiEndpoint').value = '/api/lookup';
fire($('apiEndpoint'), 'change');
check('query visible for GET lookup', $('apiQuery').style.display !== 'none');
check('body hidden for GET lookup', $('apiBody').style.display === 'none');
check('query sample loaded', $('apiQuery').value === 'https://comm.ly/AbC123');
$('apiLang').value = 'curl';
fire($('apiLang'), 'change');
$('apiQuery').value = 'https://comm.ly/abc?x=1&y=2';
fire($('apiQuery'), 'input');
check('cURL snippet URL-encodes query', $('apiSnippet').textContent.includes(
  '?url=https%3A%2F%2Fcomm.ly%2Fabc%3Fx%3D1%26y%3D2'
));
$('apiLang').value = 'python';
fire($('apiLang'), 'change');
check('Python GET snippet passes url param', $('apiSnippet').textContent.includes(
  'params={"url": "https://comm.ly/abc?x=1&y=2"}'
));
$('apiLang').value = 'curl';
fire($('apiLang'), 'change');

console.log('\nAPI playground — requests and rendering');
nextResponse = () => jsonResponse(200, { ok: true, site: 'commly' });
$('apiRun').click();
await settle();
let last = calls[calls.length - 1];
check('GET uses relative same-origin URL with encoded url param',
  last.url === '/api/lookup?url=' + encodeURIComponent('https://comm.ly/abc?x=1&y=2'), last.url);
check('GET method sent', last.init.method === 'GET');
check('status badge shows HTTP code', $('apiStatus').textContent === 'HTTP 200', $('apiStatus').textContent);
check('elapsed time shown', /^\d+ ms$/.test($('apiTime').textContent), $('apiTime').textContent);
check('JSON pretty-printed', $('apiResponse').textContent.includes('\n  "ok": true'));
check('no error on success', !$('apiError').classList.contains('show'));

nextResponse = () => textResponse(200, 'plain body');
$('apiRun').click();
await settle();
check('raw text fallback rendered', $('apiResponse').textContent === 'plain body');

$('apiEndpoint').value = '/api/shorten';
fire($('apiEndpoint'), 'change');
const beforeBad = calls.length;
$('apiBody').value = '{not json';
$('apiRun').click();
await settle();
check('invalid JSON shows friendly error', $('apiError').classList.contains('show') &&
  $('apiError').textContent.includes('Invalid JSON'));
check('invalid JSON performs no fetch', calls.length === beforeBad);

nextResponse = () => jsonResponse(201, { shortUrl: 'https://comm.ly/xyz' });
$('apiBody').value = '{"url":"https://example.com/x","expiresIn":0}';
fire($('apiBody'), 'input');
$('apiRun').click();
await settle();
last = calls[calls.length - 1];
check('POST method sent', last.init.method === 'POST');
check('POST sends JSON content type', last.init.headers['Content-Type'] === 'application/json');
check('POST payload parsed and re-serialised', (() => {
  const data = JSON.parse(last.init.body);
  return data.url === 'https://example.com/x' && data.expiresIn === 0;
})());
check('status badge shows 201', $('apiStatus').textContent === 'HTTP 201');
check('button label restored after run', $('apiRun').querySelector('.btn-label').textContent === 'Send request');

copied.length = 0;
$('apiCopySnippet').click();
await settle();
check('copy snippet uses clipboard', copied[0] === $('apiSnippet').textContent);
copied.length = 0;
$('apiCopyResponse').click();
await settle();
check('copy response uses clipboard', copied[0] === $('apiResponse').textContent);

nextResponse = async () => { throw new Error('offline'); };
$('apiRun').click();
await settle();
check('network failure shows error', $('apiError').textContent.includes('offline'));
check('network failure clears response', $('apiResponse').textContent === '');
check('network failure badge shows Failed', $('apiStatus').textContent === 'Failed');

console.log('\nLookup tool — validation and result rendering');
check('result hidden initially', $('lookupResult').hidden === true);
const beforeInvalid = calls.length;
$('lookupInput').value = 'javascript:alert(1)';
$('lookupButton').click();
await settle();
check('invalid scheme rejected', $('lookupError').classList.contains('show') &&
  $('lookupError').textContent.includes('http://'));
check('invalid input performs no fetch', calls.length === beforeInvalid);

const FOUND = {
  found: true, destination: 'https://example.com/final', host: 'comm.ly',
  code: 'AbC123', expiresAt: null, expired: false, active: true, safeProtocol: true
};
nextResponse = () => jsonResponse(200, FOUND);
$('lookupInput').value = 'comm.ly/AbC123';
key($('lookupInput'), 'Enter');
await settle();
last = calls[calls.length - 1];
check('lookup URL normalised and encoded',
  last.url === '/api/lookup?url=' + encodeURIComponent('https://comm.ly/AbC123'), last.url);
check('lookup uses GET', last.init.method === 'GET');
check('result revealed', $('lookupResult').hidden === false);
check('destination rendered', $('lookupDestination').textContent === 'https://example.com/final');
check('host rendered', $('lookupHost').textContent === 'comm.ly');
check('code rendered', $('lookupCode').textContent === 'AbC123');
check('status pill Verified', $('lookupStatus').textContent === 'Verified');
check('status pill pass styling', $('lookupStatus').classList.contains('live'));
check('source rendered', $('lookupSource').textContent === 'comm.ly network');
check('no fetch to destination', calls.every((c) => c.url.indexOf('/api/') === 0));
check('all four signals pass', ['signalHttps', 'signalNetwork', 'signalActive', 'signalKnownShortener']
  .every((id) => $(id).classList.contains('signal-ok')));

nextResponse = () => jsonResponse(200, {
  found: true, destination: 'https://example.com/old', host: 'comm.ly',
  code: 'old', expiresAt: '2020-01-01T00:00:00.000Z', expired: true, active: true, safeProtocol: true
});
$('lookupInput').value = 'https://comm.ly/old';
$('lookupButton').click();
await settle();
check('expired status pill', $('lookupStatus').textContent === 'Expired');
check('expired signal fails', $('signalActive').classList.contains('signal-bad'));
check('expiry shown', $('lookupExpiry').textContent !== 'Never');

nextResponse = () => jsonResponse(400, { error: 'unsupported_host' });
$('lookupInput').value = 'https://bit.ly/xyz';
$('lookupButton').click();
await settle();
check('unsupported host status pill is External', $('lookupStatus').textContent === 'External');
check('unsupported host error is clear', $('lookupError').textContent.includes('comm.ly network'));
check('known shortener inferred client-side', $('signalKnownShortener').classList.contains('signal-warn'));
check('network signal warns for third-party host', $('signalNetwork').classList.contains('signal-warn'));

nextResponse = () => jsonResponse(404, { found: false, code: 'nope' });
$('lookupInput').value = 'https://comm.ly/nope';
$('lookupButton').click();
await settle();
check('not-found status pill', $('lookupStatus').textContent === 'Not found');
check('not-found message shown', $('lookupError').textContent.includes('No short link'));

nextResponse = (url) => url === '/api/shorten'
  ? jsonResponse(201, { shortUrl: 'https://comm.ly/newK', code: 'newK' })
  : jsonResponse(200, FOUND);
$('lookupInput').value = 'https://comm.ly/AbC123';
$('lookupButton').click();
await settle();
$('lookupShorten').click();
await settle();
last = calls[calls.length - 1];
check('shorten payload uses destination', (() => {
  const data = JSON.parse(last.init.body);
  return last.url === '/api/shorten' && last.init.method === 'POST' &&
    data.url === 'https://example.com/final' && data.expiresIn === 0;
})());
check('short URL node created and shown', (() => {
  const node = $('lookupShortUrl');
  return !!node && node.textContent.includes('https://comm.ly/newK');
})());
check('shorten success toast', toasts.some((m) => m.includes('Short link created')));

let opened = null;
window.open = (url, target, features) => { opened = [url, target, features]; return { opener: window }; };
$('lookupOpen').click();
check('open uses new tab with noopener', opened && opened[0] === 'https://example.com/final' &&
  opened[1] === '_blank' && /noopener/.test(opened[2]));
copied.length = 0;
$('lookupCopy').click();
await settle();
check('copy destination uses clipboard', copied[0] === 'https://example.com/final');

console.log('\nLookup tool — safe rendering');
const hostile = 'https://example.com/<img src=x onerror=alert(1)>';
nextResponse = () => jsonResponse(200, {
  found: true, destination: hostile, host: 'comm.ly', code: 'evil',
  active: true, safeProtocol: true
});
$('lookupInput').value = 'https://comm.ly/evil';
$('lookupButton').click();
await settle();
check('hostile destination rendered as text only', $('lookupDestination').textContent === hostile &&
  !$('lookupDestination').querySelector('img'));

dom.window.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

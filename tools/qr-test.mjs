/**
 * QR generator tests — encoder vectors + interactive tool DOM flow.
 * Run: node tools/qr-test.mjs   (build n3 first: node build/build.mjs --site=n3)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

await import('../assets/qr-lib.js');
const QR = globalThis.ComlyQR;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`); }
}

function fromHex(hex, size) {
  const bits = [];
  for (const byte of hex) bits.push(...parseInt(byte, 16).toString(2).padStart(4, '0').split('').map(Number));
  const rows = [];
  for (let r = 0; r < size; r++) rows.push(bits.slice(r * size, (r + 1) * size).map(Boolean));
  return rows;
}

console.log('\nQR encoder');
const VECTORS = [
  { text: 'HELLO WORLD', level: 'L', version: 1, mask: 7, size: 21, hex: 'fe5bfc16906eb2bb74a5dba8aec14d07faafe01f00d363b4c1188de25b8be5bdbafa005853fa8fd04321ba3635d60fee82ab05680fe8970' },
  { text: 'https://comm.ly/x/' + 'a'.repeat(89), level: 'M', version: 7, mask: 1, size: 45, hex: 'fea0cf2bcbfc11f4a93e906ea48ea5d4bb74fa946ab5dba234f8abaec17fc4410107faaaaaaaafe0096b111000a372ffaa912e4ce602aa8ccc861e97726a6b26b921018c683343ab2d6ed69c68aa879861cb7f36a0a86a21501a16c72baab2dc2a590686a84ee6dcb7116a698baa1131adfc92faabfdb461544aac672a526af72bbd1cc5111d1a5fc91faa8f9f0c54d2ea2871e12dd176abcadcca0d34b4ab9f2a4b4560e5a127a1855c2ddb1f7ea8b64481d34aae981aa9b759ed6fd2aa2842c25c5616aaf36046d124a9b9f9fcabfd805ff47aac67fbf6abf72bb04c2f111f1aba55dfbaaf9dd12cba2a446eb57ff572ab04e211212a8feadaababdc8' },
  { text: 'مرحبا بالعالم — comm.ly', level: 'H', version: 5, mask: 3, size: 37, hex: 'fe24d523fc109b18906e852b92bb745e9985dbaec5db2ec1325ead07faaaaaafe01a56b00033bb935e824b3363d162b28ead7743569e2b69262222ce5095f1a05159e5ff71f03895eead73e0120a16c441172cac87a4409439ebc85841f6511269485c856c43fab1196a169d9b007af3e385ad91e91adf2f1cdfaad0c72bb452a7207e9cc6fa0056cec477fa08f86a304c9cdd1dba5e3f9ff5d49c64c32eb518f98504ad30d48fe12c0fe98' }
];
for (const vector of VECTORS) {
  const res = QR.matrix(vector.text, { level: vector.level });
  check(`reference matrix v${vector.version}-${vector.level}`,
    res.version === vector.version && res.mask === vector.mask && res.size === vector.size &&
    JSON.stringify(res.modules) === JSON.stringify(fromHex(vector.hex, vector.size)));
}
const once = QR.matrix('https://comm.ly/abc', { level: 'M' });
const twice = QR.matrix('https://comm.ly/abc', { level: 'M' });
check('deterministic output', JSON.stringify(once) === JSON.stringify(twice));
check('finder patterns in 3 corners', (() => {
  const m = once.modules;
  const finder = (or, oc) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const dark = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      if (m[or + r][oc + c] !== dark) return false;
    }
    return true;
  };
  const n = once.size;
  return finder(0, 0) && finder(0, n - 7) && finder(n - 7, 0);
})());
check('size follows version', QR.matrix('x'.repeat(100), { level: 'M' }).size === QR.matrix('x'.repeat(100), { level: 'M' }).version * 4 + 17);
const svg = QR.svg('https://comm.ly/abc', { scale: 4, foreground: '#111111', background: '#ffffff' });
check('SVG is self-contained', svg.startsWith('<svg') && svg.includes('#111111') && !/https?:\/\//.test(svg.replace('http://www.w3.org/2000/svg', '')));
check('data URL is a SVG data URL', QR.dataUrl('x').startsWith('data:image/svg+xml;charset=utf-8,'));
check('rejects too-long input', (() => { try { QR.matrix('x'.repeat(400)); return false; } catch (e) { return e.message === 'QR_TOO_LONG'; } })());
check('rejects unknown level', (() => { try { QR.matrix('x', { level: 'Z' }); return false; } catch (e) { return e.message === 'QR_BAD_LEVEL'; } })());

console.log('\nInteractive tool (DOM)');
let html;
try {
  html = await readFile(path.join(root, 'dist', 'n3', 'index.html'), 'utf8');
} catch {
  console.log('  ⚠ dist/n3/index.html missing — run: node build/build.mjs --site=n3');
  process.exit(1);
}
const dom = new JSDOM(html, { url: 'http://127.0.0.1:4175/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
let shortenCalls = 0;
window.fetch = async (url, init) => {
  shortenCalls++;
  const payload = JSON.parse(init.body);
  check('shorten request uses the entered URL', payload.url === 'https://example.com/menu' && payload.expiresIn === 0);
  return { ok: true, json: async () => ({ shortUrl: 'http://127.0.0.1:4175/m123' }) };
};
for (const file of ['qr-lib.js', 'qr-tool.js']) {
  window.eval(await readFile(path.join(root, 'assets', file), 'utf8'));
}
const $ = (id) => window.document.getElementById(id);
check('tool markup present', !!$('qrTool') && !!$('qrGenerate') && !!$('qrPreview'));

$('qrInput').value = 'https://example.com/menu';
$('qrGenerate').click();
await new Promise((resolve) => setTimeout(resolve, 80));
check('shorten-first calls /api/shorten once', shortenCalls === 1);
check('QR rendered into preview', $('qrPreview').innerHTML.includes('<svg') && $('qrPreview').classList.contains('has-qr'));
check('encoded short URL shown', $('qrResultUrl').textContent.includes('http://127.0.0.1:4175/m123'));
check('download actions revealed', $('qrActions').classList.contains('is-hidden') === false);

$('qrShortenFirst').checked = false;
$('qrInput').value = 'https://example.com/direct';
$('qrGenerate').click();
await new Promise((resolve) => setTimeout(resolve, 80));
check('no API call when shorten-first is off', shortenCalls === 1);
check('raw URL encoded', $('qrResultUrl').textContent.includes('https://example.com/direct'));

$('qrInput').value = '';
$('qrGenerate').click();
await new Promise((resolve) => setTimeout(resolve, 30));
check('empty input shows error', $('qrError').classList.contains('show'));
dom.window.close();

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

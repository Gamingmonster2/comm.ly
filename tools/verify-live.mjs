/**
 * Live smoke test for deployed comm.ly network sites.
 * Usage: node tools/verify-live.mjs
 * Override bases with COMMLY_BASE / N3_BASE / ... environment variables.
 */
const bases = {
  commly: process.env.COMMLY_BASE || 'https://comm-ly.pages.dev',
  n3: process.env.N3_BASE || 'https://comly-n3.pages.dev',
  n4: process.env.N4_BASE || 'https://comly-n4.pages.dev',
  n6: process.env.N6_BASE || 'https://comly-n6.pages.dev',
  n7: process.env.N7_BASE || 'https://comly-n7.pages.dev',
  n8: process.env.N8_BASE || 'https://comly-n8.pages.dev',
  n9: process.env.N9_BASE || 'https://comly-n9.pages.dev'
};
const toolAsset = {
  commly: 'assets/app.js', n3: 'assets/qr-tool.js', n4: 'assets/utm-tool.js',
  n6: 'assets/bulk-tool.js', n7: 'assets/api-playground.js',
  n8: 'assets/lookup-tool.js', n9: 'assets/bio-tool.js'
};
let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`✔ ${label}`);
  else { failures += 1; console.log(`✖ ${label}${detail ? ` — ${detail}` : ''}`); }
}
async function get(base, path, options) {
  const res = await fetch(base + path, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { /* plain text */ }
  return { res, text, data };
}
function postJson(path, body) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

const firstCodes = {};
for (const [site, base] of Object.entries(bases)) {
  console.log(`\n--- ${site} (${base}) ---`);
  try {
    const home = await get(base, '/');
    check(`${site}: home 200`, home.res.status === 200, String(home.res.status));
    check(`${site}: home has theme + title`, home.text.includes('data-theme') && home.text.includes('<title>'));
    const ar = await get(base, '/ar/');
    check(`${site}: Arabic page 200 + RTL`, ar.res.status === 200 && ar.text.includes('dir="rtl"'), String(ar.res.status));
    const css = await get(base, '/assets/styles.css');
    check(`${site}: design system CSS 200`, css.res.status === 200 && css.text.includes('--background'));
    const tool = await get(base, '/' + toolAsset[site]);
    check(`${site}: tool script 200`, tool.res.status === 200, String(tool.res.status));

    const health = await get(base, '/api/health');
    check(`${site}: /api/health 200`, health.res.status === 200 && health.data.ok === true, health.text.slice(0, 120));
    check(`${site}: health host matches`, health.data.host === new URL(base).host, JSON.stringify(health.data));

    const target = `https://example.com/live-${site}-${Date.now()}`;
    const created = await get(base, '/api/shorten', postJson('/api/shorten', { url: target, expiresIn: 0 }));
    check(`${site}: /api/shorten 201 (D1 + KV)`, created.res.status === 201 && created.data.shortUrl, created.text.slice(0, 140));
    if (created.data.code) {
      firstCodes[site] = { code: created.data.code, target, base };
      const found = await get(base, '/api/lookup?url=' + encodeURIComponent(created.data.shortUrl));
      check(`${site}: /api/lookup resolves own code`, found.res.status === 200 && found.data.destination === target, found.text.slice(0, 140));
    }
  } catch (err) {
    check(`${site}: smoke test threw`, false, String(err).slice(0, 200));
  }
}

/* Shared D1 means a code created on one domain resolves on all others. */
const source = firstCodes.n3;
if (source) {
  console.log('\n--- Cross-domain resolution ---');
  for (const [site, base] of Object.entries(bases)) {
    if (site === 'n3') continue;
    try {
      const res = await fetch(`${base}/${source.code}`, { redirect: 'manual' });
      check(`${site}: resolves n3 code ${source.code}`, res.status === 302 && res.headers.get('location') === source.target, `${res.status} ${res.headers.get('location')}`);
    } catch (err) { check(`${site}: cross-domain check threw`, false, String(err).slice(0, 140)); }
  }
}

/* Bulk shortening (n6) */
console.log('\n--- Bulk shortening ---');
try {
  const bulk = await get(bases.n6, '/api/shorten/bulk', postJson('/api/shorten/bulk', {
    urls: ['https://example.com/bulk-a', 'https://example.com/bulk-b', 'javascript:alert(1)'], expiresIn: 0
  }));
  check('n6: bulk endpoint 200', bulk.res.status === 200, bulk.text.slice(0, 120));
  check('n6: bulk created 2, failed 1', bulk.data.created === 2 && bulk.data.failed === 1, JSON.stringify({ c: bulk.data.created, f: bulk.data.failed }));
} catch (err) { check('n6: bulk threw', false, String(err).slice(0, 140)); }

/* Bio pages (n9) */
console.log('\n--- Bio pages ---');
try {
  const handle = 'live-' + Math.random().toString(36).slice(2, 9);
  const created = await get(bases.n9, '/api/bio', postJson('/api/bio', {
    title: 'Live Check', handle, bio: 'Verification page', theme: 'mint', avatar: 'L',
    links: [{ title: 'Example', url: 'https://example.com' }]
  }));
  check('n9: /api/bio 201', created.res.status === 201 && created.data.slug === handle, created.text.slice(0, 140));
  if (created.data.slug) {
    const page = await get(bases.n9, '/b/' + created.data.slug);
    check('n9: /b/:slug 200 with content', page.res.status === 200 && page.text.includes('Live Check'), String(page.res.status));
    const json = await get(bases.n9, '/api/bio/' + created.data.slug);
    check('n9: /api/bio/:slug 200', json.res.status === 200 && json.data.page.slug === handle, json.text.slice(0, 120));
  }
} catch (err) { check('n9: bio threw', false, String(err).slice(0, 140)); }

console.log(failures === 0 ? '\nALL LIVE CHECKS PASSED' : `\n${failures} LIVE CHECK(S) FAILED`);
process.exitCode = failures ? 1 : 0;

/**
 * Engine logic tests without Cloudflare (in-memory D1/KV stubs).
 * Usage: node tools/engine-test.mjs
 */
import { handle } from '../dist/commly/functions/_lib/engine.js';

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`✔ ${label}`);
  else {
    failures += 1;
    console.log(`✖ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ---------------- fake D1 ---------------- */
const links = new Map();
const daily = new Map();
const contacts = [];

function runStatement(sql, args) {
  if (/^INSERT INTO links/i.test(sql)) {
    const [code, url, siteId, expiresAt, createdAt] = args;
    if (links.has(code)) throw new Error('UNIQUE constraint failed');
    links.set(code, { url, site_id: siteId, expires_at: expiresAt, created_at: createdAt, active: 1, clicks: 0 });
    return;
  }
  if (/^UPDATE links SET clicks/i.test(sql)) {
    const [lastClick, code] = args;
    const link = links.get(code);
    if (link) {
      link.clicks += 1;
      link.last_click_at = lastClick;
    }
    return;
  }
  if (/^INSERT INTO daily_stats/i.test(sql)) {
    const [day, , host] = args;
    const key = `${day}|${host}`;
    daily.set(key, (daily.get(key) || 0) + 1);
    return;
  }
  if (/^INSERT INTO contact_messages/i.test(sql)) {
    contacts.push(args);
    return;
  }
  throw new Error(`Unhandled SQL in test stub: ${sql.slice(0, 60)}`);
}

class Statement {
  constructor(sql, args) {
    this.sql = sql;
    this.args = args || [];
  }
  bind(...args) {
    return new Statement(this.sql, args);
  }
  async run() {
    runStatement(this.sql, this.args);
    return { success: true };
  }
  async first() {
    if (/^SELECT url, expires_at, active FROM links WHERE code = \?/i.test(this.sql)) {
      const row = links.get(this.args[0]);
      return row ? { url: row.url, expires_at: row.expires_at, active: row.active } : null;
    }
    return null;
  }
}

const DB = {
  prepare: (sql) => new Statement(sql),
  batch: async (statements) => {
    for (const statement of statements) await statement.run();
    return [];
  }
};

/* ---------------- fake KV ---------------- */
const kv = new Map();
const CACHE = {
  async get(key, type) {
    const value = kv.has(key) ? kv.get(key) : null;
    if (value == null) return null;
    return type === 'json' ? JSON.parse(value) : value;
  },
  async put(key, value) {
    kv.set(key, value);
  }
};

function context(url, options = {}) {
  const request = new Request(url, {
    method: options.method || 'GET',
    headers: { 'cf-connecting-ip': '1.2.3.4', ...(options.headers || {}) },
    body: options.body
  });
  return {
    request,
    env: { DB, CACHE },
    next: async () => new Response('STATIC-ASSET', { status: 200 }),
    waitUntil: (promise) => promise
  };
}

/* ---------------- tests ---------------- */
const base = 'https://comm.ly';

// 1) shorten
let res = await handle(context(`${base}/api/shorten`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com/long/path', expiresIn: 24 })
}));
let data = await res.json();
check('POST /api/shorten → 201', res.status === 201, String(res.status));
check('short URL uses request host', data.shortUrl === `${base}/${data.code}`, data.shortUrl);
check('network hosts returned', Array.isArray(data.network) && data.network.includes('3.com.ly'));
check('link stored in D1', links.has(data.code));
const firstCode = data.code;

// 2) custom slug
res = await handle(context(`${base}/api/shorten`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com/promo', slug: 'promo-2026', expiresIn: 0 })
}));
data = await res.json();
check('custom slug → 201', res.status === 201 && data.code === 'promo-2026', JSON.stringify(data));
check('never-expiring link has null expiresAt', data.expiresAt === null);

// 3) duplicate slug
res = await handle(context(`${base}/api/shorten`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com/again', slug: 'promo-2026' })
}));
check('duplicate slug → 409', res.status === 409, String(res.status));

// 4) invalid / private URLs
for (const bad of ['javascript:alert(1)', 'http://localhost:8080/x', 'http://127.0.0.1/x', 'ftp://example.com']) {
  res = await handle(context(`${base}/api/shorten`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: bad })
  }));
  check(`rejects ${bad}`, res.status === 400, String(res.status));
}

// 5) redirect (same host)
res = await handle(context(`${base}/${firstCode}`));
check('GET /:code → 302', res.status === 302, String(res.status));
check('redirect location correct', res.headers.get('location') === 'https://example.com/long/path', res.headers.get('location'));

// 6) network-wide resolution (another domain, same DB)
res = await handle(context(`https://3.com.ly/${firstCode}`));
check('same code resolves on 3.com.ly (network)', res.status === 302, String(res.status));

// 7) custom slug resolves without KV cache
kv.clear();
res = await handle(context(`https://n4.com.ly/promo-2026`));
check('custom slug resolves from D1 cache miss', res.status === 302);

// 8) unknown code → 404 page
res = await handle(context(`${base}/doesnotexist`));
check('unknown code → 404', res.status === 404, String(res.status));
check('404 page is HTML', (res.headers.get('content-type') || '').includes('text/html'));

// 9) expired link → 410
links.set('oldlink', { url: 'https://example.com/old', expires_at: '2020-01-01T00:00:00.000Z', active: 1, clicks: 0 });
res = await handle(context(`${base}/oldlink`));
check('expired link → 410', res.status === 410, String(res.status));

// 10) static paths fall through to Pages assets
for (const path of ['/assets/styles.css', '/privacy/', '/network/', '/en/pricing/']) {
  res = await handle(context(`${base}${path}`));
  check(`static passthrough ${path}`, (await res.text()) === 'STATIC-ASSET');
}

// 11) contact form
res = await handle(context(`${base}/api/contact`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Test', email: 'test@example.com', message: 'Hello from tests' })
}));
check('POST /api/contact → 200', res.status === 200, String(res.status));
check('contact message stored', contacts.length === 1);

// 12) health
res = await handle(context(`${base}/api/health`));
check('GET /api/health → 200', res.status === 200);

// 13) click aggregation recorded
check('click counted on link', links.get(firstCode).clicks >= 1);
check('daily stats written', [...daily.values()].some((value) => value >= 1));

console.log(failures === 0 ? '\nALL ENGINE TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures ? 1 : 0);

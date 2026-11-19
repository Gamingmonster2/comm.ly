/**
 * Comly Network — shared shortening engine (Cloudflare Pages Functions)
 * Bound resources (configure per Pages project):
 *   DB    → D1 database (shared across all network domains)
 *   CACHE → KV namespace (redirect cache)
 *
 * Each deployment gets a generated `_lib/site-config.js` from the build.
 */
import { SITE, NETWORK, siteFor } from './site-config.js';
import { handleAuthRoute, handleLinksRoute, handleLookup, handleStatsRoute } from './links.js';

const RESERVED = new Set([
  'api', 'assets', 'b', 'en', 'ar', 'app', 'admin', 'login', 'register', 'privacy', 'terms', 'contact',
  'network', 'pricing', 'about', 'blog', 'docs', 'faq', 'u', 'sitemap.xml',
  'robots.txt', 'favicon.ico', 'index.html', '404.html', '410.html',
  '_headers', '_routes.json'
]);
const SLUG_RE = /^[A-Za-z0-9_-]{3,24}$/;
const CODE_PATH_RE = /^\/([A-Za-z0-9_-]{2,32})\/?$/;
const BIO_PATH_RE = /^\/b\/([A-Za-z0-9_-]{3,32})\/?$/;
const BIO_API_RE = /^\/api\/bio\/([A-Za-z0-9_-]{3,32})\/?$/;
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;
const BIO_THEMES = new Set(['midnight', 'sunrise', 'mint', 'rose']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KNOWN_SHORTENERS = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|buff\.ly|rebrand\.ly|cutt\.ly|rb\.gy|short\.link|clck\.ru|v\.gd|lnkd\.in|s\.id)$/i;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

/* Per-isolate burst limiter (cheap first line of defence). */
const hits = new Map();
function rateLimited(ip, bucketName = 'default', limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const key = `${bucketName}:${ip}`;
  const bucket = hits.get(key) || { count: 0, reset: now + windowMs };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + windowMs;
  }
  bucket.count += 1;
  hits.set(key, bucket);
  if (hits.size > 5_000) hits.clear();
  return bucket.count > limit;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }
  });
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function errorPage(kind, lang) {
  const ar = lang !== 'en';
  const [c1, c2] = SITE.colors;
  const title = kind === 'gone' ? (ar ? 'انتهت الصلاحية' : 'Link expired') : (ar ? 'الرابط غير موجود' : 'Link not found');
  const code = kind === 'gone' ? 410 : 404;
  const message = kind === 'gone'
    ? (ar ? 'انتهت صلاحية هذا الرابط. أنشئ رابطاً جديداً من الصفحة الرئيسية.' : 'This link has expired. Create a new one from the homepage.')
    : (ar ? 'هذا الرابط غير موجود. جرّب إنشاء رابط جديد.' : 'This link does not exist. Try creating a new one.');
  const home = ar ? 'العودة للرئيسية' : 'Back home';
  const body = `<!DOCTYPE html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${code} — ${SITE.host}</title><meta name="robots" content="noindex"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05060a;color:#eef1f6;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}h1{font-size:3.4rem;margin:0;background:linear-gradient(96deg,${c1},${c2});-webkit-background-clip:text;background-clip:text;color:transparent}p{color:#9aa4b8;max-width:440px;margin:14px auto 26px;line-height:1.8}a{display:inline-block;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,${c1},${c2});color:#fff;text-decoration:none;font-weight:700}</style></head><body><main><h1>${code}</h1><p>${message}</p><a href="/">${home}</a></main></body></html>`;
  return new Response(body, {
    status: code,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }
  });
}

function validateUrl(raw, allowNetwork = false) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
    if (/^(127\.|10\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host)) return null;
    if (host === '::1' || host.startsWith('[')) return null;
    /* Shortening our own network domains would create redirect loops. Bio links may point there. */
    if (!allowNetwork && NETWORK.some((entry) => host === entry.host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function randomCode(length = 7) {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function createLinkRecord(context, target, slug, hours, host) {
  const { env } = context;
  const ttl = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 365) : 0;
  const createdAt = new Date().toISOString();
  const expiresAt = ttl ? new Date(Date.now() + ttl * 3_600_000).toISOString() : null;

  for (let attempt = 0; attempt < (slug ? 1 : 4); attempt += 1) {
    const code = slug || randomCode();
    try {
      await env.DB.prepare(
        'INSERT INTO links (code, url, site_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(code, target, siteFor(host).id, expiresAt, createdAt).run();
      try {
        await env.CACHE.put(`l:${code}`, JSON.stringify({ u: target, e: expiresAt, a: 1 }), {
          expirationTtl: ttl ? Math.min(ttl * 3600, 2_592_000) : 604_800
        });
      } catch { /* cache is best-effort */ }
      return {
        ok: true,
        data: {
          shortUrl: `https://${host}/${code}`,
          code,
          expiresAt,
          network: NETWORK.map((entry) => entry.host)
        }
      };
    } catch (err) {
      if (slug) return { ok: false, error: 'slug_taken', status: 409 };
    }
  }
  return { ok: false, error: 'could_not_create', status: 500 };
}

async function shorten(context, requestUrl) {
  const { request } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip, 'shorten', 30, 60_000)) return json({ error: 'rate_limited' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const target = validateUrl(String(body.url || ''));
  if (!target) return json({ error: 'invalid_url' }, 400);

  let slug = body.slug ? String(body.slug).trim() : '';
  if (slug && !SLUG_RE.test(slug)) return json({ error: 'invalid_slug' }, 400);
  if (slug && RESERVED.has(slug.toLowerCase())) return json({ error: 'slug_reserved' }, 409);

  const hours = body.expiresIn === undefined ? 24 : Number(body.expiresIn);
  const result = await createLinkRecord(context, target, slug, hours, requestUrl.hostname);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(result.data, 201);
}

/**
 * Bulk shortening for the n6 tool. One request creates up to 100 links,
 * avoiding the per-request burst limit while keeping ownership and cache writes identical.
 */
async function bulkShorten(context, requestUrl) {
  const { request } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip, 'bulk', 3, 600_000)) return json({ error: 'rate_limited' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const rawUrls = Array.isArray(body.urls) ? body.urls.slice(0, 100) : [];
  if (!rawUrls.length) return json({ error: 'invalid_urls' }, 400);

  const hours = body.expiresIn === undefined ? 0 : Number(body.expiresIn);
  const results = [];
  const seen = new Set();
  for (let index = 0; index < rawUrls.length; index += 1) {
    const original = String(rawUrls[index] || '');
    const target = validateUrl(original);
    if (!target || seen.has(target)) {
      results.push({ index, url: original, ok: false, error: target ? 'duplicate' : 'invalid_url' });
      continue;
    }
    seen.add(target);
    const created = await createLinkRecord(context, target, '', hours, requestUrl.hostname);
    if (created.ok) {
      results.push({ index, url: original, ok: true, shortUrl: created.data.shortUrl, code: created.data.code, expiresAt: created.data.expiresAt });
    } else {
      results.push({ index, url: original, ok: false, error: created.error });
    }
  }
  const createdCount = results.filter((row) => row.ok).length;
  return json({ results, created: createdCount, failed: results.length - createdCount }, 200);
}

async function recordClick(env, request, url, code) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const country = (request.cf && request.cf.country) || 'XX';
    await env.DB.batch([
      env.DB.prepare('UPDATE links SET clicks = clicks + 1, last_click_at = ? WHERE code = ?')
        .bind(new Date().toISOString(), code),
      env.DB.prepare(
        'INSERT INTO daily_stats (day, code, host, clicks, country) VALUES (?, ?, ?, 1, ?) ON CONFLICT(day, code, host) DO UPDATE SET clicks = clicks + 1'
      ).bind(day, code, url.hostname, country)
    ]);
  } catch { /* analytics must never break redirects */ }
}

async function resolve(context, code, url) {
  const { env, request } = context;
  let record = null;
  try {
    record = await env.CACHE.get(`l:${code}`, 'json');
  } catch { /* ignore cache errors */ }

  if (!record) {
    let row = null;
    try {
      row = await env.DB.prepare('SELECT url, expires_at, active FROM links WHERE code = ?').bind(code).first();
    } catch {
      return errorPage('missing', 'en');
    }
    if (!row) return errorPage('missing', 'en');
    record = { u: row.url, e: row.expires_at, a: row.active };
    try {
      await env.CACHE.put(`l:${code}`, JSON.stringify(record), { expirationTtl: 21_600 });
    } catch { /* ignore */ }
  }

  if (record.a === 0) return errorPage('gone', 'en');
  if (record.e && Date.parse(record.e) < Date.now()) return errorPage('gone', 'en');

  context.waitUntil(recordClick(env, request, url, code));
  return new Response(null, {
    status: 302,
    headers: {
      Location: record.u,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      ...SECURITY_HEADERS
    }
  });
}

async function contact(context, requestUrl) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip, 'contact', 10, 60_000)) return json({ error: 'rate_limited' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().slice(0, 120);
  const message = String(body.message || '').trim().slice(0, 3000);

  if (!name || !EMAIL_RE.test(email) || message.length < 5) return json({ error: 'invalid_input' }, 400);

  try {
    await env.DB.prepare(
      'INSERT INTO contact_messages (site_id, name, email, message, country) VALUES (?, ?, ?, ?, ?)'
    ).bind(SITE.id, name, email, message, (request.cf && request.cf.country) || null).run();
  } catch {
    return json({ error: 'storage_failed' }, 500);
  }
  return json({ ok: true });
}

/**
 * Provider-agnostic billing webhook.
 * The payment platform (later) only has to POST:
 *   { workspaceId, plan, status, currentPeriodEnd, provider, externalId }
 * signed with BILLING_WEBHOOK_SECRET (header x-webhook-signature).
 */
async function billingWebhook(context) {
  const { request, env } = context;
  const secret = env.BILLING_WEBHOOK_SECRET;
  if (!secret) return json({ ok: false, error: 'billing_not_configured' }, 501);
  if ((request.headers.get('x-webhook-signature') || '') !== secret) return json({ error: 'invalid_signature' }, 401);

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const workspaceId = Number(payload.workspaceId);
  const plan = String(payload.plan || 'pro');
  const status = String(payload.status || 'active');
  const provider = String(payload.provider || 'custom');
  const externalId = payload.externalId ? String(payload.externalId) : null;
  const periodEnd = payload.currentPeriodEnd ? String(payload.currentPeriodEnd) : null;
  if (!workspaceId || !['free', 'pro', 'business', 'agency', 'enterprise'].includes(plan)) {
    return json({ error: 'invalid_payload' }, 400);
  }

  try {
    const existing = await env.DB.prepare('SELECT id FROM subscriptions WHERE workspace_id = ?').bind(workspaceId).first();
    if (existing) {
      await env.DB.prepare(
        'UPDATE subscriptions SET plan = ?, status = ?, provider = ?, external_id = ?, current_period_end = ?, updated_at = ? WHERE id = ?'
      ).bind(plan, status, provider, externalId, periodEnd, new Date().toISOString(), existing.id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO subscriptions (workspace_id, plan, status, provider, external_id, current_period_end) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(workspaceId, plan, status, provider, externalId, periodEnd).run();
    }
    const effectivePlan = status === 'active' || status === 'trialing' ? plan : 'free';
    await env.DB.prepare('UPDATE workspaces SET plan = ? WHERE id = ?').bind(effectivePlan, workspaceId).run();
    return json({ ok: true, plan: effectivePlan, status });
  } catch {
    return json({ error: 'storage_failed' }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* Link-in-bio pages (9.com.ly tool)                                   */
/* ------------------------------------------------------------------ */

function makeHandle(value) {
  const raw = String(value || '').toLowerCase().trim();
  let slug = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (!HANDLE_RE.test(slug)) slug = `page-${randomCode(6).toLowerCase()}`;
  return slug;
}

function parseBioPayload(body) {
  const title = String(body.title || '').trim().slice(0, 60);
  const bio = String(body.bio || '').trim().slice(0, 160);
  const theme = BIO_THEMES.has(body.theme) ? body.theme : 'midnight';
  const requested = String(body.handle || '').trim();
  const handle = makeHandle(requested || title);
  const rawAvatar = String(body.avatar || '').trim().slice(0, 3);
  const avatar = rawAvatar || (title.replace(/\s/g, '').charAt(0) || '✦');
  const rawLinks = Array.isArray(body.links) ? body.links.slice(0, 12) : [];
  const links = [];
  const seen = new Set();
  for (const item of rawLinks) {
    const url = validateUrl(String((item && item.url) || ''), true);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    links.push({
      title: String((item && item.title) || '').trim().slice(0, 60) || new URL(url).hostname.replace(/^www\./, ''),
      url
    });
  }
  if (!title) return { error: 'title_required' };
  if (!links.length) return { error: 'links_required' };
  return { title, handle, bio, theme, avatar, links };
}

async function loadBio(context, slug) {
  const { env } = context;
  let record = null;
  try {
    record = await env.CACHE.get(`bio:${slug}`, 'json');
  } catch { /* cache is best-effort */ }
  if (!record) {
    try {
      const row = await env.DB.prepare(
        'SELECT slug, title, handle, bio, theme, avatar, links_json FROM bio_pages WHERE slug = ?'
      ).bind(slug).first();
      if (row) {
        let links = [];
        try { links = JSON.parse(row.links_json || '[]'); } catch { links = []; }
        record = {
          slug: row.slug,
          title: row.title,
          handle: row.handle,
          bio: row.bio || '',
          theme: row.theme || 'midnight',
          avatar: row.avatar || '✦',
          links
        };
        try {
          await env.CACHE.put(`bio:${slug}`, JSON.stringify(record), { expirationTtl: 86_400 });
        } catch { /* ignore */ }
      }
    } catch { /* fall through to not-found */ }
  }
  return record;
}

async function handleBioCreate(context, requestUrl) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip, 'bio', 6, 600_000)) return json({ error: 'rate_limited' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const page = parseBioPayload(body || {});
  if (page.error) return json({ error: page.error }, 400);

  const slug = page.handle;
  const createdAt = new Date().toISOString();
  const record = {
    slug,
    title: page.title,
    handle: page.handle,
    bio: page.bio,
    theme: page.theme,
    avatar: page.avatar,
    links: page.links
  };
  try {
    await env.DB.prepare(
      'INSERT INTO bio_pages (slug, site_id, title, handle, bio, theme, avatar, links_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(slug, SITE.id, record.title, record.handle, record.bio, record.theme, record.avatar, JSON.stringify(record.links), createdAt).run();
  } catch (err) {
    if (/UNIQUE/i.test(String(err && err.message))) {
      return json({ error: 'handle_taken', suggestion: makeHandle(`${record.handle}-${randomCode(4)}`) }, 409);
    }
    return json({ error: 'storage_failed' }, 500);
  }
  try {
    await env.CACHE.put(`bio:${slug}`, JSON.stringify(record), { expirationTtl: 86_400 });
  } catch { /* ignore */ }

  const url = `https://${requestUrl.hostname}/b/${slug}/`;
  return json({ ok: true, slug, url, shortUrl: url, page: record }, 201);
}

const BIO_PALETTES = {
  midnight: { bg: '#09090b', card: '#18181b', fg: '#fafafa', muted: '#a1a1aa', accent: '#a78bfa', border: '#3f3f46' },
  sunrise: { bg: '#1c1917', card: '#292524', fg: '#fffbeb', muted: '#d6d3d1', accent: '#fb923c', border: '#57534e' },
  mint: { bg: '#022c22', card: '#064e3b', fg: '#ecfdf5', muted: '#a7f3d0', accent: '#34d399', border: '#047857' },
  rose: { bg: '#1c0d18', card: '#3f1232', fg: '#fff1f2', muted: '#fda4af', accent: '#fb7185', border: '#9f1239' }
};

function renderBioDocument(record, host) {
  const p = BIO_PALETTES[record.theme] || BIO_PALETTES.midnight;
  const rtl = /[\u0600-\u06FF]/.test(`${record.title} ${record.bio}`);
  const links = (record.links || []).map((link, index) => `
      <a class="bio-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">
        <span class="bio-link-num">${String(index + 1).padStart(2, '0')}</span>
        <span class="bio-link-title">${esc(link.title)}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
      </a>`).join('');
  return `<!DOCTYPE html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}" data-theme="dark">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(record.title)} — ${esc(host)}</title>
<meta name="description" content="${esc(record.bio || record.title)}">
<meta name="robots" content="index, follow">
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:${p.bg};color:${p.fg};font-family:Inter,Rubik,system-ui,sans-serif;display:grid;place-items:center;padding:38px 18px 24px;position:relative;overflow-x:hidden}
  body::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(${p.border}33 1px,transparent 1px),linear-gradient(90deg,${p.border}33 1px,transparent 1px);background-size:42px 42px;mask-image:radial-gradient(ellipse 70% 50% at 50% 0%,#000,transparent 75%)}
  main{width:min(440px,100%);position:relative}
  .card{border:1px solid ${p.border};background:${p.card};border-radius:22px;padding:32px 26px 24px;box-shadow:0 30px 90px -50px #000}
  .top{text-align:center}
  .avatar{width:66px;height:66px;margin:0 auto 16px;border-radius:20px;display:grid;place-items:center;background:${p.accent};color:${p.bg};font-size:24px;font-weight:700;line-height:1}
  h1{font-size:1.55rem;margin:0 0 4px;letter-spacing:-.02em}
  .handle{font:12px/1.5 ui-monospace,monospace;color:${p.accent};margin:0 0 12px}
  .bio{color:${p.muted};font-size:14px;line-height:1.75;margin:0 0 26px;white-space:pre-line}
  .links{display:grid;gap:10px}
  .bio-link{display:flex;align-items:center;gap:12px;padding:14px 15px;border:1px solid ${p.border};border-radius:12px;color:${p.fg};text-decoration:none;background:${p.bg}66;transition:transform .18s ease,border-color .18s ease,background .18s ease}
  .bio-link:hover{transform:translateY(-2px);border-color:${p.accent};background:${p.bg}}
  .bio-link-num{font:11px ui-monospace,monospace;color:${p.muted}}
  .bio-link-title{flex:1;font-weight:500;font-size:14px}
  .foot{text-align:center;margin-top:22px;color:${p.muted};font:11px ui-monospace,monospace}
  .foot a{color:${p.accent};text-decoration:none}
</style>
</head>
<body>
<main>
  <div class="card">
    <div class="top">
      <div class="avatar">${esc(record.avatar)}</div>
      <h1>${esc(record.title)}</h1>
      <p class="handle">@${esc(record.handle)}</p>
      <p class="bio">${esc(record.bio || (rtl ? 'كل روابطي في مكان واحد.' : 'All my links in one place.'))}</p>
    </div>
    <div class="links">${links}</div>
  </div>
  <div class="foot">${rtl ? 'صفحة روابط عبر' : 'A link page on'} <a href="/">${esc(host)}</a> · comm.ly network</div>
</main>
</body></html>`;
}

async function handleBioRead(context, slug, asJson) {
  const record = await loadBio(context, slug);
  if (!record) {
    if (asJson) return json({ error: 'not_found' }, 404);
    return new Response('<!doctype html><meta charset="utf-8"><title>404</title><body style="background:#09090b;color:#fafafa;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><div><h1>404</h1><p>This page does not exist.</p><a style="color:#a78bfa" href="/">Home</a></div></body>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS }
    });
  }
  try {
    context.waitUntil(context.env.DB.prepare('UPDATE bio_pages SET views = views + 1 WHERE slug = ?').bind(slug).run());
  } catch { /* analytics must never break a bio page */ }
  if (asJson) return json({ ok: true, page: record });
  const host = new URL(context.request.url).hostname;
  return new Response(renderBioDocument(record, host), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60', ...SECURITY_HEADERS }
  });
}

export async function handle(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === '/api/health') return json({ ok: true, site: SITE.id, host: url.hostname });
  if (pathname === '/api/shorten' && request.method === 'POST') return shorten(context, url);
  if (pathname === '/api/shorten/bulk' && request.method === 'POST') return bulkShorten(context, url);
  if (pathname === '/api/contact' && request.method === 'POST') return contact(context, url);
  if (pathname === '/api/lookup') return handleLookup(context);
  if (pathname === '/api/bio' && request.method === 'POST') return handleBioCreate(context, url);
  const bioApiMatch = BIO_API_RE.exec(pathname);
  if (bioApiMatch && request.method === 'GET') return handleBioRead(context, bioApiMatch[1], true);
  const bioMatch = BIO_PATH_RE.exec(pathname);
  if (bioMatch && (request.method === 'GET' || request.method === 'HEAD')) return handleBioRead(context, bioMatch[1], false);
  if (pathname === '/api/stats') return handleStatsRoute(context);
  if (pathname === '/api/billing/webhook' && request.method === 'POST') return billingWebhook(context);

  if (pathname.startsWith('/api/')) {
    const authResponse = await handleAuthRoute(context, pathname);
    if (authResponse) return authResponse;
    if (pathname === '/api/links' || pathname.startsWith('/api/links/')) {
      return handleLinksRoute(context, pathname);
    }
    return json({ error: 'not_found' }, 404);
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const match = CODE_PATH_RE.exec(pathname);
    if (match) {
      const code = match[1];
      if (!RESERVED.has(code.toLowerCase())) return resolve(context, code, url);
    }
  }

  return next();
}

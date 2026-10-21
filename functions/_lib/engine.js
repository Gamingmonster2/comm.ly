/**
 * Comly Network — shared shortening engine (Cloudflare Pages Functions)
 * Bound resources (configure per Pages project):
 *   DB    → D1 database (shared across all network domains)
 *   CACHE → KV namespace (redirect cache)
 *
 * Each deployment gets a generated `_lib/site-config.js` from the build.
 */
import { SITE } from './site-config.js';
import { handleAuthRoute, handleLinksRoute, handleLookup } from './links.js';

const RESERVED = new Set([
  'api', 'assets', 'en', 'ar', 'app', 'admin', 'login', 'register', 'privacy', 'terms', 'contact',
  'network', 'pricing', 'about', 'blog', 'docs', 'faq', 'u', 'sitemap.xml',
  'robots.txt', 'favicon.ico', 'index.html', '404.html', '410.html',
  '_headers', '_routes.json'
]);
const SLUG_RE = /^[A-Za-z0-9_-]{3,24}$/;
const CODE_PATH_RE = /^\/([A-Za-z0-9_-]{2,32})\/?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

/* Per-isolate burst limiter (cheap first line of defence). */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const bucket = hits.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  hits.set(ip, bucket);
  if (hits.size > 5_000) hits.clear();
  return bucket.count > 30;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }
  });
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

function validateUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
    if (/^(127\.|10\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host)) return null;
    if (host === '::1' || host.startsWith('[')) return null;
    /* Block shortening our own network domains (redirect loops). */
    if (SITE.network.some((entry) => host === entry.host)) return null;
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

async function shorten(context, requestUrl) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

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
  const ttl = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 365) : 0;
  const createdAt = new Date().toISOString();
  const expiresAt = ttl ? new Date(Date.now() + ttl * 3_600_000).toISOString() : null;

  for (let attempt = 0; attempt < (slug ? 1 : 4); attempt += 1) {
    const code = slug || randomCode();
    try {
      await env.DB.prepare(
        'INSERT INTO links (code, url, site_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(code, target, SITE.id, expiresAt, createdAt).run();
      try {
        await env.CACHE.put(`l:${code}`, JSON.stringify({ u: target, e: expiresAt, a: 1 }), {
          expirationTtl: ttl ? Math.min(ttl * 3600, 2_592_000) : 604_800
        });
      } catch { /* cache is best-effort */ }
      return json({
        shortUrl: `https://${requestUrl.hostname}/${code}`,
        code,
        expiresAt,
        network: SITE.network.map((entry) => entry.host)
      }, 201);
    } catch (err) {
      if (slug) return json({ error: 'slug_taken' }, 409);
    }
  }
  return json({ error: 'could_not_create' }, 500);
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
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

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

export async function handle(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === '/api/health') return json({ ok: true, site: SITE.id, host: url.hostname });
  if (pathname === '/api/shorten' && request.method === 'POST') return shorten(context, url);
  if (pathname === '/api/contact' && request.method === 'POST') return contact(context, url);
  if (pathname === '/api/lookup') return handleLookup(context);
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

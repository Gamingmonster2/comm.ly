/**
 * Account & link-management API handlers (auth required).
 * Plans are enforced here; links are owned by a workspace.
 */
import { getSessionUser, sameOrigin } from './auth.js';
import { NETWORK } from './site-config.js';

export const PLAN_LIMITS = {
  free: { linksPerMonth: 200, trackedClicks: 10_000, domains: 0 },
  pro: { linksPerMonth: 10_000, trackedClicks: 100_000, domains: 3 },
  business: { linksPerMonth: 100_000, trackedClicks: 500_000, domains: 10 },
  agency: { linksPerMonth: 1_000_000, trackedClicks: 2_000_000, domains: 100 },
  enterprise: { linksPerMonth: Infinity, trackedClicks: Infinity, domains: Infinity }
};

const SLUG_RE = /^[A-Za-z0-9_-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESERVED = new Set([
  'api', 'assets', 'en', 'ar', 'app', 'admin', 'login', 'register', 'pricing',
  'privacy', 'terms', 'contact', 'network', 'about', 'docs', 'faq', 'u',
  'sitemap.xml', 'robots.txt', 'favicon.ico', 'index.html', '404.html', '410.html'
]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extraHeaders }
  });
}

export function planFor(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

function validateUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
    if (/^(127\.|10\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host)) return null;
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

export function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

export async function monthlyLinkCount(env, workspaceId) {
  const start = `${monthKey()}-01T00:00:00.000Z`;
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM links WHERE workspace_id = ? AND created_at >= ?'
  ).bind(workspaceId, start).first();
  return (row && row.total) || 0;
}

export async function listLinks(env, user, { limit = 100 } = {}) {
  const rows = await env.DB.prepare(
    `SELECT code, url, created_at, expires_at, active, clicks
     FROM links WHERE workspace_id = ? ORDER BY id DESC LIMIT ?`
  ).bind(user.workspaceId, Math.min(Number(limit) || 100, 200)).all();
  return (rows.results || []).map((row) => ({
    code: row.code,
    shortUrl: `https://${user.host || 'comm.ly'}/${row.code}`,
    url: row.url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    active: Boolean(row.active),
    clicks: row.clicks
  }));
}

export async function handleAuthRoute(context, pathname) {
  const { request, env } = context;
  const method = request.method;
  const body = async () => {
    try {
      return await request.json();
    } catch {
      return {};
    }
  };

  /* ---- register ---- */
  if (pathname === '/api/auth/register' && method === 'POST') {
    if (!sameOrigin(request)) return json({ error: 'bad_origin' }, 403);
    const data = await body();
    const name = String(data.name || '').trim().slice(0, 80);
    const email = String(data.email || '').trim().toLowerCase().slice(0, 120);
    const password = String(data.password || '');
    if (!EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400);
    if (password.length < 8) return json({ error: 'weak_password' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'email_taken' }, 409);

    const { hashPassword, createSession, sessionCookie } = await import('./auth.js');
    const hash = await hashPassword(password);
    const userRow = await env.DB.prepare(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id'
    ).bind(email, hash, name || email.split('@')[0]).first();
    const userId = userRow.id;
    const workspace = await env.DB.prepare(
      'INSERT INTO workspaces (owner_id, name) VALUES (?, ?) RETURNING id'
    ).bind(userId, name ? `${name}'s workspace` : 'My workspace').first();
    const sessionId = await createSession(env, request, userId);
    return json({ ok: true, user: { id: userId, email, name }, workspaceId: workspace.id }, 201, {
      'Set-Cookie': sessionCookie(sessionId)
    });
  }

  /* ---- login ---- */
  if (pathname === '/api/auth/login' && method === 'POST') {
    if (!sameOrigin(request)) return json({ error: 'bad_origin' }, 403);
    const data = await body();
    const email = String(data.email || '').trim().toLowerCase().slice(0, 120);
    const password = String(data.password || '');
    const row = await env.DB.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').bind(email).first();
    const { verifyPassword, createSession, sessionCookie } = await import('./auth.js');
    if (!row || !(await verifyPassword(password, row.password_hash))) return json({ error: 'invalid_credentials' }, 401);
    const sessionId = await createSession(env, request, row.id);
    return json({ ok: true, user: { id: row.id, email: row.email, name: row.name } }, 200, {
      'Set-Cookie': sessionCookie(sessionId)
    });
  }

  /* ---- logout ---- */
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const { destroySession, clearedSessionCookie } = await import('./auth.js');
    await destroySession(env, request);
    return json({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie() });
  }

  /* ---- me ---- */
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = await getSessionUser(env, request);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const used = user.workspaceId ? await monthlyLinkCount(env, user.workspaceId) : 0;
    return json({ user, plan: planFor(user.plan), usage: { linksThisMonth: used, month: monthKey() } });
  }

  return null;
}

export async function handleLinksRoute(context, pathname) {
  const { request, env } = context;
  const method = request.method;
  const user = await getSessionUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!user.workspaceId) return json({ error: 'no_workspace' }, 409);

  const host = request.headers.get('host') || 'comm.ly';

  /* list */
  if (pathname === '/api/links' && method === 'GET') {
    const links = await listLinks(env, user);
    const used = await monthlyLinkCount(env, user.workspaceId);
    return json({ links: links.map((link) => ({ ...link, shortUrl: `https://${host}/${link.code}` })), usage: { linksThisMonth: used }, plan: planFor(user.plan) });
  }

  /* create */
  if (pathname === '/api/links' && method === 'POST') {
    if (!sameOrigin(request)) return json({ error: 'bad_origin' }, 403);
    let data = {};
    try {
      data = await request.json();
    } catch { /* ignore */ }

    const target = validateUrl(String(data.url || ''));
    if (!target) return json({ error: 'invalid_url' }, 400);

    const limit = planFor(user.plan).linksPerMonth;
    const used = await monthlyLinkCount(env, user.workspaceId);
    if (used >= limit) return json({ error: 'plan_limit', limit, used }, 402);

    let slug = data.slug ? String(data.slug).trim() : '';
    if (slug && !SLUG_RE.test(slug)) return json({ error: 'invalid_slug' }, 400);
    if (slug && RESERVED.has(slug.toLowerCase())) return json({ error: 'slug_reserved' }, 409);

    const hours = data.expiresIn === undefined ? 0 : Number(data.expiresIn);
    const ttl = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 365) : 0;
    const createdAt = new Date().toISOString();
    const expiresAt = ttl ? new Date(Date.now() + ttl * 3_600_000).toISOString() : null;

    for (let attempt = 0; attempt < (slug ? 1 : 4); attempt += 1) {
      const code = slug || randomCode();
      try {
        await env.DB.prepare(
          'INSERT INTO links (code, url, site_id, workspace_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(code, target, 'commly', user.workspaceId, expiresAt, createdAt).run();
        try {
          await env.CACHE.put(`l:${code}`, JSON.stringify({ u: target, e: expiresAt, a: 1 }), {
            expirationTtl: ttl ? Math.min(ttl * 3600, 2_592_000) : 604_800
          });
        } catch { /* ignore */ }
        return json({ ok: true, link: { code, shortUrl: `https://${host}/${code}`, url: target, createdAt, expiresAt, clicks: 0 } }, 201);
      } catch {
        if (slug) return json({ error: 'slug_taken' }, 409);
      }
    }
    return json({ error: 'could_not_create' }, 500);
  }

  /* item routes */
  const item = /^\/api\/links\/([A-Za-z0-9_-]{2,32})$/.exec(pathname);
  if (item) {
    const code = item[1];
    const row = await env.DB.prepare(
      'SELECT id, code, url, expires_at, active, clicks FROM links WHERE code = ? AND workspace_id = ?'
    ).bind(code, user.workspaceId).first();
    if (!row) return json({ error: 'not_found' }, 404);

    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(row.id).run();
      try { await env.CACHE.delete(`l:${code}`); } catch { /* ignore */ }
      return json({ ok: true });
    }

    if (method === 'PATCH') {
      if (!sameOrigin(request)) return json({ error: 'bad_origin' }, 403);
      let data = {};
      try { data = await request.json(); } catch { /* ignore */ }
      const active = data.active === undefined ? row.active : data.active ? 1 : 0;
      await env.DB.prepare('UPDATE links SET active = ? WHERE id = ?').bind(active, row.id).run();
      try { await env.CACHE.delete(`l:${code}`); } catch { /* ignore */ }
      return json({ ok: true, active: Boolean(active) });
    }

    if (method === 'GET' && pathname.endsWith('/stats') === false) {
      const stats = await env.DB.prepare(
        'SELECT day, host, clicks, country FROM daily_stats WHERE code = ? ORDER BY day DESC LIMIT 60'
      ).bind(code).all();
      return json({ code, clicks: row.clicks, rows: stats.results || [] });
    }
  }

  return json({ error: 'not_found' }, 404);
}

export async function handleLookup(context) {
  const { request, env } = context;
  const target = new URL(request.url).searchParams.get('url') || '';
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: 'invalid_url' }, 400);
  }
  const knownHost = NETWORK.some((entry) => entry.host === parsed.hostname);
  if (!knownHost) return json({ error: 'unsupported_host', note: 'Only comm.ly network links can be expanded.' }, 400);
  const code = parsed.pathname.replace(/^\/|\/$/g, '');
  if (!code || code.includes('/')) return json({ found: false, note: 'not a short link' }, 404);
  let record = null;
  try {
    record = await env.CACHE.get(`l:${code}`, 'json');
  } catch { /* ignore */ }
  if (!record) {
    const row = await env.DB.prepare('SELECT url, expires_at, active, clicks FROM links WHERE code = ?').bind(code).first();
    if (!row) return json({ found: false, code }, 404);
    record = { u: row.url, e: row.expires_at, a: row.active };
  }
  const expired = record.e ? Date.parse(record.e) < Date.now() : false;
  return json({
    found: true,
    code,
    destination: record.u,
    expiresAt: record.e || null,
    expired,
    active: record.a !== 0,
    safeProtocol: /^https?:\/\//i.test(record.u),
    host: parsed.hostname
  });
}

export async function handleStatsRoute(context) {
  const { env, request } = context;
  const user = await getSessionUser(env, request);
  if (!user || !user.workspaceId) return json({ error: 'unauthorized' }, 401);

  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    days.push(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  }

  const rows = await env.DB.prepare(
    `SELECT day, SUM(clicks) AS clicks FROM daily_stats
     WHERE code IN (SELECT code FROM links WHERE workspace_id = ?) AND day >= ?
     GROUP BY day ORDER BY day`
  ).bind(user.workspaceId, days[0]).all();

  const byDay = {};
  for (const row of rows.results || []) byDay[row.day] = row.clicks || 0;

  const totals = await env.DB.prepare(
    'SELECT COUNT(*) AS links, COALESCE(SUM(clicks), 0) AS clicks FROM links WHERE workspace_id = ?'
  ).bind(user.workspaceId).first();

  return json({
    days: days.map((day) => ({ day, clicks: byDay[day] || 0 })),
    totals: { links: (totals && totals.links) || 0, clicks: (totals && totals.clicks) || 0 }
  });
}

/**
 * Local preview for the real build (static + in-memory mock of the API).
 * Usage: node scripts/serve.mjs [siteId] [port]
 * Example: node scripts/serve.mjs commly 4174
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sites } from '../sites/registry.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const siteId = process.argv[2] || 'commly';
const port = Number(process.argv[3] || 4174);
const site = sites.find((entry) => entry.id === siteId);

if (!site) {
  console.error(`Unknown site "${siteId}". Available: ${sites.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

const ROOT = path.join(root, 'dist', site.id);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

const links = new Map();
const bioPages = new Map();

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function makeCode(length = 7) {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...randomBytes(length)].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 20_000) reject(new Error('too-large'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function validateUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function code() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(7);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/health') return json(res, 200, { ok: true, site: site.id, mode: 'local-preview' });

  if (pathname === '/api/shorten' && req.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { error: 'invalid_json' });
    }
    const target = validateUrl(String(payload.url || ''));
    if (!target) return json(res, 400, { error: 'invalid_url' });
    const hours = payload.expiresIn === undefined ? 24 : Number(payload.expiresIn);
    const ttl = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 365) : 0;
    const slug = payload.slug ? String(payload.slug).trim() : '';
    if (slug && !/^[A-Za-z0-9_-]{3,24}$/.test(slug)) return json(res, 400, { error: 'invalid_slug' });
    if (slug && links.has(slug)) return json(res, 409, { error: 'slug_taken' });
    const key = slug || code();
    const expiresAt = ttl ? new Date(Date.now() + ttl * 3_600_000).toISOString() : null;
    links.set(key, { url: target, expiresAt });
    return json(res, 201, {
      shortUrl: `http://${req.headers.host}/${key}`,
      code: key,
      expiresAt,
      network: site.host === 'comm.ly' ? sites.filter((s) => s.role === 'engine').map((s) => s.host) : []
    });
  }

  if (pathname === '/api/contact' && req.method === 'POST') {
    try {
      const payload = JSON.parse(await readBody(req));
      if (!payload.name || !payload.email || !payload.message) return json(res, 400, { error: 'invalid_input' });
      return json(res, 200, { ok: true });
    } catch {
      return json(res, 400, { error: 'invalid_json' });
    }
  }

  if (pathname === '/api/shorten/bulk' && req.method === 'POST') {
    let payload;
    try { payload = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const urls = Array.isArray(payload.urls) ? payload.urls.slice(0, 100) : [];
    if (!urls.length) return json(res, 400, { error: 'invalid_urls' });
    const hours = payload.expiresIn === undefined ? 0 : Number(payload.expiresIn);
    const ttl = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 365) : 0;
    const results = [];
    for (let i = 0; i < urls.length; i += 1) {
      const url = validateUrl(String(urls[i] || ''));
      if (!url) { results.push({ index: i, url: urls[i], ok: false, error: 'invalid_url' }); continue; }
      const key = makeCode();
      const expiresAt = ttl ? new Date(Date.now() + ttl * 3_600_000).toISOString() : null;
      links.set(key, { url, expiresAt });
      results.push({ index: i, url: urls[i], ok: true, shortUrl: `http://${req.headers.host}/${key}`, code: key, expiresAt });
    }
    const created = results.filter((row) => row.ok).length;
    return json(res, 200, { results, created, failed: results.length - created });
  }

  if (pathname === '/api/lookup' && req.method === 'GET') {
    const target = url.searchParams.get('url') || '';
    let parsed;
    try { parsed = new URL(target); } catch { return json(res, 400, { error: 'invalid_url' }); }
    const knownHost = sites.some((entry) => entry.host === parsed.hostname) || parsed.hostname === req.headers.host?.split(':')[0];
    const code = parsed.pathname.replace(/^\/|\/$/g, '');
    const record = knownHost && links.get(code);
    if (record) {
      const expired = Boolean(record.expiresAt && Date.parse(record.expiresAt) < Date.now());
      return json(res, 200, { found: true, external: false, source: 'network', code, destination: record.url, host: parsed.hostname, expiresAt: record.expiresAt, expired, active: true, safeProtocol: !expired, https: record.url.startsWith('https:'), knownShortener: false, signals: { https: record.url.startsWith('https:'), network: true, active: true, expired, knownShortener: false } });
    }
    const knownShortener = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|buff\.ly|rebrand\.ly|cutt\.ly|rb\.gy|short\.link|clck\.ru|v\.gd|lnkd\.in|s\.id)$/i.test(parsed.hostname);
    return json(res, 200, { found: true, external: true, source: 'external', destination: parsed.toString(), host: parsed.hostname, code: code || null, expiresAt: null, expired: false, active: true, https: parsed.protocol === 'https:', safeProtocol: parsed.protocol === 'https:', knownShortener, signals: { https: parsed.protocol === 'https:', network: knownHost, active: true, expired: false, knownShortener } });
  }

  if (pathname === '/api/bio' && req.method === 'POST') {
    let payload;
    try { payload = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'invalid_json' }); }
    const title = String(payload.title || '').trim().slice(0, 60);
    const rawHandle = String(payload.handle || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
    const handle = rawHandle.length >= 3 ? rawHandle : `page-${makeCode(6).toLowerCase()}`;
    const linksIn = Array.isArray(payload.links) ? payload.links.slice(0, 12) : [];
    const cleaned = linksIn.filter((item) => validateUrl(String(item?.url || ''))).map((item) => ({ title: String(item.title || '').slice(0, 60), url: validateUrl(String(item.url)) }));
    if (!title || !cleaned.length) return json(res, 400, { error: 'invalid_input' });
    if (bioPages.has(handle)) return json(res, 409, { error: 'handle_taken', suggestion: `${handle}-${makeCode(4).toLowerCase()}` });
    const page = { slug: handle, title, handle, bio: String(payload.bio || '').slice(0, 160), theme: payload.theme || 'midnight', avatar: String(payload.avatar || '').slice(0, 3), links: cleaned };
    bioPages.set(handle, page);
    return json(res, 201, { ok: true, slug: handle, url: `http://${req.headers.host}/b/${handle}/`, shortUrl: `http://${req.headers.host}/b/${handle}/`, page });
  }

  const bioMatch = /^\/b\/([A-Za-z0-9_-]{3,32})\/?$/.exec(pathname);
  if (bioMatch && req.method === 'GET') {
    const page = bioPages.get(bioMatch[1]);
    if (!page) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!doctype html><meta charset="utf-8"><title>404</title><body style="background:#09090b;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><h1>404</h1></body>');
    }
    const rows = page.links.map((link) => `<a href="${esc(link.url)}" style="display:block;padding:14px;border:1px solid #3f3f46;border-radius:12px;color:#fafafa;text-decoration:none;margin-bottom:10px">${esc(link.title)}</a>`).join('');
    const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title><style>body{background:${page.theme === 'mint' ? '#022c22' : page.theme === 'rose' ? '#1c0d18' : '#09090b'};color:#fafafa;font-family:system-ui;display:grid;place-items:center;min-height:100vh;padding:24px}main{width:min(420px,100%)}h1{text-align:center}</style></head><body><main><h1>${esc(page.title)}</h1><p style="text-align:center;color:#a1a1aa">@${esc(page.handle)}</p>${rows}</main></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(body);
  }

  if (req.method === 'GET') {
    const match = /^\/([A-Za-z0-9_-]{2,32})\/?$/.exec(pathname);
    if (match && links.has(match[1])) {
      const record = links.get(match[1]);
      if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
        links.delete(match[1]);
        res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><meta charset="utf-8"><title>Expired</title><body style="background:#05060a;color:#eef1f6;font-family:system-ui;display:grid;place-items:center;min-height:100vh;text-align:center"><h1>انتهت الصلاحية</h1><a href="/" style="color:#2dd4bf">Back home</a></body>');
      }
      res.writeHead(302, { Location: record.url });
      return res.end();
    }
  }

  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch {
    try {
      const body = await readFile(path.join(ROOT, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Preview: ${site.host} → http://127.0.0.1:${port}`);
  console.log(`(static build + mock API; for real bindings use: wrangler pages dev dist/${site.id})`);
});

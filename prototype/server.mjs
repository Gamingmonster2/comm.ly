/**
 * Comly Network — local preview server (prototype only)
 * Serves the static prototype + an in-memory implementation of
 * the real Cloudflare Pages Functions API, so the UI can be tested
 * end-to-end (shorten → copy → redirect) before deploying.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const HOSTNAME = process.env.HOST || '127.0.0.1';

const NETWORK = ['4.com.ly', '6.com.ly', '7.com.ly', '8.com.ly', '9.com.ly'];
const RESERVED = new Set([
  'api', 'assets', 'dashboard', 'dashboard.html', 'admin', 'ar', 'en',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'index.html'
]);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

/** @type {Map<string, {url:string, createdAt:number, expiresAt:number|null, clicks:number}>} */
const links = new Map();
const stats = { created: 0, clicks: 0 };
const rate = new Map();

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

function readBody(req, limit = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('payload-too-large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function validateUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.hostname === 'localhost') return null;
    if (/^(127\.|10\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function base62(length = 7) {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function clientIp(req) {
  return (req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'local').toString();
}

function rateLimited(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = rate.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  rate.set(ip, bucket);
  return bucket.count > 60;
}

async function serveStatic(req, res, pathname) {
  let filePath = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (!filePath.startsWith(ROOT)) return false;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    return false;
  }
  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

function notFoundPage(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>غير موجود — 3.com.ly</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05060a;color:#eef1f6;font-family:system-ui,sans-serif;text-align:center}
h1{font-size:4rem;margin:0;background:linear-gradient(96deg,#2dd4bf,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent}
p{color:#9aa4b8;max-width:420px;margin:14px auto 26px}
a{display:inline-block;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,#2dd4bf,#7c5cff);color:#041210;text-decoration:none;font-weight:700}</style>
</head><body><main><h1>404</h1><p>هذا الرابط غير موجود أو انتهت صلاحيته. / This link does not exist or has expired.</p>
<a href="/">العودة للرئيسية — Back home</a></main></body></html>`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  /* ---------- API ---------- */
  if (pathname === '/api/health') {
    return json(res, 200, { ok: true, platform: 'local-preview', links: links.size, stats });
  }

  if (pathname === '/api/shorten' && req.method === 'POST') {
    if (rateLimited(req)) return json(res, 429, { error: 'rate-limited' });
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { error: 'invalid-json' });
    }
    const longUrl = validateUrl(String(payload.url || ''));
    if (!longUrl) return json(res, 400, { error: 'invalid-url' });

    let slug = payload.slug ? String(payload.slug).trim() : '';
    if (slug && !/^[A-Za-z0-9_-]{3,24}$/.test(slug)) return json(res, 400, { error: 'invalid-slug' });
    if (slug && (RESERVED.has(slug.toLowerCase()) || links.has(slug))) {
      return json(res, 409, { error: 'slug-taken' });
    }

    const code = slug || base62();
    const hours = payload.expiresIn === undefined ? 24 : Number(payload.expiresIn);
    const ttl = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 365) : 0;
    const expiresAt = ttl ? Date.now() + ttl * 3_600_000 : null;

    links.set(code, { url: longUrl, createdAt: Date.now(), expiresAt, clicks: 0 });
    stats.created += 1;

    return json(res, 201, {
      shortUrl: `http://${req.headers.host}/${code}`,
      code,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      network: NETWORK
    });
  }

  /* ---------- Short link redirect ---------- */
  if (req.method === 'GET' || req.method === 'HEAD') {
    const code = decodeURIComponent(pathname.replace(/^\/+/, ''));
    if (code && !code.includes('/') && links.has(code)) {
      const link = links.get(code);
      if (link.expiresAt && Date.now() > link.expiresAt) {
        links.delete(code);
        res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><meta charset="utf-8"><title>Expired</title><body style="background:#05060a;color:#eef1f6;font-family:system-ui;display:grid;place-items:center;min-height:100vh;text-align:center"><div><h1 style="font-size:2.5rem;margin:0">انتهت الصلاحية</h1><p style="color:#9aa4b8">This link has expired (24h demo TTL).</p><a href="/" style="color:#2dd4bf">Back home</a></div></body>');
      }
      link.clicks += 1;
      stats.clicks += 1;
      res.writeHead(302, { Location: link.url, 'Cache-Control': 'no-store' });
      return res.end();
    }
  }

  /* ---------- Static ---------- */
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    if (await serveStatic(req, res, '/dashboard.html')) return;
  }

  if (pathname.startsWith('/api/')) return json(res, 404, { error: 'not-found' });

  if (await serveStatic(req, res, pathname === '/' ? '/index.html' : pathname)) return;
  return notFoundPage(res);
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`Comly Network preview → http://${HOSTNAME}:${PORT}`);
  console.log(`Dashboard preview      → http://${HOSTNAME}:${PORT}/dashboard`);
});

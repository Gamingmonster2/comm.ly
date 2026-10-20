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

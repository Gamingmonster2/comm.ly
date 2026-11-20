#!/usr/bin/env node
/** Local server: writes the requested DNS file straight to the Windows Desktop. */
import http from 'node:http';
import { readFile, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 4191);
const file = path.join(dir, 'download.html');
const DESKTOP = process.env.COMMLY_DESKTOP || path.join(os.homedir(), 'Desktop');

const ALLOWED = new Set([
  'comm.ly.txt', '3.com.ly.txt', '4.com.ly.txt',
  '6.com.ly.txt', '7.com.ly.txt', '8.com.ly.txt', '9.com.ly.txt'
]);

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname.startsWith('/download/')) {
      const name = decodeURIComponent(url.pathname.slice('/download/'.length));
      if (!ALLOWED.has(name)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Unknown DNS file');
        return;
      }
      try {
        const target = path.join(DESKTOP, name);
        await copyFile(path.join(dir, name), target);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<title>تم التنزيل</title>
<body style="background:#08080a;color:#fafafa;font-family:system-ui;text-align:center;padding:60px">
<div style="max-width:520px;margin:auto;border:1px solid #27272a;border-radius:18px;padding:28px">
<div style="color:#4ade80;font-size:34px">✓</div>
<h1 style="font-size:1.4rem">تم وضع الملف على سطح المكتب</h1>
<p dir="ltr" style="color:#22d3ee;font-family:monospace">${name}</p>
<p style="color:#a1a1aa;font-size:13px;line-height:1.9">افتح سطح المكتب، خذ الملف وارفعه في كلاودفلير عبر Import DNS records، ثم احذفه بعد الانتهاء.</p>
<a href="/" style="color:#a78bfa">العودة إلى الصندوق ←</a>
</div><script>setTimeout(()=>location.href='/',2500)</script></body></html>`);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('WRITE_FAILED: ' + String(err));
      }
      return;
    }

    try {
      const html = await readFile(file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err));
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`DNS downloader: http://127.0.0.1:${port}/  -> Desktop: ${DESKTOP}`);
  });

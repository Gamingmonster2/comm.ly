#!/usr/bin/env node
/** Tiny local server for the one-click DNS file downloader. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 4191);
const file = path.join(dir, 'download.html');

http
  .createServer(async (req, res) => {
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
    console.log(`DNS downloader: http://127.0.0.1:${port}/`);
  });

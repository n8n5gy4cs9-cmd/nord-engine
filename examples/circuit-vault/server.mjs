import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { newRun, publicRun, step } from './rules.mjs';
export function createVaultServer({ root = path.dirname(fileURLToPath(import.meta.url)), random = Math.random, clock = Date.now } = {}) {
  const runs = new Map(), board = [];
  return http.createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });res.end(JSON.stringify(value)); };
    // Allow Nord's loopback preview to call this local teaching server.
    const origin = req.headers.origin;
    if (origin) {
      try { const u = new URL(origin); if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(u.hostname)) return reply(403, { error: 'Use a local HTTP preview' }); }
      catch { return reply(403, { error: 'Invalid origin' }); }
      res.setHeader('access-control-allow-origin', origin);res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'content-type');res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204);res.end();return; }
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/board') return reply(200, { board });
      if (req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Send JSON' });
        let text = '';
        for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 2048) return reply(413, { error: 'Body too large' }); }
        let body; try { body = JSON.parse(text); } catch { return reply(400, { error: 'Invalid JSON' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Send an object' });
        if (url.pathname === '/api/start') {
          for (const [id, r] of runs) if (clock() - r.created > 30 * 60 * 1000) runs.delete(id);
          if (runs.size >= 500) return reply(429, { error: 'Server is full; try later' });
          const id = randomUUID(), run = newRun(random, clock());
          run.created = clock(); run.name = String(body.name ?? 'Pilot').trim().slice(0, 20) || 'Pilot';
          runs.set(id, run); return reply(200, { id, run: publicRun(run) });
        }
        if (url.pathname === '/api/step') {
          const run = runs.get(body.id);
          if (!run) return reply(404, { error: 'Run expired; start again' });
          if (!Number.isInteger(body.tile) || body.tile < 0 || body.tile > 3) return reply(400, { error: 'Tile must be 0–3' });
          const wasDone = run.done, result = step(run, body.tile, clock());
          if (!wasDone && run.won) { board.push({ name: run.name, score: run.score });board.sort((a,b) => b.score-a.score);board.length = Math.min(10, board.length); }
          return reply(200, { run: result });
        }
      }
      // Only client files are public; server source and arbitrary paths are not served.
      const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
      const file = files[url.pathname];
      if (req.method !== 'GET' || !file) return reply(404, { error: 'Not found' });
      const bytes = await fs.readFile(path.join(root, file[0]));
      res.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' });res.end(bytes);
    } catch { if (!res.headersSent) reply(500, { error: 'Server could not handle the request' });else res.end(); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootIndex = process.argv.indexOf('--root');
  const root = rootIndex >= 0 ? path.resolve(process.argv[rootIndex + 1]) : undefined;
  const port = Number(process.env.PORT || 4381);
  createVaultServer({ root }).listen(port, '127.0.0.1', () => console.log(`Circuit Vault: http://127.0.0.1:${port}`));
}

// Small HTTP transport shared by the teaching servers. No npm packages.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
export function serve({
  root,
  files,
  api,
  tick,
  port = 4382,
  host = process.env.HOST || '127.0.0.1',
}) {
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(data));
    };
    const origin = req.headers.origin;
    if (origin) {
      try {
        const u = new URL(origin);
        if (u.protocol !== 'http:' && u.protocol !== 'https:')
          return json(403, { error: 'HTTP origin required' });
        if (
          u.host !== req.headers.host &&
          !['localhost', '127.0.0.1'].includes(u.hostname)
        )
          return json(403, { error: 'Open the game from this server' });
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
        res.setHeader('access-control-allow-headers', 'content-type');
        res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      } catch {
        return json(403, { error: 'Invalid origin' });
      }
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        let body = {};
        if (req.method === 'POST') {
          if (!req.headers['content-type']?.startsWith('application/json'))
            return json(415, { error: 'Send JSON' });
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (Buffer.byteLength(raw) > 2048) return json(413, { error: 'Too large' });
          }
          try {
            body = JSON.parse(raw);
          } catch {
            return json(400, { error: 'Invalid JSON' });
          }
          if (!body || typeof body !== 'object' || Array.isArray(body))
            return json(400, { error: 'Send an object' });
        } else if (req.method !== 'GET')
          return json(405, { error: 'GET or POST required' });
        const result = api(req.method, url, body);
        return json(result.status ?? 200, result.data ?? result);
      }
      const name = files[url.pathname];
      if (req.method !== 'GET' || !name) return json(404, { error: 'Not found' });
      const mime =
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.mjs': 'text/javascript',
          '.css': 'text/css',
          '.md': 'text/plain',
        }[path.extname(name)] || 'application/octet-stream';
      const bytes = await fs.readFile(path.join(root, name));
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
      res.end(bytes);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) json(500, { error: 'Server error' });
      else res.end();
    }
  });
  const interval = setInterval(() => tick(0.05), 50);
  server.on('close', () => clearInterval(interval));
  if (port !== null)
    server.listen(port, host, () =>
      console.log(
        `Open http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port} (HOST=${host})`,
      ),
    );
  return server;
}
export const failure = (status, error) => ({ status, data: { error } });
export const roomCode = (value) =>
  String(value ?? 'NORD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'NORD';

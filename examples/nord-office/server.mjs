import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, failure, roomCode } from './server-kit.mjs';
import {
  newOffice,
  addPlayer,
  startShift,
  tickOffice,
  beginJob,
  jobStep,
  prank,
  cancelJob,
  publicOffice,
} from './rules.js';
export function createOfficeServer({
  port = null,
  host,
  root = path.dirname(fileURLToPath(import.meta.url)),
  clock = Date.now,
} = {}) {
  const rooms = new Map(),
    sessions = new Map();
  const api = (method, url, b) => {
    if (method === 'POST' && url.pathname === '/api/join') {
      if (sessions.size >= 96) return failure(429, 'Server full');
      const code = roomCode(b.room);
      let s = rooms.get(code);
      if (!s) {
        s = newOffice();
        s.code = code;
        addPlayer(s, 'ai', 'Ada (AI)', true);
        rooms.set(code, s);
      }
      if (s.players.filter((p) => !p.bot).length >= 6) return failure(409, 'Room full');
      const id = randomUUID(),
        p = addPlayer(s, id, b.name);
      if (!s.host) s.host = id;
      sessions.set(id, { p, s, seen: clock(), inputAt: 0, actionAt: 0 });
      return publicOffice(s, id);
    }
    const id = method === 'GET' ? url.searchParams.get('id') : b.id,
      session = sessions.get(id);
    if (!session) return failure(404, 'Session expired; join again');
    const { p, s } = session;
    session.seen = clock();
    if (method === 'GET' && url.pathname === '/api/state') return publicOffice(s, id);
    if (method !== 'POST') return failure(404, 'Unknown endpoint');
    if (url.pathname === '/api/input') {
      if (!Number.isFinite(b.dx) || !Number.isFinite(b.dy))
        return failure(400, 'Finite axes required');
      p.dx = Math.max(-1, Math.min(1, b.dx));
      p.dy = Math.max(-1, Math.min(1, b.dy));
      session.inputAt = clock();
      return { ok: true };
    }
    if (url.pathname === '/api/start') {
      if (s.host !== id) return failure(403, 'Only the room host starts shifts');
      startShift(s);
      return publicOffice(s, id);
    }
    if (url.pathname === '/api/bot') {
      if (s.host !== id) return failure(403, 'Only the host changes AI');
      s.bot = !s.bot;
      if (!s.bot) {
        const ai = s.players.find((v) => v.bot);
        if (ai) cancelJob(s, ai);
        s.players = s.players.filter((v) => !v.bot);
      } else addPlayer(s, 'ai', 'Ada (AI)', true);
      return publicOffice(s, id);
    }
    if (clock() - session.actionAt < 120) return publicOffice(s, id);
    session.actionAt = clock();
    if (url.pathname === '/api/work') beginJob(s, p, b.job);
    else if (url.pathname === '/api/step') jobStep(s, p, b.value);
    else if (url.pathname === '/api/prank') prank(s, p);
    else if (url.pathname === '/api/cancel') cancelJob(s, p);
    else return failure(404, 'Unknown endpoint');
    return publicOffice(s, id);
  };
  const tick = (dt) => {
    const now = clock();
    for (const [id, v] of sessions) {
      if (now - v.seen > 30000) {
        cancelJob(v.s, v.p);
        v.s.players = v.s.players.filter((p) => p !== v.p);
        sessions.delete(id);
        if (v.s.host === id) v.s.host = v.s.players.find((p) => !p.bot)?.id;
      } else if (now - v.inputAt > 350) {
        v.p.dx = 0;
        v.p.dy = 0;
      }
    }
    for (const [code, s] of rooms) {
      if (!s.players.some((p) => !p.bot)) {
        rooms.delete(code);
        continue;
      }
      tickOffice(s, dt);
    }
  };
  return serve({
    root,
    port,
    host,
    api,
    tick,
    files: {
      '/': 'index.html',
      '/index.html': 'index.html',
      '/app.js': 'app.js',
      '/rules.js': 'rules.js',
      '/style.css': 'style.css',
    },
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  createOfficeServer({ port: Number(process.env.PORT || 4383) });

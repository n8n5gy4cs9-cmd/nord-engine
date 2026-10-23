import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, failure, roomCode } from './server-kit.mjs';
import { newGrid, action, tickGrid, garbage } from './rules.js';
export function createBattleServer({
  port = null,
  host,
  root = path.dirname(fileURLToPath(import.meta.url)),
  clock = Date.now,
} = {}) {
  const rooms = new Map(),
    sessions = new Map();
  let now = clock();
  const snapshot = (p) => {
    const r = rooms.get(p.room);
    return {
      id: p.id,
      room: p.room,
      phase: r.phase,
      winner: r.winner,
      players: r.players.map((v) => ({
        id: v.id,
        name: v.name,
        ready: v.ready,
        grid: v.grid,
      })),
    };
  };
  function attack(r, p) {
    const n = p.grid.lastClear;
    if (n >= 2) for (const q of r.players) if (q !== p) garbage(q.grid, n - 1);
  }
  function finish(r) {
    if (r.phase !== 'playing') return;
    const losers = r.players.filter((p) => p.grid.over && !p.grid.won),
      winner = r.players.find((p) => p.grid.won);
    if (losers.length || winner) {
      r.phase = 'finished';
      r.winner =
        winner?.name ||
        (losers.length === 2 ? 'Draw' : r.players.find((p) => !p.grid.over)?.name) ||
        'Draw';
      for (const p of r.players) p.ready = false;
    }
  }
  const api = (method, url, b) => {
    if (method === 'POST' && url.pathname === '/api/join') {
      if (sessions.size >= 64) return failure(429, 'Server full');
      const code = roomCode(b.room);
      let r = rooms.get(code);
      if (!r) {
        r = { players: [], phase: 'waiting', winner: null };
        rooms.set(code, r);
      }
      if (r.players.length >= 2)
        return failure(409, 'Room has two players; choose another code');
      const p = {
        id: randomUUID(),
        room: code,
        name: String(b.name || 'Builder').slice(0, 20),
        grid: newGrid(),
        seen: now,
        ready: false,
        lastAction: 0,
      };
      r.players.push(p);
      sessions.set(p.id, p);
      return snapshot(p);
    }
    const p = sessions.get(method === 'GET' ? url.searchParams.get('id') : b.id);
    if (!p) return failure(404, 'Session expired; join again');
    p.seen = now;
    const r = rooms.get(p.room);
    if (method === 'GET' && url.pathname === '/api/state') return snapshot(p);
    if (method === 'POST' && url.pathname === '/api/ready') {
      if (r.phase === 'playing')
        return failure(409, 'Finish this battle before rematching');
      p.ready = true;
      if (r.players.length === 2 && r.players.every((v) => v.ready)) {
        const seed = now >>> 0;
        for (const v of r.players) v.grid = newGrid(seed);
        r.phase = 'playing';
        r.winner = null;
      }
      return snapshot(p);
    }
    if (method === 'POST' && url.pathname === '/api/action') {
      if (!['left', 'right', 'rotate', 'down', 'drop', 'hold'].includes(b.action))
        return failure(400, 'Unknown action');
      if (r.phase === 'playing' && clock() - p.lastAction >= 24) {
        p.lastAction = clock();
        action(p.grid, b.action);
        attack(r, p);
        finish(r);
      }
      return snapshot(p);
    }
    return failure(404, 'Unknown endpoint');
  };
  const tick = (dt) => {
    now = clock();
    for (const [code, r] of rooms) {
      for (const p of [...r.players])
        if (now - p.seen > 30000) {
          sessions.delete(p.id);
          r.players.splice(r.players.indexOf(p), 1);
          r.phase = 'waiting';
          r.players.forEach((v) => (v.ready = false));
        }
      if (!r.players.length) {
        rooms.delete(code);
        continue;
      }
      if (r.phase === 'playing') {
        for (const p of r.players) {
          tickGrid(p.grid, dt);
          attack(r, p);
        }
        finish(r);
      }
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
      '/lib/nord-ui.js': 'lib/nord-ui.js',
      '/ui/menu.ui.json': 'ui/menu.ui.json',
      '/rules.js': 'rules.js',
      '/chaos.js': 'chaos.js',
      '/style.css': 'style.css',
      '/vendor/phaser/phaser.min.js': 'vendor/phaser/phaser.min.js',
    },
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  createBattleServer({ port: Number(process.env.PORT || 4382) });

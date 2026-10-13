// Forgotten Wars — pure rules (no Phaser): board, movement, damage, capture, production, turns. Node-testable (tools: node tools/fw-sim.mjs).
import { LEGEND, TERRAIN, MOVE, UNITS, BASE, ORDER, START_FUNDS, INCOME, REPAIR, CAPTURE_POINTS } from './data.js';

export const key = (x, y) => y * 1000 + x;
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const hpDisplay = (hp) => Math.ceil(hp / 10);
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Parse a map file: `@ ` lines are comments/metadata, `U <owner> <type> <x> <y>` places units, the rest (after `---`) is the grid. */
export function parseMap(text) {
  const units = [], rows = [], meta = {}; let grid = false;
  for (const raw of text.split(/\r?\n/)) {
    if (grid) { if (raw.trim()) rows.push(raw.replace(/\s+$/, '')); continue; }
    if (raw.startsWith('---')) { grid = true; continue; }
    const m = raw.match(/^U\s+(\w+)\s+(\w+)\s+(\d+)\s+(\d+)/); if (m) units.push({ owner: m[1], type: m[2], x: +m[3], y: +m[4] });
    const t = raw.match(/^@\s*(\w+)\s*:\s*(.*)$/); if (t) meta[t[1]] = t[2];
  }
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x] ?? '.', e = LEGEND[ch]; if (!e) throw new Error(`map: unknown character '${ch}' at ${x},${y}`);
    tiles.push({ t: e[0], owner: e[1] ?? null, cap: CAPTURE_POINTS });
  }
  return { w, h, tiles, units, meta };
}

export function newGame(map, { seed = 1 } = {}) {
  const g = { w: map.w, h: map.h, tiles: map.tiles.map((t) => ({ ...t })), units: [], uid: 1, day: 1, current: ORDER[0], funds: Object.fromEntries(ORDER.map((o) => [o, START_FUNDS])), winner: null, seed, log: [] };
  for (const u of map.units) addUnit(g, u.owner, u.type, u.x, u.y, false);
  g.funds[g.current] += income(g, g.current);
  return g;
}
export function rand(g) { let t = (g.seed = (g.seed + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const tileAt = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? null : g.tiles[y * g.w + x]);
export const unitAt = (g, x, y) => g.units.find((u) => u.x === x && u.y === y && u.hp > 0) ?? null;
export function addUnit(g, owner, type, x, y, spent = true) { const u = { id: g.uid++, owner, type, x, y, hp: 100, moved: spent, acted: spent, capturing: false }; g.units.push(u); return u; }
export const income = (g, owner) => g.tiles.filter((t) => t.owner === owner && TERRAIN[t.t].property).length * INCOME;
export const enemyOf = (o) => ORDER.find((x) => x !== o);

/** Dijkstra over movement costs. Returns Map key → { x, y, cost, prev }. Friendly units can be passed (not stopped on), enemies block. */
export function reach(g, u) {
  const def = UNITS[u.type], costs = MOVE[def.mt], out = new Map(), start = { x: u.x, y: u.y, cost: 0, prev: null };
  out.set(key(u.x, u.y), start);
  const open = [start];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost); const cur = open.shift();
    for (const [dx, dy] of DIRS) {
      const x = cur.x + dx, y = cur.y + dy, t = tileAt(g, x, y); if (!t) continue;
      const c = costs[t.t]; if (c === undefined) continue;
      const occ = unitAt(g, x, y); if (occ && occ.owner !== u.owner) continue;
      const cost = cur.cost + c; if (cost > def.move) continue;
      const old = out.get(key(x, y)); if (old && old.cost <= cost) continue;
      const n = { x, y, cost, prev: cur }; out.set(key(x, y), n); open.push(n);
    }
  }
  // cannot stop on a tile occupied by another friendly unit
  for (const [k, n] of [...out]) { const occ = unitAt(g, n.x, n.y); if (occ && occ !== u) out.delete(k); }
  return out;
}
export const pathTo = (node) => { const p = []; for (let n = node; n; n = n.prev) p.unshift({ x: n.x, y: n.y }); return p; };

export const canHit = (a, d) => BASE[a.type][d.type] != null;
/** Damage in HP (0-100) `a` would deal to `d`, `aHp` overriding attacker hp (for counters). luck: 0-9 random % added like AW2's base luck. */
export function damage(g, a, d, { aHp = a.hp, luck = 0 } = {}) {
  const base = BASE[a.type][d.type]; if (base == null) return 0;
  const t = tileAt(g, d.x, d.y), stars = UNITS[d.type].air ? 0 : TERRAIN[t.t].stars;
  const dmg = (base + luck) * (aHp / 100) * ((200 - (100 + stars * hpDisplay(d.hp))) / 100);
  return Math.max(0, Math.floor(dmg));
}
/** Enemy units `u` could attack from (x,y). */
export function targetsFrom(g, u, x, y) {
  const def = UNITS[u.type], [lo, hi] = def.rng, out = [];
  for (const e of g.units) { if (e.owner === u.owner || e.hp <= 0) continue; const d = Math.abs(e.x - x) + Math.abs(e.y - y); if (d >= lo && d <= hi && canHit(u, e)) out.push(e); }
  return out;
}

export const capturable = (g, u) => { const t = tileAt(g, u.x, u.y); return !!UNITS[u.type].capture && TERRAIN[t.t].property && t.owner !== u.owner; };

// ---- actions (each returns an event list the view can animate) -----------------------------------------------------------
/** Move along a path of {x,y} (first = current position). */
export function doMove(g, u, path) {
  const ev = [];
  if (u.capturing) { tileAt(g, u.x, u.y).cap = CAPTURE_POINTS; u.capturing = false; }
  const last = path[path.length - 1]; ev.push({ type: 'move', id: u.id, path });
  u.x = last.x; u.y = last.y; u.moved = true; return ev;
}
export function doAttack(g, u, e, luck = true) {
  const ev = [], dmg = damage(g, u, e, { luck: luck ? Math.floor(rand(g) * 10) : 0 });
  e.hp -= dmg; ev.push({ type: 'hit', id: e.id, by: u.id, dmg, hp: Math.max(0, e.hp) });
  if (e.hp <= 0) kill(g, e, ev);
  else if (!UNITS[u.type].indirect && !UNITS[e.type].indirect && Math.abs(u.x - e.x) + Math.abs(u.y - e.y) === 1 && canHit(e, u)) {
    const c = damage(g, e, u, { aHp: e.hp, luck: luck ? Math.floor(rand(g) * 10) : 0 });
    u.hp -= c; ev.push({ type: 'hit', id: u.id, by: e.id, dmg: c, hp: Math.max(0, u.hp), counter: true });
    if (u.hp <= 0) kill(g, u, ev);
  }
  u.acted = true; u.moved = true; checkWin(g); return ev;
}
function kill(g, u, ev) { u.hp = 0; ev.push({ type: 'die', id: u.id, x: u.x, y: u.y }); const t = tileAt(g, u.x, u.y); if (u.capturing) t.cap = CAPTURE_POINTS; g.units = g.units.filter((x) => x !== u); }
export function doCapture(g, u) {
  const t = tileAt(g, u.x, u.y), ev = []; t.cap -= hpDisplay(u.hp); u.capturing = true; u.acted = true; u.moved = true;
  if (t.cap <= 0) { t.owner = u.owner; t.cap = CAPTURE_POINTS; u.capturing = false; ev.push({ type: 'captured', x: u.x, y: u.y, owner: u.owner, hq: t.t === 'hq' }); if (t.t === 'hq') g.winner = u.owner; }
  else ev.push({ type: 'capturing', id: u.id, left: t.cap });
  return ev;
}
export function doWait(g, u) { u.acted = true; u.moved = true; return []; }
export function canBuild(g, owner, x, y, type) {
  const t = tileAt(g, x, y); return t && t.t === 'factory' && t.owner === owner && !unitAt(g, x, y) && g.funds[owner] >= UNITS[type].cost;
}
export function doBuild(g, owner, x, y, type) { g.funds[owner] -= UNITS[type].cost; const u = addUnit(g, owner, type, x, y, true); return [{ type: 'build', id: u.id, unit: type, x, y }]; }

function checkWin(g) { if (g.winner) return; for (const o of ORDER) if (!g.units.some((u) => u.owner === o && u.hp > 0)) g.winner = enemyOf(o); }
/** End the current army's turn: next army starts, collects income, repairs units on its properties, unit flags reset. */
export function endTurn(g) {
  const ev = []; const i = ORDER.indexOf(g.current); g.current = ORDER[(i + 1) % ORDER.length]; if (i + 1 >= ORDER.length) g.day++;
  const inc = income(g, g.current); g.funds[g.current] += inc; ev.push({ type: 'turn', owner: g.current, day: g.day, income: inc });
  for (const u of g.units) if (u.owner === g.current) {
    u.moved = u.acted = false;
    const t = tileAt(g, u.x, u.y);
    if (TERRAIN[t.t].property && t.owner === u.owner && u.hp < 100) { const heal = Math.min(REPAIR, 100 - u.hp), cost = Math.round(UNITS[u.type].cost * heal / 100); if (g.funds[u.owner] >= cost) { g.funds[u.owner] -= cost; u.hp += heal; ev.push({ type: 'repair', id: u.id, hp: u.hp }); } }
  }
  return ev;
}
export const ready = (g, u) => u.owner === g.current && !u.acted;

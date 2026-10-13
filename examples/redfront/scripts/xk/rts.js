// RTS simulation (Red Alert / C&C style): pure JS, no engine calls, node-testable (tools/rts-sim.mjs). Crowelian 2026 + Sonnet.
// Stats (cost / hp / speed / range / build time) are adapted from OpenRA mods/ra/rules (GPL-3, see THIRD_PARTY.md): E1, E3, 1TNK, 2TNK, HARV, FACT, POWR, BARR, WEAP, PROC, PBOX.
// A* pathing follows OpenRA's PathSearch idea (8-way grid search); the harvester loop + production queues + power penalty follow the original game rules.
// Used by X-KOM 2026 (humans vs the alien hive) and Red Front 2026 (Allies vs Soviets). Mode differs only in the enemy faction + win rule.

export const FP = { fact: [3, 3], powr: [2, 2], barr: [2, 2], weap: [3, 2], proc: [3, 2], gun: [1, 1], hive: [3, 3], brood: [2, 2], tower: [1, 1] };
// kind: inf | veh | alien. dmg is per shot, reload in seconds, from: the building that trains it.
export const U = {
  rifle:   { name: 'RIFLE INF', cost: 100, hp: 50, spd: 1.5, range: 4.5, dmg: 7, reload: 0.7, kind: 'inf', w: 'bullet', from: 'barr', bt: 3, vis: 6 },
  rocket:  { name: 'ROCKET INF', cost: 300, hp: 45, spd: 1.35, range: 5.5, dmg: 28, reload: 1.8, kind: 'inf', w: 'rocket', from: 'barr', bt: 6, vis: 6 },
  ltank:   { name: 'LIGHT TANK', cost: 700, hp: 230, spd: 2.3, range: 5, dmg: 18, reload: 1.0, kind: 'veh', w: 'shell', from: 'weap', bt: 11, vis: 7 },
  mtank:   { name: 'MEDIUM TANK', cost: 850, hp: 460, spd: 1.9, range: 6, dmg: 32, reload: 1.3, kind: 'veh', w: 'shell', from: 'weap', bt: 14, vis: 7 },
  harv:    { name: 'HARVESTER', cost: 1100, hp: 600, spd: 1.5, range: 0, dmg: 0, reload: 1, kind: 'veh', w: 'bullet', from: 'weap', bt: 16, vis: 5 },
  warrior: { name: 'DRONE', cost: 60, hp: 55, spd: 1.9, range: 1.3, dmg: 9, reload: 0.6, kind: 'alien', w: 'claw', from: 'hive', bt: 2.5, vis: 6 },
  spitter: { name: 'SPITTER', cost: 140, hp: 45, spd: 1.5, range: 5, dmg: 13, reload: 1.2, kind: 'alien', w: 'acid', from: 'brood', bt: 4, vis: 6 },
  walker:  { name: 'WALKER', cost: 600, hp: 420, spd: 1.5, range: 5.5, dmg: 30, reload: 1.5, kind: 'alien', w: 'acid', from: 'hive', bt: 12, vis: 7 },
};
export const B = {
  fact: { name: 'CONSTRUCTION YARD', hp: 600 }, powr: { name: 'POWER PLANT', hp: 220 }, barr: { name: 'BARRACKS', hp: 300 }, weap: { name: 'WAR FACTORY', hp: 500 },
  proc: { name: 'REFINERY', hp: 400 }, gun: { name: 'GUN TURRET', hp: 220, range: 6, dmg: 20, reload: 0.9, w: 'shell' },
  hive: { name: 'ALIEN HIVE', hp: 900 }, brood: { name: 'BROOD POOL', hp: 350 }, tower: { name: 'SPORE TOWER', hp: 160, range: 6, dmg: 16, reload: 1.0, w: 'acid' },
};
const VS = { bullet: { inf: 1, veh: 0.35, bld: 0.3 }, rocket: { inf: 0.6, veh: 1.5, bld: 1 }, shell: { inf: 0.8, veh: 1, bld: 0.8 }, claw: { inf: 1, veh: 0.5, bld: 0.7 }, acid: { inf: 1, veh: 1, bld: 0.7 } };
export const TILE = { GRASS: 0, DIRT: 2, WATER: 3, TREE: 4, ROCK: 5 };
export const PLAYER_UNITS = { rifle: 1, rocket: 1, ltank: 1, mtank: 1, harv: 1 };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- world ---------------------------------------------------------------------------------------------------------------
export function newRts({ seed = 1, mode = 'xkom', bonus = 0, w = 44, h = 44, diff = 1, mods = null } = {}) {
  const r = rng(seed), tiles = new Uint8Array(w * h), ore = new Int16Array(w * h), occ = new Int32Array(w * h);
  const s = { w, h, tiles, ore, occ, mode, mods: mods ?? { hp: 1, dmg: 1, credits: 0 }, units: [], blds: [], nextId: 1, time: 0, ev: [], kills: 0, result: null, diff, rnd: r,
    credits: { p: 2500 + (mods?.credits ?? 0), e: 1500 }, ai: { t: 0, wave: 5, timer: 40, sent: 0 }, lowPower: { p: false, e: false } };
  const blob = (kind, n, rmin, rmax) => { for (let i = 0; i < n; i++) { const cx = r() * w, cy = r() * h, rad = rmin + r() * (rmax - rmin); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < rad * rad * (0.7 + r() * 0.5)) tiles[y * w + x] = kind; } };
  blob(TILE.DIRT, 6, 2, 4); blob(TILE.WATER, 4, 2, 4.5); blob(TILE.TREE, 10, 1.2, 3); blob(TILE.ROCK, 8, 0.8, 1.6);
  const jitter = () => ((r() * 5) | 0) - 2;
  const P = { x: 4 + jitter(), y: 30 + jitter() }, E = { x: (mode === 'xkom' ? 31 : 28) + jitter(), y: 4 + jitter() }, spread = r() < 0.5;
  // carve a winding road between the bases + clear both base areas
  let cx = P.x + 6, cy = P.y; const tx = E.x + 3, ty = E.y + 5;
  while (Math.abs(cx - tx) + Math.abs(cy - ty) > 2) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = TILE.DIRT; } if (r() < 0.5 && cx !== tx) cx += cx < tx ? 1 : -1; else if (cy !== ty) cy += cy < ty ? 1 : -1; else cx += cx < tx ? 1 : -1; }
  for (const o of [{ x: P.x + 6, y: P.y + 4 }, { x: E.x + 6, y: E.y + 5 }]) for (let y = o.y - 9; y <= o.y + 9; y++) for (let x = o.x - 11; x <= o.x + 11; x++) if (x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] !== TILE.DIRT) tiles[y * w + x] = TILE.GRASS;
  const field = (fx, fy, rad) => { for (let y = fy - rad; y <= fy + rad; y++) for (let x = fx - rad; x <= fx + rad; x++) if (x >= 0 && y >= 0 && x < w && y < h && (x - fx) ** 2 + (y - fy) ** 2 <= rad * rad && tiles[y * w + x] !== TILE.WATER) { tiles[y * w + x] = TILE.DIRT; ore[y * w + x] = 300 + ((r() * 500) | 0); } };
  field(P.x + 14, P.y + 7, 3); field(P.x + 10, P.y - 8, 2); field(22, 22, 3); field(E.x - 8, E.y + 10, 2);
  if (mode === 'xkom') { // player: classic base. enemy: hive nest
    addB(s, 'fact', 'p', P.x, P.y); addB(s, 'powr', 'p', P.x + 4, P.y + (spread ? 1 : 0)); addB(s, 'barr', 'p', P.x, P.y + (spread ? 5 : 4)); addB(s, 'weap', 'p', P.x + (spread ? 4 : 3), P.y + (spread ? 5 : 4)); addB(s, 'proc', 'p', P.x + 7, P.y + (spread ? 1 : 2)); addB(s, 'gun', 'p', P.x + 10, P.y + 1); addB(s, 'gun', 'p', P.x + 3, P.y - 1);
    addB(s, 'hive', 'e', E.x, E.y); addB(s, 'brood', 'e', E.x - 4, E.y + (spread ? 5 : 3)); addB(s, 'brood', 'e', E.x + 4, E.y + (spread ? 1 : 4)); addB(s, 'tower', 'e', E.x - 1, E.y + 4); addB(s, 'tower', 'e', E.x + 3, E.y + 5); addB(s, 'tower', 'e', E.x - 2, E.y - 1);
    for (let i = 0; i < 6; i++) addU(s, i % 3 === 2 ? 'spitter' : 'warrior', 'e', E.x + i * 0.8, E.y + 5.5);
  } else {
    addB(s, 'fact', 'p', P.x, P.y); addB(s, 'powr', 'p', P.x + 4, P.y + (spread ? 1 : 0)); addB(s, 'barr', 'p', P.x, P.y + (spread ? 5 : 4)); addB(s, 'weap', 'p', P.x + (spread ? 4 : 3), P.y + (spread ? 5 : 4)); addB(s, 'proc', 'p', P.x + 7, P.y + (spread ? 1 : 2)); addB(s, 'gun', 'p', P.x + 10, P.y + 1);
    addB(s, 'fact', 'e', E.x + 5, E.y); addB(s, 'powr', 'e', E.x + 1, E.y); addB(s, 'powr', 'e', E.x + 1, E.y + 2); addB(s, 'barr', 'e', E.x + 5, E.y + 4); addB(s, 'weap', 'e', E.x + 2, E.y + 5); addB(s, 'proc', 'e', E.x - 3, E.y + 3);
    addB(s, 'gun', 'e', E.x - 1, E.y + 6); addB(s, 'gun', 'e', E.x + 4, E.y + 7); addB(s, 'gun', 'e', E.x - 1, E.y + 1);
    s.credits.e = 2500;
  }
  addU(s, 'harv', 'p', P.x + 8, P.y + 5.5); if (mode !== 'xkom') addU(s, 'harv', 'e', E.x - 2, E.y + 6);
  for (let i = 0; i < 5; i++) addU(s, i % 3 === 2 ? 'rocket' : 'rifle', 'p', P.x + 2 + i * 0.7, P.y + 7.5);
  addU(s, 'ltank', 'p', P.x + 6, P.y + 7.5); addU(s, 'ltank', 'p', P.x + 7.5, P.y + 8);
  for (let i = 0; i < bonus; i++) addU(s, 'rifle', 'p', P.x + 1 + i * 0.6, P.y + 9); // surviving X-KOM squad joins the operation
  if (mode !== 'xkom') for (let i = 0; i < 5; i++) addU(s, i % 3 === 2 ? 'rocket' : 'rifle', 'e', E.x + 3 + i * 0.7, E.y + 9);
  // Mirror the whole battlefield, including footprints/ore; keep building counts and economy unchanged.
  const flipX = r() < 0.5, flipY = r() < 0.5;
  s.layout = `${spread ? 'SPREAD' : 'COMPACT'} / ${flipY ? 'N' : 'S'}${flipX ? 'E' : 'W'}`;
  const ti = tiles.slice(), oi = ore.slice(); s.occ.fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (flipY ? h - 1 - y : y) * w + (flipX ? w - 1 - x : x); tiles[k] = ti[y * w + x]; ore[k] = oi[y * w + x]; }
  for (const b of s.blds) { if (flipX) b.tx = w - b.tx - b.w; if (flipY) b.ty = h - b.ty - b.h; for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) { s.occ[y * w + x] = b.id; ore[y * w + x] = 0; } }
  for (const u of s.units) {
    if (flipX) u.x = w - u.x; if (flipY) u.y = h - u.y;
    if (blocked(s, Math.floor(u.x), Math.floor(u.y))) {
      let found = false;
      for (let radius = 1; radius <= 5 && !found; radius++) for (let dy = -radius; dy <= radius && !found; dy++) for (let dx = -radius; dx <= radius && !found; dx++) {
        const x = Math.floor(u.x) + dx, y = Math.floor(u.y) + dy;
        if (!blocked(s, x, y)) { u.x = x + 0.5; u.y = y + 0.5; found = true; }
      }
    }
  }
  return s;
}
function addB(s, type, team, tx, ty) {
  const [fw, fh] = FP[type], b = { id: s.nextId++, type, team, tx, ty, w: fw, h: fh, hp: B[type].hp, max: B[type].hp, cd: 0, q: [], prog: 0, rally: null, flash: 0 };
  s.blds.push(b); for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) s.occ[y * s.w + x] = b.id; return b;
}
function addU(s, type, team, x, y) {
  const d = U[type], hpm = team === 'p' ? s.mods.hp : 1, u = { id: s.nextId++, type, team, x, y, hp: d.hp * hpm, max: d.hp * hpm, cd: 0, path: null, goal: null, order: null, target: 0, face: 1, anim: 0, moving: false, shoot: 0, load: 0, hstate: 'seek', t: 0, amove: false };
  s.units.push(u); return u;
}
export const spawn = addU;
export const byId = (s, id) => s.units.find((u) => u.id === id) ?? s.blds.find((b) => b.id === id);
export const isBld = (o) => o && o.tx !== undefined;
const cx = (o) => (isBld(o) ? o.tx + o.w / 2 : o.x), cy = (o) => (isBld(o) ? o.ty + o.h / 2 : o.y);
function dist(a, b) { // distance between objects (to the nearest edge for buildings)
  const rx = (o) => (isBld(o) ? [o.tx, o.tx + o.w] : [o.x, o.x]), ry = (o) => (isBld(o) ? [o.ty, o.ty + o.h] : [o.y, o.y]);
  const [ax0, ax1] = rx(a), [bx0, bx1] = rx(b), [ay0, ay1] = ry(a), [by0, by1] = ry(b);
  return Math.hypot(Math.max(0, ax0 - bx1, bx0 - ax1), Math.max(0, ay0 - by1, by0 - ay1));
}
export const blocked = (s, x, y) => x < 0 || y < 0 || x >= s.w || y >= s.h || s.tiles[y * s.w + x] >= TILE.WATER || s.occ[y * s.w + x] !== 0;

// ---- A* (8-way, no corner cutting) ------------------------------------------------------------------------------------
export function findPath(s, sx, sy, gx, gy) {
  sx |= 0; sy |= 0;
  if (blocked(s, gx, gy)) { let best = null, bd = 1e9; for (let r = 1; r <= 5 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!blocked(s, gx + dx, gy + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [gx + dx, gy + dy]; } } if (!best) return null; [gx, gy] = best; }
  const W = s.w, key = (x, y) => y * W + x, g = new Map([[key(sx, sy), 0]]), from = new Map(), open = [[0, sx, sy]], closed = new Set();
  let nodes = 0, bestN = [sx, sy], bestH = Math.hypot(gx - sx, gy - sy);
  const push = (n) => { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const t = open[0], l = open.pop(); if (open.length) { open[0] = l; let i = 0; for (;;) { let m = i; const a = 2 * i + 1, b = a + 1; if (a < open.length && open[a][0] < open[m][0]) m = a; if (b < open.length && open[b][0] < open[m][0]) m = b; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return t; };
  while (open.length && nodes++ < 6000) {
    const [, x, y] = pop(), k = key(x, y); if (closed.has(k)) continue; closed.add(k);
    const hd = Math.hypot(gx - x, gy - y); if (hd < bestH) { bestH = hd; bestN = [x, y]; }
    if (x === gx && y === gy) { bestN = [x, y]; break; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (blocked(s, nx, ny)) continue;
      if (dx && dy && (blocked(s, x + dx, y) || blocked(s, x, y + dy))) continue;
      const nk = key(nx, ny), ng = g.get(k) + (dx && dy ? 1.414 : 1); if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); from.set(nk, k); push([ng + Math.hypot(gx - nx, gy - ny), nx, ny]); }
    }
  }
  const path = []; let k = key(bestN[0], bestN[1]);
  while (from.has(k)) { path.push([(k % W) + 0.5, ((k / W) | 0) + 0.5]); k = from.get(k); }
  return path.reverse();
}

// ---- commands ---------------------------------------------------------------------------------------------------------------
export function order(s, ids, o) {
  for (const id of ids) { const u = s.units.find((x) => x.id === id); if (!u || u.type === 'harv' && o.kind !== 'move') continue;
    u.target = 0; u.amove = false; u.path = null; u.order = null;
    if (o.kind === 'move' || o.kind === 'amove') { u.order = { kind: o.kind, x: o.x, y: o.y }; u.amove = o.kind === 'amove'; u.path = findPath(s, u.x, u.y, Math.floor(o.x), Math.floor(o.y)); u.hstate = 'seek'; }
    else if (o.kind === 'attack') { u.target = o.id; u.order = { kind: 'attack' }; }
  }
}
export function train(s, team, type) {
  const d = U[type], prod = s.blds.filter((b) => b.team === team && b.type === d.from).sort((a, b) => a.q.length - b.q.length)[0];
  if (!prod) return 'NO ' + B[d.from].name;
  if (prod.q.length >= 5) return 'QUEUE FULL';
  if (s.credits[team] < d.cost) return 'NOT ENOUGH CREDITS';
  s.credits[team] -= d.cost; prod.q.push(type); return null;
}
export const power = (s, team) => s.blds.some((b) => b.team === team && b.type === 'powr');

// ---- step -------------------------------------------------------------------------------------------------------------------
const enemyOf = (t) => (t === 'p' ? 'e' : 'p');
function hit(s, att, tgt, dmg, w) {
  const m = VS[w][isBld(tgt) ? 'bld' : U[tgt.type].kind === 'alien' ? 'inf' : U[tgt.type].kind];
  tgt.hp -= dmg * m * (att.team === 'p' ? s.mods.dmg : 1) * (0.85 + s.rnd() * 0.3); tgt.flash = 0.15;
  s.ev.push({ t: 'shot', w, fx: cx(att), fy: cy(att), tx: cx(tgt), ty: cy(tgt), team: att.team });
  if (tgt.team === 'p' && !isBld(tgt) && s.rnd() < 0.05) s.ev.push({ t: 'under', x: tgt.x, y: tgt.y });
}
function findTarget(s, a, range) {
  let best = null, bd = 1e9;
  for (const o of [...s.units, ...s.blds]) { if (o.team === a.team || o.hp <= 0) continue; const d = dist(a, o) + (isBld(o) ? 1.2 : 0); if (d <= range + (isBld(o) ? 1.2 : 0) && d < bd) { bd = d; best = o; } }
  return best;
}
export function step(s, dt) {
  if (s.result) return; s.time += dt;
  for (const t of ['p', 'e']) s.lowPower[t] = s.mode === 'xkom' && t === 'e' ? false : !power(s, t);
  // income for the computer player (its harvesters mine for real in Red Front; aliens simply grow)
  if (s.mode === 'xkom') s.credits.e += dt * (5 + s.time / 80) * s.diff; else s.credits.e += dt * (s.blds.some((b) => b.team === 'e' && b.type === 'proc') ? 8 : 2) * s.diff;
  // production
  for (const b of s.blds) { if (!b.q.length) { b.prog = 0; continue; } const d = U[b.q[0]]; b.prog += dt * (s.lowPower[b.team] ? 0.5 : 1);
    if (b.prog >= d.bt) { b.prog = 0; const type = b.q.shift(); const sp = freeSpot(s, b); const u = addU(s, type, b.team, sp[0], sp[1]); s.ev.push({ t: 'built', team: b.team, unit: type });
      if (type === 'harv') u.hstate = 'seek'; else { const rx = Math.max(1, Math.min(s.w - 2, Math.floor(b.tx + b.w / 2 + (b.team === 'p' ? 2 : -2) + (s.rnd() - 0.5) * 3))), ry = Math.min(s.h - 2, b.ty + b.h + 2); u.order = { kind: 'move', x: rx, y: ry }; u.path = findPath(s, u.x, u.y, rx, ry); } } }
  // turrets
  for (const b of s.blds) { const d = B[b.type]; b.flash = Math.max(0, b.flash - dt); b.cd -= dt; if (!d.range) continue; b.fire = Math.max(0, (b.fire ?? 0) - dt);
    if (b.cd <= 0) { const t = findTarget(s, b, d.range); if (t) { hit(s, b, t, d.dmg, d.w); b.cd = d.reload; b.fire = 0.15; } } }
  for (const u of s.units) updateUnit(s, u, dt);
  // separation (soft crowd push)
  for (let i = 0; i < s.units.length; i++) for (let j = i + 1; j < s.units.length; j++) { const a = s.units[i], b = s.units[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < 0.55 && d > 0.001) { const p = (0.55 - d) * 0.25; if (!a.moving || a.path === null) { a.x -= dx / d * p; a.y -= dy / d * p; } if (!b.moving || b.path === null) { b.x += dx / d * p; b.y += dy / d * p; } } }
  // deaths
  for (const u of s.units) if (u.hp <= 0) { s.ev.push({ t: 'boom', x: u.x, y: u.y, big: U[u.type].kind === 'veh' || u.type === 'walker', unit: u.type, team: u.team }); if (u.team === 'e') s.kills++; }
  s.units = s.units.filter((u) => u.hp > 0);
  for (const b of s.blds) if (b.hp <= 0) { for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) s.occ[y * s.w + x] = 0; s.ev.push({ t: 'boom', x: b.tx + b.w / 2, y: b.ty + b.h / 2, big: true, bld: b.type, team: b.team }); if (b.team === 'e') s.kills += b.type === 'hive' ? 10 : 2; }
  s.blds = s.blds.filter((b) => b.hp > 0);
  aiStep(s, dt);
  // win / lose
  const mine = s.blds.filter((b) => b.team === 'p').length, theirs = s.blds.filter((b) => b.team === 'e');
  if (!mine) s.result = 'lose'; else if (s.mode === 'xkom' ? !theirs.some((b) => b.type === 'hive') : !theirs.length) s.result = 'win';
}
function freeSpot(s, b) { for (let r = 0; r < 4; r++) for (let x = b.tx - 1; x <= b.tx + b.w; x++) { const y = b.ty + b.h + r; if (!blocked(s, x, y)) return [x + 0.5, y + 0.5]; } return [b.tx + 0.5, b.ty + b.h + 0.5]; }
function nearestOre(s, u) { let best = null, bd = 1e9; for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.ore[y * s.w + x] > 0) { const d = Math.hypot(x - u.x, y - u.y) + (s.units.some((o) => o !== u && o.type === 'harv' && o.team === u.team && o.gx === x && o.gy === y) ? 6 : 0); if (d < bd) { bd = d; best = [x, y]; } } return best; }
function moveAlong(s, u, dt) {
  const d = U[u.type]; u.moving = false; if (!u.path || !u.path.length) { u.path = null; return; }
  const [px, py] = u.path[0], dx = px - u.x, dy = py - u.y, l = Math.hypot(dx, dy), st = d.spd * dt;
  if (l <= st) { u.x = px; u.y = py; u.path.shift(); } else { u.x += dx / l * st; u.y += dy / l * st; }
  if (Math.abs(dx) > 0.02) u.face = dx > 0 ? 1 : -1; u.moving = true; u.anim += dt;
}
function updateUnit(s, u, dt) {
  const d = U[u.type]; u.cd -= dt; u.shoot = Math.max(0, u.shoot - dt); u.flash = Math.max(0, (u.flash ?? 0) - dt); u.t += dt;
  if (u.type === 'harv') return harvest(s, u, dt);
  // explicit attack order
  let tgt = u.target ? byId(s, u.target) : null; if (u.target && (!tgt || tgt.hp <= 0)) { u.target = 0; tgt = null; u.order = null; }
  if (!tgt && (!u.order || u.amove || !u.path)) { // auto-acquire: idle guards engage near, attack-move engages at vision range
    tgt = findTarget(s, u, u.amove ? d.vis : d.range + 1); }
  if (tgt) {
    const dd = dist(u, tgt), r = d.range + (isBld(tgt) ? 0.8 : 0);
    if (dd <= r) { u.path = null; u.moving = false; u.face = cx(tgt) >= u.x ? 1 : -1; if (u.cd <= 0) { hit(s, u, tgt, d.dmg, d.w); u.cd = d.reload; u.shoot = 0.18; } return; }
    if (u.target || u.amove) { u.chase = (u.chase ?? 0) - dt; if (!u.path || u.chase <= 0) { u.path = findPath(s, u.x, u.y, Math.floor(cx(tgt)), Math.floor(cy(tgt))); u.chase = 1; } moveAlong(s, u, dt); return; }
  }
  if (u.path) moveAlong(s, u, dt); else if (u.amove && u.order) { const o = u.order; if (Math.hypot(o.x - u.x, o.y - u.y) < 1.5) { u.amove = false; u.order = null; } else u.path = findPath(s, u.x, u.y, Math.floor(o.x), Math.floor(o.y)); } else u.moving = false;
}
function harvest(s, u, dt) {
  const W = s.w;
  if (u.path) { moveAlong(s, u, dt); if (u.path) return; }
  if (u.hstate === 'seek') { const o = nearestOre(s, u); if (!o) return; u.gx = o[0]; u.gy = o[1]; u.path = findPath(s, u.x, u.y, o[0], o[1]); u.hstate = 'mine'; return; }
  if (u.hstate === 'mine') {
    const x = Math.floor(u.x), y = Math.floor(u.y), k = y * W + x;
    if (s.ore[k] > 0) { const take = Math.min(s.ore[k], 40 * dt, 200 - u.load); s.ore[k] -= take; u.load += take; u.moving = false; if (s.ore[k] <= 0) s.ore[k] = 0; }
    else if (u.load < 200) { const o = nearestOre(s, u); if (o && Math.hypot(o[0] - u.x, o[1] - u.y) < 7) { u.path = findPath(s, u.x, u.y, o[0], o[1]); return; } }
    if (u.load >= 199 || (s.ore[k] <= 0 && u.load > 0)) { u.hstate = 'return'; const p = s.blds.filter((b) => b.team === u.team && b.type === 'proc').sort((a, b) => dist(u, a) - dist(u, b))[0]; if (!p) { u.hstate = 'seek'; return; } u.path = findPath(s, u.x, u.y, p.tx + 1, p.ty + p.h); u.proc = p.id; }
    else if (s.ore[k] <= 0) u.hstate = 'seek';
  } else if (u.hstate === 'return') {
    const p = byId(s, u.proc) ?? s.blds.find((b) => b.team === u.team && b.type === 'proc'); if (!p) { u.hstate = 'seek'; return; }
    if (dist(u, p) < 1.6) { s.credits[u.team] += Math.round(u.load); s.ev.push({ t: 'cash', team: u.team, amt: Math.round(u.load), x: u.x, y: u.y }); u.load = 0; u.hstate = 'seek'; } else u.path = findPath(s, u.x, u.y, p.tx + 1, p.ty + p.h);
  }
}

// ---- computer player ----------------------------------------------------------------------------------------------------------
function aiStep(s, dt) {
  const a = s.ai; a.t += dt; if (a.t < 1) return; a.t = 0; const T = 'e';
  const mine = s.units.filter((u) => u.team === T);
  const want = s.mode === 'xkom'
    ? [s.time > 150 && s.rnd() < 0.2 ? 'walker' : null, s.rnd() < 0.35 ? 'spitter' : 'warrior']
    : [s.rnd() < 0.2 ? 'mtank' : s.rnd() < 0.5 ? 'ltank' : null, s.rnd() < 0.3 ? 'rocket' : 'rifle'];
  if (s.mode !== 'xkom' && mine.filter((u) => u.type === 'harv').length < 1 && s.rnd() < 0.3) train(s, T, 'harv');
  for (const t of want) if (t && mine.length < 14 + s.time / 25 && s.credits[T] >= U[t].cost) { if (!train(s, T, t)) break; }
  a.timer -= 1;
  const idle = mine.filter((u) => u.type !== 'harv' && !u.order && !u.target), foes = s.blds.filter((b) => b.team === 'p');
  if (a.timer <= 0 && idle.length >= a.wave && foes.length) { const f = foes[(s.rnd() * foes.length) | 0]; order(s, idle.map((u) => u.id), { kind: 'amove', x: Math.floor(cx(f)), y: Math.floor(cy(f)) + 1 }); a.sent++; a.wave = Math.min(14, a.wave + 1); a.timer = 35 + s.rnd() * 20; }
  // base defence: idle units wake up when player units are close to the nest
  for (const u of idle) { const f = findTarget(s, u, 9); if (f && !isBld(f)) order(s, [u.id], { kind: 'amove', x: Math.floor(f.x), y: Math.floor(f.y) }); }
}

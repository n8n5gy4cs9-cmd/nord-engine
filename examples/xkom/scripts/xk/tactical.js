// X-COM style tactical rules (isometric, turn-based, time units). Pure JS — no engine calls — node-testable (tools/xk-sim.mjs). Crowelian 2026 + Sonnet.
// Rules adapted from OpenXcom (GPL-3, see THIRD_PARTY.md): weapon numbers come from bin/standard/xcom1/items.rul (RIFLE: power 30, snap 60%/25 TU, aimed 110%/80 TU, auto 35%/35 TU),
// units.rul (Sectoid soldier 54 TU / 30 HP / firing 52 / reactions 63), armors.rul (coveralls front armour 12), and src/Battlescape (walk = 4 TU, diagonal 6; damage = random 0–200% of power minus armour;
// reaction fire = higher reactions × (TU left / max TU) fires first when a unit moves into view).
export const WEAPONS = {
  rifle:   { name: 'RIFLE', power: 30, snap: [60, 25], aimed: [110, 80], auto: [35, 35], burst: 3, shot: 'bullet' },
  laser:   { name: 'LASER RIFLE', power: 46, snap: [65, 25], aimed: [120, 75], auto: [50, 33], burst: 3, shot: 'plasma' },
  plasma:  { name: 'PLASMA RIFLE', power: 80, snap: [86, 30], aimed: [100, 60], auto: [75, 36], burst: 3, shot: 'plasma' },
  pistol:  { name: 'PLASMA PISTOL', power: 52, snap: [65, 30], aimed: [85, 60], auto: [50, 36], burst: 3, shot: 'plasma' },
};
export const RACES = {
  soldier: { name: 'X-KOM', hp: 30, tu: 55, firing: 60, react: 50, armor: 14, weapon: 'rifle', sight: 14 },
  sectoid: { name: 'SECTOID', hp: 30, tu: 54, firing: 52, react: 63, armor: 4, weapon: 'pistol', sight: 14, value: 1 },
  muton:   { name: 'MUTON', hp: 125, tu: 55, firing: 60, react: 40, armor: 20, weapon: 'plasma', sight: 14, value: 3 },
};
const NAMES = ['Ripley', 'Hicks', 'Vasquez', 'Hudson', 'Apone', 'Dallas', 'Parker', 'Kane', 'Bishop', 'Newt', 'Burke', 'Drake', 'Frost', 'Gorman', 'Dietrich', 'Ferro', 'Spunkmeyer', 'Crowe'];
export const key = (x, y) => y * 32 + x;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function newRookie(r, i) {
  return { name: NAMES[i % NAMES.length], hp: 35 + ((r() * 15) | 0), tu: 50 + ((r() * 11) | 0), firing: 50 + ((r() * 21) | 0), react: 35 + ((r() * 30) | 0), kills: 0, missions: 0 };
}
export function newSquad(seed, n = 6) { const r = rng(seed); return Array.from({ length: n }, (_, i) => newRookie(r, i)); }

/** mods (from research.js): { armor, tu, weapon } applied to every soldier */
export function newMission({ seed = 1, squad, aliens = 5, mods = null } = {}) {
  for (let tries = 0; tries < 12; tries++) {
    const s = gen(seed + tries * 101, squad ?? newSquad(seed), aliens);
    if (s) { if (mods) for (const u of live(s, 'x')) { if (mods.weapon) u.weapon = mods.weapon; u.armor += mods.armor | 0; u.maxTu += mods.tu | 0; u.tu = u.maxTu; } return s; }
  }
  throw new Error('mission generation failed');
}
function gen(seed, squad, nAliens) {
  const r = rng(seed), W = 24, H = 24, g = new Array(W * H).fill('grass'), o = new Array(W * H).fill(null), I = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const patch = (kind, n, rw, rh) => { for (let i = 0; i < n; i++) { const x0 = (r() * (W - rw)) | 0, y0 = (r() * (H - rh)) | 0; for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) g[I(x, y)] = kind; } };
  patch('dirt', 5, 4, 3); patch('field', 3, 7, 5);
  const roadY = 13 + ((r() * 3) | 0); for (let x = 0; x < W; x++) { g[I(x, roadY)] = 'road'; g[I(x, roadY + 1)] = 'road'; }
  // barn (west-middle): wooden walls, two doors
  const bx = 5 + ((r() * 4) | 0), by = 4 + ((r() * 3) | 0), bw = 6, bh = 5;
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { g[I(x, y)] = 'dirt'; if (x === bx || y === by || x === bx + bw - 1 || y === by + bh - 1) o[I(x, y)] = 'wood'; }
  o[I(bx + 2, by + bh - 1)] = null; o[I(bx + bw - 1, by + 2)] = null; o[I(bx + 3, by + 2)] = 'crate';
  // UFO (north-east): hull ring, metal floor, power source
  const ux = 16 + ((r() * 2) | 0), uy = 5 + ((r() * 2) | 0), rad = 4.4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - ux) / 1.15, (y - uy)); if (d <= rad) g[I(x, y)] = 'metal'; if (d <= rad && d > rad - 1.1) o[I(x, y)] = 'hull'; else if (d <= rad) o[I(x, y)] = null; }
  for (let k = -1; k <= 1; k++) { o[I(ux + k, uy + 4)] = null; o[I(ux - 5, uy + k)] = null; o[I(ux - 4, uy + k)] = null; o[I(ux + k, uy + 3)] = null; }
  o[I(ux, uy)] = 'power';
  // trees
  for (let i = 0; i < 28; i++) { const x = (r() * W) | 0, y = (r() * H) | 0; if (g[I(x, y)] === 'grass' || g[I(x, y)] === 'dirt') if (!o[I(x, y)] && !(x < 7 && y > 15) && Math.hypot(x - ux, y - uy) > rad + 1) o[I(x, y)] = 'tree'; }
  for (let y = 16; y < 24; y++) for (let x = 0; x < 8; x++) if (o[I(x, y)] === 'tree') o[I(x, y)] = null;
  const s = { w: W, h: H, g, o, units: [], turn: 1, side: 'x', nextId: 1, rnd: r, result: null, kills: 0, log: [], aliensTotal: nAliens, alert: false, ufo: { x: ux, y: uy } };
  squad.forEach((m, i) => { const x = 2 + (i % 3), y = 20 + ((i / 3) | 0) * 1; addUnit(s, 'soldier', 'x', x, y, m); });
  const metal = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[I(x, y)] === 'metal' && !o[I(x, y)] && Math.hypot(x - ux, y - uy) > 1) metal.push([x, y]);
  for (let i = 0; i < nAliens && metal.length; i++) { const [x, y] = metal.splice((r() * metal.length) | 0, 1)[0]; addUnit(s, i % 4 === 3 ? 'muton' : 'sectoid', 'a', x, y); }
  // reachability: a soldier must be able to walk to the UFO door
  const reach0 = reach(s, s.units[0]); if (!reach0.has(key(ux, uy + 5)) && !reach0.has(key(ux - 6, uy))) return null;
  refill(s); computeSeen(s); return s;
}
function addUnit(s, race, side, x, y, m) {
  const d = RACES[race], u = { id: s.nextId++, race, side, x, y, name: m?.name ?? d.name, hp: m?.hp ?? d.hp, max: m?.hp ?? d.hp, maxTu: m?.tu ?? d.tu, tu: m?.tu ?? d.tu, firing: m?.firing ?? d.firing, react: m?.react ?? d.react,
    armor: d.armor, weapon: d.weapon, dead: false, face: 1, mem: m, kills: 0 };
  s.units.push(u); return u;
}
export const at = (s, x, y) => s.units.find((u) => !u.dead && u.x === x && u.y === y);
export const live = (s, side) => s.units.filter((u) => !u.dead && u.side === side);
export const solid = (s, x, y) => x < 0 || y < 0 || x >= s.w || y >= s.h || !!s.o[y * s.w + x];
const opaque = (s, x, y) => x < 0 || y < 0 || x >= s.w || y >= s.h || (s.o[y * s.w + x] && s.o[y * s.w + x] !== 'crate');
export function refill(s) { for (const u of s.units) if (!u.dead) u.tu = u.maxTu; }

// ---- line of sight (Bresenham; any opaque tile between the two ends blocks) ----------------------------------------------------
export function los(s, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx - dy, x = x0, y = y0;
  while (x !== x1 || y !== y1) { const e2 = 2 * e; if (e2 > -dy) { e -= dy; x += sx; } if (e2 < dx) { e += dx; y += sy; } if ((x !== x1 || y !== y1) && opaque(s, x, y)) return false; }
  return true;
}
export const sees = (s, u, t) => Math.hypot(u.x - t.x, u.y - t.y) <= RACES[u.race].sight && los(s, u.x, u.y, t.x, t.y);
/** Tiles currently visible to side 'x'. s.seen = tiles ever seen. */
export function computeSeen(s) {
  s.vis = new Set(); s.seen ??= new Set();
  for (const u of live(s, 'x')) for (let y = Math.max(0, u.y - 14); y <= Math.min(s.h - 1, u.y + 14); y++) for (let x = Math.max(0, u.x - 14); x <= Math.min(s.w - 1, u.x + 14); x++) if (Math.hypot(x - u.x, y - u.y) <= 14 && los(s, u.x, u.y, x, y)) { s.vis.add(key(x, y)); s.seen.add(key(x, y)); }
}
export const visibleAlien = (s, a) => s.vis?.has(key(a.x, a.y));

// ---- movement: Dijkstra over TU cost (4 straight, 6 diagonal) ------------------------------------------------------------------------
export function reach(s, u, maxTu = 999) {
  const best = new Map([[key(u.x, u.y), { tu: 0, from: null }]]), open = [[0, u.x, u.y]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]); const [c, x, y] = open.shift(); if (c > best.get(key(x, y)).tu) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
      if (solid(s, nx, ny) || at(s, nx, ny)) continue; if (dx && dy && (solid(s, x + dx, y) || solid(s, x, y + dy))) continue;
      const nc = c + (dx && dy ? 6 : 4); if (nc > maxTu) continue; const k = key(nx, ny); if (!best.has(k) || nc < best.get(k).tu) { best.set(k, { tu: nc, from: key(x, y) }); open.push([nc, nx, ny]); }
    }
  }
  return best;
}
export function pathTo(r, tx, ty) { const out = []; let k = key(tx, ty); while (r.has(k) && r.get(k).from !== null) { out.push([k % 32, (k / 32) | 0]); k = r.get(k).from; } return out.reverse(); }

// ---- shooting ---------------------------------------------------------------------------------------------------------------------------
export const shotCost = (u, mode) => Math.ceil(u.maxTu * WEAPONS[u.weapon][mode][1] / 100);
export function hitChance(s, u, t, mode) {
  const w = WEAPONS[u.weapon], d = Math.hypot(u.x - t.x, u.y - t.y);
  return Math.max(5, Math.min(95, Math.round((u.firing * w[mode][0] / 100 - Math.max(0, d - 8) * 2) * (u.side === 'a' ? 0.85 : 1))));
}
export function canShoot(s, u, t, mode) {
  if (u.dead || t.dead) return 'NO TARGET'; if (!los(s, u.x, u.y, t.x, t.y)) return 'NO LINE OF FIRE';
  if (Math.hypot(u.x - t.x, u.y - t.y) > 20) return 'OUT OF RANGE'; if (u.tu < shotCost(u, mode)) return 'NOT ENOUGH TU'; return null;
}
/** Fire; returns events. Spends TU, rolls each shot, applies damage, may kill. */
export function shoot(s, u, t, mode) {
  const ev = []; const why = canShoot(s, u, t, mode); if (why) return { why, ev };
  const w = WEAPONS[u.weapon], n = mode === 'auto' ? w.burst : 1, chance = hitChance(s, u, t, mode); u.tu -= shotCost(u, mode); u.face = t.x >= u.x ? 1 : -1;
  for (let i = 0; i < n && !t.dead; i++) {
    const hit = s.rnd() * 100 < chance; let dmg = 0;
    if (hit) { dmg = Math.max(0, Math.round(s.rnd() * 2 * w.power) - t.armor); t.hp -= dmg; }
    ev.push({ t: 'shot', from: u.id, to: t.id, shot: w.shot, hit, dmg, fx: u.x, fy: u.y, tx: t.x, ty: t.y });
    if (t.hp <= 0) { t.dead = true; t.hp = 0; u.kills++; if (u.mem) u.mem.kills++; if (t.side === 'a') s.kills++; ev.push({ t: 'die', id: t.id, x: t.x, y: t.y, race: t.race }); }
  }
  s.alert = true; check(s); computeSeen(s); return { ev };
}
function check(s) { if (!live(s, 'a').length) s.result = 'win'; else if (!live(s, 'x').length) s.result = 'lose'; }

// ---- one step of movement with reaction fire ------------------------------------------------------------------------------------------
/** Move u one tile (caller checked reach). Returns events; stops (events contain {t:'stop'}) if somebody reacted. */
export function stepMove(s, u, nx, ny) {
  const ev = [], cost = nx !== u.x && ny !== u.y ? 6 : 4; if (u.tu < cost) return [{ t: 'stop' }];
  u.tu -= cost; ev.push({ t: 'move', id: u.id, x0: u.x, y0: u.y, x: nx, y: ny }); u.face = nx >= u.x ? 1 : -1; u.x = nx; u.y = ny; computeSeen(s);
  // reaction fire: every enemy that can see the mover and has TU for a snap shot rolls reactions × TU fraction against the mover's own
  const mover = u.react * u.tu / u.maxTu;
  const reactors = live(s, u.side === 'x' ? 'a' : 'x').filter((e) => sees(s, e, u) && e.tu >= shotCost(e, 'snap') && e.react * e.tu / e.maxTu > mover).sort((a, b) => b.react * b.tu / b.maxTu - a.react * a.tu / a.maxTu);
  for (const e of reactors) { if (u.dead) break; const r = shoot(s, e, u, 'snap'); if (r.ev) { ev.push(...r.ev.map((x) => ({ ...x, reaction: true }))); ev.push({ t: 'stop' }); } }
  if (u.dead) ev.push({ t: 'stop' }); return ev;
}
export function moveTo(s, u, tx, ty) {
  const r = reach(s, u, u.tu), p = pathTo(r, tx, ty), ev = []; if (!p.length) return ev;
  for (const [x, y] of p) { const e = stepMove(s, u, x, y); ev.push(...e); if (e.some((q) => q.t === 'stop')) break; } return ev;
}

// ---- alien turn (computed instantly, the view replays the event list) ---------------------------------------------------------------------
export function alienTurn(s) {
  const ev = [];
  for (const a of live(s, 'a')) {
    for (let guard = 0; guard < 10 && !a.dead && !s.result; guard++) {
      const foes = live(s, 'x'); if (!foes.length) break;
      const vis = foes.filter((f) => sees(s, a, f)).sort((p, q) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(a.x - q.x, a.y - q.y));
      if (vis.length) {
        const t = vis.sort((p, q) => p.hp - q.hp)[0], mode = a.tu >= shotCost(a, 'aimed') + 4 && Math.hypot(a.x - t.x, a.y - t.y) > 4 ? 'aimed' : a.tu >= shotCost(a, 'auto') ? 'auto' : 'snap';
        if (a.tu < shotCost(a, 'snap')) break; const r = shoot(s, a, t, a.tu >= shotCost(a, mode) ? mode : 'snap'); if (r.ev) ev.push(...r.ev); else break; continue;
      }
      const near = foes.reduce((m, f) => (Math.hypot(a.x - f.x, a.y - f.y) < m.d ? { d: Math.hypot(a.x - f.x, a.y - f.y), f } : m), { d: 99, f: null });
      if (!(s.alert || s.turn >= 3 || near.d < 11)) break; // sleeping until disturbed
      const R = reach(s, a, a.tu - shotCost(a, 'snap') + 4); let best = null, bs = 1e9;
      for (const [k, v] of R) { const x = k % 32, y = (k / 32) | 0; if (k === key(a.x, a.y)) continue; let sc = Math.hypot(x - near.f.x, y - near.f.y) * 2 + v.tu * 0.05; if (los(s, x, y, near.f.x, near.f.y) && Math.hypot(x - near.f.x, y - near.f.y) <= 12) sc -= 20; if (sc < bs) { bs = sc; best = [x, y]; } }
      if (!best) break; const before = a.tu, e = moveTo(s, a, best[0], best[1]); ev.push(...e); if (a.tu === before || e.some((q) => q.t === 'stop')) { if (a.dead) break; if (a.tu === before) break; }
      if (!e.length) break;
    }
  }
  check(s); return ev;
}
export function endPlayerTurn(s) { s.side = 'a'; const ev = alienTurn(s); s.side = 'x'; s.turn++; refill(s); computeSeen(s); return ev; }

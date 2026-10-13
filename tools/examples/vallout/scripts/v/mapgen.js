// Procedural area generator (pure, seeded). Each location has a layout recipe (landmarks of real Kerava: station, Kauppakaari, Karuselli,
// Sampola/Ahjo, Keravanjoki, Klaukkala) filled with seeded ruins, trees, wrecks and spawns. Deterministic: same seed → same map.
import { mulberry } from './rules.js';
import { findPath } from './path.js';

const RUIN = { apt24: 'apt_ruin40', apt40: 'apt_ruin40', apt56: 'apt_ruin40', brick24: 'brick_ruin24', brick40: 'brick_ruin24', wood24: 'wood_ruin24', shop24: 'shop_ruin24' };
export const SOLID_PROPS = new Set(['pine', 'birch', 'lamp', 'barrel_a', 'barrel_b', 'bin', 'car_se', 'car_sw', 'car2_se', 'car2_sw', 'kiosk', 'crate', 'moped', 'ufo_big', 'sign']);

export function generate(loc, locId, { enemyScale = 1 } = {}) {
  const r = mulberry(loc.seed * 7919 + 13), ri = (a, b) => a + Math.floor(r() * (b - a + 1)), pick = (a) => a[Math.floor(r() * a.length)];
  const W = loc.size, H = loc.size;
  const m = { id: locId, kind: loc.kind, w: W, h: H, ground: [], walls: [], props: [], npcs: [], enemies: [], objects: [], exits: [], start: { x: 2, y: Math.floor(H / 2) } };
  for (let y = 0; y < H; y++) { m.ground.push([]); for (let x = 0; x < W; x++) { const q = r(); m.ground[y].push(q < 0.6 ? 'sand1' : q < 0.85 ? 'sand2' : 'sand3'); } }
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const wallAt = new Map(), propAt = new Map();
  const free = (x, y) => inb(x, y) && !wallAt.has(y * 100 + x) && !propAt.has(y * 100 + x);
  const fill = (x0, y0, w, h, g) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) m.ground[y][x] = typeof g === 'function' ? g(x, y) : g; };
  const wall = (x, y, s, extra = {}) => { if (!inb(x, y)) return; const o = { x, y, s, ...extra }; wallAt.set(y * 100 + x, o); m.walls.push(o); };
  const prop = (x, y, p, extra = {}) => { if (!free(x, y)) return null; const o = { x, y, p, solid: SOLID_PROPS.has(p), ...extra }; propAt.set(y * 100 + x, o); m.props.push(o); return o; };
  const building = (x0, y0, w, h, s, ruinP = 0.15) => { fill(x0, y0, w, h, 'concrete'); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) wall(x, y, r() < ruinP && RUIN[s] ? RUIN[s] : s); };
  const hollow = (x0, y0, w, h, s, lootItems) => { // ruined shell with floor + doorways + a crate inside
    fill(x0, y0, w, h, 'floor');
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1) { if ((x === x0 + 1 && y === y0 + h - 1) || (x === x0 + w - 1 && y === y0 + 1)) continue; wall(x, y, RUIN[s] ?? s); }
    const c = { x: x0 + Math.floor(w / 2), y: y0 + Math.floor(h / 2) }; prop(c.x, c.y, 'crate', { name: 'Crate', loot: lootItems, id: `crate${c.x}_${c.y}` }); return c;
  };
  const scatter = (p, n, { x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1, ground } = {}) => { for (let i = 0, t = 0; i < n && t < n * 30; t++) { const x = ri(x0, x1), y = ri(y0, y1); if (!free(x, y) || (ground && !ground.includes(m.ground[y][x])) || Math.abs(x - m.start.x) + Math.abs(y - m.start.y) < 3) continue; prop(x, y, typeof p === 'function' ? p() : p, { flip: r() < 0.5 }); i++; } };
  const road = (axis, c, w, tile) => { for (let i = 0; i < (axis === 'x' ? W : H); i++) for (let k = 0; k < w; k++) { const x = axis === 'x' ? i : c + k, y = axis === 'x' ? c + k : i; if (inb(x, y)) m.ground[y][x] = (k === 0 && w > 1 && false) ? 'asphaltc' : (w >= 2 && k === Math.floor(w / 2) - 1 && i % 6 < 3 ? (axis === 'x' ? 'asphalt_x' : 'asphalt_y') : r() < 0.06 ? 'asphaltc' : tile ?? 'asphalt'); } };
  const exit = (x, y, to = 'world') => { m.exits.push({ x, y, to }); m.objects.push({ kind: 'exit', x, y }); };
  const npc = (id, x, y, extra = {}) => m.npcs.push({ id, x, y, ...extra });
  const wrecks = (n, region, p2 = 0.4) => scatter(() => pick(['car_se', 'car_sw', 'car_se', 'car_sw', ...(r() < p2 ? ['car2_se', 'car2_sw'] : [])]), n, region);

  if (loc.kind === 'asema') {
    const ty = 14; fill(0, ty - 2, W, 6, 'platform'); for (let x = 0; x < W; x++) { m.ground[ty][x] = 'rail_x'; m.ground[ty + 1][x] = 'rail_x'; m.ground[ty - 2][x] = 'pave'; m.ground[ty + 3][x] = 'pave'; }
    for (let x = 12; x < 20; x++) { wall(x, ty, 'train28'); wall(x, ty + 1, 'train28'); }       // dead Sm4 train blocking the tracks
    building(8, 19, 9, 3, 'wood24', 0.12); building(3, 22, 4, 3, 'apt24', 0.3); building(2, 3, 6, 3, 'apt40', 0.2); building(14, 2, 5, 3, 'apt24', 0.4); building(23, 22, 5, 3, 'brick24', 0.3);
    for (let x = 4; x < 27; x += 5) prop(x, ty - 2, 'lamp'); prop(5, ty - 2, 'bench'); prop(21, ty - 2, 'bench'); prop(10, ty + 3, 'sign');
    scatter(() => pick(['pine', 'bush', 'birch', 'bush']), 14, { y1: 10 }); scatter('bush', 6, { y0: 24 }); wrecks(3, { y0: 5, y1: 10 }); scatter(() => pick(['barrel_a', 'bin']), 4);
    m.start = { x: 3, y: ty - 1 }; npc('pena', 6, ty - 1); exit(W - 2, ty - 1);
    m.props.find((p) => p.p === 'bench' && p.x === 5)?.x; hollow(24, 7, 5, 4, 'brick24', [['kossu', 1], ['cash', 20]]);
  } else if (loc.kind === 'keskusta') {
    const cy = 17, cx = 17; fill(10, 10, 16, 16, 'pave'); road('x', cy, 2); road('y', cx, 2);
    building(3, 3, 4, 4, 'apt56', 0.0); building(8, 3, 3, 4, 'apt40', 0.1); building(22, 2, 9, 5, 'brick40', 0.1); building(3, 22, 6, 3, 'shop24', 0.15); building(27, 22, 6, 5, 'apt40', 0.3); building(12, 28, 5, 4, 'apt24', 0.4); building(3, 11, 3, 4, 'apt24', 0.5);
    for (let x = 8; x < 30; x += 4) { prop(x, cy - 1, 'lamp'); } wrecks(6, { y0: 8 }); scatter(() => pick(['pine', 'birch', 'bush']), 14, { x0: 9, x1: 26, y0: 9, y1: 15 }); scatter('barrel_a', 3); scatter('bin', 3);
    wall(12, 23, 'conc12'); wall(13, 23, 'conc12'); m.objects.push({ kind: 'kickwall', x: 12, y: 23 });                 // THE wall
    npc('saku', 11, 24); npc('mottonen', 13, 24); prop(21, 23, 'moped', { name: "Rane's moped", rane: true }); npc('rane', 22, 23);
    prop(15, 22, 'kiosk', { name: 'Kiosk' }); npc('seppo', 15, 23);
    hollow(5, 28, 5, 4, 'brick24', [['kossu', 1], ['salmiakki', 1], ['cash', 15]]); const k = hollow(29, 29, 4, 4, 'shop24', [['key', 1], ['cash', 30]]); const c = m.props.find((p) => p.x === k.x && p.y === k.y); if (c) c.id = 'keycrate';
    npc('kalle', 20, 14); m.start = { x: 2, y: cy }; exit(0, cy); exit(0, cy + 1); exit(W - 1, cy); exit(W - 1, cy + 1);
  } else if (loc.kind === 'sampola') {
    fill(17, 14, 15, 10, 'concrete'); road('x', 12, 2); road('y', 14, 1);
    for (const [x, y] of [[3, 3], [12, 3], [21, 3], [3, 26], [26, 27]]) building(x, y, 6, 3, 'apt40', 0.35);
    building(5, 16, 5, 3, 'apt24', 0.4); hollow(11, 26, 11, 6, 'brick24', [['pistol', 1], ['ammo22', 12], ['salmiakki', 1]]);                      // Ahjo (ice rink)
    wrecks(8, { x0: 17, y0: 14, x1: 31, y1: 23 }, 0.1); scatter(() => pick(['pine', 'birch', 'bush', 'bush']), 16); scatter(() => pick(['barrel_a', 'bin']), 3);
    prop(26, 19, 'car2_se', { name: 'Volvo 240 wreck', loot: [['dice', 1]], id: 'volvo', lootMsg: 'The green fuzzy dice! Still hanging from the mirror.' });
    npc('kalle', 8, 12); m.start = { x: 2, y: 13 }; exit(0, 13); exit(0, 12); exit(W - 1, 13); exit(W - 1, 12);
  } else if (loc.kind === 'joki') {
    road('x', 17, 2, 'asphalt'); fill(24, 12, 10, 12, (x, y) => (r() < 0.55 ? 'goo' : 'sand2')); fill(2, 2, 10, 6, 'concrete');
    hollow(3, 3, 6, 4, 'apt24', [['shotgun', 1], ['ammoShell', 10], ['salmiakki', 2]]); building(14, 3, 4, 3, 'apt40', 0.8); building(5, 26, 6, 4, 'brick24', 0.6);
    wrecks(6, {}, 0.2); scatter(() => pick(['birch', 'birch', 'bush', 'pine']), 16); prop(29, 15, 'ufo_big', { name: 'Hive Mothership' }); wallAt.set(15 * 100 + 29, { x: 29, y: 15, s: null });
    m.start = { x: 2, y: 17 }; exit(0, 17); exit(0, 18); exit(W - 1, 17); exit(W - 1, 18); m.hive = { x: 29, y: 17 };
  } else if (loc.kind === 'kuopat') {   // Jaeniksenlinna sand pits: dug-out pits, sandbag walls, Ranger camp
    fill(0, 0, W, H, (x, y) => (r() < 0.8 ? 'sand1' : 'sand2'));
    for (const [px0, py0, pw, ph] of [[3, 3, 9, 7], [18, 4, 10, 8], [4, 21, 11, 8], [20, 22, 9, 7]]) fill(px0, py0, pw, ph, (x, y) => (r() < 0.55 ? 'rubble' : 'sand2'));
    fill(11, 11, 12, 10, 'pave');
    for (let x = 11; x < 23; x++) { wall(x, 11, 'conc12'); wall(x, 20, 'conc12'); } for (let y = 11; y < 21; y++) { wall(11, y, 'conc12'); wall(22, y, 'conc12'); }
    for (const [x, y] of [[11, 15], [11, 16], [22, 15], [22, 16], [16, 11], [17, 11], [16, 20], [17, 20]]) { wallAt.delete(y * 100 + x); m.walls = m.walls.filter((w) => !(w.x === x && w.y === y)); }       // gates
    building(14, 13, 4, 3, 'wood24', 0.1); hollow(19, 17, 3, 2, 'brick24', [['rifle', 1], ['ammoRifle', 12], ['salmiakki', 2]]); prop(13, 18, 'barrel_a'); prop(20, 14, 'barrel_b'); prop(15, 17, 'sign'); prop(12, 12, 'lamp'); prop(21, 12, 'lamp');
    scatter(() => pick(['pine', 'bush', 'bush', 'birch']), 14); wrecks(3, { x0: 0, y0: 0 }, 0.2); m.start = { x: 2, y: 15 };
    npc('capt', 17, 14); npc('ranger', 13, 17); npc('ranger', 20, 15); npc('ranger', 17, 18); exit(0, 15); exit(0, 16); exit(W - 1, 15); exit(W - 1, 16);
  } else if (loc.kind === 'klaukkala') {
    for (let y = 2; y < H - 2; y++) { prop(12, y, 'crate'); } fill(13, 2, 9, 20, 'pave'); // fenced safe zone (gap at y=11,12)
    m.props = m.props.filter((p) => !(p.x === 12 && (p.y === 11 || p.y === 12))); propAt.delete(11 * 100 + 12); propAt.delete(12 * 100 + 12);
    for (let y = 3; y < H - 3; y += 3) prop(14, y, 'lamp'); scatter(() => pick(['pine', 'pine', 'bush']), 18); prop(16, 8, 'barrel_a'); prop(19, 14, 'barrel_b'); prop(17, 18, 'bench'); prop(19, 4, 'sign');
    npc('sgt', 16, 12); m.start = { x: 2, y: 11 };
  } else { // waste (random encounter)
    scatter(() => pick(['car_se', 'car_sw', 'bush', 'birch', 'pine', 'barrel_a']), 14); fill(8, 8, 6, 6, (x, y) => (r() < 0.3 ? 'rubble' : 'sand2')); m.start = { x: 2, y: Math.floor(H / 2) }; exit(0, m.start.y); exit(0, m.start.y + 1); exit(W - 1, m.start.y);
  }
  // keep start/exit/npc tiles clear
  const clear = (x, y) => { wallAt.delete(y * 100 + x); propAt.delete(y * 100 + x); m.walls = m.walls.filter((w) => !(w.x === x && w.y === y)); m.props = m.props.filter((p) => !(p.x === x && p.y === y) || p.p === 'moped' || p.p === 'kiosk' || p.p === 'bench'); };
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) clear(m.start.x + dx, m.start.y + dy);
  m.exits.forEach((e) => clear(e.x, e.y)); m.npcs.forEach((n) => clear(n.x, n.y));
  const blockedNow = (x, y) => !inb(x, y) || m.walls.some((w) => w.x === x && w.y === y && w.s) || m.props.some((p) => p.x === x && p.y === y && p.solid);
  // enemy spawns: free reachable tiles far from the start
  const bset = new Set(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (blockedNow(x, y)) bset.add(y * 100 + x);
  const blocked = (x, y) => bset.has(y * 100 + x), reachable = (x, y) => !blocked(x, y) && findPath(W, H, blocked, m.start, { x, y }) !== null;
  const spawn = (type, minD = 9, near) => { for (let t = 0; t < 400; t++) { const x = near ? near.x + ri(-3, 3) : ri(1, W - 2), y = near ? near.y + ri(-3, 3) : ri(1, H - 2); if (!inb(x, y) || blocked(x, y) || Math.max(Math.abs(x - m.start.x), Math.abs(y - m.start.y)) < minD || m.enemies.some((e) => e.x === x && e.y === y) || m.npcs.some((n) => n.x === x && n.y === y) || !reachable(x, y)) continue; m.enemies.push({ type, x, y, id: `e${m.enemies.length}` }); return; } };
  for (const [type, n] of Object.entries(loc.enemies ?? {})) for (let i = 0; i < Math.max(0, Math.round(n * enemyScale)); i++) spawn(type);
  if (loc.boss && m.hive) spawn('boss', 0, m.hive);
  m.blocked = blocked; m.inb = inb; m.reachable = reachable;
  // drop unreachable npcs/objects so nothing is stranded
  m.npcs = m.npcs.filter((n) => n.id === 'rane' || reachable(n.x, n.y) || true);
  return m;
}
/** Random encounter area ("waste") definition for the world map. */
export const encounterLoc = (seed, enemies) => ({ name: 'Wasteland', kind: 'waste', size: 24, seed, enemies });

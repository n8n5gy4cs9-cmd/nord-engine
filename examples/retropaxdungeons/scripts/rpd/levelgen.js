// Sewer level generator in the spirit of SPD's RegularLevel (rooms attached to rooms through doors, a loop pass, water and grass patches,
// entrance + exit stairs, boss arena furthest from the entrance). Simplified, written for Nord; patches are ported from SPD (see patch.js).
import { generatePatch } from './patch.js';
import { distanceMap } from './pathfinder.js';

export const T = { VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, OPEN_DOOR: 4, UP: 5, DOWN: 6, WATER: 7, GRASS: 8 };
export const passableT = (t) => t === T.FLOOR || t === T.DOOR || t === T.OPEN_DOOR || t === T.UP || t === T.DOWN || t === T.WATER || t === T.GRASS;
export const blocksSight = (t) => t === T.WALL || t === T.VOID || t === T.DOOR;

/** @returns {{w,h,terrain,deco,rooms,heroStart,upCell,downCell,bossRoom,entrance}} deco: floor variant / wall decoration per cell (see tiles.json). */
export function generate(rnd, { w = 52, h = 34, rooms: target = 11 } = {}) {
  for (let attempt = 0; attempt < 50; attempt++) { const lv = tryGenerate(rnd, w, h, target); if (lv) return lv; }
  throw new Error('levelgen: failed to build a level');
}

const gapOK = (a, b) => a.x + a.w + 1 <= b.x || b.x + b.w + 1 <= a.x || a.y + a.h + 1 <= b.y || b.y + b.h + 1 <= a.y;

function tryGenerate(rnd, w, h, target) {
  const rooms = [];
  const inBounds = (r) => r.x >= 2 && r.y >= 3 && r.x + r.w <= w - 2 && r.y + r.h <= h - 2;
  const free = (r) => inBounds(r) && rooms.every((o) => gapOK(r, o));
  const link = (a, b, door) => { a.doors.push({ ...door, to: b }); b.doors.push({ ...door, to: a }); };
  const overlapDoor = (a, b) => { // door on the shared wall, or null when the rooms are not exactly 1 wall apart with overlap
    if (a.x + a.w + 1 === b.x || b.x + b.w + 1 === a.x) {
      const lo = Math.max(a.y, b.y), hi = Math.min(a.y + a.h, b.y + b.h) - 1;
      if (hi >= lo) return { x: a.x + a.w + 1 === b.x ? a.x + a.w : b.x + b.w, y: rnd.range(lo, hi) };
    }
    if (a.y + a.h + 1 === b.y || b.y + b.h + 1 === a.y) {
      const lo = Math.max(a.x, b.x), hi = Math.min(a.x + a.w, b.x + b.w) - 1;
      if (hi >= lo) return { y: a.y + a.h + 1 === b.y ? a.y + a.h : b.y + b.h, x: rnd.range(lo, hi) };
    }
    return null;
  };
  const place = (parent, kind, rw, rh, side) => {
    let r;
    if (side === 0) r = { x: parent.x + parent.w + 1, y: rnd.range(parent.y - rh + 1, parent.y + parent.h - 1) }; // east
    else if (side === 1) r = { x: parent.x - 1 - rw, y: rnd.range(parent.y - rh + 1, parent.y + parent.h - 1) }; // west
    else if (side === 2) r = { y: parent.y + parent.h + 1, x: rnd.range(parent.x - rw + 1, parent.x + parent.w - 1) }; // south
    else r = { y: parent.y - 1 - rh, x: rnd.range(parent.x - rw + 1, parent.x + parent.w - 1) }; // north
    r = { ...r, w: rw, h: rh, kind, doors: [] };
    if (!free(r)) return null;
    const door = overlapDoor(parent, r);
    if (!door) return null;
    rooms.push(r); link(parent, r, door);
    return r;
  };

  // entrance room near the bottom, random x
  const entrance = { x: rnd.range(3, w - 14), y: h - 11, w: rnd.range(6, 8), h: rnd.range(5, 6), kind: 'entrance', doors: [] };
  if (!inBounds(entrance)) return null;
  rooms.push(entrance);

  for (let tries = 0; tries < 500 && rooms.length < target - 1; tries++) {
    const parent = rnd.float() < 0.3 ? rooms[rooms.length - 1] : rnd.pick(rooms);
    const side = rnd.int(4);
    if (parent.kind === 'tunnel' && ((parent.w === 1) === (side < 2))) continue; // tunnels continue along their axis
    if (rnd.float() < 0.2) {
      const horizontal = side < 2;
      place(parent, 'tunnel', horizontal ? rnd.range(3, 8) : 1, horizontal ? 1 : rnd.range(3, 7), side);
    } else place(parent, 'standard', rnd.range(4, 8), rnd.range(4, 7), side);
  }

  // distance in rooms from the entrance
  const rd = new Map([[entrance, 0]]); const q = [entrance];
  for (let i = 0; i < q.length; i++) for (const d of q[i].doors) if (!rd.has(d.to)) { rd.set(d.to, rd.get(q[i]) + 1); q.push(d.to); }
  // boss arena: big room hanging off the furthest non-tunnel room
  const cands = rooms.filter((r) => r.kind !== 'tunnel' && r !== entrance).sort((a, b) => rd.get(b) - rd.get(a));
  let boss = null;
  for (const p of cands.slice(0, 5)) { for (const side of rnd.shuffle([0, 1, 2, 3])) { boss = place(p, 'boss', rnd.range(8, 9), rnd.range(7, 8), side); if (boss) break; } if (boss) break; }
  if (!boss || rooms.filter((r) => r.kind === 'standard').length < 4) return null;

  // loop pass: extra doors between rooms that share a wall
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i], b = rooms[j];
    if (a.kind === 'boss' || b.kind === 'boss' || a.doors.some((d) => d.to === b) || rnd.float() > 0.4) continue;
    const door = overlapDoor(a, b); if (door) link(a, b, door);
  }

  // ---- paint
  const terrain = new Uint8Array(w * h).fill(T.WALL);
  const deco = new Uint8Array(w * h);
  const at = (x, y) => y * w + x;
  const roomOf = new Int16Array(w * h).fill(-1);
  rooms.forEach((r, ri) => { r.index = ri; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { terrain[at(x, y)] = T.FLOOR; roomOf[at(x, y)] = ri; } });
  const doorCells = new Set();
  for (const r of rooms) for (const d of r.doors) { terrain[at(d.x, d.y)] = T.DOOR; doorCells.add(at(d.x, d.y)); }

  // stairs sit in the north wall of their room
  const stairs = (r, avoidDoors) => {
    const xs = []; for (let x = r.x + 1; x < r.x + r.w - 1; x++) { const c = at(x, r.y - 1); if (terrain[c] === T.WALL && !doorCells.has(c) && !doorCells.has(at(x - 1, r.y - 1)) && !doorCells.has(at(x + 1, r.y - 1))) xs.push(x); }
    return xs.length ? at(rnd.pick(xs), r.y - 1) : -1;
  };
  const upCell = stairs(entrance), downCell = stairs(boss);
  if (upCell < 0 || downCell < 0) return null;
  terrain[upCell] = T.UP; terrain[downCell] = T.DOWN;
  const heroStart = upCell + w;

  // water + grass patches (floor cells only, never next to doors/stairs so paths stay clear)
  const keepClear = new Set([heroStart, downCell + w]);
  for (const c of [...doorCells, upCell, downCell]) for (const d of [-w, w, -1, 1, 0]) keepClear.add(c + d);
  const wet = generatePatch(rnd, w, h, 0.3, 4, true), wetBoss = generatePatch(rnd, w, h, 0.5, 4, true), grassP = generatePatch(rnd, w, h, 0.3, 3, true);
  for (let i = 0; i < w * h; i++) {
    if (terrain[i] !== T.FLOOR || keepClear.has(i)) continue;
    const r = rooms[roomOf[i]];
    if (r.kind === 'entrance') { if (grassP[i] && rnd.float() < 0.5) terrain[i] = T.GRASS; continue; }
    if (r.kind === 'boss' ? wetBoss[i] : (wet[i] && r.kind === 'standard')) terrain[i] = T.WATER;
    else if (grassP[i]) terrain[i] = T.GRASS;
  }
  // decoration: floor variants + bones, moss/torch walls
  for (let i = 0; i < w * h; i++) {
    if (terrain[i] === T.FLOOR) { const f = rnd.float(); deco[i] = f < 0.62 ? 0 : f < 0.84 ? 1 : f < 0.94 ? 2 : 3; } // 0..2 floor1-3, 3 bones
    else if (terrain[i] === T.WALL) { const f = rnd.float(); deco[i] = f < 0.1 ? 1 : 0; } // 1 = moss
  }
  for (const r of rooms) if (r.kind !== 'tunnel') for (let x = r.x + 1; x < r.x + r.w - 1; x += 3) { const c = at(x, r.y - 1); if (terrain[c] === T.WALL && rnd.float() < 0.45) deco[c] = 2; } // 2 = torch

  // sanity: everything reachable from the hero start
  const pass = (i) => passableT(terrain[i]);
  const dm = distanceMap(w, h, heroStart, pass);
  if (dm[downCell] === 0x7fff) return null;
  for (const r of rooms) if (dm[at(r.x, r.y)] === 0x7fff) return null;
  return { w, h, terrain, deco, roomOf, rooms, heroStart, upCell, downCell, bossRoom: boss, entrance };
}

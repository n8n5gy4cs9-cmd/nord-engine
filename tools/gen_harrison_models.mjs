#!/usr/bin/env node
// Generates Harrison's Command's low-poly models (carrier, Walrus tank, Manta flyer, enemy tower, islands) → tools/examples/harrison/assets/models/*.glb
// Layout numbers come from the game's own scripts/hc/layout.js. Re-runnable. usage: node tools/gen_harrison_models.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Mesh, writeGlb } from './gen/glb.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/examples/harrison/assets/models');
const L = await import(pathToFileURL(path.join(ROOT, 'tools/examples/harrison/scripts/hc/layout.js')).href);
const rgb = (hex, a = 1) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, a];
const MATS = {
  hull: { color: rgb('#5d6f80') }, hullTop: { color: rgb('#7d8c99') }, deck: { color: rgb('#5a6068') }, deckDock: { color: rgb('#46505c') }, wall: { color: rgb('#aeb8c2') }, floor: { color: rgb('#6c7a8a') }, roof: { color: rgb('#88939e') },
  dark: { color: rgb('#262b33') }, white: { color: rgb('#e8ecef') }, yellow: { color: rgb('#e0b030') }, red: { color: rgb('#c0382b') }, orange: { color: rgb('#e8782c') },
  glass: { color: rgb('#5fb8e8', 0.45), emissive: [0.02, 0.06, 0.1], rough: 0.1 }, light: { color: rgb('#fff6c8'), emissive: [1, 0.95, 0.7] },
  cargoRed: { color: rgb('#b8432f') }, cargoBlue: { color: rgb('#2f6ab8') }, cargoYellow: { color: rgb('#d9a92a') }, rail: { color: rgb('#d8dde2') },
  team: { color: rgb('#2f7fd0') }, teamDark: { color: rgb('#1f4f88') }, metal: { color: rgb('#7a828c') }, enemy: { color: rgb('#c4382c') }, enemyDark: { color: rgb('#7a1f1a') }, concrete: { color: rgb('#9a9a90') },
  terrain: { color: [1, 1, 1, 1], rough: 1 },
};
const set = (...names) => Object.fromEntries(names.map((n) => [n, new Mesh(n)]));

// ============================ carrier ============================
function carrier() {
  const M = set('hull', 'hullTop', 'deck', 'deckDock', 'wall', 'floor', 'roof', 'dark', 'white', 'yellow', 'red', 'orange', 'glass', 'light', 'cargoRed', 'cargoBlue', 'cargoYellow', 'rail');
  const { z: Z, b: B, d: D } = L.HULL;
  const sec = (i) => [[-B[i], 0], [-B[i] * 0.8, -D[i] * 0.5], [-B[i] * 0.38, -D[i]], [B[i] * 0.38, -D[i]], [B[i] * 0.8, -D[i] * 0.5], [B[i], 0]].map(([x, y]) => [x, y, Z[i]]);
  for (let i = 0; i + 1 < Z.length; i++) {
    const a = sec(i), b = sec(i + 1), mid = [0, -D[i] * 0.4, (Z[i] + Z[i + 1]) / 2];
    for (let k = 0; k < 5; k++) M.hull.quad(a[k], a[k + 1], b[k + 1], b[k], mid);
    M.deck.quad([-B[i], 0, Z[i]], [-B[i + 1], 0, Z[i + 1]], [B[i + 1], 0, Z[i + 1]], [B[i], 0, Z[i]], [0, -3, (Z[i] + Z[i + 1]) / 2]);
  }
  const s0 = sec(0), s1 = sec(Z.length - 1); for (let k = 1; k < 5; k++) { M.hull.tri(s0[0], s0[k], s0[k + 1], [0, -2, Z[0] + 5]); M.hull.tri(s1[0], s1[k], s1[k + 1], [0, -1, Z[Z.length - 1] - 3]); }
  // stern dock plate + yellow edge stripes
  M.deckDock.box(0, 0.02, -41, 17, 0.04, 14); for (const x of [-8.6, 8.6]) M.yellow.box(x, 0.05, -41, 0.25, 0.04, 14); M.yellow.box(0, 0.05, -34.1, 17, 0.04, 0.25);
  // deck centre line + bow numbers (simple bars)
  for (let z = 4; z < 40; z += 6) M.white.box(0, 0.03, z, 0.3, 0.03, 3);
  // railings along both sides, following the hull outline
  for (let i = 0; i + 1 < Z.length; i++) for (const sg of [-1, 1]) {
    const x0 = sg * (B[i] - 0.3), x1 = sg * (B[i + 1] - 0.3), len = Math.hypot(x1 - x0, Z[i + 1] - Z[i]), yaw = Math.atan2(x1 - x0, Z[i + 1] - Z[i]);
    M.rail.box((x0 + x1) / 2, 1.0, (Z[i] + Z[i + 1]) / 2, 0.08, 0.08, len, yaw); M.rail.box((x0 + x1) / 2, 0.55, (Z[i] + Z[i + 1]) / 2, 0.06, 0.06, len, yaw);
    for (let k = 0; k <= 3; k++) { const t = k / 3; M.rail.box(x0 + (x1 - x0) * t, 0.5, Z[i] + (Z[i + 1] - Z[i]) * t, 0.08, 1, 0.08); }
  }
  // command centre: floor, walls (bow wall has glass windows), roof
  const R = L.ROOM, W = R.wall;
  M.floor.box(0, 0.03, (R.z0 + R.z1) / 2, R.x1 - R.x0, 0.06, R.z1 - R.z0);
  for (const [x0, z0, x1, z1] of L.WALLS) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = x1 - x0, sz = z1 - z0, bow = Math.abs(z0 - R.z1) < 0.01;
    if (bow) { M.wall.box(cx, 0.55, cz, sx, 1.1, sz); M.wall.box(cx, R.h - 0.3, cz, sx, 0.6, sz); M.glass.box(cx, 2.1, cz, sx, 2.5, sz * 0.5); } else M.wall.box(cx, R.h / 2, cz, sx, R.h, sz);
  }
  for (const x of [-R.door - 0.15, R.door + 0.15]) for (const z of [R.z1 + W / 2, R.z0 - W / 2]) M.yellow.box(x, R.h / 2 - 0.3, z, 0.3, R.h - 0.6, W + 0.1);
  M.roof.box(0, R.h + 0.2, (R.z0 + R.z1) / 2, R.x1 - R.x0 + 1, 0.4, R.z1 - R.z0 + 1);
  for (const z of [-9, -14, -19, -24]) M.light.box(0, R.h - 0.05, z, 1.6, 0.08, 0.5);
  // consoles
  for (const s of Object.values(L.STATIONS)) {
    const [x0, z0, x1, z1] = s.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; M.dark.box(cx, 0.55, cz, x1 - x0, 1.1, z1 - z0); M.wall.box(cx, 1.15, cz, x1 - x0 + 0.05, 0.1, z1 - z0 + 0.05);
    const sc = s.screen, fx = sc.n[0] ? 0.12 : sc.w + 0.2, fz = sc.n[2] ? 0.12 : sc.w + 0.2; M.dark.box(sc.c[0] - sc.n[0] * 0.08, sc.c[1], sc.c[2] - sc.n[2] * 0.08, sc.n[0] ? fx : fx, sc.h + 0.2, sc.n[0] ? fz : fz);
  }
  // bridge tower above the roof: windowed cab, radar mast, funnel
  const t0 = -22, t1 = -10; M.wall.box(0, R.h + 0.4 + 1.9, (t0 + t1) / 2, 11, 3.6, t1 - t0 - 0); M.glass.box(0, R.h + 0.4 + 2.2, t1 + 0.02, 10, 1.5, 0.06); M.glass.box(0, R.h + 0.4 + 2.2, t0 - 0.02, 10, 1.5, 0.06);
  M.glass.box(5.52, R.h + 0.4 + 2.2, (t0 + t1) / 2, 0.06, 1.5, 11); M.glass.box(-5.52, R.h + 0.4 + 2.2, (t0 + t1) / 2, 0.06, 1.5, 11); M.roof.box(0, R.h + 0.4 + 3.9, (t0 + t1) / 2, 12, 0.3, t1 - t0 + 1);
  M.dark.cyl(0, R.h + 4.3, R.h + 9, -16, 0.18, 0.12, 6); M.white.box(0, R.h + 7, -16, 3.2, 0.12, 0.5); M.red.cyl(0, R.h + 9, R.h + 9.8, -16, 0.1, 0.02, 6);
  M.dark.cyl(0, R.h + 4.3, R.h + 5.0, -14.5, 0.9, 0.9, 8); M.white.box(0, R.h + 5.15, -14.5, 1.6, 0.1, 1.6);
  M.dark.cyl(-3.8, R.h + 4.2, R.h + 7.2, -20, 1.0, 0.8, 8); M.orange.cyl(-3.8, R.h + 7.2, R.h + 7.5, -20, 0.82, 0.82, 8);
  // deck cargo, bollards, helipad markings at the bow
  for (const [x, z, sx, sz, h, c] of L.CRATES) { M[c].box(x, h / 2, z, sx, h, sz); M.dark.box(x, h + 0.04, z, sx * 0.9, 0.08, sz * 0.9); for (let k = -1; k <= 1; k++) M.dark.box(x, h / 2, z + k * sz / 3, sx + 0.04, h - 0.3, 0.06); }
  M.yellow.cyl(0, 0.04, 0.06, 36, 5.2, 5.2, 12); M.deck.cyl(0, 0.05, 0.07, 36, 4.9, 4.9, 12); for (const x of [-1.4, 1.4]) M.white.box(x, 0.08, 36, 0.5, 0.03, 3.4); M.white.box(0, 0.08, 36, 2.8, 0.03, 0.5);
  for (const [x, z] of [[-9.8, 40], [9.8, 40], [-10.2, -45], [10.2, -45]]) M.dark.cyl(x, 0, 0.7, z, 0.25, 0.3, 6);
  return [{ name: 'carrier', meshes: Object.values(M) }];
}

// ============================ Walrus (amphibious tank) ============================
function walrus() {
  const body = set('team', 'teamDark', 'dark', 'metal', 'glass'), turret = set('team', 'dark', 'metal');
  body.team.box(0, 0.95, 0, 2.8, 0.8, 5.2); body.team.box(0, 1.15, 1.9, 2.4, 0.5, 1.4); body.teamDark.box(0, 0.55, 0, 3.2, 0.5, 5.6); // hull + bow wedge + skirt
  body.dark.box(0, 0.25, 0, 3.3, 0.3, 5.7); for (const x of [-1.45, 1.45]) body.dark.box(x, 0.8, 0, 0.5, 0.5, 5.4);
  body.glass.box(0, 1.55, 0.2, 1.6, 0.35, 1.1); body.metal.box(-1.0, 1.4, -2.0, 0.5, 0.5, 0.9); body.metal.box(1.0, 1.4, -2.0, 0.5, 0.5, 0.9);
  turret.team.box(0, 0.3, 0, 1.9, 0.6, 2.0); turret.dark.box(0, 0.7, -0.2, 1.2, 0.25, 1.2); turret.metal.pipe(0, 0.3, 0.8, 3.6, 0.17, 6); turret.dark.box(0, 0.3, 0.9, 0.7, 0.5, 0.5);
  return [{ name: 'walrus', meshes: Object.values(body), children: [{ name: 'turret', t: [0, 1.7, -0.3], meshes: Object.values(turret) }] }];
}
// ============================ Manta (flying wing) ============================
function manta() {
  const m = set('team', 'teamDark', 'dark', 'glass', 'metal');
  m.team.box(0, 0, 0, 1.4, 0.7, 5); m.team.box(0, 0.1, 2.9, 0.9, 0.5, 1.6); m.team.box(0, 0.1, -2.7, 1.2, 0.5, 0.9); m.glass.box(0, 0.45, 0.8, 0.8, 0.4, 1.4);
  for (const sg of [-1, 1]) { m.teamDark.box(sg * 2.6, -0.05, -0.4, 3.6, 0.14, 2.2, sg * 0.28); m.teamDark.box(sg * 4.5, 0.5, -1.1, 0.12, 1.3, 1.2); m.dark.cyl(sg * 1.0, -0.2, 0.15, -2.2, 0.38, 0.32, 6); m.metal.pipe(sg * 1.3, -0.35, 1.5, 3.4, 0.07, 5); }
  m.team.box(0, 0.9, -2.6, 0.12, 1.2, 0.9);
  return [{ name: 'manta', meshes: Object.values(m) }];
}
// ============================ enemy gun tower + mortar pit ============================
function tower() {
  const b = set('concrete', 'enemy', 'enemyDark', 'dark', 'metal', 'glass'), head = set('enemy', 'dark', 'metal');
  b.concrete.cyl(0, 0, 1.2, 0, 2.6, 2.3, 8); b.concrete.cyl(0, 1.2, 4.4, 0, 1.7, 1.5, 8); b.enemyDark.cyl(0, 4.4, 4.7, 0, 2.2, 2.0, 8); b.dark.box(0, 2.6, 1.55, 0.9, 1.2, 0.2);
  head.enemy.cyl(0, 0, 1.2, 0, 1.4, 1.2, 8); head.dark.box(0, 0.6, 1.1, 1.0, 0.4, 0.4); head.metal.pipe(-0.35, 0.6, 1.0, 3.0, 0.14, 6); head.metal.pipe(0.35, 0.6, 1.0, 3.0, 0.14, 6);
  return [{ name: 'tower', meshes: Object.values(b), children: [{ name: 'head', t: [0, 4.7, 0], meshes: Object.values(head) }] }];
}
function mortar() {
  const b = set('concrete', 'enemyDark', 'metal', 'dark'), head = set('enemy', 'metal', 'dark');
  b.concrete.cyl(0, 0, 1.0, 0, 2.8, 2.6, 8); b.dark.cyl(0, 1.0, 1.2, 0, 1.8, 1.8, 8); b.enemyDark.box(2.2, 0.4, 0, 0.8, 0.8, 1.2); b.enemyDark.box(-2.2, 0.4, 0, 0.8, 0.8, 1.2);
  head.enemy.box(0, 0.3, 0, 1.6, 0.6, 1.6); head.metal.pipe(0, 0.9, 0.0, 2.4, 0.3, 6);
  return [{ name: 'mortar', meshes: Object.values(b), children: [{ name: 'head', t: [0, 1.2, 0], meshes: Object.values(head) }] }];
}
// ============================ islands ============================
function island(isl) {
  const m = new Mesh('terrain', 8), N = 44, ext = isl.r * 1.45, step = (2 * ext) / N;
  const P = (i, j) => { const x = isl.x - ext + i * step, z = isl.z - ext + j * step, h = L.islandHeight(isl, x, z); return [x - isl.x, h - 0.8, z - isl.z, h]; };
  const col = (h) => (h < 1.4 ? [0.82, 0.74, 0.5, 1] : h < isl.peak * 0.62 ? [0.32 + 0.05 * Math.sin(h * 3), 0.55, 0.26, 1] : [0.52, 0.5, 0.48, 1]);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); if (a[3] === 0 && b[3] === 0 && c[3] === 0 && d[3] === 0) continue;
    const hh = (a[3] + b[3] + c[3] + d[3]) / 4, up = [(a[0] + c[0]) / 2, -50, (a[2] + c[2]) / 2];
    m.tri(a.slice(0, 3), d.slice(0, 3), c.slice(0, 3), up, col(hh)); m.tri(a.slice(0, 3), c.slice(0, 3), b.slice(0, 3), up, col(hh));
  }
  return [{ name: `island_${isl.id}`, meshes: [m] }];
}

const out = [];
const emit = (file, nodes, mats = MATS) => { const r = writeGlb(path.join(OUT, file), mats, nodes); out.push(`${file}  ${r.triangles} tris  ${(r.bytes / 1024).toFixed(0)} KB`); };
emit('carrier.glb', carrier()); emit('walrus.glb', walrus()); emit('manta.glb', manta()); emit('tower.glb', tower()); emit('mortar.glb', mortar());
for (const isl of L.ISLANDS) emit(`island_${isl.id}.glb`, island(isl));
console.log(out.join('\n'));

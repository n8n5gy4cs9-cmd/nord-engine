#!/usr/bin/env node
// Generates Automies' low-poly models → tools/examples/automies/assets/models/*.glb  (cars with steerable wheel nodes, towers + landmarks, street props).
// Re-runnable: node tools/gen_automies_models.mjs   (then node tools/gen_examples.mjs automies).  Materials are matched BY NAME in the game: body, glass, facadeA..D, roof,
// metal, marble, container, concrete get textures from assets/textures/, the rest are flat colours. +Z = front of a car, +Y up, metres.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mesh, writeGlb } from './gen/glb.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/examples/automies/assets/models');
const rgb = (hex, a = 1) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, a];
const MATS = {
  body: { color: [1, 1, 1, 1], rough: 0.45, metal: 0.25 }, // tinted per car by the game (white here so the tint is exact)
  bodyDark: { color: rgb('#23262e'), rough: 0.5, metal: 0.2 }, white: { color: rgb('#eceff2'), rough: 0.5 }, black: { color: rgb('#16171c') }, dark: { color: rgb('#2a2c34'), rough: 0.9 },
  chrome: { color: rgb('#c8ccd4'), rough: 0.2, metal: 0.8 }, tire: { color: rgb('#1a1a1e'), rough: 1 }, glass: { color: rgb('#5aa8d8', 0.5), emissive: [0.01, 0.03, 0.05], rough: 0.1 },
  light: { color: rgb('#fff4c0'), emissive: [1, 0.95, 0.7] }, tail: { color: rgb('#d0301c'), emissive: [0.7, 0.05, 0.02] }, red: { color: rgb('#d83a2a') }, blue: { color: rgb('#2c64d0') },
  redLight: { color: rgb('#ff3020'), emissive: [1, 0.1, 0.05] }, blueLight: { color: rgb('#2a6aff'), emissive: [0.1, 0.3, 1] }, yellow: { color: rgb('#f0c020') }, checker: { color: rgb('#16171c') },
  facadeA: { color: [1, 1, 1, 1] }, facadeB: { color: [1, 1, 1, 1] }, facadeC: { color: [1, 1, 1, 1] }, facadeD: { color: [1, 1, 1, 1] }, roof: { color: [1, 1, 1, 1] }, metal: { color: [1, 1, 1, 1] },
  marble: { color: [1, 1, 1, 1] }, container: { color: [1, 1, 1, 1] }, concrete: { color: [1, 1, 1, 1] },
  green: { color: rgb('#3f9a4a') }, leaf: { color: rgb('#4a9a3c') }, leaf2: { color: rgb('#6cb446') }, trunk: { color: rgb('#6a4a2c') }, orange: { color: rgb('#f07820') }, shingle: { color: rgb('#8a3a2c') }, wood: { color: rgb('#9a6a3c') },
  cyan: { color: rgb('#2ab0c8') }, stripe: { color: rgb('#f4f4f4') },
};
const set = (...names) => Object.fromEntries(names.map((n) => [n, new Mesh(n, 6)]));
const all = (M) => Object.values(M);

/** Cylinder lying along X (a wheel): centre (cx,cy,cz), radius r, half width hw. */
function cylX(m, cx, cy, cz, r, hw, n = 10) {
  const ring = (x) => Array.from({ length: n }, (_, k) => [x, cy + Math.sin((k / n) * Math.PI * 2) * r, cz + Math.cos((k / n) * Math.PI * 2) * r]);
  const a = ring(cx - hw), b = ring(cx + hw), mid = [cx, cy, cz];
  for (let k = 0; k < n; k++) { const j = (k + 1) % n; m.quad(a[k], a[j], b[j], b[k], mid); }
  for (let k = 1; k < n - 1; k++) { m.tri(a[0], a[k], a[k + 1], mid); m.tri(b[0], b[k], b[k + 1], mid); }
}
/** Cabin loft: bottom (y0) from zf0 (front) to zr0 (rear) with half width w0, top (y1) from zf1 to zr1 with half width w1. Windows on the 4 slanted sides, `roof` material on top. */
function cabin(M, { y0, y1, zf0, zf1, zr1, zr0, w0, w1 }, roofMat = 'body') {
  const P = (x, y, z) => [x, y, z], mid = [0, (y0 + y1) / 2, (zf0 + zr0) / 2];
  const fl0 = P(-w0, y0, zf0), fr0 = P(w0, y0, zf0), rl0 = P(-w0, y0, zr0), rr0 = P(w0, y0, zr0);
  const fl1 = P(-w1, y1, zf1), fr1 = P(w1, y1, zf1), rl1 = P(-w1, y1, zr1), rr1 = P(w1, y1, zr1);
  M.glass.quad(fl0, fr0, fr1, fl1, mid);   // windscreen
  M.glass.quad(rr0, rl0, rl1, rr1, mid);   // rear window
  M.glass.quad(fl0, fl1, rl1, rl0, mid); M.glass.quad(fr0, rr0, rr1, fr1, mid); // side windows
  M[roofMat].quad(fl1, fr1, rr1, rl1, mid);
  // B pillar + window frame hint: two thin body strips down each side at the middle of the cabin
  const zm = (zf1 + zr1) / 2, t = 0.07;
  for (const sg of [-1, 1]) M.body.box(sg * ((w0 + w1) / 2 + 0.01), (y0 + y1) / 2, zm, 0.05, y1 - y0 - 0.02, t);
}
function wheels(spec) {
  const { wb, tr, r = 0.34, hw = 0.13 } = spec, out = [];
  for (const [id, sx, sz] of [['fl', -1, 1], ['fr', 1, 1], ['bl', -1, -1], ['br', 1, -1]]) {
    const w = set('tire', 'chrome'); cylX(w.tire, 0, 0, 0, r, hw); cylX(w.chrome, sx * (hw + 0.005), 0, 0, r * 0.55, 0.012, 8); cylX(w.chrome, sx * (hw + 0.02), 0, 0, r * 0.18, 0.012, 6);
    out.push({ name: `wheel-${id}`, t: [sx * tr / 2, r, sz * wb / 2], meshes: all(w) });
  }
  return out;
}
function lightsAndBumpers(M, L, W, yTop, o = {}) {
  M.light.box(-(W / 2 - 0.4), yTop - 0.28, L / 2 + 0.01, 0.5, 0.16, 0.06); M.light.box(W / 2 - 0.4, yTop - 0.28, L / 2 + 0.01, 0.5, 0.16, 0.06);
  M.tail.box(-(W / 2 - 0.38), yTop - 0.25, -L / 2 - 0.01, 0.55, 0.16, 0.06); M.tail.box(W / 2 - 0.38, yTop - 0.25, -L / 2 - 0.01, 0.55, 0.16, 0.06);
  M.dark.box(0, yTop - 0.38, L / 2 + 0.005, W * 0.5, 0.2, 0.06); // grille
  M.black.box(0, 0.42, L / 2 + 0.03, W - 0.1, 0.2, 0.12); M.black.box(0, 0.42, -L / 2 - 0.03, W - 0.1, 0.2, 0.12);   // bumpers
  M.white.box(0, 0.5, -L / 2 - 0.1, 0.5, 0.14, 0.02);                                                                  // plate
  if (o.exhaust) { M.chrome.box(-0.5, 0.3, -L / 2 - 0.08, 0.12, 0.12, 0.18); M.chrome.box(0.5, 0.3, -L / 2 - 0.08, 0.12, 0.12, 0.18); }
}
const lowerBody = (M, L, W, y0, h, taper = 0.9) => { M.body.box(0, y0 + h / 2, 0, W, h, L); M.body.box(0, y0 + h * 0.5, 0, W * taper + 0.02, h + 0.03, L * 0.98); M.dark.box(0, 0.26, 0, W - 0.1, 0.14, L - 0.3); };

// ---- cars ----------------------------------------------------------------------------------------------------------
function muscle() {
  const L = 4.7, W = 1.9, M = set('body', 'bodyDark', 'glass', 'dark', 'black', 'chrome', 'light', 'tail', 'white', 'stripe'), yTop = 1.0;
  lowerBody(M, L, W, 0.3, 0.7);
  cabin(M, { y0: yTop, y1: 1.5, zf0: 0.45, zf1: -0.25, zr1: -1.2, zr0: -1.55, w0: 0.92, w1: 0.74 });
  M.body.box(0, yTop + 0.02, -1.95, W - 0.1, 0.1, 0.9);                    // trunk lid
  M.bodyDark.box(0, 1.14, -2.28, W - 0.2, 0.06, 0.4); for (const x of [-0.7, 0.7]) M.bodyDark.box(x, 1.06, -2.2, 0.06, 0.2, 0.3); // spoiler
  M.dark.box(0, yTop + 0.08, 1.15, 0.7, 0.1, 0.9);                         // hood scoop
  for (const x of [-0.18, 0.18]) { M.stripe.box(x, yTop + 0.03, 1.2, 0.16, 0.012, 2.1); M.stripe.box(x, yTop + 0.03, -1.95, 0.16, 0.012, 0.88); M.stripe.box(x, 1.505, -0.6, 0.16, 0.012, 1.7); }
  lightsAndBumpers(M, L, W, yTop, { exhaust: true });
  return [{ name: 'muscle', meshes: all(M), children: wheels({ wb: 2.85, tr: 1.62, r: 0.36, hw: 0.16 }) }];
}
function coupe() {
  const L = 4.3, W = 1.85, M = set('body', 'bodyDark', 'glass', 'dark', 'black', 'chrome', 'light', 'tail', 'white', 'stripe'), yTop = 0.85;
  lowerBody(M, L, W, 0.28, 0.57, 0.88);
  M.body.quad([-W * 0.44, yTop, 0.5], [W * 0.44, yTop, 0.5], [W * 0.4, 0.6, L / 2], [-W * 0.4, 0.6, L / 2], [0, 0.6, 0]); // sloped nose
  cabin(M, { y0: yTop, y1: 1.32, zf0: 0.55, zf1: -0.15, zr1: -1.0, zr0: -1.7, w0: 0.88, w1: 0.68 });
  M.bodyDark.box(0, 1.2, -2.05, W - 0.1, 0.07, 0.5); for (const x of [-0.8, 0.8]) M.bodyDark.box(x, 1.05, -2.0, 0.07, 0.34, 0.4); // wing
  M.dark.box(0, 0.78, 1.3, 0.5, 0.03, 0.7); M.stripe.box(0, yTop + 0.015, 0.2, 0.2, 0.012, 0.9);
  lightsAndBumpers(M, L, W, yTop - 0.1, { exhaust: true });
  return [{ name: 'coupe', meshes: all(M), children: wheels({ wb: 2.6, tr: 1.58, r: 0.34, hw: 0.15 }) }];
}
function sedanBase(name, L, W, { police = false, taxi = false } = {}) {
  const M = set('body', 'bodyDark', 'glass', 'dark', 'black', 'chrome', 'light', 'tail', 'white', 'redLight', 'blueLight', 'yellow', 'checker'), yTop = 1.0;
  lowerBody(M, L, W, 0.3, 0.7);
  cabin(M, { y0: yTop, y1: 1.55, zf0: 0.7, zf1: 0.2, zr1: -1.0, zr0: -1.45, w0: 0.9, w1: 0.76 });
  M.body.box(0, yTop + 0.02, -1.85, W - 0.1, 0.1, 0.95);
  lightsAndBumpers(M, L, W, yTop);
  if (police) {
    for (const sg of [-1, 1]) { M.white.box(sg * (W / 2 + 0.005), 0.68, 0.0, 0.03, 0.42, 1.25); M.white.box(sg * (W / 2 + 0.005), 0.68, -1.45, 0.03, 0.42, 0.7); } // door panels
    M.black.box(0, 1.6, -0.1, 1.3, 0.06, 0.34); M.redLight.box(-0.33, 1.65, -0.1, 0.55, 0.12, 0.3); M.blueLight.box(0.33, 1.65, -0.1, 0.55, 0.12, 0.3); // light bar
    M.black.box(0, 0.55, L / 2 + 0.12, W - 0.3, 0.3, 0.1); // push bar
  }
  if (taxi) {
    for (let i = 0; i < 12; i++) { const z = -L / 2 + 0.3 + i * (L - 0.6) / 11; for (const sg of [-1, 1]) (i % 2 ? M.checker : M.white).box(sg * (W / 2 + 0.005), 0.84, z, 0.03, 0.14, (L - 0.6) / 11); }
    M.white.box(0, 1.65, -0.1, 0.7, 0.18, 0.3); M.yellow.box(0, 1.66, -0.1, 0.5, 0.1, 0.32);
  }
  return [{ name, meshes: all(M), children: wheels({ wb: 2.8, tr: 1.6, r: 0.34, hw: 0.14 }) }];
}
function van() {
  const L = 5.0, W = 2.0, M = set('body', 'bodyDark', 'glass', 'dark', 'black', 'chrome', 'light', 'tail', 'white', 'cyan'), yTop = 1.1;
  M.body.box(0, 1.35, -0.7, W, 2.0, 3.6); M.body.box(0, 0.7, 1.35, W, 0.9, 2.3); M.dark.box(0, 0.26, 0, W - 0.1, 0.14, L - 0.3);
  cabin(M, { y0: 1.15, y1: 1.85, zf0: 2.3, zf1: 1.75, zr1: 1.1, zr0: 1.1, w0: 0.92, w1: 0.86 });
  for (const sg of [-1, 1]) M.cyan.box(sg * (W / 2 + 0.005), 1.5, -0.7, 0.03, 0.35, 3.4);
  M.black.box(0, 1.35, -2.5 - 0.005, 0.02, 1.8, 0.02); M.light.box(-0.7, 0.85, L / 2 + 0.01, 0.4, 0.16, 0.06); M.light.box(0.7, 0.85, L / 2 + 0.01, 0.4, 0.16, 0.06);
  M.tail.box(-0.85, 0.75, -L / 2 - 0.01, 0.2, 0.4, 0.06); M.tail.box(0.85, 0.75, -L / 2 - 0.01, 0.2, 0.4, 0.06); M.black.box(0, 0.4, L / 2 + 0.03, W - 0.1, 0.2, 0.12); M.black.box(0, 0.4, -L / 2 - 0.03, W - 0.1, 0.2, 0.12);
  return [{ name: 'van', meshes: all(M), children: wheels({ wb: 3.2, tr: 1.7, r: 0.38, hw: 0.14 }) }];
}

// ---- buildings -----------------------------------------------------------------------------------------------------
const S = 15; // footprint of a block building (a map tile is 18 m)
function tower(name, mat, w, d, h, o = {}) {
  const M = set(mat, 'roof', 'concrete', 'dark', 'metal', 'white'); const m = M[mat];
  M.concrete.box(0, 0.4, 0, w + 0.6, 0.8, d + 0.6);                 // plinth
  m.box(0, h / 2, 0, w, h, d);
  if (o.setback) { m.box(0, h + o.setback / 2, 0, w * 0.6, o.setback, d * 0.6); M.roof.box(0, h + o.setback + 0.1, 0, w * 0.6 + 0.2, 0.2, d * 0.6 + 0.2); }
  M.roof.box(0, h + 0.1, 0, w + 0.3, 0.2, d + 0.3);
  M.concrete.box(w * 0.28, h + 0.65, d * 0.25, 2.2, 1.0, 2.2); M.concrete.box(-w * 0.3, h + 0.5, -d * 0.2, 1.6, 0.8, 1.6); // rooftop plant
  if (o.antenna) { M.dark.cyl(0, h + (o.setback ?? 0) + 0.2, h + (o.setback ?? 0) + 8, 0, 0.12, 0.05, 6); M.white.box(0, h + (o.setback ?? 0) + 6, 0, 1.4, 0.08, 0.08); }
  M.dark.box(0, 1.6, d / 2 + 0.02, 3, 2.4, 0.06); // door
  return [{ name, meshes: all(M) }];
}
function bank() {
  const M = set('marble', 'facadeD', 'roof', 'concrete', 'dark', 'white', 'yellow', 'blue'), W = 16, D = 16;
  M.concrete.box(0, 0.25, 0, W + 1, 0.5, D + 1); for (let i = 0; i < 3; i++) M.concrete.box(0, 0.5 + i * 0.2, D / 2 + 0.9 - i * 0.45, 8, 0.2, 1.2 - i * 0.2); // steps
  M.facadeD.box(0, 4.5, -1, W, 8, D - 2); M.marble.box(0, 4.5, D / 2 - 0.9, W - 3, 8.4, 0.6);
  for (let i = 0; i < 6; i++) M.marble.cyl(-6.25 + i * 2.5, 0.5, 8.7, D / 2 + 0.55, 0.55, 0.5, 8);   // columns
  M.marble.quad([-W / 2 + 0.5, 8.7, D / 2 + 1.3], [W / 2 - 0.5, 8.7, D / 2 + 1.3], [W / 2 - 0.5, 8.7, D / 2 - 0.4], [-W / 2 + 0.5, 8.7, D / 2 - 0.4], [0, 5, 0]);
  M.marble.tri([-W / 2 + 0.5, 8.7, D / 2 + 1.3], [W / 2 - 0.5, 8.7, D / 2 + 1.3], [0, 11, D / 2 + 1.3], [0, 8, D / 2 + 0.2]);
  M.roof.box(0, 8.6, -1, W + 0.4, 0.3, D - 1.6); M.dark.box(0, 2, D / 2 - 0.5, 3, 3.2, 0.1); M.yellow.box(0, 9.4, D / 2 + 1.35, 5, 0.9, 0.2); M.blue.cyl(0, 8.8, 12, -2, 0.1, 0.1, 6); M.white.box(0, 11.5, -2, 1.6, 0.9, 0.05);
  return [{ name: 'bank', meshes: all(M) }];
}
function warehouse() {
  const M = set('metal', 'roof', 'concrete', 'dark', 'container', 'blue', 'green', 'yellow', 'red'), W = 15, D = 15;
  M.concrete.box(0, 0.2, 0, W + 1, 0.4, D + 1); M.metal.box(0, 3.8, -1, W - 3, 6.8, D - 3);
  M.roof.quad([-(W - 3) / 2 - 0.4, 7.2, -D / 2 + 0.9], [(W - 3) / 2 + 0.4, 7.2, -D / 2 + 0.9], [(W - 3) / 2 + 0.4, 8.6, -1], [-(W - 3) / 2 - 0.4, 8.6, -1], [0, 4, -1]);
  M.roof.quad([-(W - 3) / 2 - 0.4, 8.6, -1], [(W - 3) / 2 + 0.4, 8.6, -1], [(W - 3) / 2 + 0.4, 7.2, D / 2 - 1.9 + 0.4], [-(W - 3) / 2 - 0.4, 7.2, D / 2 - 1.9 + 0.4], [0, 4, -1]);
  M.dark.box(-1.5, 2.2, D / 2 - 1.45, 4.2, 4, 0.2); M.yellow.box(-1.5, 4.3, D / 2 - 1.4, 4.4, 0.2, 0.2);
  M.container.box(5.4, 1.4, 5.2, 2.5, 2.6, 6); M.blue.box(5.4, 4.0, 5.2, 2.5, 2.6, 6); M.green.box(-5.6, 1.4, 5.8, 2.5, 2.6, 5); M.container.box(-5.6, 4.0, 5.8, 2.5, 2.6, 5);
  return [{ name: 'warehouse', meshes: all(M) }];
}
function safehouse() {
  const M = set('facadeB', 'shingle', 'concrete', 'dark', 'white', 'glass', 'yellow'), W = 13, D = 11;
  M.concrete.box(0, 0.2, 0, W + 2, 0.4, D + 2); M.facadeB.box(0, 2.9, 0, W, 5, D); M.facadeB.box(W * 0.2, 2.2, D / 2 + 1.5, W * 0.55, 3.6, 3);
  M.shingle.quad([-W / 2 - 0.5, 5.4, -D / 2 - 0.5], [W / 2 + 0.5, 5.4, -D / 2 - 0.5], [W / 2 + 0.5, 7.6, 0], [-W / 2 - 0.5, 7.6, 0], [0, 3, 0]);
  M.shingle.quad([-W / 2 - 0.5, 7.6, 0], [W / 2 + 0.5, 7.6, 0], [W / 2 + 0.5, 5.4, D / 2 + 0.5], [-W / 2 - 0.5, 5.4, D / 2 + 0.5], [0, 3, 0]);
  M.shingle.tri([-W / 2 - 0.5, 5.4, -D / 2 - 0.5], [-W / 2 - 0.5, 7.6, 0], [-W / 2 - 0.5, 5.4, D / 2 + 0.5], [0, 4, 0]);
  M.shingle.box(W * 0.2, 4.2, D / 2 + 1.5, W * 0.55 + 0.6, 0.3, 3.6);
  M.dark.box(W * 0.2, 1.7, D / 2 + 3.02, 4.4, 3.0, 0.1); M.yellow.box(-W * 0.3, 1.2, D / 2 + 0.03, 1.3, 2.2, 0.1); M.glass.box(-W * 0.05, 3.2, D / 2 + 0.03, 1.6, 1.2, 0.08); M.white.box(0, 6.4, 0, 0.5, 2.6, 0.5);
  return [{ name: 'safehouse', meshes: all(M) }];
}

// ---- props ---------------------------------------------------------------------------------------------------------
const prop = (name, build) => { const M = set(...build.mats); build.fn(M); return [{ name, meshes: all(M) }]; };
const cone = () => prop('cone', { mats: ['orange', 'white', 'black'], fn: (M) => { M.black.box(0, 0.03, 0, 0.5, 0.06, 0.5); M.orange.cyl(0, 0.06, 0.7, 0, 0.22, 0.04, 8); M.white.cyl(0, 0.3, 0.42, 0, 0.14, 0.11, 8); } });
const barrier = () => prop('barrier', { mats: ['white', 'red', 'dark'], fn: (M) => { for (let i = 0; i < 4; i++) (i % 2 ? M.white : M.red).box(-1.2 + i * 0.8, 0.85, 0, 0.8, 0.28, 0.06); for (const x of [-1.5, 1.5]) M.dark.box(x, 0.45, 0, 0.1, 0.9, 0.1); } });
const hydrant = () => prop('hydrant', { mats: ['red', 'chrome'], fn: (M) => { M.red.cyl(0, 0, 0.7, 0, 0.18, 0.15, 8); M.red.cyl(0, 0.7, 0.85, 0, 0.2, 0.2, 8); M.chrome.box(0, 0.5, 0, 0.5, 0.1, 0.1); } });
const bin = () => prop('bin', { mats: ['green', 'dark'], fn: (M) => { M.green.cyl(0, 0, 0.9, 0, 0.4, 0.45, 8); M.dark.cyl(0, 0.9, 0.98, 0, 0.47, 0.47, 8); } });
const tree = () => prop('tree', { mats: ['trunk', 'leaf', 'leaf2'], fn: (M) => { M.trunk.cyl(0, 0, 2.4, 0, 0.3, 0.22, 6); M.leaf.cyl(0, 1.6, 3.8, 0, 2.0, 0.9, 7); M.leaf2.cyl(0, 3.3, 5.4, 0, 1.5, 0.15, 7); } });
const crate = () => prop('crate', { mats: ['wood', 'dark'], fn: (M) => { M.wood.box(0, 0.6, 0, 1.2, 1.2, 1.2); for (const y of [0.1, 1.1]) M.dark.box(0, y, 0, 1.25, 0.1, 1.25); } });
const bench = () => prop('bench', { mats: ['wood', 'dark'], fn: (M) => { M.wood.box(0, 0.5, 0, 1.6, 0.1, 0.5); M.wood.box(0, 0.85, -0.22, 1.6, 0.4, 0.08); for (const x of [-0.7, 0.7]) M.dark.box(x, 0.25, 0, 0.1, 0.5, 0.45); } });
const billboard = () => prop('billboard', { mats: ['dark', 'white', 'cyan', 'yellow'], fn: (M) => { for (const x of [-2.2, 2.2]) M.dark.box(x, 3, 0, 0.3, 6, 0.3); M.dark.box(0, 7, 0, 7, 3.2, 0.3); M.cyan.box(0, 7, 0.17, 6.6, 2.8, 0.04); M.yellow.box(-1.5, 7.3, 0.2, 2.4, 0.8, 0.03); M.white.box(1.2, 6.6, 0.2, 3.2, 0.5, 0.03); } });

const MODELS = { muscle: muscle(), coupe: coupe(), cop: sedanBase('cop', 4.8, 1.95, { police: true }), taxi: sedanBase('taxi', 4.6, 1.85, { taxi: true }), van: van(),
  tower_a: tower('tower_a', 'facadeA', 13, 13, 40, { setback: 6, antenna: true }), tower_b: tower('tower_b', 'facadeB', 14, 13, 24), tower_c: tower('tower_c', 'facadeC', 12, 12, 56, { antenna: true, setback: 3 }), tower_d: tower('tower_d', 'facadeD', 14, 14, 30, { setback: 4 }),
  bank: bank(), warehouse: warehouse(), safehouse: safehouse(), cone: cone(), barrier: barrier(), hydrant: hydrant(), bin: bin(), tree: tree(), crate: crate(), bench: bench(), billboard: billboard() };
for (const [name, nodes] of Object.entries(MODELS)) { const r = writeGlb(path.join(OUT, `${name}.glb`), MATS, nodes); console.log(`${name}.glb  ${r.triangles} tris  ${(r.bytes / 1024).toFixed(0)} KB`); }

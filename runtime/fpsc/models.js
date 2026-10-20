// Procedural models for the built-in entities (humanoids, drones, turrets, pickups, props) — built from boxes/cylinders/spheres, no art files.
// A model spec is data:  { kind:'humanoid', ...style } | { kind:'parts', parts:[…], height } | { kind:'billboard', url, w, h } | { kind:'glb', url, scale }
// Part:  { n:'name', g:'group'?, shape:'box'|'cyl'|'sph'|'cone', s:[w,h,d], p:[x,y,z], r:[rx,ry,rz]?, c:'#hex', e:true (glows, ignores light) }
//        { group:'armR', p:[x,y,z], parent:'torso'? }  → named pivot you can animate from a script (model.parts.armR.rotation.x = …)
// Docs: docs/FPS_CREATOR.md §Models.

const hexRgb = (c) => { let h = String(c).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h.slice(0, 6), 16) || 0; return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const D2R = Math.PI / 180;

export function humanoid(o = {}) {
  const sc = o.scale ?? 1, b = o.bulk ?? 1, skin = o.skin ?? '#d6a77f', shirt = o.shirt ?? '#4a5a3c', pants = o.pants ?? '#3a3f35', boots = o.boots ?? '#241f1a';
  const P = [];
  P.push({ group: 'legL', p: [-0.13 * b, 0.85, 0] }, { group: 'legR', p: [0.13 * b, 0.85, 0] }, { group: 'armL', p: [-(0.25 * b + 0.1), 1.45, 0] }, { group: 'armR', p: [0.25 * b + 0.1, 1.45, 0] }, { group: 'head', p: [0, 1.5, 0] });
  for (const s of ['L', 'R']) {
    P.push({ g: `leg${s}`, shape: 'box', s: [0.2 * b, 0.8, 0.22 * b], p: [0, -0.4, 0], c: pants }, { g: `leg${s}`, shape: 'box', s: [0.22 * b, 0.12, 0.3], p: [0, -0.8, 0.04], c: boots });
    const arm = o.arms === 'forward' ? [-1.45, 0, 0] : null;
    P.push({ g: `arm${s}`, shape: 'box', s: [0.15 * b, 0.55, 0.15 * b], p: [0, -0.28, 0], c: shirt }, { g: `arm${s}`, shape: 'box', s: [0.13, 0.13, 0.13], p: [0, -0.6, 0], c: skin });
    if (arm) P.push({ rot: `arm${s}`, r: arm });
  }
  P.push({ shape: 'box', s: [0.5 * b, 0.65, 0.28 * b], p: [0, 1.18, 0], c: shirt });
  if (o.vest) P.push({ shape: 'box', s: [0.52 * b, 0.4, 0.3 * b], p: [0, 1.25, 0], c: o.vest });
  P.push({ shape: 'box', s: [0.52 * b, 0.1, 0.3 * b], p: [0, 0.86, 0], c: o.belt ?? '#2b2b2b' });
  P.push({ g: 'head', shape: 'box', s: [0.27, 0.3, 0.27], p: [0, 0.14, 0], c: skin });
  if (o.hat === 'helmet') P.push({ g: 'head', shape: 'box', s: [0.31, 0.16, 0.31], p: [0, 0.27, 0], c: o.hatColor ?? '#3d4a33' }, { g: 'head', shape: 'box', s: [0.31, 0.05, 0.1], p: [0, 0.21, 0.19], c: o.hatColor ?? '#3d4a33' });
  if (o.hat === 'cap') P.push({ g: 'head', shape: 'box', s: [0.29, 0.07, 0.29], p: [0, 0.28, 0], c: o.hatColor ?? '#2a3a55' }, { g: 'head', shape: 'box', s: [0.29, 0.03, 0.12], p: [0, 0.25, 0.18], c: o.hatColor ?? '#2a3a55' });
  if (o.hair) P.push({ g: 'head', shape: 'box', s: [0.29, 0.1, 0.29], p: [0, 0.27, -0.01], c: o.hair });
  if (o.visor) P.push({ g: 'head', shape: 'box', s: [0.25, 0.07, 0.04], p: [0, 0.16, 0.14], c: o.visor, e: true });
  else P.push({ g: 'head', shape: 'box', s: [0.05, 0.04, 0.03], p: [-0.06, 0.16, 0.14], c: o.eyes ?? '#1a1a1a', e: !!o.eyes }, { g: 'head', shape: 'box', s: [0.05, 0.04, 0.03], p: [0.06, 0.16, 0.14], c: o.eyes ?? '#1a1a1a', e: !!o.eyes });
  if (o.pack) P.push({ shape: 'box', s: [0.34, 0.4, 0.14], p: [0, 1.22, -0.2], c: o.pack });
  if (o.pauldrons) P.push({ g: 'armL', shape: 'box', s: [0.24, 0.12, 0.24], p: [0, 0.02, 0], c: o.pauldrons }, { g: 'armR', shape: 'box', s: [0.24, 0.12, 0.24], p: [0, 0.02, 0], c: o.pauldrons });
  if (o.glowChest) P.push({ shape: 'box', s: [0.16, 0.16, 0.04], p: [0, 1.28, 0.16 * b], c: o.glowChest, e: true });
  if (o.gun) {
    const g = { rifle: [[0.07, 0.1, 0.62], '#262a2f'], pistol: [[0.06, 0.12, 0.26], '#2a2a2a'], shotgun: [[0.08, 0.09, 0.78], '#3b2f26'], minigun: [[0.2, 0.2, 0.8], '#2c3036'], laser: [[0.1, 0.12, 0.6], '#6b7480'], sniper: [[0.06, 0.08, 1.05], '#2b3328'] }[o.gun] ?? [[0.07, 0.1, 0.5], '#262a2f'];
    P.push({ g: 'armR', shape: 'box', s: g[0], p: [0, -0.6, g[0][2] / 2 - 0.05], c: g[1] }, { rot: 'armR', r: [-1.2, 0, 0] });
    if (o.gunGlow) P.push({ g: 'armR', shape: 'box', s: [0.04, 0.04, 0.05], p: [0, -0.58, g[0][2] - 0.05], c: o.gunGlow, e: true });
  }
  return { kind: 'parts', parts: P, height: 1.8 * sc, scale: sc, humanoid: true };
}

const crate = (c, t, s = 0.9) => [{ shape: 'box', s: [s, s, s], p: [0, s / 2, 0], c }, ...[[0, 1], [0, -1]].map(([x, z]) => ({ shape: 'box', s: [s + 0.02, 0.08, s + 0.02], p: [0, s / 2 + z * (s / 2 - 0.04), 0], c: t })), { shape: 'box', s: [0.08, s + 0.02, s + 0.02], p: [s / 2 - 0.04, s / 2, 0], c: t }, { shape: 'box', s: [0.08, s + 0.02, s + 0.02], p: [-s / 2 + 0.04, s / 2, 0], c: t }];
const gunShape = (body, extra) => [{ shape: 'box', s: [0.08, 0.14, 0.7], p: [0, 0.2, 0], c: body }, { shape: 'box', s: [0.07, 0.2, 0.12], p: [0, 0.08, -0.15], c: '#3b2f26' }, ...extra];
const key = (c) => [{ shape: 'cyl', s: [0.14, 0.03, 0.14], p: [0, 0.3, 0], r: [90 * D2R, 0, 0], c, e: true }, { shape: 'box', s: [0.04, 0.04, 0.26], p: [0, 0.3, -0.2], c, e: true }, { shape: 'box', s: [0.12, 0.04, 0.04], p: [0, 0.3, -0.31], c, e: true }];
const lamp = (c) => [{ shape: 'cyl', s: [0.04, 0.5, 0.04], p: [0, 3.0, 0], c: '#444' }, { shape: 'cyl', s: [0.5, 0.1, 0.5], p: [0, 2.72, 0], c: '#cfcfcf' }, { shape: 'cyl', s: [0.42, 0.04, 0.42], p: [0, 2.66, 0], c, e: true }];

export const MODELS = {
  // enemies
  soldier: humanoid({ shirt: '#4a5a3c', pants: '#3a3f35', hat: 'helmet', gun: 'rifle', pack: '#2e3a28' }),
  guard: humanoid({ shirt: '#2f4466', pants: '#232b3a', hat: 'cap', hatColor: '#1f2f4a', gun: 'pistol', vest: '#1c2a42' }),
  zombie: humanoid({ skin: '#7a9a6a', shirt: '#5a4a42', pants: '#3a3a50', arms: 'forward', eyes: '#ffdd44', bulk: 1 }),
  runner: humanoid({ skin: '#c9a89a', shirt: '#8a2a2a', pants: '#3a2a2a', arms: 'forward', eyes: '#ff4040', bulk: 0.85 }),
  heavy: humanoid({ scale: 1.15, bulk: 1.45, shirt: '#4a4f5a', pants: '#2b2e35', hat: 'helmet', hatColor: '#3a3f48', gun: 'minigun', pauldrons: '#5a606c', visor: '#ffb030' }),
  sniper: humanoid({ shirt: '#3a4a2e', pants: '#2e3a24', hat: 'cap', hatColor: '#2e3a24', gun: 'sniper', hair: '#2a2218' }),
  robot: humanoid({ skin: '#8b929c', shirt: '#6b727d', pants: '#4a5058', boots: '#2a2d33', bulk: 1.2, visor: '#ff3030', gun: 'laser', gunGlow: '#ff3030', glowChest: '#ff4040', pauldrons: '#555c66' }),
  mech: humanoid({ scale: 1.5, bulk: 1.6, skin: '#5a606b', shirt: '#454b55', pants: '#2f343b', boots: '#222', visor: '#ff8030', gun: 'minigun', gunGlow: '#ff8030', glowChest: '#ff8030', pauldrons: '#6a707c' }),
  boss: humanoid({ scale: 2.0, bulk: 1.7, skin: '#3b2a4a', shirt: '#2e2040', pants: '#1f1630', boots: '#120d1c', visor: '#ff2060', gun: 'laser', gunGlow: '#ff2060', glowChest: '#ff2060', pauldrons: '#5a2a6a', hat: 'helmet', hatColor: '#3b2a4a' }),
  scientist: humanoid({ shirt: '#e8e8ee', pants: '#33415a', hair: '#6b4a2a' }),
  civilian: humanoid({ shirt: '#a85f3c', pants: '#334055', hair: '#2a1e14' }),
  drone: { kind: 'parts', height: 0.8, float: true, parts: [
    { shape: 'sph', s: [0.55, 0.4, 0.55], p: [0, 0.4, 0], c: '#3a3f48' }, { shape: 'sph', s: [0.18, 0.18, 0.1], p: [0, 0.42, 0.26], c: '#ff3030', e: true },
    { group: 'rotor', p: [0, 0.66, 0] }, { g: 'rotor', shape: 'cyl', s: [0.9, 0.02, 0.9], p: [0, 0, 0], c: '#9aa0aa' }, { shape: 'box', s: [0.06, 0.2, 0.06], p: [0, 0.55, 0], c: '#222' },
    { shape: 'box', s: [0.08, 0.08, 0.3], p: [0, 0.2, 0.3], c: '#222' },
  ] },
  turret: { kind: 'parts', height: 1.1, parts: [
    { shape: 'cyl', s: [0.8, 0.5, 0.8], p: [0, 0.25, 0], c: '#4a4f58' }, { group: 'head', p: [0, 0.75, 0] }, { g: 'head', shape: 'box', s: [0.55, 0.4, 0.6], p: [0, 0, 0], c: '#6a707a' },
    { g: 'head', shape: 'cyl', s: [0.1, 0.9, 0.1], p: [0, 0.02, 0.6], r: [90 * D2R, 0, 0], c: '#2a2d33' }, { g: 'head', shape: 'box', s: [0.12, 0.08, 0.04], p: [0, 0.14, 0.31], c: '#ff3030', e: true },
  ] },
  // pickups
  medkit: { kind: 'parts', height: 0.5, float: true, parts: [{ shape: 'box', s: [0.42, 0.26, 0.32], p: [0, 0.25, 0], c: '#f2f2f2' }, { shape: 'box', s: [0.28, 0.08, 0.34], p: [0, 0.25, 0], c: '#d32f2f', e: true }, { shape: 'box', s: [0.08, 0.28, 0.34], p: [0, 0.25, 0], c: '#d32f2f', e: true }] },
  medkit_big: { kind: 'parts', height: 0.6, float: true, parts: [{ shape: 'box', s: [0.62, 0.36, 0.44], p: [0, 0.3, 0], c: '#f2f2f2' }, { shape: 'box', s: [0.4, 0.1, 0.46], p: [0, 0.3, 0], c: '#d32f2f', e: true }, { shape: 'box', s: [0.1, 0.4, 0.46], p: [0, 0.3, 0], c: '#d32f2f', e: true }] },
  armor: { kind: 'parts', height: 0.6, float: true, parts: [{ shape: 'box', s: [0.5, 0.5, 0.22], p: [0, 0.35, 0], c: '#2f5d9a' }, { shape: 'box', s: [0.3, 0.1, 0.24], p: [0, 0.45, 0], c: '#6ee7ff', e: true }, { shape: 'box', s: [0.12, 0.2, 0.12], p: [-0.2, 0.7, 0], c: '#2f5d9a' }, { shape: 'box', s: [0.12, 0.2, 0.12], p: [0.2, 0.7, 0], c: '#2f5d9a' }] },
  ammo_bullets: { kind: 'parts', height: 0.4, float: true, parts: [{ shape: 'box', s: [0.4, 0.2, 0.26], p: [0, 0.2, 0], c: '#4d5a3a' }, { shape: 'box', s: [0.3, 0.06, 0.27], p: [0, 0.22, 0], c: '#e6c34a', e: true }] },
  ammo_shells: { kind: 'parts', height: 0.4, float: true, parts: [{ shape: 'box', s: [0.4, 0.2, 0.26], p: [0, 0.2, 0], c: '#5a3a30' }, { shape: 'box', s: [0.3, 0.06, 0.27], p: [0, 0.22, 0], c: '#e0503a', e: true }] },
  ammo_rockets: { kind: 'parts', height: 0.4, float: true, parts: [{ shape: 'cyl', s: [0.14, 0.55, 0.14], p: [0, 0.2, 0], r: [0, 0, 90 * D2R], c: '#4a5a40' }, { shape: 'cone', s: [0.14, 0.2, 0.14], p: [0.35, 0.2, 0], r: [0, 0, -90 * D2R], c: '#e0603a', e: true }] },
  ammo_cells: { kind: 'parts', height: 0.4, float: true, parts: [{ shape: 'box', s: [0.34, 0.22, 0.26], p: [0, 0.2, 0], c: '#3a4a5a' }, { shape: 'box', s: [0.24, 0.06, 0.27], p: [0, 0.22, 0], c: '#6ee7ff', e: true }] },
  gun_pistol: { kind: 'parts', height: 0.5, float: true, parts: gunShape('#2a2a2a', []) },
  gun_shotgun: { kind: 'parts', height: 0.5, float: true, parts: gunShape('#3a3a3f', [{ shape: 'box', s: [0.1, 0.1, 0.4], p: [0, 0.15, 0.3], c: '#6a4a30' }]) },
  gun_rifle: { kind: 'parts', height: 0.5, float: true, parts: gunShape('#262a2f', [{ shape: 'box', s: [0.06, 0.2, 0.1], p: [0, 0.05, 0.1], c: '#1c1c1c' }]) },
  gun_rocket: { kind: 'parts', height: 0.5, float: true, parts: [{ shape: 'cyl', s: [0.2, 0.9, 0.2], p: [0, 0.3, 0], r: [90 * D2R, 0, 0], c: '#4a5a40' }, { shape: 'cyl', s: [0.26, 0.1, 0.26], p: [0, 0.3, 0.45], r: [90 * D2R, 0, 0], c: '#222' }, { shape: 'box', s: [0.08, 0.2, 0.1], p: [0, 0.15, -0.1], c: '#222' }] },
  gun_plasma: { kind: 'parts', height: 0.5, float: true, parts: [{ shape: 'box', s: [0.14, 0.18, 0.7], p: [0, 0.25, 0], c: '#5a6a80' }, { shape: 'box', s: [0.08, 0.1, 0.4], p: [0, 0.25, 0.25], c: '#6ee7ff', e: true }] },
  key_red: { kind: 'parts', height: 0.5, float: true, parts: key('#ff4040') }, key_blue: { kind: 'parts', height: 0.5, float: true, parts: key('#4aa0ff') },
  key_yellow: { kind: 'parts', height: 0.5, float: true, parts: key('#ffe040') }, key_green: { kind: 'parts', height: 0.5, float: true, parts: key('#50ff70') },
  coin: { kind: 'parts', height: 0.4, float: true, parts: [{ shape: 'cyl', s: [0.32, 0.05, 0.32], p: [0, 0.3, 0], r: [90 * D2R, 0, 0], c: '#f2c53a', e: true }] },
  gem: { kind: 'parts', height: 0.4, float: true, parts: [{ shape: 'cone', s: [0.3, 0.2, 0.3], p: [0, 0.4, 0], c: '#5ae0c8', e: true }, { shape: 'cone', s: [0.3, 0.2, 0.3], p: [0, 0.2, 0], r: [Math.PI, 0, 0], c: '#3ab8a8', e: true }] },
  // props
  barrel: { kind: 'parts', height: 1.0, parts: [{ shape: 'cyl', s: [0.62, 1.0, 0.62], p: [0, 0.5, 0], c: '#a3322a' }, { shape: 'cyl', s: [0.66, 0.06, 0.66], p: [0, 0.2, 0], c: '#4a1a16' }, { shape: 'cyl', s: [0.66, 0.06, 0.66], p: [0, 0.8, 0], c: '#4a1a16' }, { shape: 'cyl', s: [0.3, 0.02, 0.3], p: [0, 1.01, 0], c: '#e8b923', e: true }] },
  barrel_grey: { kind: 'parts', height: 1.0, parts: [{ shape: 'cyl', s: [0.62, 1.0, 0.62], p: [0, 0.5, 0], c: '#6a7078' }, { shape: 'cyl', s: [0.66, 0.06, 0.66], p: [0, 0.25, 0], c: '#3a3e44' }, { shape: 'cyl', s: [0.66, 0.06, 0.66], p: [0, 0.75, 0], c: '#3a3e44' }] },
  barrel_fire: { kind: 'parts', height: 1.4, parts: [{ shape: 'cyl', s: [0.62, 0.9, 0.62], p: [0, 0.45, 0], c: '#555' }, { shape: 'cone', s: [0.45, 0.6, 0.45], p: [0, 1.15, 0], c: '#ff8a1e', e: true }, { shape: 'cone', s: [0.25, 0.4, 0.25], p: [0, 1.2, 0], c: '#ffe27a', e: true }] },
  crate: { kind: 'parts', height: 0.9, parts: crate('#9a7448', '#5e4528') }, crate_big: { kind: 'parts', height: 1.5, parts: crate('#8a6a40', '#4e3a22', 1.5) }, crate_metal: { kind: 'parts', height: 0.9, parts: crate('#6d7680', '#3a4048') },
  table: { kind: 'parts', height: 0.9, parts: [{ shape: 'box', s: [1.4, 0.08, 0.8], p: [0, 0.86, 0], c: '#8a6238' }, ...[[-0.62, -0.32], [0.62, -0.32], [-0.62, 0.32], [0.62, 0.32]].map(([x, z]) => ({ shape: 'box', s: [0.08, 0.84, 0.08], p: [x, 0.42, z], c: '#5e4528' }))] },
  chair: { kind: 'parts', height: 1.0, parts: [{ shape: 'box', s: [0.45, 0.06, 0.45], p: [0, 0.48, 0], c: '#7a5430' }, { shape: 'box', s: [0.45, 0.5, 0.06], p: [0, 0.78, -0.2], c: '#7a5430' }, ...[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => ({ shape: 'box', s: [0.05, 0.46, 0.05], p: [x, 0.23, z], c: '#5e4528' }))] },
  locker: { kind: 'parts', height: 1.9, parts: [{ shape: 'box', s: [0.6, 1.9, 0.5], p: [0, 0.95, 0], c: '#5a6672' }, { shape: 'box', s: [0.02, 1.6, 0.02], p: [0, 0.95, 0.26], c: '#222' }, { shape: 'box', s: [0.06, 0.2, 0.04], p: [0.15, 1.0, 0.27], c: '#ccc' }] },
  plant: { kind: 'parts', height: 1.3, parts: [{ shape: 'cyl', s: [0.4, 0.4, 0.4], p: [0, 0.2, 0], c: '#8a4a30' }, { shape: 'sph', s: [0.6, 0.7, 0.6], p: [0, 0.85, 0], c: '#3f7a35' }, { shape: 'sph', s: [0.4, 0.5, 0.4], p: [0.2, 1.1, 0.1], c: '#4f8a40' }] },
  terminal: { kind: 'parts', height: 1.2, parts: [{ shape: 'box', s: [0.8, 0.9, 0.5], p: [0, 0.45, 0], c: '#3a4350' }, { shape: 'box', s: [0.62, 0.4, 0.04], p: [0, 0.95, 0.24], c: '#6ee7ff', e: true }, { shape: 'box', s: [0.7, 0.1, 0.3], p: [0, 0.84, 0.2], c: '#2a3039' }] },
  switch: { kind: 'parts', height: 1.4, parts: [{ shape: 'box', s: [0.3, 0.45, 0.05], p: [0, 1.3, 0], c: '#555c66' }, { group: 'lever', p: [0, 1.3, 0.04] }, { g: 'lever', shape: 'box', s: [0.06, 0.22, 0.06], p: [0, 0.08, 0.04], c: '#d6d6d6' }, { shape: 'box', s: [0.1, 0.1, 0.02], p: [0, 1.5, 0.03], c: '#ff4040', e: true }] },
  sandbags: { kind: 'parts', height: 0.9, parts: [{ shape: 'box', s: [1.8, 0.35, 0.6], p: [0, 0.18, 0], c: '#a5946a' }, { shape: 'box', s: [1.6, 0.35, 0.6], p: [0, 0.52, 0], c: '#9a8a60' }, { shape: 'box', s: [1.2, 0.3, 0.6], p: [0, 0.82, 0], c: '#a5946a' }] },
  tree: { kind: 'parts', height: 5, parts: [{ shape: 'cyl', s: [0.5, 2.6, 0.5], p: [0, 1.3, 0], c: '#5a4128' }, { shape: 'sph', s: [3.0, 2.6, 3.0], p: [0, 3.6, 0], c: '#356a2c' }, { shape: 'sph', s: [2.0, 1.8, 2.0], p: [0.5, 4.8, 0.2], c: '#3f7a35' }] },
  rock: { kind: 'parts', height: 1.0, parts: [{ shape: 'sph', s: [1.8, 1.1, 1.5], p: [0, 0.45, 0], c: '#7a7d80' }, { shape: 'sph', s: [1.0, 0.7, 0.9], p: [0.6, 0.3, 0.4], c: '#6a6d70' }] },
  pillar_deco: { kind: 'parts', height: 3, parts: [{ shape: 'cyl', s: [0.8, 3.0, 0.8], p: [0, 1.5, 0], c: '#b9b5a8' }, { shape: 'cyl', s: [1.1, 0.25, 1.1], p: [0, 0.12, 0], c: '#9a968a' }, { shape: 'cyl', s: [1.1, 0.25, 1.1], p: [0, 2.9, 0], c: '#9a968a' }] },
  lamp_ceiling: { kind: 'parts', height: 3, parts: lamp('#fff2c0') }, lamp_neon: { kind: 'parts', height: 3, parts: [{ shape: 'box', s: [1.6, 0.06, 0.16], p: [0, 3.1, 0], c: '#e8f6ff', e: true }, { shape: 'box', s: [1.7, 0.04, 0.22], p: [0, 3.14, 0], c: '#333' }] },
  lamp_red: { kind: 'parts', height: 3, parts: lamp('#ff3030') }, lamp_blue: { kind: 'parts', height: 3, parts: lamp('#4aa0ff') },
  lamp_floor: { kind: 'parts', height: 1.6, parts: [{ shape: 'cyl', s: [0.3, 0.05, 0.3], p: [0, 0.03, 0], c: '#333' }, { shape: 'cyl', s: [0.04, 1.4, 0.04], p: [0, 0.75, 0], c: '#444' }, { shape: 'cyl', s: [0.4, 0.3, 0.4], p: [0, 1.5, 0], c: '#ffe6a0', e: true }] },
  torch: { kind: 'parts', height: 2, parts: [{ shape: 'box', s: [0.08, 0.5, 0.08], p: [0, 1.7, 0], c: '#4a3420' }, { shape: 'cone', s: [0.26, 0.4, 0.26], p: [0, 2.15, 0], c: '#ff8a1e', e: true }, { shape: 'cone', s: [0.14, 0.26, 0.14], p: [0, 2.2, 0], c: '#ffe27a', e: true }] },
  exit_pad: { kind: 'parts', height: 0.3, parts: [{ shape: 'cyl', s: [1.8, 0.06, 1.8], p: [0, 0.03, 0], c: '#2fd66b', e: true }, { shape: 'cyl', s: [1.2, 0.1, 1.2], p: [0, 0.08, 0], c: '#bfffd6', e: true }, { shape: 'cyl', s: [0.2, 2.4, 0.2], p: [0, 1.2, 0], c: '#2fd66b', e: true }] },
  checkpoint: { kind: 'parts', height: 1.8, parts: [{ shape: 'cyl', s: [0.08, 1.8, 0.08], p: [0, 0.9, 0], c: '#bbb' }, { group: 'flag', p: [0, 1.7, 0] }, { g: 'flag', shape: 'box', s: [0.5, 0.3, 0.02], p: [0.27, 0, 0], c: '#ffd23a', e: true }] },
  teleporter: { kind: 'parts', height: 0.3, parts: [{ shape: 'cyl', s: [1.6, 0.06, 1.6], p: [0, 0.03, 0], c: '#7a4af0', e: true }, { shape: 'cyl', s: [1.1, 0.1, 1.1], p: [0, 0.08, 0], c: '#c8b0ff', e: true }, { shape: 'cyl', s: [1.4, 2.0, 1.4], p: [0, 1.1, 0], c: '#7a4af0', e: true, a: 0.15 }] },
};

/** Model (wrapper around Babylon nodes) with per-part lighting; animate via `parts.<group>.rotation`. */
export class Model {
  constructor(B, scene, spec, opts = {}) {
    this.B = B; this.scene = scene; this.spec = spec; this.mats = []; this.parts = {}; this.flashT = 0; this.tint = null;
    this.root = new B.TransformNode(opts.name ?? 'model', scene);
    this.height = (spec.height ?? 1) * (opts.scale ?? 1); this.float = !!spec.float; this.meshes = [];
    const sc = (spec.scale ?? 1) * (opts.scale ?? 1);
    this.inner = new B.TransformNode('inner', scene); this.inner.parent = this.root; this.inner.scaling.setAll(sc);
    if (spec.kind === 'billboard') this.#billboard(spec);
    else if (spec.kind === 'glb') this.#glb(spec);
    else this.#parts(spec.parts ?? []);
  }
  #mat(color, glow, alpha = 1) {
    const B = this.B, k = `${color}|${glow ? 1 : 0}|${alpha}`;
    let m = this.mats.find((x) => x.k === k);
    if (!m) {
      const mat = new B.StandardMaterial(`m-${k}`, this.scene); mat.disableLighting = true; mat.diffuseColor = B.Color3.Black(); mat.specularColor = B.Color3.Black();
      const base = hexRgb(color); mat.emissiveColor = new B.Color3(...base); if (alpha < 1) { mat.alpha = alpha; mat.backFaceCulling = false; }
      m = { k, mat, base, glow }; this.mats.push(m);
    }
    return m;
  }
  #parts(parts) {
    const B = this.B, nodes = this.parts;
    for (const p of parts) if (p.group) { const n = new B.TransformNode(p.group, this.scene); n.parent = p.parent ? nodes[p.parent] : this.inner; n.position.set(...p.p); n.rotationQuaternion = null; nodes[p.group] = n; }
    for (const p of parts) {
      if (p.rot) { nodes[p.rot].rotation.set(...p.r); continue; }
      if (p.group) continue;
      const s = p.s ?? [1, 1, 1]; let mesh;
      if (p.shape === 'cyl') mesh = B.MeshBuilder.CreateCylinder('p', { diameterTop: s[0], diameterBottom: s[2] ?? s[0], height: s[1], tessellation: 12 }, this.scene);
      else if (p.shape === 'sph') { mesh = B.MeshBuilder.CreateSphere('p', { diameter: 1, segments: 8 }, this.scene); mesh.scaling.set(s[0], s[1], s[2]); }
      else if (p.shape === 'cone') mesh = B.MeshBuilder.CreateCylinder('p', { diameterTop: 0, diameterBottom: s[0], height: s[1], tessellation: 10 }, this.scene);
      else mesh = B.MeshBuilder.CreateBox('p', { width: s[0], height: s[1], depth: s[2] }, this.scene);
      const m = this.#mat(p.c ?? '#888888', !!p.e, p.a ?? 1); mesh.material = m.mat;
      mesh.parent = p.g ? nodes[p.g] : this.inner; mesh.position.set(...p.p); if (p.r) mesh.rotation.set(...p.r);
      mesh.isPickable = false; this.meshes.push(mesh);
    }
  }
  /** .glb/.gltf from the project: loaded once per url, instantiated per entity; lit by one flat hemispheric light (our baked light does not reach glTF materials). */
  #glb(spec) {
    const B = this.B, scene = this.scene;
    if (!B.LoadAssetContainerAsync) { console.warn('[fpsc] glTF loader not loaded (babylonjs.loaders.min.js) — showing a crate instead of', spec.url); this.#parts(MODELS.crate.parts); return; }
    if (!scene.__fpscGlbLight) { const l = new B.HemisphericLight('fpsc-glb-light', new B.Vector3(0.2, 1, 0.1), scene); l.intensity = 1.05; l.groundColor = new B.Color3(0.5, 0.5, 0.55); scene.__fpscGlbLight = l; }
    const cache = (scene.__fpscGlb ??= new Map());
    if (!cache.has(spec.url)) cache.set(spec.url, B.LoadAssetContainerAsync(spec.url, scene, { pluginExtension: spec.url.slice(spec.url.lastIndexOf('.')).split('?')[0] }));
    this.inner.scaling.setAll((spec.scale ?? 1) * (this.inner.scaling.x || 1));
    cache.get(spec.url).then((c) => {
      if (this.disposed) return;
      const inst = c.instantiateModelsToScene((n) => n, false); this.glbNodes = inst.rootNodes;
      for (const r of inst.rootNodes) { r.parent = this.inner; for (const m of r.getChildMeshes?.() ?? []) { m.isPickable = false; this.meshes.push(m); } }
      this.inner.rotation.y = (spec.rotY ?? 0) * D2R;
    }).catch((e) => console.warn(`[fpsc] could not load model ${spec.url}: ${e?.message ?? e}`));
  }
  #billboard(spec) {
    const B = this.B, w = spec.w ?? 1, h = spec.h ?? 1.8;
    const mesh = B.MeshBuilder.CreatePlane('bb', { width: w, height: h }, this.scene);
    const mat = new B.StandardMaterial('bb', this.scene); mat.disableLighting = true; mat.diffuseColor = B.Color3.Black(); mat.specularColor = B.Color3.Black();
    const tex = new B.Texture(spec.url, this.scene, false, true, B.Texture.NEAREST_SAMPLINGMODE); tex.hasAlpha = true; mat.emissiveTexture = tex; mat.opacityTexture = tex; mat.backFaceCulling = false;
    mesh.material = mat; mesh.billboardMode = B.Mesh.BILLBOARDMODE_Y; mesh.parent = this.inner; mesh.position.y = h / 2; mesh.isPickable = false; this.meshes.push(mesh);
    this.bb = { mat }; this.height = h;
  }
  /** Apply lighting (rgb 0..~1.5 multiplier) + hurt flash. Call every few frames. */
  light(rgb, dt = 0) {
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    const f = this.flashT > 0 ? 1 : 0, t = this.tint;
    const r = Math.min(1.4, rgb[0]), g = Math.min(1.4, rgb[1]), b = Math.min(1.4, rgb[2]);
    for (const m of this.mats) {
      if (m.glow) { m.mat.emissiveColor.set(m.base[0], m.base[1], m.base[2]); continue; }
      m.mat.emissiveColor.set(Math.min(1.2, m.base[0] * r + f * 0.8 + (t ? t[0] : 0)), Math.min(1.2, m.base[1] * g + f * 0.6 + (t ? t[1] : 0)), Math.min(1.2, m.base[2] * b + f * 0.6 + (t ? t[2] : 0)));
    }
    if (this.bb) this.bb.mat.emissiveColor.set(Math.min(1, r), Math.min(1, g), Math.min(1, b));
  }
  flash(sec = 0.12) { this.flashT = sec; }
  dispose() { this.disposed = true; for (const n of this.glbNodes ?? []) n.dispose(false, true); for (const m of this.meshes) m.dispose(); for (const m of this.mats) m.mat.dispose(); this.root.dispose(false, true); }
}

/** Resolve a model name or inline spec; project-defined models (bank.json "models") come through `bank.model(id)`. */
export function modelSpec(id, bank) {
  if (typeof id === 'object' && id) return id;
  return bank?.model?.(id) ?? MODELS[id] ?? MODELS.crate;
}

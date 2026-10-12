// Shared geometry for Harrison's Command: used by the model generator (tools/gen_harrison_models.mjs) AND by the game, so the walls you see are the walls you hit.
// Ship-local axes: +z = bow, +x = starboard (right), y = 0 at the deck. Metres.

export const HULL = { // stations along z: half-beam at deck level and draft below the deck
  z: [-48, -44, -30, 0, 24, 34, 42, 48], b: [9, 10, 11, 11, 10.4, 8.2, 4.2, 0.4], d: [5, 6, 6.5, 6.5, 6, 5, 3.5, 2],
};
export const halfBeam = (z) => {
  const Z = HULL.z; if (z <= Z[0]) return HULL.b[0]; if (z >= Z.at(-1)) return HULL.b.at(-1);
  let i = 0; while (z > Z[i + 1]) i++; const t = (z - Z[i]) / (Z[i + 1] - Z[i]); return HULL.b[i] + (HULL.b[i + 1] - HULL.b[i]) * t;
};

// Command centre (the walk-in bridge island): inner floor rectangle and walls (AABB [x0,z0,x1,z1], all full height)
export const ROOM = { x0: -7, x1: 7, z0: -26, z1: -6, wall: 0.4, h: 4.2, door: 1.6 };
const W = ROOM.wall;
export const WALLS = [
  [ROOM.x0 - W, ROOM.z0 - W, ROOM.x0, ROOM.z1 + W], // port wall
  [ROOM.x1, ROOM.z0 - W, ROOM.x1 + W, ROOM.z1 + W], // starboard wall
  [ROOM.x0, ROOM.z1, -ROOM.door, ROOM.z1 + W], [ROOM.door, ROOM.z1, ROOM.x1, ROOM.z1 + W], // bow wall with a doorway
  [ROOM.x0, ROOM.z0 - W, -ROOM.door, ROOM.z0], [ROOM.door, ROOM.z0 - W, ROOM.x1, ROOM.z0], // stern wall with a doorway
];
// Computer consoles: AABB blocks + where the player stands to use them + the screen plane (centre, size, facing normal)
export const STATIONS = {
  nav:     { label: 'NAVIGATION', box: [-6.9, -14.2, -5.4, -10.8], stand: [-3.6, -12.5], radius: 2.6, screen: { c: [-6.0, 1.7, -12.5], w: 3.2, h: 1.8, n: [1, 0, 0] }, view: [-2.6, 1.7, -12.5] },
  command: { label: 'UNIT COMMAND', box: [5.4, -20.2, 6.9, -16.8], stand: [3.6, -18.5], radius: 2.6, screen: { c: [6.0, 1.7, -18.5], w: 3.2, h: 1.8, n: [-1, 0, 0] }, view: [2.6, 1.7, -18.5] },
  feed:    { label: 'UNIT CAMERA', box: [-5.6, -25.6, -2.6, -24.4], stand: [-4.1, -22.4], radius: 2.2, screen: { c: [-4.1, 2.0, -25.2], w: 3.2, h: 1.8, n: [0, 0, 1] }, view: [-4.1, 1.9, -21.6] },
  status:  { label: 'SHIP STATUS', box: [2.6, -25.6, 5.6, -24.4], stand: [4.1, -22.4], radius: 2.2, screen: { c: [4.1, 2.0, -25.2], w: 3.2, h: 1.8, n: [0, 0, 1] }, view: [4.1, 1.9, -21.6] },
};
// Deck cargo: [cx, cz, sx, sz, height, colour name]
export const CRATES = [
  [9.2, 12, 2.4, 5, 2.4, 'cargoRed'], [9.2, 18.5, 2.4, 5, 2.4, 'cargoBlue'], [9.2, 25, 2.4, 5, 2.4, 'cargoYellow'], [-9.2, 14, 2.4, 5, 2.4, 'cargoBlue'], [-9.2, 20.5, 2.4, 5, 2.4, 'cargoRed'], [-9.2, 5, 2.4, 5, 2.4, 'cargoYellow'],
  [9.2, 4, 2.4, 5, 2.4, 'cargoBlue'], [-9.2, -30, 2.4, 5, 2.4, 'cargoRed'], [9.3, -30, 2.4, 5, 2.4, 'cargoYellow'],
];
export const SOLIDS = [...WALLS, ...Object.values(STATIONS).map((s) => s.box), ...CRATES.map(([x, z, sx, sz]) => [x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2])];
// Docked units on the stern deck (ship-local x,z)
export const BAYS = [[-5.5, -43], [5.5, -43], [-5.5, -35.5], [5.5, -35.5], [-1.2, -46], [1.2, -33]];
export const SPAWNS = [[-1.8, -11], [1.8, -11]]; // players start in the command centre

/** Can a body of radius r stand at ship-local (x,z)? */
export function walkable(x, z, r = 0.45) {
  if (z < -47 + r || z > 46 - r || Math.abs(x) > halfBeam(z) - 0.7 - r) return false;
  for (const [x0, z0, x1, z1] of SOLIDS) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
  return true;
}

// ---- islands (shared by the model generator, the minimap and the sim) ---------------------------------------------------
export const ISLANDS = [
  { id: 'alpha', name: 'ALPHA ISLE', x: -190, z: 120, r: 80, peak: 13, seed: 1 },
  { id: 'beta', name: 'BETA ISLE', x: 190, z: 270, r: 70, peak: 11, seed: 2 },
  { id: 'gamma', name: 'GAMMA ISLE', x: -40, z: 500, r: 120, peak: 18, seed: 3 },
];
export function islandHeight(isl, x, z) {
  const dx = x - isl.x, dz = z - isl.z, th = Math.atan2(dz, dx), s = isl.seed;
  const R = isl.r * (1 + 0.16 * Math.sin(3 * th + s) + 0.09 * Math.sin(5 * th + 2 * s) + 0.05 * Math.sin(8 * th + 3 * s));
  const t = 1 - Math.hypot(dx, dz) / R; if (t <= 0) return 0;
  const bump = 0.8 + 0.2 * Math.sin(x * 0.09 + s) * Math.cos(z * 0.07 - s);
  return isl.peak * Math.pow(t, 1.35) * bump;
}
/** Terrain height above sea level anywhere in the world (0 = sea). */
export const groundAt = (x, z) => { let h = 0; for (const i of ISLANDS) h = Math.max(h, islandHeight(i, x, z)); return h; };

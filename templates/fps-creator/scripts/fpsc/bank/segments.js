// Built-in wall-piece ("segment") bank. A piece sits on a cell EDGE; the texture is chosen separately, so every piece works with every texture.
// Declarative: a piece is a list of axis-aligned boxes in edge space.
//   u: [u0,u1]  fraction along the edge (0..1, edge length = 4 m)      y: [y0,y1] metres above the floor ('H' = storey height 3.2)
//   t: [t0,t1]  metres across the wall (default ±0.15)                  mat: 'main' (chosen texture) | 'trim' (darker) | 'door' (door texture) | 'glass' | 'mesh'
//   solid (default true)  blocks walking      opaque (default true)  blocks sight      bullet (default = opaque)  blocks shots
//   leaf: true  the box moves when the door opens
// A piece may add  door: { style: 'up'|'side'|'swing', speed, secret }  → the leaf boxes animate; the player/AI open it with E / by walking up (auto) / via script events.
// How to add your own piece: docs/FPS_CREATOR.md §Adding assets (JSON in <project>/fpsc/bank.json → "pieces").
import { STORY } from '../level.js';
const H = STORY;

const frame = (u0, u1, top) => [
  { u: [0, u0], y: [0, H] }, { u: [u1, 1], y: [0, H] }, { u: [u0, u1], y: [top, H] },
];
const bars = (n) => Array.from({ length: n }, (_, i) => { const u = (i + 0.5) / n; return { u: [u - 0.012, u + 0.012], y: [0, 2.4], t: [-0.03, 0.03], mat: 'trim', opaque: false }; });

export const PIECES = [
  { id: 'wall', label: 'Wall', cat: 'Walls', parts: [{ u: [0, 1], y: [0, H] }] },
  { id: 'wall_skirt', label: 'Wall + skirting', cat: 'Walls', parts: [{ u: [0, 1], y: [0.3, H] }, { u: [0, 1], y: [0, 0.3], t: [-0.19, 0.19], mat: 'trim' }] },
  { id: 'wall_thick', label: 'Thick wall', cat: 'Walls', parts: [{ u: [0, 1], y: [0, H], t: [-0.4, 0.4] }] },
  { id: 'wall_pilasters', label: 'Wall + pilasters', cat: 'Walls', parts: [{ u: [0, 1], y: [0, H] }, { u: [0, 0.08], y: [0, H], t: [-0.25, 0.25], mat: 'trim' }, { u: [0.92, 1], y: [0, H], t: [-0.25, 0.25], mat: 'trim' }, { u: [0, 1], y: [H - 0.25, H], t: [-0.22, 0.22], mat: 'trim' }] },
  { id: 'wall_low', label: 'Low wall (1.1 m)', cat: 'Walls', parts: [{ u: [0, 1], y: [0, 1.1], opaque: false, bullet: false }, { u: [0, 1], y: [1.1, 1.18], t: [-0.2, 0.2], mat: 'trim', opaque: false, bullet: false }] },
  { id: 'wall_half_gap', label: 'Wall with high opening', cat: 'Walls', parts: [{ u: [0, 1], y: [0, 2.1] }, { u: [0, 1], y: [2.1, H], solid: false, opaque: false, mat: 'glass' }] },

  { id: 'window', label: 'Window', cat: 'Windows', parts: [
    { u: [0, 1], y: [0, 0.9] }, { u: [0, 1], y: [2.3, H] }, { u: [0, 0.2], y: [0.9, 2.3] }, { u: [0.8, 1], y: [0.9, 2.3] },
    { u: [0.2, 0.8], y: [0.9, 2.3], t: [-0.02, 0.02], mat: 'glass', opaque: false },
    { u: [0.2, 0.8], y: [0.88, 0.94], t: [-0.19, 0.19], mat: 'trim', solid: false }, { u: [0.49, 0.51], y: [0.9, 2.3], t: [-0.05, 0.05], mat: 'trim', solid: false },
  ] },
  { id: 'window_wide', label: 'Wide window', cat: 'Windows', parts: [
    { u: [0, 1], y: [0, 1.0] }, { u: [0, 1], y: [2.5, H] }, { u: [0, 0.06], y: [1.0, 2.5] }, { u: [0.94, 1], y: [1.0, 2.5] },
    { u: [0.06, 0.94], y: [1.0, 2.5], t: [-0.02, 0.02], mat: 'glass', opaque: false },
  ] },
  { id: 'window_slit', label: 'Slit window', cat: 'Windows', parts: [
    { u: [0, 1], y: [0, 1.4] }, { u: [0, 1], y: [1.9, H] }, { u: [0, 0.4], y: [1.4, 1.9] }, { u: [0.6, 1], y: [1.4, 1.9] },
    { u: [0.4, 0.6], y: [1.4, 1.9], t: [-0.02, 0.02], mat: 'glass', opaque: false },
  ] },
  { id: 'window_open', label: 'Open window (no glass)', cat: 'Windows', parts: [
    { u: [0, 1], y: [0, 0.9] }, { u: [0, 1], y: [2.3, H] }, { u: [0, 0.2], y: [0.9, 2.3] }, { u: [0.8, 1], y: [0.9, 2.3] },
    { u: [0.2, 0.8], y: [0.9, 2.3], t: [0, 0], vis: false, opaque: false },
  ] },
  { id: 'window_barred', label: 'Barred window', cat: 'Windows', parts: [
    { u: [0, 1], y: [0, 0.9] }, { u: [0, 1], y: [2.3, H] }, { u: [0, 0.2], y: [0.9, 2.3] }, { u: [0.8, 1], y: [0.9, 2.3] },
    ...[0.3, 0.4, 0.5, 0.6, 0.7].map((u) => ({ u: [u - 0.008, u + 0.008], y: [0.9, 2.3], t: [-0.03, 0.03], mat: 'trim', opaque: false })),
    { u: [0.2, 0.8], y: [0.9, 2.3], t: [0, 0], mat: 'glass', opaque: false, vis: false },
  ] },

  { id: 'door', label: 'Door (slides up)', cat: 'Doors', door: { style: 'up', speed: 1.8 }, parts: [...frame(0.18, 0.82, 2.4), { u: [0.18, 0.82], y: [0, 2.4], t: [-0.07, 0.07], mat: 'door', leaf: true }] },
  { id: 'door_side', label: 'Door (slides sideways)', cat: 'Doors', door: { style: 'side', speed: 1.8 }, parts: [...frame(0.18, 0.82, 2.4), { u: [0.18, 0.82], y: [0, 2.4], t: [-0.07, 0.07], mat: 'door', leaf: true }] },
  { id: 'door_swing', label: 'Door (swings open)', cat: 'Doors', door: { style: 'swing', speed: 2.4 }, parts: [...frame(0.18, 0.82, 2.4), { u: [0.18, 0.82], y: [0, 2.4], t: [-0.05, 0.05], mat: 'door', leaf: true }] },
  { id: 'door_wide', label: 'Wide door (slides up)', cat: 'Doors', door: { style: 'up', speed: 1.4 }, parts: [...frame(0.1, 0.9, 2.6), { u: [0.1, 0.9], y: [0, 2.6], t: [-0.08, 0.08], mat: 'door', leaf: true }] },
  { id: 'door_glass', label: 'Glass door (slides sideways)', cat: 'Doors', door: { style: 'side', speed: 2.2 }, parts: [...frame(0.18, 0.82, 2.4), { u: [0.18, 0.82], y: [0, 2.4], t: [-0.03, 0.03], mat: 'glass', opaque: false, leaf: true }] },
  // Hotel entrance: 3 m opening, slim black frame, two glass leaves that slide apart (sensor-style), black stiles/kick rails and pull handles. Frame colour = trim texture, default black_metal.
  { id: 'door_glass_hotel', label: 'Hotel glass door (black frame)', cat: 'Doors', tt: 'black_metal', door: { style: 'side', speed: 2.0 }, parts: [
    ...frame(0.12, 0.88, 2.5),
    { u: [0.12, 0.135], y: [0, 2.5], t: [-0.06, 0.06], mat: 'trim' }, { u: [0.865, 0.88], y: [0, 2.5], t: [-0.06, 0.06], mat: 'trim' }, { u: [0.12, 0.88], y: [2.44, 2.5], t: [-0.06, 0.06], mat: 'trim' },
    { u: [0.135, 0.865], y: [0.1, 2.44], t: [-0.02, 0.02], mat: 'glass', opaque: false, leaf: true },
    { u: [0.135, 0.15], y: [0, 2.44], t: [-0.045, 0.045], mat: 'trim', leaf: true }, { u: [0.85, 0.865], y: [0, 2.44], t: [-0.045, 0.045], mat: 'trim', leaf: true },
    { u: [0.488, 0.512], y: [0, 2.44], t: [-0.045, 0.045], mat: 'trim', leaf: true },
    { u: [0.135, 0.865], y: [0, 0.12], t: [-0.045, 0.045], mat: 'trim', leaf: true }, { u: [0.135, 0.865], y: [2.32, 2.44], t: [-0.045, 0.045], mat: 'trim', leaf: true },
    { u: [0.452, 0.462], y: [0.9, 1.5], t: [-0.07, 0.07], mat: 'trim', leaf: true, solid: false }, { u: [0.538, 0.548], y: [0.9, 1.5], t: [-0.07, 0.07], mat: 'trim', leaf: true, solid: false },
  ] },
  { id: 'door_secret', label: 'Secret door (looks like wall)', cat: 'Doors', door: { style: 'side', speed: 1.2, secret: true }, parts: [{ u: [0, 1], y: [0, H], t: [-0.15, 0.15] }, { u: [0.18, 0.82], y: [0, 2.4], t: [-0.16, 0.16], mat: 'main', leaf: true, over: true }] },
  { id: 'doorway', label: 'Doorway (no door)', cat: 'Doors', parts: frame(0.18, 0.82, 2.4) },
  { id: 'doorway_wide', label: 'Wide opening', cat: 'Doors', parts: frame(0.1, 0.9, 2.6) },
  { id: 'arch', label: 'Arch', cat: 'Doors', parts: [
    { u: [0, 0.12], y: [0, H] }, { u: [0.88, 1], y: [0, H] },
    { u: [0.12, 0.88], y: [2.7, H] }, { u: [0.12, 0.24], y: [2.3, 2.7] }, { u: [0.76, 0.88], y: [2.3, 2.7] }, { u: [0.12, 0.17], y: [1.9, 2.3] }, { u: [0.83, 0.88], y: [1.9, 2.3] },
  ] },
  { id: 'gate_bars', label: 'Prison bars', cat: 'Doors', parts: [
    { u: [0, 1], y: [2.4, H] }, { u: [0, 1], y: [2.35, 2.45], t: [-0.06, 0.06], mat: 'trim', solid: false, opaque: false }, { u: [0, 1], y: [0, 0.1], t: [-0.06, 0.06], mat: 'trim', solid: false, opaque: false },
    ...bars(12).map((p) => ({ ...p, solid: false })), { u: [0, 1], y: [0.1, 2.4], t: [0, 0], vis: false, opaque: false },
  ] },

  { id: 'fence', label: 'Chain-link fence', cat: 'Barriers', parts: [{ u: [0, 1], y: [0, 2.2], t: [-0.01, 0.01], mat: 'mesh', opaque: false }, { u: [0, 0.03], y: [0, 2.3], t: [-0.06, 0.06], mat: 'trim', solid: false }, { u: [0.97, 1], y: [0, 2.3], t: [-0.06, 0.06], mat: 'trim', solid: false }] },
  { id: 'railing', label: 'Railing (1 m)', cat: 'Barriers', parts: [{ u: [0, 1], y: [0.95, 1.05], t: [-0.04, 0.04], mat: 'trim', opaque: false }, { u: [0, 0.03], y: [0, 1.05], t: [-0.05, 0.05], mat: 'trim', opaque: false }, { u: [0.97, 1], y: [0, 1.05], t: [-0.05, 0.05], mat: 'trim', opaque: false }, { u: [0.03, 0.97], y: [0.2, 0.95], t: [0, 0], vis: false, opaque: false, bullet: false }] },
  { id: 'glass_wall', label: 'Glass wall', cat: 'Barriers', parts: [{ u: [0, 1], y: [0, H], t: [-0.02, 0.02], mat: 'glass', opaque: false }, { u: [0, 1], y: [0, 0.08], t: [-0.06, 0.06], mat: 'trim', solid: false }, { u: [0, 1], y: [H - 0.08, H], t: [-0.06, 0.06], mat: 'trim', solid: false }] },
  { id: 'barricade', label: 'Sandbag barricade', cat: 'Barriers', parts: [{ u: [0.05, 0.95], y: [0, 1.0], t: [-0.4, 0.4], opaque: false, bullet: true }] },
];

export const CELL_PIECES = [
  { id: 'pillar', label: 'Square pillar', parts: [{ x: [-0.4, 0.4], z: [-0.4, 0.4], y: [0, H] }] },
  { id: 'pillar_thin', label: 'Thin pillar', parts: [{ x: [-0.2, 0.2], z: [-0.2, 0.2], y: [0, H] }] },
  { id: 'pillar_big', label: 'Big pillar', parts: [{ x: [-0.8, 0.8], z: [-0.8, 0.8], y: [0, H] }] },
  { id: 'block_low', label: 'Low block (cover)', parts: [{ x: [-1.2, 1.2], z: [-0.6, 0.6], y: [0, 1.0], opaque: false, bullet: true }] },
  { id: 'block', label: 'Solid block', parts: [{ x: [-1.9, 1.9], z: [-1.9, 1.9], y: [0, H] }] },
];

/** Stairs / ramps that can be dropped on a cell: rise in metres up toward direction d. */
export const STAIRS = [
  { id: 'stairs', label: 'Stairs (1 storey)', rise: H, steps: 8 },
  { id: 'stairs_half', label: 'Half stairs (1.6 m)', rise: 1.6, steps: 4 },
  { id: 'stairs_step', label: 'One step (0.4 m)', rise: 0.4, steps: 1 },
  { id: 'ramp', label: 'Ramp (1 storey)', rise: H, steps: 0 },
  { id: 'ramp_half', label: 'Ramp (1.6 m)', rise: 1.6, steps: 0 },
];

export const FLOOR_HEIGHTS = [-0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6];

export const pieceDef = (id) => PIECES.find((p) => p.id === id) ?? null;
export const cellPieceDef = (id) => CELL_PIECES.find((p) => p.id === id) ?? null;
export const stairDef = (id) => STAIRS.find((p) => p.id === id) ?? null;

// Noom — wall / floor / ceiling / door textures (64x64). Hand-drawn *units* (bricks, skulls, moss, cracks, planks) arranged by hand into tiles,
// the way a pixel artist builds a tileset. Bricks are 16x8 (15x7 stone + mortar), 4 per course, 8 courses; odd courses are shifted by half a brick.

// ---- stone brick units (3 hand-drawn faces; tone variants are re-inked by `tone`) ---------------------------------------------------------
export const STONE = { '.': null, h: '#8e88a8', L: '#6f698c', M: '#5a5476', D: '#463f5e', d: '#352f4a', m: '#15121d', c: '#241f33' };
export const brickA = `
hhhhhhhhhhhhhhhm
hLLLLLLLMLLLLLdm
hLLMLLLLLLLLLLdm
hLLLLLLLLLLDLLdm
hLLLLMLLLLLLLLdm
hLLLLLLLLLLLLMdm
hddddddddddddddm
mmmmmmmmmmmmmmmm
`;
export const brickB = `
hhhhhhhhhhhhhhhm
hLLLLLLLLLLLLLdm
hLLLLLLMMLLLLLdm
hLLLDLLLMLLLMLdm
hLLLLLLLLLLLLLdm
hLMLLLLLLLLLLLdm
hddddddddddddddm
mmmmmmmmmmmmmmmm
`;
export const brickC = `
hhhhhhhhhhhhhhhm
hLLLLMLLLLLLLLdm
hLLLLLLLLLMMLLdm
hLMLLLLLLLLMLLdm
hLLLLLLLDLLLLLdm
hLLLLLLLLLLLLLdm
hddddddddddddddm
mmmmmmmmmmmmmmmm
`;
// tone shift: re-ink a unit darker/lighter (0 = as drawn)
const SHIFT = { '-2': { h: 'M', L: 'D', M: 'd', D: 'c', d: 'c' }, '-1': { h: 'L', L: 'M', M: 'D', D: 'd', d: 'c' }, '1': { L: 'h', M: 'L', D: 'M', d: 'D' } };
export const tone = (src, t) => (t === 0 ? src : src.replace(/[hLMDd]/g, (c) => SHIFT[t][c] ?? c));

/** Layout: 8 courses × 4 bricks of "unit tone" codes, e.g. 'a0' = brickA tone 0, 'b-1' = brickB one step darker. */
export const LAYOUT = [
  ['a0', 'b0', 'c-1', 'a1'], ['c0', 'a-1', 'b0', 'a0'], ['b1', 'a0', 'c0', 'b-1'], ['a-1', 'c0', 'a0', 'b0'],
  ['b0', 'c1', 'a-1', 'c0'], ['a0', 'b-1', 'b0', 'a1'], ['c-1', 'a0', 'c0', 'b0'], ['b0', 'a1', 'b-1', 'c0'],
];

// ---- overlays (hand-drawn, '.' transparent) ------------------------------------------------------------------------------------------------
export const crack1 = `
..cc........
...cc.......
....c.......
....cc......
.....c...cc.
.....cc.cc..
......ccc...
.......cc...
......cc....
.....cc.....
....cc......
...cc.......
..c.........
`;
export const crack2 = `
.....cc...
....cc....
...cc.....
...c......
....cc....
.....c.cc.
.....ccc..
......c...
.....cc...
....cc....
`;
export const MOSS = { '.': null, a: '#1f3b24', b: '#2f5a32', c: '#4a8a43', d: '#78b85a', e: '#a6dc7c' };
export const mossDrip = `
..aabbbbaaaa...aab..
.aabbccbbbbaa.aabbc.
aabbccddccbbaabbccb.
abbccddeddcbbbbccdcb
.bbccdd.ddcbbaabcdc.
..bcdd...dcb..abcc..
..bcd....cb....bc...
...c.....b......b...
...c.................
`;
export const mossLow = `
....aab...........aab.....
..aabbcbaa......aabbccb...
.abbccdcbbaaaaabbccdd.cb..
abbccdddccbbbbbccddeddccb.
bbccddeedccccccdddee.ddcb.
bccddee..dddddddde....dd.b
`;
export const SKULL_PAL = { '.': null, K: '#0c0a10', w: '#e9e3cf', x: '#c6bfa6', y: '#9a937c', z: '#6a6454', r: '#d8402e' };
export const skull = `
...KKKKKKK...
..KwwwwwwwK..
.KwwxwwwxwwK.
.KwxxxwxxxwK.
.KwKKKwKKKwK.
.KwKrKwKrKwK.
.KwKKKxKKKwK.
..KwxxKxxwK..
..KxwKwKwxK..
...KxwwwxK...
...KwKwKwK...
....KyyyyK...
.....KKKK....
`;

// ---- hell wall (flesh bricks) -------------------------------------------------------------------------------------------------------------
export const FLESH = { '.': null, h: '#e59a94', L: '#bb5a62', M: '#9a3f50', D: '#7a2a40', d: '#561a2e', m: '#1d0810', c: '#2c0c18', v: '#ff5a3c', V: '#ffb067', w: '#3a0e1c' };
export const veins = `
.....w.......w...
..ww.w.ww...w.w..
.w..ww..w..ww..w.
.w...w..www.....w
..w..w......ww..w
...www.....w.ww..
.....w...www..w..
`;
export const rune = `
....VVV....
...VvvvV...
..VvVVVvV..
.VvV...VvV.
.VV..V..VV.
.Vv.VvV.vV.
.VV..V..VV.
.VvV...VvV.
..VvVVVvV..
...VvvvV...
....VVV....
`;

// ---- wooden door (planks + iron bands) ------------------------------------------------------------------------------------------------------
export const WOOD = { '.': null, K: '#0c0a08', h: '#b58552', L: '#94683a', M: '#78512c', D: '#5a3a1f', d: '#3e2814', i: '#8d93a6', I: '#c3c9da', j: '#5a6076', g: '#e8c44a', b: '#3d7bd6', B: '#8fc0ff', n: '#2a4f98' };
export const plankA = `
KhLLLMLK
KhLLLMLK
KhLMLMDK
KhLLLMDK
KhLLLLMK
KhLLMLMK
KhLLLMMK
KhLLLMDK
KhMLLMDK
KhLLLMDK
KhLLLLMK
KhLLLMDK
KhLLMLMK
KhLLLMDK
KhLLLMDK
KhLLLMDK
`;
export const plankB = `
KhLLLMDK
KhLLMLMK
KhLLLMDK
KhLLLLMK
KhMLLMDK
KhLLLMDK
KhLLLMMK
KhLLLMDK
KhLLMLMK
KhLLLMDK
KhLLLMDK
KhLMLMDK
KhLLLLMK
KhLLLMDK
KhLLLMMK
KhLLLMDK
`;
export const band = `
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
KIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIK
KiiIiiiiiiiiiiiiiiiiiiiiIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiK
KijiiiiIiiiiiiiiiIiiiiiiiiiiiiiiiiiiiIiiiiiiiiiiiiiiiiiiiiiijK
KjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjK
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
`;
export const lock = `
....KKKKKKKK....
...KiiiiiiiiK...
..KiIIIIIIIIiK..
.KiIKKKKKKKKIiK.
.KiIKnBBBBnKIiK.
.KiIKBbbbbBKIiK.
.KiIKbbBBbbKIiK.
.KiIKbbBBbbKIiK.
.KiIKnbbbbnKIiK.
.KiIKKKKKKKKIiK.
..KiIIIIIIIIiK..
...KjjjjjjjjjK..
....KKKKKKKK....
`;
export const keyhole = `
...gg...
..g..g..
..g..g..
...gg...
...gg...
..gggg..
...gg...
`;

// ---- floor flags / ceiling slabs (16x16 stone units) ----------------------------------------------------------------------------------------
export const FLAG = { '.': null, h: '#6a6478', L: '#58526a', M: '#4a455c', D: '#3c374c', d: '#2c283a', m: '#14111c', c: '#1f1c2b' };
export const flagA = `
hhhhhhhhhhhhhhhm
hLLLLLLLLLLLLLdm
hLLLMLLLLLLLLLdm
hLLLLLLLLLDLLLdm
hLLLLLLLLLLLLLdm
hLMLLLLLLLLLMLdm
hLLLLLLLLLLLLLdm
hLLLLLDLLLLLLLdm
hLLLLLLLLLLLLLdm
hLLLLLLLLMLLLLdm
hLLDLLLLLLLLLLdm
hLLLLLLLLLLLLLdm
hLLLLLLLLLLLDLdm
hLLLLLMLLLLLLLdm
hddddddddddddddm
mmmmmmmmmmmmmmmm
`;
export const flagB = `
hhhhhhhhhhhhhhhm
hLLLLLLLLLLLLLdm
hLLLLLLLLMLLLLdm
hLLLLLLLLLLLLLdm
hLDLLLLLLLLLLLdm
hLLLLLLLLLLLLLdm
hLLLLLLMLLLLLLdm
hLLLLLLLLLLLLLdm
hLLLLLLLLLLLDLdm
hLLMLLLLLLLLLLdm
hLLLLLLLLLLLLLdm
hLLLLLLLLLLMLLdm
hLLLLLLLLLLLLLdm
hLLLLDLLLLLLLLdm
hddddddddddddddm
mmmmmmmmmmmmmmmm
`;
export const CEIL = { '.': null, h: '#3a3550', L: '#2e2a42', M: '#26223a', D: '#1e1b2f', d: '#171524', m: '#0c0b13', c: '#100e1a' };

// ---- blood splat + hell floor -------------------------------------------------------------------------------------------------------------------
export const BLOOD = { '.': null, r: '#7c1418', R: '#5a0d12', s: '#a21d22', t: '#3a080c' };
export const splat = `
......rr.....
...rrrRRrr...
..rRRRsRRRr..
.rRRsRRRRRRr.
.rRRRRRtRRRrr
rRRtRRRRRRsRr
.rRRRRRRRRRR.
.rrRRRsRRRr..
..rrRRRRRr...
...rr.rrr....
`;
export const HELLFLAG = { '.': null, h: '#7a3a3c', L: '#5f2a30', M: '#4c2026', D: '#3a171d', d: '#2a0f14', m: '#12060a', c: '#1c0a0e' };

// ---- exit gate (left half, mirrored by the packer): carved stone frame around a swirling portal --------------------------------------------------
export const GATE = { '.': null, K: '#0c0a10', h: '#8e88a8', L: '#6f698c', M: '#5a5476', D: '#463f5e', d: '#352f4a', n: '#1c1650', b: '#3a34b0', c: '#5a60e8', B: '#8fa0ff', w: '#e6eeff', g: '#e8c44a' };
const gateMotif = [
  'nnnnnnbbbbbbbbbcccccccBBBBBBBBww',
  'nnnnnbbbbbbbbbccccccBBBBBBBwwwww',
  'nnnnbbbbbbbbbccccccBBBBBBwwwwwww',
  'nnnbbbbbbbbbcccccBBBBBBBwwwwwwww',
  'nnnbbbbbbbbccccccBBBBBBwwwwwwwwB',
  'nnbbbbbbbbccccccBBBBBBwwwwwwwBBB',
  'nnnbbbbbbbbccccccBBBBBBwwwwwBBBB',
  'nnnnbbbbbbbbcccccBBBBBBBwwwwBBBc',
];
export const gateHalf = [
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  'KhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhH'.replace('H', 'h'),
  'KhLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
  'KhLMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
  'KhLMDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  'KhLMDKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  ...Array.from({ length: 58 }, (_, i) => `KhLMDK${gateMotif[(i * 3 + (i >> 3)) % 8].slice(0, 26)}`),
].map((r) => r.padEnd(32, 'K').slice(0, 32)).join('\n');
export const keyBand = band.replace(/i/g, 'n').replace(/I/g, 'B').replace(/j/g, 'n');

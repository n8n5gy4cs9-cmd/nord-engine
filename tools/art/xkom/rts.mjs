// X-KOM 2026 / Red Front — RTS art (Red Alert / Command & Conquer look): 16x16 tiles, 16x16 units, 1–3 tile buildings.
// Hand-typed pixels. Big flat areas use run-length rows: "K1 M10 L2" = 1×K, 10×M, 2×L ('.' = transparent); short rows are padded transparent.
// Team ramps D M L H (dark→highlight) are swapped per faction in index.mjs, so every unit/building exists for each team colour.
export const TEAMS = {
  xcom: { D: '#1c2a58', M: '#3860b8', L: '#6a98e8', H: '#c0daff' },
  allies: { D: '#1c2a58', M: '#3860b8', L: '#6a98e8', H: '#c0daff' },
  soviet: { D: '#5a1010', M: '#b02818', L: '#e85a30', H: '#ffb070' },
};
export const PAL = {
  '.': null, K: '#14141c', a: '#34343e', b: '#5c5c68', c: '#8c8c98', d: '#bcbcc8', e: '#f0f0f0', s: '#f2c494', S: '#c68c60', t: '#5a3c22', u: '#8a6a3c',
  g: '#4a7a2c', h: '#62933a', j: '#386020', p: '#6a4e2c', q: '#8a6a3c', r: '#a68450', y: '#a07818', Y: '#e8b830', O: '#fff0a0',
  W: '#2a4a8c', V: '#3a64b0', v: '#6a94d8', X: '#a8c8f0', f: '#c83020', F: '#ffd060', w: '#ffffff', o: '#ff8a20', z: '#3c3c3c', i: '#e0e0a0',
  1: '#1c3a24', 2: '#2f6a3a', 3: '#58a04a', 4: '#a8e070', 5: '#5a2a6a', 6: '#9a4ab0', 7: '#e080f0', R: '#ff3a2a', E: '#d8f060', G: '#46663a', I: '#7a9a4a',
};
const rle = (w, s) => { // tokens: <char><count>  ·  <char>* = fill the rest of the row (one per row)
  const toks = s.trim().split(/\s+/).filter(Boolean); let n0 = 0, star = -1;
  toks.forEach((t, i) => { if (t.slice(1) === '*') star = i; else n0 += parseInt(t.slice(1), 10) || 1; });
  if (n0 > w || (star < 0 && n0 < w && process.env.RLE_STRICT)) (globalThis.__bad ??= []).push(`${n0}/${w}: ${s}`);
  const out = toks.map((t, i) => t[0].repeat(i === star ? w - n0 : parseInt(t.slice(1), 10) || 1)).join('');
  return out.padEnd(w, '.');
};
const R = (w, ...lines) => lines.flatMap((l) => (Array.isArray(l) ? l : [l])).map((l) => rle(w, l));
const rep = (n, l) => Array(n).fill(l);
export { R as RLE, rep as REP };
const E16 = '................';
const swap = (rows, o) => { const r = [...rows]; for (const [i, v] of Object.entries(o)) r[+i] = v; return r; };

// ---- terrain (16x16) ---------------------------------------------------------------------------------------------------
export const TERRAIN = {
  grass1: ['gggggggghggggggg', 'ggjgggggggggjggg', 'gggggghggggggggg', 'hggggggggjggghgg', 'ggggjgggggggggjg', 'gggggggghggggggg', 'gjgggggggggjgggg', 'gggghggggggggggg', 'ggggggjggggghggg', 'ghggggggggggggjg', 'gggggggjgggggggg', 'ggjggggggghggggg', 'ggggghggggggggjg', 'gggggggggjgggggg', 'hggggjgggggggggg', 'gggggggggggghggg'],
  grass2: ['ggggggggjggggggg', 'gghgggggggggggjg', 'gggggjgggggghggg', 'gjgggggggggggggg', 'ggggggghggjggggg', 'gggghggggggggggj', 'ggggggggggggjggg', 'hggjgggggggggggg', 'gggggggghgggjggg', 'gggjggggggggggjg', 'ghggggggjggggggg', 'ggggggggggghgggg', 'gjggggghggggggjg', 'gggggggggggggggg', 'gggghggggjggghgg', 'ggjggggggggggggg'],
  dirt: ['qqqqqqrqqqqqqqqq', 'qqpqqqqqqqqqqpqq', 'qqqqqrqqqqqqqqqq', 'rqqqqqqqqpqqqrqq', 'qqqqpqqqqqqqqqqq', 'qqqqqqqrqqqqqqpq', 'qpqqqqqqqqqrqqqq', 'qqqqrqqqqqqqqqqq', 'qqqqqqpqqqqrqqqq', 'qrqqqqqqqqqqqqpq', 'qqqqqqqpqqqqqqqq', 'qqpqqqqqqrqqqqqq', 'qqqqqrqqqqqqqpqq', 'qqqqqqqqpqqqqqqq', 'rqqqpqqqqqqqrqqq', 'qqqqqqqqqqpqqqqq'],
  water1: ['WWWWWWWWWWWWWWWW', 'WWVVWWWWWWWWVVWW', 'WWWWWWWWWWWWWWWW', 'WWWWWWVVvWWWWWWW', 'WWWWWWWWWWWWWWWW', 'WVVvWWWWWWWWWWWW', 'WWWWWWWWWWVVWWWW', 'WWWWWWWWWWWWWWWW', 'WWWWWVVvWWWWWWWW', 'WWWWWWWWWWWWWWWW', 'WWVVWWWWWWWVVWWW', 'WWWWWWWWWWWWWWWW', 'WWWWWWWVVvWWWWWW', 'WWWWWWWWWWWWWWWW', 'WVVvWWWWWWWWWWVV', 'WWWWWWWWWWWWWWWW'],
  water2: ['WWWWWWWWWWWWWWWW', 'WWWWWWWWWWWWWWWW', 'WWWWVVWWWWWWWVVW', 'WWWWWWWWWWWWWWWW', 'WWWWWWWWVVvWWWWW', 'WWWWWWWWWWWWWWWW', 'WWVVvWWWWWWWWWWW', 'WWWWWWWWWWWVVWWW', 'WWWWWWWWWWWWWWWW', 'WWWWWWVVWWWWWWWW', 'WWWWWWWWWWWWWWWW', 'WVVWWWWWWWWWWVVW', 'WWWWWWWWWWWWWWWW', 'WWWWWWWWVVvWWWWW', 'WWWWWWWWWWWWWWWW', 'WWVVvWWWWWWWWWWW'],
  tree: ['ggggggKKKKgggggg', 'gggggKjjhhKggggg', 'ggggKjhhhhjKgggg', 'gggKjhhgjhhjKggg', 'ggKjhhhhhhhhjKgg', 'gKjhhjhhhhhhhjKg', 'gKjhhhhhjhhhhjKg', 'gKjjhhhhhhhjhjKg', 'ggKjjhhhhhhjjKgg', 'gggKjjjhhjjjKggg', 'ggggKKjjjjKKgggg', 'gggggKKtuKKggggg', 'ggggggKtuKgggggg', 'gggggKKtuKKggggg', 'ggggggKKKKgggggg', 'gggggggggggggggg'],
  rock: ['gggggggggggggggg', 'gggggKKKKggggggg', 'ggggKddccKgggggg', 'gggKdccccbKKgggg', 'gggKcccbbbcdKggg', 'ggKKcbbbbbcccKgg', 'gKdcbbbaabbccKgg', 'gKccbbaaaabbcKgg', 'gKcbbbaaaabbbKgg', 'ggKbbbaaaaabbKgg', 'gggKKbbaaabKKggg', 'ggggggKKKKgggggg', 'gggggggggggggggg', 'gggggggggggggggg', 'gggggggggggggggg', 'gggggggggggggggg'],
  ore1: ['qqqqqqqqqqqqqqqq', 'qqqqYYqqqqqqqqqq', 'qqqYOYYqqqqYYqqq', 'qqqyYYyqqqYOYYqq', 'qqqqyyqqqqyYYyqq', 'qqqqqqqqqqqyyqqq', 'qYYqqqqqqqqqqqqq', 'YOYYqqqYYqqqqqqq', 'yYYyqqYOYYqqYYqq', 'qyyqqqqyYyqYOYYq', 'qqqqqqqqyyqqyYyq', 'qqqYYqqqqqqqqyyq', 'qqYOYYqqqqqqqqqq', 'qqqyYyqqqYYqqqqq', 'qqqqyyqqqyYyqqqq', 'qqqqqqqqqqyqqqqq'],
  ore2: ['qqqqqqqqqqqqqqqq', 'qqYYqqqqqqqYYqqq', 'qYOYYqqqqYOYYqqq', 'qyYYyqqqqyYYyqqq', 'qqyyqqYYqqqyyqqq', 'qqqqqYOYYqqqqqqq', 'qqqqqyYYyqqqYYqq', 'qYYqqqyyqqqYOYYq', 'YOYYqqqqqqqyYYyq', 'yYYyqqqYYqqqyyqq', 'qyyqqqYOYYqqqqqq', 'qqqqqqyYYyqqYYqq', 'qqYYqqqyyqqYOYYq', 'qYOYYqqqqqqyYYyq', 'qyYYyqqqqqqqyyqq', 'qqyyqqqqqqqqqqqq'],
  road: ['qqqqqqqqqqqqqqqq', 'qaaaaaaaaaaaaaaq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qbbbbbbbbbbbbbbq', 'qaaaaaaaaaaaaaaq', 'qqqqqqqqqqqqqqqq'],
};
// shore tiles are not needed: water is drawn flat and animates between water1/water2.
export const TERRAIN_NAMES = Object.keys(TERRAIN);

// ---- infantry & vehicles (16x16, face right) --------------------------------------------------------------------------
const RIFLE = [E16, E16, '......KKKK......', '.....KDMMDK.....', '.....KMMMMK.....', '.....KKssKK.....', '......KssK..KK..', '.....KKKKK.Kcd..', '....KMMLMMKKcdK.', '...KMMMLMMMKKK..', '...KsKMMMMMK....', '....K.KMMMK.....', '.....KMMKMMK....', '.....KMK.KMK....', '.....KKK.KKK....', E16];
const ROCKET = [E16, E16, '......KKKK......', '.....KDMMDK.....', '.....KMMMMK...KK', '.....KKssKK.KKcd', '......KssK.KddcK', '.....KKKKKKKcKK.', '....KMMLMMMKKK..', '...KMMMLMMMMK...', '...KsKMMMMMK....', '....K.KMMMK.....', '.....KMMKMMK....', '.....KMK.KMK....', '.....KKK.KKK....', E16];
const inf = (base, aim) => [base, swap(base, { 12: '......KMMKK.....', 13: '.....KMK..KMK...', 14: '.....KKK..KKK...' }), swap(base, aim)];
const FLASH = { 7: '.....KKKKK.KcdKF', 6: '......KssK..KKFw' };
const TANK = [E16, E16, E16, '........KKKK....', '.......KMMMMKKKK', '.....KMLLMMKccdK', '..KKKKKMMMMKKKKK', '.KbbbbbbbbbbbbK.', 'KbaKaKaKaKaKaKbK', 'KbbbbbbbbbbbbbbK', 'KaKaKaKaKaKaKaKK', '.KKKKKKKKKKKKKK.', E16, E16, E16, E16];
const TANK_B = swap(TANK, { 8: 'KbKaKaKaKaKaKabK', 10: 'KKaKaKaKaKaKaKaK' });
const TANK_FIRE = swap(TANK, { 4: '......KMMMMKKKKw', 5: '....KMLLMMKccdKF' }); // tanks recoil 1px: handled below
const MED = [E16, E16, '........KKKKK...', '.......KMMMMMK..', '.....KMLLLMMKKKK', '.KKKKKMMMMMKcccK', '.KbbbbbKMMMMKKKK', 'KbbbbbbbbbbbbbbK', 'KbaKaKaKaKaKaKbK', 'KbbbbbbbbbbbbbbK', 'KaKaKaKaKaKaKaKK', '.KKKKKKKKKKKKKK.', E16, E16, E16, E16].map((r) => r);
const MED_B = swap(MED, { 8: 'KbKaKaKaKaKaKabK', 10: 'KKaKaKaKaKaKaKaK' });
const HARV = [E16, E16, '..KKKKKKKKKK....', '.KddddddddddK...', '.KdMMMMMMMMdK...', '.KdMLLLLLLMdKKK.', '.KdMMMMMMMMdKccK', '.KddddddddddKKKK', 'KbbbbbbbbbbbbbK.', 'KbaKaKaKaKaKabK.', 'KbbbbbbbbbbbbbK.', 'KaKaKaKaKaKaKaK.', '.KKKKKKKKKKKKK..', E16, E16, E16];
const HARV_B = swap(HARV, { 9: 'KbKaKaKaKaKaKbK.', 11: 'KKaKaKaKaKaKaKK.' });
const veh = (a, b, f) => [a, b, f];
export const UNITS = {
  rifle: inf(RIFLE, FLASH), rocket: inf(ROCKET, { 5: '.....KKssKK.KcdF', 4: '.....KMMMMK..KKw' }),
  ltank: veh(TANK, TANK_B, swap(TANK, { 5: '....KMLLMMKccdKF', 4: '......KMMMMKKKKw' })),
  mtank: veh(MED, MED_B, swap(MED, { 5: '....KMLLLMMKKKKw', 6: 'KKKKKMMMMMKcccKF' })),
  harv: veh(HARV, HARV_B, HARV),
};
// aliens (X-KOM RTS faction): bio-green with purple; 1..4 flesh ramp
const WARRIOR = [E16, E16, '.....KK..KK.....', '....K33KK33K....', '....K3RK3RK3K...', '.....K3333K.....', '......K22K......', '...KKKK22KKKK...', '..K33K2222K33K..', '..K3K.2332.K3K..', '..K4K.2222.K4K..', '...K..K22K..K...', '.....K22K22K....', '....K22K.K22K...', '....K11K.K11K...', E16].map((r) => r);
const SPITTER = [E16, E16, '......KKKK......', '.....K5665K.....', '....K56R6R6K....', '....K566666K....', '.....K5665K.....', '....KK5775KK....', '...K556667555K..', '...K5K5775K5K...', '...K4K5555K4K...', '....K.K55K.K....', '.....K55K55K....', '....K55K.K55K...', '....K11K.K11K...', E16].map((r) => r);
const WALKER = [E16, '....KKKKKKKK....', '...K33333333K...', '..K3322222233K..', '..K32RR22RR23K..', '..K3222222223K..', '..K4K222222K4K..', '..KKKK2332KKKK..', '.K22K.K22K.K22K.', '.K2K..K22K..K2K.', 'K22K..K22K..K22K', 'K2K...K22K...K2K', 'K1K...K11K...K1K', 'KK....KKKK....KK', E16, E16].map((r) => r);
const ainf = (b) => [b, swap(b, { 12: '.....K22K.K22K..', 13: '....K22K..K22K..', 14: '....K11K..K11K..' }), swap(b, { 5: '.....K3EEK......', 7: '...KKKK22KKKKEE.' })];
UNITS.warrior = ainf(WARRIOR); UNITS.spitter = ainf(SPITTER);
UNITS.walker = [WALKER, swap(WALKER, { 8: '.K22K.K22K.K22K.', 9: 'K2K...K22K..K2K.', 10: '.K22K.K22K.K22K.', 11: '.K2K..K22K..K2K.' }), swap(WALKER, { 4: '..K32RR22RR2EEE.', 5: '..K3222222223KE.' })];
export const UNIT_NAMES = ['rifle', 'rocket', 'ltank', 'mtank', 'harv', 'warrior', 'spitter', 'walker'];

// ---- buildings --------------------------------------------------------------------------------------------------------
// Conyard 48x48 (3x3): crane, roof with command dome, roll door.
export const FACT = R(48,
  '.30 K14 .4', '.30 K1 F12 K1 .4', '.30 K14 .4',
  '.3 K42 .3', rep(2, '.3 K1 d40 K1 .3'),
  rep(3, '.3 K1 d1 c12 K1 c12 K1 c12 b1 K1 .3'),
  rep(2, '.3 K1 d1 c10 K1 M16 K1 c10 b1 K1 .3'),
  rep(3, '.3 K1 d1 c10 K1 M1 L14 M1 K1 c10 b1 K1 .3'),
  rep(3, '.3 K1 d1 c10 K1 M1 L3 H8 L3 M1 K1 c10 b1 K1 .3'),
  rep(2, '.3 K1 d1 c10 K1 M1 L14 M1 K1 c10 b1 K1 .3'),
  rep(2, '.3 K1 d1 c10 K1 M16 K1 c10 b1 K1 .3'),
  rep(3, '.3 K1 d1 c12 K1 c12 K1 c12 b1 K1 .3'),
  '.3 K42 .3', '.3 K1 M40 K1 .3', rep(2, '.3 K1 b40 K1 .3'), rep(2, '.3 K1 b13 K1 a12 K1 b13 K1 .3'),
  rep(4, '.3 K1 b2 F4 b7 K1 a12 K1 b7 F4 b2 K1 .3'), rep(4, '.3 K1 b13 K1 z12 K1 b13 K1 .3'),
  '.3 K1 a40 K1 .3', '.3 K42 .3',
  '.1 K46 .1', rep(6, '.1 K1 c44 K1 .1'), '.1 K46 .1',
);
// Power plant 32x32 (2x2): two cooling stacks with team stripe.
const STACK = '.4 K1 d2 e2 d2 c2 K1 .4 K1 d2 e2 d2 c2 K1 .4';
export const POWR = R(32,
  '.', '.4 K10 .4 K10 .4', '.4 K1 b8 K1 .4 K1 b8 K1 .4', rep(6, STACK), rep(2, '.4 K1 D1 M5 L2 K1 .4 K1 D1 M5 L2 K1 .4'), rep(4, STACK),
  '.2 K28 .2', rep(5, '.2 K1 d3 c21 b2 K1 .2'), '.2 K1 d3 c4 K1 M6 K1 c9 b2 K1 .2', '.2 K28 .2',
  rep(2, '.2 K1 b26 K1 .2'), rep(2, '.2 K1 b2 K1 F3 K1 b3 K1 F3 K1 b3 K1 F3 K1 b3 K1 .2'), rep(2, '.2 K1 b26 K1 .2'), '.2 K1 a26 K1 .2', '.2 K28 .2',
);
// Barracks 32x32 (2x2): quonset hut.
export const BARR = R(32,
  '.9 K14 .9', '.8 K1 L14 K1 .8', '.6 K1 M1 L16 M1 K1 .6', '.4 K1 M2 L18 M2 K1 .4',
  rep(4, ['.2 K1 M2 L22 M2 K1 .2', '.2 K1 M1 L1 M22 L1 M1 K1 .2']).flat(),
  '.2 K1 D28 K1 .2'.replace('D28', 'D26') + '', '.2 K28 .2',
  '.2 K1 b26 K1 .2', '.2 K1 M26 K1 .2', '.2 K1 b26 K1 .2', rep(3, '.2 K1 b9 K1 a6 K1 b9 K1 .2'), rep(5, '.2 K1 b9 K1 a6 K1 b9 K1 .2'), '.2 K28 .2', '.2 K28 .2'.replace('K28', 'c28'),
);
// War factory 48x32 (3x2): hangar with team roof and roll door.
export const WEAP = R(48,
  '.', '.', '.2 K44 .2', rep(2, '.2 K1 d42 K1 .2'), '.2 K1 d1 c8 M24 c8 b1 K1 .2', '.2 K1 d1 c8 L24 c8 b1 K1 .2', '.2 K1 d1 c8 M24 c8 b1 K1 .2',
  '.2 K1 d1 c8 L24 c8 b1 K1 .2', '.2 K1 d1 c8 M24 c8 b1 K1 .2', '.2 K44 .2', rep(2, '.2 K1 b42 K1 .2'),
  ['.2 K1 b6 K1 a28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2'].flatMap((l) => [l]).concat(['.2 K1 b6 K1 a28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2', '.2 K1 b6 K1 a28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2', '.2 K1 b6 K1 a28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2', '.2 K1 b6 K1 z28 K1 b6 K1 .2']),
  '.2 K44 .2', '.1 K46 .1', rep(3, '.1 K1 c44 K1 .1'), '.1 K46 .1',
);
// Refinery 48x32 (3x2): plant on the left, ore hopper on the right.
export const PROC = R(48,
  '.', '.', '.2 K26 .2 K16 .2', '.2 K1 d24 K1 .2 K1 Y1 O3 Y8 y2 K1 .2', '.2 K1 d24 K1 .2 K1 Y2 O2 Y8 y2 K1 .2',
  rep(2, '.2 K1 d1 c6 M10 c6 b1 K1 .2 K1 Y14 K1 .2'), rep(2, '.2 K1 d1 c6 L10 c6 b1 K1 .2 K1 y1 Y12 y1 K1 .2'), '.2 K1 d1 c6 M10 c6 b1 K1 .2 K1 y14 K1 .2',
  '.2 K26 .2 K16 .2', rep(2, '.2 K1 b24 K1 .2 K1 b14 K1 .2'), rep(9, '.2 K1 b8 K1 a6 K1 b8 K1 .2 K1 b5 K1 a4 K1 b3 K1 .2'),
  '.2 K26 .2 K16 .2', '.1 K46 .1', rep(3, '.1 K1 c44 K1 .1'), '.1 K46 .1',
);
// Gun turret 16x16: two frames (idle, fire).
export const GUN = [
  R(16, '.', '.', '.4 K6 .6', '.3 K1 b6 K1 .5', '.2 K1 b1 c6 b1 K1 .4', '.2 K1 b1 c1 M4 c1 b1 K4 .1', '.2 K1 b1 c1 M1 L2 M1 c1 b1 K1 c2 d1 K1', '.2 K1 b1 c1 M1 L2 M1 c1 b1 K4 .1', '.2 K1 b1 c1 M4 c1 b1 K1 .4', '.2 K1 b1 c6 b1 K1 .4', '.3 K1 b6 K1 .5', '.4 K6 .6'),
  R(16, '.', '.', '.4 K6 .6', '.3 K1 b6 K1 .5', '.2 K1 b1 c6 b1 K1 .4', '.2 K1 b1 c1 M4 c1 b1 K4 .1', '.2 K1 b1 c1 M1 L2 M1 c1 b1 K1 c2 d1 F1', '.2 K1 b1 c1 M1 L2 M1 c1 b1 K3 w1 F1', '.2 K1 b1 c1 M4 c1 b1 K1 .4', '.2 K1 b1 c6 b1 K1 .4', '.3 K1 b6 K1 .5', '.4 K6 .6'),
];
// Alien hive 48x48 (3x3): the thing you have to kill.
export const HIVE = R(48,
  '.', '.', '.19 K10 .19', '.16 K3 3* K3 .16', '.14 K2 4 3* 2 1 K2 .14', '.12 K2 4 3 6 3* 2 2 1 K2 .12', '.10 K2 4 3 3* 7 6 2 2 1 K2 .10',
  '.8 K2 4 3 3 3* 2 6 2 1 1 K2 .8', '.7 K1 4 3 3 3 5 3* 2 2 2 1 1 K1 .7', '.6 K1 4 3 3 3* 5 6 5 2 2 1 1 K1 .6', '.5 K1 4 3 3 3* 2 2 2 2 1 1 1 K1 .5',
  '.4 K1 3 3 3 6 3* 2 2 2 2 5 1 1 K1 .4', '.4 K1 3 3 3* 2 2 K3 R1 K3 2 2 1 1 1 K1 .4'.replace('K3 R1 K3', 'K3 R1 K3'), '.3 K1 4 3 3* 2 2 K1 1 R3 1 K1 2 2 1 1 1 K1 .3',
  '.3 K1 3 3 5 3* 2 K1 1 R3 1 K1 2 2 5 1 1 K1 .3', '.3 K1 3 3 3* 2 2 2 K5 2 2 2 2 1 1 1 K1 .3', '.2 K1 3 3 3 6 3* 2 2 2 2 2 2 2 1 1 1 K1 .2',
  '.2 K1 3 3 3 3* 2 2 2 2 2 2 2 5 1 1 1 K1 .2', '.2 K1 3 3 2 2 2* 2 2 2 2 1 1 1 1 K1 .2', '.2 K1 3 2 2 2 6 2* 2 2 2 2 2 1 1 1 1 K1 .2',
  '.2 K1 3 2 2 2* 2 2 K1 5 K1 2 2 2 1 1 1 1 K1 .2', '.2 K1 2 2 2 2* 2 2 K1 5 K1 2 2 1 1 1 1 1 K1 .2', '.2 K1 2 2 2 2 2* 7 6 2 2 2 1 1 1 1 1 K1 .2',
  '.2 K1 2 2 2* 2 2 2 2 2 1 1 1 1 1 1 K1 .2', '.2 K1 2 2 2 2 2* 2 2 2 2 2 1 1 1 1 1 K1 .2', '.3 K1 2 2 2* 2 2 2 2 1 1 1 1 1 1 K1 .3',
  '.3 K1 2 1 1* 1 1 1 1 1 1 1 1 1 K1 .3', '.4 K1 1 1* 1 1 1 1 1 1 1 1 K1 .4', '.5 K36 .7',
);
// Brood pool 32x32 (2x2) and spore tower 16x16 (two frames) — alien defences.
export const BROOD = R(32,
  '.', '.', '.', '.10 K12 .10', '.7 K3 3* K3 .7', '.5 K2 4 3 3* 2 2 1 K2 .5', '.4 K1 4 3 6 3* 2 2 1 1 K1 .4',
  '.3 K1 4 3 3 3* 7 6 2 2 1 1 K1 .3', '.3 K1 3 3 3* K2 R2 K2 2 2 1 1 K1 .3', '.2 K1 3 3 3 3* K1 R4 K1 2 2 2 1 1 K1 .2',
  '.2 K1 3 3 3* 2 K1 R4 K1 2 2 2 1 1 K1 .2', '.2 K1 3 3 5 3* 2 2 K4 2 2 2 5 1 1 K1 .2', '.2 K1 3 3 3 3* 2 2 2 2 2 2 2 1 1 1 K1 .2',
  '.2 K1 2 2 2 2* 2 2 2 2 2 1 1 1 1 K1 .2', '.3 K1 2 2 2* 2 2 6 7 2 1 1 1 1 K1 .3', '.3 K1 2 2 2* 2 2 2 2 1 1 1 1 1 K1 .3',
  '.4 K1 1 1 1* 1 1 1 1 1 1 K1 .4', '.6 K20 .6',
);
const TOWER_A = R(16, '.4 K4 .8', '.4 K1 R2 K1 .8', '.4 K1 4 3 3 K1 .7', '.3 K1 3 6 3 3 2 K1 .6', '.3 K1 3 3 3 2 2 K1 .6', '.4 K1 2 2 2 2 K1 .6', '.4 K1 2 3 3 2 K1 .6', '.4 K1 2 2 2 2 K1 .6', '.3 K1 2 2 2 2 2 2 K1 .5', '.3 K1 2 1 2 2 1 2 K1 .5', '.2 K1 2 2 1 2 2 1 2 2 K1 .4', '.2 K1 1 1 1 1 1 1 1 1 K1 .4', '.3 K8 .5');
const TOWER_B = R(16, '.7 E2 .7', '.6 E1 .1 E1 .7', '.4 K1 E2 K1 .8', '.4 K1 E2 K1 .8', '.4 K1 4 3 3 K1 .7', '.3 K1 3 6 3 3 2 K1 .6', '.3 K1 3 3 3 2 2 K1 .6', '.4 K1 2 2 2 2 K1 .6', '.4 K1 2 3 3 2 K1 .6', '.4 K1 2 2 2 2 K1 .6', '.3 K1 2 2 2 2 2 2 K1 .5', '.3 K1 2 1 2 2 1 2 K1 .5', '.2 K1 2 2 1 2 2 1 2 2 K1 .4', '.2 K1 1 1 1 1 1 1 1 1 K1 .4', '.3 K8 .5');
export const TOWER = [TOWER_A, TOWER_B];
export const BUILDINGS = {
  fact: { w: 48, h: 48, frames: [FACT], team: true }, powr: { w: 32, h: 32, frames: [POWR], team: true }, barr: { w: 32, h: 32, frames: [BARR], team: true },
  weap: { w: 48, h: 32, frames: [WEAP], team: true }, proc: { w: 48, h: 32, frames: [PROC], team: true }, gun: { w: 16, h: 16, frames: GUN, team: true },
  hive: { w: 48, h: 48, frames: [HIVE], team: false, center: true }, brood: { w: 32, h: 32, frames: [BROOD], team: false, center: true }, tower: { w: 16, h: 16, frames: TOWER, team: false },
};

// ---- cursors / selection / effects (16x16) -----------------------------------------------------------------------------
const UPAL = { '.': null, w: '#ffffff', K: '#14141c', g: '#60e060', r: '#ff4030', y: '#ffe060', o: '#ff9a30', F: '#fff6b0', Y: '#ffd040', D: '#a0201a', d: '#5a5a66', s: '#8a8a96', E: '#d8f060', 6: '#9a4ab0', 7: '#e080f0', k: '#00000066', b: '#3a78d8' };
export const UI = {
  arrow: ['KK..............', 'KwK.............', 'KwwK............', 'KwwwK...........', 'KwwwwK..........', 'KwwwwwK.........', 'KwwwwwwK........', 'KwwwwwwwK.......', 'KwwwwwKKKK......', 'KwwKwwK.........', 'KwK.KwwK........', 'KK..KwwK........', '.....KwwK.......', '.....KwwK.......', '......KK........', E16],
  attack: ['................', '.......rr.......', '.......rr.......', '....rr.rr.rr....', '...r...rr...r...', '..r....rr....r..', '..r.........r...'.replace('r...', 'r..').padEnd(16, '.'), '.rrrr.....rrrr..', '.rrrr.....rrrr..', '..r..........r..', '..r....rr....r..', '...r...rr...r...', '....rr.rr.rr....', '.......rr.......', '.......rr.......', E16],
  select: ['wwww........wwww', 'w..............w', 'w..............w', 'w..............w', '................', '................', '................', '................', '................', '................', '................', 'w..............w', 'w..............w', 'w..............w', 'wwww........wwww', E16].map((r, i) => (i === 15 ? 'wwww........wwww' : r)),
  move: ['................', '................', '......gggg......', '....gg....gg....', '...g........g...', '...g........g...', '..g....gg....g..', '..g....gg....g..', '..g..........g..', '...g........g...', '...g........g...', '....gg....gg....', '......gggg......', '................', '................', E16],
};
export const UI_NAMES = Object.keys(UI);
export const FXR = {
  boom1: ['................', '................', '.......oo.......', '......oFFo......', '.....oFFFFo.....', '......oFFo......', '.......oo.......', E16, E16, E16, E16, E16, E16, E16, E16, E16],
  boom2: ['................', '.....o..o.......', '....oFFoFo......', '...oFFFFFFo.....', '..oFFYYYFFFo....', '...oFFYYYFFo....', '....oFFFFFo.....', '.....oo.oo......', E16, E16, E16, E16, E16, E16, E16, E16],
  boom3: ['..o..oo..o......', '.oFo.oFFo.oo....', '..oFFFFFFFo.....', '.oFFYYYYYYFFo...', 'oFFYYDDDDYYFFo..', '.oFFYYDDYYFFo...', '..oFFYYYYFFo....', '.o.oFFFFFFo.o...', '....oo..oo......', E16, E16, E16, E16, E16, E16, E16],
  boom4: ['....d...d.......', '..d.s.d..d......', '...d.dd.dd.d....', '..d..kk.k..d....', '.d.dk..kk.d.....', '..d..dd..d..d...', '....d..d........', E16, E16, E16, E16, E16, E16, E16, E16, E16],
  muzzle: [E16, E16, E16, E16, E16, '......Fw........', '.....FwwF.......', '......Fw........', E16, E16, E16, E16, E16, E16, E16, E16],
  spit: [E16, E16, E16, E16, E16, '.....66.........', '....6EE6........', '....6EE6........', '.....66.........', E16, E16, E16, E16, E16, E16, E16],
  rocket: [E16, E16, E16, E16, E16, E16, '....ss..........', '...sddF.........', '....ss..........', E16, E16, E16, E16, E16, E16, E16],
};
export const FX_NAMES = Object.keys(FXR);

// ---- build: returns the output list for pixelart.mjs. `teams` = faction rows (e.g. ['xcom'] or ['allies','soviet']) ---------
export function build(px, teams) {
  const pal = (t) => ({ ...PAL, ...TEAMS[t] });
  const g = (rows, p, name) => px.grid(rows, p, name);
  const m = (w, h, extra) => ({ type: 'spritesheet', frameWidth: w, frameHeight: h, filter: 'nearest', ...extra });
  const out = [];
  out.push({ out: 'assets/rts/terrain.png', image: px.sheet(TERRAIN_NAMES.map((n) => g(TERRAIN[n], PAL, `terrain:${n}`)), 10), meta: m(16, 16, { frames: Object.fromEntries(TERRAIN_NAMES.map((n, i) => [n, i])) }), preview: 4 });
  const uf = [];
  for (const t of teams) for (const u of UNIT_NAMES) for (const f of UNITS[u]) uf.push(g(f, pal(t), `unit:${t}:${u}`));
  out.push({ out: 'assets/rts/units.png', image: px.sheet(uf, UNIT_NAMES.length * 3), meta: m(16, 16, { framesPerRow: UNIT_NAMES.length * 3, units: UNIT_NAMES, teams, note: 'rows = teams; per unit 3 frames: A (idle/walk 1), B (walk 2), C (shoot). Faces right; the game mirrors it.' }), preview: 4 });
  for (const [name, b] of Object.entries(BUILDINGS)) {
    const fr = []; const fit = (rows) => { const gap = b.h - rows.length, top = b.center ? gap >> 1 : gap, blank = '.'.repeat(b.w); return [...Array(top).fill(blank), ...rows, ...Array(gap - top).fill(blank)]; };
    for (const t of b.team ? teams : [teams[0]]) for (const f of b.frames) fr.push(g(fit(f), pal(t), `${name}:${t}`));
    out.push({ out: `assets/rts/b_${name}.png`, image: px.sheet(fr, fr.length), meta: m(b.w, b.h, { teams: b.team ? teams : ['neutral'], framesPerTeam: b.frames.length, note: 'frames per team in order; second frame (if any) = firing' }), preview: 4 });
  }
  out.push({ out: 'assets/rts/ui.png', image: px.sheet(UI_NAMES.map((n) => g(UI[n], UPAL, `ui:${n}`)), 8), meta: m(16, 16, { frames: Object.fromEntries(UI_NAMES.map((n, i) => [n, i])) }), preview: 4 });
  out.push({ out: 'assets/rts/fx.png', image: px.sheet(FX_NAMES.map((n) => g(FXR[n], UPAL, `fx:${n}`)), 8), meta: m(16, 16, { frames: Object.fromEntries(FX_NAMES.map((n, i) => [n, i])) }), preview: 4 });
  return out;
}

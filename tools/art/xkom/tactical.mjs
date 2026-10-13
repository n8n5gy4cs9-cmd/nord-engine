// X-KOM 2026 — isometric tactical art (UFO Defense look). Every pixel typed by hand: one character = one pixel.
// Ground = 32x16 diamonds · blocks = 32x32 (diamond top + two faces) · units 16x24 (A idle, B walk, C/D shoot, E dead).
// Ground rows are typed as 4-pixel chunks separated by spaces (widths 4,8,..,32,32,..,4) – spaces are removed by dia().
export const PAL = {
  '.': null, K: '#14141c',
  g: '#4a7a2c', h: '#62933a', j: '#386020',          // grass
  d: '#8a6a3c', e: '#a28048', f: '#6e5230',          // dirt
  m: '#6a7480', n: '#8a96a2', o: '#4c5560',          // ufo / metal floor
  w: '#c8a838', x: '#e2c850', y: '#a08428',          // wheat field
  c: '#7c7c76', v: '#9a9a92', u: '#5e5e5a', p: '#e8e0b0', // road asphalt + paint
  a: '#3c3c4c', b: '#62627a', q: '#9494ac', r: '#c8c8dc',
  s: '#f2c494', S: '#c68c60', Z: '#2a2230', E: '#d8f060', y2: '#ffe070', F: '#fff6b0', O: '#ff9a30', R: '#e03a2a',
  B: '#1e2c58', N: '#3a58a0', C: '#6c8ad8', T: '#3c3420', U: '#6a5a38', G: '#2c4c1c', I: '#486a2c', J: '#7ab04a', M: '#6a4a2a', W: '#8a6a3c',
  P: '#566a36', Q: '#3a4a26', X: '#8a9a62', A: '#a88a5a',
};
export const dia = (rows) => rows.map((r) => r.replace(/ /g, ''));
const pad = (r) => { const w = r.length; const lead = (32 - w) / 2; return '.'.repeat(lead) + r + '.'.repeat(lead); };
export const diaGrid = (rows) => dia(rows).map(pad);

export const GROUND = {
  grass: diaGrid([
    'ggjg', 'gghg gjgg', 'ggjg ghgg gjgg', 'hggg jggg gghg jggg', 'ggjg gghg ggjg gggh gjgg',
    'gggg jggh gggg gjgg ghgg jggg', 'ghgg gjgg gggj gghg ggjg gggg hggj', 'ggjg gghg gggg jggg ghgg gjgg gggh ggjg',
    'gjgg ggjg hggg ggjg gghg gggj jggg gghg', 'gggj gghg gjgg gggg hggg jggg ggjg', 'ghgg ggjg gggg gjgh ggjg gggg',
    'jggg gghg gjgg gggg ghgj', 'ggjg gggh gjgg gghg', 'gghg gjgg ggjg', 'ggjg ghgg', 'gjgg',
  ]),
  dirt: diaGrid([
    'ddfd', 'ddedddfd', 'dfddeddddfdd', 'dddfdddeddddfddd', 'edddfdddddfdeddddfdd',
    'ddddfdddedddddfdddedfddd', 'dfddddedddfddddddedddfddddfd', 'dddd fddd edfd dddd ddde dddf dddd ddfd',
    'dfdddedddddfddddedddddfdddddedd'.slice(0, 31) + 'd', 'ddedddfdddddeddddfddddddeddd', 'dddfddddeddddfdddddedfdd',
    'fdddeddddddfdddeddfd', 'ddfdddeddddfdedd', 'dedddfddddfd', 'ddfddedd', 'dfdd',
  ]),
  metal: diaGrid([
    'mmnm', 'mmmmomnm', 'mnmmmmommmmm', 'mmommnmmmmmommmm', 'mmmmmmommnmmmmmmmmom',
    'mmnmmmmmmommmmnmmmmmmmom', 'mmmmommmnmmmmmmmommmmnmmmmmm', 'mmommmmmmmnmmmommmmmmmmmmommnmmm',
    'ommnmmmmommmmmmmmnmmmmmommmmmmmo'.slice(0, 31) + 'o', 'ommmmommmnmmmmmmmommmmmmnmmo', 'ommmnmmmmmommmmmmmnmmmmo',
    'ommmmmmommmmmmnmmmmo', 'ommnmmmmmmommmmo', 'ommmmmmmmmmo', 'ommmmmmo', 'oooo',
  ]),
  field: diaGrid([
    'wwxw', 'wwxwwyww', 'wxwwwywwwxww', 'wwywwxwwwwywwxww', 'wxwwywwwxwwywwwxwwyw',
    'wwywwxwwwywwwxwwywwwxwwy', 'wxwwwywwxwwwywwwxwwywwwxwwyw', 'wwywwxwwwywwwxwwywwxwwwywwxwwwyw',
    'ywwxwwwywwwxwwywwwxwwwywwwxwwyww', 'wwxwwwywwxwwywwwxwwwywwxwwyw', 'wywwwxwwywwwxwwywwwxwwyw',
    'wwxwwywwwxwwywwwxwwy', 'wywwxwwwywwxwwyw', 'wwxwwywwwxww', 'wywwxwwy', 'wwxw',
  ]),
};
// asphalt: same 16 rows drawn once more, with painted centre dashes running along the iso diagonal
GROUND.road = diaGrid([
  'cccv', 'ccvccucc', 'cvcccpcvcccc', 'ccucccppcccvcccc', 'cccvcccppcccucccvccc',
  'cuccccvccppccccucccvcccc', 'ccccvcccucccppcccccvccuccccc'.slice(0, 28), 'cvccccucccvcccpppcccccvccuccccvc'.slice(0, 32),
  'ccucccvccccuccpppcccvcccccuccvcc'.slice(0, 32), 'cccvccuccccccppcccucccvcccvc', 'ccccuccvcccccppcccvcccuc',
  'cvcccucccccppccccucc', 'ccccvccpcccuccvc', 'cucccppcccvc', 'cccpcvcc', 'cucc',
]);

// ---- blocks ----------------------------------------------------------------------------------------------------------
// top diamond (T highlight tones: T base, t light, K outline) – 16 rows, widths 4..32..4 (chunks)
export const BLOCK_TOP = diaGrid([
  'KKKK', 'KTTT TTTK', 'KTtT TTTT TTTK', 'KTTT TtTT TTTT TTTK', 'KTTT TTtT TTTT TTtT TTTK',
  'KTtT TTTT TTTT TTTT TTTT TTTK', 'KTTT TTTT TtTT TTTT TTTT TTtT TTTK', 'KTTT TtTT TTTT TTTT TTTT TTTT TTTT TTTK',
  'KTTT TTTT TTTT TtTT TTTT TTTt TTTT TTTK', 'KTTT TTtT TTTT TTTT TTTT TTTT TTTK', 'KTTT TTTT TTTT TtTT TTTT TTTK',
  'KTTT TTTT TTTT TTTT TTTK', 'KTtT TTTT TTTT TTTK', 'KTTT TTTT TTTK', 'KTTT TTTK', 'KKKK',
]);
// left face (16 wide, rows 9..31 of the 32-row block). L base · k groove (plank line / panel seam) · K outline. The right face is this, mirrored.
export const BLOCK_LEFT = [
  'KL..............', 'KLLL............', 'KLLLLL..........', 'KLLLLLLL........', 'KLLLLLLLLL......',
  'KLkkLLLLLLLL....', 'KLLLkkLLLLLLLL..', 'KLLLLLkkLLLLLLLk', 'KLLLLLLLLkkLLLLk', 'kkLLLLLLLLkkLLLk',
  'KLkkLLLLLLLLkkLk', 'KLLLkkLLLLLLLLkk', 'KLLLLLkkLLLLLLLk', 'KLLLLLLLkkLLLLLk', 'kkLLLLLLLLkkLLLk',
  'KLkkLLLLLLLLkkLk', '..KLkkLLLLLLLLkk', '....KLkkLLLLLLLk', '......KLkkLLLLLk', '........KLkkLLLk',
  '..........KLkkLk', '............KLkk', '..............Kk',
];
export const MATERIALS = {
  wood: { T: '#b08850', t: '#c8a064', L: '#8a6234', k: '#6e4c28', RL: '#6e4c28', Rk: '#54381c' },
  hull: { T: '#8c98a8', t: '#a8b4c4', L: '#5e6c80', k: '#46546a', RL: '#46546a', Rk: '#343f52' },
  power: { T: '#e8d060', t: '#fff090', L: '#c0701c', k: '#8a4a10', RL: '#8a4a10', Rk: '#5e3008' },
  crate: { T: '#c0a060', t: '#d8bc78', L: '#9a7a40', k: '#5e4620', RL: '#7a5e2c', Rk: '#463414' },
};

// ---- tree (20x26, base sits on the tile centre) ----------------------------------------------------------------------
export const TREE = [
  '......KKKKKK........', '....KKIIIIIIKK......', '...KIIJJIIIIIIK.....', '..KIIJJJIIIIIIIGK...', '.KIIIIJJIIIIIIIIGK..',
  '.KIIIIIIIIIIJIIIGK..', 'KIIJIIIIIIIIIIIIIGGK', 'KIIIJIIIIIJIIIIIIGGK', 'KIIIIIIIIJJIIIIIGGGK', '.KIIIIIIIIIIIIIIGGK.',
  '.KGIIIIJIIIIIIIGGGK.', '..KGIIIIIIIIIIGGGK..', '...KGGIIIIIIGGGGK...', '....KKGGGGGGGGKK....', '......KKGGGGKK......',
  '........KTUK........', '........KTUK........', '........KTUK........', '.......KTTUUK.......', '......KKKKKKKK......',
];

// ---- units (16x24, facing right/down, the game mirrors for left) -----------------------------------------------------
// Letters: K outline · B/N/C = dark/mid/light armour · s/S skin · a/b/q/r metal · E green eyes/gun glow · F/y2/O muzzle flash
const swap = (rows, o) => { const r = [...rows]; for (const [i, v] of Object.entries(o)) r[+i] = v; return r; };
const SOLDIER = [
  '................', '................', '......KKKK......', '.....KCCCNK.....', '....KCCNNNNK....', '....KCNNNNNK....',
  '....KNKssssK....', '.....KsKssSK....', '.....KsssssK....', '......KsSSK.....', '....KKKNNNKK....', '...KNNNCNNNNK...',
  '...KNNCNNNNNNK..', '...KsKNNNNNNKKKK', '...KKKNNNNNKbbbK', '.....KNNNNNKKKK.', '....KNNKKNNK....', '....KNNK.KNNK...',
  '....KNNK.KNNK...', '....KNNK.KNNK...', '....KBBK.KBBK...', '...KKKKK.KKKKK..', '................', '................',
];
const SECTOID = [
  '................', '................', '......KKKK......', '....KKsssKK.....', '...KsssSssssK...', '...KssssssssSK..',
  '...KsKKssKKsK...', '...KsKKssKKsK...', '...KsKKsssSsK...', '....KssSsssK....', '.....KKsssKK....', '.....KsKKKsK....',
  '...KKKKNNNKKKK..', '..KNNNNCNNNNNK..', '..KsNNNNNNNNKKKK', '...KKNNNNNKEEEEK', '.....KNNNNK.KKKK', '....KNNKKNNK....',
  '....KNK..KNK....', '....KNK..KNK....', '....KsK..KsK....', '...KKKK..KKKK...', '................', '................',
];
const MUTON = [
  '................', '......KKKK......', '.....KIIIIK.....', '....KIIJIIIK....', '....KIKEKEIK....', '....KIIIIIIK....',
  '.....KIKKIK.....', '..KKKKIIIIKKKK..', '.KGGGGJGGGGGGK..', '.KGGIGGGGGGGGKK.', '.KIKGGGGGGGGGKKK', '.KKKGGGGGGGGKEEK',
  '...KGGGGGGGGKEEK', '...KGGKGGKGGKKKK', '....KGGKKGGK....', '....KGGK.KGGK...', '....KGGK.KGGK...', '....KGGK.KGGK...',
  '....KIIK.KIIK...', '...KKKKK.KKKKK..', '................', '................', '................', '................',
];
const legsB = (legs) => ({ 16: legs[0], 17: legs[1], 18: legs[2], 19: legs[3], 20: legs[4], 21: legs[5] });
const unit = (base, walk, aim, flash) => [
  base,
  swap(base, legsB(walk)),
  swap(base, aim),
  swap(base, { ...aim, ...flash }),
];
export const SOLDIER_FRAMES = unit(SOLDIER,
  ['.....KNNK.KNNK..', '......KNNKNNK...', '.......KNNNK....', '.......KNNNK....', '......KBBKBBK...', '.....KKKKKKKKK..'],
  { 12: '...KNNCNNNNNNKbb', 13: '...KsKNNNNNNbbbq', 14: '...KKKNNNNNKKKKK' }, { 12: '...KNNCNNNNNNKbb', 13: '...KsKNNNNbbbqFy', 14: '...KKKNNNNNKKKKO'.slice(0, 16) });
export const SECTOID_FRAMES = unit(SECTOID,
  ['....KNNKKNNK....', '.....KNNKNK.....', '......KNNK......', '......KNNK......', '.....KssKsK.....', '....KKKKKKKK....'],
  { 14: '..KsNNNNNNNNKEEE', 15: '...KKNNNNNK.EEEK', 16: '.....KNNNNK..KKK' }, { 14: '..KsNNNNNNNNKEEE', 15: '...KKNNNNNK.EEEF', 16: '.....KNNNNK..KKO' });
export const MUTON_FRAMES = unit(MUTON,
  ['....KGGK.KGGK...', '.....KGGKGGK....', '......KGGGK.....', '......KGGGK.....', '.....KIIKIIK....', '....KKKKKKKKK...'],
  { 11: '.KKKGGGGGGGGKEEE', 12: '...KGGGGGGGGKEEE' }, { 11: '.KKKGGGGGGGGKEEE', 12: '...KGGGGGGGGKEEF', 13: '...KGGKGGKGGKKKO' });
// corpses (lying down; canvas 16x24, drawn in the bottom rows)
const lay = (lines) => [...Array(24 - lines.length).fill('................'), ...lines];
export const SOLDIER_DEAD = lay([
  '..KKKK..........', '.KCCNNKKKKKKK...', 'KsNNNNNNNNNNNbK.', 'KKsKNNNNNKNNNKK.', '.KKKKBBBBBKKBBK.', '.....KKKKK.KKKK.',
]);
export const SECTOID_DEAD = lay([
  '..KKKK..........', '.KsssSKKKKKK....', 'KsKKssNNNNNNK...', 'KssSsNNNNNNNNK..', '.KKKKKKKKKKKKK..',
]);
export const MUTON_DEAD = lay([
  '..KKKK..........', '.KIIIKKKKKKKK...', 'KIKEIGGGGGGGGK..', 'KIIIIGGGGGGGGGK.', '.KKKKKKKKKKKKKK.',
]);

// ---- overlays (32x16 diamonds, translucent) and fx ---------------------------------------------------------------------
export const UI_PAL = { '.': null, y: '#ffe060', l: '#4a8aff66', r: '#ff3a2a77', k: '#00000055', K: '#14141c', w: '#ffffff', O: '#ff9a30', F: '#fff6b0', Y: '#ffe060', R: '#e03a2a', D: '#a0201a', g: '#8a96a2', E: '#d8f060', G: '#6ad040', P: '#c040e0', B: '#6aa0ff' };
export const CURSOR = diaGrid([
  'yyyy', 'yy.. ..yy', 'yy.. .... ..yy', 'y... .... .... ...y', 'y... .... .... .... ...y', 'yy.. .... .... .... .... ..yy',
  'yy.. .... .... .... .... .... ..yy', 'y... .... .... .... .... .... .... ...y',
  'y... .... .... .... .... .... .... ...y', 'yy.. .... .... .... .... .... ..yy', 'yy.. .... .... .... .... ..yy',
  'y... .... .... .... ...y', 'y... .... .... ...y', 'yy.. .... ..yy', 'yy.. ..yy', 'yyyy',
]);
const fill = (c) => diaGrid(['4', '8', '12', '16', '20', '24', '28', '32', '32', '28', '24', '20', '16', '12', '8', '4'].map((n) => c.repeat(+n)));
export const MOVE_TILE = fill('l');
export const HIT_TILE = fill('r');
const E16 = '................';
const f16 = (lines) => [...lines, ...Array(16 - lines.length).fill(E16)];
export const FX = {
  boom1: f16(['................', '................', '.......OO.......', '......OFFO......', '.....OFFFFO.....', '......OFFO......', '.......OO.......']),
  boom2: f16(['................', '.....O..O.......', '....OFFOFO......', '...OFFFFFFO.....', '..OFFYYYFFFO....', '...OFFYYYFFO....', '....OFFFFFO.....', '.....OO.OO......']),
  boom3: f16(['..O..OO..O......', '.OFO.OFFO.OO....', '..OFFFFFFFO.....', '.OFFYYYYYYFFO...', 'OFFYYRRRRYYFFO..', '.OFFYYRRYYFFO...', '..OFFYYYYFFO....', '.O.OFFFFFFO.O...', '....OO..OO......']),
  boom4: f16(['....D...D.......', '..D.D.D..D......', '...D.DD.DD.D....', '..D..RR.R..D....', '.D.DR..RR.D.....', '..D..DD..D..D...', '....D..D........']),
  spark: f16(['................', '......F.........', '.....FwF........', '....FwwwF.......', '.....FwF........', '......F.........']),
  plasma: f16(['................', '................', '.....GG.........', '....GEEG........', '....GEEG........', '.....GG.........']),
  bullet: f16(['................', '................', '.....YY.........', '.....YY.........']),
};
export const FX_NAMES = Object.keys(FX);

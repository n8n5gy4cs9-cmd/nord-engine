// X-KOM 2026 interception sequence art (top-down rail shooter). Hand-typed pixels. jet 24x24 (2 frames: exhaust long/short), saucer 24x16 (2 frames: lights),
// drone 12x12 (2 frames), shots 8x8 (laser, plasma A, plasma B, spark), cloud 32x16, sea 16x16 (scrolling background tile).
import { RLE, REP } from './rts.mjs';
export const PAL = { '.': null, K: '#14141c', a: '#34343e', b: '#5c5c78', c: '#8c94b0', d: '#c4cce0', e: '#f0f4ff', B: '#3a8aff', Y: '#ffe060', O: '#ff9a30', R: '#ff3a2a', r: '#a01c1c', g: '#58a04a', G: '#2f6a3a', E: '#d8f060', s: '#aab4c4', S: '#7a8494', P: '#9a4ab0', p: '#e080f0', w: '#ffffff', n: '#d8c890', N: '#b0a068', h: '#78c060', Z: '#1a1a2a', W: '#2a4a8c', V: '#3a64b0', v: '#6a94d8', x: '#e8f0ff', y: '#c0d0ee' };
const swap = (rows, o) => { const r = [...rows]; for (const [i, v] of Object.entries(o)) r[+i] = v; return r; };
const JET = [
  '...........KK...........', '...........KK...........', '..........KddK..........', '..........KdeK..........', '.........KcdedK.........', '.........KccddK.........',
  '.........KbBBcK.........', '........KKbBBBcKK.......'.slice(0, 24), '.......KcKbbbbcKcK......', '......KccKbbbbcKccK.....', '.....KccdKbbbbcKdccK....', '....KccddKbbbbcKddccK...',
  '...KccdddKbbbbcKdddccK..', '..KKcddddKaaaabKddddcKK.', '.KcKKddddKaaaabKddddKKcK', 'KccdKKddKKaaaabKKddKKdccK'.slice(0, 24), 'KccKKKKKKKaaaabKKKKKKKcK', 'KKK.....KKaaaabKK.....KK',
  '........KKaaaaKK........', '.........KKKKKK.........', '..........KOOK..........', '..........KYYK..........', '...........YY...........', '...........Y............',
];
const JET_PAD = JET.map((r) => r.padEnd(24, '.').slice(0, 24));
export const JET_FRAMES = [JET_PAD, swap(JET_PAD, { 20: '..........KOOK..........', 21: '...........OO...........', 22: '........................', 23: '........................' })];
const SAUCER = [
  '........................', '........KKKKKKKK........', '......KKssddddssKK......', '.....KsddeeeeeeddsK.....', '....KsdeewwweeeddsK.....'.slice(0, 24).padEnd(24, '.'),
  '..KKKssdddddddddssKKK...'.padEnd(24, '.'), '.KssSSSsssssssssSSSssK..'.slice(0, 24), 'KSSaaaSSSSSSSSSSaaaSSSK.'.slice(0, 24), '.KSaYaSaYaSaYaSaYaSaYaK.'.slice(0, 24), '..KKaaaKKaaaaaaKKaaaKK..',
  '....KKKaaaaaaaaaKKK.....', '......KKKKKKKKKKKK......', '........................', '........................', '........................', '........................',
].map((r) => r.padEnd(24, '.').slice(0, 24)).slice(0, 16);
export const SAUCER_FRAMES = [SAUCER, swap(SAUCER, { 8: '.KSaRaSaRaSaRaSaRaSaRaK.'.slice(0, 24) })];
const DRONE = ['....KKKK....', '..KKggggKK..', '.KgggGGgggK.', '.KggGRRGggK.', 'KgggGRRGgggK', 'KgggGGGGgggK', 'KggGgggGggGK', '.KgGKggKGgK.', '.KKK.KK.KKK.', '............', '............', '............'];
export const DRONE_FRAMES = [DRONE, swap(DRONE, { 7: '.KgGKggKGgK.', 8: '..KK.KK.KK..', 3: '.KggGEEGggK.', 4: 'KgggGEEGgggK' })];
export const SHOTS = [
  ['...BB...', '...ww...', '...BB...', '...BB...', '...BB...', '...BB...', '...ww...', '........'], // 0 player laser
  ['........', '..pPPp..', '.pEEEEp.', '.PEwwEP.', '.PEwwEP.', '.pEEEEp.', '..pPPp..', '........'], // 1 plasma A
  ['........', '..PppP..', '.PEEEEP.', '.pEwwEp.', '.pEwwEp.', '.PEEEEP.', '..PppP..', '........'], // 2 plasma B
  ['...Y....', '.Y.O.Y..', '..OYO...', 'YOYwYOY.', '..OYO...', '.Y.O.Y..', '...Y....', '........'], // 3 spark
];
export const CLOUD = ['................................', '..........xxxxx.................', '........xxxxxxxxxx.....xxx......', '.....xxxxxxxxxxxxxxx..xxxxxxx...', '...xxxxxxxxxxxxxxxxxxxxxxxxxxxx.', '..xxxxxxxxxxxxyxxxxxxxxxxxxxxxxx', '.xxxxxxxxxxxxyyxxxxxxxxxxxxxyxxx', '.xxxxxxxxyxxxyyyxxxxxxxxxyyxxxxx', '..xxxxxxyyyxxyyyyxxxxxxyyyxxxxx.', '...xxxxyyyyyyyyyyyxxxxyyyyyxxx..', '.....xxxyyyyyyyyyyxxxxyyyyxx....', '.......xxyyyyyyyyyyxxyyyyx......', '.........yyyyyyyyyyyyyy.........', '...........yyyyyyyyyy...........', '..............yyyy..............', '................................'];
export const SEA = ['WWWWWWWWWWWWWWWW', 'WWVVWWWWWWWWVVWW', 'WWWWWWWWWWWWWWWW', 'WWWWWWVVvWWWWWWW', 'WWWWWWWWWWWWWWWW', 'WVVvWWWWWWWWWWWW', 'WWWWWWWWWWVVWWWW', 'WWWWWWWWWWWWWWWW', 'WWWWWVVvWWWWWWWW', 'WWWWWWWWWWWWWWWW', 'WWVVWWWWWWWVVWWW', 'WWWWWWWWWWWWWWWW', 'WWWWWWWVVvWWWWWW', 'WWWWWWWWWWWWWWWW', 'WVVvWWWWWWWWWWVV', 'WWWWWWWWWWWWWWWW'];

// ---- Raptor / Star Fox extras -----------------------------------------------------------------------------------------
const E14 = '..............';
const DART = ['......KK......', '.....KRRK.....', '.....KrrK.....', '....KsRRsK....', '...KssrrssK...', '..KsSsRRsSsK..', '.KsSKsrrsKSsK.', 'KsSKK.ss.KKSsK', 'KSK...KK...KSK', 'K.K........K.K', E14, E14, E14, E14];
export const DART_FRAMES = [DART, swap(DART, { 8: 'KSK..KKKK..KSK', 9: 'K.K...KK...K.K'.slice(0, 14) })];
const TUR = ['................', '....KKKKKKKK....', '...KbbbbbbbbK...', '..KbccccccccbK..', '.KbcccddddcccbK.', '.KbccdeeeedccbK.', '.KbccdeRRedccbK.', '.KbccdeRRedccbK.', '.KbccdeeeedccbK.', '.KbcccddddcccbK.', '..KbccccccccbK..', '...KbbbbbbbbK...', '....KKKKKKKK....', '................', '................', '................'];
export const TURRET_FRAMES = [TUR, swap(TUR, { 6: '.KbccdeYYedccbK.', 7: '.KbccdeYYedccbK.' })];
const PU_P = ['..KKKKKKKK..', '.KBBBBBBBBK.', 'KBBwwwwwBBBK', 'KBBwBBBwBBBK', 'KBBwBBBwBBBK', 'KBBwwwwwBBBK', 'KBBwBBBBBBBK', 'KBBwBBBBBBBK', 'KBBBBBBBBBBK', '.KBBBBBBBBK.', '..KKKKKKKK..', '............'];
const PU_M = ['..KKKKKKKK..', '.KOOOOOOOOK.', 'KOOwOOOOwOOK', 'KOOwwOOwwOOK', 'KOOwOwwOwOOK', 'KOOwOOOOwOOK', 'KOOwOOOOwOOK', 'KOOOOOOOOOOK', 'KOOOOOOOOOOK', '.KOOOOOOOOK.', '..KKKKKKKK..', '............'];
const PU_S = ['..KKKKKKKK..', '.KggggggggK.', 'KgggwwwwgggK', 'KggwggggggK'.padEnd(12, 'g').slice(0, 11) + 'K', 'KggwwwwwgggK', 'KgggggggwggK', 'KggwwwwwgggK', 'KgggggggggggK'.slice(0, 12), 'KggggggggggK', '.KggggggggK.', '..KKKKKKKK..', '............'];
export const PICKUP_FRAMES = [PU_P, PU_M, PU_S];
export const ISLAND = RLE(48,
  '.18 n10', '.14 n4 g12 n6', '.11 n3 g20 n4', '.9 n2 g8 G3 g12 h2 n3', '.8 n2 g5 G4 G2 g10 h3 g2 N2', '.7 N2 g6 G4 G2 g8 h4 g4 n3',
  '.6 n2 g16 G2 g10 h3 g4 N2', '.5 N2 g7 h3 g10 G3 G2 g8 n3', '.5 n2 g20 h2 g14 N2', '.5 N2 g6 G3 g8 h3 g10 G2 g4 n2', '.6 n2 g10 G4 g12 h2 g6 N2',
  '.7 N2 g8 g8 G2 g8 g6 n3', '.9 n2 g6 h4 g10 g6 N2', '.10 N3 g14 g6 n3', '.12 n4 g16 N3', '.15 N4 n8 N3', '.18 N10');

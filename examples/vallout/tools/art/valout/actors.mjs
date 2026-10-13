// Actors: hand-typed parts (heads/torsos/legs/gun/kick/dead) composed into 24x32 frames, recoloured per character.
// Frame order per row: front [stand, walkA, walkB, shoot, kick] · back [stand, walkA, walkB, shoot, kick] · dead   (flip horizontally in game for E/W)
export const FRAMES = ['stand_f', 'walkA_f', 'walkB_f', 'shoot_f', 'kick_f', 'stand_b', 'walkA_b', 'walkB_b', 'shoot_b', 'kick_b', 'dead'];
const HEAD_F = ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhho', 'ohssssssho', 'ossessesso', 'osssssssso', '.osssmsso.', '..ossssso.', '...oooo...'];
const HEAD_B = ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhho', 'ohhhhhhhho', 'ohhhHhhhho', 'ohhhhhhhho', '.ohhhhhho.', '..ossssso.', '...oooo...'];
const TORSO_F = ['.oojjjjjjoo.', 'ojjjjkkjjjjo', 'ojJjjkkjjJjo', 'ojJjjjjjjJjo', 'osJjjjjjjJso', '.oJjjjjjjJo.', '..oJjjjjJo..', '..oxxxxxxo..', '..oppppppo..'];
const TORSO_B = ['.oojjjjjjoo.', 'ojjjjjjjjjjo', 'ojJjjjjjjJjo', 'ojJjjkkjjJjo', 'osJjjkkjjJso', '.oJjjjjjjJo.', '..oJjjjjJo..', '..oxxxxxxo..', '..oppppppo..'];
const LEG = ['oppo', 'opPo', 'opPo', 'opPo', 'opPo', 'opPo', 'opPo', 'obbo', 'bbbo', '.oo.'];
const GUN_F = ['.oooooo.', 'osGGgggo', '.oGGoooo', '..oo....'];
const GUN_B = ['.oooooo.', 'ogggGGso', 'oooGGo..', '....oo..'];
const KICK = ['.oppppbbo', 'opPPppbbo', '.oooooooo'];
const DEAD = ['.oooo.....oooooooo......', 'ohhhhooojjkkjjjjjjoo....', 'ohssesojjjjjjjjjjjpppbbo', '.ossso.oJJjjjjJJjpppbbo.', '..ooo...ooooooooooooooo.'];
const BEANIE = ['.rrrrrrrr.', 'rrrRrrRrrr', 'rRRRRRRRRr'];
const SHADES = ['oooooooooo'];
const HELMET = ['..oooooo..', '.oHHHHHHo.', 'oHHHHHHHHo', 'oooooooooo'];
const MASK = ['.oMMMMo.', 'oMeMMeMo', '.oMooMo.', '..oMMo..'];
const BOTTLE = ['.o.', 'oGo', 'oGo', 'oyo', 'oyo', 'oyo', 'ooo'];
const BLOB_A = ['.....oooooo.....', '...ooggggggoo...', '..oggggggggggo..', '.ogggwwggwwgggo.', '.ogggeegggeeggo.', 'ogggggggggggggGo', 'ogggGggggggGgggo', 'ogggggmmmmggggGo', '.oggggggggggggo.', '..ooGGggggGGoo..', '....oooooooo....'];
const GULL_A = ['oo................oo', 'owo..............owo', 'owwo....oooo....owwo', '.owwo..oRwRwo..owwo.', '..owwoowwwwwwoowwo..', '...owwwwwwwwwwwwo...', '....oowwwwwwwwoo....', '......oowwwwoo......', '.......oooooo.......'];
const GULL_B = ['....................', '.........oooo.......', '.......oRwRwo.......', '..ooooowwwwwwooooo..', '.owwwwwwwwwwwwwwwwo.', 'owwwwwwowwwwowwwwwwo', 'owwo.oowwwwwwoo.owwo', 'oo....oowwwwoo....oo', '.......oooooo.......'];
const SMALL_DEAD = ['..oooooooo..', '.ogggggggGoo', 'ogwggggggggo', '.oooooooooo.'];

const BASE = { o: '#1a1410', s: '#e3b48a', S: '#b98258', h: '#4a3220', H: '#2e1e12', j: '#555555', J: '#333333', k: '#777777', p: '#444444', P: '#333333', b: '#222222', x: '#222222', w: '#f0f0f0', e: '#101010', m: '#8a3b2b', g: '#707078', G: '#40404a', y: '#c89a3a', r: '#c0342c', R: '#8e2020', M: '#6b7068', l: '#101010' };
export const CHARS = {
  tero: { s: '#e3b48a', h: '#c9a04a', H: '#9c7a30', j: '#3d6a9e', J: '#2c4d78', k: '#5a8cc4', p: '#3a3a44', P: '#2a2a32', b: '#e8e8e8', x: '#7a5a2c', acc: ['beanie'] },
  pena: { s: '#d89a7a', h: '#5a4a3a', H: '#3a2e22', j: '#6b5a3a', J: '#4e4128', k: '#85734a', p: '#4a4f3a', P: '#363a2a', b: '#2a2218', x: '#2a2218', acc: ['bottle'] },
  kalle: { s: '#d8a888', h: '#8a8a8a', H: '#666666', j: '#7a7a82', J: '#5a5a62', k: '#9a9aa2', p: '#6a4a2c', P: '#4a321c', b: '#2a2218', x: '#3a2a18', acc: ['bottle'] },
  saku: { s: '#e0b090', h: '#2a1a10', H: '#150c06', j: '#262626', J: '#151515', k: '#464646', p: '#2a4aa0', P: '#f0f0f0', b: '#f0f0f0', x: '#151515' },
  mottonen: { s: '#e0b090', h: '#d8c070', H: '#a89040', j: '#5a3a22', J: '#3e2814', k: '#7a5232', p: '#a02a2a', P: '#f0f0f0', b: '#f0f0f0', x: '#3e2814' },
  rane: { s: '#e0b090', h: '#101010', H: '#000000', j: '#1c1c1e', J: '#0c0c0e', k: '#4a4a52', p: '#2a3050', P: '#1c2038', b: '#111111', x: '#8a8a90', acc: ['shades'] },
  soldier: { s: '#d8a888', h: '#3a2a1a', j: '#4a5a3a', J: '#34422a', k: '#62754c', p: '#3e4a30', P: '#2e3824', b: '#1c1c18', x: '#2a2a20', H: '#4a5a3a', M: '#6b7068', acc: ['helmet', 'mask'] },
  ranger: { s: '#d8a888', h: '#3a2a1a', H: '#2a5aa8', j: '#2a4a8a', J: '#1c3260', k: '#4a72b8', p: '#3a3a40', P: '#e0b830', b: '#1c1c18', x: '#e0b830', M: '#6b7068', acc: ['helmet'] },
  harmaa: { g: '#9eb8a6', G: '#7a9684', s: '#9eb8a6', S: '#7a9684', h: '#9eb8a6', j: '#6a8a78', J: '#52705f', k: '#86a692', p: '#6a8a78', P: '#52705f', b: '#3a4a42', x: '#2a3a32', alien: 1, gunc: '#7be07b' },
  komentaja: { g: '#b49ccc', G: '#8a74a6', s: '#b49ccc', S: '#8a74a6', h: '#b49ccc', j: '#6a4a8a', J: '#4a3266', k: '#8a6aaa', p: '#6a4a8a', P: '#4a3266', b: '#2a1e3a', x: '#e0408a', alien: 1, gunc: '#ff5fa0' },
  blob: { g: '#c8782a', G: '#a05a1a', w: '#f4efe0', e: '#201008', m: '#6a1a1a', blob: 1 },
  gull: { w: '#d8d8e0', R: '#d02020', gull: 1 },
};
const alienHead = (px, back) => back
  ? ['...oooooo...', '..oggggggo..', '.oggggggggo.', 'ogggggggggGo', 'ogggggggggGo', 'ogggggggggGo', 'oggggggggGGo', '.ogggggggGo.', '..ogggggGo..', '...oggggo...', '....oooo....']
  : ['...oooooo...', '..oggggggo..', '.oggggggggo.', 'ogggggggggGo', 'ogkkkgggkkko', 'ogkekggkekgo', 'oggkkgggkkgo', '.ogggggggGo.', '..oggGGggo..', '...oggggo...', '....oooo....'];

export function actors(px) {
  const G = (rows, pal, n) => px.grid(rows, pal, n, { pad: true });
  const cell = () => px.blank(24, 32);
  const rows = [], names = [];
  const human = (name, c) => {
    const pal = { ...BASE, ...c, o: c.o ?? BASE.o }, g = (r, n) => G(r, pal, `${name}:${n}`);
    const head = c.alien ? [g(alienHead(px, false), 'head_f'), g(alienHead(px, true), 'head_b'), 6, 1] : [g(HEAD_F, 'head_f'), g(HEAD_B, 'head_b'), 7, 3];
    const gunPal = { ...pal, g: c.gunc ?? pal.g };
    const torsoF = g(TORSO_F, 'torso_f'), torsoB = g(TORSO_B, 'torso_b'), leg = g(LEG, 'leg'), kick = g(KICK, 'kick');
    const gunF = G(GUN_F, gunPal, 'gun_f'), gunB = G(GUN_B, gunPal, 'gun_b');
    const accs = (c.acc ?? []).map((a) => ({ beanie: [g(BEANIE, 'beanie'), 7, 1, 'both'], shades: [g(SHADES, 'shades'), 7, 7, 'f'], helmet: [g(HELMET, 'helmet'), 7, 1, 'both'], mask: [g(MASK, 'mask'), 8, 8, 'f'], bottle: [g(BOTTLE, 'bottle'), 3, 15, 'f'] }[a]));
    const frame = (back, pose) => {
      const bob = pose === 'walkA' || pose === 'walkB' ? 1 : 0, L = [];
      L.push([back ? head[1] : head[0], head[2] - 0, head[3] - bob], [back ? torsoB : torsoF, 6, 12 - bob]);
      const lift = (x, y) => [leg, x, y];
      if (pose === 'kick') L.unshift([leg, 8, 21], [kick, 11, 22]);
      else if (pose === 'walkA') L.unshift(lift(8, 21), lift(13, 19));
      else if (pose === 'walkB') L.unshift(lift(13, 21), lift(8, 19));
      else L.unshift(lift(8, 21), lift(12, 21));
      for (const [img, x, y, side] of accs) if (side === 'both' || (side === 'f') === !back) L.push([img, x, y - bob]);
      if (pose === 'shoot') L.push(back ? [gunB, 2, 14] : [gunF, 15, 14]);
      return px.compose(24, 32, L);
    };
    const dead = px.compose(24, 32, [[G(DEAD, pal, `${name}:dead`), 0, 27]]);
    const fr = [];
    for (const back of [false, true]) for (const pose of ['stand', 'walkA', 'walkB', 'shoot', 'kick']) fr.push(frame(back, pose));
    fr.push(dead);
    return fr;
  };
  const blob = (c) => {
    const pal = { ...BASE, ...c }, a = G(BLOB_A, pal, 'blob'), b = G([...BLOB_A.slice(0, 5), BLOB_A[5], ...BLOB_A.slice(5)], pal, 'blob2');
    const fa = px.compose(24, 32, [[a, 4, 19]]), fb = px.compose(24, 32, [[b, 4, 18]]), fd = px.compose(24, 32, [[G(SMALL_DEAD, pal, 'blobd'), 6, 26]]);
    return [fa, fb, fa, fb, fb, fa, fb, fa, fb, fb, fd];
  };
  const gull = (c) => {
    const pal = { ...BASE, ...c }, a = G(GULL_A, pal, 'gullA'), b = G(GULL_B, pal, 'gullB');
    const fa = px.compose(24, 32, [[a, 2, 12]]), fb = px.compose(24, 32, [[b, 2, 12]]), fd = px.compose(24, 32, [[G(SMALL_DEAD, { ...pal, g: '#d8d8e0' }, 'gulld'), 6, 26]]);
    return [fa, fb, fa, fb, fb, fa, fb, fa, fb, fb, fd];
  };
  for (const [name, c] of Object.entries(CHARS)) { names.push(name); rows.push(...(c.blob ? blob(c) : c.gull ? gull(c) : human(name, c))); }
  const sheet = px.sheet(rows, FRAMES.length);
  // boss: komentaja ×2 with horns, purple/magenta
  const bossBase = human('boss', { ...CHARS.komentaja, g: '#c0a4e0', G: '#8a5ab0', x: '#ff3a8a', gunc: '#ff3a8a' });
  const boss = bossBase.map((f) => px.scaleUp(f, 2));
  return { sheet, names, boss: px.sheet(boss, FRAMES.length) };
}

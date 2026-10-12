// RetroPaxDungeons — sewer tileset, 16x16, hand-drawn. One char = one pixel. Frame index = tile id (see tiles.json meta).
export const PAL = {
  '.': null,
  K: '#0d0a14', // outline / void
  e: '#1a1722', a: '#26222f', b: '#322d3f', c: '#3f3950', d: '#524b68', // stone ramp (e darkest … d highlight)
  m: '#1c3326', n: '#2c5236', o: '#437a45', p: '#6aa65a', // moss ramp
  u: '#13304f', v: '#1f4f7d', w: '#3b7fae', x: '#7dbbd8', y: '#c4e6ef', // water ramp
  r: '#3a2314', s: '#5b3820', t: '#80532f', z: '#a67a45', // wood ramp
  i: '#6a7080', j: '#9aa1b3', k: '#cdd3e0', // iron
  g: '#e6c34a', h: '#a8852a', // gold
  f: '#ff9a3c', F: '#ffd35e', R: '#c9441e', // fire
  B: '#d8d2bd', C: '#a39c86', D: '#6e685a', // bone
};

// ---- floors (3 variants) -------------------------------------------------------------------------------------------------
export const floor1 = `
aaaaaaaaaaaaaaaa
acccccccaccccccc
acbbbbbbacbbbbbb
acbbbabbacbbbbbb
acbbbbbbacbbbbab
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
aaaaaaaaaaaaaaaa
ccccaccccccccacc
bbbbacbbbbbbbacb
bbbbacbbbbabbacb
bbbbacbbbbbbbacb
bbabacbbbbbbbacb
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
`;
export const floor2 = `
aaaaaaaaaaaaaaaa
acccccccaccccccc
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbabbb
acbbabbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
aaaaaaaaaaaaaaaa
ccccaccccccccacc
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
bbbbacbbbabbbacb
bbbbacbbbbbbbacb
bbbbacbabbbbbacb
bbbbacbbbbbbbacb
`;
// cracked
export const floor3 = `
aaaaaaaaaaaaaaaa
acccccccaccccccc
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbaaaaabbbbb
acbbbbbbbbaaabbb
acbbbbbbbbbbaabb
acbbbbbbacbbbbab
aaaaaaaaaaaaaaaa
ccccaccccccccacc
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
bbbaaabbbbbbbacb
bbbbbaabbbbbbacb
bbbbbbabbbbbbacb
bbbbacbbbbbbbacb
`;
// floor with a scatter of bones (decor)
export const floorBones = `
aaaaaaaaaaaaaaaa
acccccccaccccccc
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
aaaaaaaaaaaaaaaa
ccccaccccccccacc
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
bbDBBbbbbbbbbacb
bbBCDBbbbbDBbacb
bbbDBCBBBbBCBacb
bbbbacbDDDbbDacb
`;

// ---- walls -----------------------------------------------------------------------------------------------------------------
// wall FACE (south side visible): brick courses with a dark cap line on top
export const wallFace = `
eeeeeeeeeeeeeeee
dcccccccdcccccdc
cbbbbbbbcbbbbbbb
cbbbbbabcbbbbbbb
cbbbbbbbcbbbbabb
aaaaaaaaaaaaaaaa
ccdccccccccdcccc
bbcbbbbbbbbcbbbb
bbcbbbabbbbcbbbb
bbcbbbbbbbbcbbbb
aaaaaaaaaaaaaaaa
dcccccccdcccccdc
cbbbbbbbcbbbbbbb
cbbbbbbbcbbabbbb
cbbbbbbbcbbbbbbb
eeeeeeeeeeeeeeee
`;
export const wallMoss = `
eeeeeeeeeeeeeeee
dcccccccdcccccdc
cbbbbbbbcbbbbbbb
cbbbbbabcbbbbbbb
cbbbbbbbcbbbbabb
aaaaaaaaaaaaaaaa
ccdccccccccdcccc
bbcbbbbbbbbcbbbb
bbcbbbabbbbcbbbb
bbcbbbbbbbbcbbbb
aaaaaaaaaaaaaaaa
dcccccccdcccccdc
cbbbbbbbcbbbbbbb
cbbbbbbbcbbabbbb
cbbbbbbbcbbbbbbb
eeeeeeeeeeeeeeee
`.replace(/^/, '').split('\n').map((l, y) => {
  // moss creeping from the cap line is drawn by hand below via overrides
  const moss = { 1: '..nn....oo......', 2: '..mo....nm......', 3: '...m.......n....', 11: '.......nn.......', 12: '.......om.......', 13: '........m.......' }[y - 1];
  return moss ? l.split('').map((ch, i) => (moss[i] === '.' ? ch : moss[i])).join('') : l;
}).join('\n');
// wall TOP / solid interior (seen from above or between rooms)
export const wallTop = `
eeeeeeeeeeeeeeee
eeeeeaeeeeeeeeee
eeeeeeeeeeeaeeee
eaeeeeeeeeeeeeee
eeeeeeeeaeeeeeee
eeeeeeeeeeeeeaee
eeeaeeeeeeeeeeee
eeeeeeeeeaeeeeee
eeeeeeeeeeeeeeea
eaeeeeeeeeeeeeee
eeeeeeaeeeeeeeee
eeeeeeeeeeeaeeee
eeeaeeeeeeeeeeee
eeeeeeeeeeeeaeee
eeeeeaeeeeeeeeee
eeeeeeeeeeeeeeee
`;
// wall face with a burning torch
export const wallTorch = `
eeeeeeeeeeeeeeee
dcccccccdcccccdc
cbbbbbbbcbbbbbbb
cbbbbbFbcbbbbbbb
cbbbbfFfcbbbbbbb
aaaaaRfFRaaaaaaa
ccdcccRfRccdcccc
bbcbbbbssbbcbbbb
bbcbbbbtsbbcbbbb
bbcbbbbtsbbcbbbb
aaaaaaaasaaaaaaa
dcccccccdcccccdc
cbbbbbbbcbbbbbbb
cbbbbbbbcbbabbbb
cbbbbbbbcbbbbbbb
eeeeeeeeeeeeeeee
`;

// ---- doors & stairs --------------------------------------------------------------------------------------------------------
export const doorClosed = `
KKKKKKKKKKKKKKKK
KsssssssttttsssK
KsrrrrrrrrrrrrsK
KstzzzzzzzzzztsK
KstzzzzzzzzzztsK
KsrrrrrrrrrrrrsK
KjjjjjjjjjjjjjjK
KstzzzzzzzzzztsK
KstzzzzzzzzzggsK
KsrrrrrrrrrrghsK
KstzzzzzzzzzztsK
KjjjjjjjjjjjjjjK
KsrrrrrrrrrrrrsK
KstzzzzzzzzzztsK
KstzzzzzzzzzztsK
KKKKKKKKKKKKKKKK
`;
export const doorOpen = `
aaaaaaaaaaaaaaaa
acbbbbbbbbbbbbba
acbbbbbbbbbbbbba
acbbbbbbbbbbbbba
Kbbbbbbbbbbbbbba
Kbbbbbbbbbbbbbba
KKbbbbbbbbbbbbba
KsKbbbbbbbbbbbba
KsKbbbbbbbbbbbba
KtKbbbbbbbbbbbba
KtKbbbbbbbbbbbba
KsKbbbbbbbbbbbba
KsKKbbbbbbbbbbba
KtKbbbbbbbbbbbba
KtKbbbbbbbbbbbba
KKKbbbbbbbbbbbba
`;
export const stairsDown = `
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KeccccccccccccdK
KecbbbbbbbbbbcdK
KecbaaaaaaaabcdK
KecbaKKKKKKabcdK
KecbaKeeeeKabcdK
KecbaKeaaeKabcdK
KecbaKKKKKKabcdK
KecbaKeeeeKabcdK
KecbaKeaaeKabcdK
KecbaKKKKKKabcdK
KecbaaaaaaaabcdK
KecbbbbbbbbbbcdK
KeddddddddddddeK
KKKKKKKKKKKKKKKK
`;
export const stairsUp = `
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KedddddddddddddK
KedcccccccccccdK
KedcbbbbbbbbbcdK
KedcbddddddddcdK
KedcbaccccccacdK
KedcbaddddddacdK
KedcbaccccccacdK
KedcbaddddddacdK
KedcbaccccccacdK
KedcbbbbbbbbbcdK
KedccccccccccddK
KeeeeeeeeeeeeeeK
KaaaaaaaaaaaaaaK
KKKKKKKKKKKKKKKK
`;

// ---- water, grass ----------------------------------------------------------------------------------------------------------
export const water1 = `
vvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvv
vvwwwvvvvvvvvwww
vwxxxwvvvvvvwxxw
vvwwwvvvvvvvvwww
vvvvvvvvvvvvvvvv
uuvvvvvvvvvvvvvv
vvvvvvvvvvwwwvvv
vvvvwwwvvwxxxwvv
vvvwxxxwvvwwwvvv
vvvvwwwvvvvvvvvv
vvvvvvvvvvvvvvuu
vvvvvvvvvvvvvvvv
wwvvvvvvvvvvvvvv
xxwvvvvvvvvvwwvv
vvvvvvvvvvvwxxwv
`;
export const water2 = `
vvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvv
vvvwwwvvvvvvvwww
vvwxxxwvvvvvwxxw
vvvwwwvvvvvvvwww
vvvvvvvvvvvvvvvv
vvuuvvvvvvvvvvvv
vvvvvvvvvvvwwwvv
vvvvvwwwvvwxxxwv
vvvvwxxxwvvwwwvv
vvvvvwwwvvvvvvvv
vvvvvvvvvvvvvvuu
vvvvvvvvvvvvvvvv
vwwvvvvvvvvvvvvv
vxxwvvvvvvvvwwvv
vvvvvvvvvvvwxxwv
`;
// grass over the floor stones
export const grass = `
aaaaaaaaaaaaaaaa
acccccccaccccccc
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
acbbbbbbacbbbbbb
aaaaaaaaaaaaaaaa
ccccaccccccccacc
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
bbbbacbbbbbbbacb
`.split('\n').map((l, y) => {
  const g = {
    4: '.n..............', 5: '.on...n.....n...', 6: 'nop..no..n..on..', 7: 'opp.nop.on.nop..',
    9: '..........n.....', 10: '.n.....n..on..n.', 11: 'nop...non.opn.on', 12: 'opn.n.opp.nn.opp', 13: '.n..on.pn...o.pn', 14: '....opn.........', 15: '......n.........',
  }[y - 1];
  return g ? l.split('').map((ch, i) => (g[i] === '.' ? ch : g[i])).join('') : l;
}).join('\n');

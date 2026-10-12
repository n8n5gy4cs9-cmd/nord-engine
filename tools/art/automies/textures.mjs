// Automies — hand-pixelled textures (one character = one pixel). 16x16 tiles are shown with nearest-neighbour filtering at 4 m per repeat
// (PSX-style chunky), the 32x32 ones are for water. Keep them seamless when you replace them.
export const PAL = {
  '.': null,
  // concrete / stone
  a: '#6a6c76', b: '#82848e', c: '#9a9ca6', d: '#b2b4be', e: '#cfd1d9',
  // glass / windows
  k: '#1c2236', w: '#2c4468', v: '#4e7cae', x: '#8cc0e8', y: '#f2d27a', Y: '#c9a24a',
  // brick
  r: '#5a2a24', s: '#7a3a30', t: '#9a4c3c', u: '#b8654e', m: '#d9d2c0',
  // sandstone / balcony
  n: '#b79b6a', o: '#d3b886', p: '#ead3a0', q: '#8a7248', h: '#3c3a46',
  // roof gravel / tar
  g: '#3c3e46', i: '#4a4c56', j: '#5a5c68', l: '#7a7c88',
  // water
  A: '#1f4f8c', B: '#2a68a8', C: '#3a84c4', D: '#78b8e4', E: '#d4ecfa',
  // pavers / road
  F: '#8c8a84', G: '#a8a69e', H: '#6e6c66', I: '#c4c2b8', J: '#34363e', L: '#4c4e58', M: '#e8e0c0', N: '#f2c040',
  // metal / container
  P: '#7a8a98', Q: '#9aaab8', R: '#5a6a78', S: '#c04a34', T: '#2f6ab0', U: '#3f9a58', V: '#d8a830', W: '#e8e8ec', X: '#2a2a32', Z: '#44a0d8', z: '#e04838',
};
export const TEX = {
  facadeA: `
cccccccccccccccc
cddddddccddddddc
cdwwwwdccdwwwwdc
cdwxxwdccdwvvwdc
cdwxvwdccdwvvwdc
cdwvvwdccdwvvwdc
cdwwwwdccdwwwwdc
cbbbbbbccbbbbbbc
cccccccccccccccc
cddddddccddddddc
cdwwwwdccdwwwwdc
cdwvvwdccdwxxwdc
cdwvvwdccdwxvwdc
cdwvvwdccdwvvwdc
cdwwwwdccdwwwwdc
cbbbbbbccbbbbbbc`,
  facadeB: `
ttttttttttttttts
sssssssssssssssr
ttttttttttttttts
tkkkktttkkkkttts
tkyykttkkwwkttts
tkyykttkkwwkttts
tkkkkttkkkkkttts
tmmmmtttmmmmttts
ttttttttttttttts
sssssssssssssssr
ttttttttttttttts
tkkkktttkkkkttts
tkwwkttkkyykttts
tkwwkttkkyykttts
tkkkkttkkkkkttts
tmmmmtttmmmmttts`,
  facadeC: `
zzzzzzzzzzzzzzzz
vwwwwwwwvwwwwwww
vwxxxwwwvwxxxwww
vwxvvwwwvwxvvwww
vwvvvwwwvwvvvwww
vwwwwwwwvwwwwwww
vwwwwwwwvwwwwwww
PPPPPPPPPPPPPPPP
vwwwwwwwvwwwwwww
vwwxxxwwvwwxxxww
vwwxvvwwvwwxvvww
vwwvvvwwvwwvvvww
vwwwwwwwvwwwwwww
vwwwwwwwvwwwwwww
vwwwwwwwvwwwwwww
PPPPPPPPPPPPPPPP`,
  facadeD: `
oooooooooooooooo
pppppppppppppppp
ooooooooooooooon
okkkkooookkkkoon
okyykooookwwkoon
okyykooookwwkoon
okkkkooookkkkoon
ohhhhhooohhhhhon
qqqqqqqqqqqqqqqn
oooooooooooooooo
ooooooooooooooon
okkkkooookkkkoon
okwwkooookyykoon
okwwkooookyykoon
okkkkooookkkkoon
ohhhhhooohhhhhon`,
  roof: `
iiiiiiiiiiiiiiii
ijiiiiijiiiiiiji
iiiijiiiiiijiiii
iijiiiiiiiiiiiii
iiiiiijiiijiiiji
ijiiiiiiiiiiiiii
iiiijiiiiiiijiii
iiiiiiiiiijiiiii
iiijiiiiiiiiiijj
iiiiiiijiiiiiiii
ijiiiiiiiijiiiii
iiiiijiiiiiiiiji
iiiiiiiiijiiiiii
ijiiiiijiiiiijii
iiiiiiiiiiiiiiii
iiijiiiiiiiiiiii`,
  pavement: `
FFFFFFFFHFFFFFFF
FGGGGGGFHGGGGGGF
FGGGGGGFHGGGGGGF
FGGGGGGFHGGGGGGF
FGGGGGGFHGGGGGGF
FGGGGGGFHGGGGGGF
FGGGGGGFHGGGGGGF
HHHHHHHHHHHHHHHH
FFFFHFFFFFFFFHFF
FGGGHGGGGGGFGHGF
FGGGHGGGGGGFGHGF
FGGGHGGGGGGFGHGF
FGGGHGGGGGGFGHGF
FGGGHGGGGGGFGHGF
FGGGHGGGGGGFGHGF
HHHHHHHHHHHHHHHH`,
  concrete: `
bbbbbbbbbbbbbbbb
bbbcbbbbbbbbabbb
bbbbbbbbbbbbbbbb
bcbbbbbbbabbbbbb
bbbbbbcbbbbbbbbc
bbbbbbbbbbbbbbbb
babbbbbbbbbcbbbb
bbbbbbbbbbbbbbbb
bbbbcbbbbbbbbbbb
bbbbbbbbbbbabbbb
bbbbbbbbbbbbbbbb
bbcbbbbabbbbbbbb
bbbbbbbbbbbbcbbb
bbbbbbbbbbbbbbbb
bbbbabbbbcbbbbbb
bbbbbbbbbbbbbbbb`,
  metal: `
PQPQPQPQPQPQPQPQ
PQPQPQPQPQPQPQPQ
QRQRQRQRQRQRQRQR
PQPQPQPQPQPQPQPQ
PQPQPQPQPQPQPQPQ
QRQRQRQRQRQRQRQR
PQPQPQPQPQPQPQPQ
PQPQPQPQPQPQPQPQ
QRQRQRQRQRQRQRQR
PQPQPQPQPQPQPQPQ
PQPQPQPQPQPQPQPQ
QRQRQRQRQRQRQRQR
PQPQPQPQPQPQPQPQ
PQPQPQPQPQPQPQPQ
QRQRQRQRQRQRQRQR
PQPQPQPQPQPQPQPQ`,
  marble: `
eeeeeeeeeeeeeeee
eeeedeeeeeeeeeee
eeeeedeeeeedeeee
eeeeeeddeeeeeeee
eeedeeeeeeeeeede
eeeeeeeeeeeeeeee
eeeeeeedeeeeeeee
eeeedeeeeeeeeeee
dddddddddddddddd
eeeeeeeeeeeeeeee
eeeeeedeeeeeedee
eeeeeeeeeeeeeeee
eeedeeeeedeeeeee
eeeeeeeeeeeeeeee
eeeeeeeeeeeeeeee
dddddddddddddddd`,
  container: `
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr
SSSSSSSSSSSSSSSS
SrSrSrSrSrSrSrSr`,
  water: `
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBCCCBBBBBBBBBBBBBBBBB
BBBBBBBBBBBCCDDCBBBBBBBBBBBBBBBB
BBBBBBBBBBBBCCCCBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BAABBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBAAABBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBCCCBBBBBB
BBBBBBBBBBBBBBBBBBBBBBCCDDCBBBBB
BBBBBBBBBBBBBBBBBBBBBBBCCCCBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBAABBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBAAABBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBCCCBBBBBBBBBBBBBBBBBBBBBBBBBB
BBCCDDCBBBBBBBBBBBBBBBBBBBBBBBBB
BBBCCCCBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAA
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBCCCBBBBBBBBBBBBBBBBBBBB
BBBBBBBBCCDDCBBBBBBBBBBBBBBBBBBB
BBBBBBBBBCCCCBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
BBBBBBAAABBBBBBBBBBBBBBBBBBBBBBB
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`,
};
export const TEX_NAMES = Object.keys(TEX);

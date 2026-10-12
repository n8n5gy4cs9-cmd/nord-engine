// Noom — HUD pieces: status-bar plate, inset boxes, face (7 states), big red digits, crosshair.
export const PAL = { '.': null, K: '#0a080c', a: '#46465a', b: '#383848', c: '#2b2b3a', d: '#1d1d28', e: '#585872', g: '#e8c44a', G: '#a8841c', k: '#131119', m: '#6a6a86', r: '#e0382c', R: '#9a1e18', y: '#ff9a6a', n: '#4a2a1a' };
export const plate = `
eaaaaaaaaaaaaaaK
abbbbbbbbbbbbbbK
abbbmbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbbmbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbmbbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbbbbbcK
abbbbbbbbbmbbbcK
KcccccccccccccKK
`;
// a bevelled inset box, 54 x 26
export const box = `
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
KcccccccccccccccccccccccccccccccccccccccccccccccccccK
KcdddddddddddddddddddddddddddddddddddddddddddddddddeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdeK
KcdddddddddddddddddddddddddddddddddddddddddddddddddeK
KceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
`;
// face frame (gold bevel) 32 x 30
export const faceFrame = `
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
KggggggggggggggggggggggggggggggK
KgGGGGGGGGGGGGGGGGGGGGGGGGGGGGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGkkkkkkkkkkkkkkkkkkkkkkkkkkGgK
KgGGGGGGGGGGGGGGGGGGGGGGGGGGGGgK
KGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGK
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
`;
// ---- the hero's face (24x26), 3 hand-drawn bases + damage overlays -----------------------------------------------------------------------------
export const FACE = { '.': null, K: '#0a080c', s: '#e8b48a', S: '#c28a62', z: '#9a6a48', h: '#4a3020', H: '#6a4a30', w: '#f4f4f4', e: '#2a5a9a', r: '#b02020', R: '#701010', t: '#d89a78', d: '#503020', b: '#7a4a2a', g: '#8a8a9a', G: '#5a5a6a' };
export const faceOk = `
......KKKKKKKKKKKK......
....KKHHHHHHHHHHHHKK....
...KHHhhhHHhhHHhhhHHK...
..KHhhhhhhhhhhhhhhhhHK..
..KhhsssssssssssssshhK..
..KhssssssssssssssssSK..
..KsssKKKKssssKKKKsssK..
..KssKwweKssssKewwKssK..
..KssKwKeKssssKeKwKssK..
..KsssKKKKssssKKKKsssK..
..KsssssssSSSSssssssSK..
..KssssssSssssSssssSSK..
..KssssssssSSssssssSSK..
..KsstsssssKKsssssStSK..
..KstSsssSKRRKSsssSStK..
..KssSsbbbbbbbbbbbbSSK..
..KsSbbbbbbbbbbbbbbbSK..
..KSbbbbbbbbbbbbbbbbbK..
...KSbbbbbbbbbbbbbbbSK..
....KzbbbbbbbbbbbbbzK...
.....KKzzbbbbbbbzzKK....
.......KKKKKKKKKKK......
`;
export const faceHurt = `
......KKKKKKKKKKKK......
....KKHHHHHHHHHHHHKK....
...KHHhhhHHhhHHhhhHHK...
..KHhhhhhhhhhhhhhhhhHK..
..KhhsssssssssssssshhK..
..KhssssssssssssssssSK..
..KsssKKKKssssKKKKsssK..
..KssKwweKssssKewwKssK..
..KssKwKeKssssKeKwKssK..
..KsssKKKKssssKKKKsssK..
..KsssssssSSSSssssssSK..
..KssssssSssssSssssSSK..
..KssssssssKKKKssssSSK..
..KsstsssssKRRKsssStSK..
..KstSsssSKKRRKKSssStK..
..KssSsbbbbKKKKbbbbSSK..
..KsSbbbbbbbbbbbbbbbSK..
..KSbbbbbbbbbbbbbbbbbK..
...KSbbbbbbbbbbbbbbbSK..
....KzbbbbbbbbbbbbbzK...
.....KKzzbbbbbbbzzKK....
.......KKKKKKKKKKK......
`;
export const faceDead = `
......KKKKKKKKKKKK......
....KKHHHHHHHHHHHHKK....
...KHHhhhHHhhHHhhhHHK...
..KHhhhhhhhhhhhhhhhhHK..
..KhhsssssssssssssshhK..
..KhssrRssssssssrRssSK..
..KsssKKKKssssKKKKsssK..
..KssKKrKKssssKKrKKssK..
..KssKrKrKssssKrKrKssK..
..KsssKKKKssssKKKKsssK..
..KsssssssSSSSssssRRSK..
..KssssssSssssSssRRRSK..
..KsRRssssKKKKsssRRSSK..
..KsRRtsssKRRKsssStSK...
..KRRSsssSKKKKKSsssStK..
..KssSsbbbbbbbbbbbbSSK..
..KsSbbbbbbbbbbbbbbbSK..
..KSbbbbbbbbbbbbbbbbbK..
...KSbbbbbbbbbbbbbbbSK..
....KzbbbbbbbbbbbbbzK...
.....KKzzbbbbbbbzzKK....
.......KKKKKKKKKKK......
`;
// overlays: scars / blood by health band (drawn on top of faceOk)
export const wound1 = `
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
`;
export const bloodA = `
..RR...
.RrRR..
.RrR...
..R....
`;
export const bloodB = `
...R....R..
..RrR..RrR.
.RrRR.RRrR.
..RR...RR..
...R...R...
`;
export const bloodC = `
.RR.....RR.
RrRR...RrRR
RrrR...RrrR
.RrRR.RRrR.
..RrR.RrR..
...R...R...
`;
// ---- big digits 8x11: 0-9 and % (red, outlined) -------------------------------------------------------------------------------------------
export const DIGITS = {
  0: '.KKKKK../KrrrrrK./KryyrrK./KryRrrK./KrrRrrK./KrrRrrK./KrrRyrK./KrrRrrK./KrrrrrK./.KKKKK../........',
  1: '..KKK.../.KrrK.../KryrK.../KKrrK.../..KrrK.../..KrrK.../..KrrK.../..KrrK.../.KrrrrK./.KKKKKK./........',
  2: '.KKKKK../KrrrrrK./KKKKyrK./...KrrK./..KrrK../.KrrK.../KrrK..../KrrrrrrK/KKKKKKKK/........',
  3: '.KKKKK../KrrrrrK./KKKKyrK./..KKrrK./..KrrrK./...KKrrK/KKKKyrK./KrrrrrK./.KKKKK../........',
  4: '...KKK../..KrrK../.KryrK../KryRrK../KrRKrK../KrrrrrrK/KKKKrKKK/....KrK./....KKK./........',
  5: 'KKKKKKK./KrrrrrK./KryKKKK./KrrrrK../KKKKyrK./....KrrK/KKKKyrK./KrrrrrK./.KKKKK../........',
  6: '.KKKKK../KrrrrrK./KryKKKK./KrrrrK../KrrKyrK./KrrKKrrK/KrrKRrrK/.KrrrrK./..KKKK../........',
  7: 'KKKKKKKK/KrrrrrrK/KKKKKyrK/....KrK./...KrK../..KrK.../..KrK.../..KrK.../..KKK.../........',
  8: '.KKKKK../KrrrrrK./KryKyrK./KrrKrrK./.KrrrK../KryKyrK./KrRKRrK./KrrKrrK./.KrrrK../..KKK.../',
  9: '.KKKKK../KrrrrrK./KryKyrK./KrrKRrK./.KrrrrK./..KKKrrK/KKKKyrK./KrrrrrK./.KKKKK../........',
  '%': 'KKK..KK./KrrK.KrK/KryK.KrK/KKK.KK../...KK.../..KK.KKK/.KrK.KrrK/KrK.KryK/.KK.KKKK/........',
};
export const crosshair = `
..K..
..K..
KK.KK
..K..
..K..
`;

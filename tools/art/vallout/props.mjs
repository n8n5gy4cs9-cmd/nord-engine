// Props (48x48 cells, anchored bottom-centre), FX (16x16), item icons (16x12), UI sprites (16x16).
const P = (px, rows, pal, n) => px.grid(rows, pal, n, { pad: true });
const put = (px, cell, w, h, parts) => px.compose(w, h, parts.map(([img, x, y]) => [img, x, y]));

const PINE = ['.........o.........', '........ogo........', '.......oggGo.......', '......oggggGo......', '.....oGgGggggo.....', '.......oggGo.......', '......ogggggGo.....', '.....oggGggggGo....', '....oGggggGgggGo...', '......oggggGggo....', '.....oggGgggggGo...', '...oGggggGgggggGo..', '....ooooooToooooo..', '.........oTo.......', '.........oTo.......', '.........ooo.......'];
const BIRCH = ['..o...o....o....', '...o..o..o.o...', '.o..o.o.o.o....', '..o..ooo.oo..o.', '...o.oWo.o..o..', '....ooWWoo.o...', '..o...oWo.oo...', '...oo.oWo.o....', '.....ooWWoo....', '......oWKo.....', '......oWWo.....', '......oKWo.....', '......oWWo.....', '......oWKo.....', '.....ooWWoo....', '....oooooooo...'];
const BUSH = ['..o..o..o..', '.oyo.oyoyo.', 'oyyoyoyyyyo', '.oyyyyyyyo.', '..ooooooo..'];
const LAMP = ['.oooooo.', 'oeeeeeeo', '.oLLLLo.', '..oGGo..', '...oo...', '...oG...', '...oG...', '...oG...', '...oG...', '...oG...', '...oG...', '...oG...', '...oG...', '..oGGo..', '.oGGGGo.'];
const BENCH = ['..............', '.oooooooooooo.', '.owwwwwwwwwwo.', '.oWWWWWWWWWWo.', '..oo......oo..', '.ooo......ooo.', '.oGo......oGo.'];
const BARREL_A = ['...r..r..', '..rRr.rr.', '..rrrrrRr', '.oooooooo.', 'oGGGGGGGGo', 'oggggggggo', 'oGGGGGGGGo', 'oggggggggo', 'oGGGGGGGGo', '.oooooooo.'];
const BARREL_B = ['....r....', '..r.rr.r.', '..rRrrrr.', '.rrrrrRrr', 'oooooooooo'.slice(0, 9), 'oGGGGGGGGo', 'oggggggggo', 'oGGGGGGGGo', 'oggggggggo', 'oGGGGGGGGo'.slice(0, 10), '.oooooooo.'];
const BIN = ['.oooooo.', 'oGGGGGGo', 'oggggggo', 'oGgGgGGo', 'oggggggo', 'oGGGGGGo', '.oooooo.'];
const CAR_SE = ['....ooooooooooo.........', '...oBBBBBBBBBBBoo.......', '..oBBwwwwBBwwwwBBoo.....', '.oBBwwwwwBBwwwwwBBBo....', 'oBBBBBBBBBBBBBBBBBBBoo..', 'oBbBBBBBBBBBBBBBBBBBBBoo', 'oBBBBBBBBBBBBBBBBBBBBBBo', 'oooooooooooooooooooooooo', '.oKKo.ooo.....ooKKKo.ooo', '..oo........oooKKKo.....'];
const CAR_SW = ['.........ooooooooooo....', '.......ooBBBBBBBBBBBo...', '.....ooBBwwwwBBwwwwBBo..', '....oBBBwwwwwBBwwwwwBBo.', '..ooBBBBBBBBBBBBBBBBBBBo', 'ooBBBBBBBBBBBBBBBBBBBbBo', 'oBBBBBBBBBBBBBBBBBBBBBBo', 'oooooooooooooooooooooooo', 'ooo.ooKKKo.....ooKKo.oo.', '.....oKKKooo........oo..'];
const KIOSK = ['.oooooooooo.', 'ocrcrcrcrcro', 'oWWWWWWWWWWo', 'oWkkkkkkkkWo', 'oWkyyyyyykWo', 'oWkkkkkkkkWo', 'oWWWWWWWWWWo', 'oooooooooooo'];
const CRATE = ['.oooooooo.', 'obbbbbbbbo', 'obBBBBBBbo', 'obBkkkkBbo', 'obBBBBBBbo', 'obbbbbbbbo', '.oooooooo.'];
const MOPED = ['......oo.......', '.....oLLo.....', '..ooooLoooo...', '.oRRRRRRRRo...', 'oRRrRRRRRRRoo.', 'oooKKoooooKKoo', '.oKKKo...oKKKo', '..ooo.....ooo.'];
const DICE = ['..o..o..', '.oDo.oDo', 'oDdDooDdDo', 'oDDDooDDDo', '.ooo..ooo.'];
const UFO = ['..........oooooooooo..........', '.......ooowwwwwwwwwwooo.......', '.....oowwwwwwwwwwwwwwwwoo.....', '...ooGGGGGGGGGGGGGGGGGGGGoo...', '.ooGGggGGggGGggGGggGGggGGggoo.', 'oGGGGGGGGGGGGGGGGGGGGGGGGGGGGo', '.ooooooooooooooooooooooooooo..', '....oLLo....oLLo....oLLo......'];
const GRAVE = ['..oo..', '.oWWo.', '.oWWo.', 'ooWWoo', 'oWWWWo', 'oooooo'];
const LOOT = ['..oooo..', '.obbbbo.', 'obBBBBbo', 'obbkkbbo', '.oooooo.'];
const EXIT = ['....oo....', '...oGGo...', '..oGggGo..', '.oGggggGo.', 'oGggooggGo', 'ooooGGoooo', '....oGGo..', '....oooo..'];
const SIGN = ['.oooooooooo.', 'oBBBBBBBBBBo', 'oBwwBwwBwwBo', 'oBwwBwwBwwBo', 'oBBBBBBBBBBo', '.oooGGoooo..', '....oGGo....', '....oGGo....', '....oGGo....', '...oooooo...'];
const PAL = { o: '#1a1410', g: '#4a7a3a', G: '#2e4a24', T: '#5a4028', W: '#e8e4d4', K: '#2a2622', y: '#8a8a3a', e: '#f4e8a0', L: '#7a7a82', B: '#7a8aa0', w: '#bcd4e0', b: '#8a6a3a', k: '#e0c060', R: '#6a8a52', r: '#c04030', c: '#d8d0b8', D: '#2f8a3a', d: '#9be07a', M: '#c8c8c0', '.': null };
const PAL_CAR2 = { ...PAL, B: '#a0603a', w: '#8aa0aa' };
const PAL_MOPED = { ...PAL, R: '#c84a2a', r: '#e87a4a', K: '#222222', L: '#c0c0c8' };
const PAL_BARREL = { ...PAL, r: '#ff9a2a', R: '#ffd25c', G: '#6a5a4a', g: '#8a7a68' };
const PAL_UFO = { ...PAL, w: '#a8e8c8', G: '#6a6a78', g: '#9a9aa8', L: '#f0e060' };

export const PROP_NAMES = ['pine', 'birch', 'bush', 'lamp', 'bench', 'barrel_a', 'barrel_b', 'bin', 'car_se', 'car_sw', 'kiosk', 'crate', 'moped', 'ufo_big', 'grave', 'loot', 'exit', 'sign', 'car2_se', 'car2_sw'];
export function props(px) {
  const c = (rows, pal, n, w = 48, h = 48) => { const g = P(px, rows, pal, n); return px.compose(w, h, [[g, Math.floor((w - g.w) / 2), h - g.h]]); };
  const cars = (rows, n, pal) => c(rows, pal, n);
  const moped = px.compose(48, 48, [[P(px, MOPED, PAL_MOPED, 'moped'), 17, 32], [P(px, DICE, PAL, 'dice'), 20, 25]]);
  const frames = [c(PINE, PAL, 'pine'), c(BIRCH, PAL, 'birch'), c(BUSH, PAL, 'bush'), c(LAMP, PAL, 'lamp'), c(BENCH, PAL, 'bench'), c(BARREL_A, PAL_BARREL, 'ba'), c(BARREL_B, PAL_BARREL, 'bb'), c(BIN, PAL, 'bin'),
    cars(CAR_SE, 'car_se', PAL), cars(CAR_SW, 'car_sw', PAL), c(KIOSK, PAL, 'kiosk'), c(CRATE, PAL, 'crate'), moped, px.blank(48, 48), c(GRAVE, PAL, 'grave'), c(LOOT, PAL, 'loot'), c(EXIT, PAL, 'exit'), c(SIGN, PAL, 'sign'), cars(CAR_SE, 'car2_se', PAL_CAR2), cars(CAR_SW, 'car2_sw', PAL_CAR2)];
  frames[13] = c(UFO, PAL_UFO, 'ufo', 48, 48);
  return px.sheet(frames, 5);
}

// ---- FX (16x16): muzzle A/B, bolt, bullet, spark, blood, goo, boom A/B ----------------------------------------------------
const FXP = { o: '#1a1410', y: '#ffe066', Y: '#fff6b0', r: '#ff7a2a', R: '#c02a1a', g: '#7bff7b', G: '#2a9a3a', w: '#ffffff', d: '#8a0f0f', e: '#3f8f2a', k: '#444444' };
export const FX_NAMES = ['muzzle_a', 'muzzle_b', 'bolt', 'bullet', 'spark', 'blood', 'goo', 'boom_a', 'boom_b'];
export function fx(px) {
  const f = (rows, n) => px.compose(16, 16, [[P(px, rows, FXP, n), 0, 0]]);
  return px.sheet([
    f(['....y.y.....', '.....YY.....', '..yyYYYyy...', '...yYwYy....', '..yyYYYyy...', '.....YY.....', '....y.y.....'], 'm1'),
    f(['..y......y..', '...yy..yy...', '....yYYy....', '.yyyYwwYyyy.', '....yYYy....', '...yy..yy...', '..y......y..'], 'm2'),
    f(['..............', '..GGGGGGGG....', '.GgggggggwG...', '..GGGGGGGG....'], 'bolt'),
    f(['.....', '..yy.', '.yYY.', '..yy.'], 'bullet'),
    f(['...w....w...', '..w..ww..w..', '.....ww.....', '..w..ww..w..', '...w....w...'], 'spark'),
    f(['..d....d....', '.dRd.dRRd...', 'dRRRddRRRd..', '.dRRRRRRd...', '..ddRRRdd...', '....dRd.....', '.....d......'], 'blood'),
    f(['..e....e....', '.eGe.eGGe...', 'eGGGeeGGGe..', '.eGGGGGGe...', '..eeGGGee...', '....eGe.....', '.....e......'], 'goo'),
    f(['.....r.....', '...r.Y.r....', '..rYYYYYr...', '.rYYwwYYYr..', '..rYYYYYr...', '...r.Y.r....', '.....r.....'], 'boom1'),
    f(['..r..r..r...', '.r.rrrrr.r..', '..rrRRRrr...', 'r.rRkkkRr.r.', '..rrRRRrr...', '.r.rrrrr.r..', '..r..r..r...'], 'boom2'),
  ], 9);
}

// ---- item icons 16x12 ---------------------------------------------------------------------------------------------------
const IP = { o: '#1a1410', w: '#e8e8e0', W: '#a8a8a0', g: '#46a64a', G: '#276a2c', r: '#c83a2a', R: '#8a2018', b: '#3a6ab8', B: '#24428a', y: '#e8c850', Y: '#a88a2a', k: '#303030', K: '#606068', n: '#8a5a2a', N: '#5a3a18', d: '#2f8a3a', D: '#9be07a', p: '#e87aa0', m: '#6a6a72' };
export const ITEM_ICONS = {
  kossu: ['.....oo.....', '.....oo.....', '....owwo....', '....owwo....', '...obbbbo...', '...obwwbo...', '...obwwbo...', '...obbbbo...', '...obbbbo...', '....oooo....'],
  lonkero: ['...oooooo...', '..owwwwwwo..', '..oyyyyyyo..', '..oyrrrryo..', '..oyrrrryo..', '..oyyyyyyo..', '..oyyyyyyo..', '..owwwwwwo..', '...oooooo...'],
  salmiakki: ['.oooooooooo.', 'okkkkkkkkkko', 'okwkkkwkkwko', 'okkkwkkkkkko', 'okkkkkkwkkko', 'okkkkkkkkkko', '.oooooooooo.'],
  makkara: ['..ooooooooo..', '.onnnnnnnnno.', 'onNnnnnNnnnno', 'onnnnnnnnnnNo', '.onnnnnnnnno.', '..ooooooooo..'],
  dice: ['.oooooo.......', 'oddddddo......', 'odGddGdoooooo.', 'oddGGddodddddo', 'odGddGdodGdGdo', 'oddddddoddGddo', '.oooooooodGdGdo', '........oddddo.', '.........oooooo'],
  nokia: ['...oooooo...', '..okkkkkko..', '..okDDDDko..', '..okDddDko..', '..okkkkkko..', '..okKKKKko..', '..okKkKkko..', '..okKKKKko..', '...oooooo...'],
  puukko: ['..........oo', '.........oWWo', '........oWWo.', '.......oWWo..', '......oWWo...', '..ooooWo.....', '.onnnNo......', '.oNNo........', '..oo.........'],
  pipe: ['............oo', '...........oWo', '..........oWo.', '.........oWo..', '........oWo...', '.......oWo....', '......oWo.....', '.....oWo......', '....oWo.......', '...ooo........'],
  pistol: ['.oooooooo....', 'okkkkkkkko...', 'oKKKKKKKKoo..', 'okkkkkkkkkkoo', '.ooooookkoooo', '.....oknko...', '.....oknko...', '......ooo....'],
  rifle: ['..............oo', 'ooooooooooooooko', 'okkkkkkkkkkkkKo', 'oKKKKKKKnnnnnoo', '.ooooooonNNNno.', '.........oNo...', '..........o....'],
  raygun: ['..oooooooo....', '.omGGGGGGmoo..', 'omgDDDDDDgmmoo', 'omGGGGGGGGGmoo', '.ooooommoooo..', '.....omDmo....', '.....ommmo....', '......ooo.....'],
  jacket: ['..oo....oo..', '.okko..okko.', 'okkkkoookkko', 'okkKkkkkkKko', 'okkKkkkkkKko', '.okkkkkkkko.', '.okkkkkkkko.', '..okkkkkko..', '...oooooo...'],
  tracksuit: ['..oo....oo..', '.obbo..obbo.', 'obwbboobbwbo', 'obwbbbbbbwbo', 'obwbbbbbbwbo', '.obbbbbbbbo.', '.obbbbbbbbo.', '..obbbbbbo..', '...oooooo...'],
  vest: ['..oo....oo..', '.oGGo..oGGo.', 'oGGgGooGgGGo', 'oGgGgggGgGgo', 'oGGgGggGgGGo', '.oGGgGgGgGo.', '.oGgGggGgGo.', '..oGGGGGGo..', '...oooooo...'],
  key: ['.ooo........', 'oyyyo.......', 'oy.yoooooooo', 'oyyyyYYYYYYo', '.ooo.oYo.oYo', '......oo..oo'],
  sparkplug: ['....oo....', '...oWWo...', '...oWWo...', '..ooKKoo..', '..oKKKKo..', '..oWWWWo..', '...oWWo...', '...oWWo...', '....oo....'],
  cash: ['.oooooooooo.', 'ogggggggggGo', 'ogGGggGGggGo', 'ogGyyGGyyGgo', 'ogGGggGGggGo', 'ogggggggggGo', '.oooooooooo.'],
  ammo: ['.oooooooooo.', 'oyyyyyyyyyyo', 'oykkykkykkyo', 'oykkykkykkyo', 'oyyyyyyyyyyo', 'oYYYYYYYYYYo', '.oooooooooo.'],
  beer_hat: ['....oooooo....', '..oowwwwwwoo..', '.owwwwwwwwwwo.', 'oyyyyyyyyyyyyo', '.oooooooooooo.'],
};
export const ITEM_NAMES = Object.keys(ITEM_ICONS);
export const items = (px) => px.sheet(ITEM_NAMES.map((n) => px.compose(16, 12, [[P(px, ITEM_ICONS[n], IP, `item:${n}`), 0, 0]])), 10);

// ---- UI sprites 16x16: cursors + chrome ----------------------------------------------------------------------------------------
const UP = { o: '#000000', w: '#f2f2f2', g: '#7be07b', r: '#e04a3a', y: '#f2d24a', k: '#2a2622', m: '#9a9488', M: '#6a665c', d: '#3a3630', R: '#c0342c', L: '#ff6a5a', n: '#a8643a', N: '#6a3a1a', G: '#2a9a3a' };
export const UI_NAMES = ['cur_move', 'cur_cmd', 'cur_look', 'cur_attack', 'cur_wait', 'tile', 'tile_fill', 'metal', 'metal_dark', 'btn_up', 'btn_down', 'led_on', 'led_off', 'rivet', 'dot', 'ap_bar'];
export function ui(px) {
  const f = (rows, n) => px.compose(16, 16, [[P(px, rows, UP, n), 0, 0]]);
  const metalA = ['mmmmmmmmmmmmmmmm', 'mmMmmmmmmmMmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmMmmmmmmmMmm', 'mmmmmmmmmmmmmmmm', 'MmmmmmmmMmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmMmmmmmmmMmmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmMmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mMmmmmmmmmmMmmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmMmmmmmmmMmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmMmmmmmm'];
  const metalD = metalA.map((r) => r.replace(/m/g, 'd').replace(/M/g, 'k'));
  return px.sheet([
    f(['o...........', 'ow..........', 'owwo........', 'owwwo.......', 'owwwwo......', 'owwwwwo.....', 'owwwwwwo....', 'owwwwoooo...', 'owowwo......', 'oo.owwo.....', '...owwo.....', '....oo......'], 'cur_move'),
    f(['....oo......', '...owwo.....', '...owwo.....', '...owwo.....', 'oo.owwooo...', 'owoowwowwo..', 'owwowwowwo..', '.owwwwwwwwo.', '.owwwwwwwwo.', '..owwwwwwo..', '...owwwwwo..', '....oooooo..'], 'cur_cmd'),
    f(['...oooooo...', '..owwwwwwo..', '.owwoooowwo.', '.owo....owo.', '........owo.', '......oowo..', '.....owwo...', '.....owo....', '.....owo....', '............', '.....owo....', '.....owo....'], 'cur_look'),
    f(['.....rr.....', '.....rr.....', '..rr.rr.rr..', '...r....r...', 'rrr..rr..rrr', 'rrr..rr..rrr', '...r....r...', '..rr.rr.rr..', '.....rr.....', '.....rr.....'], 'cur_attack'),
    f(['..oooooooo..', '.owwwwwwwwo.', '.owoyyyyowo.', '..owoyyowo..', '...owowo....', '....oo......', '...owowo....', '..owoyyowo..', '.owoyyyyowo.', '.owwwwwwwwo.', '..oooooooo..'], 'cur_wait'),
    px.compose(16, 16, [[px.crop(px.blank(32, 16), 0, 0, 16, 16), 0, 0]]), px.blank(16, 16),
    px.grid(metalA, UP, 'metal'), px.grid(metalD, UP, 'metal_dark'),
    f(['..oooooooooo..', '.oLRRRRRRRRRo.', 'oLRRRRRRRRRRRo', 'oRRRRRRRRRRRdo', 'oRRRRRRRRRRRdo', 'oRRRRRRRRRRRdo', 'oRRRRRRRRRRRdo', '.oRRRRRRRRdo..', '..oooooooooo..'], 'btn_up'),
    f(['..oooooooooo..', '.odddddddddo...', 'oddRRRRRRRRRRo', 'odRRRRRRRRRRRo', 'odRRRRRRRRRRRo', 'odRRRRRRRRRRRo', 'odRRRRRRRRRRRo', '.oRRRRRRRRRRo.', '..oooooooooo..'], 'btn_down'),
    f(['..oooo..', '.oGggGo.', 'oGgwwgGo', 'oGgwggGo', '.oGggGo.', '..oooo..'], 'led_on'), f(['..oooo..', '.okkkko.', 'okkkkkko', 'okkkkkko', '.okkkko.', '..oooo..'], 'led_off'),
    f(['.mm.', 'mMMm', 'mMMm', '.mm.'], 'rivet'), f(['.ww.', 'wwww', 'wwww', '.ww.'], 'dot'), f(['gggggggggggggggg', 'GGGGGGGGGGGGGGGG'], 'ap'),
  ], 8);
}

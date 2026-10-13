// Original pixel-exact targeting UI, explosions, projectiles, map markers and terminal lettering.
import { GLYPHS } from '../noom/font.mjs';
const PAL = { '.': null, k: '#101823', d: '#394855', m: '#718895', s: '#acc4c9', w: '#f0fff0',
  c: '#69d8ef', b: '#2b71b3', g: '#7de547', e: '#d6ff97', p: '#89568f', r: '#e55445',
  o: '#eb8132', y: '#ffc95a', a: '#924128', f: '#53626b', h: '#a4b2ac' };
const thin = {
  0: '01110/10001/10011/10101/11001/10001/01110', 1: '00100/01100/00100/00100/00100/00100/01110',
  2: '01110/10001/00001/00010/00100/01000/11111', 3: '11110/00001/00001/01110/00001/00001/11110',
  4: '00010/00110/01010/10010/11111/00010/00010', 5: '11111/10000/10000/11110/00001/00001/11110',
  6: '01110/10000/10000/11110/10001/10001/01110', 7: '11111/00001/00010/00100/01000/01000/01000',
  8: '01110/10001/10001/01110/10001/10001/01110', 9: '01110/10001/10001/01111/00001/00001/01110',
  A: '01110/10001/10001/11111/10001/10001/10001', B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111', D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111', F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111', H: '10001/10001/10001/11111/10001/10001/10001',
  J: '00111/00010/00010/00010/00010/10010/01100', K: '10001/10010/10100/11000/10100/10010/10001',
  M: '10001/11011/10101/10101/10001/10001/10001', N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110', P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101', R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110', U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100', W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001', Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
};
export function details(px) {
  const g = (rows, w = 16, h = 16) => px.compose(w, h, [[px.grid(rows.map(r => r.padEnd(w, '.')), PAL), 0, 0]]);
  const centred = rows => { const a = px.grid(rows, PAL); return px.compose(16, 16, [[a, (16 - a.w) >> 1, (16 - a.h) >> 1]]); };
  const boom = [
    centred(['..o.o..', '...y...', 'oywwwyo', '.ywwwy.', 'oywwwyo', '...y...', '..o.o..']),
    centred(['..o...o..', '...oyo...', '.oywwwyo.', 'oywwwwwyo', '.ywwwwwy.', 'oywwwwwyo', '.oywwwyo.', '...oyo...', '..o...o..']),
    centred(['..a.o...a.o..', '...oyy.yyo...', '.oywwwywwwyo.', 'oywwwyyywwyo.', '.ywwyaaywwyo.', 'oywyaraaywwyo', '.ywyaaraaywy.', 'oywyaaarywyo.', '.oywyaywwyo..', '..oywwwyo....', '.a..oyo..a.o.', '....a..a.....', '...a.....a...']),
    centred(['....f..f.....', '..fhf..fhf...', '.fhhffhhhf...', '.fhddfhddhf..', 'fhdddddddhhf.', '.fdddddddhhf.', '..fdddddff...', '.f.fddff.f...', '....ff.......', '..f....f.....', '......f......']),
  ];
  const spark = centred(['...y...', 'y..w..y', '.y.w.y.', '..www..', 'ywwwwwy', '..www..', '.y.w.y.', 'y..w..y', '...y...']);
  const plasma = centred(['..gg..', '.geeg.', 'gewweg', 'gewweg', '.geeg.', '..gg..']);
  const bullet = centred(['..........', '..ywwwyyy.', '.oywwwy...', '..........']);
  const rocket = centred(['..........', '...s......', '.kswwyoo..', '...s......', '..........']);
  const diamond = kind => {
    const rows = Array.from({ length: 16 }, (_, y) => {
      const wide = (y < 8 ? y + 1 : 16 - y) * 4, x0 = (32 - wide) / 2;
      return '.'.repeat(x0) + (kind === 'cursor' ? 'c' + '.'.repeat(wide - 2) + 'c' : (kind === 'move' ? 'b' : 'r').repeat(wide)) + '.'.repeat(x0);
    });
    const image = px.grid(rows, { ...PAL, b: '#4a9ed02b', r: '#e5544538', c: '#8bedff' });
    if (kind === 'cursor') for (const y of [0, 15]) for (let x = 14; x < 18; x++) image.d.set([197, 247, 255, 255], (y * 32 + x) * 4);
    return image;
  };
  const arrow = g(['k', 'kwk', 'kwwk', 'kwwwk', 'kwwwwk', 'kwwwwwk', 'kwwwwwwk', 'kwwwwwwwk', 'kwwwwwkkkk', 'kwwkwwk', 'kwk.kwwk', 'kk..kwwk', '.....kwwk', '......kk']);
  const cross = centred(['......rr......', '......wr......', '...rr.rr.rr...', '..r........r..', '.r..........r.', '.r..........r.', 'rrr...ww...rrr', 'rwr...ww...rwr', '.r..........r.', '.r..........r.', '..r........r..', '...rr.rr.rr...', '......rw......', '......rr......']);
  const select = g(['ccc..........ccc', 'cw............wc', 'c..............c', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', 'c..............c', 'cw............wc', 'ccc..........ccc']);
  const move = centred(['....gggg....', '..gg....gg..', '.g........g.', '.g...gg...g.', 'g....gg....g', 'g....gg....g', '.g...gg...g.', '.g........g.', '..gg....gg..', '....gggg....']);
  const shot = rows => { const a = px.grid(rows, PAL); return px.compose(8, 8, [[a, (8 - a.w) >> 1, (8 - a.h) >> 1]]); };
  const shots = px.sheet([shot(['.c.', 'cwc', 'cwc', 'cwc', 'cwc', '.c.']), shot(['.gg.', 'geeg', 'gewg', '.gg.']), shot(['..g..', '.geg.', 'gew eg'.replace(' ', ''), '.geg.', '..g..']), shot(['..y..', 'y.w.y', '.www.', 'y.w.y', '..y..'])]);
  const pickups = ['P', 'M', 'S'].map((ch, i) => {
    const panel = px.grid(['.kkkkkkkkkk.', 'kssssssssssk', 'ksddddddddmk', 'ksddddddddmk', 'ksddddddddmk', 'ksddddddddmk', 'ksddddddddmk', 'ksddddddddmk', 'ksddddddddmk', 'ksmmmmmmmmmk', 'kmmmmmmmmmmk', '.kkkkkkkkkk.'], PAL);
    return px.blit(panel, px.grid(thin[ch].split('/'), { '0': null, '1': ['#69d8ef', '#ffc95a', '#7de547'][i] }), 3, 2);
  });
  const icons = [
    g(['.......c........', '.......s........', '......ksk.......', '.....ksssk......', '....ksscssk.....', '...kssbbcssk....', '..kssbbbbcssk...', '.kssbbwwbbcssk..', '.ksbbwwwwbbmsk..', '..kbbbbbbbbmk...', '...kbbssbbmk....', '....kkkkkkk.....', '......cccc......']),
    g(['.', '.', '......kkkk......', '.....kssssk.....', '....kswwssmk....', '..kkssscssmmkk..', '.ksscsscsscssmk.', 'ksmggsmggsmggmmk', '.kmmmmmmmmmmmmk.', '..kkkkkkkkkkkk..', '.....cccccc.....']),
    g(['.......y........', '...o..ywy..o....', '....o.ywy.o.....', '.....oywyo......', '..o.oywwwyo.o...', '...oywwwwwyo....', '....oywwwyo.....', '.kkkkkywykkkkk..', '.ksdksdksdksdk..', '.kddkddkddkddk..', '.kmmkmmkmmkmmk..', '..kkkkkkkkkkkk..']),
    g(['.......p........', '......ppp.......', '....ppgpppp.....', '...ppgegpppp....', '..ppgewegpppp...', '.kppgewwegppppk.', '.kpppgeegpppppk.', '..kpppggpppppk..', '...kppppppppk...', '....kkkkkkkk....', '......gggg......']),
  ];
  const chars = Array.from({ length: 64 }, (_, i) => String.fromCharCode(i + 32));
  const font = px.sheet(chars.map(ch => px.compose(6, 8, [[px.grid((thin[ch] ?? GLYPHS[ch]).split('/'), { '0': null, '1': '#ffffff' }), 0, 0]])), 16);
  return {
    'assets/tactical/ui.png': px.sheet(['cursor', 'move', 'hit'].map(diamond)), 'assets/tactical/fx.png': px.sheet([...boom, spark, plasma, bullet], 8),
    'assets/rts/ui.png': px.sheet([arrow, cross, select, move], 8), 'assets/rts/fx.png': px.sheet([...boom, spark, plasma, rocket], 8),
    'assets/air/shots.png': shots, 'assets/air/pickups.png': px.sheet(pickups),
    'assets/geo/icons.png': px.sheet(icons), 'assets/ui/font.png': font,
  };
}

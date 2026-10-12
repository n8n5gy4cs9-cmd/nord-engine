// Original hand-pixelled markers/slashes; lettering shared with the Noom redraw.
export { font } from '../noom/font.mjs';

const PAL = { '.': null, K: '#171323', w: '#fff4cb', y: '#ffd25c', r: '#ef684c', b: '#92dcec' };
const DRAWINGS = [
  // Alert and quest markers, read at the game's 3x scale.
  ['..KKK..', '.KrrrK.', '.KrrrK.', '.KrrrK.', '.KryrK.', '..KrK..', '..KKK..', '.......', '..KKK..', '.KryrK.', '..KKK..'],
  ['.KKKK..', 'KyyyyK.', 'KwwyyK.', '.KKyyK.', '..KyyK.', '.KyyK..', '.KKK...', '.......', '.KKK...', 'KwwyK..', '.KKK...'],
  ['bbbbb..........', '...b...........', '..b............', '.b...bbbbb.....', 'bbbbb...b......', '.......b.......', '......b...bbbbb', '.....bbbbb...b.', '............b..', '...........b...', '..........bbbbb'],
  ['.......y........', '.......w........', '...y...w...y....', '....w..w..w.....', '.....wwwww......', '.yywwwwwwwwwyy..', '.....wwwww......', '....w..w..w.....', '...y...w...y....', '.......w........', '.......y........'],
  ['............ww..', '.........wwwy...', '.......wwwy.....', '.....wwwy.......', '....wwy.........', '...wwy..........', '..wwy...........', '..wy............', '.wy.............', '.w..............'],
  ['.............w..', '..........wwwy..', '........wwwwy...', '......wwwwy.....', '....wwwwy.......', '...wwwwy........', '..wwwy..........', '.wwwy...........', '.wwy............', '.wy.............', '..y.............'],
];

export function effects(px) {
  return px.sheet(DRAWINGS.map((rows, i) => {
    const a = px.grid(rows, PAL, `rpd:fx:${i}`, { pad: true });
    return px.compose(16, 16, [[a, Math.floor((16 - a.w) / 2), Math.floor((16 - a.h) / 2)]]);
  }));
}

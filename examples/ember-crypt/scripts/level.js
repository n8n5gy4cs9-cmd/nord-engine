import { NordScript } from 'nord';
import { MAP } from './map.js';
import * as E from './entities.js';

export default class Level extends NordScript {
  static attributes = { tile: { type: 'number', default: 32, min: 8 } };

  async start() {
    const t = this.attrs.tile;
    const width = MAP[0].length * t, height = MAP.length * t;
    const spawn = (data) => this.scene.spawnData(data);
    await spawn(E.floor(width, height));

    const kinds = { o: E.coin, k: E.key, '+': E.potion, C: E.chest, B: E.brazier, '^': E.spikes, s: E.slime, b: E.bat, X: E.exitRune };
    let coins = 0;
    for (let row = 0; row < MAP.length; row++) {
      let col = 0;
      while (col < MAP[row].length) {
        const ch = MAP[row][col];
        const x = col * t + t / 2, y = row * t + t / 2;
        if (ch === '#') {
          let end = col;
          while (MAP[row][end + 1] === '#') end++;
          const w = (end - col + 1) * t;
          await spawn(E.wallBody(col * t + w / 2, y, w, t));            // one collider and one shadow caster for the whole run
          for (let c = col; c <= end; c++) await spawn(E.wallTile(c * t + t / 2, y));   // but one picture per tile
          col = end + 1;
          continue;
        }
        if (ch === 'P') this.scene.find('Hero').pos = [x, y, 3];
        else if (ch === 'c') await spawn(E.crate(x, y, (col + row) % 2 ? 'crate' : 'barrel'));
        else if (ch === 'D') await spawn(E.door(x, y));
        else if (kinds[ch]) { if (ch === 'o') coins++; await spawn(kinds[ch](x, y)); }
        col++;
      }
    }
    this.events.emit('level', { width, height, coins });
  }
}

import { NordScript } from 'nord';
import { MAP } from './map.js';

const sprite = (w, h, tint) => ({ type: 'sprite', texture: 'assets/sprites/square.png', size: [w, h], tint, alpha: 1 });
const data = (name, tags, x, y, z, components) => ({ name, tags, transform: { pos: [x, y, z], rot: [0, 0, 0], scale: [1, 1, 1] }, components, scripts: [], children: [] });

export default class Level extends NordScript {
  static attributes = { tile: { type: 'number', default: 32, min: 8 } };

  async start() {
    const t = this.attrs.tile;
    const width = MAP[0].length * t, height = MAP.length * t;
    await this.scene.spawnData(data('Floor', [], width / 2, height / 2, -5, [sprite(width, height, '#2e3440')]));

    for (let row = 0; row < MAP.length; row++) {
      let col = 0;
      while (col < MAP[row].length) {
        const ch = MAP[row][col];
        if (ch === '#') {
          let end = col;                                           // extend the run while the next tile is a wall too
          while (MAP[row][end + 1] === '#') end++;
          const w = (end - col + 1) * t;
          await this.scene.spawnData(data('Wall', ['solid'], col * t + w / 2, row * t + t / 2, 1, [
            sprite(w, t, '#4c566a'), { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [w, t] },
          ]));
          col = end + 1;
          continue;
        }
        if (ch === 'P') this.scene.find('Hero').pos = [col * t + t / 2, row * t + t / 2, 2];
        col++;
      }
    }
    this.events.emit('level', { width, height });
  }
}

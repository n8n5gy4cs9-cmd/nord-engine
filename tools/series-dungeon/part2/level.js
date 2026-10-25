import { NordScript } from 'nord';
import { MAP } from './map.js';

/** Plain data for one entity. The scene file stores exactly this shape. */
const wall = (x, y, w, h) => ({
  name: 'Wall', tags: ['solid'],
  transform: { pos: [x, y, 1], rot: [0, 0, 0], scale: [1, 1, 1] },
  components: [
    { type: 'sprite', texture: 'assets/sprites/square.png', size: [w, h], tint: '#4c566a', alpha: 1 },
    { type: 'rigidbody', mode: 'static' },
    { type: 'collider', shape: 'box', size: [w, h] },
  ],
  scripts: [], children: [],
});

export default class Level extends NordScript {
  static attributes = { tile: { type: 'number', default: 32, min: 8 } };

  async start() {
    const t = this.attrs.tile;
    const floor = { name: 'Floor', tags: [], transform: { pos: [MAP[0].length * t / 2, MAP.length * t / 2, -5], rot: [0, 0, 0], scale: [1, 1, 1] },
      components: [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [MAP[0].length * t, MAP.length * t], tint: '#2e3440', alpha: 1 }], scripts: [], children: [] };
    await this.scene.spawnData(floor);
    for (let row = 0; row < MAP.length; row++) {
      for (let col = 0; col < MAP[row].length; col++) {
        const ch = MAP[row][col];
        const x = col * t + t / 2, y = row * t + t / 2;                // centre of the tile
        if (ch === '#') await this.scene.spawnData(wall(x, y, t, t));
        else if (ch === 'P') this.scene.find('Hero').pos = [x, y, 2];
      }
    }
  }
}

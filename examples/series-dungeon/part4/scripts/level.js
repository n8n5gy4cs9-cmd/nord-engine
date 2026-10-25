import { MonoBehaviour, SerializeField, Instantiate, EventBus } from 'nord';
import { MAP } from './map.js';

export default class Level extends MonoBehaviour {
  static attributes = SerializeField({ tile: 32 });

  async Start() {
    const t = this.tile;
    const width = MAP[0].length * t, height = MAP.length * t;
    await Instantiate('prefabs/floor.prefab.json', { pos: [width / 2, height / 2, -5], overrides: { components: { 0: { size: [width, height] } } } });

    let coins = 0;
    for (let row = 0; row < MAP.length; row++) {
      let col = 0;
      while (col < MAP[row].length) {
        const ch = MAP[row][col];
        if (ch === '#') {
          let end = col;                                                 // extend the run while the next tile is a wall too
          while (MAP[row][end + 1] === '#') end++;
          const w = (end - col + 1) * t;
          await Instantiate('prefabs/wall.prefab.json', {
            pos: [col * t + w / 2, row * t + t / 2, 1],
            overrides: { components: { 0: { size: [w, t] }, 2: { size: [w, t] } } },   // component 0 = sprite, 2 = collider
          });
          col = end + 1;
          continue;
        }
        const x = col * t + t / 2, y = row * t + t / 2;
        if (ch === 'P') this.Find('Hero').pos = [x, y, 2];
        else if (ch === 'o') { coins++; await Instantiate('prefabs/coin.prefab.json', { pos: [x, y, 1] }); }
        col++;
      }
    }
    EventBus.Publish('level', { width, height, coins });
  }
}

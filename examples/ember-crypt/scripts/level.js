import { MonoBehaviour, SerializeField, Instantiate, EventBus } from 'nord';
import { MAP } from './map.js';

// map character -> prefab. One line per kind of thing: adding a new object is one line here and one prefab.
const PREFAB = { o: 'coin', k: 'key', '+': 'potion', C: 'chest', B: 'brazier', '^': 'spikes', s: 'slime', b: 'bat', X: 'exit', D: 'door' };

export default class Level extends MonoBehaviour {
  static attributes = SerializeField({ tile: 32 });

  async Start() {
    const t = this.tile;
    const width = MAP[0].length * t, height = MAP.length * t;
    await Instantiate('prefabs/floor.prefab.json', { pos: [width / 2, 400, -5] });

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
          await Instantiate('prefabs/wall-body.prefab.json', {        // one collider and one shadow caster for the whole run
            pos: [col * t + w / 2, y, 0], overrides: { components: { 1: { size: [w, t] } } },
          });
          for (let c = col; c <= end; c++) await Instantiate('prefabs/wall-tile.prefab.json', { pos: [c * t + t / 2, y, 1] });   // but one picture per tile
          col = end + 1;
          continue;
        }
        if (ch === 'P') this.Find('Hero').pos = [x, y, 3];
        else if (ch === 'c') await Instantiate(`prefabs/${(col + row) % 2 ? 'crate' : 'barrel'}.prefab.json`, { pos: [x, y, 2] });
        else if (PREFAB[ch]) { if (ch === 'o') coins++; await Instantiate(`prefabs/${PREFAB[ch]}.prefab.json`, { pos: [x, y, 2] }); }
        col++;
      }
    }
    EventBus.Publish('level', { width, height, coins });
  }
}

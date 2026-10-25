import { MonoBehaviour, SerializeField, Instantiate } from 'nord';
import { MAP } from './map.js';

export default class Level extends MonoBehaviour {
  static attributes = SerializeField({ tile: 32 });

  async Start() {
    const t = this.tile;
    const width = MAP[0].length * t, height = MAP.length * t;
    await Instantiate('prefabs/floor.prefab.json', {
      pos: [width / 2, height / 2, -5],
      overrides: { components: { 0: { size: [width, height] } } },       // a prefab can be overridden per instance
    });
    for (let row = 0; row < MAP.length; row++) {
      for (let col = 0; col < MAP[row].length; col++) {
        const x = col * t + t / 2, y = row * t + t / 2;                  // the centre of the tile
        if (MAP[row][col] === '#') await Instantiate('prefabs/wall.prefab.json', { pos: [x, y, 1] });
        else if (MAP[row][col] === 'P') this.Find('Hero').pos = [x, y, 2];
      }
    }
  }
}

---
title: 40 · Procedural content and randomness
section: Examples
order: 40
summary: Seeded random numbers, random levels and dungeons, loot tables, noise, weighted choice, and shuffling.
---

## The random generator (Unity: `Random`)
```js
const r = this.game.rng;            // one seedable generator per game
r.range(10, 20);                    // float in [10, 20)         Random.Range(10f, 20f)
r.int(1, 6);                        // integer 1..6 INCLUDING 6  Random.Range(1, 7)
r.chance(0.25);                     // true 25% of the time
r.pick(['a', 'b', 'c']);            // a random element
r.shuffle(deck);                    // shuffles in place (Fisher-Yates), returns the array
```
Same seed, same sequence: `import { Rng } from 'nord'; const level = new Rng(12345);` gives a **repeatable level** (daily challenge, shareable seeds, bug repros). Create one `Rng` per purpose (level layout, loot) so unrelated events do not change each other.

## Weighted choice
```js
function weighted(rng, table) {                       // table: [['common', 70], ['rare', 25], ['epic', 5]]
  let roll = rng.range(0, table.reduce((t, [, w]) => t + w, 0));
  for (const [item, w] of table) if ((roll -= w) < 0) return item;
  return table.at(-1)[0];
}
weighted(this.game.rng, [['coin', 70], ['gem', 25], ['key', 5]]);
```
Library `loot-table.js` does this from the Inspector (drop tables with weights).

## A random room layout
```js
async build(seed) {
  const rng = new Rng(seed), rooms = [];
  for (let tries = 0; rooms.length < 8 && tries < 100; tries++) {
    const w = rng.int(6, 12), h = rng.int(5, 9), x = rng.int(0, 40 - w), y = rng.int(0, 24 - h);
    if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;   // overlaps: try again
    rooms.push({ x, y, w, h });
  }
  for (let i = 1; i < rooms.length; i++) await this.corridor(rooms[i - 1], rooms[i]);          // connect each room to the previous
  for (const r of rooms) for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++)
    this.scene.spawn('prefabs/floor.prefab.json', { pos: [tx * 32 + 16, ty * 32 + 16, 0] });
}
```
For a complete, tested generator use the library `proc-dungeon.js` (rooms + corridors), `proc-autotile.js` (picks the right wall tile from neighbours), `proc-minimap.js`, `proc-fog.js` (fog of war), `proc-weather.js`, `proc-daynight.js`.

## Noise (terrain, clouds, variation)
Library `util-noise.js` provides smooth noise (value/perlin style) for heights, caves and wobble:
```js
import { makeNoise } from './util-noise.js';            // seeded 2D simplex noise
const noise = makeNoise(seed);                          // a function: noise(x, y) is in -1..1
const height = Math.round(noise(x * 0.1, 0) * 8);       // smooth hills
const rough = noise.fbm(x * 0.05, y * 0.05, 4);         // fractal sum (detail on detail), also -1..1
```
Quick "organic" motion without noise: `Math.sin(t * 1.3) + Math.sin(t * 2.7) * 0.5`.

## Random but fair
* Shuffle bags: put all options in an array, `shuffle`, hand them out one by one; refill when empty (no streaks of the same pick).
* Avoid spawning on the player: pick a position, retry if `Math.hypot(dx, dy) < 120`.
* Seeds in saves: store the level seed with the save so loading recreates the same level (`this.save.set('seed', seed)`).

## Spawning at random edges (as in Star Shooter)
```js
const pos = [[x, -20], [x, 560], [-20, y], [980, y]][rng.int(0, 3)];                    // top, bottom, left, right
```

## Procedural with the tilemap
Build the grid as numbers, then paint it into a tilemap layer or spawn tile prefabs. Painted maps ([Tilemaps](ex-tilemap-levels.html)) and generated maps can be mixed: generate the rooms, hand-place the boss room.

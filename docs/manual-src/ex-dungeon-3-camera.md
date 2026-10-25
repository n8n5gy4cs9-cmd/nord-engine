---
title: 51 · Dungeon 3: Camera and a bigger level
section: Examples
order: 51
summary: Series part 3 of 6, Unity style. A follow camera in LateUpdate with Mathf.Lerp and bounds, frame-rate independent smoothing, EventBus, and merging wall tiles into long strips.
---
Part 3 of the Unity-style dungeon series, continuing from [part 2, walls](ex-dungeon-2-walls.html). Allow 40 minutes.

**What you will build:** a 40 × 22 tile dungeon with six rooms and corridors, much bigger than the screen, a camera that follows the hero smoothly and never shows the void outside the level, and a loader that creates far fewer objects.

![The camera follows the hero through the dungeon](assets/screenshots/series-dungeon-3-follow.png)

**Download:** [Part 3 project](assets/downloads/series-dungeon-part3-source.zip), also in `examples/series-dungeon/part3`.

## 1 A bigger map

Replace `map.js` with the dungeon of this part (forty columns, twenty-two rows, 1280 × 704 pixels):

```js
export const MAP = [
  '########################################',
  '########################################',
  '##........####..........#####.........##',
  '##........####..........#####.........##',
  '##...............................##...##',
  '##....##..........###.................##',
  '##........####..........#####.........##',
  '##........####..........#####.........##',
  '#####..#######..........#########..#####',
  '#####..###########..#############..#####',
  '#####..###########..#############..#####',
  '#####..###########..#############..#####',
  '##..........######..##########........##',
  '##..........####..........####........##',
  '##..........####..........####........##',
  '##....##..........................##..##',
  '##..................##................##',
  '##..........####..........####........##',
  '##..........####..........####........##',
  '##..........####..........####........##',
  '########################################',
  '########################################',
];
```

Play it: the hero walks in a world three times wider than the screen and… walks off the screen. We need a camera script.

## 2 The camera is just a GameObject

The `camera` component shows the part of the world around the entity's position. To follow something, **move the camera entity**: no special feature is needed. Create `scripts/follow.js` and put it on `Camera`:

```js
import { MonoBehaviour, SerializeField, EventBus, Mathf, Time, Vector3 } from 'nord';

export default class Follow extends MonoBehaviour {
  static attributes = SerializeField({ target: 'Hero', stiffness: 8, viewport: [640, 360] });

  Start() {
    this.hero = this.Find(this.target);
    // The level announces its size when it has built itself. EventBus is a global publish/subscribe board.
    this.off = EventBus.Subscribe('level', (size) => { this.bounds = size; this.snap = true; });
  }

  LateUpdate() {                                                         // after every Update(): the hero has already moved this frame
    if (!this.hero || !this.bounds) return;
    const [hw, hh] = [this.viewport[0] / 2, this.viewport[1] / 2];
    const goalX = Mathf.Clamp(this.hero.pos[0], hw, this.bounds.width - hw);
    const goalY = Mathf.Clamp(this.hero.pos[1], hh, this.bounds.height - hh);
    const k = this.snap || this.stiffness === 0 ? 1 : 1 - Math.exp(-this.stiffness * Time.deltaTime);   // the same at 30 and 144 fps
    this.snap = false;
    const p = this.position;
    this.position = new Vector3(Mathf.Lerp(p.x, goalX, k), Mathf.Lerp(p.y, goalY, k), p.z);
  }

  OnDestroy() { this.off?.(); }
}
```

* `LateUpdate` runs after every `Update` and `FixedUpdate` of the frame. The camera must read the hero's position after the hero has moved, otherwise it follows the previous frame and the picture shakes. This is why Unity camera scripts live in `LateUpdate`.
* **Bounds.** The camera centre may go at most half a screen away from each map edge: `Mathf.Clamp(hero.x, hw, width − hw)`. Otherwise we would see the empty space outside the level.
* **Smoothing.** `Mathf.Lerp(current, goal, k)` moves a fraction `k` of the remaining distance each frame.

> **Why `1 - Math.exp(-stiffness * Time.deltaTime)` and not just `stiffness * Time.deltaTime`?** With the plain product the camera follows differently at 30 and 144 fps, and above `1 / deltaTime` it overshoots. The exponential form gives the same result at any frame rate and never exceeds 1. Copy this one-liner into every game; the Unity function that does it for you is `Mathf.SmoothDamp`.

## 3 Telling the camera how big the level is

The camera needs the map size, which only the `Level` knows. Do not make the camera import the level: scripts should not be glued together. Use the global **EventBus** (a publish/subscribe board). At the end of `Level.Start`:

```js
EventBus.Publish('level', { width, height });
```

and the camera subscribes in its `Start`:

```js
this.off = EventBus.Subscribe('level', (size) => { this.bounds = size; this.snap = true; });
```

`Subscribe` returns a function that unsubscribes; `OnDestroy` calls it (`this.off?.()`). `snap = true` makes the first frame jump to the hero instead of sweeping across the map. In C# this is `public static event Action<Size> OnLevel;` with `+=` and `-=`.

## 4 Merge the walls

The level of part 2 made one wall object per `#`. This map has 449 wall tiles. Our loader now merges **horizontal runs** into one wide wall:

```js
import { MonoBehaviour, SerializeField, Instantiate, EventBus } from 'nord';
import { MAP } from './map.js';

export default class Level extends MonoBehaviour {
  static attributes = SerializeField({ tile: 32 });

  async Start() {
    const t = this.tile;
    const width = MAP[0].length * t, height = MAP.length * t;
    await Instantiate('prefabs/floor.prefab.json', { pos: [width / 2, height / 2, -5], overrides: { components: { 0: { size: [width, height] } } } });

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
        if (ch === 'P') this.Find('Hero').pos = [col * t + t / 2, row * t + t / 2, 2];
        col++;
      }
    }
    EventBus.Publish('level', { width, height });
  }
}
```

* `let end = col; while (MAP[row][end + 1] === '#') end++;` finds where the run ends. At the end of a row `MAP[row][end + 1]` is `undefined`, which is not `'#'`, so the loop stops by itself.
* A run of `n` tiles becomes one wall `n * t` wide, centred at `col * t + w / 2`. The overrides change **both** the sprite (component 0) and the collider (component 2) of the prefab: `components: { 0: { size }, 2: { size } }`.
* `continue` skips the rest of the loop body; `col = end + 1` jumps past the run.

The test script of this series counts: **74 wall objects instead of 449**. Fewer objects means fewer colliders to test every physics step, fewer sprites to draw and a smaller scene. It is the same trick a real engine uses and calls *tile merging*. As an exercise, merge vertically too.

## 5 Check yourself

* Walk through the dungeon. The camera glides after you.
* In the top-left room the camera shows nothing left of or above the map.
* `stiffness` 0 in the Inspector: rigid camera. 2: a lazy cameraman.

![The start of part 3](assets/screenshots/series-dungeon-3-start.png)

## What you learned

* A camera is a GameObject; follow in `LateUpdate`.
* `1 − exp(−k·dt)` is frame-rate independent smoothing.
* `EventBus.Publish` / `Subscribe` decouples scripts.
* Merge neighbouring tiles into one object.

Next: [Part 4, coins and score](ex-dungeon-4-coins.html).

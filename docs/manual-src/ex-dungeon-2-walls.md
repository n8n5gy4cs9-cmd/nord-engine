---
title: 50 · Dungeon 2: Walls
section: Examples
order: 50
summary: Series part 2 of 6, Unity style. Build a level from a text map with Instantiate and prefabs, give the hero a Rigidbody2D and BoxCollider2D, and move it by velocity.
---
Part 2 of the Unity-style dungeon series. It continues from [part 1, a hero that moves](ex-dungeon-1-hero.html). Allow 30 minutes.

**What you will build:** a room with walls and obstacles that the hero cannot walk through, drawn from a text map you can edit like a drawing.

![The first level: walls, pillars and the hero](assets/screenshots/series-dungeon-2-walls.png)

**Download:** [Part 2 project](assets/downloads/series-dungeon-part2-source.zip), also in `examples/series-dungeon/part2`.

## 1 Describe the level as data

You could drag two hundred wall sprites into the scene; then you would drag them again for every change. Instead, make the level **text**. Create `scripts/map.js`:

```js
export const MAP = [
  '####################',
  '#P.......#.........#',
  '#.........#........#',
  '#....##...#...###..#',
  '#....##........#...#',
  '#..........##..#...#',
  '#...###....##......#',
  '#.....#............#',
  '#.....#....####....#',
  '#..................#',
  '####################',
];
```

`#` is a wall, `.` is floor and `P` is the hero's start. Twenty columns × eleven rows of 32-pixel tiles = 640 × 352 pixels. A script reads it and creates the objects, the way Unity developers use a *tilemap* or a level-loader script.

## 2 Prefabs

A **prefab** is a saved entity you create copies of. Make two:

* `prefabs/wall.prefab.json`: a sprite (the white `square.png`, tinted `#4c566a`, 32 × 32), a **static rigidbody**, a **box collider** 32 × 32, the tag `solid`. (Select the object ▸ @ui[right-click ▸ Create prefab].)
* `prefabs/floor.prefab.json`: one sprite, tinted `#2e3440`.

The square texture is plain white: **tint and size turn it into anything**, which is how you prototype a whole game without art.

> **Static vs dynamic.** A *static* rigidbody takes part in collisions but never moves (a wall). A *dynamic* one is moved by physics (our hero). In Unity: `Rigidbody2D` with Body Type Static / Dynamic.

## 3 The Level script

Create an empty entity `Level` with `scripts/level.js`:

```js
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
```

* `Instantiate(path, { pos, overrides })` is `Instantiate(prefab, position, rotation)`. It returns a **Promise** (loading a prefab can touch the network), so we `await` it.
* **Overrides** change fields of one instance: `components: { 0: { size: [w, h] } }` means "component 0 (the sprite) gets this size". The prefab file is not touched. In Unity that is a prefab *instance override*.
* An entity's position is its **centre**. The centre of the tile in column `col`, row `row` is `col * t + t / 2`. Forgetting the `t / 2` shifts the level half a tile.
* `this.Find('Hero')` is `GameObject.Find("Hero")`. We move the hero to the `P`.
* `async Start()` is fine: Nord runs it and carries on.

> **Delete the `Floor` entity from part 1**: the Level now creates its own.

## 4 A body for the hero

Walls only stop things that have a collider and a rigidbody. Select `Hero` and add with @ui[+ Add component]:

* **rigidbody**, mode `dynamic`;
* **collider**, shape `box`, size 24 × 24.

Writing `position` directly would teleport the hero through the walls, because it ignores physics. We set the **velocity**, exactly as in Unity (`rb.velocity = …`), and let the physics engine resolve collisions:

```js
import { MonoBehaviour, SerializeField, UnityInput as Input, Vector2 } from 'nord';

export default class Hero extends MonoBehaviour {
  static attributes = SerializeField({ speed: 160 });

  FixedUpdate() {
    const move = Vector2.ClampMagnitude(new Vector2(Input.GetAxis('Horizontal'), Input.GetAxis('Vertical')), 1);
    this.velocity = new Vector2(move.x, -move.y).Mul(this.speed);     // rb.velocity = ...: the physics engine moves us and stops us at walls
  }
}
```

* `FixedUpdate` runs 60 times per second, the physics step. A velocity is already "pixels per second": **no** `Time.deltaTime`.
* `this.velocity = new Vector2(…)` is `rb.velocity`. The y is negated because the screen's y points down.
* The project has no gravity, so a body with velocity 0 stays where it is.

Press @ui[Play] and walk into a wall: the hero stops, and slides along it if you keep pushing diagonally (physics removes the part of the motion that points into the wall).

![The hero stopped by the wall](assets/screenshots/series-dungeon-2-blocked.png)

## 5 Check yourself

* There is no way out of the room.
* Edit `map.js`, add a `#`, press Play: a new wall. Level design is typing.
* Count the objects in the Hierarchy while playing: one per `#`. A big level would create hundreds of colliders, which is why [part 3](ex-dungeon-3-camera.html) merges them.

If the hero walks through walls, it lacks the rigidbody or the collider.

## What you learned

* Describe levels as data; build them with `Instantiate` and prefabs.
* Overrides customise one instance.
* Static rigidbody + collider = wall; dynamic = something that bumps into it.
* Move physics bodies by `velocity` in `FixedUpdate`, not by `position`.

Next: [Part 3, camera and a bigger level](ex-dungeon-3-camera.html).

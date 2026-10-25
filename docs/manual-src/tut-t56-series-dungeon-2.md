---
title: T56 Nord Dungeon 2: Walls
section: Tutorials
order: 56
summary: Series part 2 of 6. Build a level from a text map, spawn wall entities from data, give the hero a physics body and let the engine stop it at walls.
---
This is part 2 of a series about a top-down dungeon game in native Nord scripting. It continues from [part 1, a hero that moves](tut-t55-series-dungeon-1.html). Allow 30 minutes.

**What you will build:** a room with walls and obstacles that the hero cannot walk through, drawn from a plain text map that you can edit like a drawing.

![The first level: walls, pillars and the hero](assets/screenshots/series-dungeon-2-walls.png)

**Download:** [Part 2 project](assets/downloads/series-dungeon-part2-source.zip), also in `examples/series-dungeon/part2`.

## 1 Why not place every wall by hand?

You could drag two hundred sprites into the scene. Then you would drag them again for every change. Dungeons are better described as **data**: a grid of characters where `#` is a wall and `.` is floor. A script reads the grid and creates the entities. This idea scales from this room to a game with fifty levels.

Create `scripts/map.js`. It is a normal JavaScript module that exports an array of strings:

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

Twenty columns and eleven rows of 32-pixel tiles are 640 × 352 pixels, nearly the whole screen. `P` marks where the hero starts. Everything not `#` is floor for now.

> **Can a script import another file?** Yes, with standard `import { MAP } from './map.js'`. The file is bundled into your export, so there is nothing extra to ship.

## 2 Creating entities from code

The scene file stores every entity as a plain object. `this.scene.spawnData(object)` takes the same shape and creates the entity while the game runs. It returns a Promise, so call it with `await`.

A wall is a sprite for looking at, a **static rigidbody** (it takes part in physics but never moves) and a **box collider** (its shape). Write a small function that returns that object:

```js
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
```

The sprite texture `square.png` is a plain white square. Setting `tint` and `size` turns it into a wall of any colour and size, so you can prototype a whole game without drawing anything.

## 3 The Level script

Create the `Level` entity (an empty one, at 0, 0) and `scripts/level.js`:

```js
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
```

Read the loops slowly:

* `start()` is `async` because we `await` each spawn. Nord is happy to run an async `start`.
* The centre of the tile in column `col` and row `row` is `col * t + t / 2`, `row * t + t / 2`. Entities are positioned by their **centre**, not their corner. Forgetting the `t / 2` shifts everything half a tile and is the usual off-by-half bug.
* The hero already exists in the scene. When we meet `P` we find it by name with `this.scene.find('Hero')` and move it. Assigning `pos` again with a whole new array, as in part 1.
* The floor is created first as one big sprite, with `z = -5` so it stays behind everything.

> **Do I need the floor from part 1 in the scene?** No. Delete the `Floor` entity: the Level now builds its own, sized to the map.

## 4 A body for the hero

Walls only block things that have a physics body. Select `Hero` and add two components with @ui[+ Add component]:

* **rigidbody**, mode `dynamic` (moved by physics),
* **collider**, shape `box`, size 24 × 24, the same as the sprite.

Because physics now moves the hero, change `hero.js`. Writing `entity.pos` directly would teleport through walls, because it ignores the physics engine. Instead we tell the physics engine **how fast** the hero should go and it resolves the collisions:

```js
import { NordScript } from 'nord';

export default class Hero extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 160, min: 0, label: 'Speed (px/s)' },
  };

  fixedUpdate() {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    this.physics.setVelocity(this.entity, x * this.attrs.speed, y * this.attrs.speed);   // the physics engine moves us and stops us at walls
  }
}
```

* `fixedUpdate` runs on the fixed 60 Hz step that physics uses, so physics and input stay in step. There is no `dt` multiplication: a **velocity** is already "pixels per second", and the physics engine does the `× dt` itself.
* `this.physics.setVelocity(entity, vx, vy)` sets the body's velocity.

The project's gravity is `[0, 0, 0]`, so a body with zero velocity stays put. (That is why part 1 changed the physics settings.)

Press **Play** and walk into a wall. The hero stops and slides along it if you keep pushing diagonally: the physics engine removes the part of the motion that points into the wall.

![The hero stopped by the wall](assets/screenshots/series-dungeon-2-blocked.png)

## 5 Check yourself

* Walk all around the room. There is no way to leave it.
* Edit `map.js`: add a `#` somewhere, press **Play** again. The wall appears. Level design is now typing.
* Count the entities in the @ui[Hierarchy] while playing: one per `#`. A level with 449 wall tiles would create 449 entities and 449 colliders. That works, but it is wasteful, and [part 3](tut-t57-series-dungeon-3.html) fixes it.

If the hero walks through a wall, the hero has no rigidbody or collider, or the wall's size is zero. Check both.

## What you learned

* Describe levels as data and build the entities from it.
* `scene.spawnData` creates an entity from the same object shape the scene file uses.
* Static rigidbody + collider = wall. Dynamic rigidbody + collider = something that bumps into walls.
* Move physics bodies by velocity in `fixedUpdate`, not by setting `pos`.

Next: [Part 3, camera and a bigger level](tut-t57-series-dungeon-3.html).

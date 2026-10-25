---
title: 46 · Pathfinding and NavMesh: moving around obstacles
section: Examples
order: 46
summary: Unity's NavMeshAgent mapped to Nord: grid A* (findPath), waypoint paths and simple steering, with a runnable agent script.
---

**Goal:** an enemy or unit that walks around walls to reach a target, the way a `NavMeshAgent` does in Unity.

Nord has **no baked NavMesh**. You pick the cheapest tool that fits your game:

| Situation | Use |
|---|---|
| Tile or grid game (top-down, tactics, roguelike) | **A\*** on the grid: `findPath` from the library script `ai-astar.js` |
| Fixed routes (tower defence creeps, patrols, trains) | a **path** component + the library script `ai-waypoints.js` |
| Open space with a few obstacles | steer straight at the target, see `ai-chase.js` |
| 3D level | pathfind on a coarse 2D grid of the floor (x/z) and move along the cells |

## Unity (C#)
```cs
NavMeshAgent agent;
void Start() { agent = GetComponent<NavMeshAgent>(); }
void Update() { if (Input.GetMouseButtonDown(0)) agent.SetDestination(clickPoint); }
```

## Nord: grid A*
1. @ui[Library] tab ▸ category *ai* ▸ *A\* pathfinding (grid)* ▸ insert. It copies `scripts/ai-astar.js` into your project.
2. Tag your wall objects `solid` (Inspector ▸ Tags) and put the script on the unit. Press @ui[Play] and click: the unit walks around the walls.

`findPath(blocked, start, goal, { w, h, diagonal })` is a plain function. It returns the cells from start to goal (inclusive) as `[[x, y], …]`, or `null` when no route exists. `blocked(x, y)` says whether a cell is impassable; the goal cell itself is always allowed, so you can path *to* an enemy standing in a cell.

Use it from your own script (`scripts/agent.js`):
```js
import { MonoBehaviour, SerializeField, Time } from 'nord';
import { findPath } from './ai-astar.js';

export default class Agent extends MonoBehaviour {
  static attributes = SerializeField({ tile: 16, speed: 90, gridW: 40, gridH: 23 });

  Start() {
    const t = this.tile;
    // walls: every object tagged "solid", turned into a set of "x,y" cells
    this.walls = new Set(this.scene.findByTag('solid').map((e) => `${Math.floor(e.pos[0] / t)},${Math.floor(e.pos[1] / t)}`));
    this.path = [];
    this.step = 0;
  }

  /** Like agent.SetDestination(worldX, worldY). Returns false when there is no route. */
  SetDestination(wx, wy) {
    const t = this.tile, p = this.entity.pos;
    const path = findPath((x, y) => this.walls.has(`${x},${y}`),
      [Math.floor(p[0] / t), Math.floor(p[1] / t)], [Math.floor(wx / t), Math.floor(wy / t)],
      { w: this.gridW, h: this.gridH, diagonal: false });
    if (!path) return false;
    this.path = path;
    this.step = 1;                       // cell 0 is where we already stand
    return true;
  }

  Update() {
    if (this.step >= this.path.length) return;
    const t = this.tile, [cx, cy] = this.path[this.step];
    const tx = (cx + 0.5) * t, ty = (cy + 0.5) * t;          // centre of the next cell
    const [x, y, z] = this.entity.pos;
    const d = Math.hypot(tx - x, ty - y), s = Math.min(d, this.speed * Time.deltaTime);
    this.entity.pos = [x + ((tx - x) / (d || 1)) * s, y + ((ty - y) / (d || 1)) * s, z];
    if (d <= s + 0.01 && ++this.step >= this.path.length) this.entity.emit('arrived');
  }
}
```
Call `SetDestination` from anywhere: `this.entity.getScript(Agent).SetDestination(player.pos[0], player.pos[1])`. Listen for the end with `entity.on('arrived', …)`.

## Chasing a moving target
Do not recompute every frame. Recompute twice a second, or when the target changed cell:
```js
Start() { this.every(0.5, () => { const p = this.scene.find('Player'); if (p) this.SetDestination(p.pos[0], p.pos[1]); }); }
```
`this.every(seconds, fn)` is the repeating timer from the [Time page](ex-time-coroutines.html).

## Nord: fixed routes
Add a **path** component (points, loop on or off) to any object and attach `ai-waypoints.js` to the mover. Modes `once`, `loop`, `pingpong`; it emits `pathEnd` when a `once` route finishes. This is how the [tower defence example](ex-genres.html) moves its creeps.

## Dynamic obstacles
The wall set is built once in `Start`. When a door opens or a block is destroyed, rebuild the set (or `delete` the cell) and call `SetDestination` again.

## Traps
* Grid cells are whole numbers: keep one `tile` size for the walls, the agent and the click conversion.
* Large grids cost time. A 64 x 64 grid is instant; 1000 x 1000 several times a second is not. Path only when needed and keep `w`/`h` as small as the map.
* `findPath` returns `null` for unreachable goals. Handle it (play a "no" sound, pick another goal) instead of assuming a path.
* Tagged objects far from the grid origin: subtract the map offset before dividing by `tile`.

Next: [Enemy AI](ex-ai-states.html). Back to [Examples](examples.html).

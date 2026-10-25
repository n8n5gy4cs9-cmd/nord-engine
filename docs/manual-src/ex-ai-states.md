---
title: 13 · Enemy AI and state machines
section: Examples
order: 13
summary: Patrol, chase, attack with a simple state machine, plus the ready-made AI scripts.
---

**Goal:** an enemy that patrols between two points, chases the player when close, and attacks when in range.

## Ready-made AI (library)
@ui[Library] tab ▸ category *ai*: `ai-patrol`, `ai-chase`, `ai-shooter`, `ai-boss`, `ai-flock`, `ai-fsm`, `ai-behaviour-tree`, `ai-astar` (pathfinding), `ai-waypoints`. Insert one on the selected object and set its attributes. Reading them is the best way to learn the patterns.

## Your own finite state machine
### Unity
```cs
enum State { Patrol, Chase, Attack }
State state = State.Patrol;
void Update() { switch (state) { case State.Patrol: Patrol(); break; /* … */ } }
```
### Nord

**File: `scripts/Enemy.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField } from 'nord';
import Health from './health.js';

const PATROL = 'patrol', CHASE = 'chase', ATTACK = 'attack';   // a "string enum"

export default class Enemy extends MonoBehaviour {
  static attributes = SerializeField({ speed: 80, sight: 220, reach: 36, damage: 5, patrolDistance: 150 });

  Awake() { this.state = PATROL; this.dir = 1; this.cool = 0; }
  Start() { this.player = this.FindWithTag('player'); this.home = this.entity.pos[0]; }

  FixedUpdate() {
    const p = this.player;
    if (!p || p.destroyed) return;
    const dx = p.pos[0] - this.entity.pos[0], dy = p.pos[1] - this.entity.pos[1], dist = Math.hypot(dx, dy);

    // 1. decide the state
    if (dist <= this.reach) this.SetState(ATTACK);
    else if (dist <= this.sight) this.SetState(CHASE);
    else this.SetState(PATROL);

    // 2. act in the state
    switch (this.state) {
      case PATROL: this.Patrol(); break;
      case CHASE:  this.physics.setVelocity(this.entity, (dx / dist) * this.speed * 1.4, (dy / dist) * this.speed * 1.4); break;
      case ATTACK: this.physics.setVelocity(this.entity, 0, 0); this.Attack(p); break;
    }
  }

  SetState(s) { if (s === this.state) return; const prev = this.state; this.state = s; this.entity.emit('state', { state: s, prev }); }

  Patrol() {
    if (Math.abs(this.entity.pos[0] - this.home) > this.patrolDistance) this.dir = -Math.sign(this.entity.pos[0] - this.home);
    this.physics.setVelocity(this.entity, this.dir * this.speed, 0);
  }

  Attack(p) {
    this.cool -= 1 / 60;                                       // FixedUpdate runs at 60 Hz
    if (this.cool <= 0) { p.getScript(Health)?.takeDamage(this.damage); this.cool = 1; }
  }
}
```
Other scripts can listen: `enemy.on('state', ({ state }) => this.exclamationMark.enabled = state === 'chase')`.

## Why a state machine
Each state is one small function, and the "decide" part is the only place that changes states. Add states (`flee`, `stunned`) by adding a constant, a branch in the decision, and a case in the `switch`.

## Patrol along waypoints

**File: `scripts/Patrol.js`** (`Start()` collects the points; add the movement to `FixedUpdate()`)
```js
Start() { this.points = this.scene.findByTag('waypoint').map((e) => [...e.pos]); this.i = 0; }
FixedUpdate() {
  const t = this.points[this.i], p = this.entity.pos, dx = t[0] - p[0], dy = t[1] - p[1], d = Math.hypot(dx, dy);
  if (d < 6) this.i = (this.i + 1) % this.points.length;
  else this.physics.setVelocity(this.entity, (dx / d) * 80, (dy / d) * 80);
}
```
Mark waypoints with a `waypoint` tag (empty objects with a marker sprite).

## Line of sight (3D) and vision cones

**File: your script, for example `scripts/Guard3D.js`** (inside a method, called every frame while checking for the player)
```js
const hit = this.physics.raycast(this.entity.worldPos, this.player.worldPos, { ignore: this.entity });
const canSee = hit && hit.entity === this.player;
```

## Pathfinding on a grid
Library `ai-astar.js` exports `findPath(blocked, start, goal, opts)`; see its header for the call. Good for tile-based games.

## Behaviour trees
The library `ai-behaviour-tree.js` and the **Graph** editor can express the same logic visually; code stays the simplest for small enemies.

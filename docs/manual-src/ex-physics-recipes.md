---
title: 31 · Physics recipes
section: Examples
order: 31
summary: Gravity, forces and impulses, bounce and friction, moving platforms, one-way platforms, ladders, knockback, explosions, pushing crates, raycasts.
---

## The knobs
| Unity (2D) | Nord |
|---|---|
| Project Settings ▸ Physics 2D ▸ Gravity | `nord.project.json` ▸ `physics.gravity` (`[0, 900, 0]` px/s²; 3D `[0, -9.81, 0]`); at runtime `this.physics.setGravity(0, 400)` |
| `Rigidbody2D` Body Type Dynamic / Kinematic / Static | `rigidbody` `mode`: `dynamic`, `kinematic`, `static`; **no rigidbody** + a collider = static |
| Mass, Drag, Gravity Scale | `mass`, `drag`, `gravityScale` fields of `rigidbody` |
| Collider2D / Is Trigger | `collider` / `trigger` component (or `trigger` ticked on a collider) |
| Physics Material (bounce, friction) | rigidbody `bounce` (0..1) and `drag`; bouncy things: library `physics-bounce-pad.js` |

## Move, push and stop
```js
this.physics.setVelocity(this.entity, vx, vy);        // null = keep that axis
const [vx, vy] = this.physics.velocity(this.entity);  // read the speed
this.physics.applyImpulse(this.entity, ix, iy);       // instant push (divided by mass)
this.physics.teleport(this.entity, x, y);             // move without keeping speed
this.physics.enable(this.entity, false);              // switch the body off / on (e.g. while carried)
```
Unity: `rb.velocity`, `rb.AddForce(v, ForceMode2D.Impulse)`, `rb.position = p`. There is **no continuous AddForce**: for a steady push, set the velocity every `fixedUpdate`, or add a small impulse each step.

## Jump height from physics
With gravity `g` (px/s²) and a jump speed `v`, the jump is `v² / (2g)` high. For a 120 px jump at g = 1500: `v = Math.sqrt(2 * 1500 * 120)` ≈ 600. ([Jump Dash](ex-platformer.html) uses this.)

## Knockback and explosions
```js
// push everything near a point away from it
explode(x, y, radius, power) {
  for (const e of this.physics.overlapBox(x, y, radius * 2, radius * 2)) {
    if (!e.pos || e.tile) continue;                         // ignore tile markers
    const dx = e.pos[0] - x, dy = e.pos[1] - y, d = Math.hypot(dx, dy) || 1;
    this.physics.applyImpulse(e, (dx / d) * power, (dy / d) * power);
    e.emit('damage', { amount: Math.round(3 * (1 - Math.min(1, d / radius))) });
  }
}
```

## Moving platform
A **kinematic** rigidbody moved with velocity; the player standing on it must be carried:
```js
fixedUpdate() {
  const t = this.game.time.elapsed;
  this.physics.setVelocity(this.entity, Math.cos(t) * 80, 0);          // slides left and right
}
```
Library: `physics-moving-platform.js` (carries riders, waypoints). A cheap carry: in the platform script remember `dx` each step and add it to riders standing on it (`overlapBox` above the platform).

## One-way platforms and ladders
Library `physics-one-way.js` (jump up through, stand on top, press down to drop). Ladders: a trigger zone; while the player is inside and presses up, switch the player's `gravityScale` to 0 and set `vy`:
```js
// ladder.js on a trigger; player has a script with a field climbing = false
onTriggerEnter(o) { if (o.hasTag('player')) o.vars.onLadder = true; }
onTriggerExit(o)  { if (o.hasTag('player')) o.vars.onLadder = false; }
// player fixedUpdate:
if (this.entity.vars.onLadder && this.input.axis('down', 'up') !== 0) this.physics.setVelocity(this.entity, null, -this.input.axis('down', 'up') * 120);
```
`entity.vars` is a free object stored per entity (event sheets read it too).

## Push and carry
Dynamic crates with a collider simply get pushed by a moving player body. For pick-up and carry use `physics-pickup-carry.js`; for a rope or spring use matter physics (`physics.engine: "matter"`) which supports constraints.

## Conveyor, bounce pad, magnet
Library: `physics-conveyor.js`, `physics-bounce-pad.js`, `physics-magnet.js`, `physics-drag.js` (mouse dragging), `physics-door.js`, `physics-projectile.js`, `physics-crate.js`, `physics-explosion.js`, `physics-knockback.js`. Open them to see how short they are.

## Raycasts and queries
```js
const hits = this.physics.overlapBox(x, y, w, h);                      // 2D area query (entities, plus { tile: true } for solid tiles)
const hit = this.physics.raycast(fromXYZ, toXYZ, { ignore: this.entity });   // 3D: { entity, point, normal, distance }
const onGround = this.physics.isGrounded(this.entity);
```
2D line-of-sight: step along the line with `overlapBox` samples (every 16 px) and stop at the first `{ tile: true }` or `solid`-tagged entity.

## 2D physics engines
`arcade` (default, fast boxes and circles, great for platformers and top-down), `matter` (rotation, polygons, joints, stacking: physics puzzles). Same script API; set in `nord.project.json` ▸ `physics.engine`. 3D uses Havok.

## Layers and collision rules
Use **tags** and decide in the event (`other.hasTag('enemy')`). To make two bodies pass through each other, make one a trigger. To toggle collisions at runtime: `this.physics.enable(entity, false)` (e.g. a dash that ignores enemies).

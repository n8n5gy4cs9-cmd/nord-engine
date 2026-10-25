---
title: Physics
section: Manual
order: 7
summary: 2D arcade/matter, 3D Havok, bodies, triggers, raycasts.
---

Physics makes objects fall, collide and react to pushes. Choose the system for your project, then give objects bodies and collision shapes.

::: dummies
The body controls motion. The collider describes the shape that touches other things. A trigger detects an overlap without blocking movement. Start with a falling object and a floor.
:::

**In the editor:** @ui[Project] tab ▸ **Project properties** ▸ **Physics** (pick `arcade`, `matter` or, for 3D, `havok`) and **gravity Y**, then **Apply project properties**.

**In the file** `nord.project.json`:
```json
"physics": { "engine": "arcade", "gravity": [0, 900, 0] }
```
`arcade` (default for 2D; fast, AABB), `matter` (2D; rotation, polygons, constraints), `havok` (3D; automatic for `3d`). 3D gravity default is `[0, -9.81, 0]` (m/s²); 2D gravity is px/s².
The backend is stepped from the **fixed 60 Hz loop**, in lock-step with `fixedUpdate`.

::: dummies
Physics = the rules of the world: things fall, bump, and stop. Give an entity a **rigidbody** to say "obey the rules" and a **collider** to say "this is my shape".
Static bodies (floors, walls) never move. Dynamic bodies move. Kinematic bodies are moved by *you*.
:::

## Setting up a body

**In the editor:** select the object, @ui[Inspector ▸ + Add component ▸ rigidbody] (choose **mode** static, dynamic or kinematic, set **mass** and **drag**), then @ui[Inspector ▸ + Add component ▸ collider] (pick the **shape**, set the **size**).

**In the file** the entity's `components` list in the scene (the Inspector writes it):
```json
{ "type": "rigidbody", "mode": "dynamic", "mass": 1, "drag": 0.1 },
{ "type": "collider", "shape": "box", "size": [16, 24] }
```
No collider size → taken from the sprite/mesh bounds. A body without a rigidbody is static. Details: [rigidbody](component-rigidbody.html), [collider](component-collider.html), [trigger](component-trigger.html).

## Moving things

**File: your script, for example `scripts/Player.js`** (the `fixedUpdate()` method of the class)
```js
fixedUpdate() {
  const dir = this.input.axis('left', 'right');
  this.physics.setVelocity(this.entity, dir * this.attrs.speed, null);      // 2D: null keeps vy
  if (this.input.pressed('jump') && this.physics.isGrounded(this.entity))
    this.physics.setVelocity(this.entity, null, -this.attrs.jump);
}
```
Assigning `entity.pos` teleports the body (velocity is zeroed). Rotating a 3D body keeps its velocity so yaw/steering works.

## Events
`onCollisionEnter(other, contact)`, `onCollisionExit(other)`, `onTriggerEnter(other)`, `onTriggerExit(other)`. Entities also emit `collisionEnter`, `triggerEnter`… on their entity bus.
In 3D, `contact` is `{ point, normal, impulse }`.

## Queries
* 2D: `physics.overlapBox(x, y, w, h)` → entities (and `{tile:true}` markers for solid tiles).
* 3D: `physics.raycast(from, to, { ignore })` → `{ entity, point, normal, distance }`.
* `isGrounded(entity)` for both.

## Recipes (library)
`physics-moving-platform`, `physics-one-way`, `physics-bounce-pad`, `physics-conveyor`, `physics-crate`, `physics-door`, `physics-drag`, `physics-explosion`, `physics-knockback`, `physics-magnet`, `physics-projectile`, `physics-rope`, `physics-buoyancy`, `physics-trigger-zone`… see the [catalog](library-catalog.html#physics).

::: warn
In 3D, Havok `isGrounded`/`raycast` with `ignore` only skips the first hit (Havok returns the closest hit), and script-set transforms zero a dynamic body's velocity (rotation does not). Havok needs its `.wasm` served as `application/wasm` (see [Hosting](export.html#hosting)).
:::

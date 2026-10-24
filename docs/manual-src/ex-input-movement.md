---
title: 2 · Input and movement
section: Examples
order: 2
summary: Keyboard, axes and actions; move by position or by physics; 2D and 3D.
---

**Goal:** move an object with WASD / arrows, in 2D and in 3D.

## Actions (the recommended way)
Input *actions* are named buttons you define once in `nord.project.json` and rebind in one place:
```json
"input": { "actions": {
  "left":  ["KeyA", "ArrowLeft"],  "right": ["KeyD", "ArrowRight"],
  "up":    ["KeyW", "ArrowUp"],    "down":  ["KeyS", "ArrowDown"],
  "jump":  ["Space", "Gamepad0"],  "fire":  ["Mouse0"]
} }
```
(Key names are `KeyboardEvent.code` values: `KeyA`, `Space`, `Enter`, `ShiftLeft`, `ArrowUp`, `Mouse0`, `Gamepad0`…)

### Unity
```cs
float h = Input.GetAxisRaw("Horizontal");
if (Input.GetButtonDown("Jump")) Jump();
```
### Nord
```js
update(dt) {
  const h = this.input.axis('left', 'right');        // -1, 0 or 1
  const [x, y] = this.input.vec('left', 'right', 'up', 'down'); // normalised, gamepad stick aware
  if (this.input.pressed('jump')) this.jump();       // true on the frame it went down
  if (this.input.down('fire')) this.shoot();         // true while held
  if (this.input.released('fire')) this.stopShooting();
}
```

## Unity names, if you prefer them
```js
import { MonoBehaviour, UnityInput as Input, Time } from 'nord';

export default class Mover extends MonoBehaviour {
  Update() {
    const h = Input.GetAxis('Horizontal');          // A/D and arrows, also gamepad stick
    const v = Input.GetAxis('Vertical');            // W / Up = +1
    this.Translate(h * 200 * Time.deltaTime, -v * 200 * Time.deltaTime); // 2D: y points DOWN on screen
    if (Input.GetKeyDown('Space')) this.Jump();
    if (Input.GetMouseButtonDown(0)) this.Shoot();
  }
}
```

## 2D: move by position
```js
import { NordScript } from 'nord';
export default class Walker extends NordScript {
  static attributes = { speed: { type: 'number', default: 220 } };
  update(dt) {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    const p = this.entity.pos;
    this.entity.pos = [p[0] + x * this.attrs.speed * dt, p[1] + y * this.attrs.speed * dt, p[2]];
  }
}
```
Position is `[x, y, z]`; in **2D** units are pixels and **y grows downward**, `z` is draw order. Assigning `entity.pos` teleports (and stops a physics body).

## 2D: move with physics (collides with walls)
The object needs a **rigidbody** and a **collider** (Inspector ▸ + Add component).
```js
fixedUpdate() {
  const x = this.input.axis('left', 'right');
  this.physics.setVelocity(this.entity, x * this.attrs.speed, null);   // null = keep the current y
  if (this.input.pressed('jump') && this.physics.isGrounded(this.entity))
    this.physics.setVelocity(this.entity, null, -this.attrs.jump);     // up is negative y
}
```
Unity: `rb.velocity = new Vector2(x * speed, rb.velocity.y);`. Gravity is in `nord.project.json` ▸ `physics.gravity`; for a top-down game set it to `[0, 0, 0]` and give the rigidbody `gravityScale` 0.

## 3D: move on the ground
3D worlds use **y up**. Project type `3d`, a `model` or `mesh` component, a `rigidbody` + `collider`:
```js
fixedUpdate() {
  const [x, z] = this.input.vec('left', 'right', 'up', 'down'); // up key => z = -1 (forward)
  this.physics.setVelocity(this.entity, x * 6, null, z * 6);    // 3D: (entity, vx, vy, vz); null keeps vy
}
```

## Pointer / mouse
```js
update() {
  const p = this.input.pointer;         // { x, y (screen), worldX, worldY, down }
  if (this.input.pressed('fire')) this.scene.spawn('prefabs/shot.prefab.json', { pos: [p.worldX, p.worldY, 5] });
}
```

## Touch and gamepad
Gamepad buttons are `Gamepad0…`, the left stick works through `vec(...)` and `GetAxis`. Touch: add the *virtual joystick* from the library (`ui-joystick`), or map on-screen buttons to actions.

::: warn
`input.pressed()` is **true for one frame**. Check it in `update`, not in `fixedUpdate` (which can run twice or zero times per frame).
:::

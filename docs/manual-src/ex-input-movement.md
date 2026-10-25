---
title: 2 · Input and movement
section: Examples
order: 2
summary: Keyboard, axes and actions; move by position or by physics; 2D and 3D.
---

**Goal:** move an object with WASD / arrows, in 2D and in 3D.

## Actions (the recommended way)
Input *actions* are named buttons you define once and rebind in one place (Unity's Input Manager).

**In the editor:** @ui[Project] tab ▸ unfold **Input Manager (actions and keys)**. Click **＋ key** next to an action and press the key you want; type a name and press **Add action** to make a new one ([the full steps](ex-input-editor.html)). A new project already has `left`, `right`, `up`, `down`, `jump` and `fire`.

**In the file** `nord.project.json`, the editor stores them under `input.actions` (check it or edit it as text):
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

**File: your script, for example `scripts/Mover.js`** (the `update(dt)` method)
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

**File: `scripts/Mover.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, UnityInput as Input, Time } from 'nord';

export default class Mover extends MonoBehaviour {
  static attributes = SerializeField({ speed: 5 });   // 3D: metres per second. For a 2D project use about 200 (pixels)
  Update() {
    const h = Input.GetAxis('Horizontal');            // A/D and arrows, also gamepad stick
    const v = Input.GetAxis('Vertical');              // W / Up = +1
    // 3D: x = right, z = forward. 2D: use this.Translate(h * s, -v * s) because y points DOWN on screen
    this.Translate(h * this.speed * Time.deltaTime, 0, v * this.speed * Time.deltaTime);
    if (Input.GetKeyDown('Space')) this.Debug_Jump();
  }
  Debug_Jump() { this.Translate(0, 1, 0); }          // replace with your own Jump()/Shoot() methods: they do not exist by default
}
```
@bad[Trap:] `Jump()` and `Shoot()` are not built in; calling a method you did not write throws `this.Jump is not a function`. Also pick speeds for the project type: 3D units are metres (`5`), 2D units are pixels (`200`). A 2D speed in a 3D scene flies off screen.

## 2D: move by position

**File: `scripts/Mover.js`** (new file, the whole file, for the native style)
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

**File: `scripts/Mover.js`** (replace `update` with this `fixedUpdate` method; the object needs the rigidbody and collider)
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

**File: `scripts/Walker3D.js`** (the `fixedUpdate` method of a 3D script)
```js
fixedUpdate() {
  const [x, z] = this.input.vec('left', 'right', 'up', 'down'); // up key => z = -1 (forward)
  this.physics.setVelocity(this.entity, x * 6, null, z * 6);    // 3D: (entity, vx, vy, vz); null keeps vy
}
```

## Pointer / mouse

**File: your script, for example `scripts/Cursor.js`** (the `update` method)
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

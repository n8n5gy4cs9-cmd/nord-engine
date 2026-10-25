---
title: 15 · Camera, 3D and effects
section: Examples
order: 15
summary: Follow cameras, screen shake and flashes, a 3D scene with a model, lights and a third-person character.
---

## 2D camera
The scene's @api[camera] entity has `follow` (name of the object), `lerp` (smoothing 0..1), `deadzone`, `zoom`. For a Cinemachine-like follow use the library script `camera-follow.js` (look-ahead, bounds). By hand:
```js
import { NordScript } from 'nord';
export default class FollowCam extends NordScript {
  static attributes = { target: { type: 'entity' }, smooth: { type: 'number', default: 6 } };
  start() { this.t = this.scene.find(this.attrs.target); }
  lateUpdate(dt) {                       // after the target moved this frame
    if (!this.t || this.t.destroyed) return;
    const p = this.entity.pos, k = Math.min(1, this.attrs.smooth * dt);
    this.entity.pos = [p[0] + (this.t.pos[0] - p[0]) * k, p[1] + (this.t.pos[1] - p[1]) * k, p[2]];
  }
}
```
Put it on the Camera entity and set `target` to `Player`.

## Screen effects (juice)

**File: your script, for example `scripts/Player3D.js`** (inside the method that handles damage or an explosion)
```js
this.game.camera.shake(200, 0.01);            // duration ms, intensity
this.game.camera.flash(120, '#ffffff');
this.game.camera.fade(400, '#000000');        // fade out; fadeIn(400) to come back
this.game.camera.zoom?.(1.2);
```
Hit-stop: library `fx-hitstop.js`. Slow motion: `Time.timeScale = 0.2` for a moment (`this.after` follows the scale, use real timers if you need real time).

## 3D: build a scene
1. New project: `nord new world -t 3d`. 3D uses **y up**, units are metres.
2. Add objects: @ui[Hierarchy ▸ + Create ▸ 3D]: a `mesh` (box, sphere…) or drag a `.glb` from Assets (becomes a `model` component).
3. Add a `light` (directional = sun, `castShadows` on) and a `camera`.

### Unity to Nord components (3D)
| Unity | Nord component |
|---|---|
| MeshRenderer + MeshFilter | `mesh` (primitive shapes) or `model` (a .glb file) |
| Material | `material` component or a shared `*.mat.json` asset |
| Light | `light` (`kind`: point, directional, spot, hemispheric) |
| Camera | `camera` (`type`: free / follow / arcRotate) |
| Rigidbody + Collider | `rigidbody` + `collider` (Havok physics) |
| Skybox, post-processing | `skybox`, `postProcess` |
| Animator (3D clips) | `model.play('Walk')` or the Animator editor |

## Move and turn a character in 3D

**File: `scripts/Walker.js`** (new file, the whole file)
```js
import { NordScript } from 'nord';
export default class Character extends NordScript {
  static attributes = { speed: { type: 'number', default: 6 }, turn: { type: 'number', default: 10 } };
  fixedUpdate(dt) {
    const [x, z] = this.input.vec('left', 'right', 'up', 'down');    // forward key => z = -1
    this.physics.setVelocity(this.entity, x * this.attrs.speed, null, z * this.attrs.speed);
    if (x || z) {                                                    // face the movement direction (yaw in degrees)
      const target = Math.atan2(x, z) * 180 / Math.PI + 180;
      const r = this.entity.rot, d = ((target - r[1] + 540) % 360) - 180;
      this.entity.rot = [r[0], r[1] + d * Math.min(1, this.attrs.turn * dt), r[2]];
    }
    const clip = x || z ? 'Walk' : 'Idle';                           // clip names come from the .glb
    if (clip !== this.clip) { this.clip = clip; this.entity.getComponent('model')?.play(clip, { loop: true }); }   // only when it changes
  }
}
```
Rotation values are **degrees**. Use the `model` component's `animation` field in the Inspector for a default clip, and `entity.getComponent('model')` to read what the file offers.

## Third-person camera
The library has `third-person3d.js`, `orbit-cam.js`, `fps3d.js`, `fly-cam.js`, `rts-cam.js`: insert one on the camera entity and set `target`. Or a child camera: make the Camera a **child** of the character at `[0, 2, 5]`; it follows automatically.

## Light, shadows and mood

**File: `scripts/Daylight.js`** (inside `Start()` of a script on any object; `Sun` is the name of your directional light)
```js
const sun = this.scene.find('Sun');
sun.set('light', 'intensity', 0.4);                 // change a component field at runtime
this.tween({ i: 1 }, { i: 0.2 }, { duration: 4, onUpdate: (o) => sun.set('light', 'intensity', o.i) });   // sunset
```

## Raycast from the camera / click picking

**File: your script, for example `scripts/Picker.js`** (inside `Update()` on the camera object)
```js
const hit = this.physics.raycast(this.entity.worldPos, [fx, fy, fz]);   // from, to
if (hit) hit.entity.emit('clicked');
```
Library `interact-ray.js` does "look at it and press E" for you.

## Make your own 3D model
Use the 3D Modeler: [3D Modeler](modeler.html) and tutorials T49 / T54; it saves `models/x.glb` for a `model` component.

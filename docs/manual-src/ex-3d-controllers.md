---
title: 34 · 3D: controllers, cameras, vehicles and interaction
section: Examples
order: 34
summary: First-person, third-person, platformer and vehicle controllers from the library, click-to-move, interaction rays, lights and materials.
---

Most 3D games start from one of these ready-made controllers. Insert the script from the **Library** tab onto the player (or camera) and tune its attributes in the Inspector; open the file to learn how it works (they are short).

| Unity | Nord library script |
|---|---|
| FPS Controller (CharacterController + mouse look) | `fps3d.js` (+ `mouse-capture.js` for pointer lock) |
| Third-person (Cinemachine FreeLook) | `third-person3d.js`, `orbit-cam.js`, `camera-follow3d.js` |
| 3D platformer | `platformer3d.js` |
| Car / vehicle | `vehicle3d.js` (2D: `car2d.js`), tank: `tank.js` |
| Space / flying | `spaceship6dof.js`, `fly-cam.js`, `swim-fly.js` |
| RTS camera and click-to-move | `rts-cam.js`, `click-move3d.js` |
| Rolling ball | `marble3d.js` |
| Look-at-and-press-E | `interact-ray.js` |
| Hitscan weapon | `physics-hitscan.js` |

Templates to copy: `platformer-3d`, `fps-arena`, `racing`, `tank-patrol`. Example projects: `examples/fps-arena`, `examples/platformer3d`, `examples/automies` (a 3D driving game).

## A minimal first-person player
Project type `3d`. Player object with `rigidbody` (mode dynamic) + `collider` (capsule), the camera as a **child** at `[0, 1.6, 0]`, and the library `fps3d.js` on the player: WASD to move, the mouse to look (click the game once to capture the pointer), Space to jump. Attributes: `speed`, `jump`, `sensitivity`.

## Look-at-and-press-E
Add the library `interact-ray.js` to the player (or camera). It casts a ray from the camera, shows a prompt and, on the `interact` action (bind `"interact": ["KeyE"]`), emits an event on the object it looks at. The objects only listen:
```js
// a door
start() { this.entity.on('interact', () => { this.entity.enabled = false; }); }      // open: hide it (or play an animation, or load a scene)
// a pick-up
start() { this.entity.on('interact', () => { GameManager.instance.AddScore(1); this.entity.destroy(); }); }
```
Doing the ray yourself: `this.physics.raycast(fromXYZ, toXYZ, { ignore: this.entity })` returns `{ entity, point, normal, distance }` ([Collisions](ex-collisions.html)); `from` is the camera's `worldPos`, `to` a point in front of it.

## Lights, shadows, sky
* `light` component: `kind` directional (sun), point, spot, hemispheric (ambient); `castShadows` on a directional / spot light turns shadows on for objects whose `mesh`/`model` has `shadow` on.
* `skybox` component (`assets/skybox/day`, `sunset`, `night` ship with the engine), `postProcess` (bloom, fxaa, vignette, tonemap, grain).
* Time of day: library `proc-daynight.js`; weather `proc-weather.js`; fog `proc-fog.js`.
```js
this.scene.find('Sun').set('light', 'intensity', 0.6);                    // change at runtime
this.scene.find('Sun').rot = [50, t * 20, 0];                              // rotate the sun for a day cycle (degrees)
```

## Materials and shaders
`material` component or a shared `*.mat.json` (colour, metallic, roughness, texture, normal map, emissive, alpha, uv scale, double-sided, unlit) set in the Inspector (with a lit preview). Custom shader snippets in `library/shaders/` (outline, toon, dissolve, water, hologram, fresnel rim, triplanar, scroll uv, wind sway, CRT) with usage notes in the Library tab.

## Models and animation
Import `.glb` into `assets/` or `models/`; drag onto the Scene. Animations: `entity.getComponent('model').play('Walk')` or an Animator controller ([Animation](ex-animation.html)). Make or fix props yourself in the [3D Modeler](modeler.html).

## 2.5D and mixed
A 3D project can use sprites; a 2D project cannot use meshes. For a 2.5D side-scroller use a 3D project, `platformer3d.js` and lock movement to two axes.

## Performance in 3D
Reuse models and materials (instancing is automatic), one shadow-casting light, small textures, `postProcess` sparingly, pool bullets. See [Performance](performance.html) and [Optimising and testing](ex-optimization-testing.html).

# Behaviors (M10) — Construct-style, additive to scripts

An entity can carry behaviors next to its scripts and components (scene/prefab JSON):
```json
"behaviors": [ { "type": "Platform", "properties": { "maxSpeed": 330, "doubleJump": true } }, { "type": "Solid", "enabled": false } ]
```
Code: `runtime/core/behaviors/` (`index.js` framework, `builtin.js` behaviors, `util.js` geometry). Tests: `node --test runtime/core/behaviors.test.mjs`.
Behaviors tick after scripts' `update` each frame. From JS: `entity.behavior('Platform').vx`, `entity.addBehavior('Sine', {period: 2})`.

**Collision model**: bounding box = the entity's `collider` component `size` × scale, centred on its position (default 32×32). Y points down.

| Behavior | Properties (defaults) | Notes |
|---|---|---|
| Solid / Jumpthru | — | blocks movement / one-way platform (only from above) |
| Platform | maxSpeed 330, acceleration 1500, deceleration 1500, jumpStrength 650, gravity 1500, maxFallSpeed 1000, doubleJump, defaultControls | controls: project input actions `left/right/jump` if defined, else arrows/WASD/Space. Triggers: On jump, On landed, On hit ceiling |
| EightDirection | maxSpeed 200, acceleration 600, deceleration 500, directions 4/8, defaultControls, setAngle | stops at Solids |
| Bullet | speed 400, acceleration, gravity, bounceOffSolids, setAngle | flies along the entity's angle |
| Sine | movement (horizontal/vertical/size/width/height/angle/opacity/value-only), wave, period 4, magnitude 50, phase | |
| Fade | fadeInTime 0, waitTime 0, fadeOutTime 1, destroyOnFadeOut | sets sprite alpha |
| Wrap, BoundToLayout, DestroyOutsideLayout | margin | layout size = `scene.settings.layoutSize` or project display size |

Every behavior also has *Enabled* condition/action. Event-sheet use: nodes carry `"behavior": "Platform"`, e.g. action `{object:"Hero", behavior:"Platform", id:"simulate-control", params:{control:"jump"}}`,
expression `Hero.Platform.VectorY`, trigger `{object:"Hero", behavior:"Platform", id:"on-jump"}`.

## Writing a behavior
```js
import { Behavior, registerBehavior } from 'nord';
class Spin extends Behavior { static attributes = { speed: { type: 'number', default: 90 } }; tick(dt) { this.entity.rot[2] += this.props.speed * dt; this.entity.touch(); } }
registerBehavior('Spin', Spin, { actions: { 'set-speed': { params: ['value'], run: (b, p) => { b.props.speed = p.value; } } }, expressions: { Speed: (b) => b.props.speed } });
```
Next (M10-10/11): Pin, Drag&Drop, Anchor, Car, Orbit, Rotate, Flash, Timer, Tween, Turret, Line of Sight, Pathfinding, Physics, Scroll-To, Persist.

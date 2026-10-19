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

## Set B (M10-10)
| Behavior | Properties (defaults) | Notes |
|---|---|---|
| Pin | — | action *Pin to object* (`position` or `position-angle`), *Unpin* |
| DragDrop | axes both/horizontal/vertical | mouse/touch drag over the collider; triggers On drag start / On drop |
| Anchor | left/right/top/bottom | keeps distance to the layout/view edges |
| Car | maxSpeed 200, acceleration 100, deceleration 50, steerSpeed 120, driftRecover 5 | top-down; stops at Solids |
| Orbit | speed 90, acceleration, primaryRadius 100, secondaryRadius 100, offsetAngle, matchRotation | orbits the start-derived centre (or *Set center*) |
| Rotate | speed 180, acceleration | |
| Flash | — | action *Flash on/off/duration*; trigger On flash ended |
| Timer | — | named timers `once`/`regular`; trigger On timer(tag); expressions `CurrentTime(tag)`, `TotalTime(tag)`, `Duration(tag)` |
| Tween | — | tween x, y, angle, width, height, size, opacity with any `ease` name; trigger On tween finished(tag) |
| Turret | targetType, range 300, rotateSpeed 180, rateOfFire 2, autoShoot, requireLineOfSight | triggers On shoot / On target acquired — create bullets in the sheet |
| LineOfSight | range 300, coneOfView 360, obstacleType Solid | condition *has line of sight to* picks the visible instances |
| Pathfinding | cellSize 32, diagonals, maxSpeed 200, obstacleType Solid | grid A*; *Find path*, triggers On path found / failed / arrived; `NodeX(i)`, `PathNodeCount` |
| Physics | immovable, mass, friction, bounce, gravityScale | thin wrapper that adds `rigidbody`+`collider` and exposes impulses/velocity |
| ScrollTo | lerp 1 | follows the entity with the scene camera |
| Persist | — | entity survives `loadScene` (replaces the same-name copy in the next scene) |

Also: **families** (`scene.settings.families`), **containers** (`scene.settings.containers`) and instance variables (`"vars"`), documented in the manual → Event sheets.
Demo game using almost all of them: `examples/event-sheets` (`node tools/gen_eventsheet_demo.mjs`, test `node tools/eventsheet-demo-test.mjs`). Manual: *Behaviors*, *Event sheets*, tutorial **T24**, generated *Event sheet reference*.

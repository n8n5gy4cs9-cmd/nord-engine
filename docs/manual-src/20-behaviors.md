---
title: Behaviors
section: Manual
order: 20
summary: Attach ready-made movement and gameplay (Platform, 8-Direction, Bullet, Sine, Turret, Pathfinding…) to any entity.
---

A **behavior** is a small bundle of ready-made logic you attach to an entity, like Construct's behaviors. They work from the scene file, from JavaScript, and from event sheets.

<figure class="shot"><img src="assets/screenshots/es-3-ledge.png" alt="The hero jumping onto a ledge, driven by the Platform behavior" loading="lazy"><figcaption>The hero is one entity with the <b>Platform</b> behavior. Slimes patrol with <b>Sine</b>, the star spins with <b>Rotate</b> and can be moved with <b>DragDrop</b>, the corner robot is a <b>Turret</b>.</figcaption></figure>

::: dummies
Instead of writing "if the key is down, add speed; if there is a wall, stop; add gravity…", you attach **Platform** and set `maxSpeed` and `jumpStrength`. The behavior does the rest every frame.
:::

## Attach one
In the scene JSON:
```json
{ "name": "Hero", "components": [ { "type": "collider", "shape": "box", "size": [14, 28] } ],
  "behaviors": [ { "type": "Platform", "properties": { "maxSpeed": 220, "doubleJump": true } } ] }
```
From JavaScript: `entity.addBehavior('Sine', { period: 2 })` and `entity.behavior('Platform').vx`.

Collisions use the entity's **collider** box (size × scale, centred on its position). Make walls and floors with the **Solid** behavior, one-way platforms with **Jumpthru**. Y points down.

## The behaviors
| Group | Behaviors |
|---|---|
| Movement | **Platform** (run, jump, double jump, one-way platforms), **EightDirection**, **Car**, **Bullet**, **Pathfinding** (A* around Solids), **Orbit**, **Physics** (wraps the arcade/matter body) |
| Motion effects | **Sine** (horizontal, vertical, angle, size, opacity), **Rotate**, **Tween**, **Fade**, **Flash** |
| Layout | **Wrap**, **BoundToLayout**, **DestroyOutsideLayout**, **Anchor**, **ScrollTo** (camera follow), **Pin** (stick to another object) |
| Interaction | **DragDrop**, **Turret** (aim and shoot), **LineOfSight** (cone, range, obstacles), **Timer** (named timers), **Solid**, **Jumpthru**, **Persist** |

Properties, conditions, actions and expressions of each are listed in the generated **[Event sheet reference](event-reference.html#behaviors-ref)**.

## In an event sheet
Behavior nodes carry `"behavior": "Platform"`:
```json
{ "object": "Hero", "behavior": "Platform", "id": "simulate-control", "params": { "control": "jump" } }
```
Read behavior values with `Hero.Platform.VectorY`; use triggers like `Platform → on-jump`, `Turret → on-shoot`, `Timer → on-timer`, `Tween → on-tween-finished`, `Pathfinding → on-arrived`.

The sample game shoots bullets from its turret with just two actions:
```json
{ "object": "System", "id": "create-object", "params": { "object": "Bullet", "layer": "0", "x": "Turret.X", "y": "Turret.Y" } },
{ "object": "Bullet", "behavior": "Bullet", "id": "set-angle-of-motion", "params": { "angle": "Turret.Angle" } }
```

## Write your own
```js
import { Behavior, registerBehavior } from 'nord';
class Spin extends Behavior {
  static attributes = { speed: { type: 'number', default: 90 } };
  tick(dt) { this.entity.rot[2] += this.props.speed * dt; this.entity.touch(); }
}
registerBehavior('Spin', Spin, { actions: { 'set-speed': { params: ['value'], run: (b, p) => { b.props.speed = p.value; } } }, expressions: { Speed: (b) => b.props.speed } });
```
Registered behaviors immediately appear in event sheets with their actions and expressions.

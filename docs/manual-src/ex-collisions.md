---
title: 6 · Collisions, triggers and raycasts
section: Examples
order: 6
summary: Pick-ups, damage zones, hit detection, overlap queries and 3D raycasts.
---

**Goal:** coins you pick up, spikes that hurt, and a melee attack that hits enemies in front of you.

## Setup in the Inspector
| You want | Add to the object |
|---|---|
| a solid wall / floor | `collider` (no rigidbody = static) |
| a moving solid thing | `rigidbody` (`dynamic`) + `collider` |
| a pick-up zone / damage area (no bump, only "overlap") | `trigger` (or collider with *trigger* ticked) |
| the thing that *enters* it | needs a `rigidbody` + `collider` (the player) |

Physics is chosen in `nord.project.json` ▸ `physics.engine` (`arcade` for 2D, `havok` for 3D). The collision events are called on **both** objects.

## Events
### Unity
```cs
void OnTriggerEnter2D(Collider2D other) { if (other.CompareTag("Player")) Pickup(); }
void OnCollisionEnter2D(Collision2D c)  { if (c.gameObject.CompareTag("Enemy")) Hurt(); }
```
### Nord
```js
onTriggerEnter(other)   { if (other.hasTag('player')) this.pickup(); }   // other = the other entity
onTriggerExit(other)    {}
onCollisionEnter(other, contact) { if (other.hasTag('enemy')) this.hurt(); }
onCollisionExit(other)  {}
// MonoBehaviour: OnTriggerEnter(other), OnTriggerExit, OnCollisionEnter, OnCollisionExit
```
`other` is the **entity** (not a collider). In 3D, `contact` is `{ point, normal, impulse }`. The entity also emits `triggerEnter`, `collisionEnter`… on its own bus if you prefer listening: `this.entity.on('triggerEnter', (other) => …)`.

## Pick-up
```js
import { MonoBehaviour, GameManager } from 'nord';
export default class Coin extends MonoBehaviour {
  OnTriggerEnter(other) {
    if (!other.hasTag('player')) return;
    GameManager.instance.AddScore(1);
    this.Destroy();
  }
}
```

## Damage zone with a cooldown
```js
import { NordScript } from 'nord';
export default class Spikes extends NordScript {
  static attributes = { damage: { type: 'number', default: 1 }, every: { type: 'number', default: 0.8 } };
  init() { this.inside = new Set(); this.t = 0; }
  onTriggerEnter(o) { if (o.hasTag('player')) this.inside.add(o); }
  onTriggerExit(o)  { this.inside.delete(o); }
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    for (const o of this.inside) if (!o.destroyed) { o.callScripts('takeDamage', this.attrs.damage); this.t = this.attrs.every; }
  }
}
```
(`trigger` events fire when entering; for "while standing inside" remember who is inside, like above.)

## Hit things in an area (2D): Physics2D.OverlapBox
```js
attack() {
  const p = this.entity.pos, dir = this.facing;               // 1 or -1
  const hits = this.physics.overlapBox(p[0] + dir * 30, p[1], 40, 30);   // centre x, y, width, height
  for (const e of hits) if (e.hasTag?.('enemy')) e.callScripts('takeDamage', 2);
}
```
Entries may also be `{ tile: true }` markers for solid tilemap tiles, hence the `hasTag?.`.

## Raycast (3D)
```js
const from = this.entity.worldPos, to = [from[0], from[1], from[2] - 20];
const hit = this.physics.raycast(from, to, { ignore: this.entity });
if (hit) console.log(hit.entity.name, hit.point, hit.normal, hit.distance);
```
Unity: `Physics.Raycast(origin, direction, out hit, maxDistance)`.

## Grounded check
`this.physics.isGrounded(this.entity)` works in 2D and 3D (use it before allowing a jump).

## Layers and what collides with what
Use **tags** for "who is this" (`hasTag`) and check them in the event. The `layer` number on an entity is available as `entity.layer` for your own rules. There is no layer-collision matrix to configure: if two bodies should not collide, give one a trigger instead of a collider, or ignore the event.

::: warn
Fast small objects (bullets) can pass through thin walls between two physics steps. Make the wall thicker, the bullet slower, or move bullets with `physics.setVelocity` rather than by assigning `pos`.
:::

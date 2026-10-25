---
title: T05 Physics & collisions
section: Tutorials
order: 5
summary: Rigidbodies, colliders, triggers, bounce pads, pickups.
---
**Project:** the platformer from T04 (finished: `examples/platformer`; also see `examples/breakout`, `examples/marble`).

1. A floor: entity with `collider` (box) and **no** rigidbody = static. A crate: `rigidbody` (`dynamic`) + `collider`.
2. A coin: add a [`trigger`](component-trigger.html) and a script:

**File: `scripts/coin.js`** (new file, the whole file; attach it to the coin)
```js
import { NordScript } from 'nord';
export default class Coin extends NordScript {
  onTriggerEnter(other) {
    if (!other.hasTag('player')) return;
    this.events.emit('score', 10);
    this.events.emit('sfx', 'coin');
    this.entity.destroy();
  }
}
```
3. Make it bounce the player: library `physics-bounce-pad.js` on a collider entity.
4. Query the world: `this.physics.overlapBox(x, y, 40, 40)` returns entities in a box — use it for melee hits.
5. Gravity lives in `nord.project.json` → `physics.gravity`.

Reference: [Physics](physics.html), [rigidbody](component-rigidbody.html). **Next:** [T06 Tilemaps](tut-t06-tilemaps.html).

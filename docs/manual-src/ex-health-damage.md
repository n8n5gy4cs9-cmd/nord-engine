---
title: 21 · Health, damage and death
section: Examples
order: 21
summary: A reusable Health script, damage by events, invulnerability frames, knockback, health bars and death handling.
---

**Goal:** anything can be damaged (player, enemy, crate) with the same script, and nothing needs to know who is who.

## The library Health script
Library ▸ *gameplay* ▸ **Health & damage** (`health.js`). Add it to any object:
| Attribute | Meaning |
|---|---|
| `max` | hit points (default 5) |
| `invulnTime` | seconds of invulnerability after a hit (the sprite blinks) |
| `destroyOnDeath` | remove the object at 0 hp |
| `barName` | name of a `uiBar` object to update automatically |
| `deathEvent` | name of the *global* event on death (default `died`) |

Talk to it with events (Unity: `SendMessage("TakeDamage")` or an interface):

**File: your script, for example `scripts/Bullet.js`** (inside `OnTriggerEnter`, on the attacker)
```js
target.emit('damage', { amount: 2, from: this.entity });     // hurt it
target.emit('heal',   { amount: 1 });                         // heal it
```
It answers on the same object: `health` `{ hp, max }` after every change, `death` once; and `hit` on the global bus. Listen:

**File: your script, for example `scripts/Enemy.js`** (inside `Start()`; keep the returned function and call it in `OnDestroy()`)
```js
const off = enemy.on('death', () => GameManager.instance.AddScore(10));
const off2 = player.on('health', ({ hp, max }) => this.bar.set(hp / max));
```

## A health script from scratch (Unity-style)

**File: `scripts/Health.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, UnityEvent } from 'nord';

export default class Health extends MonoBehaviour {
  static attributes = SerializeField({ max: 100, invulnerable: 0.5 });

  Awake() {
    this.hp = this.max; this.inv = 0;
    this.onChanged = new UnityEvent();      // lever.onChanged.AddListener(fn) from elsewhere
    this.onDied = new UnityEvent();
  }
  Update(dt) { this.inv = Math.max(0, this.inv - dt); }

  TakeDamage(n) {                           // call: other.getScript(Health).TakeDamage(10)
    if (this.inv > 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - n); this.inv = this.invulnerable;
    this.onChanged.Invoke(this.hp, this.max);
    if (this.hp === 0) { this.onDied.Invoke(); this.Destroy(); }
  }
  Heal(n) { this.hp = Math.min(this.max, this.hp + n); this.onChanged.Invoke(this.hp, this.max); }
}
```
**Calls or events?** Calls (`getScript(Health).TakeDamage`) are easy to follow; events (`emit('damage')`) work on anything that has a Health script and need no import. Pick one convention per project.

## Knockback and hit reaction

**File: your script, for example `scripts/Bullet.js`** (inside `OnTriggerEnter`, after the damage call)
```js
// in the attacker: push the target away from us
const dx = target.pos[0] - this.entity.pos[0], dy = target.pos[1] - this.entity.pos[1], d = Math.hypot(dx, dy) || 1;
this.physics.applyImpulse(target, (dx / d) * 400, (dy / d) * 400);     // 2D: (entity, ix, iy)
// flash red
target.set('sprite', 'tint', '#ff6666');  this.after(0.1, () => target.set('sprite', 'tint', '#ffffff'));
```

## A health bar
* **HUD bar**: `this.ui.bar(1, { x: 16, y: 46, w: 180, color: '#7ee787' })` and `bar.set(hp / max)` ([UI](ex-ui-hud.html)).
* **Above an enemy**: a child object with a sprite; set its x-scale to `hp / max`.
* **No code**: give Health the `barName` of a `uiBar` component object.

## Invulnerability frames (blink)
The library script blinks the sprite while invulnerable. By hand: a coroutine toggling `alpha` ([Jump Dash](ex-platformer.html) uses `Blink()`).

## Death

**File: `scripts/Enemy.js`** (inside `Start()`)
```js
this.entity.on('death', () => {
  this.Instantiate('prefabs/explosion.prefab.json', { pos: [...this.entity.pos] });   // effects
  GameManager.instance.AddScore(10);                                                 // rewards
  this.game.camera.shake(150, 0.006);
});
```
Spawn loot with `this.scene.spawn('prefabs/coin.prefab.json', { pos })`. For the player: `GameManager.instance.GameOver()` or show a respawn screen and `physics.teleport` back.

## Damage from a danger zone
`onTriggerEnter(other) { other.emit('damage', { amount: 1 }); }` on spikes, lava, bullets. Because the receiving script has the invulnerability timer, a zone that stays touching cannot hurt every frame ([Collisions](ex-collisions.html)).

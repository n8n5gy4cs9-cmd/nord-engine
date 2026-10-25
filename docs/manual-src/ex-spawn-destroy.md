---
title: 5 · Spawning, prefabs and Destroy
section: Examples
order: 5
summary: Make prefabs, spawn them at runtime, pass data in, destroy and pool them.
---

**Goal:** a gun that fires bullets, bullets that fly and disappear, and a pool so you do not create hundreds of objects.

## Make a prefab
1. Build the object in the scene (a sprite with a script and a trigger).
2. @ui[Hierarchy ▸ right-click it ▸ Create prefab]. It becomes `prefabs/<name>.prefab.json` and the scene object turns into an *instance*.
3. For spawning only, delete the instance from the scene; the file stays.

## Unity (C#)
```cs
public GameObject bulletPrefab;
void Fire() {
    var b = Instantiate(bulletPrefab, muzzle.position, Quaternion.identity);
    b.GetComponent<Bullet>().direction = Vector2.right;
    Destroy(b, 3f);
}
```

## Nord
`scripts/gun.js`
```js
import { MonoBehaviour, SerializeField, UnityInput as Input } from 'nord';
import Bullet from './bullet.js';

export default class Gun extends MonoBehaviour {
  static attributes = SerializeField({ cooldown: 0.25 });

  Awake() { this.next = 0; }

  Update() {
    if (Input.GetKey('Space') && this.game.time.elapsed >= this.next) { this.next = this.game.time.elapsed + this.cooldown; this.Fire(); }
  }

  async Fire() {                                     // async: spawning returns a Promise
    const p = this.entity.worldPos;
    const bullet = await this.Instantiate('prefabs/bullet.prefab.json', { pos: [p[0] + 20, p[1], 3] });
    bullet.getScript(Bullet).direction = [1, 0];     // pass data in: scripts exist right away, they start next frame
    this.Destroy(bullet, 3);                         // safety: remove after 3 seconds
  }
}
```
`scripts/bullet.js`
```js
import { MonoBehaviour, Time } from 'nord';

export default class Bullet extends MonoBehaviour {
  Awake() { this.direction = [1, 0]; this.speed = 600; }
  Update() {
    const p = this.entity.pos;
    this.entity.pos = [p[0] + this.direction[0] * this.speed * Time.deltaTime, p[1] + this.direction[1] * this.speed * Time.deltaTime, p[2]];
  }
  OnTriggerEnter(other) { if (other.hasTag('enemy')) { other.callScripts('takeDamage', 1); this.Destroy(); } }
}
```
Native style: `const e = await this.scene.spawn('prefabs/bullet.prefab.json', { pos: [x, y, 0], rot, scale, name, parent, overrides })`. It returns a **Promise** (loading a prefab can touch the network), so use `await` or `.then`.

## Overrides: change a prefab's values when spawning

**File: your script, for example `scripts/Spawner.js`** (a call inside any method, in an `async` function)
```js
await this.scene.spawn('prefabs/enemy.prefab.json', {
  pos: [100, 100, 2],
  overrides: { scripts: { 0: { attributes: { speed: 160 } } }, components: { 0: { tint: '#ff0000' } } },
});
```
`scripts.0` / `components.0` mean "the first script / component"; only the fields you list change.

## Destroy

**File: your script, for example `scripts/Bullet.js`** (calls inside any method)
```js
this.Destroy();                 // this object (MonoBehaviour)
this.Destroy(other, 2);         // other object after 2 seconds
entity.destroy();               // native
```
Destroying is **deferred to the end of the frame**: the object still exists until then, `entity.destroyed` becomes `true` immediately. `onDestroy()` runs; children go with their parent. Before using a stored reference, check `if (!target || target.destroyed) return;`.

## Clone an object in the scene

**File: your script, for example `scripts/Cloner.js`** (inside an `async` method)
```js
const copy = await this.entity.clone();    // a copy with fresh ids
copy.pos = [copy.pos[0] + 40, copy.pos[1], copy.pos[2]];
```

## Pooling (avoid creating and destroying all the time)

**File: `scripts/Gun.js`** (new file, the whole file; the `bullet` prefab must exist)
```js
import { MonoBehaviour, ObjectPool } from 'nord';

export default class Gun extends MonoBehaviour {
  async Start() {
    this.pool = new ObjectPool(this.scene, 'prefabs/bullet.prefab.json');
    await this.pool.Warm(20);                     // create 20 disabled bullets now
  }
  async Fire() {
    const b = await this.pool.Get({ pos: this.entity.worldPos });   // reuse a free one (enabled)
    this.after(1.5, () => this.pool.Release(b));                    // disabled again, ready for reuse
  }
}
```
Pooled objects are only *disabled*, so reset their state in `OnEnable()`.

## Children and parenting

**File: your script, for example `scripts/Soldier.js`** (inside an `async` method)
```js
const gun = await this.scene.spawn('prefabs/gun.prefab.json', { parent: this.entity, pos: [10, 0, 1] }); // child of this object
```

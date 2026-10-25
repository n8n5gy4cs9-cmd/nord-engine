---
title: 7 · Time: coroutines, Invoke, timers and tweens
section: Examples
order: 7
summary: Wait, repeat, delay, fade and ease: Unity coroutines and Invoke next to Nord's equivalents.
---

**Goal:** flash when hit, spawn something every 2 seconds, fade out, slide an object smoothly.

## Delta time

**File: `scripts/Slide.js`** (any script: the body of `update(dt)`; the page uses this as a standalone example, not part of the other snippets)
```js
update(dt) { this.entity.pos = [this.entity.pos[0] + 100 * dt, this.entity.pos[1], 0]; }   // dt = Time.deltaTime
```
In MonoBehaviours use `Time.deltaTime`, `Time.time`, `Time.timeScale` (set `Time.timeScale = 0.2` for slow motion, `0` to freeze everything driven by dt). `this.game.timeScale` is the same value.

## Invoke (Unity names)

**File: your script, for example `scripts/Bomb.js`** (call these inside `Start()` or any method of a `MonoBehaviour`)
```js
this.Invoke('Explode', 2);                 // call this.Explode() after 2 s
this.InvokeRepeating('Spawn', 1, 0.5);     // first after 1 s, then every 0.5 s
this.CancelInvoke('Spawn');                // or CancelInvoke() for all; IsInvoking('Spawn')
```
They are cancelled automatically when the object is destroyed.

## Coroutines
### Unity
```cs
IEnumerator Flash() {
    for (int i = 0; i < 3; i++) { sr.enabled = false; yield return new WaitForSeconds(0.1f); sr.enabled = true; yield return new WaitForSeconds(0.1f); }
}
StartCoroutine(Flash());
```
### Nord (MonoBehaviour)

**File: `scripts/Hurt.js`** (new file, the whole file)
```js
import { MonoBehaviour, WaitForSeconds, WaitUntil } from 'nord';

export default class Hurt extends MonoBehaviour {
  *Flash() {                                       // a generator function: function*
    for (let i = 0; i < 3; i++) {
      this.entity.set('sprite', 'alpha', 0.2);
      yield new WaitForSeconds(0.1);
      this.entity.set('sprite', 'alpha', 1);
      yield new WaitForSeconds(0.1);
    }
  }
  OnCollisionEnter() { this.StartCoroutine(this.Flash()); }
}
```
Yield: `null` (next frame), `new WaitForSeconds(s)`, `new WaitUntil(() => cond)`, `new WaitWhile(() => cond)`, `new WaitForFixedUpdate()`, or another coroutine's generator (nested: `yield this.OtherCoroutine()`). `StopCoroutine(co)` / `StopAllCoroutines()`; they stop when the object is destroyed or disabled-and-destroyed.

## async / await instead (native style)
JavaScript has its own way to wait; it is great for *loading* things, but it does not stop when the object dies. For gameplay timing use coroutines or the scheduler below.

**File: your script, for example `scripts/Spawner.js`** (an `async` method of the class, for example `async Fire()`)
```js
const bullet = await this.scene.spawn('prefabs/bullet.prefab.json');
```

## Scheduler: after / every

**File: your script, for example `scripts/Blinker.js`** (inside `Start()`; the two handles are kept in fields so you can call them later)
```js
const cancel = this.after(2, () => this.explode());        // once, after 2 s (stops with the scene)
const stop = this.every(0.5, () => this.blink());          // repeat until stopped
cancel(); stop();                                          // call to cancel
```
These follow `timeScale` and the pause, and are cleaned up on scene change.

## Cooldown pattern (no coroutine needed)

**File: your script, for example `scripts/Gun.js`** (the `update(dt)` method; add the field `this.cool = 0` in `start()`)
```js
update(dt) {
  this.cool = Math.max(0, this.cool - dt);
  if (this.input.pressed('fire') && this.cool === 0) { this.shoot(); this.cool = 0.3; }
}
```

## Tweens: move, fade, scale

**File: your script, for example `scripts/Panel.js`** (inside `Start()`, before the tween is needed)
```js
// slide the object to x = 400 over 1 second
this.tween(this.entity.pos, { 0: 400 }, { duration: 1, ease: 'quadOut', onUpdate: () => this.entity.touch() });

// fade a sprite: tween a plain object and apply it
const s = { a: 1 };
this.tween(s, { a: 0 }, { duration: 0.6, onUpdate: () => this.entity.set('sprite', 'alpha', s.a), onComplete: () => this.entity.destroy() });

// pulse forever
this.tween(this.entity.scale, { 0: 1.3, 1: 1.3 }, { duration: 0.4, yoyo: true, repeat: -1, ease: 'sineInOut', onUpdate: () => this.entity.touch() });
```
Options: `duration, delay, ease, onUpdate, onComplete, yoyo, repeat (-1 = forever)`. Ease names: `linear, quadIn, quadOut, quadInOut, cubicIn, cubicOut, cubicInOut, sineInOut, backOut, elasticOut, bounceIn, bounceOut`. Array targets use the index as key (`0` = x). After changing `pos/scale` arrays in place call `entity.touch()` (assigning a new array does it for you).

## Math helpers

**File: your script, for example `scripts/Mover.js`** (the `import` line goes at the very top of the file, the calls inside any method)
```js
import { clamp, lerp, remap, vec } from 'nord';
const t = clamp(value, 0, 1);
this.entity.pos = vec.lerp(this.entity.pos, target, Math.min(1, 8 * dt));   // smooth follow
```
(`Mathf.Clamp`, `Mathf.Lerp`, `Mathf.MoveTowards`… also exist for Unity habits.)

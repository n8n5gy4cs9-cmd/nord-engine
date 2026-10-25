---
title: 26 · Juice: particles, shake, hit-stop and floating text
section: Examples
order: 26
summary: Make hits feel good with particle bursts, screen shake, flashes, hit-stop, squash and stretch, and numbers that float up.
---

**Goal:** a hit that feels powerful in under 20 lines.

## Particles
A `particles` component on an object (a prefab you spawn) with fields: `texture`, `lifespan` (ms), `speed`, `angle`, `gravityY`, `scale`, `alpha`, `tint`, `frequency`, `quantity`, `burst`, `emitting`, `blend` (normal / add / multiply / screen).
* **Continuous** (fire, smoke): `emitting` on, `burst` off, `frequency` 50 ms.
* **Burst** (explosion, hit spark): `burst` on, `quantity` 20, then destroy the object a moment later.

**File: your script, for example `scripts/Gun.js`** (inside the method that handles a hit; it spawns a particle prefab at the hit point)
```js
// a spark at the hit position
hit(pos) { this.Instantiate('prefabs/spark.prefab.json', { pos: [pos[0], pos[1], 6] }); }
// spark.js:  Start() { this.Destroy(this.entity, 0.7); }
```
Unity: Particle System + `Instantiate` + `Destroy(go, 1)`. Tune in play mode and copy the numbers. The library script `fx-particle-presets.js` has ready-made presets (sparks, dust, smoke, confetti).

## Screen shake, flash, fade (2D)

**File: your script, for example `scripts/Player.js`** (inside the method that handles damage)
```js
this.game.camera.shake(150, 0.008);        // ms, intensity
this.game.camera.flash(80, '#ffffff');     // white flash
this.game.camera.fade(400, '#000000');     // fade out;  this.game.camera.fadeIn(400)
```

## Hit-stop (freeze for a moment)

**File: your script, for example `scripts/Combat.js`** (add this method to the class)
```js
async hitStop(ms = 60) {
  this.game.timeScale = 0.02;
  await new Promise((r) => setTimeout(r, ms));        // real time on purpose
  this.game.timeScale = 1;
}
```
or the library `fx-hitstop.js` (`this.events.emit('hitstop')`).

## Squash and stretch

**File: your script, for example `scripts/Combat.js`** (add this method to the same class)
```js
punch() {
  this.tween(this.entity.scale, { 0: 1.35, 1: 0.7 }, { duration: 0.07, yoyo: true, onUpdate: () => this.entity.touch() });
}
```

## Flash the sprite white

**File: your script, for example `scripts/Combat.js`** (add this method to the same class)
```js
flash() { this.entity.set('sprite', 'tint', '#ff8888'); this.after(0.08, () => this.entity.set('sprite', 'tint', '#ffffff')); }
```

## Floating damage numbers
UI labels live on screen, so convert the world position first (2D with the default camera: world x/y equal screen x/y minus the camera offset; the simplest is a small world-space text entity):

**File: your script, for example `scripts/Combat.js`** (add this method to the same class)
```js
async floatText(text, pos, color = '#ffe066') {
  const e = await this.scene.spawnData({ name: 'Float', transform: { pos: [pos[0], pos[1], 20], rot: [0, 0, 0], scale: [1, 1, 1] },
    components: [{ type: 'text', text, size: 22, color }], scripts: [], children: [] });
  this.tween(e.pos, { 1: pos[1] - 40 }, { duration: 0.7, ease: 'quadOut', onUpdate: () => e.touch(), onComplete: () => e.destroy() });
}
```
`scene.spawnData(json)` builds an entity from plain data, no prefab file needed. Use it for small throw-away effects.

## Trails and afterimages
Library `fx-trail.js`. Parallax backgrounds: `fx-parallax.js`. Pixel/CRT look: `fx-pixelate-crt.js`, and scene **effects** (bloom, vignette, colour grading) in the scene settings ([Effects, particles and timelines](effects-particles-timelines.html)); in 3D the `postProcess` component.

## Putting it together

**File: your script, for example `scripts/Combat.js`** (add this method; it calls the helpers above)
```js
OnHit(target, point) {
  target.emit('damage', { amount: 1, from: this.entity });
  this.Instantiate('prefabs/spark.prefab.json', { pos: [point[0], point[1], 6] });
  this.game.camera.shake(100, 0.006);
  this.hitStop(50);
  this.floatText('-1', point);
}
```
Rule of thumb: every important event gets three kinds of feedback (something you see, something you hear, something that moves).

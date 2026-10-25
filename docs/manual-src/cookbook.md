---
title: Cookbook
section: Guides
order: 1
summary: Short recipes for common game problems, in Nord format.
---
Each recipe is plain Nord API — no Phaser/Babylon calls.

## Movement & feel
**Coyote time + jump buffer** — use `platformer2d.js` (`coyoteTime`, `jumpBuffer`), or in your own script: remember `this.lastGrounded = time.elapsed` while grounded and allow a jump if `elapsed - lastGrounded < 0.1`.

**Smooth camera** — `camera` component with `follow` and `lerp: 0.1`; add `deadzone: [60, 40]`.

**Screen shake on hit**

**File: your script, for example `scripts/Player.js`** (inside `Start()`)
```js
this.entity.on('damage', () => this.game.camera.shake(150, 0.01));
```

**Slow motion**

**File: your script, for example `scripts/Game.js`** (a line inside any method)
```js
this.game.timeScale = 0.3;
this.after(0.5, () => (this.game.timeScale = 1));   // timers run on scaled time: 0.5 game-seconds ≈ 1.7 s real
```

## Audio on first touch
**Silent title screen / first click hits a button** — install the opt-in [touch-to-start gate](audio.html#touch-to-start): `this.startGate = touchToStart(this.game, { title: 'MY GAME' });` after building the title, and `this.startGate?.destroy()` in `onDestroy()`.

## Spawning
**Bullets with a lifetime**

**File: your script, for example `scripts/Gun.js`** (inside an `async` method)
```js
const b = await this.scene.spawn('prefabs/bullet.prefab.json', { pos: this.entity.worldPos });
this.physics.setVelocity(b, this.facing * 400, 0);
this.after(2, () => b.destroy());
```
**Random spawn points** — `this.rng.pick(this.scene.findByTag('spawn')).worldPos`. `rng` is seedable (`new Rng(seed)`) for replays.

## Timers & tweens

**File: your script, for example `scripts/Spawner.js`** (inside `Start()`; keep `stop` to cancel it later)
```js
const stop = this.every(1, () => this.spawnCoin());   // later: stop()
this.tween(this.entity.pos, [400, 100, 0], { duration: 1.2, ease: 'backOut' });
```

## Data
**High score**: `if (score > this.save.get('best', 0)) this.save.set('best', score);`
**Settings screen**: `this.audio.volume('music', v)` is persisted automatically.

## UI
**Floating damage numbers**: library `ui-damage-numbers.js`, triggered by `events.emit('dmg', { pos, amount })`.
**Tooltip / dialogue**: `dialogue.js` reads `assets/story.json` nodes (`speaker`, `text`, `next`/`choices`).

## 3D
**Third-person follow** — `third-person3d.js`; **orbit** — `camera` `type: orbit` + `follow`.
**Ground check** — `this.physics.isGrounded(this.entity)`.
**Interact with what you look at** — `interact-ray.js` casts from the camera.

## Debug
`this.game.timeScale`, `this.game.pause()`, `this.events.on('error', e => …)`, `util-debug.js`.

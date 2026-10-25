---
title: 22 · Animation: sprites and the Animator
section: Examples
order: 22
summary: Play sprite-sheet animations from code, flip by direction, drive an Animator state machine with parameters, frame events, and 3D clips.
---

**Goal:** a character that idles, runs (flipping left/right), jumps, and plays a footstep sound on a frame of the run cycle.

## Make the animations (editor)
1. Import a sprite sheet PNG (Assets) and open **Anim & Tiles ▸ Animations**. Make named animations (`idle`, `run`, `jump`) from frame lists with fps/loop ([Sprites, animation and tilemaps](sprites-animation-tilemaps.html)). They are stored next to the image (`hero.png.meta.json`).
2. Give the object an `animatedSprite` component: `texture` = the sheet, `anim` = `idle`, `autoplay` on.

<figure class="shot"><img src="assets/screenshots/ed-sprite.png" alt="The sprite editor with the hero sheet" loading="lazy"><figcaption>The sprite editor: pixel art, origin, collision outline and per-frame properties.</figcaption></figure>

## Play animations from code
### Unity
```cs
animator.Play("Run");  spriteRenderer.flipX = dir < 0;
```
### Nord

**File: your script, for example `scripts/Player.js`** (inside `update(dt)`; the object has an `animatedSprite` component)
```js
const a = this.entity.getComponent('animatedSprite');
a.play('run');                                         // switch the clip (does nothing visible if it is already playing that one)
this.entity.set('animatedSprite', 'anim', 'run');     // same thing through the generic setter
this.entity.set('animatedSprite', 'flipX', dir < 0);  // face left / right
this.entity.set('animatedSprite', 'speed', 1.5);      // playback speed
```
A tidy pattern: choose the clip once per frame from the state, and only call `play` when it changes:

**File: `scripts/PlayerAnimation.js`** (new file, the whole file)
```js
import { NordScript } from 'nord';
export default class HeroAnim extends NordScript {
  update() {
    const [vx, vy] = this.physics.velocity(this.entity);
    const clip = !this.physics.isGrounded(this.entity) ? 'jump' : Math.abs(vx) > 10 ? 'run' : 'idle';
    if (clip !== this.clip) { this.clip = clip; this.entity.set('animatedSprite', 'anim', clip); }
    if (vx) this.entity.set('animatedSprite', 'flipX', vx < 0);
  }
}
```

## Frame events (footsteps, hit frames)
In the sprite editor, mode **Origin, points, collision ▸ Frame properties**, give frame 3 of `run` an *event* name, e.g. `step`. At runtime:

**File: your script, for example `scripts/Player.js`** (inside `start()`; the event name is the one you typed in the sprite editor)
```js
start() { this.entity.on('step', () => this.audio.play('assets/audio/step.wav', { volume: 0.4 })); }   // entity event
// or on the global bus:  this.game.events.on('step', ...)
```
Unity: Animation Events calling a method on a frame.

## The Animator (state machine, like Unity's Animator Controller)
For more than three states use a controller: **Assets ▸ Create ▸ Animator controller** (`anim/hero.animator.json`), open it in the **Animator** tab: add states (each plays a clip), add *parameters* (`speed` float, `jump` trigger, `grounded` bool), draw transitions with conditions. Add an `animator` component (`controller` = the file) next to the `animatedSprite`. Then your script only sets parameters:
```js
import { NordScript } from 'nord';
export default class HeroAnim extends NordScript {
  start() { this.an = this.entity.getComponent('animator'); }
  update() {
    const [vx] = this.physics.velocity(this.entity);
    this.an.setFloat('speed', Math.abs(vx));
    this.an.setBool('grounded', this.physics.isGrounded(this.entity));
    if (this.input.pressed('jump')) this.an.setTrigger('jump');
  }
}
```
API: `setBool / setInt / setFloat(name, value)`, `setTrigger(name)`, `resetTrigger(name)`, `get(name)`, `play(stateName)` (force a state), `state` (current). Unity names match one to one. No blending between clips (sprites are not blended anyway). See [Animator](animator.html).

## 3D clips (glTF models)

**File: your script, for example `scripts/Hero3D.js`** (inside a method; the object has a `model` component)
```js
this.entity.getComponent('model').play('Walk', { loop: true, speed: 1 });       // clip names come from the .glb
this.entity.getComponent('model').animations;                                   // list of the clips in the file
```
The same Animator controller can drive a model: the state's `anim` is the glTF clip name.

## Tweened "animation" without art

**File: your script, for example `scripts/Pulse.js`** (inside a method such as `OnHit()`)
```js
this.tween(this.entity.scale, { 0: 1.2, 1: 0.85 }, { duration: 0.12, yoyo: true, onUpdate: () => this.entity.touch() });   // squash and stretch on landing
```

## Tips
* One animation per file section keeps things tidy: `idle`, `run`, `jump`, `fall`, `hit`, `die`.
* Pixel art: set the texture **Filter** to *nearest* (Inspector on the image) and `pixelArt: true` in the project display settings so frames stay sharp.
* Animation speed follows `timeScale` (pausing the game pauses animations).

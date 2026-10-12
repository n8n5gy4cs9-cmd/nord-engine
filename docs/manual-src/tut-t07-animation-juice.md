---
title: T07 Animation & juice
section: Tutorials
order: 7
summary: Animated sprites, tweens, particles, camera shake, hit-stop.
---
**Project:** `examples/platformer` (`hero-fx.js`, `fx-hitstop.js`).

1. Define animations in `assets/sprites/hero.png.meta.json` (`idle`, `run`, `jump`).
2. Switch them from a script:
```js
const a = this.entity.getComponent('animatedSprite');
const moving = this.input.axis('left', 'right') !== 0;
a.play(this.physics.isGrounded(this.entity) ? (moving ? 'run' : 'idle') : 'jump');
if (moving) a.setFlip(this.input.down('left'));
```
3. Squash on landing: `this.tween(this.entity.scale, [1.3, 0.7, 1], { duration: 0.08, yoyo: true })`.
4. Dust and sparks: add [`particles`](component-particles.html) and call `burst(8)` on landing.
5. Impact: `this.game.camera.shake(120, 0.008)` and the library `fx-hitstop.js` (`events.emit('hitstop', 40)`).

**Next:** [T08 UI & HUD](tut-t08-ui-hud.html).

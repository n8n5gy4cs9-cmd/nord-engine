---
title: Cheat sheet — nord.js
section: Guides
order: 2
summary: One page of everything a script can do.
---
```js
import { NordScript, clamp, lerp, remap, vec, ease, Rng, Pool, Events } from 'nord';

export default class X extends NordScript {
  static attributes = { speed: { type: 'number', default: 100, min: 0, max: 500 } };
  init() {}  start() {}  update(dt) {}  fixedUpdate(dt) {}  lateUpdate(dt) {}
  onEnable() {}  onDisable() {}  onDestroy() {}  onHotReload(old) {}
  onCollisionEnter(o, c) {}  onCollisionExit(o) {}  onTriggerEnter(o) {}  onTriggerExit(o) {}
}
```
| Need | Code |
|---|---|
| Attribute | `this.attrs.speed` |
| Move | `this.entity.pos = [x, y, 0]` or edit then `this.entity.touch()` |
| Find | `this.scene.find('Name')`, `findByTag('t')`, `entity.find('Child')` |
| Component | `entity.getComponent('sprite')`, `entity.set('sprite','tint','#f00')` |
| Other script | `entity.getScript(OtherClass)` |
| Spawn | `await this.scene.spawn('prefabs/x.prefab.json', { pos: [x,y,0] })` |
| Destroy | `entity.destroy()` |
| Scene | `this.game.loadScene('scenes/l2.scene.json')`, `this.game.restart()` |
| Input | `input.down/pressed/released('jump')`, `axis('left','right')`, `vec(l,r,u,d)`, `pointer` |
| Events | `this.events.on('score', fn)` → returns off; `emit('score', 5)`; per entity `entity.on/emit` |
| Timers | `this.after(s, fn)`, `this.every(s, fn)`, `this.tween(obj, to, {duration, ease, yoyo, repeat})` |
| Audio | `audio.play(path, {volume, loop})`, `audio.music(path, {fade})`, `audio.volume('music', .5)` |
| UI | `ui.label/button/bar/panel/image/menu`, `ui.show/hide('screen')` |
| Save | `save.get(k, def)`, `save.set(k, v)`, `save.slot(2)` |
| Physics | `physics.setVelocity(e, vx, vy)`, `applyImpulse`, `isGrounded(e)`, `overlapBox` (2D), `raycast` (3D) |
| Camera (2D) | `game.camera.shake/flash/fade/zoom/follow/center` |
| Random | `this.rng.range(a,b)`, `int`, `pick(arr)`, `chance(p)`, `shuffle(arr)` |
| Pause/slow | `game.pause()`, `game.resume()`, `game.timeScale = 0.5` |
Details: [API reference](api-namespaces.html).

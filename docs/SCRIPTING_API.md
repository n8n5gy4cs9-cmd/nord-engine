# Scripting API (nord.js) — spec for M2

Status: **spec only**; implementation lives in `runtime/core`. Keep this file in sync with code (JSDoc → generated API ref in M7).

```js
import { NordScript } from 'nord';

export default class PlayerController extends NordScript {
  static attributes = {
    speed:     { type: 'number', default: 220, min: 0, max: 1000, label: 'Move speed' },
    jumpForce: { type: 'number', default: 520 },
    sfxJump:   { type: 'asset', assetType: 'audio', default: 'assets/audio/sfx/jump.wav' },
  };

  init()            {}   // once, after construction, before any start()
  start()           {}   // once, when scene begins (all entities exist)
  update(dt)        {}   // every frame (seconds)
  fixedUpdate(dt)   {}   // fixed 60 Hz (physics-related logic)
  lateUpdate(dt)    {}   // after all update()
  onEnable()  {}  onDisable() {}
  onDestroy() {}
  onCollisionEnter(other, contact) {}  onCollisionExit(other) {}
  onTriggerEnter(other) {}             onTriggerExit(other) {}
}
```

## `this` (NordScript)
`this.entity` (Entity), `this.scene`, `this.game` (Nord instance), `this.attrs`, `this.input`, `this.audio`, `this.time`,
`this.events`, `this.ui`, `this.physics`, `this.save`, `this.rng`, `this.tween(...)`, `this.after(sec, fn)`, `this.every(sec, fn)`.

## Entity
`name, id, tags, enabled, parent, children, pos/rot/scale (getters/setters), worldPos, find(name), findByTag(tag),
getComponent(type), addComponent(type, data), getScript(Class), destroy(), clone(), emit/on/off, native` (the Phaser GameObject
or Babylon TransformNode — escape hatch).

## Input
`input.down('left')` (action), `input.pressed('jump')`, `input.released(...)`, `input.axis('left','right')`, `input.vec('left','right','up','down')`,
`input.key('KeyW')`, `input.pointer` `{x,y,worldX,worldY,down}`, gamepad, touch, virtual joystick (ui plugin). Actions come from `nord.project.json`. Exported web builds also get automatic on-screen touch controls built from those actions (`nord-touch.js`, see EXPORT_TARGETS.md).

## Scene
`game.loadScene(path)`, `game.restart()`, `game.pause()/resume()`, `game.timeScale`, `scene.spawn(prefabPath, {pos})`, `scene.find…`.

## Events
`events.on(name, fn)`, `events.emit(name, data)`, global bus + per-entity.

## Audio
`audio.play(path, {volume, loop, rate})`, `audio.music(path, {fade})`, `audio.stopMusic()`, `audio.volume(bus, v)`, `audio.mute(b)`. Buses: master, music, sfx, ui.

## UI (DOM layer)
`ui.show('hud')`, `ui.panel/label/button/bar/...`, templates in `library/ui`.

## Save
`save.set(k,v)`, `save.get(k,def)`, `save.slot(n)`, backed by localStorage, versioned.

## Hot reload
`NordRuntime.hotReloadScript(path)` re-imports module (cache-bust), swaps prototype of live instances, calls `onHotReload(oldState)` if defined.

## Rust tier (nord-runtime-wasm)
```rust
pub trait Script { fn start(&mut self, ctx:&mut Ctx){}  fn update(&mut self, ctx:&mut Ctx, dt:f32){} fn on_destroy(&mut self, ctx:&mut Ctx){} }
```
Register with `registry.register("player", || Box::new(Player::default()))`; scene JSON refers by name.

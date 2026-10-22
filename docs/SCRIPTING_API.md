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
`input.key('KeyW')`, `input.pointer` `{x,y,worldX,worldY,down}`, gamepad, touch, virtual joystick (ui plugin). Actions come from `nord.project.json`.

## Scene
`game.loadScene(path)`, `game.restart(options?)`, `game.pause()/resume()`, `game.timeScale`, `scene.spawn(prefabPath, {pos})`, `scene.find…`.

`await game.restart()` reloads the current saved scene (or the project start scene before the first load), destroys the old scene and scripts, cancels its scheduler, and builds fresh entities/components/script instances. It resets `time.elapsed`, `time.delta`, `timeScale` to 1, paused state to false, and held/edge/virtual input, stick and pointer press. Concurrent restart calls share a promise; it resolves after the new scene starts. Scene JSON is cloned before building so runtime component/settings changes cannot mutate cached saved data.

Unlike normal `loadScene(path)`, restart resets Persist entities by default. Use `restart({ preservePersistent: true })` to migrate their state deliberately. Normal scene transitions retain their existing Persist behavior. Save storage, asset/module caches, global services, module-level JavaScript and external servers survive. Keep per-run variables on script instances; release custom DOM/UI, window listeners, native meshes/materials and audio in `onDestroy()`. Calling restart does not reload edited script modules; use Stop/Play or hot reload for code changes. An old scene script is destroyed by restart: call it and return rather than continuing to mutate the old instance.

```js
// A UI callback can restart even while game.pause() is active.
this.ui.button('Restart', () => { this.game.restart(); return; });
// A persistent app controller can await the fresh scene:
const freshScene = await game.restart();
```

Existing copied projects need **Upgrade runtime** to receive this behavior.

## Events
`events.on(name, fn)`, `events.emit(name, data)`, global bus + per-entity.

## Audio
`audio.play(path, {volume, loop, rate})`, `audio.music(path, {fade})`, `audio.stopMusic()`, `audio.volume(bus, v)`, `audio.mute(b)`. Buses: master, music, sfx, ui.

### Optional touch-to-start audio gate
Full guide with example code: manual → Audio → *Touch-to-start gate* (`docs/manual-src/08-audio.md`).

Ready-made engine helper exported from `nord` (`runtime/core/start-gate.js`). Install it explicitly after building a title screen:

```js
import { touchToStart } from 'nord';
// In start()/boot(), once the title and its queued music are ready:
this.startGate = touchToStart(this.game, { title: 'MY GAME' });
// In onDestroy():
this.startGate?.destroy();
```

The helper consumes the first mouse/touch/key activation plus its release/synthetic click, unlocks audio, removes its overlay and preserves the current game screen/camera. The next gesture is normal game input. It is opt-in; other games do not receive a gate automatically. Options: `parent` (defaults to document.body), `title`, `label`. Returned handle: `active` getter and `destroy()`. No DOM environment returns an inactive handle. The helper does not choose music, change screens, or change project display/input configuration.

## UI (DOM layer)
`ui.show('hud')`, `ui.panel/label/button/bar/...`, templates in `library/ui`. **UI scenes:** `await ui.load('ui/menu.ui.json')` → `menu.on(action, fn)`, `menu.$(name)`, `menu.set(var, v)`; `game.gui.scene(def, { entity })` for in-world UI. See `docs/UI_SCENES.md`.

## Save
`save.set(k,v)`, `save.get(k,def)`, `save.slot(n)`, backed by localStorage, versioned.

## Hot reload
`NordRuntime.hotReloadScript(path)` re-imports module (cache-bust), swaps prototype of live instances, calls `onHotReload(oldState)` if defined.

## Rust tier (nord-runtime-wasm)
```rust
pub trait Script { fn start(&mut self, ctx:&mut Ctx){}  fn update(&mut self, ctx:&mut Ctx, dt:f32){} fn on_destroy(&mut self, ctx:&mut Ctx){} }
```
Register with `registry.register("player", || Box::new(Player::default()))`; scene JSON refers by name.

## Inspector extras (M8-32)
Attributes may add `description` (tooltip); ranged numbers get a slider. Entities can carry `connections` (Inspector ▸ Signals): `{event, target, method}` calls `method(data)` on the target entity's scripts when the entity emits `event`.

---
title: Scripting
section: Manual
order: 4
summary: NordScript lifecycle, attributes, events, timers, tweens, hot reload, debugging.
---

A script adds behavior to an entity: movement, a reaction to a button, or rules for your game. New to code? Read [Programming for dummy developers](developer-basics.html) first.

::: dummies
Attach the Spinner example below to an entity with a visible picture, press Play, and watch it turn. Change speed in the Inspector to try a different speed. Attributes are settings, not a second script.
:::

Scripts are ES modules whose default export extends `NordScript`. The one import is `nord`:

```js
import { NordScript } from 'nord';

export default class Spinner extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 90, min: 0, max: 720, label: 'Degrees per second' },
  };
  update(dt) {
    this.entity.rot[2] += this.attrs.speed * dt;
    this.entity.touch();          // tell the backend we edited the array in place
  }
}
```

::: dummies
A script is a list of instructions glued onto an entity. The engine calls your functions at the right moments
(`start` when the level begins, `update` every picture/frame, …). `dt` is "how many seconds since the last frame" — multiply by it so things move at the same speed on slow and fast computers.
:::

## Lifecycle
| Hook | When |
|---|---|
| `init()` | once, after construction, before any `start()` |
| `start()` | once, when the scene begins (all entities exist). Spawned entities start on the next frame |
| `update(dt)` | every frame, seconds |
| `fixedUpdate(dt)` | fixed 60 Hz — use for physics-related logic |
| `lateUpdate(dt)` | after every `update` (cameras, followers) |
| `onEnable()` / `onDisable()` | entity enabled / disabled |
| `onDestroy()` | entity destroyed |
| `onCollisionEnter(other, contact)` / `onCollisionExit(other)` | solid contact (`other` is an Entity) |
| `onTriggerEnter(other)` / `onTriggerExit(other)` | overlap with a `trigger` / trigger collider |
| `onHotReload(oldState)` | after the file was hot-swapped |

An exception in any hook is caught, shown in the Console (and an on-screen overlay) and the game keeps running.

## Attributes
`static attributes` declares inspector-editable parameters. Types: `number, int, bool, string, color, vec2, vec3, enum (options), entity, asset (assetType), curve, array`.
Values from the scene are validated, clamped to `min`/`max`, and unknown keys warn. Read them from `this.attrs`.
Full table: [Project format → attribute types](project-format.html#attribute-types).

## The entity API
`this.entity` has: `name, id, tags, enabled, parent, children, pos, rot, scale, worldPos`, `find(name)`, `findByTag(tag)`, `hasTag`, `getComponent(type)`,
`addComponent(type, data)`, `set(type, key, value)`, `getScript(Class)`, `addScript`, `on/off/emit`, `destroy()`, `clone()`, and `native` (escape hatch).
Reference: [Entity](api-entity.html).

Position arrays can be replaced (`e.pos = [x, y, 0]`, syncs automatically) or edited in place followed by `e.touch()`.

## Events
Two buses: the **global** one (`this.events` / `game.events`) and a **per-entity** one (`entity.on/emit`). Handlers are removed with the function returned by `on`.

```nord-live
const bus = new nord.Events();
const off = bus.on('score', (n) => log('score +' + n));
bus.emit('score', 10);
off();
bus.emit('score', 5);   // nobody is listening
log('done');
```

## Timers and tweens
`this.after(sec, fn)`, `this.every(sec, fn)` and `this.tween(target, to, opts)` all return a **cancel** function and respect `game.timeScale`.
Easing names: see [Math & helpers](api-helpers.html#ease).

```nord-live
const s = new nord.Scheduler();
const box = { x: 0 };
s.tween(box, { x: 100 }, { duration: 1, ease: 'cubicOut', onComplete: () => log('tween done at x=' + box.x) });
s.after(0.5, () => log('half a second: x=' + Math.round(box.x)));
for (let i = 0; i < 70; i++) s.update(1 / 60);   // the engine does this for you
```

## Spawning and finding
```js
const bullet = await this.scene.spawn('prefabs/bullet.prefab.json', { pos: this.entity.worldPos });
const boss = this.scene.find('Boss');            // by name
const coins = this.scene.findByTag('coin');
this.game.loadScene('scenes/level2.scene.json');
```

## Hot reload
When you save a `.js` script during Play (or via `nord serve`), Nord re-imports it with a cache-buster and **swaps the prototype of every live instance**,
keeping its fields. Attributes are re-resolved against the new class. Define `onHotReload(oldState)` if you need to rebuild something (for example re-create DOM).
Imports *of* the script (helper modules) are not re-fetched — reload the page for those. A syntax error leaves the game untouched and shows the error.

## Debugging
* `console.log` in a game shows up in the editor Console with a clickable `file.js:line`.
* Errors show on screen (red overlay at the bottom; click to dismiss) and in `game.errors`.
* The library has `util-debug.js` (FPS/entity counters) — see the [catalog](library-catalog.html#utilities).
* Use `game.timeScale = 0.1` to watch fast things; `game.pause()` to freeze.

## Scripts in Rust
The Rust tiers use a `Script` trait instead — see [Rust / WASM](rust-wasm.html).


## Restart the current scene from saved data

`this.game.restart()` returns a promise for a fresh current scene, like loading the level again. It destroys old entities/scripts and scheduled callbacks, rebuilds from saved JSON, resets the clock and time scale, clears held/virtual input and resumes even from Pause. Persist entities reset by default; use `restart({ preservePersistent: true })` only when you want to migrate them. Normal `loadScene(path)` transitions keep Persist state.

```js
this.ui.button('Restart', () => { this.game.restart(); return; });
```

Keep run state in script instances and clean up custom listeners, UI, native objects and audio in `onDestroy()`. Save storage and asset/script module caches survive. Restart does not undo external server state or reload edited source modules; use Stop/Play for source changes. Existing copied projects need **Upgrade runtime**. T39 demonstrates a complete scene-based restart; T40 and T41 show HTML apps resetting their own rule state and server rounds.

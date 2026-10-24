---
title: 35 · Structuring a bigger game: patterns you know from Unity
section: Examples
order: 35
summary: Event channels, singletons and services, state machines, command/undo, data-driven design, folders and naming, so a project stays tidy as it grows.
---

## Folder layout
```
scripts/
  core/          game-manager.js  audio-manager.js  save-system.js     (singletons: one each)
  player/        player.js  player-input.js  player-health.js
  enemies/       enemy.js  enemy-spawner.js  states/chase.js …
  ui/            hud.js  pause-menu.js  options.js
  util/          pick.js  math.js  constants.js                        (plain modules, no engine base class)
data/            items.json  enemies.json  waves.json                  (designer-editable)
prefabs/  scenes/  ui/  anim/  assets/  models/
```
Folders inside `scripts/` are free; the Inspector lists scripts by path. Import with relative paths.

## Small scripts that talk by events
One script, one job (movement, health, weapon, animation). They communicate with **events** instead of references ([Events](ex-events.html)): the weapon emits `fired`, the animator script plays a clip, the audio script plays a sound, the HUD updates ammo. Add a feature = add a listener; nothing else changes.

## "Scriptable event channels" (Unity SO events) = the global bus
```js
// constants.js
export const EVT = Object.freeze({ SCORE: 'score', PLAYER_DIED: 'player-died', WAVE: 'wave' });
// anywhere
this.game.events.emit(EVT.PLAYER_DIED, { cause: 'spikes' });
this.game.events.on(EVT.PLAYER_DIED, () => this.ShowRetry());
```
Constants avoid typos in event names.

## Service locator / singletons
`class AudioService extends Singleton` → `AudioService.instance.Play('coin')` ([GameManager](ex-game-manager.html)). Keep the number of singletons small (game manager, audio, save, maybe input). Everything else is found by tag/name or receives what it needs through events.

## Dependency injection, the Nord way
Attributes of type `entity` give a script the *name* of another object to use, set in the Inspector instead of hard-coded:
```js
static attributes = { target: { type: 'entity' }, prefab: { type: 'asset', assetType: 'prefab' } };
start() { this.t = this.scene.find(this.attrs.target); }          // [SerializeField] Transform target
```

## State pattern (classes instead of a switch)
```js
class Idle { enter(o) {} update(o, dt) { if (o.wantsRun()) return new Run(); } exit(o) {} }
class Run  { enter(o) { o.play('run'); } update(o, dt) { o.move(dt); if (!o.wantsRun()) return new Idle(); } }

export default class Hero extends MonoBehaviour {
  Awake() { this.state = new Idle(); this.state.enter(this); }
  Update(dt) {
    const next = this.state.update(this, dt);                      // a state returns the next state, or nothing to stay
    if (next) { this.state.exit(this); this.state = next; this.state.enter(this); }
  }
}
```
For animation-driven logic use the Animator controller; for enemies see [AI](ex-ai-states.html).

## Command pattern with undo
```js
class MoveCmd { constructor(unit, to) { this.unit = unit; this.to = to; this.from = [...unit.pos]; } do() { this.unit.pos = this.to; } undo() { this.unit.pos = this.from; } }
const history = [];
const run = (c) => { c.do(); history.push(c); };
const undo = () => history.pop()?.undo();
```
Turn-based and puzzle games, level editors, replays (record the commands, replay them with the same seeded `new Rng(seed)`).

## Data-driven design
Put numbers in JSON ([Data assets](ex-data-assets.html)): enemy stats, item tables, wave definitions, dialogue. A script reads its row by an Inspector `kind` field. Designers (or you, later) tune the game without touching code.

## Object lifetimes
* Anything you subscribe to (`events.on`, `entity.on`) → unsubscribe in `onDestroy`.
* Anything you create in the UI layer (`ui.label`…) → remove in `onDestroy`.
* Timers/tweens/coroutines of an object die with it; with the scene.
* Persistent objects keep their fields across scenes ([Scenes](ex-scenes.html)).

## Avoid
God scripts (one 1000-line `Game.js`), updating things every frame that only change on events, searching with `find()` in `update`, cross-importing scripts in circles, and storing game state in the scene objects when it belongs in the GameManager / save data.

## Code quality tools
The editor's Code tab underlines errors and offers completion; `nord check` validates scenes and references; the smoke approach used by this documentation (a headless browser running scripted checks) works for your game too ([Optimising and testing](ex-optimization-testing.html)).

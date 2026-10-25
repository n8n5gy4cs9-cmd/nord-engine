---
title: 39 · Optimising and testing your game
section: Examples
order: 39
summary: Find slow scripts with the profiler, pool objects, cache lookups, keep assets small, and test logic and gameplay automatically.
---

## Find the problem first (Unity: Profiler)

**File: your script, for example `scripts/Game.js`** (inside `Start()`; the same numbers are in the editor's **Profiler** tab)
```js
const dbg = this.game.enableDebug();         // or the editor's Profiler tab
```
It records the time per phase (fixed + physics, timers, scripts, components, behaviors, late, cleanup) and the cost of **every script method** (`Enemy.update` …), plus spikes and network numbers. Open **Window ▸ Profiler**: look at the top of the script list. Fix the top entry, measure again ([Profiler tutorial](tut-t52-profiler.html)).

## Typical fixes
| Problem | Fix |
|---|---|
| `scene.find('X')` / `findByTag` in `update` | find once in `start()`, store the reference (check `destroyed`) |
| creating and destroying many objects (bullets, particles) | `ObjectPool` ([Spawning](ex-spawn-destroy.html)) |
| looping over every entity every frame (`scene.all()`) | keep your own array of the things you need, update it on spawn/destroy events |
| many small scripts doing the same each frame | one manager script that loops over its group |
| `overlapBox` for every enemy every frame | do it every few frames: a timer `if ((this.t += dt) > 0.1)` |
| huge textures | 2048 px or less; pixel art at its real size with *nearest* filter; `nord build --optimize` |
| long audio as WAV | use mp3 / ogg |
| lots of UI elements updating each frame | update labels only when the value changes (`events`), not in `update` |
| expensive post effects | fewer effects, test on the weakest target; `postProcess` sparingly in 3D |

## Frame time budget
60 fps = 16 ms per frame. The game loop caps one frame at 0.25 s, so a slow frame never causes a giant physics step. `this.game.time.delta` is the (scaled) frame time; `this.game.debug?.stats()` returns numbers you can show on screen.

## Memory
Scene objects and their scripts are garbage collected after `destroy()` and scene changes: just remove your listeners, UI elements and references (`events.on` returns an unsubscribe function; call it in `onDestroy`).

## Test your logic: plain Node tests
Put game rules in plain modules with no engine dependency, and test them with Node's built-in runner:

**File: `scripts/util/score.js`** (new file; plain JavaScript with no engine imports so Node can test it)
```js
// scripts/util/score.js
export const bonus = (combo) => Math.min(5, 1 + Math.floor(combo / 3));
```

**File: `scripts/util/score.test.mjs`** (new file next to `score.js`)
```js
// scripts/util/score.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { bonus } from './score.js';
test('combo bonus', () => { assert.equal(bonus(0), 1); assert.equal(bonus(9), 4); assert.equal(bonus(99), 5); });
```

**Terminal** (in the project folder):
```bash
node --test scripts/util/
```
The engine core itself is tested like this (`node --test runtime/core/`), including a fake game for script lifecycle tests (see `runtime/core/core.test.mjs` for the pattern).

## Test gameplay: a headless smoke run
The most useful automatic test for a game: start it in a headless browser, drive it, and assert on the state. This is how the example games in this documentation are verified (`node tools/example-shots.mjs`, `node tools/examples-smoke.mjs` in the engine repository). The recipe:
```js
// 1. serve the project:  nord serve my-game -p 4170
// 2. in a headless Chromium (CDP / Playwright), open http://localhost:4170/ and wait for window.__nord_ready
// 3. window.__nord is the running Game: drive and inspect it
const g = window.__nord;
g.input.setKey('KeyD', true);                       // hold a key
await new Promise((r) => setTimeout(r, 1000));
g.scene.find('Player').pos;                          // assert on positions, scores, g.errors.length === 0
```
Use the seeded random generator for repeatable runs: `new Game(project, { seed: 42 })` (or in the page: `g.rng = new Rng(42)`).

## Replays and determinism
Gameplay code that uses `this.game.rng`, `dt` and input actions (never `Math.random()` / `Date.now()`) is repeatable: record the inputs per frame and the seed, replay later for bug reports or a ghost run.

## Before you blame the engine
Errors never kill the game loop: look at the Console / `g.errors`; they carry the script name, the method and the stack. See [Debugging](ex-debug-tools.html).

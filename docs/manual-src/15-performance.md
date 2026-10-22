---
title: Performance & debugging
section: Manual
order: 15
summary: Profiling, pooling, texture and physics budgets.
---

When a game is slow, first find what takes time. Look for expensive scripts, too many drawn objects or large assets, then change one thing and compare.

::: dummies
A frame is one picture of the game. At 60 frames per second, each frame has about 16.7 milliseconds to finish. Most slowness comes from doing too much *every frame*: too many objects, pictures that are too big, or creating and throwing things away constantly. Measure first; do not optimize code just because it looks complicated.
:::

## Rules of thumb
* **Reuse, don't recreate.** Use `Pool` (`new nord.Pool(factory, reset)`) or the library's `util-pool.js` for bullets, particles and damage numbers; `spawn` is async and does JSON work.
* **Textures:** keep power-of-two-ish sizes, pack small sprites into one sheet, avoid 4K backgrounds in 2D. `nord build --optimize` recompresses PNGs losslessly.
* **Physics:** use `static` for anything that never moves; prefer `arcade` over `matter` unless you need rotation/polygons; keep triggers small in number.
* **Scripts:** avoid allocating arrays in `update`; cache `find()` results in `start()`; use `fixedUpdate` only for physics-coupled code.
* **3D:** one shadow-casting light, shadow map 1024, share materials/models, limit `postProcess` effects, keep particles capped (`capacity`).
* **DOM UI:** update labels only when the value changes.

## Measuring
* `util-debug.js` (library) shows FPS/entity counts.
* Browser dev tools: when running with `nord serve`, open the URL in Chrome/Safari for the Performance tab.
* `game.time.delta` gives the last frame time; the scheduler clamps big spikes to 0.25 s so a hiccup can't explode the simulation.
* `nord build` prints a size report; keep an eye on audio — music is usually the biggest asset.

## Timing facts
The scene runs `fixedUpdate` at a fixed 60 Hz with at most 5 catch-up steps per frame, then `update`, component updates and `lateUpdate` once per frame. Tweens/timers use the scaled `dt`.

## Debugging checklist
1. Red overlay or Console error? Click the `file:line`.
2. `nord check` — missing files, duplicate ids, bad scripts.
3. Blank canvas on export? Serve over http (not `file://`) unless you used `--single-file`.
4. Audio silent? It needs a first click/key — queued sounds then play.

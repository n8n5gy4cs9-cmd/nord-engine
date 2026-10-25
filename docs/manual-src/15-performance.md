---
title: Performance & debugging
section: Manual
group: Test and publish
order: 15
summary: Profiling, pooling, texture and physics budgets.
---

## Use this page

This chapter explains **performance & debugging**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| Rules of thumb | [Read this section](#rules-of-thumb) |
| Measuring | [Read this section](#measuring) |
| Timing facts | [Read this section](#timing-facts) |
| Debugging checklist | [Read this section](#debugging-checklist) |

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

## Logging: where does my console.log go? {#logging}
Print from anywhere; the line appears in the **editor's Console tab** while you play from the editor, and in the browser's developer console when you open the game in a browser.

| You write | Where | Notes |
|---|---|---|
| `console.log('hp', hp)` | any script, module or HTML app | Objects are shown as JSON. `console.warn` / `console.error` are coloured in the editor Console (tick **Warn** / **Error** filters). |
| `this.log('hit', other.name)` | inside a `NordScript` | Same, with the script's class name in front: `[Player] hit Coin 3`. Also `this.warn(...)`, `this.error(...)`. |
| `game.log(...)` | anywhere you have `game` | Plain alias for `console.log`. |
| **Log** node (set *level* to warn or error) | node graphs | Prints `[graph graphs/player.graph.json] …`. |
| The debugger's expression console | event sheets and any game | Evaluate values live: see [Debugger](debugger.html). |
| Uncaught errors | everywhere | Always shown in red with `file:line`; click the line to open it. |

**It only prints if the code actually runs.** The commonest reasons for an empty Console:
1. **The script or graph is not attached.** A script file does nothing until an entity lists it (Inspector ▸ Scripts). A graph does nothing until a scene lists it in `settings.graphs` or an entity has the **graph** component. The Graph editor tells you (*"Nothing runs this graph yet"*) and its **Add to current scene** button fixes it; then save the scene and press **Play**.
2. **You are looking at the wrong place.** Press **Play** in the editor (Game tab) and read the editor **Console**. A game opened in a separate browser tab prints to that tab's developer console instead.
3. **A filter is hiding it.** Check **Info/Warn/Error/Build** and the **Filter…** box.
4. **The code path is never reached.** *On Start* fires on the first frame; *On Input Action* needs a key actually bound to that action in the project's input settings; an `if` that is false prints nothing. Add a log line at the very top (`console.log('script started')`) and work forward.
5. **An error stops it earlier.** Look for a red line above: one failing node or script method stops that chain, not the whole game.
6. **Old page.** Saving a script hot-reloads it, but a changed graph/scene reloads the game; if you edited files outside the editor, press **Reload** in the toolbar.



## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).

---
title: Debugger and profiler
section: Manual
group: Test and publish
order: 21
summary: Pause, step, breakpoints on events, live instance editing, an expression console and a frame profiler — in any running game.
---

## Use this page

This chapter explains **debugger and profiler**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| Deep profiling | [Read this section](#deep-profiling) |

The debugger lets you pause a running game, step one frame at a time, inspect every object and see which logic is slow.

::: dummies
It is the same idea as a car's dashboard and pit-stop tools: you watch the numbers while the game runs, stop it to look closer, and fix what you find.
:::

Add `?debug` to the game's address (or set `"debug": true` in `nord.project.json`) and press **F9**. It costs nothing when it is off.

<figure class="shot"><img src="assets/screenshots/es-7-debug-events.png" alt="Debugger overlay listing events; the ones that ran this moment are green" loading="lazy"><figcaption>The <b>events</b> tab: green rows ran in the last few ticks. Click a row to put a 🔴 breakpoint on it.</figcaption></figure>

- **Pause / Step / Resume** — Step runs exactly one frame.
- **Breakpoints** — click an event in the *events* tab. The game pauses at the end of the frame in which that event ran.
- **instances** — every live object with its position and instance variables; click a variable to change it while the game is paused or running.
- **console** — type any event-sheet expression (`coins + lives`, `Hero.X`, `Inventory.Count`) and press Enter.
- **profiler** — frame time graph (red bars are slow frames), average/worst frame, object count, draw calls (when the renderer reports them), JS heap (Chrome) and the **cost of each top-level event or group** so you can see which logic is slow. *Reset stats* starts a new measurement.

## Deep profiling
The **details** tab (and the editor's **Window ▸ Profiler**) goes further than the graph:
- **Phases**: average milliseconds per frame for `fixed+physics`, `systems`, `scripts`, `components`, `behaviors`, `late`, `cleanup`.
- **Scripts**: total time and call count per script method (`Player.update`). **Components**: per component type.
- **Slow-frame spikes**: every frame over 25 ms with the most expensive script of that frame.
- **network**: ping, bytes per second, dropped messages, simulated lag (see [Multiplayer](multiplayer.html)).
- **● Record** keeps up to a minute of frames; **Save profile** writes `profiles/profile-N.json` in the editor (a download in the browser overlay). Format and limits: `docs/PROFILER.md`. Guided practice: [T52](tut-t52-profiler.html).

From code: `const d = game.enableDebug(); d.pause(); d.step(); d.toggleBreakpoint('2.0'); d.evaluate('score * 2'); d.stats();`. Events are identified by their position in the sheet (`2.0` = the first sub-event of the third entry).


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).

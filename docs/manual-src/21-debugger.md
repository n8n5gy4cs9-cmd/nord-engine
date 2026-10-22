---
title: Debugger and profiler
section: Manual
order: 21
summary: Pause, step, breakpoints on events, live instance editing, an expression console and a frame profiler — in any running game.
---

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

From code: `const d = game.enableDebug(); d.pause(); d.step(); d.toggleBreakpoint('2.0'); d.evaluate('score * 2'); d.stats();`. Events are identified by their position in the sheet (`2.0` = the first sub-event of the third entry).

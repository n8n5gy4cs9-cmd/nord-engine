---
title: T52 Find the slow part (Profiler)
section: Tutorials
order: 52
summary: Use the per-phase, per-script and per-component profiler, catch a slow frame with its culprit, record a session and save the profile.
---
**Result:** you find a deliberately slow script, fix it, and keep a saved profile. Allow 20 minutes. **Start from:** any project with a scene and a script.

::: dummies
A game must finish each frame in about 16 milliseconds. If one script takes 12 of them, everything stutters. The profiler shows where the time goes, per script, so you fix the right thing.
:::

## 1. Make something slow
Add to any entity's script:

**File: any script of the scene, for example `scripts/Hero.js`** (replace or add the `update()` method; remove it when you are done)
```js
update() { let x = 0; for (let i = 0; i < 400000; i++) x += Math.sqrt(i); }
```

## 2. Look
1. Press **Play**, open **Window ▸ Profiler**. The graph shows frame time; red bars are slow frames.
2. **Phases** lists the average milliseconds per frame for each part of the frame (`fixed+physics`, `systems`, `scripts`, `components`, `behaviors`, `late`). `scripts` should be the big one.
3. **Scripts** lists the cost of each script method, e.g. `MyScript.update`. **Components** lists the cost per component type.
4. **Slow-frame spikes** names the frame and the most expensive script in it.

In a browser game add `?debug`, press **F9** and open the **details** tab: same numbers.

## 3. Record and save
Press **● Record**, play for a few seconds, **■ Stop recording**, then **Save profile**: `profiles/profile-1.json` contains every recorded frame with its phase times, the script and component totals, spikes and network numbers. Fix the script (delete the loop), record again, and compare the two files.

**Check yourself:** `Scripts` shows your method on top before the fix and far below after. Profiling costs nothing when the profiler is closed. Reference: [Debugger and profiler](debugger.html), `docs/PROFILER.md`. **Next:** [T53 Two players](tut-t53-multiplayer.html).

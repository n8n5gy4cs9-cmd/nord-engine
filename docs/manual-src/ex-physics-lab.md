---
title: 64 · Physics Lab: a bench for the Unity physics layer
section: Examples
order: 64
summary: Open the Physics Lab and the Shadertoy Lab projects, run their self-tests in the browser, and see what each check proves. Also how the play-mode editing of the Unity-style editor works.
---

**Goal:** have three small projects that exercise everything on the Unity-API pages, and know how to run their checks.

| Project | What it is | Folder |
|---|---|---|
| **Physics Lab** (2D) | circle, capsule, concave polygon, composite walls, a hinged pendulum, a spring, a ramp, a trigger | `examples/physics-lab` |
| **Physics Lab 3D** | a hinged door, a fixed pair, a spring weight, boxes and a capsule for the casts | `examples/physics-lab-3d` |
| **Shadertoy Lab** | five shaders: plasma background, tunnel, paint (Buffer A), keyboard, audio spectrum, and the CRT post effect | `examples/shadertoy-lab` |

## Open and run
**Terminal** (in the Nord folder):
```bash
./target/debug/nord serve examples/physics-lab
```
Open the printed address. Add `?debug` to the address to see the collider outlines (matter), and `?physics=arcade` to switch the 2D engine (the Lab then skips the matter-only checks). The same projects open in the editor: @ui[New project ▸ Open] `examples/physics-lab`, then @ui[Play].

## Run the self-test
Every Lab has a script `scripts/lab.js` that publishes itself as `window.__lab`. Press F12 (or use the Console of the in-app browser) and run:

**Example** (not a file: type it into the browser console of the game page)
```js
const results = await __lab.selfTest();
results.filter((r) => !r.ok)       // empty = everything passed
```
The game pauses itself, steps the world by hand and returns `{ name, ok, info }` for each check. The test scripts `tools/physics-lab-test.mjs` and `tools/shadertoy-lab-test.mjs` run exactly this in headless Chromium and assert that nothing failed (they need Playwright, see `docs/TESTING.md`; the checks themselves need only a browser).

> **Trap:** A browser tab that is not on screen stops drawing frames, so game time stops too. The test waits in **game time**; keep the tab visible while it runs.

## What the 2D checks prove (matter)
| Check | What it proves |
|---|---|
| capsule rests on the floor | capsule colliders have round ends and do not tunnel |
| L polygon stays finite | a concave outline works as several convex pieces |
| composite: left / right hit, gap open, children have no body | `composite` merges the children into one solid with the gap kept |
| hinge keeps its rod length | joints with a lever arm are stable (parallel-axis inertia) |
| spring settles near its rest length | `frequency` / `dampingRatio` give a spring that holds |
| `IgnoreCollision` passes through the floor | Matter drops the pair before it is solved |
| `freezePositionX`, `constraints` setter | axis constraints hold, also when set from a script |
| continuous detection stops at a thin wall (discrete one tunnels) | the sweep check in front of a fast body |
| interpolation draws between two steps | the container is drawn between the last two steps and restored before the next |
| `Raycast` sees the capsule, `OverlapPoint` inside it | the queries read the real shapes |

## What the 3D checks prove (Havok)
Queries (`RaycastAll`, `SphereCast`, `BoxCast`, `CapsuleCast`, overlaps, `Check*`, `RaycastNonAlloc`), camera round trip and ray picking, a hinged door that keeps its radius, a fixed pair that falls together, a spring weight that hangs, `freezePositionX` + `freezeRotationY`, `IgnoreCollision`, `IgnoreLayerCollision`, continuous detection and the hinge motor.

## What the Shadertoy checks prove
Five shaders compile and run, the tunnel draws colour, Buffer A keeps what the mouse painted in a float buffer, the keyboard texture is uploaded, `setUniform` accepts any name, the scene post effect adds an overlay canvas and removes it again.

## Play mode in the editor
These projects are also a good place to try the Unity-style play mode of the editor:
* **Play and Stop return you to where you were.** Press Play with the Scene view in front: the Game view comes up. Press Stop: the Scene view is back. Start from the Game view and Stop leaves you in the Game view.
* **Edit while playing, nothing is saved.** While the game runs the Hierarchy and Inspector show the live objects. Change a position, a scale or any field of a component or script: the running game changes at once. Drag an object with the Scene-view gizmo: it moves in the game. When you press Stop, all of it is thrown away and the scene file is exactly as before.

## Check yourself
* `await __lab.selfTest()` returns no failed entries on both Phaser engines (arcade shows fewer checks) and on Havok.
* Dragging the pendulum's bob in the Scene view while playing swings it; after Stop it hangs where the file says.

Next: [Unity API map](ex-unity-api.html). Back to: [Physics 3D and joints](ex-unity-api-physics3d.html).

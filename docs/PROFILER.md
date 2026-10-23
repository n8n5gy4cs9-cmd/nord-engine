# Profiler (deep profiling, 2026-10-23)
Runtime: `runtime/core/debug.js` (`Debugger`), hooks in `Scene.tick` (phases, component update), `Entity.callScripts` (per script method). Everything is **off by default and costs one property read** until `game.enableDebug()` / `?debug` / the editor's Window ▸ Profiler turns it on.

## What is measured
| Measure | Where | Notes |
|---|---|---|
| Frame time, worst frame, fps estimate, objects, draw calls, heap | `debug.stats()` | existing (M10-23) |
| **Phases** (ms per frame, last 120 frames) | `stats().phases` | `fixed+physics`, `systems`, `scripts`, `components`, `behaviors`, `late`, `cleanup` |
| **Scripts** (total ms + calls since reset) | `stats().scripts` | key `ScriptClass.method` (`Player.update`, `Ball.onCollisionEnter`) |
| **Components** | `stats().components` | per component type (`light`, `animator`, `postProcess`, …) |
| **Spikes** | `stats().spikes` | frames over `slowMs` (default 25): frame number, ms, phase breakdown, most expensive script of that frame |
| **Network** | `stats().net` | `game.net.stats()`: peers, ping, bytes/s, dropped, simulator |
| Event-sheet cost | `stats().costs` | existing |

## Recorder and export
`debug.record(true)` keeps up to 3600 frames (`{frame, ms, phases, heapMB, net}`); `debug.exportProfile()` returns a plain object, format **`nord-profile-1`**: `{ format, at, project, scene, summary, phases, scripts, components, events, spikes, net, frames }`. Overlay (F9) tab **details**: Record / Save profile (browser download). Editor: **Window ▸ Profiler** shows phases, scripts, components, spikes and network, with **● Record** and **Save profile** (writes `profiles/profile-N.json` through the game's `/api/ipc` message `{t:"profile", json}`).

## Limits
Timing uses `performance.now()` (sub-millisecond, coarse in some browsers). Script time includes engine callbacks they trigger (e.g. `entity.set`). Rendering time is not split out (backends draw outside `Scene.tick`). Component time covers the component's `update` only. Tests: `runtime/core/profiler.test.mjs`.

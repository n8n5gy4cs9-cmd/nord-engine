---
title: Welcome
section: Manual
order: 1
summary: What Nord is, the three tiers, install and first launch.
---
Nord Engine is a personal engine plus a native editor. You build a game or app visually (hierarchy, inspector, viewport), script it in
JavaScript (or Rust), and **export a static folder** that runs in any browser — or wrap it into a Mac app.

::: dummies
Think of Nord as a workshop. The **editor** is the workbench where you arrange things. The **runtime** is the little engine that makes
your game move when it is played. **Export** packs everything into one folder you can put on any website.
:::

New here? Start with [Getting started](getting-started.html) and [How Nord works](how-nord-works.html).

## The tiers

You pick a tier per project (`type` in `nord.project.json`). All tiers share the same project folder layout and scene format.

| Tier | `type` | Runs on | Use it for |
|---|---|---|---|
| HTML | `html` | your own HTML/JS (+ optional `nord-lite.js` helpers) | small games, tools, apps with plain DOM/canvas |
| 2D | `2d` | **Phaser 4** (Arcade or Matter physics) | platformers, shooters, puzzle, top-down |
| 3D | `3d` | **Babylon.js 9** + Havok physics | first-person, racing, 3D platformers |
| Rust game | `wasm-game` | macroquad + rapier2d compiled to WebAssembly | CPU-heavy 2D sims, Rust-only logic |
| Rust app | `wasm-app` | eframe/egui compiled to WebAssembly | tools, dashboards, native-feeling apps |

`nord doctor` checks your toolchain and recommends a tier. Start with **Nord's own API**
(`NordScript`, `entity.*`, `game.*`). Raw engine objects are only reachable through the `entity.native` escape hatch.

## Install and first launch (macOS)

1. Build or open the app: `./build.sh` produces the editor `.app`; `./run.sh [project]` runs it from source.
2. A splash screen shows for at least two seconds, then the **project hub** opens: *New* (template picker), *Open*, *Recent*, *Examples*, *Tutorials*.
3. Pick a template (for example **Platformer**) and press **▶ Play** (Cmd+R).

Optional command line (the `nord` tool ships next to the editor and is not on your PATH by default; see [Getting started, Part 10](getting-started.html#part-10-the-optional-nord-command)):
```
nord new my-game -t platformer
nord serve my-game          # dev server with live reload on http://localhost:4173
nord build my-game          # static export into my-game/dist
```

::: tip
The whole manual is offline and also lives inside the editor's **Docs** tab. Press `/` anywhere on this site to search.
:::

## How this manual is organised
* **Manual** — chapters 1–17, read in order or jump around.
* **Tutorials** — T01–T18, each builds something and points to a runnable project.
* **Guides** — cheat sheets, cookbook, glossary, shortcuts.
* **API / Components / Reference** — generated from public source contracts, with curated usage notes: JS classes, every component, the CLI, the library catalog.

::: dummies
Every concept page can hide a purple **For dummies** box like this one. Plain-language
explanations are shown by default; the top-bar switch hides them once you know the ropes.
:::

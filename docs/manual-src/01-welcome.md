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

## The tiers

You pick a tier per project (`type` in `nord.project.json`). All tiers share the same project folder layout and scene format.

| Tier | `type` | Runs on | Use it for |
|---|---|---|---|
| HTML | `html` | your own HTML/JS (+ optional `nord-lite.js` helpers) | small games, tools, apps with plain DOM/canvas |
| 2D | `2d` | **Phaser 4** (Arcade or Matter physics) | platformers, shooters, puzzle, top-down |
| 3D | `3d` | **Babylon.js 9** + Havok physics | first-person, racing, 3D platformers |
| Rust game | `wasm-game` | macroquad + rapier2d compiled to WebAssembly | CPU-heavy 2D sims, Rust-only logic |
| Rust app | `wasm-app` | eframe/egui compiled to WebAssembly | tools, dashboards, native-feeling apps |

`nord doctor` checks your toolchain and recommends a tier. You never write Phaser or Babylon code: scripts use **Nord's own API**
(`NordScript`, `entity.*`, `game.*`). Raw engine objects are only reachable through the `entity.native` escape hatch.

## Install and first launch (macOS)

1. Build or open the app: `./build.sh` produces the editor `.app`; `./run.sh [project]` runs it from source.
2. A splash screen shows for at least two seconds, then the **project hub** opens: *New* (template picker), *Open*, *Recent*, *Examples*, *Tutorials*.
3. Pick a template (for example **Platformer**) and press **▶ Play** (Cmd+R).

Command line (any OS):
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
* **API / Components / Reference** — generated from the source, so they cannot drift: JS classes, every component, the CLI, the library catalog.

::: dummies
Every concept page can hide a purple **For dummies** box like this one. Flip the switch in the top bar if you want plain-language
explanations and analogies; leave it off once you know the ropes.
:::

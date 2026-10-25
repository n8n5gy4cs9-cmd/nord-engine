---
title: Welcome
section: Manual
group: Getting oriented
order: 1
summary: What Nord is, the project types, how to open it, and a map of every chapter.
---

## Use this page

This chapter explains **welcome**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| The tiers | [Read this section](#the-tiers) |
| Open the editor | [Read this section](#open-the-editor) |
| How this manual is organised | [Read this section](#how-this-manual-is-organised) |

Nord Engine is a game and app editor, in the spirit of Unity or Godot. You build visually (Hierarchy, Inspector, Scene view), add behaviour with ready-made tools, event sheets or scripts in JavaScript (or Rust), and **export a static folder** that runs in any web browser, or wrap it into a desktop app.

::: dummies
Think of Nord as a workshop. The **editor** is the workbench where you arrange things. The **runtime** is the little engine that makes
your game move when it is played. **Export** packs everything into one folder you can put on any website.
:::

New here? Read [Getting started](getting-started.html) first (about an hour, all by clicking), then [How Nord works](how-nord-works.html). Nord also includes level-building tools: the [2D Level Creator](level-creator-2d.html) and the [FPS Creator](fps-creator.html).

## The tiers

You pick a tier per project (`type` in `nord.project.json`). All tiers share the same project folder layout and scene format.

| Tier | `type` | Runs on | Use it for |
|---|---|---|---|
| HTML | `html` | your own HTML/JS (+ optional `nord-lite.js` helpers) | small games, tools, apps with plain DOM/canvas |
| 2D | `2d` | **Phaser 4** (Arcade or Matter physics) | platformers, shooters, puzzle, top-down |
| 3D | `3d` | **Babylon.js 9** + Havok physics | first-person, racing, 3D platformers |
| Rust game | `wasm-game` | macroquad + rapier2d compiled to WebAssembly | CPU-heavy 2D sims, Rust-only logic |
| Rust app | `wasm-app` | eframe/egui compiled to WebAssembly | tools, dashboards, native-feeling apps |

The **Rust** project types need the Rust toolchain installed (the optional `nord doctor` command checks this and recommends a type). For a first project choose **2D**. Start with **Nord's own API**
(`NordScript`, `entity.*`, `game.*`). Raw engine objects are only reachable through the `entity.native` escape hatch.

## Open the editor
1. Open **Nord Engine.app**, or from a source checkout run `./run.sh` (add a project path to open it directly). `./build.sh` builds the app.
2. A splash screen shows briefly, then the **project hub** opens: *New* (templates), *Recent*, *Examples* and *Tutorials*.
3. Pick a template (for example **Platformer**) and press **▶ Play** (Cmd+R).

The step-by-step version, with a tour of every panel, is [Getting started](getting-started.html).

::: tip
The whole manual is offline and also lives inside the editor's **Docs** tab. Press `/` anywhere on this site to search.
:::

::: dummies
There is also an optional command-line program called `nord`, used for automation and build servers. You never need it to make a game. See [Getting started, Part 11](getting-started.html#part-11-the-optional-nord-command).
:::

## How this manual is organised
The manual has 29 chapters. You can read in order or jump to the one you need.

| Group | Chapters |
|---|---|
| **The basics** | [Editor tour](editor-tour.html) · [Projects and scenes](projects-scenes.html) · [Scripting](scripting.html) · [Input](input.html) · [Assets](assets.html) · [Library](library.html) |
| **Making things** | [2D](2d.html) · [3D](3d.html) · [Physics](physics.html) · [Audio](audio.html) · [UI](ui.html) |
| **Build without code** | [Event sheets](event-sheets.html) · [Behaviors](behaviors.html) · [2D Level Creator](level-creator-2d.html) · [FPS Creator](fps-creator.html) |
| **Art and polish** | [Sprites, animation and tilemaps](sprites-animation-tilemaps.html) · [Layout, layers and objects](layout-editor.html) · [Effects, particles and timelines](effects-particles-timelines.html) |
| **Test and fix** | [Debugger and profiler](debugger.html) · [Performance](performance.html) · [Preview, history and project tools](preview-history-tools.html) |
| **Extend** | [Addons, data objects and languages](addons-data-localisation.html) · [Rust / WASM](rust-wasm.html) |
| **Ship** | [Export and hosting](export.html) · [Desktop apps](desktop-apps.html) · [Run the editor in a browser](web-editor.html) |
| **Look things up** | [Reference overview](reference.html) · [Appendix](../appendix/appendix.html) |

Other sections of this site:

* **Tutorials** - [43 lessons](tutorials.html), from "Hello Nord" to complete games, with learning paths and filters.
* **Guides** - [cheat sheets, cookbook, glossary and shortcuts](cookbook.html).
* **API, Components, Reference** - generated from the source: JS classes, every component, the CLI and the library catalog.

::: dummies
Every concept page can hide a purple **For dummies** box like this one. Plain-language explanations are shown by default; the top-bar switch hides them once you know the ropes.
:::


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).

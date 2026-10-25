---
title: Reference overview
section: Manual
group: Test and publish
order: 16
summary: Where to find the nord.js API, component schemas, CLI, project format and shortcuts.
---

## Use this page

This chapter explains **reference overview**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| The one import | [Read this section](#the-one-import) |
| Escape hatch | [Read this section](#escape-hatch) |

::: dummies
This is a reference chapter: you do not have to complete every section. Choose one task, make that change in the editor, and press Play to check the result. An **entity** is an object in your scene; a **component** adds a capability; a **script** adds your own rules.
:::

Everything below is generated from the source or kept next to it, so it matches the code.

| I want to know… | Go to |
|---|---|
| What `this.entity`, `this.game`, `this.audio`… are | [game.* namespaces](api-namespaces.html) |
| A class's methods (Entity, Scene, Game, Input, Events, Save, Audio, UI, Scheduler, Rng, Pool, physics adapters) | the **API** section in the sidebar |
| Math/easing helpers | [Math & helpers](api-helpers.html) |
| A component's fields | [Component index](components.html) |
| `nord` commands | [Command line](cli.html) |
| JSON file formats | [Project format](project-format.html) |
| Ready-made scripts | [Library catalog](library-catalog.html) |
| Starter templates and examples | [Templates & examples](templates-examples.html) |
| Editor keys | [Shortcuts](shortcuts.html) |

## The one import

**Example** (not a file; the one import line every script starts with):
```js
import { NordScript, clamp, lerp, remap, vec, ease, Rng, Pool, Events } from 'nord';
```
`nord` maps to `runtime/core/index.js`. Backends add components and `game.camera` / `game.physics` / `game.gui`; scripts never import Phaser or Babylon.

## Escape hatch
When Nord lacks a wrapper, `entity.native` (Phaser Container / Babylon TransformNode) and fields like `component.obj`, `.mesh`, `.light`, `.camera`, `.ps`, `game.camera.native` give raw access. Treat it as a last resort: raw objects differ between 2D and 3D and between engine versions.


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).

---
title: Reference overview
section: Manual
order: 16
summary: Where to find the nord.js API, component schemas, CLI, project format and shortcuts.
---
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
```js
import { NordScript, clamp, lerp, remap, vec, ease, Rng, Pool, Events } from 'nord';
```
`nord` maps to `runtime/core/index.js`. Backends add components and `game.camera` / `game.physics` / `game.gui`; scripts never import Phaser or Babylon.

## Escape hatch
When Nord lacks a wrapper, `entity.native` (Phaser Container / Babylon TransformNode) and fields like `component.obj`, `.mesh`, `.light`, `.camera`, `.ps`, `game.camera.native` give raw access. Treat it as a last resort: raw objects differ between 2D and 3D and between engine versions.

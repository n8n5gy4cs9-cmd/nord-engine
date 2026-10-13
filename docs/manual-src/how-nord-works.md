---
title: How Nord works
section: Start here
order: 2
summary: Nord, Phaser, Babylon, WASM and WebGL explained without assumed knowledge.
---
**Nord is the place where you put your project together.** It provides an editor, scene files, scripts and export tools. It uses an existing engine underneath to draw and run the game.

## The pieces, in one minute

| Term | Plain English | Where you meet it |
|---|---|---|
| Editor | The workbench where you arrange things and edit settings. | NordEditor, before pressing Play. |
| Scene | A level, screen or collection of things that run together. | A `.scene.json` file. |
| Entity | One thing in the scene: a player, camera, lamp or label. | The Hierarchy panel. |
| Component | A feature attached to an entity: show a picture, collide, make light. | The Inspector's Add component menu. |
| Script | Instructions you write to make something happen. | A JavaScript or Rust file. |
| Runtime | The code running while someone plays your game. | Game view or an exported game. |
| Export | A packaged copy of the project for players. | The `dist` folder or desktop bundle. |

::: dummies
For a player character, the **entity** is the thing you select. A **sprite component** gives it a picture. A **physics component** makes it fall and collide. A **script** tells it to move when a key is pressed. You add only the features it needs.
:::

## What happens when you press Play?

1. Nord reads your project settings and the starting scene.
2. It creates the scene's entities and their components.
3. It calls your scripts at the right moments: once at startup, then repeatedly while the game runs.
4. The selected engine draws the result and runs its physics system.
5. Input, sounds, UI and saves connect your game to the player.

You usually work with **Nord's API**. For example, `this.entity.pos` means the position of the thing your script is attached to. Nord connects it to the object used by the selected engine.

## Phaser: Nord's 2D engine
**Phaser** draws flat pictures, text, tilemaps and particles. Nord's `2d` projects use Phaser **4.2.1**. Add Nord's `sprite`, `animatedSprite`, `tilemap` and physics components instead of constructing a separate Phaser game.

Phaser can draw using WebGL, with a Canvas fallback where supported. The physics choices are Arcade (simple and fast) and Matter (more complex shapes and motion).

**You do not need to learn Phaser first.** Use the [2D manual](2d.html) and [Nord component reference](components.html). The [Phaser reference](engine-docs.html) is useful when you need a capability Nord has not wrapped.

## Babylon: Nord's 3D engine
**Babylon.js** draws 3D models, cameras, lighting and materials. Nord's `3d` projects use Babylon **9.30.0**, with Havok for 3D physics.

Add Nord's `mesh`, `model`, `camera`, `light` and `rigidbody3d` components. The Babylon adapter turns them into engine objects. Read [the 3D manual](3d.html) for Nord's workflow; use [the underlying reference](engine-docs.html) for advanced engine details.

::: dummies
A **mesh** is the shape. A **material** is how its surface looks. A **camera** decides what you see. A **light** helps you see the shape. You need a camera and something visible before a 3D scene can look useful.
:::

## WebGL: asking the graphics chip to draw
**WebGL** is a browser graphics interface. Phaser and Babylon use it to ask the computer's graphics chip to draw pictures quickly. It is not a language you must learn to use Nord. You normally work with entities, components and scripts; the engine handles the drawing calls.

A **shader** is a small program that changes how pixels or surfaces are drawn. You can explore shaders later; you do not need one for your first game.

## WASM: running Rust in a browser
**WebAssembly**, shortened to **WASM**, is a format browsers can run. Nord compiles Rust projects into this format. It does not automatically convert JavaScript scripts into Rust.

- **`wasm-game`** uses macroquad to draw and Rapier for 2D physics. Game behavior is written in Rust.
- **`wasm-app`** uses egui/eframe for an app interface, also written in Rust.

WASM runs the program's logic. It is **not** a replacement for drawing: the game or app still needs its graphics runtime. Rust tiers use their own Rust APIs; they do not expose all JavaScript NordScript methods. [See the Rust guide](rust-wasm.html).

## HTML: a plain web app
The `html` tier starts with ordinary HTML, CSS and JavaScript. HTML describes the page, CSS controls its appearance, and JavaScript adds behavior. This tier is useful for tools and interfaces that do not need a 2D or 3D game scene.

## Which should I choose?

| You want to make… | Start with |
|---|---|
| A platformer, puzzle or top-down game | 2D / Phaser |
| A 3D world, driving game or first-person scene | 3D / Babylon |
| A notes app, dashboard or web tool | HTML |
| A game or app specifically written in Rust | Rust game or Rust app |

For your first game, **choose 2D**. It has fewer moving parts to learn. You can create a separate 3D project later.

## Nord APIs and engine APIs
Start with `NordScript`, `entity.*` and `game.*`. These are documented in [Nord's API reference](api.html).

When a feature has no Nord wrapper, certain components expose an underlying object such as `component.obj` or `component.mesh`; entities also have `entity.native`. This is an **escape hatch**. The underlying Phaser and Babylon objects have different methods, so engine-specific code needs the matching reference and version.

An engine's full API being documented here does not mean every method is a Nord method. Reference pages label their engine and version, and link back to the Nord way of doing common tasks.

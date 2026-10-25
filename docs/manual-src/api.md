---
title: API reference
section: API
order: 0
summary: Nord's complete public scripting surface, components, desktop bridge and engine references.
---
Coming from Unity? Start with the [Unity-style scripting API](api-unity.html).

Use this section when you know what you want to do and need an exact name, signature or setting. For a first project, start with [Getting started](getting-started.html).

## Nord scripting

| What you need | Reference |
|---|---|
| Write behavior on an entity | [NordScript](api-nordscript.html) |
| Move, find or change an entity | [Entity](api-entity.html) |
| Spawn a prefab or change scenes | [Scene](api-scene.html), [Game](api-game.html) |
| Read controls | [Input](api-input.html) |
| Play sounds | [Audio](api-audio.html) |
| Display a HUD | [UI](api-ui.html) |
| Save game data | [Save](api-save.html) |
| Send messages between scripts | [Events](api-events.html) |
| Delays, repeated actions and animation | [Scheduler](api-scheduler.html) |
| All imports from `nord` | [Public exports](api-exports.html) |
| Camera, physics and GUI shortcuts | [Game namespaces](api-namespaces.html) |

## Components and project data
[Component index](components.html) lists every built-in component. Each page includes fields, types, defaults, scene JSON, script handles and supported live changes. [Project format](project-format.html) explains the files these components live in.

## Desktop and Rust
[Desktop API](api-desktop.html) covers the typed JavaScript bridge, including files, dialogs, storage and windows. [Rust API](api-rust.html) lists public Rust declarations, alongside [the Rust guide](rust-wasm.html).

## Phaser and Babylon
[Engine documentation](engine-docs.html) includes version-matched public declarations for the engines Nord uses, the supplied Phaser documentation snapshot and cloned Babylon guides. These pages are labelled **underlying engine** APIs.

For most game code, use Nord components and `this.game` services. The engine reference helps with escape-hatch objects and features that have no Nord wrapper. An upstream method is not automatically available as a Nord method.

::: dummies
A **signature** tells you the inputs a function accepts. `play(path, options)` means give it a file path, and optionally settings. A **return value** is what the function gives back. If it returns a Promise, use `await` in an `async` function to wait for the result. Types describe values: `number` is a number; `string` is text; `boolean` is true or false.
:::

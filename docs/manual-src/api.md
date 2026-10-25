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
| Write new game behavior | [MonoBehaviour and Unity API](api-unity.html) |
| Move, find or change an entity | [Entity](api-entity.html) |
| Spawn a prefab or change scenes | [Scene](api-scene.html), [Game](api-game.html) |
| Read Unity-style controls | [Unity Input](api-unity.html#input) |
| Access the native input service | [Input service](api-input.html) |
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
[Engine API downloads](engine-docs.html) provides separate ZIPs for **Phaser 4.2.1** and **Babylon.js 9.30.0**, plus official online manuals and exact-version source links. Upstream API pages are available only inside those ZIPs; site search focuses on Nord.

For most game code, use Nord components and `this.game` services. The engine reference helps with escape-hatch objects and features that have no Nord wrapper. An upstream method is not automatically available as a Nord method.

::: dummies
A **signature** tells you the inputs a function accepts. `play(path, options)` means give it a file path, and optionally settings. A **return value** is what the function gives back. If it returns a Promise, use `await` in an `async` function to wait for the result. Types describe values: `number` is a number; `string` is text; `boolean` is true or false.
:::

## Read an API entry

| Part | What it tells you | Check before calling |
|---|---|---|
| Import or owning object | Where the name comes from | Is it exported from nord, a script method, a component wrapper, or a game service? |
| Signature | Parameter order and optional inputs | Which arguments are required? |
| Return value | What the call gives back | Can it return null? Does it return a Promise? |
| Tier or backend note | Where the feature works | Does your project use 2D, 3D, or a desktop capability? |
| Lifecycle note | When state exists | Is the component ready when your method runs? |

Start with the [Unity API](api-unity.html) for MonoBehaviour, Transform, maths, Input, physics, component wrappers and object lifetime. Use [Public exports](api-exports.html) to verify an import. The component pages describe saved fields separately from runtime handles. Their field lists come from the editor schema; source-generated class pages describe Nord's implementation surface.

::: dummies
A signature is a function's order form: supply the right items in the right places, and check what comes back. `await` means the result arrives later. A missing object may be null, so finding it and using it are two separate steps.
:::

## Choose a safe experiment
Find the reference, copy the smallest complete example linked from it, and test one call. Do not paste an entire upstream engine class into an attached script. [Phaser and Babylon downloads](engine-docs.html) are references for native objects, not extra Nord methods.

## Tiny challenge: predict the return value
Before running a spawn example, say whether you expect an entity or a Promise. Then compare your answer with the [object lifetime reference](api-unity.html#object-lifetime). Getting the answer right before executing the line is a useful superpower.

## Check yourself

Match your import and lifecycle style to the reference you chose. Check the component tier before using a 2D method in 3D.

Next: [Unity API](api-unity.html). Back to: [Getting started](getting-started.html).

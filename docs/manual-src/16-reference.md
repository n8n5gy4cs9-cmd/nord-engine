---
title: Find an API or file setting
section: Manual
group: Test and publish
order: 16
summary: Choose the Unity API, native Nord API, component fields or file reference for the task in front of you.
---
Use the API section when you need an exact name or setting. Use Examples when you need a complete script that shows how the parts work together.

::: dummies
An API is the set of names your code can call. An object can have a component such as a sprite or collider, and a script can ask for that component. A file format describes how the editor saves the same information on disk.
:::

## Choose the right reference

| You are working on | Open | What it contains |
|---|---|---|
| New JavaScript gameplay | [Unity scripting API](api-unity.html) | MonoBehaviour, lifecycle, objects, maths, input and physics helpers |
| Porting a Unity behavior | [Unity API map](ex-unity-api.html), [Coverage](unity-coverage.html) | Implemented groups, recipes and known gaps |
| Existing lower-case scripts | [NordScript](api-nordscript.html), [Native cheatsheet](cheat-sheet-nordjs.html) | Original lifecycle and service access |
| Imports | [Public exports](api-exports.html) | Names actually exported from Nord's core sources |
| Inspector fields | [Components](components.html) | Fields, types, defaults, supported live changes and scene examples |
| Project or scene JSON | [Project format](project-format.html) | On-disk data structures |
| CLI automation | [CLI](cli.html) | Commands and options extracted from source |
| Files, dialogs or native windows | [Desktop bridge](api-desktop.html) | Desktop capabilities and typed contract |
| Rust code | [Rust API](api-rust.html) | Public declarations and source comments |
| Raw Phaser or Babylon objects | [Versioned API ZIPs](engine-docs.html) | Separate offline upstream references and official links |

## Use the editor, then compare the file
Select an object in @ui[Hierarchy] and inspect its components in @ui[Inspector]. Follow the relevant component page to change a field. You should see the value in the Inspector and its effect when you press @ui[Play].

**In the file** `scenes/main.scene.json`, inspect that object's `components` array to compare the saved values with the component reference. Preserve the entity id, other components and scripts. The full schema and file examples are in [Project format](project-format.html).

## Use one scripting style per class
The recommended style extends `MonoBehaviour` and uses `Start()` / `Update()`. The original style extends `NordScript` and uses `start()` / `update(dt)`. Existing tutorials retain their working style. Both import from `nord`; the import does not make C# syntax valid JavaScript.

## Escape hatch
When a Nord wrapper does not expose a feature, the renderer or component may expose an underlying engine handle. Check the component's reference for the actual handle and backend first. A method documented for a Phaser object is not automatically a method on a Nord entity. Phaser and Babylon use different native types, so do not copy a raw call between 2D and 3D.

## Check yourself
- The import appears in the Public exports reference.
- Your script uses the lifecycle of its base class.
- The component and backend match the method you are calling.
- You checked a version-matched ZIP before relying on an upstream signature.

Next: [Unity API](api-unity.html). Back to: [Manual reading paths](manual-paths.html).

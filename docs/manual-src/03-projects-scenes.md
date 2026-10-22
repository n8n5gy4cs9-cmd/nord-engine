---
title: Projects & scenes
section: Manual
order: 3
summary: Folder layout, entities, components, prefabs, tags and layers.
---

A project keeps your game’s files together. A scene describes the things in one level or screen; an entity is one of those things.

::: dummies
Start with one scene. Add one entity, give it a text or sprite component, and save. Use a prefab later when you need several copies of the same object.
:::

A project is a folder of plain files — everything is JSON, scripts and assets, so it works with git and any text editor.

```
my-game/
├─ nord.project.json        # project settings
├─ scenes/main.scene.json   # entities
├─ prefabs/player.prefab.json
├─ scripts/player.js        # ES modules (or src/ for Rust tiers)
├─ assets/…
├─ .nord-cache/             # thumbnails (git-ignored)
└─ dist/                    # build output (git-ignored)
```
The complete field reference is in [Project format](project-format.html). This chapter explains the ideas.

## Entities
An **entity** has a name, id, tags, a layer, a **transform** (position, rotation in degrees, scale), **components** and **scripts**, and may have **children**.
Child transforms are relative to the parent. Units: **2D = pixels, y down; 3D = metres, y up, left-handed.**

::: dummies
An entity is an empty box. On its own it does nothing. You make it a player by putting a **sprite** component (what it looks like), a
**rigidbody** (it obeys physics) and a **script** (what it does) into the box.
:::

## Components
Components give an entity data and behaviour: `sprite`, `rigidbody`, `light`, `camera`… The list is in the [component index](components.html).
They are plain JSON in the scene: `{ "type": "sprite", "texture": "assets/sprites/hero.png" }`.

## Scripts
Scripts are JavaScript modules attached to entities (`"scripts": [{ "path": "scripts/player.js", "attributes": { "speed": 220 } }]`).
See [Scripting](scripting.html). A script's `static attributes` show up in the inspector.

## Tags and layers
`tags` are free-form labels: `entity.hasTag('enemy')`, `scene.findByTag('coin')`. `layer` is an integer used for ordering/filtering by the backend.

## Prefabs
A prefab is a saved entity (with children). Scenes reference it with `"prefab": { "path": "prefabs/coin.prefab.json", "overrides": {…} }`.
`overrides` is **deep-merged** onto the prefab root; an object with numeric keys patches array items by index
(`{"components": {"0": {"tint": "#f00"}}}`). Instance fields (`name`, `transform`, `tags`, `enabled`) win over the prefab's.
**Overrides in the Inspector (like Unity).** Select a prefab instance: the Inspector shows the prefab *with the instance's overrides applied*. A field that differs from the prefab gets a blue **●** marker and a **✕ Revert to prefab value** button; **Revert all overrides** resets the whole instance. Editing a field writes only the difference into `overrides` (components, scripts, behaviors, effects, layer); name, transform, tags and enabled stay on the instance.
At runtime: `await this.scene.spawn('prefabs/bullet.prefab.json', { pos: [x, y, 0], overrides: {…} })`.

## Scenes
A scene is one JSON file. `game.loadScene(path)` swaps scenes; the start scene is `startScene` in the project file. `game.restart()` reloads the current saved scene, resets run time/input and resumes from Pause; it resets Persist entities unless explicitly preserved. See the Scripting chapter for cleanup and storage semantics.
Scene `settings` hold ambient colour, skybox and gravity overrides.

::: tip
Hand-editing JSON is fine — `nord check` validates ids, tags and missing files, and the editor shows the same problems.
:::

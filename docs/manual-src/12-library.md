---
title: The library
section: Manual
order: 12
summary: Scripts, prefabs, shaders, apps and templates you can drop in — and how to add your own.
---

The Library contains ready-made scripts and pieces you can reuse. Search for a feature, insert it and adjust its Inspector settings before writing a replacement.

::: dummies
Try a library controller in a small scene first. Read its description and required components. A movement script cannot show a character by itself; the entity also needs a visible component.
:::

The `library/` folder holds more than 130 tested building blocks, indexed by `library/INDEX.json` and browsable in the editor's **Library** tab or the [catalog](library-catalog.html).

| Kind | Where | Example |
|---|---|---|
| Scripts | `library/scripts/*.js` | `platformer2d`, `fps3d`, `health`, `ai-chase`, `wave-spawner`, `ui-hud` |
| Prefabs | `library/prefabs/` | marker |
| Shaders | `library/shaders/*.glsl` | crt, dissolve, toon, water, hologram, outline… |
| Snippets | `library/snippets/` | small code recipes (`tween-fade.js`) |
| App kits | `library/apps/` | `_kit.js` + calculator, todo, kanban, notes, paint… |
| Templates | `templates/` | 36 starter projects |

::: dummies
The library is a box of ready-made LEGO bricks. Instead of writing "how to make a character jump" you drop in `platformer2d.js`, then change its numbers in the Inspector.
:::

## Using a library script
1. Library tab → search → **Insert** (copies the file into `scripts/`, attaches it to the selected entity).
2. Tweak its attributes in the Inspector.
3. Read the file — they are short and meant to be modified. Many scripts talk through **events** (`events.emit('score', 25)`, `entity.emit('damage', {...})`), so they compose without importing each other.

The [Platformer example](templates-examples.html#examples) is built almost entirely from library scripts plus two tiny custom ones.

## Writing your own entry
A library script starts with a header comment that the index builder reads:
```js
// @nord {"id":"mygame.spinner","title":"Spinner","category":"fx","tier":["2d","3d"],"tags":["rotate"],"description":"Rotates its entity."}
```
Run `node tools/build-library-index.mjs` to regenerate `library/INDEX.json` (the editor's Library tab and the [catalog](library-catalog.html) read it).
Put `// Ported from <repo>/<path> (<licence>)` in the header when you adapt outside code, and list the source in `THIRD_PARTY.md`.

## Templates
`nord new my-game -t <id>` or the hub. Templates are generated from `tools/examples/<id>/` by `node tools/gen_examples.mjs` — edit the generator sources, not the output.

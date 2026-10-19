# Addon SDK (M10-27)
An addon extends Nord with new **plugins** (event-sheet conditions/actions/expressions), **behaviors**, **data objects** and **effects**, in plain JavaScript. Sample: `library/addons/dice/`.

## Layout
```
addons/dice/
  addon.json   { "id": "dice", "name": "Dice", "version": "1.0.0", "type": "plugin|behavior|effect|mixed", "main": "addon.js", "author": "…", "license": "MIT" }
  addon.js     export function register(nord) { … }
```
`id`: lowercase letters, digits, `-`, `_`. `main` defaults to `addon.js` and must stay inside the folder.

## API (`nord` passed to `register`)
`registerPlugin(name, { conditions, actions, expressions })` · `registerObjectAces({…})` (works on every object) · `registerBehavior(name, Class, { conditions, actions, expressions })` with `Behavior` as the base class · `registerDataType(name, def)` (Array/Dictionary-style named objects, see EVENT_SHEETS.md) · `registerEffect(type, { defaults, css?, create? })` · `registerComponent(type, impl)` · `game`. The ACE shapes are documented at the top of `runtime/core/eventsheet/aces.js` and `behaviors/index.js`; the sample uses each one.

## CLI
```
nord addon pack library/addons/dice            # → dice-1.0.0.nordaddon (zip)
nord addon install dice-1.0.0.nordaddon        # or a folder; copies to <project>/addons/dice and adds it to nord.project.json "addons"
nord addon list
```
Installing again upgrades in place. Addons are plain project files: they are exported with the game, work offline and need no build step.

## Runtime
`Game` loads every path in `project.addons` before the first scene (`runtime/core/addons.js`). A broken addon is reported once (error overlay/console) and skipped; the game still starts.

## Editor
The event-sheet picker shows addon ACEs after **Refresh addons** (Event sheets tab): it runs `node tools/export-aces.mjs --project <project>` which loads the addons and writes the groups they add to `<project>/.nord/aces.json`; the file is read whenever a sheet is opened. (Needs Node; the engine's own catalog is built in.)

## Security
Addons are code that runs with the game — only install ones you trust. `.nordaddon` extraction refuses paths that escape the folder.

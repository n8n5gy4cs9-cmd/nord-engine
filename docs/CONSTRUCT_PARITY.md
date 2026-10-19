# Construct-style editor features (M10)

Goal: bring the ease of Construct 3's no-code editor (https://www.construct.net/en/make-games/games-editor) to Nord Engine.
Tasks: `task.md` M10-01…34, features FR-50…FR-68 in `PRD.json`.

**Scope note.** The feature list below is from general knowledge of Construct 3; the site was not reachable from the
sandbox when this was written — owner/next session should verify against the page and adjust.
**Additive only (owner rule):** nothing existing is removed or replaced — JS scripts (`NordScript`), the Phaser/Babylon/Rust tiers, prefabs, the library and all examples keep working. Event sheets, behaviors and the new editors sit beside scripting, and an entity or scene can use both at once.
**Clean-room**: copy ideas and workflows only, never Construct's code, assets or trademarked names/UI. Reuse existing
Nord pieces (scene JSON, nord.js, Phaser tier, animation/tilemap editors from M3-21) rather than rebuilding.

| Construct 3 area | Nord equivalent | FR | Tasks |
|---|---|---|---|
| Event sheets | JSON event sheets compiled to nord.js (JS tier first) | FR-50 | M10-02…07 |
| Behaviors | Attachable behavior components | FR-51 | M10-08…11 |
| Layout editor, layers | 2D viewport upgrade, layer panel, guides | FR-52, FR-53 | M10-11…14 |
| Image/sprite editor | Pixel editor, origin/image points, collision polygons | FR-54 | M10-15, 16 |
| Animations editor | Named anims, onion skin, GIF/spritesheet import | FR-55 | M10-17 |
| Tilemap editor | Tileset slicing, brushes, auto-tile | FR-56 | M10-18 |
| Effects | Per-object/layer effect stack | FR-57 | M10-19, 20 |
| Debugger/profiler | Live inspect/edit, breakpoints, graphs | FR-58 | M10-22, 23 |
| Project bar/tools | Properties, Find All References, rename | FR-59 | M10-25 |
| Addons | JS addon SDK, `nord addon pack/install` | FR-60 | M10-27 |
| Built-in plugins | Text, 9-patch, Array, Dictionary, JSON, AJAX… | FR-61 | M10-26 |
| Timeline | Keyframe editor | FR-62 | M10-21 |
| Export/preview | PWA, itch.io, LAN/QR preview | FR-63, FR-64 | M10-24, 28 |
| Templates | Event-sheet starters | FR-65 | M10-29 |
| Multiplayer, localisation, history | Optional extras | FR-66…68 | M10-30…32 |

Suggested order: format + compiler (02-03) → editor panel (04-06) → behaviors (08-10) → layout/sprite tools → debugger → rest.
Non-goals: copying Construct's runtime, .c3p import (maybe later), subscriptions/cloud.

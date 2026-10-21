# 2D Level Creator — M12-21 / M12-22

Goal: the FPS Level workflow for platform and top-down games, with a usable built-in sprite bank. Credit: Crowelian 2026 + Sonnet.

## Implementation plan

1. Bundle the existing original Amiga collection and selected CC0 Kenney packs from `TEMP/ART`. Preserve licence texts; generate a deterministic catalogue with frame bounds, names, categories, animation presets and source hashes. Do not assume adjacent unrelated cells form an animation.
2. Add a dedicated 2D Level tab, using the FPS editor's page-in-webview pattern. Searchable/filterable bank, animated previews, frame selection, tile brush/rectangle/fill/erase/eyedropper, entities and selection, zoom/pan/grid, snapshot undo/redo, layers with visibility/lock/parallax, object navigation and property Inspector.
3. Reuse Nord's Phaser runtime and library scripts. Compile authoring JSON to ordinary Nord scenes, with static collision, dynamic players, pickups/hazards/exits and editable attached scripts. Save the authoring file and compiled scene separately; explicitly make a scene the start scene when requested.
4. Copy only referenced bundled sheets and their sidecars/licences into the project. Export must work without `TEMP`, the engine bank or the editor. Custom images and scripts use project-relative paths. Preserve project-authored assets and scripts during upgrades.
5. Verify catalogue integrity, editing/undo, collision and movement in both modes, save/reopen, actual project copying and offline build. Document native checks honestly.

## Reuse decision

LDtk (`deepnight/ldtk`, MIT) and Tiled (`mapeditor/tiled`, editor GPL, libtiled BSD-2) are inspected as mature 2D workflow references. They are desktop Haxe/Electron and C++/Qt editors respectively; neither is a drop-in Nord/Phaser editor. Prefer reusing Nord's existing controller scripts, Phaser animation/physics, scene format and export pipeline over a second engine or parallel script system. Any adapted upstream code must retain attribution and licence.

## Parity target

Equivalent workflows: New/Open/Save/Save as, Test/Stop, Build/Items/Scripts/Level/Objects, inspector values, custom scripts, reusable variants, layers, validation, undo and project export. 2D-specific features are sprite frames/animations, collision tiles and parallax. FPS-only geometry, guns and lighting are not meaningful 2D parity requirements.

## Using the editor

Open **2D Level** from View or the command palette, or create **2D Platform Workshop**, **2D Top-down Workshop**, or **Machine Workshop** from the welcome screen. The page is `/editor/level2d/index.html` on `nord serve`. A 2D project is required for Save. The editor opens `levels/workshop.level2d.json` when present, otherwise the first saved 2D level, otherwise a fresh platform workshop.

- **Build:** choose pack/category or search the 1,514-entry bank. B paints, R draws rectangles, F fills a connected region, X erases tiles, I picks a tile/object sprite. Solid tiles create collision; decoration can be painted on a separate layer. Each bank page has 60 animated preview cards.
- **Items:** choose a placement role (decoration, player, solid prop, pickup, hazard, exit, switch, door, physics prop or patrolling enemy). E places that role using the selected sprite. Player controls depend on Level → Mode. Keep the player named **Player** for camera follow; its `player` tag drives interactions.
- **Selection:** V selects/drags; Shift-click toggles multiple selection. Ctrl/Cmd+D duplicates; Delete removes selected objects. Transform/body/script values in Inspector apply to the first selected object. Middle/right drag or Space-drag pans, wheel zooms, Home fits. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo/redo.
- **Layers:** Level manages visibility, locking, order, opacity and parallax (0 = screen-fixed, 1 = world). Locked layers cannot be painted/moved; invisible layers are excluded from compilation. Solid tiles require parallax 1.
- **Scripts:** attach controllers, health, pickups, patrols and interactions; edit typed values or the full attributes JSON. Attach a custom `scripts/*.js` module and edit it through Nord's Code tab. Ready-made files become project-owned on first Save and are preserved thereafter.
- **Variants:** select an object → Save as variant. Assets lists these reusable item definitions. They capture appearance, physics and scripts and are stored within this level's JSON. New placements get independent IDs and coordinates.
- **Assets:** import a PNG into `assets/level2d/custom/`, or register an existing project PNG/spritesheet with frame dimensions, columns and an optional consecutive-frame animation. No remote asset URLs. Imported files become project-owned; Save writes their Nord metadata.

## Physics and the machine sample

Level → **Arcade** is the simple controller/collision option; **Matter** supports rolling and rotating bodies for machine puzzles. Inspector exposes body mode (`none/static/dynamic/kinematic`), trigger, box/circle shape, fixed rotation, mass, bounce, friction (Matter), drag and gravity scale. Gravity is measured in pixels/s² and top-down mode sets it to zero. Rectangles may be rotated with Matter. Arcade uses axis-aligned collision. Matter kinematic objects are script-driven static bodies; no constraint/joint authoring UI is provided.

**Machine Workshop** is an original Incredible Machine-style ball-and-ramp puzzle, with no TIM code or assets. Main Play starts in setup mode: tune Ramp A/B angles, then Release; Reset restores the setup. All ramp/ball/basket bodies are ordinary Nord entities. The authoring file also opens in 2D Level for changing positions, sizes, body values and scripts. Its Level controller is `scripts/machine.js`, so saving and testing the authoring map retains its setup UI. Ordinary maps use `scripts/level2d/level-hud.js`; Level exposes that controller path.

## Save, play and export

**F5 / Test** runs unsaved level data in an iframe using the actual Phaser backend. **Shift+Esc** stops it. Main Play/export use saved scene files.

**Save** writes `levels/<name>.level2d.json` and `scenes/<name>.scene.json`; the compiled scene contains ordinary sprites, bodies, camera and scripts. Referenced bundled image sheets, sidecars and complete licence documents are copied into their matching `assets/packs/` paths. An existing differing bundled asset is rejected instead of overwritten. Unreferenced bank art stays out of the project. Custom images already belong to the project. First Save installs the five existing library scripts and three small level helpers under `scripts/level2d/`; subsequent saves preserve edited scripts.

**Use as game start** explicitly saves and changes the project's `startScene`, display, physics and input actions. Physics is project-wide: choose compatible scenes when linking multiple levels. The normal Nord Build/Export commands then produce an offline game from the copied project files. Editing the compiled scene directly does not change the authoring JSON; the next 2D Save regenerates that scene. Save your authoring file as the source of truth.

## Implementation and provenance

- Catalogue: `editor/level2d/bank.json`; deterministic bundler: `python3 tools/build-sprite-bank.py` (requires the owner's `TEMP/ART`, but running/publishing does not).
- Amiga: 23 existing MIT sheets, including their animation presets, named terrain/props/backgrounds and sports/car sprites. Kenney: unchanged PNGs from Platformer Remastered, Industrial, Tiny Dungeon, Top-down Shooter and Sports, CC0 notices retained. The catalogue counts entries/frames, not unique images.
- LDtk source inspected at `2b7b5512f2f88fa281cb6492debbb26ead7838d4`; `_floodFillImpl` from `src/electron.renderer/Tool.hx` adapted to the sparse tile model, with a visited set marking the initial cell before processing. MIT notice retained in `editor/level2d/LDtk-LICENSE.txt`.
- `nord_core::level2d::publish` accepts only a simple basename, ordinary scene JSON, a 2D project and catalogue-known bundled IDs. Destinations reject symlink ancestors, traversal and hidden components. `/api/level2d/publish` and PNG import require `x-nord-level2d: 1` (no CORS). Existing FPS API is reused read-only for listing `levels/`.

## Limits

This is an orthogonal, finite-map editor; no isometric/hex/autotiling, skeletal animation, joint editor, arbitrary collision polygons, light/shadow painter, room-prefab editor or Tiled/LDtk file importer. Amiga animation presets reflect actual existing strips; unrelated Kenney stills are not fabricated into walk cycles. Custom scripts remain JavaScript. Native embedded-webview feel and Windows interaction need owner verification; browser tests do not establish them.

Movement animation helper uses real `run` or cardinal `run-*` strip names, stops on idle and exposes animation speed. The top-down starter uses the true overhead soccer strip. Attached custom helper edits are also used during Test after publication.

## Complete editor-oriented games and tutorials

Additional Featured/2D templates: **Two Floors — Dungeon Creator** (`dungeon-two-floors`) and **Tiny Tank Patrol — NES-style Arena** (`tank-patrol`). Authoring files are `levels/floor1.level2d.json`, `floor2.level2d.json`, and `arena.level2d.json`. These projects open the 2D tab automatically, as do other projects containing authored 2D levels. Each game's custom Level controller and its JSON attributes survive compilation; object scripts expose game-specific kind/HP/movement/damage/item fields in Inspector. Choose a different bank sprite, reselect an object and use **Use bank sprite** to replace artwork while keeping behavior.

Full illustrated manual tutorials **T28 Machine Workshop**, **T29 Two Floors**, **T30 Tiny Tank Patrol** teach tile tools, collision, layer management, selection/transform, script/body/controller attributes, variants, multiple saved levels and normal Play/export. Tutorials explain both mechanics and concrete editor exercises, with checkpoints and troubleshooting. Dungeon is a limited GPL-3.0-or-later SPD rules adaptation; tanks and machine code/maps are original. No upstream game media is used.

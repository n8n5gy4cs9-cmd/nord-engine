# Upstream sources — what to clone and what to take

Fetch with `tools/fetch-upstreams.sh [name…]` (shallow / sparse, into gitignored `third_party/`).
Recorded SHAs + licences: `UPSTREAM.lock.json`. **Copy only what is needed; add attribution to `THIRD_PARTY.md`.**

| Name | Repo | Licence | Take | Do NOT take |
|---|---|---|---|---|
| godot | godotengine/godot (sparse) | MIT (icons CC-BY-4.0) | `doc/classes` (API ideas/naming), `editor/icons` (reference only), web export template ideas, node-type taxonomy | Editor UI/C++ code; the whole repo |
| godot-demo | godotengine/godot-demo-projects | MIT | Game logic ideas for examples (platformer, 2D/3D FPS, pong, etc.) → port to JS | Binary assets of unclear licence |
| playcanvas-engine | playcanvas/engine | MIT | Alternative 3D web engine (vendor `build/playcanvas.min.js` as *optional* tier), script lifecycle + attribute design, examples → ports | — |
| playcanvas-editor | playcanvas/editor | MIT | UI layout, panel patterns, inspector design, gizmo/viewport UX, hotkeys; viewport gizmo JS ideas | Realtime backend (sharedb/relay) |
| pcui | playcanvas/pcui | MIT | Reference only (editor is native egui now; ADR-013) | — |
| macroquad | not-fl3/macroquad (+ miniquad) | MIT/Apache-2 | Crate dependency for wasm runtime; copy `examples/` into `examples/wasm-*` | — |
| bevy | bevyengine/bevy (sparse `examples/`) | MIT/Apache-2 | ECS patterns, example game ideas, shaders for reference | The engine itself (wasm too large) |
| raylib | raysan5/raylib (sparse `examples/`) | zlib | Example ideas (shapes, textures, models, audio, shaders) ported to macroquad/JS | — |
| raylib-rs | raylib-rs/raylib-rs | zlib | Reference only | — |
| defold | defold/defold (sparse `editor/`, `com.dynamo.cr`) | **Defold License** (check!) | Layout/UX inspiration (outline, properties, assets panes); template project structure | Code, until licence reviewed |
| egui | emilk/egui + eframe_template | MIT/Apache-2 | **Editor toolkit (crate dep)**, `egui_demo_lib` widgets as patterns, `eframe_template` for `nord-app-wasm` | — |
| phaser | phaserjs/phaser (+ phaser3-examples) | MIT | **Vendor dist** (npm `phaser`), port examples → library/snippets | — |
| babylon | BabylonJS/Babylon.js (+ npm packages) | Apache-2 | **Vendor dist** (npm `babylonjs*`, `@babylonjs/havok`), playground snippets ideas | — |
| codemirror | codemirror/dev (npm `@codemirror/*`) | MIT | **Vendor bundle** for the HTML manual's live examples (editor uses native egui code editor) | — |
| lucide | lucide-icons/lucide | ISC | **Icons for editor UI** (curated SVG subset in `assets/icons`, rendered by egui_extras SVG loader) | — |
| kenney / opengameart | (manual download, CC0) | CC0 | Optional real asset packs later (M6) | Anything non-CC0 |

## Harvest rules
1. Prefer **vendoring a built dist** (npm tarball) over compiling from source.
2. When porting an example, put attribution in the file header: `// Ported from <repo>/<path> (<licence>)`.
3. Keep upstream naming where it helps AIs find the origin; list in `library/INDEX.json` `source` field.
4. Never copy files that have no clear licence.

## Notes on "UI to use"
- Godot UI: not used (C++/custom). Take only concepts: scene tree, inspector, FileSystem dock, output panel.
- PlayCanvas editor: **primary visual model** for Nord Editor (hierarchy left, viewport centre, inspector right, assets bottom) — rebuilt in egui.
- Defold: secondary inspiration (clean outline/properties panes, build/run toolbar).

| spd / barony / doom | 00-Evan/shattered-pixel-dungeon, TurningWheel/Barony, id-software/doom | GPL-3 / GPL-3 / GPL-2 | Logic ported into the RetroPaxDungeons and Noom examples (see THIRD_PARTY.md) | Assets (SPD/Barony art not copied) |
| aw2bhr | Eebit/aw2bhr | (decompilation; no data shipped) | Studied for Forgotten Wars: assembly only, tables not decoded — nothing copied | Everything (needs the owner's ROM) |
| redriver2 | OpenDriver2/REDRIVER2 | GPL-2.0 | Handling/gears/camera constants ported into the Automies example (`examples/automies/scripts/am/car.js`) | Game data, models, sounds (not in the repo) |

| openxcom | OpenXcom/OpenXcom (sparse `bin/standard/xcom1`, `src/Battlescape`) | GPL-3.0 | Rules numbers + TU/reaction-fire logic → X-KOM 2026 (`examples/xkom/scripts/xk/tactical.js`) | Art/sounds/maps (need original game data, not in the repo) |
| openra | OpenRA/OpenRA (sparse `mods/ra/rules`, `OpenRA.Mods.Common/Pathfinder`) | GPL-3.0 | RA unit/building stats, A* idea → `examples/xkom/scripts/xk/rts.js` (X-KOM 2026 + Red Front 2026) | Assets, C# code verbatim |
| cnc-remastered | electronicarts/CnC_Remastered_Collection (sparse `REDALERT`) | GPL-3.0 | Rules reference only | Everything else |

M6-36: `tools/fetch-upstreams.sh openxcom` now fetches the documented sparse source. Read `bin/standard/xcom1/terrains.rul` and `src/Battlescape/BattlescapeGenerator.cpp` (`generateMap`, `selectPosition`, `addBlock`) for block assembly, roads and deployments. X-KOM uses four original small layouts and existing sprites; no upstream map/terrain data was copied.

M7-14: official documentation is imported through `node tools/vendor.mjs --docs`. Phaser 4.2.1 / Babylon 9.30.0 declarations come from exact npm packages; BabylonJS/Documentation prose is pinned to `0222ae2cf8d566cc939d70d8fa12aa8d30174a50`. Source gzips/licences, version metadata and hashes are committed in `vendor/engine-docs/`. The older owner Phaser snapshot remains an explicitly labelled archive. See THIRD_PARTY.md and MANUAL_PLAN.md.

Star-Not: `tools/fetch-upstreams.sh sc2-uqm` clones **uqm-ee** for the owner-requested upstream. Pinned source SHA/licence in UPSTREAM.lock.json and THIRD_PARTY.md; small normal-thrust adaptation only, no upstream content.

## FPS-Creator-Classic (reference only, not cloned)
`Dark-Basic-Software-Limited/FPS-Creator-Classic` — **no open-source licence** (personal compile/run only). Used only as a workflow reference for the M12 FPS Creator addon (grid segments, entity bank, script attachment); never cloned into `third_party/`, nothing taken. See `docs/FPS_CREATOR.md` and ADR-026.

## 2D Level Creator

`deepnight/ldtk` at `2b7b5512f2f88fa281cb6492debbb26ead7838d4` (MIT) cloned to ignored `third_party/ldtk/`. Read the tile/int-grid tools and adapted only `Tool.hx::_floodFillImpl` into the sparse map model. Original notice retained in `editor/level2d/LDtk-LICENSE.txt`; attribution in THIRD_PARTY.md. Tiled's upstream COPYING reviewed (editor GPL / libtiled BSD-2); no files copied. Existing Nord scripts/physics/export are the primary reused implementation.

M12-28: owner requested `00-Evan/shattered-pixel-dungeon`. Shallow sparse clone pinned to `57a4e06a4caf162446d1c28caa7983f0493fecf0`, actors/items/levels inspected. Small Char.hit comparison and Rat stats adapted for the GPL-3.0-or-later two-floor Creator example. All media original Nord; full attribution/licence in example/template SOURCE.md / LICENSE.md and THIRD_PARTY.md.


## Retro full-game tutorial source study

Reference clones `outrun-reference`, `starfox-reference`, `kirpich-reference`, `tengen-reference` are pinned in UPSTREAM.lock.json and fetchable by tools/fetch-upstreams.sh. Read RESEARCH_GAME_TUTORIALS.md for concrete source paths, license boundaries and original-design conclusions. No code/assets from these four are harvested. In particular, cartridge data and disassembly output are not tutorial dependencies, and Kirpich's unfinished serial multiplayer declarations are not treated as working network code.

- **Unity C# reference** (`unity-technologies/unitycsreference`): reference-only licence — read for ideas, **never copy code**. UI skins/9-slice (ADR-031) are original code using browser `border-image`; Unity UI Toolkit (USS) and Godot NinePatchRect (MIT) informed only the concepts.

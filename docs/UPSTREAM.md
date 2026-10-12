# Upstream sources — what to clone and what to take

Fetch with `tools/fetch-upstreams.sh [name…]` (shallow / sparse, into gitignored `third_party/`).
Recorded SHAs + licences: `UPSTREAM.lock.json`. **Copy only what is needed; add attribution to `THIRD_PARTY.md`.**

| Name | Repo | Licence | Take | Do NOT take |
|---|---|---|---|---|
| godot | godotengine/godot (sparse) | MIT (icons CC-BY-4.0) | `doc/classes` (API ideas/naming), `editor/icons` (reference only), web export template ideas, node-type taxonomy | Editor UI/C++ code; the whole repo |
| godot-demo | godotengine/godot-demo-projects | MIT | Game logic ideas for examples (platformer, 2D/3D FPS, pong, etc.) → port to JS | Binary assets of unclear licence |
| playcanvas-engine | playcanvas/engine | MIT | Alternative 3D web engine (vendor `build/playcanvas.min.js` as *optional* tier), script lifecycle + attribute design, examples → ports | — |
| playcanvas-editor | playcanvas/editor | MIT | UI layout, panel patterns, inspector design, gizmo/viewport UX, hotkeys; reuse snippets of front-end code | Realtime backend (sharedb/relay) |
| pcui | playcanvas/pcui | MIT | **Use as the editor UI component library (vendored)** | — |
| macroquad | not-fl3/macroquad (+ miniquad) | MIT/Apache-2 | Crate dependency for wasm runtime; copy `examples/` into `examples/wasm-*` | — |
| bevy | bevyengine/bevy (sparse `examples/`) | MIT/Apache-2 | ECS patterns, example game ideas, shaders for reference | The engine itself (wasm too large) |
| raylib | raysan5/raylib (sparse `examples/`) | zlib | Example ideas (shapes, textures, models, audio, shaders) ported to macroquad/JS | — |
| raylib-rs | raylib-rs/raylib-rs | zlib | Reference only | — |
| defold | defold/defold (sparse `editor/`, `com.dynamo.cr`) | **Defold License** (check!) | Layout/UX inspiration (outline, properties, assets panes); template project structure | Code, until licence reviewed |
| egui | emilk/egui + eframe_template | MIT/Apache-2 | Crate dep + `eframe_template` for `nord-app-wasm` | — |
| phaser | phaserjs/phaser (+ phaser3-examples) | MIT | **Vendor dist** (npm `phaser`), port examples → library/snippets | — |
| babylon | BabylonJS/Babylon.js (+ npm packages) | Apache-2 | **Vendor dist** (npm `babylonjs*`, `@babylonjs/havok`), playground snippets ideas | — |
| codemirror | codemirror/dev (npm `@codemirror/*`) | MIT | **Vendor bundle** for code editor + docs | — |
| lucide | lucide-icons/lucide | ISC | **Icons for editor UI** (curated subset in `assets/icons`) | — |
| kenney / opengameart | (manual download, CC0) | CC0 | Optional real asset packs later (M6) | Anything non-CC0 |

## Harvest rules
1. Prefer **vendoring a built dist** (npm tarball) over compiling from source.
2. When porting an example, put attribution in the file header: `// Ported from <repo>/<path> (<licence>)`.
3. Keep upstream naming where it helps AIs find the origin; list in `library/INDEX.json` `source` field.
4. Never copy files that have no clear licence.

## Notes on "UI to use"
- Godot UI: not used (C++/custom). Take only concepts: scene tree, inspector, FileSystem dock, output panel.
- PlayCanvas editor (+PCUI): **primary visual model** for Nord Editor (hierarchy left, viewport centre, inspector right, assets bottom).
- Defold: secondary inspiration (clean outline/properties panes, build/run toolbar).

# Nord Engine — Tasks

> **GENERATED** from `PRD.json` — do not hand-edit. Use `node tools/tasks.mjs done <ID>`.
> Legend: `[x]` done · `[~]` in progress · `[!]` blocked · `[ ]` todo. Credit: Crowelian 2026 + Sonnet.

**Overall: 3/118 tasks (3%)** · updated 2026-10-12

| Milestone | Progress |
|---|---|
| M0 Planning, identity, assets, vendoring | 3/13 (23%) |
| M1 Foundation | 0/11 (0%) |
| M2 JS runtimes | 0/18 (0%) |
| M3 Editor | 0/21 (0%) |
| M4 Export | 0/10 (0%) |
| M5 Rust/WASM | 0/9 (0%) |
| M6 Library | 0/18 (0%) |
| M7 Docs | 0/10 (0%) |
| M8 Polish & portability | 0/8 (0%) |

## Next up
- **M0-04** tools/fetch-upstreams.sh + UPSTREAM.lock.json (godot, playcanvas engine/editor/pcui, macroquad, bevy, raylib, defold, egui, phaser-examples)
- **M0-05** Brand assets: logo (svg/png), wordmark, splash 2s image, app icons (icns/ico/png), palette
- **M0-06** Generate placeholder textures (tileable), skyboxes, particle sprites
- **M0-07** Generate placeholder pixel-art sprites/spritesheets/tileset + UI kit
- **M0-08** Generate placeholder sfx + music loops (tools/gen_assets.py) + icon set (Lucide subset)

## M0 — Planning, identity, assets, vendoring
_Plans, brand, placeholder assets, vendored libs, workspace skeleton_

- [x] **M0-01** Write PRD.md, ARCHITECTURE, DECISIONS, specs (format, scripting, export, editor UI)
- [x] **M0-02** Write library plan, manual plan, testing plan, AGENTS.md handoff guide
- [x] **M0-03** PRD.json + generated task.md + tools/tasks.mjs
- [ ] **M0-04** tools/fetch-upstreams.sh + UPSTREAM.lock.json (godot, playcanvas engine/editor/pcui, macroquad, bevy, raylib, defold, egui, phaser-examples)
- [ ] **M0-05** Brand assets: logo (svg/png), wordmark, splash 2s image, app icons (icns/ico/png), palette
- [ ] **M0-06** Generate placeholder textures (tileable), skyboxes, particle sprites
- [ ] **M0-07** Generate placeholder pixel-art sprites/spritesheets/tileset + UI kit
- [ ] **M0-08** Generate placeholder sfx + music loops (tools/gen_assets.py) + icon set (Lucide subset)
- [ ] **M0-09** Generate docs/manual graphics (banner, section icons, favicon)
- [ ] **M0-10** ASSETS.md catalogue + replacement guide
- [ ] **M0-11** tools/vendor.mjs + vendor Phaser, Babylon (+loaders/gui/materials/Havok), CodeMirror bundle, PCUI, Lucide, marked, fonts; VENDOR.json + THIRD_PARTY.md
- [ ] **M0-12** Cargo workspace skeleton (nord-core, nord-cli) compiles; wasm32 target check
- [ ] **M0-13** Commit + push M0 to branch

## M1 — Foundation
_nord-core, CLI, project format, dev server, thumbnails, offline check_

- [ ] **M1-01** nord-core: project + scene + prefab structs (serde) matching PROJECT_FORMAT.md; load/save; validation
- [ ] **M1-02** JSON schemas for project/scene/components (generated from Rust or hand-written) in crates/nord-core/schema
- [ ] **M1-03** nord-core: asset index (scan, types, meta sidecars, hashes)
- [ ] **M1-04** nord-core: thumbnail generator (images, spritesheets, audio waveform PNG) with cache
- [ ] **M1-05** nord-cli: `new` (templates), `doctor` (tier recommendation), `thumbs`
- [ ] **M1-06** nord-cli: `serve` dev server (axum) with project+vendor+runtime mounting, SSE live reload, `/api/*` editor backend
- [ ] **M1-07** nord-cli: `check-offline` scanner (+ allowlist, tests)
- [ ] **M1-08** nord-cli: `vendor --verify` wiring to tools/vendor.mjs manifest
- [ ] **M1-09** Template: blank html project that runs via `nord serve`
- [ ] **M1-10** CI: GitHub Actions (fmt, clippy, test, tasks check) on ubuntu + macos-14
- [ ] **M1-11** Crash-safe file writes (tmp+rename), project lock, recent-projects store

## M2 — JS runtimes
_nord.js core + Phaser 2D + Babylon 3D adapters_

- [ ] **M2-01** runtime/core: Entity tree, component registry, NordScript lifecycle, attributes
- [ ] **M2-02** runtime/core: events bus, timers, tween/easing, rng, math, object pool
- [ ] **M2-03** runtime/core: input actions (kbd/mouse/touch/gamepad) + virtual joystick
- [ ] **M2-04** runtime/core: asset loader w/ progress + offline-safe paths + file:// safe mode
- [ ] **M2-05** runtime/core: scene loader/prefab instantiate/overrides + scene switching
- [ ] **M2-06** runtime/core: save/load (localStorage slots, versioned)
- [ ] **M2-07** runtime/core: audio manager (buses, unlock, music crossfade)
- [ ] **M2-08** runtime/core: DOM UI layer (HUD/menu primitives, CSS theme)
- [ ] **M2-09** runtime/phaser: boot, sprite/animatedSprite/text/tilemap/particles/camera components
- [ ] **M2-10** runtime/phaser: arcade + matter physics components, collisions, triggers, events to scripts
- [ ] **M2-11** runtime/phaser: parallax, lights 2D, pixel-art mode, scale modes
- [ ] **M2-12** runtime/babylon: boot, mesh/model(glTF)/material/light/camera/skybox components
- [ ] **M2-13** runtime/babylon: Havok physics, collisions, triggers, raycast helpers
- [ ] **M2-14** runtime/babylon: animation, particles, post-process pipeline, Babylon GUI bridge
- [ ] **M2-15** Script hot-reload (hotReloadScript) + error overlay
- [ ] **M2-16** Conformance example scene runs on Phaser and Babylon (screenshot test)
- [ ] **M2-17** Plain `html` tier helper (nord-lite.js) + sample
- [ ] **M2-18** Unit tests for core (node --test) + Playwright e2e harness tools/e2e.mjs

## M3 — Editor
_Tauri shell + PCUI web UI_

- [ ] **M3-01** editor/ skeleton: index.html, import map, theme CSS (Nord palette), vendored fonts, PCUI layout
- [ ] **M3-02** backend.js adapter (Tauri invoke / HTTP fallback) + nord serve --editor API
- [ ] **M3-03** Project hub: new (templates), open, recent, examples, tutorials
- [ ] **M3-04** Hierarchy panel: tree, drag-reparent, add/delete/duplicate, search, icons
- [ ] **M3-05** Inspector: generated from component/script schemas (all attribute types)
- [ ] **M3-06** Undo/redo system + copy/paste/duplicate + autosave
- [ ] **M3-07** 3D viewport (Babylon): orbit/fly cam, grid, selection, move/rotate/scale gizmos, snap
- [ ] **M3-08** 2D viewport (Phaser): pan/zoom, grid, selection, move/rotate/scale handles, snap
- [ ] **M3-09** Asset browser: folder tree, thumbnail grid (size slider), search/filter, drag&drop, import, rename/move/delete
- [ ] **M3-10** Thumbnails: image/spritesheet/audio waveform via CLI; models rendered via Babylon offscreen
- [ ] **M3-11** Code editor: CodeMirror 6 tabs, JS/TS/Rust/HTML/CSS/JSON/MD/GLSL, autocomplete for nord.js API, find/replace, themes, format
- [ ] **M3-12** Quick open (Cmd+P), command palette (Cmd+K), shortcuts map
- [ ] **M3-13** Play/Stop/Reload: iframe preview via dev server, hot-reload on save
- [ ] **M3-14** Console panel: logs/errors from game, build output, click-to-open file:line
- [ ] **M3-15** Library browser: search, preview, insert snippet/prefab/script
- [ ] **M3-16** Docs viewer panel (offline manual/tutorials)
- [ ] **M3-17** Tauri v2 shell crate nord-editor: commands, menus, file dialogs, window state
- [ ] **M3-18** Splash window shows assets/brand/splash.png for >= 2000 ms then opens main window
- [ ] **M3-19** Settings (theme, fonts, editor prefs, recent), About dialog (credit Crowelian 2026 + Sonnet)
- [ ] **M3-20** Animation editor (spritesheet anims) + tilemap painter (Tiled JSON) basics
- [ ] **M3-21** Material/particle preview panels

## M4 — Export
_web static, single-file, mac wrapper_

- [ ] **M4-01** `nord build` pipeline: validate, resolve libs, copy assets, nord.json, index.html templates
- [ ] **M4-02** web-2d export (Phaser) verified offline in headless Chromium
- [ ] **M4-03** web-3d export (Babylon+Havok) verified offline
- [ ] **M4-04** Single-file / file:// safe export mode
- [ ] **M4-05** Asset optimisation (png quantise, atlas packing, audio transcode via optional ffmpeg)
- [ ] **M4-06** Minify option (esbuild) + size report
- [ ] **M4-07** Export dialog in editor + open-folder + zip target
- [ ] **M4-08** nord-player crate (Tauri shell) + `bundle-mac` command (resource swap, Info.plist, icns, ad-hoc codesign)
- [ ] **M4-09** CI builds NordPlayer.app + NordEditor.app on macos-14, uploads artifacts
- [ ] **M4-10** Hosting guide (python http.server, nginx, itch.io, GitHub Pages) tested

## M5 — Rust/WASM
_macroquad+rapier game runtime, egui app runtime_

- [ ] **M5-01** nord-runtime-wasm: macroquad app loading scene JSON (2D subset)
- [ ] **M5-02** rapier2d integration, colliders/rigidbodies from scene components
- [ ] **M5-03** Rust Script trait + registry + sample scripts (player, enemy)
- [ ] **M5-04** Audio, input actions, tilemap, particles, UI (egui-macroquad) in Rust runtime
- [ ] **M5-05** Export `web-wasm-game` (cargo build + wasm-opt if present + index.html + mq_js_bundle)
- [ ] **M5-06** nord-app-wasm: eframe app template -> web export (trunk-free: wasm-bindgen CLI)
- [ ] **M5-07** Templates: rust-2d-game, rust-egui-app; examples (asteroids, physics toys, JSON tool)
- [ ] **M5-08** Port selected raylib/macroquad/bevy examples
- [ ] **M5-09** Editor integration: Rust project build button, cargo output in console, error links

## M6 — Library
_snippets, controllers, systems, asset packs, examples_

- [ ] **M6-01** tools/build-library-index.mjs + header format + library browser data
- [ ] **M6-02** Controllers 2D (platformer, top-down, twin-stick, click-move, tank, car, runner, flappy, grid, ladder)
- [ ] **M6-03** Controllers 3D (FPS, third-person, fly/orbit/RTS cam, vehicle, spaceship, marble)
- [ ] **M6-04** Camera scripts (follow, look-ahead, shake, zoom, bounds, cinematic)
- [ ] **M6-05** Physics helpers (spawn, drag, pickup, one-way, moving platform, conveyor, bounce, triggers, buoyancy, rope, explosion)
- [ ] **M6-06** Gameplay systems A (health, inventory, dialogue, quests, save slots, score/combo, timers, checkpoints, doors/keys)
- [ ] **M6-07** Gameplay systems B (wave spawner, enemy AI patrol/chase/shooter/flock/boss, FSM, behaviour tree, A*, pickups, powerups, status effects, loot, XP)
- [ ] **M6-08** Procedural (dungeon BSP/cellular, autotile, fog of war, minimap, day-night, weather)
- [ ] **M6-09** UI kit (HUD, menus, pause, settings, dialogue, inventory UI, toasts, joystick, loading, level select, damage numbers)
- [ ] **M6-10** Utilities (tween, pool, noise, grid, localisation, gamepad map, debug overlay, recorder, jsfxr-style sfx, console)
- [ ] **M6-11** FX (particle presets, shake, flash, hitstop, slow-mo, trail, post-fx, parallax) + shaders
- [ ] **M6-12** App kits (todo, notes, kanban, dashboard+charts, calculator, paint, audio player, json viewer, router/state)
- [ ] **M6-13** Templates for New Project (>= 12, see LIBRARY_PLAN J)
- [ ] **M6-14** Example games 2D (>= 10)
- [ ] **M6-15** Example games 3D (>= 4)
- [ ] **M6-16** Example apps (>= 6) + Rust samples (>= 3)
- [ ] **M6-17** Optional CC0 asset packs (Kenney etc.) replacing placeholders; update ASSETS.md
- [ ] **M6-18** tools/smoke-examples.mjs headless smoke test for every example

## M7 — Docs
_manual, guides, tutorials, in-editor docs_

- [ ] **M7-01** tools/build-manual.mjs (marked + CodeMirror readonly + nord-live blocks)
- [ ] **M7-02** Manual chapters 1-4 (welcome, editor tour, projects, scripting)
- [ ] **M7-03** Manual chapters 5-8 (2D, 3D, physics, audio)
- [ ] **M7-04** Manual chapters 9-12 (UI, input, assets, library)
- [ ] **M7-05** Manual chapters 13-17 (Rust/WASM, export, perf, reference, appendix)
- [ ] **M7-06** Tutorials T01-T09 with runnable projects
- [ ] **M7-07** Tutorials T10-T18 with runnable projects
- [ ] **M7-08** API reference generated from JSDoc + component schemas + CLI help
- [ ] **M7-09** Embed manual in editor (Docs tab) + offline search index
- [ ] **M7-10** Per-feature guides & cheat sheets (shortcuts, nord.js, export)

## M8 — Polish & portability
_dmg, CI, Windows, Linux, perf_

- [ ] **M8-01** .dmg packaging + notarisation notes
- [ ] **M8-02** Windows build (Tauri/WebView2) + path audit
- [ ] **M8-03** Linux build (WebKitGTK) + AppImage/deb
- [ ] **M8-04** Performance pass (viewport fps, startup time, export size)
- [ ] **M8-05** Dockable panels (optional), light theme
- [ ] **M8-06** Optional: Bevy template, PlayCanvas engine as 4th web tier
- [ ] **M8-07** Optional: TypeScript support in code editor
- [ ] **M8-08** Bug-bash all examples + KNOWN_ISSUES cleanup

## Features (PRD)

| ID | Feature | Milestone | Priority | Status |
|---|---|---|---|---|
| FR-01 | Project format | M1 | critical | todo |
| FR-02 | Scene model (shared JSON across runtimes) | M1 | critical | todo |
| FR-03 | nord.js core (entities, scripts, input, audio, save) | M2 | critical | todo |
| FR-04 | 2D runtime (Phaser) | M2 | critical | todo |
| FR-05 | 3D runtime (Babylon + Havok) | M2 | critical | todo |
| FR-06 | Rust/WASM game runtime (macroquad+rapier) | M5 | high | todo |
| FR-07 | Rust/WASM app runtime (egui) | M5 | high | todo |
| FR-08 | Simple html tier | M2 | medium | todo |
| FR-09 | Physics 2D/3D/Rust | M2 | high | todo |
| FR-10 | Audio | M2 | high | todo |
| FR-11 | UI toolkit | M2 | high | todo |
| FR-20 | Editor shell + splash >=2s | M3 | critical | todo |
| FR-21 | Hierarchy + inspector + undo | M3 | critical | todo |
| FR-22 | Viewport 2D/3D with gizmos | M3 | critical | todo |
| FR-23 | Asset browser with thumbnails | M3 | critical | todo |
| FR-24 | Full code editor (CodeMirror) | M3 | critical | todo |
| FR-25 | Library browser | M3 | high | todo |
| FR-26 | Play/preview + console | M3 | critical | todo |
| FR-27 | Docs viewer | M3 | medium | todo |
| FR-28 | Export dialog | M4 | high | todo |
| FR-30 | CLI | M1 | critical | todo |
| FR-31 | Thumbnails | M1 | high | todo |
| FR-32 | Vendoring | M0 | critical | todo |
| FR-33 | Offline guarantee | M1 | critical | todo |
| FR-34 | Mac wrapper app | M4 | high | todo |
| FR-40 | Placeholder assets + ASSETS.md | M0 | high | todo |
| FR-41 | Snippet/script library (200+) | M6 | high | todo |
| FR-42 | Examples (12+ games, 6+ apps, 3 Rust) | M6 | high | todo |
| FR-43 | Manual + tutorials with live code | M7 | high | todo |


# Nord Engine — Tasks

> **GENERATED** from `PRD.json` — do not hand-edit. Use `node tools/tasks.mjs done <ID>`.
> Legend: `[x]` done · `[~]` in progress · `[!]` blocked · `[ ]` todo. Credit: Crowelian 2026 + Sonnet.

**Overall: 74/126 tasks (59%)** · updated 2026-10-12

| Milestone | Progress |
|---|---|
| M0 Planning, identity, assets, vendoring | 13/13 (100%) |
| M1 Foundation | 11/11 (100%) |
| M2 JS runtimes | 19/19 (100%) |
| M3 Editor | 23/25 (92%) |
| M4 Export | 8/11 (73%) |
| M5 Rust/WASM | 0/9 (0%) |
| M6 Library | 0/18 (0%) |
| M7 Docs | 0/12 (0%) |
| M8 Polish & portability | 0/8 (0%) |

## Next up
- **M3-07** SPIKE: wry child webview embedded in egui panel on macOS (resize, HiDPI, focus, IPC both ways); fallback separate window
- **M3-25** OWNER: verify webview embedding on macOS (checklist in docs/KNOWN_ISSUES.md RISK-001a), then tick M3-07
- **M4-08** nord-player crate (Tauri shell) + `bundle-mac` command (resource swap, Info.plist, icns, ad-hoc codesign)
- **M4-09** CI builds NordPlayer.app + NordEditor.app on macos-14, uploads artifacts
- **M4-11** Texture atlas packing + lossy PNG quantise in nord build --optimize

## M0 — Planning, identity, assets, vendoring
_Plans, brand, placeholder assets, vendored libs, workspace skeleton_

- [x] **M0-01** Write PRD.md, ARCHITECTURE, DECISIONS, specs (format, scripting, export, editor UI)
- [x] **M0-02** Write library plan, manual plan, testing plan, AGENTS.md handoff guide
- [x] **M0-03** PRD.json + generated task.md + tools/tasks.mjs
- [x] **M0-04** tools/fetch-upstreams.sh + UPSTREAM.lock.json (godot, playcanvas engine/editor/pcui, macroquad, bevy, raylib, defold, egui, phaser-examples)
- [x] **M0-05** Brand assets: logo (svg/png), wordmark, splash 2s image, app icons (icns/ico/png), palette
- [x] **M0-06** Generate placeholder textures (tileable), skyboxes, particle sprites
- [x] **M0-07** Generate placeholder pixel-art sprites/spritesheets/tileset + UI kit
- [x] **M0-08** Generate placeholder sfx + music loops (tools/gen_assets.py) + icon set (Lucide subset)
- [x] **M0-09** Generate docs/manual graphics (banner, section icons, favicon)
- [x] **M0-10** ASSETS.md catalogue + replacement guide
- [x] **M0-11** tools/vendor.mjs + vendor Phaser, Babylon (+loaders/gui/materials/Havok), CodeMirror bundle (manual only), Lucide, marked, fonts; VENDOR.json + THIRD_PARTY.md
- [x] **M0-12** Cargo workspace skeleton (nord-core, nord-cli) compiles; wasm32 target check
- [x] **M0-13** Commit + push M0 to branch

## M1 — Foundation
_nord-core, CLI, project format, dev server, thumbnails, offline check_

- [x] **M1-01** nord-core: project + scene + prefab structs (serde) matching PROJECT_FORMAT.md; load/save; validation
- [x] **M1-02** JSON schemas for project/scene/components (generated from Rust or hand-written) in crates/nord-core/schema
- [x] **M1-03** nord-core: asset index (scan, types, meta sidecars, hashes)
- [x] **M1-04** nord-core: thumbnail generator (images, spritesheets, audio waveform PNG) with cache
- [x] **M1-05** nord-cli: `new` (templates), `doctor` (tier recommendation), `thumbs`
- [x] **M1-06** nord-cli: `serve` dev server (axum) with project+vendor+runtime mounting, SSE live reload, `/api/*` editor backend
- [x] **M1-07** nord-cli: `check-offline` scanner (+ allowlist, tests)
- [x] **M1-08** nord-cli: `vendor --verify` wiring to tools/vendor.mjs manifest
- [x] **M1-09** Template: blank html project that runs via `nord serve`
- [x] **M1-10** CI: GitHub Actions (fmt, clippy, test, tasks check) on ubuntu + macos-14
- [x] **M1-11** Crash-safe file writes (tmp+rename), project lock, recent-projects store

## M2 — JS runtimes
_nord.js core + Phaser 2D + Babylon 3D adapters_

- [x] **M2-01** runtime/core: Entity tree, component registry, NordScript lifecycle, attributes
- [x] **M2-02** runtime/core: events bus, timers, tween/easing, rng, math, object pool
- [x] **M2-03** runtime/core: input actions (kbd/mouse/touch/gamepad) + virtual joystick
- [x] **M2-04** runtime/core: asset loader w/ progress + offline-safe paths + file:// safe mode
- [x] **M2-05** runtime/core: scene loader/prefab instantiate/overrides + scene switching
- [x] **M2-06** runtime/core: save/load (localStorage slots, versioned)
- [x] **M2-07** runtime/core: audio manager (buses, unlock, music crossfade)
- [x] **M2-08** runtime/core: DOM UI layer (HUD/menu primitives, CSS theme)
- [x] **M2-09** runtime/phaser: boot, sprite/animatedSprite/text/tilemap/particles/camera components
- [x] **M2-10** runtime/phaser: arcade + matter physics components, collisions, triggers, events to scripts
- [x] **M2-11** runtime/phaser: parallax, lights 2D, pixel-art mode, scale modes
- [x] **M2-12** runtime/babylon: boot, mesh/model(glTF)/material/light/camera/skybox components
- [x] **M2-13** runtime/babylon: Havok physics, collisions, triggers, raycast helpers
- [x] **M2-14** runtime/babylon: animation, particles, post-process pipeline, Babylon GUI bridge
- [x] **M2-15** Script hot-reload (hotReloadScript) + error overlay
- [x] **M2-16** Conformance example scene runs on Phaser and Babylon (screenshot test)
- [x] **M2-17** Plain `html` tier helper (nord-lite.js) + sample
- [x] **M2-18** Unit tests for core (node --test) + Playwright e2e harness tools/e2e.mjs
- [x] **M2-19** Fonts (Inter, Plus Jakarta Sans, IBM Plex Sans, JetBrains Mono, Fira Code, IBM Plex Mono) vendored + 3 skins (font combos) + 10 dark themes shared by runtime UI, editor and code editor

## M3 — Editor
_Native egui editor + wry viewport + code editor_

- [x] **M3-01** nord-editor crate: eframe (wgpu) app, theme (Nord palette), bundled fonts (Inter/JetBrains Mono TTF), egui_dock layout, menu bar
- [x] **M3-02** Splash: borderless window with assets/brand/splash.png shown >= 2000 ms, then main window
- [x] **M3-03** Project hub: new (templates), open (rfd dialog), recent, examples, tutorials
- [x] **M3-04** Hierarchy panel: tree, drag-reparent, add/delete/duplicate, search, Lucide icons
- [x] **M3-05** Inspector: generated from component/script schemas (all attribute types) as egui widgets
- [x] **M3-06** Undo/redo Command system + copy/paste/duplicate + autosave (crash-safe)
- [~] **M3-07** SPIKE: wry child webview embedded in egui panel on macOS (resize, HiDPI, focus, IPC both ways); fallback separate window
- [x] **M3-08** 3D viewport (Babylon edit mode in webview): orbit/fly cam, grid, picking, move/rotate/scale gizmos, snap, IPC sync
- [x] **M3-09** 2D viewport (Phaser edit mode): pan/zoom, grid, picking, move/rotate/scale handles, snap, IPC sync
- [x] **M3-10** Asset browser: folder tree, thumbnail grid (size slider, lazy), search/filter, drag&drop, import, rename/move/delete
- [x] **M3-11** Thumbnails: images/spritesheets/audio waveform via nord-core; models rendered via Babylon offscreen in webview
- [x] **M3-12** Code editor v1: tabs, line numbers, syntect highlighting (JS/TS/Rust/HTML/CSS/JSON/MD/GLSL/WGSL/TOML), auto-indent, brackets, comment toggle, save
- [x] **M3-13** Code editor v2: find/replace (regex), goto line, project search, autocomplete (nord.js API + snippets), error squiggles, format
- [x] **M3-14** Code editor v3 (stretch): multi-cursor, minimap, split view; evaluate egui_code_editor reuse / CodeMirror-webview fallback
- [x] **M3-15** Quick open (Cmd+P), command palette (Cmd+K), shortcuts map
- [x] **M3-16** Play/Stop/Reload in webview via nord serve; hot-reload on save
- [x] **M3-17** Console panel: logs/errors from game (IPC) + build output; click error -> open file:line
- [x] **M3-18** Library browser: search, preview, insert snippet/prefab/script
- [x] **M3-19** Docs viewer tab (offline HTML manual in webview)
- [x] **M3-20** Settings (theme, fonts, editor prefs), About dialog (credit Crowelian 2026 + Sonnet), window state persistence
- [x] **M3-21** Animation editor (spritesheet anims) + tilemap painter (Tiled JSON) basics
- [x] **M3-22** egui_kittest headless tests for panels + CI job
- [x] **M3-23** Editor: apply selected skin + theme (UI fonts, code font + ligatures, syntax colors) via shared themes.json; settings UI to switch live
- [x] **M3-24** Code editor: multi-cursor editing (custom text-edit core; egui TextEdit has a single selection)
- [ ] **M3-25** OWNER: verify webview embedding on macOS (checklist in docs/KNOWN_ISSUES.md RISK-001a), then tick M3-07

## M4 — Export
_web static, single-file, mac wrapper_

- [x] **M4-01** `nord build` pipeline: validate, resolve libs, copy assets, nord.json, index.html templates
- [x] **M4-02** web-2d export (Phaser) verified offline in headless Chromium
- [x] **M4-03** web-3d export (Babylon+Havok) verified offline
- [x] **M4-04** Single-file / file:// safe export mode
- [x] **M4-05** Asset optimisation (png quantise, atlas packing, audio transcode via optional ffmpeg)
- [x] **M4-06** Minify option (esbuild) + size report
- [x] **M4-07** Export dialog in editor + open-folder + zip target
- [~] **M4-08** nord-player crate (Tauri shell) + `bundle-mac` command (resource swap, Info.plist, icns, ad-hoc codesign)
- [~] **M4-09** CI builds NordPlayer.app + NordEditor.app on macos-14, uploads artifacts
- [x] **M4-10** Hosting guide (python http.server, nginx, itch.io, GitHub Pages) tested
- [ ] **M4-11** Texture atlas packing + lossy PNG quantise in nord build --optimize

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
- [ ] **M7-11** Full engine API docs: everything Phaser/Babylon offer, documented in Nord format (components, NordScript, game.*/physics/camera/gui namespaces) — no raw Phaser/Babylon API needed; searchable HTML reference generated from JSDoc + component schemas
- [ ] **M7-12** HTML manual/guide/tutorials 'complete edition': every feature, per-component pages, cookbook, plus 'For dummies' info boxes (hidden by default, global toggle persisted in localStorage)

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
| FR-24 | Full native code editor (egui + syntect) | M3 | critical | todo |
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


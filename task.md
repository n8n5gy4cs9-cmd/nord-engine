# Nord Engine — Tasks

> **GENERATED** from `PRD.json` — do not hand-edit. Use `node tools/tasks.mjs done <ID>`.
> Legend: `[x]` done · `[~]` in progress · `[!]` blocked · `[ ]` todo. Credit: Crowelian 2026 + Sonnet.

**Overall: 228/243 tasks (94%)** · updated 2026-10-20

| Milestone | Progress |
|---|---|
| M0 Planning, identity, assets, vendoring | 13/13 (100%) |
| M1 Foundation | 11/11 (100%) |
| M2 JS runtimes | 19/19 (100%) |
| M3 Editor | 24/26 (92%) |
| M4 Export | 8/11 (73%) |
| M5 Rust/WASM | 9/9 (100%) |
| M6 Library | 47/47 (100%) |
| M7 Docs | 20/20 (100%) |
| M8 Polish & portability | 15/20 (75%) |
| M9 Desktop apps | 16/16 (100%) |
| M10 Construct-style editor | 35/35 (100%) |
| M11 Web editor | 11/16 (69%) |

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
- [x] **M3-26** Game view: size presets (Fit/50-200%), fullscreen (Esc), console strip that cannot be covered by the webview

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

- [x] **M5-01** nord-runtime-wasm: macroquad app loading scene JSON (2D subset)
- [x] **M5-02** rapier2d integration, colliders/rigidbodies from scene components
- [x] **M5-03** Rust Script trait + registry + sample scripts (player, enemy)
- [x] **M5-04** Audio, input actions, tilemap, particles, UI (egui-macroquad) in Rust runtime
- [x] **M5-05** Export `web-wasm-game` (cargo build + wasm-opt if present + index.html + mq_js_bundle)
- [x] **M5-06** nord-app-wasm: eframe app template -> web export (trunk-free: wasm-bindgen CLI)
- [x] **M5-07** Templates: rust-2d-game, rust-egui-app; examples (asteroids, physics toys, JSON tool)
- [x] **M5-08** Port selected raylib/macroquad/bevy examples
- [x] **M5-09** Editor integration: Rust project build button, cargo output in console, error links

## M6 — Library
_snippets, controllers, systems, asset packs, examples_

- [x] **M6-01** tools/build-library-index.mjs + header format + library browser data
- [x] **M6-02** Controllers 2D (platformer, top-down, twin-stick, click-move, tank, car, runner, flappy, grid, ladder)
- [x] **M6-03** Controllers 3D (FPS, third-person, fly/orbit/RTS cam, vehicle, spaceship, marble)
- [x] **M6-04** Camera scripts (follow, look-ahead, shake, zoom, bounds, cinematic)
- [x] **M6-05** Physics helpers (spawn, drag, pickup, one-way, moving platform, conveyor, bounce, triggers, buoyancy, rope, explosion)
- [x] **M6-06** Gameplay systems A (health, inventory, dialogue, quests, save slots, score/combo, timers, checkpoints, doors/keys)
- [x] **M6-07** Gameplay systems B (wave spawner, enemy AI patrol/chase/shooter/flock/boss, FSM, behaviour tree, A*, pickups, powerups, status effects, loot, XP)
- [x] **M6-08** Procedural (dungeon BSP/cellular, autotile, fog of war, minimap, day-night, weather)
- [x] **M6-09** UI kit (HUD, menus, pause, settings, dialogue, inventory UI, toasts, joystick, loading, level select, damage numbers)
- [x] **M6-10** Utilities (tween, pool, noise, grid, localisation, gamepad map, debug overlay, recorder, jsfxr-style sfx, console)
- [x] **M6-11** FX (particle presets, shake, flash, hitstop, slow-mo, trail, post-fx, parallax) + shaders
- [x] **M6-12** App kits (todo, notes, kanban, dashboard+charts, calculator, paint, audio player, json viewer, router/state)
- [x] **M6-13** Templates for New Project (>= 12, see LIBRARY_PLAN J)
- [x] **M6-14** Example games 2D (>= 10)
- [x] **M6-15** Example games 3D (>= 4)
- [x] **M6-16** Example apps (>= 6) + Rust samples (>= 3)
- [x] **M6-17** Optional CC0 asset packs (Kenney etc.) replacing placeholders; update ASSETS.md
- [x] **M6-18** tools/smoke-examples.mjs headless smoke test for every example
- [x] **M6-19** Redraw all Noom sprites, textures and HUD in a Barony/Doom-inspired style
- [x] **M6-20** Redraw RetroPaxDungeons sprites, dungeon tiles, effects and HUD
- [x] **M6-21** Altimu 5.7 example: Ultima V-style Trinsic PoC (hand-pixelled art, text .map, typed talk, tactical combat, GUIDE.md)
- [x] **M6-22** Harrison's Command example: Carrier Command-style 3D PoC (walkable moving carrier, RTT computers, 2-player gamepad split-screen, Kenney + WZ2100 stats)
- [x] **M6-23** Example game Forgotten Wars (Advance Wars 2-style tactics PoC, 1 level, player vs AI, hand-pixelled sprites, assets.md + GUIDE.md)
- [x] **M6-24** Example game Automies (Driver 2-style 3D driving PoC, REDRIVER2 handling port, Kenney city + sfx, 2-player split-screen, assets.md + GUIDE.md)
- [x] **M6-25** X-KOM 2026 example game: geoscape + base research + interception shooter + isometric tactical (OpenXcom rules) + Red Alert RTS hive strike
- [x] **M6-26** Red Front 2026 example game: Red Alert-style RTS skirmish (shared RTS engine with X-KOM 2026)
- [x] **M6-27** Redraw all X-KOM sprite sheets with 1990s X-COM / XCOM 2 inspired art at unchanged dimensions
- [x] **M6-28** Fix X-KOM movement layering and camera; compact textured UI, globe and title screen
- [x] **M6-29** Add separate X-KOM title/base/game music and clear replaceable audio inventory
- [x] **M6-30** Terminal radar, developer console, reusable audio start gate and slow timed X-KOM campaign
- [x] **M6-31** Complete simple X-KOM campaign finale, campaign save/load pause menu and compact RTS/HQ UI
- [x] **M6-32** Mouse-edge scrolling restricted to tactical/RTS playfields and remove redundant title Listen control
- [x] **M6-33** Fix X-KOM UI text alignment, centralize font sizes and add portable checkpoint export/import
- [x] **M6-34** Configurable start offsets for every X-KOM music role
- [x] **M6-35** WASD tactical/RTS scrolling and globe rotation with conflict-free RTS commands
- [x] **M6-36** Seeded tactical mission structures/deployments and simple safe RTS battlefield variation
- [x] **M6-37** Example game: Vallout 2 New Kerava
- [x] **M6-38** Remake all Vallout sprites and menus for a Fallout-inspired quarantined Kerava
- [x] **M6-39** Notepaint full offline notes + paint app with original UI sprites
- [x] **M6-40** Star-Not solar-system adventure with three races, original sprites, music and SFX
- [x] **M6-41** Interactive pasted terrain shader example with falling cube and original audio
- [x] **M6-42** Connect Shader Terrain audio to iChannel0 and document matching collision snapshots
- [x] **M6-43** Example game Midnight Sun Tour: NordScrap game cloned with compat layer, tycoon Tour Office, new encounters
- [x] **M6-44** Rebuild Midnight Sun Tour art, UI and minigames; fix reward accounting and verify campaign
- [x] **M6-45** Add private tour console and Ruisrock visitor tycoon management with booked-artist audio
- [x] **M6-46** Replace every remaining Midnight Sun Tour legacy minigame view and remake Moose Run, petrol, driving, camping and arcade games with native-pixel art
- [x] **M6-47** Light & shadow example: Crypt of Embers + fx.light2d library scripts

## M7 — Docs
_manual, guides, tutorials, in-editor docs_

- [x] **M7-01** tools/build-manual.mjs (marked + CodeMirror readonly + nord-live blocks)
- [x] **M7-02** Manual chapters 1-4 (welcome, editor tour, projects, scripting)
- [x] **M7-03** Manual chapters 5-8 (2D, 3D, physics, audio)
- [x] **M7-04** Manual chapters 9-12 (UI, input, assets, library)
- [x] **M7-05** Manual chapters 13-17 (Rust/WASM, export, perf, reference, appendix)
- [x] **M7-06** Tutorials T01-T09 with runnable projects
- [x] **M7-07** Tutorials T10-T18 with runnable projects
- [x] **M7-08** API reference generated from JSDoc + component schemas + CLI help
- [x] **M7-09** Embed manual in editor (Docs tab) + offline search index
- [x] **M7-10** Per-feature guides & cheat sheets (shortcuts, nord.js, export)
- [x] **M7-11** Full engine API docs: everything Phaser/Babylon offer, documented in Nord format (components, NordScript, game.*/physics/camera/gui namespaces) — no raw Phaser/Babylon API needed; searchable HTML reference generated from JSDoc + component schemas
- [x] **M7-12** HTML manual/guide/tutorials 'complete edition': every feature, per-component pages, cookbook, plus 'For dummies' info boxes (hidden by default, global toggle persisted in localStorage)
- [x] **M7-13** Document editor saved-copy, settings and project-cache locations on macOS, Windows and Linux
- [x] **M7-14** Redesign offline HTML manual with beginner paths, screenshots and complete versioned Nord/Phaser/Babylon references
- [x] **M7-15** Complete step-by-step Notepaint and Star-Not tutorials with reusable asset inventories
- [x] **M7-16** Manual code-preview wrapping and 1.6 line-height defaults
- [x] **M7-17** Short terrain shader app tutorial covering Play, export and interaction
- [x] **M7-18** Visible mobile touch-control guide and reusable Star-Not joystick/buttons
- [x] **M7-19** Add manual noindex metadata and server upload files
- [x] **M7-20** Organize manual output into folders and rebuild only changed files

## M8 — Polish & portability
_dmg, CI, Windows, Linux, perf_

- [x] **M8-01** .dmg packaging + notarisation notes
- [x] **M8-02** Windows build (egui/WebView2) + path audit
- [x] **M8-03** Linux build (WebKitGTK) + AppImage/deb
- [ ] **M8-04** Performance pass (viewport fps, startup time, export size)
- [x] **M8-05** Dockable panels (optional), light theme
- [x] **M8-06** Optional: Bevy template, PlayCanvas engine as 4th web tier
- [ ] **M8-07** Optional: TypeScript support in code editor
- [ ] **M8-08** Bug-bash all examples + KNOWN_ISSUES cleanup
- [x] **M8-09** build.sh: Windows build into dist/windows/ (exe + resources, zip/installer)
- [x] **M8-10** build.sh: Linux build into dist/linux/ (tar.gz/AppImage)
- [x] **M8-11** Fix hub scrolling + templates for webview: kanban pointer drag, mouse-capture script (lock+hide, Esc), fps/third-person/fly-cam use it
- [x] **M8-12** Play-mode tint + status bar (one-sentence activity, compile progress) + hub per-column scroll
- [x] **M8-13** Run/stop toggle + rebindable run/stop keys, Stop button in game header
- [x] **M8-14** Code editor example: PHP, Python and more syntaxes
- [x] **M8-15** Game view position settings (top/middle/bottom + x/y offset)
- [ ] **M8-16** Open current example content by default; add opt-in cached-content testing setting
- [ ] **M8-17** Fix macOS project-lock live-process detection
- [x] **M8-18** Editor UI uplift: charcoal theme, polished workspace and hub, reliable toolbar and dialogs
- [x] **M8-19** Fix Assets folder divider resizing and staircase thumbnail grid
- [x] **M8-20** Code editor word wrap and configurable line height/letter spacing

## M9 — Desktop apps
_real native desktop apps (Rust backend): files, dialogs, notifications, tray, windows, storage, packaging_

- [x] **M9-01** PLAN: docs/DESKTOP_APPS.md — desktop target architecture (ADR): reuse nord-player/wry shell vs native egui apps; capability model, API surface per tier (JS via IPC bridge, Rust direct); permissions/sandbox; what real apps need (checklist)
- [x] **M9-02** nord-desktop crate: shared Rust backend services behind one trait set (fs, dialogs, notifications, clipboard, shell/open, paths, app lifecycle) used by JS bridge and Rust apps
- [x] **M9-03** Files & folders: scoped fs API (read/write/list/watch/stat/mkdir/remove/rename), per-app allowed roots (app data, documents, user-picked via dialog), path traversal protection, macOS sandbox/security-scoped bookmarks
- [x] **M9-04** Native dialogs: open/save file, pick folder, message/confirm, with remembered recent locations (rfd)
- [x] **M9-05** System notifications (local), badges, dock/taskbar progress; macOS/Windows/Linux backends
- [x] **M9-06** Persistent app storage: key-value + structured (sqlite or sled), settings file, app data dir, migrations; secure secrets via OS keychain
- [x] **M9-07** Clipboard (text/image/files), drag & drop in/out, open-with / file associations / custom URL scheme (deep links), single-instance + argv handling
- [x] **M9-08** Windows & menus: multi-window, native menu bar + context menus, global shortcuts, tray/menu-bar icon, always-on-top/frameless/transparent, fullscreen, window state persistence
- [x] **M9-09** Background work: threads/async tasks API, timers, process spawn (sandboxed allow-list), HTTP client with permission prompt, optional local server; app lifecycle (suspend, quit confirm, autostart/login item)
- [x] **M9-10** JS bridge: window.nord.desktop.* (fs, dialogs, notify, clipboard, store, window, menu, tray) over wry IPC with capability checks; typed d.ts + docs; same API in dev (editor Play) and exported apps
- [x] **M9-11** Rust desktop API in nord-app-wasm/nord-runtime: native path = direct crates, web path = graceful fallbacks (File System Access API, Notifications API, localStorage/IndexedDB); one cfg-free app API
- [x] **M9-12** Permissions/capabilities manifest in nord.project.json (desktop.permissions) + first-run prompts + editor UI to review; least-privilege defaults; audit log
- [x] **M9-13** Packaging: macOS .app/.dmg (sign + notarise docs), Windows installer/portable exe, Linux AppImage/deb; icons, version metadata, auto-update strategy (optional, opt-in)
- [x] **M9-14** Accessibility & real-app UX: IME/text input, high-DPI, dark mode follow, keyboard navigation, undo/redo helpers, i18n (locale/formatting), drag-reorder lists, virtualised tables
- [x] **M9-15** Templates + examples: desktop notes app (files+store+notifications), file organiser (fs+dialogs), clipboard manager (tray+global shortcut), markdown editor — JS and Rust variants; e2e where headless-possible
- [x] **M9-16** Tests & CI: capability unit tests, fs sandbox escape tests, per-OS CI matrix (macos-14, windows, ubuntu) building/launching sample apps headless; document unverified parts honestly

## M10 — Construct-style editor
_features cloned from Construct 3's editor (construct.net/en/make-games/games-editor): event sheets, behaviors, layout/animation/tilemap tools, effects, debugger, project tools. Spec: docs/CONSTRUCT_PARITY.md_

- [x] **M10-01** Spec: docs/CONSTRUCT_PARITY.md — map each Construct 3 editor feature to Nord equivalent, scope + non-goals (no copying Construct code/assets; clean-room, original names where practical)
- [x] **M10-02** Event sheet format: JSON schema (events/conditions/actions/groups/functions/vars) + PROJECT_FORMAT.md section + versioning
- [x] **M10-03** Event sheet compiler: JSON -> nord.js module (and interpreter fallback for hot-reload), source maps for debugger
- [x] **M10-04** Event sheet editor panel (egui): add/edit/delete/reorder events, condition/action picker dialog with search, drag&drop, collapse, comments, disable, colour groups, undo/redo
- [x] **M10-05** Event sheet: object picker + parameter widgets (expression editor w/ autocomplete, expressions, object/instance/layer/animation/audio pickers)
- [x] **M10-06** Event sheet: system conditions/actions (every tick, on start of layout, trigger once, compare var, for-each, repeat, while, pick by comparison/evaluate/random, else, wait, go to layout, set timescale)
- [x] **M10-07** Event sheet: functions (params, return value, async), includes, global/local/static vars, groups activation, sub-events
- [x] **M10-08** Behavior framework: attach/detach in inspector, behavior schema (properties, conditions, actions, expressions) shared by editor + runtime
- [x] **M10-09** Behaviors set A: Platform, 8-Direction, Bullet, Sine, Fade, Wrap, Scroll-To, Bound-to-Layout, Solid, Jumpthru, Persist, Destroy-outside-layout
- [x] **M10-10** Behaviors set B: Pin, Drag&Drop, Anchor, Car, Orbit, Rotate, Flash, Timer, Tween, Turret, Line of Sight, Pathfinding (grid A*), Physics
- [x] **M10-11** Families + instance variables + containers + global objects + object templates (prefab link)
- [x] **M10-12** Layout editor: layer panel (add/rename/reorder/lock/hide, parallax, scale rate, opacity, blend mode, transparent, background colour, force own texture)
- [x] **M10-13** Layout editor: rulers/guides, snapping options, alignment/distribute for multi-select, layout properties (size, unbounded scrolling, event sheet link), multiple layouts + layout switching
- [x] **M10-14** Layout editor: object-type panel + drag-to-place, instance property sync, layout views (zoom), minimap/overview
- [x] **M10-15** Sprite/image editor: paint tools (pencil, brush, eraser, fill, line, rect, ellipse, select, move, flip/rotate), palette, zoom/grid, import/export PNG
- [x] **M10-16** Sprite editor: origin point, named image points, collision polygon editor with auto-trace, per-frame properties
- [x] **M10-17** Animation editor v2: multiple named animations per object, frame list, duration/speed/loop/ping-pong/repeat-to, onion skin, preview play, import spritesheet/GIF, tags
- [x] **M10-18** Tilemap editor v2: tileset import + slicing, paint/rect/fill/random brushes, multiple layers, tile collision polygons, animated tiles, auto-tile (terrain) rules
- [x] **M10-19** Effects: per-object/layer/layout effect stack + parameters in inspector; built-ins (blur, glow, bloom, outline, CRT, tint, brightness/contrast, hue, pixelate, wave, distort, vignette); JS runtime pipelines
- [x] **M10-20** Particles: editor with live preview, presets (fire, smoke, snow, sparks), property curves
- [x] **M10-21** Timeline/keyframe editor: tracks per property, easing curve editor, events trigger, play/pause actions
- [x] **M10-22** Debugger: pause/resume/step, inspector for live instances + vars (editable), event sheet highlighting + breakpoints, console eval
- [x] **M10-23** Profiler: FPS/frame-time/draw-calls/memory graphs, per-event-group cost, object count, slow-frame markers
- [x] **M10-24** Preview: preview layout/project buttons, LAN preview URL + QR for phone, window size/orientation presets, hot-reload with state keep
- [x] **M10-25** Project tools: project properties dialog (name, size, scaling mode, orientation, fullscreen, loader style, icons, version), folders in project bar, Find All References, project search/replace, safe rename
- [x] **M10-26** Plugin objects: Text, Tiled Background, 9-Patch, Spritefont, Array, Dictionary, JSON, AJAX, LocalStorage, Function, Audio, Keyboard/Mouse/Touch/Gamepad, Drawing Canvas, Video — as nord.js objects with actions/conditions/expressions
- [x] **M10-27** Addon SDK: JS addon format (plugin/behavior/effect) + `nord addon pack/install`, editor loads metadata, docs + sample addon
- [x] **M10-28** Export presets: PWA (manifest + service worker offline), Web zip, itch.io, Mac/Win/Linux via existing players; export wizard with checks (size, offline scan, missing assets)
- [x] **M10-29** Templates + example browser: Platformer, Top-down shooter, Puzzle, Endless runner, UI/menu starters built with event sheets; open-as-project
- [x] **M10-30** Localisation + accessibility: string tables, language switch action, UI scale, touch-controls overlay, colour-blind preview
- [x] **M10-31** Version history: snapshots + restore + diff view for project JSON/event sheets
- [x] **M10-32** Optional: Multiplayer (WebRTC P2P + LAN signalling) plugin and demo
- [x] **M10-33** Manual + tutorials for all M10 features (event sheets first-game tutorial, behaviors, layout editor, effects, debugger); rebuild docs/manual
- [x] **M10-34** Tests: event-sheet compiler unit tests, behaviors headless Chromium tests, egui_kittest for new panels; wire to CI
- [x] **M10-35** Rendering plugin objects: Tiled Background, 9-Patch, Spritefont, Drawing Canvas, Video

## M11 — Web editor
_the editor in a browser and on a Linux server (wasm egui + server mode); plan docs/WEB_EDITOR_PLAN.md_

- [x] **M11-01** W0 spike: build nord-editor for wasm32 (eframe web), render hub + hierarchy in headless Chromium; record wasm size, start time, WebGL2/WebGPU; feature-gate native-only deps (wry, nord-desktop native, rfd native)
- [x] **M11-02** Vfs trait (read/write/list/rename/delete/watch, atomic write): NativeFs; route nord-core::io, autosave, asset browser, code editor, thumbnails through it — native behaviour unchanged, tests green
- [x] **M11-03** Host trait (run build/export/serve/check-offline/thumbs jobs, stream log lines, cancel): LocalHost (today's std::process) + NoHost; export dialog + console use it
- [x] **M11-04** Dialogs/clipboard abstraction (rfd native + wasm async pickers, web clipboard) and web-safe default shortcuts (avoid Cmd/Ctrl+P/K/S clashes, rebindable)
- [x] **M11-05** crates/nord-editor-web: wasm entry, index.html, PWA manifest + service worker, vendored fonts/docs, no CDN; build script (wasm-bindgen/wasm-opt, brotli)
- [x] **M11-06** BrowserFs: OPFS projects, zip import/export, Chromium File System Access folder mode; hub works in browser
- [x] **M11-07** IframeViewport: game view, 2D/3D edit views, console and docs viewer via iframe overlay + postMessage IPC (reuse native wry sizing logic); service worker serves the project from the Vfs
- [x] **M11-08** In-browser export: nord-core/nord-export (validate, copy, zip, single-file) compiled to wasm for static-web mode
- [x] **M11-09** crates/nord-editor-server (axum, builds on nord-serve): serves wasm editor, /api/p/{project}/(file|tree|rename|delete), WebSocket file events + job logs, path jail, atomic writes
- [ ] **M11-10** RemoteFs + ServerHost (client side of the project API/jobs) so the same wasm editor edits server projects; reconnect + conflict handling (single writer lock)
- [x] **M11-11** Server jobs: web/single-file export, offline check, thumbnails, optimise, zip download; optional container-isolated Rust-tier builds; CPU/RAM/time limits
- [x] **M11-12** Auth + multi-user: token (default) and users file (argon2), per-user workspaces, quotas, CSRF/session hardening, desktop bridge disabled in server mode
- [ ] **M11-13** Packaging: Dockerfile + docker-compose, systemd unit, nginx/Caddy TLS examples, `nord-editor-server --help`, backups note
- [ ] **M11-14** CI: build wasm editor + server, Playwright e2e (new project -> edit -> save -> reload; play; export from browser; server path-traversal tests)
- [ ] **M11-15** Docs: manual chapter 'Run the editor in a browser / on a server' with screenshots, KNOWN_ISSUES entries (browser limits, unverified Safari/Windows), HOSTING/EXPORT docs cross-links
- [ ] **M11-16** OWNER: verify web editor on macOS Safari/Chrome, Windows Edge, Firefox; decide auth model and Rust-tier-on-server policy (docs/WEB_EDITOR_PLAN.md §7)

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
| FR-50 | Event sheets (visual logic: events, conditions, actions, groups, includes, functions, local/global vars, sub-events, else/or blocks) compiled to nord.js | M10 | critical | todo |
| FR-51 | Behaviors system (attachable reusable components: Platform, 8-Direction, Bullet, Sine, Fade, Pin, Drag&Drop, Solid, Wrap, Tween, Car, Physics, Pathfinding, Line of Sight, Scroll-To, Bound-to-Layout, Turret, Orbit, Rotate, Timer, Flash, Anchor, Destroy-outside, Persist) | M10 | critical | todo |
| FR-52 | Layout editor (layers w/ parallax/scale/opacity/blend/force-own-texture, instances, snap, rulers, multi-select align/distribute, lock layers, layout views, multiple layouts + transitions) | M10 | high | todo |
| FR-53 | Object types + instances (families, instance variables, effects per object, containers, global objects, templates, 9-patch, tiled background, text, sprite font) | M10 | high | todo |
| FR-54 | Image/sprite editor (paint, layers-lite, origin + image points, collision polygon editor, tags, pixel tools, import GIF/spritesheet) | M10 | high | todo |
| FR-55 | Animations editor upgrade (named animations, frames, per-frame duration, speed, loop/ping-pong/repeat-to, import/export, onion skin, preview) | M10 | high | todo |
| FR-56 | Tilemap editor (Tiled-style: tile painting, brush/rect/fill/random, tile collision polygons, animated tiles, layers) in-editor | M10 | high | todo |
| FR-57 | Effects/shaders per object/layer/layout (blur, glow, bloom, CRT, tint, color adjust, outline, distortion…) via WebGL/Phaser pipelines | M10 | medium | todo |
| FR-58 | Debugger + profiler (pause/step, inspect live instances/vars, edit values at runtime, event sheet breakpoints, FPS/CPU/GPU/memory graphs, remote preview) | M10 | high | todo |
| FR-59 | Project bar/tools (project properties, object/layout/event/script/audio/font/icon folders, Find All References, project-wide search/replace, rename-aware refactor, global variables, project-level undo) | M10 | medium | todo |
| FR-60 | Addon SDK (plugins, behaviors, effects, drawing plugins in JS; editor-side metadata; package + install as .nordaddon) | M10 | medium | todo |
| FR-61 | Plugin set: Sprite, Text, Tilemap, Particles, Audio, Keyboard, Mouse, Touch, Gamepad, Array, Dictionary, JSON, AJAX, Local Storage, Browser, Function, System, Timeline/Tween, 3D-lite shapes, Video, Spritefont, Drawing canvas | M10 | medium | todo |
| FR-62 | Timeline editor (keyframes for properties/animations, easing curves, play from events) | M10 | medium | todo |
| FR-63 | Multi-platform export presets (Web, Mac, Windows, Linux, PWA w/ offline manifest + service worker, mobile-web, itch.io/Newgrounds zip) w/ export wizard | M10 | medium | todo |
| FR-64 | Preview modes (Preview layout/project, preview on LAN/QR for phone, hot-reload, preview with debugger, window-size presets/rotation) | M10 | medium | todo |
| FR-65 | Templates + built-in example browser (Platformer, Shooter, Puzzle, UI; open example as project) and tutorials entry | M10 | low | todo |
| FR-66 | Multiplayer plugin (peer-to-peer via WebRTC signalling; offline-first, optional LAN) + save/load slots | M10 | low | todo |
| FR-67 | Accessibility/localisation (string tables, language switch, UI scale, colour-blind preview, touch controls overlay) | M10 | low | todo |
| FR-68 | Version history + snapshots + project folder diff (git-friendly, restore snapshot) | M10 | low | todo |
| FR-69 | Editor on the web: browser (static/PWA) + self-hosted Linux server, same egui editor compiled to wasm | M11 | high | todo |


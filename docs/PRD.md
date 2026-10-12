# Nord Engine — Product Requirements (PRD)

> Machine-readable twin: [`/PRD.json`](../PRD.json) (feature + task status, source of truth).
> Human checklist: [`/task.md`](../task.md) (generated from PRD.json).
> Author: **Crowelian 2026 + Sonnet**. Personal-use engine → pragmatic, not enterprise.

## 1. Vision

**Nord Engine** is a personal, all-in-one game/app engine + editor written in **Rust**
that **builds static HTML web games/apps** (drop the output folder on any server) and
also ships as a **native macOS (Apple Silicon) desktop app**. Windows + Linux later.

It must feel like "Godot/PlayCanvas/Defold in one", but with a better, modern UI, a
built-in full code editor, a huge library of ready-made scripts/assets/examples, and
**zero online dependencies** (every library vendored).

## 2. Principles (read before changing anything)

1. **Reuse, don't reinvent.** Clone/vendor proven code (Phaser, Babylon, PCUI, CodeMirror,
   macroquad, rapier, egui…). Write glue, not engines.
2. **Do not over-engineer.** Single user. Prefer the boring option. No plugin frameworks,
   no ECS-from-scratch in JS, no custom renderers.
3. **Offline / vendored.** An exported game must make **zero** network requests to third
   parties. `nord check-offline` enforces it.
4. **Perfect the core, not the edges.** Core loop (create → edit → play → export) must be
   rock solid before breadth.
5. **AI-handoff friendly.** Every decision, spec, status and how-to lives in the repo
   (`AGENTS.md`, `docs/`, `PRD.json`, `task.md`). Any AI must be able to continue, update
   or fix bugs from the files alone.
6. **Everything replaceable.** All art/audio are placeholders listed in `ASSETS.md`.
7. **Apple Silicon first, portable second.** Use cross-platform crates, no mac-only
   hacks outside `cfg(target_os)` blocks.

## 3. Platform matrix

| Target | Status goal | Notes |
|---|---|---|
| macOS arm64 (M1 Max) editor + player | **Primary** | Tauri v2 (WKWebView), `.app`/`.dmg`, CI on `macos-14` |
| Web export (static HTML, any server) | **Primary** | Phaser / Babylon / Rust-WASM |
| Windows x64 editor | Later (M8) | Tauri/WebView2 — keep code portable |
| Linux x64 editor | Optional (M8) | Tauri/WebKitGTK |
| macOS x64, mobile | Out of scope | web export works on mobile browsers |

## 4. Product pieces

1. **Editor** (`editor/` web UI + `crates/nord-editor` Tauri shell) — PCUI-based panels:
   hierarchy, inspector, viewport (2D/3D with gizmos), asset browser w/ thumbnails,
   CodeMirror code editor, console, play/stop, library browser, docs/tutorial viewer.
2. **Core + CLI** (`crates/nord-core`, `crates/nord-cli`) — project format, asset pipeline
   (thumbnails, atlas, import), build/export, dev server, offline check, bundle for mac.
3. **Runtimes** (what ships inside games):
   - `runtime/` **nord.js** + Phaser adapter (2D) + Babylon adapter (3D) — JS scripts.
   - `crates/nord-runtime-wasm` — Rust game runtime → wasm32 (macroquad + rapier2d).
   - `crates/nord-app-wasm` — Rust **app** runtime → wasm32 (eframe/egui).
4. **Player** (`crates/nord-player`) — prebuilt Tauri/wry shell used as the Mac wrapper for
   exported games (`.app`), content swapped in, no per-game compile.
5. **Library** (`library/`) — snippets, controllers, physics, UI, AI, systems, templates,
   example games + apps, asset packs. Big. Game-ready, not toy.
6. **Docs** (`docs/manual/`) — HTML manual, guides, tutorials with live CodeMirror
   examples (all vendored, offline).

## 5. Functional requirements

IDs match `PRD.json → features[]`.

### Engine & runtime
- **FR-01 Project format** — folder project (`nord.project.json`, `scenes/*.scene.json`,
  `prefabs/`, `scripts/`, `assets/`), diff/AI friendly JSON. Spec: `PROJECT_FORMAT.md`.
- **FR-02 Scene model** — entities with transform, parent/child, components, scripts,
  prefabs, tags, layers. Same JSON loads in Phaser, Babylon, Rust runtimes.
- **FR-03 nord.js core** — entity/component/script lifecycle (`init/start/update/fixedUpdate/
  onDestroy`), attributes (inspector-visible fields), events, input (kbd/mouse/touch/
  gamepad), audio, timers/tweens, save/load, scene switching, asset loader, UI layer.
- **FR-04 2D runtime (Phaser)** — sprites, animation, tilemaps (Tiled JSON), particles, cameras,
  arcade+matter physics, text/bitmap text, parallax, lights 2D.
- **FR-05 3D runtime (Babylon)** — glTF/GLB, PBR, lights/shadows, skybox, cameras, Havok
  physics, animation, particles, post-process, GUI, nav (optional).
- **FR-06 Rust/WASM game runtime** — macroquad + rapier2d, WebGL, loads same scene JSON
  subset (2D), Rust `Script` trait, for perf-heavy or Rust-coded games.
- **FR-07 Rust/WASM app runtime** — eframe/egui compiled to wasm (WebGL) for tool/app-type
  projects; template + examples.
- **FR-08 Simple-game path** — plain HTML5 canvas/DOM template (no WebGL/wasm needed) for
  tiny games and apps. Engine recommends tier by project complexity (see EXPORT_TARGETS).
- **FR-09 Physics** — Arcade/Matter (2D), Havok (3D), rapier (Rust). Ready scripts for each.
- **FR-10 Audio** — music + sfx, buses/volume, mute, WebAudio unlock handling.
- **FR-11 UI toolkit** — in-game HUD/menus (DOM/CSS layer for JS runtimes, Babylon GUI for 3D
  in-world, egui in Rust). Ready UI screens in library.

### Editor
- **FR-20 Editor shell** — Tauri v2 app; **splash screen shown ≥2 s** on start; native menus;
  project open/new/recent; settings; dark theme (+ light optional).
- **FR-21 Hierarchy + inspector** — tree w/ drag-drop reparent, add/delete/duplicate, undo/redo,
  inspector auto-generated from component/script attribute schemas.
- **FR-22 Viewport** — 2D (Phaser) and 3D (Babylon) editing, gizmos (move/rotate/scale),
  grid, snap, camera nav, selection, play-in-viewport.
- **FR-23 Asset browser** — folder tree, **thumbnails** (image, sprite sheet, audio waveform,
  glTF render, script/code icon), search, filter, drag into viewport/inspector, import,
  rename/move/delete, metadata.
- **FR-24 Code editor** — full CodeMirror 6: tabs, syntax (JS/TS/Rust/HTML/CSS/JSON/MD/GLSL/WGSL),
  autocomplete for nord.js API, find/replace, multi-cursor, themes, lint, format, save,
  hot-reload script in running game.
- **FR-25 Library browser** — browse/search/insert snippets, scripts, prefabs, templates, asset packs.
- **FR-26 Play/Preview** — Play button runs project in embedded iframe via dev server; console
  panel captures logs/errors; reload on save.
- **FR-27 Docs viewer** — manual + tutorials inside the editor (offline).
- **FR-28 Export dialog** — Web (static), Web (single file zip), Mac app, Rust-WASM, pick
  tier, run offline check, open output folder.

### Pipeline
- **FR-30 CLI** — `nord new|build|serve|export|thumbs|check-offline|bundle-mac|doctor|vendor`.
- **FR-31 Thumbnails** — generated by CLI (`image` crate) + cached in `.nord-cache/thumbs`.
- **FR-32 Vendoring** — `tools/vendor.mjs` downloads pinned libs to `vendor/` with manifest +
  checksums; exports copy only what is used.
- **FR-33 Offline guarantee** — scanner fails export if any `http(s)://` resource loads remain.
- **FR-34 Mac wrapper** — export a double-clickable `.app` (WKWebView player) for a game.

### Content
- **FR-40 Placeholder assets** — logo, splash, icons, textures, sprites, sfx, music, UI kit,
  manual graphics. All listed in `ASSETS.md`.
- **FR-41 Snippet/script library** — 200+ entries across controllers, physics, gameplay, AI,
  UI, utilities, FX, apps, shaders. Each has metadata (`library/INDEX.json`), docs, demo.
- **FR-42 Examples** — ≥ 12 full games + ≥ 6 apps + Rust-wasm samples. Runnable from editor.
- **FR-43 Manual + tutorials** — full manual, guides per feature, ≥ 12 tutorials with live
  code in CodeMirror, vendored, offline.

## 6. Non-functional
- **Offline**, **fast start** (<1.5 s to editor after splash), exports small (tree-shake what
  is used: Babylon modules/Phaser plugins optional), smooth 60 fps viewport on M1 Max.
- **Stability**: autosave + crash-safe writes (write temp → rename); undo stack.
- **Maintainability**: small modules, no build step for editor/runtime JS (ES modules +
  import map) except one-time bundles (CodeMirror via esbuild, committed).
- **Security**: editor serves only project dir on localhost; no remote code.

## 7. Milestones (detail in `task.md`)

| ID | Name | Outcome |
|---|---|---|
| M0 | Planning, identity, assets, vendoring | Plans, brand, placeholder assets, vendored libs, workspace skeleton |
| M1 | Foundation | nord-core, CLI, project format, dev server, thumbnails, offline check |
| M2 | JS runtimes | nord.js + Phaser + Babylon adapters, scripts, physics, UI, audio |
| M3 | Editor | Tauri shell, splash, hierarchy/inspector/viewport/assets/code editor |
| M4 | Export | web static, single file, mac wrapper app, offline check |
| M5 | Rust/WASM | macroquad+rapier runtime, egui app runtime, wasm export |
| M6 | Library | snippets, controllers, systems, asset packs, examples |
| M7 | Docs | manual, guides, tutorials, in-editor docs |
| M8 | Polish & portability | dmg, CI, Windows, Linux, perf, bug backlog |

## 8. Definition of done (per task)
Code merged on branch, builds, has a quick test or manual-verification note, documented in
`docs/` if user-facing, `task.md` ticked via `node tools/tasks.mjs done <ID>`, `PRD.json`
updated, `CHANGELOG.md` line added.

## 9. Risks
| Risk | Mitigation |
|---|---|
| Scope is huge | Strict milestone order; core loop first; library last |
| Three runtimes drift | One scene JSON + conformance examples run on each |
| Tauri unverifiable on Linux sandbox | Editor UI is plain web → testable in Chromium; native shell checked on macOS CI |
| Upstream licences (Defold, Godot icons CC-BY) | Tracked in `docs/UPSTREAM.md`; Defold = inspiration only |
| Babylon bundle size | Use per-package UMD builds, export only needed packages |
| Browser audio autoplay | nord.js unlock-on-first-input helper |

## 10. Open questions (owner can veto the defaults)
1. Editor shell defaulted to **Tauri + PCUI** instead of egui (ADR-001). egui kept for Rust apps.
2. Scripting default = **JavaScript** (TS optional later). Rust scripts only in wasm tier.
3. Bevy: reference only; macroquad is the wasm default (smaller). A Bevy template may be added in M8.

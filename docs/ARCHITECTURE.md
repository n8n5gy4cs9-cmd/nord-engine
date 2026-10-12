# Architecture

## 1. Big picture

```
┌─────────────────────────── Nord Editor (Tauri v2, macOS arm64) ───────────────────────────┐
│  Web UI (editor/, PCUI + CodeMirror + Lucide, vendored, no build step)                      │
│  hierarchy | inspector | viewport (Babylon/Phaser) | assets+thumbs | code | console | docs │
│            ▲ invoke() / fetch                                                              │
│  Rust shell crates/nord-editor ── uses ──► nord-core (project model, assets, thumbs, build)│
└───────────────────────────────┬────────────────────────────────────────────────────────────┘
                                │ same code, also callable as CLI / dev server
                         nord-cli  (new | serve | build | export | thumbs | check-offline | bundle-mac)
                                │
         ┌──────────────────────┼──────────────────────────┬────────────────────────┐
         ▼                      ▼                          ▼                        ▼
  Web-2D export          Web-3D export              Web-WASM export           Mac app export
  nord.js + Phaser       nord.js + Babylon (+Havok)  nord-runtime-wasm         nord-player.app
  (static folder)        (static folder)             (macroquad+rapier2d)      + game folder
                                                      nord-app-wasm (egui)
```

All web exports are **static folders**: `index.html`, `nord.json` (project manifest),
`scenes/`, `assets/`, `scripts/`, `lib/` (only the vendored libs actually used).

## 2. Repository layout

```
nord-engine/
├─ AGENTS.md  README.md  PRD.json  task.md  ASSETS.md  THIRD_PARTY.md  LICENSE
├─ docs/                 plans + specs + manual (docs/manual = HTML manual, built in M7)
├─ crates/
│  ├─ nord-core/         project model, scene schema, asset index, thumbnails, offline scan
│  ├─ nord-cli/          `nord` binary (clap): new/serve/build/export/thumbs/check-offline/…
│  ├─ nord-editor/       Tauri v2 shell (M3); exposes nord-core as commands, splash window
│  ├─ nord-player/       Tauri/wry runtime shell for Mac wrapper (M4)
│  ├─ nord-runtime-wasm/ macroquad+rapier2d game runtime (M5)
│  └─ nord-app-wasm/     eframe/egui app runtime (M5)
├─ runtime/              nord.js (ES modules): core/, phaser/, babylon/, ui/, util/
├─ editor/               editor web UI (index.html, src/*.js, css, panels)
├─ vendor/               pinned third-party JS/wasm (+ VENDOR.json manifest) — committed
├─ library/              snippets/, controllers/, systems/, ui/, ai/, fx/, apps/, templates/, INDEX.json
├─ examples/             complete runnable games + apps (each is a full nord project)
├─ assets/               brand/, icons/, textures/, sprites/, audio/, ui/, docs/ (placeholders)
├─ tools/                fetch-upstreams.sh, vendor.mjs, tasks.mjs, gen_assets.py, …
└─ third_party/          (gitignored) shallow upstream clones for harvesting code
```

## 3. Core concepts

- **Project**: a directory with `nord.project.json`. Types: `2d` (Phaser), `3d` (Babylon),
  `wasm-game` (Rust/macroquad), `wasm-app` (Rust/egui), `html` (plain HTML/JS, no engine).
- **Scene**: JSON tree of **entities**; each entity = `{id,name,enabled,tags,layer,transform,components[],scripts[],children[]}`.
- **Component** (built-in, data only): `sprite, animatedSprite, tilemap, camera, light, mesh, model,
  rigidbody, collider, audioSource, particles, text, uiElement, …` — schema in `PROJECT_FORMAT.md`.
- **Script**: JS class extending `NordScript` with lifecycle + `static attributes` that the
  inspector renders (same idea as PlayCanvas script attributes). Rust: `trait Script`.
- **Prefab**: scene subtree saved as `*.prefab.json`; instances reference it with overrides.
- **Adapters**: `runtime/phaser/` and `runtime/babylon/` translate component data into engine
  objects. nord.js core is engine-agnostic (input, events, timers, entity tree, scripts).
- **Dev server**: `nord serve` (axum) serves project + vendor + runtime with live reload (SSE);
  the editor's Play iframe and browser preview both use it.

## 4. Editor ⇄ backend contract
Editor UI talks to Rust through a tiny adapter `editor/src/backend.js`:
- inside Tauri → `window.__TAURI__.core.invoke(cmd,args)`
- in a plain browser (dev/test/CI) → `fetch('/api/<cmd>')` against `nord serve --editor`
Same command set both ways (`list_dir, read_file, write_file, new_project, thumbs, build, …`).
This makes the whole editor testable with Playwright/Chromium on Linux CI.

## 5. Build tiers (when to use what)
| Tier | Use when | Size | Needs |
|---|---|---|---|
| `html` simple | tiny game/app, DOM/canvas only | ~KBs | nothing |
| `2d` Phaser | most 2D games | ~1.2 MB | WebGL/Canvas |
| `3d` Babylon | 3D | 3–8 MB | WebGL2 (+wasm for Havok) |
| `wasm-game` | perf/Rust logic, big sims | 1–4 MB wasm | WebGL + wasm |
| `wasm-app` | tools/apps in Rust | 3–6 MB wasm | WebGL + wasm |

`nord doctor` + the New Project wizard recommend a tier from answers (2D/3D, physics, Rust?).

## 6. Offline & vendoring
`tools/vendor.mjs` installs pinned npm packages into a temp dir and copies the dist files into
`vendor/<name>/<version>/…`, writes `vendor/VENDOR.json` (name, version, licence, sha256, source URL).
Editor + runtimes reference `vendor/...` only. `nord check-offline <dir>` greps built HTML/JS/CSS for
absolute `http(s)://`/`//cdn` loads (excluding allowlisted namespace URIs like `http://www.w3.org`).

## 7. Mac wrapper
`nord bundle-mac <dist> --name X` copies prebuilt `NordPlayer.app` (built once by CI), places the
game dist into `Contents/Resources/game/`, patches `Info.plist` (name, bundle id, icon) and ad-hoc
`codesign`s. Player loads `tauri://localhost/game/index.html` — no network, no per-game compile.

## 8. Data flow: Play
Editor save → `write_file` → dev server FS watcher → SSE `reload` → iframe reloads (or script
hot-swap: `NordRuntime.hotReloadScript(path)` keeps scene state).

## 9. Coding conventions
- Rust 2021, `anyhow` in bins, `thiserror` in libs, `serde`/`serde_json`, `clap`, `axum`, `image`.
- JS: ES modules, no transpile, JSDoc types, 2-space indent, no frameworks beyond PCUI.
- File names kebab-case; entity ids = 8-char base36; JSON stable key order (serde `preserve_order`).
- One responsibility per file; < 500 lines preferred.

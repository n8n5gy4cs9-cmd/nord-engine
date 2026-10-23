# Architecture

## 1. Big picture

```
┌──────────────────────── Nord Editor (native Rust: eframe/egui, wgpu→Metal on M1) ───────────────────────┐
│ egui_dock panels: hierarchy | inspector | assets+thumbnails | code editor (native) | console | library │
│ ┌───────────────────────────── Viewport / Play / Docs panel ─────────────────────────────────────────┐ │
│ │  wry child webview → `nord serve` → vendored Phaser / Babylon runtime in EDIT or PLAY mode          │ │
│ └──────────────▲──────────────────────────────────────────────────────────────────────────────────────┘ │
│        IPC (wry ipc_handler ⇄ evaluate_script): selection, transforms, logs                               │
│ links nord-core directly (project model, assets, thumbs, build) — no RPC layer                           │
└───────────────────────────────┬────────────────────────────────────────────────────────────────────────┘
                         nord-cli  (new | serve | build | export | thumbs | check-offline | bundle-mac)
                                │
         ┌──────────────────────┼──────────────────────────┬────────────────────────┐
         ▼                      ▼                          ▼                        ▼
  Web-2D export          Web-3D export              Web-WASM export           Mac app export
  nord.js + Phaser       nord.js + Babylon (+Havok)  nord-runtime-wasm         nord-player.app (wry)
  (static folder)        (static folder)             (macroquad+rapier2d)      + game folder
                                                      nord-app-wasm (egui)
```

All web exports are **static folders**: `index.html`, `nord.json` (project manifest),
`scenes/`, `assets/`, `scripts/`, `lib/` (only the vendored libs actually used).

## 2. Repository layout

```
nord-engine/
├─ AGENTS.md  README.md  PRD.json  task.md  ASSETS.md  THIRD_PARTY.md  LICENSE
├─ docs/                 plans + specs + foldered static manual (docs/manual/{nord,engines,assets})
├─ crates/
│  ├─ nord-core/         project model, scene schema, asset index, thumbnails, offline scan
│  ├─ nord-cli/          `nord` binary (clap): new/serve/build/export/thumbs/check-offline/…
│  ├─ nord-editor/       native eframe/egui editor (M3): panels, code editor, wry viewport, splash
│  ├─ nord-player/       tiny wry+tao shell for the Mac wrapper (M4)
│  ├─ nord-runtime-wasm/ macroquad+rapier2d game runtime (M5)
│  └─ nord-app-wasm/     eframe/egui app runtime (M5)
├─ runtime/              nord.js (ES modules): core/, phaser/, babylon/, ui/, util/
├─ editor/viewport/      JS side of the editor viewport (edit-mode glue loaded into the webview: gizmos, picking, IPC)
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

## 4. Editor ⇄ viewport contract (ADR-014)
The editor (egui) owns all state (project, selection, undo). The viewport page (`editor/viewport/edit.html`, served at `/__edit?mode=2d|3d`
by `nord-serve`) is a renderer + input surface. Transport is HTTP/SSE via the server's `Hub`, **independent of the webview**:
- editor → page (SSE `/__edit/events`; tests may `POST /__edit/cmd`): `scene {project,scene,selection,rev}`, `select {ids}`,
  `settings {tool,snap,snapMove,snapRot,snapScale,grid}`, `focus`, `thumbs {items:[{path,sha}]}` (offscreen model thumbnails).
- page → editor (`POST /api/ipc`, polled in-process): `ready`, `select {id}`, `transform {id,pos,rot,scale,final}`, `transforms {items,final}` (group drags), `addAsset {path,pos|onto}`, `key {key,cmd,shift,alt}`
  (shortcuts forwarded because a native webview owns keyboard focus), `thumb {path}`, `log {text}`.
- Live graph flow: an open Graph editor heartbeats `POST /api/graph-trace` (`x-nord`); the game polls `GET /api/graph-trace` and, only while someone watches, posts `{t:'graph-trace',nodes}` to `/__edit/cmd`, which reaches the Graph page over `/__edit/events`.
- Shared 2D navigation for the Level editors lives in `editor/common/sceneview.js`.
- Game/Play console: served HTML gets an injected hook posting `console.*` + errors to `/api/log`; the Console panel drains it.
- Security: server binds 127.0.0.1 only, rejects non-loopback `Host` (DNS rebinding), JSON endpoints need `application/json` and the raw-body ones (`/__edit/cmd`, `/api/thumb-upload`) need an `x-nord` header, so other web pages cannot drive the editor (no CORS preflight is ever answered).
- Webview (`--features webview`): `wry` child view placed over the egui panel rect (macOS WKWebView); hidden while an egui popup/modal is open.
  Without it (or on failure) the pane shows an "Open in browser" card; everything else works identically.
- 2D view = Canvas2D (`edit2d.js`), 3D view = Babylon (`edit3d.js`). Both are testable in Chromium without egui (`tools/e2e/50-edit-viewport.mjs`).

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
`nord bundle-mac <dist> --name X` copies prebuilt `NordPlayer.app` (built once by CI; tiny `wry`+`tao`
shell), places the game dist into `Contents/Resources/game/`, patches `Info.plist` (name, bundle id, icon) and
ad-hoc `codesign`s. Player serves `game/` through a wry custom protocol (`nord://game/index.html`) — no network,
no per-game compile.

## 8. Data flow: Play
Editor save → file written (tmp+rename) → dev server FS watcher → SSE `reload` → webview reloads (or script
hot-swap: `NordRuntime.hotReloadScript(path)` keeps scene state).

## 9. Coding conventions
- Rust 2021, `anyhow` in bins, `thiserror` in libs, `serde`/`serde_json`, `clap`, `axum`, `image`.
- Editor crates: `eframe` (wgpu), `egui_dock`, `egui_extras` (images, SVG icons, syntect), `rfd` (dialogs), `notify` (fs watch), `wry`+`tao`/raw-window-handle (webview), `egui_kittest` (tests).
- JS: ES modules, no transpile, JSDoc types, 2-space indent, no frameworks.
- File names kebab-case; entity ids = 8-char base36; JSON stable key order (serde `preserve_order`).
- One responsibility per file; < 500 lines preferred.

## Web editor (M11)
`nord_core::vfs` (Vfs: NativeFs / MemFs) and `nord-editor::platform` (dialogs, Host, dev server) separate the editor from the OS so the same egui code also builds for wasm32; `nord-editor-web` is the browser entry, `nord-editor-server` the self-hosted server. Desktop code paths are unchanged. See `WEB_EDITOR.md`, ADR-021.

### UI scenes
`runtime/core/uiscene.js` renders `ui/*.ui.json` as scoped DOM (shadow root); `game.ui.load()` or standalone `createUI(el)`. `editor/uidesigner/` is the visual editor (embedded tab, writes the JSON). Babylon GUI is used only for in-world UI (`game.gui.scene`). Spec: `docs/UI_SCENES.md`, ADR-030.

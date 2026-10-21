# Export targets

`nord export <project> --target <t> [--out dist/] [--minify] [--single-file]`

| Target | Output | Runtime shipped | Notes |
|---|---|---|---|
| `html` | folder | none (your own HTML/JS) | simple games/apps; optional `nord-lite.js` helpers |
| `web-2d` | folder | nord.js + Phaser (+ chosen plugins) | `lib/phaser.min.js`, assets copied/atlased |
| `web-3d` | folder | nord.js + Babylon packages + Havok wasm | only packages used by scene are copied |
| `web-3d-pc` | folder | nord.js + PlayCanvas engine (optional 4th tier, ADR-021) | `vendor/playcanvas/playcanvas.min.js` (~2.5 MB); **no physics**, no particles/postProcess/skybox yet |
| `web-wasm-game` | folder | `nord_game.wasm` + `mq_js_bundle.js` + `index.html` | built with `cargo build --release --target wasm32-unknown-unknown` + `wasm-opt -Oz` if present |
| `web-wasm-app` | folder | eframe wasm (+ JS glue via `wasm-bindgen`) | |
| `mac-app` | `Name.app` (+ optional `.dmg`) | NordPlayer + any of the above | uses prebuilt player; ad-hoc signed |
| `zip` | `name.zip` | any web target zipped | for itch.io-style upload |

## Implemented (M4)
`nord build <project> [-t auto|html|web-2d|web-3d|web-3d-pc] [-o dir] [--minify] [--single-file] [--optimize] [--zip]` (alias `nord export`), crate `nord-export`;
editor: **Project → Export…**. `web-wasm-game` (M5-05, verified) builds the Rust project with `cargo build --release --target wasm32-unknown-unknown` (flags: `--allow-undefined` via `--config`), copies `game.wasm`, the vendored `mq_js_bundle.js` and project data/assets, writes a relative `index.html`; `--optimize` runs `wasm-opt -Oz` if installed. `web-wasm-app` (M5-06) uses `wasm-bindgen --target web`. Rust-tier scripts are registry names (no file check in validation); audio must be .wav/.ogg. `--minify`/`--single-file` run `tools/export-bundle.mjs` (Node + vendored `esbuild-wasm`).
`nord bundle-mac <project|dist> [--player nord-player|NordPlayer.app] [--name] [-o dir] [--icon png] [--dmg]` assembles `<Name>.app`
(`Contents/Resources/game/` + Info.plist + generated AppIcon.icns, ad-hoc codesign on macOS); the player is `crates/nord-player` (wry+tao, `--features shell`, macOS-only to build). Hosting: HOSTING.md.
Not done: texture-atlas packing and lossy PNG quantisation (M4-11).

## Output layout (web)
```
dist/
├─ index.html          # loads lib/*, nord.json, boots runtime; no network except same-origin
├─ nord.json           # resolved manifest (project + scenes list + asset list + hashes)
├─ scenes/ prefabs/ scripts/ assets/
└─ lib/                # vendored runtime libs (versioned file names)
```
Must work from: any static server, `python3 -m http.server`, Netlify/itch/GitHub Pages, **and** `file://`
for the `--single-file` or `file-safe` mode (inline JSON + scripts, no `fetch` of local files).

## Build steps (web-2d/3d)
1. Load project, validate (nord-core). 2. Resolve used components → libs. 3. Optimise assets (optional: png quantise, audio→ogg/mp3).
4. Emit `nord.json` + copy files. 5. Generate `index.html` from `runtime/templates/*.html`. 6. Minify JS (optional, vendored esbuild-wasm or none).
7. `check-offline`. 8. Report sizes.

## Tier auto-recommendation (`nord doctor`)
- Only DOM/canvas, < 3 scenes, no physics → `html`
- 2D with sprites/physics/tilemaps → `web-2d`
- Any 3D → `web-3d`
- User picked Rust, or needs > ~5k active physics bodies/CPU heavy sims → `web-wasm-game`
- Tool/editor/dashboard in Rust → `web-wasm-app`

## Mac wrapper
See ARCHITECTURE §7. `NordPlayer` = wry+tao shell, no devtools in release, window config from `nord.json.display`,
fullscreen toggle (Cmd+Ctrl+F), persistent localStorage in app data dir.

## PWA / installable offline web app (M10-28)
`nord build --pwa` (editor: Export → "Installable offline web app") adds to a folder build: `manifest.webmanifest` (name, `start_url`, `display` = fullscreen, background/theme colour, icon from `export.web.icon` → `<project>/icon.png` → the Nord logo), `sw.js` (precaches every file; cache name changes with the content so an update replaces the old cache; cache-first) and the registration + manifest tags in `index.html`. Options in `nord.project.json`: `"export": { "web": { "icon": "icon.png", "pwa": { "display": "standalone", "orientation": "landscape", "shortName": "MyGame" } } }`.
Needs https or `localhost` to install (browser rule); from `file://` the game runs, the service worker is skipped. Not available with `--single-file` or Rust/WASM targets (refused with a clear message).
Verified headless: `node tools/pwa-test.mjs` builds the event-sheets example, registers the worker, goes offline with the server stopped and reloads. Not verified: install prompts on real phones / Safari.
**Export checks** (shown in the report/dialog): build over 100 MB, any non-engine file over 8 MB, external-host references (existing offline scan), missing assets (existing validation). itch.io / Mac / Win / Linux presets use the existing `--zip`, `bundle-mac` and `bundle-portable`.

`nord build` also compiles event sheets to JavaScript when Node is available (see docs/EVENT_SHEETS.md → Compiler); `--no-compile-events` keeps them as JSON.

## Exporting from the web editor
The browser editor exports the web targets as a zip in the page (no minify / single-file / optimise / event-sheet compile); the server editor runs the full `nord build` as a job. Rust/WASM and app-bundle targets stay desktop-only. See `WEB_EDITOR.md`.


### Full-source HTML app tutorials

Paper Worlds and RSS River demonstrate local Phaser/Babylon modules inside a normal HTML-tier project. Their downloaded source archives include their pinned vendor files. Paper Worlds exports an additional `my-paper-desk.html` with embedded board data; place it beside the project's exported modules/vendor folders and serve/share the whole folder. PNG/JSON are normal browser downloads, not silent writes into dist. RSS River's static export keeps cached/imported news and its original demo; live feed refresh needs source CORS or a Nord host with declared net permissions. These JavaScript apps already load Havok WASM for physics; they are not Rust/WASM target projects. Optional Node hosting is described only, with no server implementation for these two apps.

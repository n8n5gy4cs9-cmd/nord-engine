# Export targets

`nord export <project> --target <t> [--out dist/] [--minify] [--single-file]`

| Target | Output | Runtime shipped | Notes |
|---|---|---|---|
| `html` | folder | none (your own HTML/JS) | simple games/apps; optional `nord-lite.js` helpers |
| `web-2d` | folder | nord.js + Phaser (+ chosen plugins) | `lib/phaser.min.js`, assets copied/atlased |
| `web-3d` | folder | nord.js + Babylon packages + Havok wasm | only packages used by scene are copied |
| `web-wasm-game` | folder | `nord_game.wasm` + `mq_js_bundle.js` + `index.html` | built with `cargo build --release --target wasm32-unknown-unknown` + `wasm-opt -Oz` if present |
| `web-wasm-app` | folder | eframe wasm (+ JS glue via `wasm-bindgen`) | |
| `mac-app` | `Name.app` (+ optional `.dmg`) | NordPlayer + any of the above | uses prebuilt player; ad-hoc signed |
| `zip` | `name.zip` | any web target zipped | for itch.io-style upload |

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

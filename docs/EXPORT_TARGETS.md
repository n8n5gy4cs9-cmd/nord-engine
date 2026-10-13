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

## Touch controls (phones & tablets)
`runtime/touch/nord-touch.js` adds on-screen controls to **any** web export. It sends normal `KeyboardEvent`s (`code`/`key`/`keyCode`), so the game needs no changes.
- **web-2d / web-3d / web-3d-pc / web-wasm-game / web-wasm-app (and `--single-file`):** inlined automatically; buttons are derived from the project's `input.actions` (left/right/up/down → stick or D-pad, other actions → buttons, `pause`/`menu` → corner button; first keyboard code of each action).
- **html (your own page):** copy `nord-touch.js` next to `index.html` and add `<script src="nord-touch.js"></script>` (see `examples/html-touch`).
- Only shown on touch devices; `?touch=1` forces it on desktop, `?touch=0` turns it off; hides when a physical key is pressed.
- Options as `data-*` on the tag or `NordTouch.init({...})`: `preset` (`arrows|wasd|platformer|topdown|shooter|tap`), `dpad` (`stick|dpad|none`), `keys` (`up,left,down,right` codes), `buttons` (`Space:Jump,KeyX:Act`), `menu`, `opacity`, `size`, `force`, `fullscreen`, `auto="false"` (call `init` yourself). `NordTouch.axis` exposes the analog stick `[x,y]`.
- Limits: keyboard-driven games only (mouse/tap games already work via the browser's touch→mouse events); games that read the Gamepad API directly don't see it.

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

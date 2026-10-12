# Third-party software & content

Own code: MIT, © 2026 Crowelian + Sonnet. Vendored files keep their licences (full texts next to the files in `vendor/`).
Exact versions + sha256: `vendor/VENDOR.json` (reinstall/verify with `node tools/vendor.mjs [--verify]`).

| Component | Version | Licence | Location | Used for |
|---|---|---|---|---|
| Kenney 3D Platformer Kit (assets only) | 3fa8a04 | CC0 (kit code MIT, not included) | assets/packs/kenney-platformer-3d | optional real models/sfx/sprites (`tools/fetch-packs.sh`) |
| Phaser | 4.2.1 | MIT | vendor/phaser | 2D web runtime |
| Babylon.js (+loaders, gui, materials, post-process, procedural textures, serializers) | 9.30.0 | Apache-2.0 | vendor/babylonjs* | 3D web runtime |
| Havok physics (@babylonjs/havok) | 1.3.14 | MIT wrapper; wasm free with Babylon.js | vendor/havok | 3D physics |
| PlayCanvas engine | 2.23.2 | MIT | vendor/playcanvas | optional alternative 3D tier |
| CodeMirror 6 bundle | see lock | MIT | vendor/codemirror | manual live examples |
| marked | 18.1.0 | MIT | vendor/marked | manual markdown |
| Inter, Plus Jakarta Sans, IBM Plex Sans, JetBrains Mono, Fira Code, IBM Plex Mono (fontsource) | 5.3.0 | OFL-1.1 | vendor/fonts | UI/code fonts for runtime UI, editor, manual (woff2); skins in assets/themes/themes.json |
| Lucide icons (subset) | 1.55.0 | ISC | assets/icons/lucide | editor + manual icons |
| macroquad JS loader (`mq_js_bundle.js`) | 0.4.16 | MIT OR Apache-2.0 | vendor/macroquad | Rust/WASM game export |

Rust crates (egui/eframe/egui_extras/egui_dock/egui_kittest, rfd, arboard, notify-rust, opener, keyring, rusqlite (bundled SQLite), ureq, mime_guess, muda/tray-icon, global-hotkey, wayland-sys (dlopen), wry (optional `webview` feature), regex, axum, tokio, image, macroquad, rapier, …): see `Cargo.lock`; all MIT/Apache-2.0 class licences.
Editor fonts converted from the vendored woff2 to TTF (`tools/woff2_to_ttf.py` → `assets/fonts/skins/`) keep their OFL-1.1 licences; Inter/DejaVu TTFs in `assets/fonts/` are placeholders from M0.

Harvested/ported code from upstream repos (godot-demo-projects, playcanvas, raylib, bevy, macroquad, …) is listed here when added,
with the file path and source commit (see `UPSTREAM.lock.json`):

| File | Source | Licence | Change |
|---|---|---|---|
| `examples/rust-mq-snake/src/main.rs` | macroquad 0.4.16 `examples/snake.rs` | MIT OR Apache-2.0, © Fedor Logachev | entry point only |
| `examples/rust-mq-life/src/main.rs` | macroquad 0.4.16 `examples/life.rs` | MIT OR Apache-2.0, © Fedor Logachev | entry point only |
| `vendor/macroquad/mq_js_bundle.js` | macroquad 0.4.16 `js/` (gl.js + quad-snd + sapp-jsutils + quad-net, minified) | MIT OR Apache-2.0 | none (`node tools/vendor.mjs --crates`) |

## Showcase games (M6 examples)
- **RetroPaxDungeons** (`examples/retropaxdungeons`): rules/AI/FOV/level-patch logic ported from Shattered Pixel Dungeon (https://github.com/00-Evan/shattered-pixel-dungeon, GPL-3.0). Art original. Example is GPL-3.0.
  Its field-of-view source also cites RogueBasin's [FOV using recursive shadowcasting](http://www.roguebasin.com/index.php?title=FOV_using_recursive_shadowcasting). This citation was moved from the JS comment here so the offline URL scanner does not treat it as a runtime request.
- **Noom** (`examples/noom`): `P_Random` table, monster AI, damage formulas ported from id Software DOOM (https://github.com/id-software/doom, GPL-2.0); setting inspired by Barony (https://github.com/TurningWheel/Barony, GPL-3.0; no code/art used). Art original. Example is GPL-2.0-or-later.
- **Altimu 5.7** (`examples/altimu`): design/behaviour modelled on Ultima V as re-implemented by `synthwave-pixel/ultima5` (MIT; day/dawn/dusk hours, 4-letter keyword stubs, learned-word list, separate battle arena) and on Exult / the Ultima VII decompilation (`exult/exult` GPL-2.0, `Kitrinx/Ultima7_Decomp`) for names and story context only. **No code, data, text or art from those projects or from Origin/EA is included**; all dialogue, art and the Trinsic map are original. Importing the real map from the owner's own copy is documented in `examples/altimu/GUIDE.md`.
- **Harrison's Command** (`examples/harrison`): Kenney Starter Kits (MIT, https://github.com/KenneyNL/Starter-Kit-FPS, -City-Builder, -Racing, -3D-Platformer: models + a few sounds, copied as-is), movement constants ported from Starter-Kit-FPS `objects/player.gd`; weapon/structure/body numbers from Warzone 2100 `data/mp/stats/*.json` (GPL-2.0+, subset in `scripts/hc/wz-stats.json`; the example is therefore GPL-compatible); split-screen layout ported from the owner's `n8n5gy4cs9-cmd/nordrep` (`src/core/split.rs`). Carrier, Walrus, Manta, towers and islands are generated (`tools/gen_harrison_models.mjs`); textures/icons hand-pixelled.

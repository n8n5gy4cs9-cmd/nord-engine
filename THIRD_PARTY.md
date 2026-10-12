# Third-party software & content

Own code: MIT, © 2026 Crowelian + Sonnet. Vendored files keep their licences (full texts next to the files in `vendor/`).
Exact versions + sha256: `vendor/VENDOR.json` (reinstall/verify with `node tools/vendor.mjs [--verify]`).

| Component | Version | Licence | Location | Used for |
|---|---|---|---|---|
| Phaser | 4.2.1 | MIT | vendor/phaser | 2D web runtime |
| Babylon.js (+loaders, gui, materials, post-process, procedural textures, serializers) | 9.30.0 | Apache-2.0 | vendor/babylonjs* | 3D web runtime |
| Havok physics (@babylonjs/havok) | 1.3.14 | MIT wrapper; wasm free with Babylon.js | vendor/havok | 3D physics |
| PlayCanvas engine | 2.23.2 | MIT | vendor/playcanvas | optional alternative 3D tier |
| CodeMirror 6 bundle | see lock | MIT | vendor/codemirror | manual live examples |
| marked | 18.1.0 | MIT | vendor/marked | manual markdown |
| Inter, Plus Jakarta Sans, IBM Plex Sans, JetBrains Mono, Fira Code, IBM Plex Mono (fontsource) | 5.3.0 | OFL-1.1 | vendor/fonts | UI/code fonts for runtime UI, editor, manual (woff2); skins in assets/themes/themes.json |
| Lucide icons (subset) | 1.55.0 | ISC | assets/icons/lucide | editor + manual icons |
| macroquad JS loader (`mq_js_bundle.js`) | 0.4.16 | MIT OR Apache-2.0 | vendor/macroquad | Rust/WASM game export |

Rust crates (egui/eframe/egui_extras/egui_dock/egui_kittest, rfd, wry (optional `webview` feature), regex, axum, tokio, image, macroquad, rapier, …): see `Cargo.lock`; all MIT/Apache-2.0 class licences.
Editor fonts converted from the vendored woff2 to TTF (`tools/woff2_to_ttf.py` → `assets/fonts/skins/`) keep their OFL-1.1 licences; Inter/DejaVu TTFs in `assets/fonts/` are placeholders from M0.

Harvested/ported code from upstream repos (godot-demo-projects, playcanvas, raylib, bevy, macroquad, …) is listed here when added,
with the file path and source commit (see `UPSTREAM.lock.json`):

| File | Source | Licence | Change |
|---|---|---|---|
| `examples/rust-mq-snake/src/main.rs` | macroquad 0.4.16 `examples/snake.rs` | MIT OR Apache-2.0, © Fedor Logachev | entry point only |
| `examples/rust-mq-life/src/main.rs` | macroquad 0.4.16 `examples/life.rs` | MIT OR Apache-2.0, © Fedor Logachev | entry point only |
| `vendor/macroquad/mq_js_bundle.js` | macroquad 0.4.16 `js/` (gl.js + quad-snd + sapp-jsutils + quad-net, minified) | MIT OR Apache-2.0 | none (`node tools/vendor.mjs --crates`) |

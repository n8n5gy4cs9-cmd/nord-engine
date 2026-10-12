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

Rust crates (egui, eframe, egui_dock, wry, macroquad, rapier, image, axum, …): see `Cargo.lock`; all MIT/Apache-2.0 class licences.

Harvested/ported code from upstream repos (godot-demo-projects, playcanvas, raylib, bevy, macroquad, …) is listed here when added,
with the file path and source commit (see `UPSTREAM.lock.json`):

_(none yet)_

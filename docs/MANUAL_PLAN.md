# Manual, guides & tutorials plan (M7)

**Status: implemented.** `node tools/build-manual.mjs` builds `docs/manual/` (committed, so the editor Docs tab works without a build) from `docs/manual-src/*.md` (+ `_namespaces.json`, `tools/manual/components-data.mjs`) and the repo sources (runtime JSDoc/comments, `schema.rs`, CLI doc comments, `library/INDEX.json`, templates/examples, shortcuts, `docs/*.md`). `--check` builds to a temp dir, runs every `nord-live` snippet against the real core runtime, and fails on broken links/anchors or external URLs. Markdown extras: `::: dummies|tip|warn|todo` boxes, ```` ```nord-live ````, heading ids `{#id}`. After changing any source above, rebuild and commit `docs/manual/`. Desktop-apps chapter is a TODO stub until M9.

Output: `docs/manual/` — static HTML, offline, built by `tools/build-manual.mjs` from Markdown in `docs/manual-src/`
(vendored `marked`; syntax via CodeMirror in read-only mode; "Run" buttons for live examples using the vendored runtime).
Visual: `assets/docs/` graphics (banner, section icons, diagrams). Same viewer embedded in the editor (Docs tab).

## Live code blocks
Fenced block ```` ```nord-live ```` → renders an editable CodeMirror + running preview iframe (Phaser/Babylon vendored). "Copy to project" button.

## Manual TOC
1. Welcome — what is Nord, tiers, install (mac), first launch, project hub
2. Editor tour — layout, hierarchy, inspector, viewport, assets, code editor, console, shortcuts
3. Projects & scenes — format, entities, components, prefabs, layers/tags
4. Scripting — lifecycle, attributes, events, input, timers/tweens, hot reload, debugging
5. 2D — sprites, animation, tilemaps, cameras, particles, lights, text, parallax
6. 3D — models, materials, lights/shadows, skybox, cameras, animation, post-processing, GUI
7. Physics — 2D (arcade/matter), 3D (Havok), triggers, raycasts, joints
8. Audio — sfx, music, buses, procedural sfx
9. UI — HUD, menus, in-world UI, touch controls
10. Input — actions, keyboard/mouse/touch/gamepad, rebinding
11. Assets — importing, thumbnails, spritesheets, atlases, fonts, models, audio
12. Library — snippets, controllers, systems, templates, how to write your own
13. Rust/WASM — game runtime, app runtime (egui), writing Rust scripts, building
14. Export — web, single-file, mac app, hosting anywhere, offline check, size tips
15. Performance & debugging — profiling, pooling, texture budgets
16. Reference — nord.js API, component schemas, CLI, project format, shortcuts
17. Appendix — licences, vendored versions, troubleshooting, FAQ, changelog

## Tutorials (each ends with a runnable project in `examples/tutorials/`)
T01 Hello Nord (first scene) · T02 Sprite & movement · T03 Your first script · T04 Platformer from template · T05 Physics & collisions ·
T06 Tilemaps · T07 Animation & juice · T08 UI & HUD · T09 Audio · T10 3D scene & camera · T11 3D physics (FPS) · T12 Enemy AI ·
T13 Save/load · T14 Export to web & host it · T15 Mac app · T16 Rust/WASM game · T17 Rust egui app · T18 Writing library snippets.

## Graphics needed (generated, replaceable — see ASSETS.md "docs")
manual banner, per-section icons, diagram templates (architecture, tiers, editor layout), favicon, tutorial covers, code-theme preview.

## Complete-edition requirements (owner, 2026-10-12)
- Document **everything Phaser and Babylon can do, expressed in Nord format**: users only learn Nord namespaces (`NordScript`, `entity.*`, `game.physics/camera/audio/ui/gui/save`, component schemas). Raw Phaser/Babylon APIs appear only under an "escape hatch (`entity.native`)" heading.
- One HTML site: manual, guides, tutorials, per-component and per-API pages, cookbook, search. Generated from JSDoc + component schemas + hand-written pages so it can't drift.
- **"For dummies" info boxes** (plain-language explanations, analogies) on every concept page; shown only when the global toggle is on (persisted in localStorage; default off).

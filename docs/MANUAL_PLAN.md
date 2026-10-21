# Manual, guides & tutorials plan (M7)

**Status: implemented.** `node tools/build-manual.mjs` updates `docs/manual/` (committed, so the editor Docs tab works without a build) from `docs/manual-src/*.md` (+ `_namespaces.json`, `tools/manual/components-data.mjs`) and the repo sources (runtime JSDoc/comments, `schema.rs`, CLI doc comments, `library/INDEX.json`, templates/examples, shortcuts, `docs/*.md`). The builder compares bytes and writes only changed output files; unchanged files keep their modification times for fast FTP synchronization. A generated manifest removes only stale builder-owned files. `--check` builds to a temp dir, runs every `nord-live` snippet against the real core runtime, and fails on broken links/anchors or external URLs. Markdown extras: `::: dummies|tip|warn|todo` boxes, ```` ```nord-live ````, heading ids `{#id}`. After changing any source above, run the updater and commit its changed files. Desktop apps are documented after M9.

Output: `docs/manual/` — static HTML, offline, built by `tools/build-manual.mjs` from Markdown in `docs/manual-src/`
(vendored `marked`; syntax via CodeMirror in read-only mode; "Run" buttons for live examples using the vendored runtime).
Visual: `assets/docs/` graphics (banner, section icons, diagrams). Same viewer embedded in the editor (Docs tab).

Generated HTML is foldered by ownership and subject: `nord/{start,manual,tutorials,guides,api,components,reference,appendix}/`, `engines/phaser/{4.2,4.1-archive}/`, and `engines/babylon/{9.30,guides}/`. Large engine packages use namespace/hash buckets so no directory contains thousands of files. Search data is split into stable Nord/engine shards, so a small Nord edit does not rewrite the full engine index. The HTML shell and styling stay shared and relative-path safe for both `file://` and `/__docs/`.

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
- **"For dummies" info boxes** (plain-language explanations, analogies) on every concept page; shown by default, with a persisted global toggle to hide them.

## 2026-10-13 documentation redesign (M7-14)

Top-level areas: **Start here**, **Manual**, **Tutorials**, **Guides**, **API**. Only the current area appears in the sidebar; the API area groups Nord classes, components, file/CLI reference and engine docs. Each page has an on-page contents list and previous/next links. Dark/light appearance, mobile navigation, accessible search and colour-coded callouts share one static shell. Plain-language boxes default on (an existing saved preference is respected).

Beginner path: Getting started → How Nord works → Programming for dummy developers → T01/T02/T03. Chapters retain their technical information and begin with a concrete first action. Real bundled-game screenshots appear in the home/2D/3D pages; the first tutorial shows its actual Nord-rendered result.

All code fences have Copy controls and vendored CodeMirror syntax highlighting where a matching language exists. Read-only editors are created when their blocks approach the viewport. A classic-script wrapper around the exact vendored exports allows search/highlighting/navigation when opening HTML directly with `file://`; runnable ES-module examples require the editor Docs server or a local web server.

The reference includes every named `nord` export, class members/instance fields, component contracts, complete desktop TypeScript contract, and public Rust module declarations plus their source comments. Core signatures come from source; curated plain-language usage notes stay in `tools/manual/api-help.mjs`.

**Underlying engines remain separate and versioned.** `tools/vendor.mjs --docs` invokes `tools/vendor-docs.mjs`, fetching pinned Phaser 4.2.1 and Babylon 9.30.0 declaration packages (core + GUI/loaders/materials/post-process/procedural textures/serializers), parsing public declarations with pinned TypeScript 5.9.3, and preserving original declarations, licences and SHA-256 hashes. Babylon prose is cloned at the commit in `vendor/engine-docs/SOURCES.json`; all Markdown guides are rendered with local cross-links, escaped raw HTML and no online embeds/media. The owner's supplied Phaser 4.1.0 snapshot is archived separately and labelled as older/incomplete. Engine reference pages explain Nord's components/services first and do not claim upstream APIs are Nord methods. Research and reference citations: `docs/MANUAL_RESEARCH.md`.

## Complete-example tutorials and mobile/shader guides (2026-10-13)
T19 reconstructs Notepaint from a blank folder with complete shipped sources, persistence, drawing and portable files. T20 reconstructs Star-Not with solar-system/race data, campaign, motion/combat, saves, keyboard/gamepad co-op and touch controls. T21 is a text-only larger-game design and folder plan. T22 is a short shader-app tutorial using the owner's exact GLSL, local audio and matching GPU terrain/picking probes for a falling cube. `::: example-code <allowed project path> <language>` embeds shipped source rather than maintaining divergent copies. Generated image sheets are copied into manual assets with reuse paths/licences.

A prominent **Mobile and on-screen touch controls** guide documents the existing `virtualJoystick`, code-drawn hold buttons, action mapping, pointer cancellation, cleanup, desktop pointer enablement and phone access. Input and tutorial indexes link to it. Manual code fences/live editors have per-block **Wrap: on/off**, persisted as the next-page preference, with **1.6** code line height. Native wrapping preferences are separate. Owner requested no tests; only example/manual artifact generation was performed.

## Upload without search indexing
All generated pages include `noindex, nofollow, noarchive`. The builder copies `tools/manual/hosting/{robots.txt,_headers,.htaccess,HOSTING.txt}` into the output: Apache/static-host header rules cover upstream pages/assets too. `robots.txt` permits fetching so crawlers can read noindex; do not block the manual in a parent robots file. Put robots.txt at the domain root only; scope the static-host `/*` header rule if deploying alongside another site. HOSTING.txt explains Nginx, existing Google results and private access. See [Google’s noindex documentation](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

M12-30: full illustrated editor-focused T28 Machine Workshop, T29 Two Floors (GPL SPD adaptation) and T30 Tiny Tank Patrol. Each teaches the game mechanics through concrete 2D Level Creator editing exercises, Inspector/controller values, variants, validation checkpoints and save/Play/export distinctions. Real game/editor screenshots are committed; Markdown sources generate offline HTML with normal manual tooling.

## Full coding game workshops (T33/T34)

Coin Rush (2D) and Crystal Relay (3D) teach complete custom JavaScript controllers in explained stages, with readable CodeMirror blocks and all project text source at the end. Source zip downloads include art/audio and project metadata. Run `node tools/build-code-workshops.mjs` after changing either sample or its inherited scripts: it regenerates the examples, refreshes only the marked source appendices and produces deterministic archives in `docs/tutorial-downloads/`. Then run `node tools/build-manual.mjs` to publish listings, screenshots and downloads. Prose lives above the generated marker in each tutorial Markdown file. Download archives are editable Nord projects; normal web exports still use `nord build`.

## Advanced coding workshops (T35–T37)

T35 Prism Relay adds original GLSL ShaderMaterial code to the existing Crystal Relay game. T36 Circuit Vault is an HTML-tier memory game with a real package-free Node HTTP API and a memory-only leaderboard. T37 Orbital Salvage is a hand-maintained Rust/macroquad example with pure rules/tests and a real wasm-game export. All have explained stages, full source listings, screenshots and source downloads. `tools/build-code-workshops.mjs` now covers all five coding projects, includes JS/MJS/CSS/Rust/TOML/lock source, and excludes target/dist from archives. JS sample sources remain in tools/examples; Rust source is directly in examples/rust-salvage, following the existing Rust-example convention.

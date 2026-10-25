# Manual, guides & tutorials plan (M7)

**Status: implemented.** `node tools/build-manual.mjs` updates `docs/manual/` (committed, so the editor Docs tab works without a build) from `docs/manual-src/*.md` (+ `_namespaces.json`, `tools/manual/components-data.mjs`) and the repo sources (runtime JSDoc/comments, `schema.rs`, CLI doc comments, `library/INDEX.json`, templates/examples, shortcuts, `docs/*.md`). The builder compares bytes and writes only changed output files; unchanged files keep their modification times for fast FTP synchronization. A generated manifest removes only stale builder-owned files. `--check` builds to a temp dir, runs every `nord-live` snippet against the real core runtime, and fails on broken links/anchors or external URLs. Markdown extras: `::: dummies|tip|warn|todo` boxes, ```` ```nord-live ````, heading ids `{#id}`. After changing any source above, run the updater and commit its changed files. Desktop apps are documented after M9.

Output: `docs/manual/` — static HTML, offline, built by `tools/build-manual.mjs` from Markdown in `docs/manual-src/`
(vendored `marked`; syntax via CodeMirror in read-only mode; "Run" buttons for live examples using the vendored runtime).
Visual: `assets/docs/` graphics (banner, section icons, diagrams). Same viewer embedded in the editor (Docs tab).

Generated HTML is foldered by ownership and subject: `nord/{start,manual,tutorials,guides,api,components,reference,appendix}/`, `engines/phaser/{4.2,4.1-archive}/`, and `engines/babylon/{9.30,guides}/`. Large engine packages use namespace/hash buckets so no directory contains thousands of files. Search data is split into stable Nord/engine shards, so a small Nord edit does not rewrite the full engine index. The HTML shell and styling stay shared and relative-path safe for both `file://` and `/__docs/`.


## Current documentation structure — 25 October 2026

The six main areas are **Start here**, **Manual**, **Tutorials**, **Examples**, **Cheatsheets**, and **API**. Each landing page has authored task guidance, beginner explanations, small challenges, a topic directory built from current pages, and a collapsed **Old** panel. Every sidebar contains one Old category, with current topic groups first. Archived pages retain their URLs, show why they were moved and link to their replacement. Search labels these results Old and ranks current material higher for ordinary queries. Previous/next links keep current pages and archived pages separate.

`docs/manual-src/_navigation.json` records the explicit archive decisions. It preserves original native-script introductions, the original first-hour guide, duplicated welcome/migration pages and superseded upstream index aliases. Current specialist manuals and complete workshops remain current. The Tutorials generator reads the same archive data so T02/T03 leave its current cards and learning paths without deleting the lessons. Existing workshop code remains as written. T01 corrects its outdated claim that editing during Play saves the starting scene.

The Cheatsheets area now groups **Find an answer**, **Unity scripting and gameplay**, **Editor and visual tools**, **Test and ship**, and supporting **Reference tables**. It covers lifecycle/imports, objects/prefabs/events, input/physics, maths/time/coroutines, UI/audio/saves, editor file ownership, visual-tool handoffs, FPS authoring, debugging/profiling, CLI and release workflows. Calls and compatibility notes are checked against the current runtime and CLI sources. The full TapCounter file is executed with Nord UI, UnityInput and Save in Chromium, including held-versus-pressed behavior, cleanup, reload persistence and shared save-slot behavior. Its screenshot is a real browser run in `docs/screenshots/manual-cheatsheet-counter.png`.

New introductory code uses MonoBehaviour and Unity names in JavaScript. `programming-basics.md` includes the complete Drift script, explanation and observable exercise. Its positive, negative and zero speeds are executed against the real runtime during verification. The native NordScript reference remains available for existing projects.

All pages have visible-by-default beginner callouts, controlled by the global toggle. Search indexes full page text and section anchors, loads through classic scripts for file:// support, and excludes upstream ZIP contents. Themes are **Graphite, Paper, Nord, Sepia, Forest, High contrast, Slate, Deep ocean, Ember, Plum, and Arcade night**. The added themes are dark. Category headers are smaller (14px), derive their different tints from the chosen theme and are checked for at least 4.5:1 text contrast. Theme and beginner-box choices persist.

Phaser **4.2.1** and Babylon.js **9.30.0** APIs remain ZIP-only downloads, generated from preserved pinned declarations/JSDoc with HTML indexes, declarations, licences and provenance. The download page distinguishes exact-version references from rolling online manuals. Existing screenshots remain available; updated desktop/mobile documentation captures live in `docs/screenshots/manual-redesign-*.png`.

Final quality pass removes the repetitive generated chapter openings and duplicate flat Examples index, leaving authored introductions and one current topic directory. The recommended first-script, movement and main scripting pages now lead with consistent MonoBehaviour code. The movement page supplies separate complete 2D transform, 2D body and 3D transform files; it states dynamic/static body requirements, coordinate signs and input handoff. The main script no longer disables the object inside its own waiting coroutine. Save examples keep imports outside methods and explain shared slot selection. Offline claims distinguish normal bundled operation from optional downloads/network features. API headings have unique ids, and lookup compatibility notes describe actual return semantics.

Run `node tools/manual/check-beginner-examples.mjs` to execute the exact five introductory files against core types and a small input/physics fixture. It checks direction, speed, diagonal limits, preserved vertical velocity and queued grounded/airborne jump behavior. It does not replace backend collision or hardware tests. The page audit also rejects duplicate HTML ids so contents links stay unambiguous.

Verification: `node tools/build-manual.mjs --check` checks links, anchors and live snippets; `node tools/lint-docs-style.mjs` checks source conventions; `node tools/manual/audit-pages.mjs --write` checks every published page's navigation, archive notice, beginner callout and local images, and writes `docs/MANUAL_REVIEW.md`. Real Chromium checks all six hubs, Old collapse/notice behavior, eleven palettes and contrast, saved preferences, offline search, tutorial filtering and mobile layout. This is a structural/editorial pass, not a new human playthrough of every older workshop.

Rebuild HTML with `node tools/build-manual.mjs`, then the offline distribution with `python3 tools/package-manual.py`. The ZIP excludes macOS metadata and stale output pages.

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


## Full retro and multiplayer workshops (T38–T41)

T38 Coastline Sprint: original Amiga-style one-level racer, keyboard solo plus independent keyboard/gamepad split-screen, traffic/checkpoints/nitro and original MP3 tracks/SFX. T39 Vector Patrol: original rail shooter with actual Blocksmith-exported editable models, low-resolution vertex-snap/palette-dither shader, ground dots, waves/boss, audio and real scene restart. T40 JengaTedris: pure grid rules, real Matter compound-body tower mode and authoritative Node battle. T41 Nord Engine Office: tile-based office, three task minigames, shared Node rooms, pranks and BFS AI coworker. Each guide explains implementation stages and editor/Play/export workflow, appends every authored text source and links a deterministic complete source archive. Vendored minified libraries ship in archives but are not expanded as tutorial code. Source research and pinned citations are in RESEARCH_GAME_TUTORIALS.md.

`tools/build-code-workshops.mjs` covers all nine workshops. New tests: `node --test tools/retro-games.test.mjs tools/office-tedris.test.mjs`; real browser suites `node tools/retro-games-test.mjs` and `node tools/office-tedris-test.mjs`. Online teaching servers are trusted-room, memory-only; static export needs a separately running Node process for multiplayer. Physical gamepad feel/LAN hardware and full human tutorial walkthroughs remain owner checks.


T42 Paper Worlds and T43 RSS River extend the full-code format to modern local-first apps. Paper Worlds explicitly hosts local Phaser/Babylon in HTML tier (no invented adapter setting), with ten pages, shape tools, Save/JSON/PNG, live paper textures, Havok stickies, doors, Arcade minigames, graph ride and exported portfolio page. RSS River parses RSS/Atom, caches read/star state, ships HN/Simon Willison/GitHub Engineering defaults and an original local demo, handles CORS via XML import or existing permitted Nord host fetch, and renders flowing/flickable Havok papers. Both include original ImageGen sprite sheet, short WASM explanation and one-sentence optional Node/HTML hosting note with no Node code. Generator now covers eleven projects, includes XML and .offline-allow text, omits minified vendor code from appendices while including it in full archives. `tools/desk-apps-test.mjs` is a focused browser smoke rather than a broad test expansion.


### T38–T43 readability and correctness audit (M7-30)

Authored JavaScript, embedded HTML, CSS, GLSL and the portfolio template are expanded with two-space indentation and readable control flow. Source files, generated projects, complete code appendices and source archives remain identical; vendor/minified dependencies are unchanged. Keep runtime source lines at most 180 characters (normally about 90); tools/tutorial-quality.test.mjs guards against compressed code returning. Annotate HTML template literals with `/* HTML */` so formatters recognize their contents. Generated examples are outputs: edit tools/examples first, then build-code-workshops.mjs and build-manual.mjs.

Audit corrections: portfolio embedding preserves HTML-like text/dollar tokens as inert JSON; local script loading shares its pending promise; Paper Worlds serializes view changes and RSS River discards superseded scenes; off-road drag cannot accelerate a stopped car; shooter victory and death are exclusive; a Ready request cannot reset a live battle. Focused rules/HTTP tests and real browser suites cover the six projects. Manual verification checks exact full-source listings and zip contents, CodeMirror, Copy/Wrap controls, images and downloadable archives. No Rust/workspace rebuild is needed for this JS/documentation audit.


### Complete file-by-file teaching (M7-31)

T38–T43 now include an authored walkthrough of every main project source file, rather than only selected excerpts followed by raw listings. 55 file walkthroughs contain 249 consecutive explained parts: rules/controllers, renderers/shaders, shared audio/HTTP/3D/Save helpers, native bridge, HTML/CSS, project metadata and the shooter's full scene declarations. Each part states its file/line range, shows the exact next code, explains what/why and gives an observable exercise. All twelve existing screenshots are retained. Full files remain at the end as expandable references; complete source archives remain unchanged. Binary assets, portable model-authoring data and minified vendor internals remain resources, with their integration contracts explained.

Authored notes/semantic source anchors live in tools/tutorial-lessons/plans.json; render.mjs reads consecutive source ranges from the actual generated projects. build-code-workshops.mjs inserts a separate marked walkthrough before the full reference. Do not hand-edit generated walkthrough text: edit the plan explanation/anchors, then regenerate. tools/tutorial-lessons.test.mjs requires every main code file to be covered from first to last line with no gaps/duplicates, explanations/exercises present, and published content current. Update teaching notes whenever the corresponding source behavior changes; a coverage test cannot judge whether prose remains pedagogically correct.

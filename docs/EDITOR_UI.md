# Editor UI design

Native **egui** editor (eframe, wgpu→Metal) with `egui_dock` panels. Visual model: PlayCanvas editor with Defold-style clean toolbars.
Default editor theme = **Graphite**, a neutral dark-grey palette (`#191919` canvas, `#232323` panels, `#2d2d2d` controls) with a restrained blue accent. Fonts: Inter (UI) + JetBrains Mono (code) as TTF,
bundled via `include_bytes!`. Icons: Lucide SVGs (`assets/icons/lucide`) via `egui_extras` SVG loader.

```
┌ Toolbar: [Nord logo] Project ▾  | ▶ Play ■ Stop ⟳ | Move Rotate Scale | 2D/3D | Snap Grid | Export ▾ | Docs ───────┐
├ Hierarchy ─────────┬ Viewport (tabs: Scene | Game | Code…) ─────────────────────┬ Inspector ───────────────────┤
│ tree, search, +    │  Babylon (3D) / Phaser (2D) edit view, gizmos, grid         │ Entity: name, tags, transform │
│ drag to reparent   │                                                              │ Components (add ▾)            │
│                    │                                                              │ Scripts + attributes          │
├ Assets ────────────┴──────────────────────────────────────────────────────────────┴───────────────────────────────┤
│ folders | thumbnail grid (size slider) | search/filter | Library tab | Console tab | Docs tab                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Panels are dockable (M8-05, `egui_dock`): drag a tab to another panel, to an edge (split) or out of the window (floating); tabs have a close button, closed panels come back via **Window ▸ <panel>**, **Window ▸ Reset layout** restores the default. The layout is saved to `<config>/layout.json` (next to `editor.json`) and survives restarts and project switches.
Game view: the Game tab header sets size (Fit/50–200 %) and position (Top/Middle/Bottom + x/y offset, kept in settings); the view keeps the game's aspect ratio and stays inside the panel.
Run/stop: **Cmd+R** runs and, while running, stops; **Cmd+.** stops only. Both keys are rebindable in Settings ▸ Run / stop keys (key names like `R`, `F5`, `Enter`). The Game tab header has ■ Stop and Fullscreen/Exit (Esc) — the reliable exit when the embedded game has keyboard focus.
Themes: editor-only Graphite plus 10 dark + 3 light (Nord Light, GitHub Light, Solarized Light) in `assets/themes/themes.json`; pick in Settings. Light themes use `egui::Visuals::light()` as the base.

## Editor uplift (M8-18)

Graphite is editor-only; shared runtime/game themes keep their original colors. Existing settings using the old Nord default migrate once (`appearance_version = 1`); custom themes, custom play/build colors, and subsequent explicit Nord choices persist. PLAYMODE-COLOR remains `[34, 56, 96]` by default. Switching theme during Play restores the new theme after Stop.

The project hub has a centered, bounded width, independently scrolling cards, searchable examples/tutorials, compact recent-project rows (full path on hover), and collapsible starter templates. Packaged builds include the starter folders and catalog. Documentation is also reachable from the hub, with a Back to projects button.

Toolbar controls wrap in smaller windows. Play is labeled; Stop/Reload and Undo/Redo reflect availability; Export opens the existing export dialog. All icon buttons expose accessible names. Hierarchy search has its own row, Console controls wrap, Settings scrolls, and dock tabs have clearer spacing and focus color. Native webviews remain hidden for menus/dialogs through the end of the frame, including desktop settings, autosave recovery and Go to line; opening a popup during panel drawing hides views in that same frame. macOS child bounds compensate for winit’s flipped NSView so game placement matches egui and does not cover the header or Console. Inspector renders missing defaults without changing the scene; only user edits enter Undo.

## Current content and optional cached-content testing
**Settings → USE CACHED CONTENT** defaults to **OFF**, including for existing settings files that omit the option.
- **OFF:** Examples and Tutorials open their current files directly from the engine root (the checkout with `run.sh`, or the rebuilt app's `Contents/Resources/examples`). Old Recent entries and launch paths into `~/.config/nord/examples/` resolve to the matching current example. Rebuilding the `.app` therefore updates the example art and code the editor opens. Edits/saves affect these current example files; use a separate project for your own version.
- **ON:** Examples and Tutorials use saved private copies under `~/.config/nord/examples/`, created on first open and reused for cached-content testing. These copies deliberately retain their saved content across app rebuilds.
The setting is saved as `use_cached_content` in `editor.json`. Reopen an example after changing it to switch its source. Embedded webviews are recreated when the setting changes: OFF uses temporary/incognito browser storage; ON permits persistent browser storage. Script attribute parsing also bypasses its cache when OFF.
The editor's dev server always serves project files with `Cache-Control: no-store` and reads them from disk on each request. Asset thumbnails are derived previews keyed by the source hash; they are not saved game/example copies. Autosaves and settings remain persistent.

## Required features
- Splash window (frameless, 640×360 `assets/brand/splash.png`) shown **≥ 2000 ms** then main window appears.
- Project hub: New (template picker), Open, Recent, Examples, Tutorials.
- Code tab: CodeMirror tabs per file, minimap-free, command palette (Cmd+K), quick-open (Cmd+P), Save (Cmd+S) → hot reload.
- Asset thumbnails: images (real), spritesheets (first frame + badge), audio (waveform), models (rendered), scripts/scenes (icon).
- **Hierarchy selection and drag (like Unity):** click selects one row; **Shift+click** selects the whole range from the last plain-clicked row (the anchor) to the clicked row, in the order the rows are drawn; **Ctrl/Cmd+click** toggles one row. Dragging a selected row moves the whole selection (rows whose parent is also selected travel with it; the moved rows keep their order); dragging an unselected row selects it first. Drop on the middle of a row = child, on its top edge = before it, on empty space = root (right-click empty space = Create menu). Optional per-row look: right-click ▸ Hierarchy style.
- Undo/redo (Cmd+Z / Shift+Cmd+Z) across hierarchy/inspector/viewport. Copy/paste/duplicate (Cmd+D). Delete. F = frame selected, Shift+F = frame all. Scene view (3D, same as Unity): hold RMB = mouse look + WASD fly (Q/E down/up, Shift faster, wheel = fly speed), Alt+LMB orbit (Alt+Cmd+LMB pan), Alt+RMB zoom, MMB pan, wheel zoom; hold Ctrl/Cmd to toggle snapping; Shift/Ctrl+click toggles multi-select; drag on empty space = marquee (2D); toolbar Local/Global + Pivot/Center.
- Console: log/warn/error from game iframe + build output, click error → open file:line.
- Library tab: search → preview → "Insert" (adds script/prefab/component to selection or project).
- Shortcuts (mac): Cmd+P quick open, Cmd+S save, Cmd+R play, Cmd+. stop, Q/W/E/R/T tools (hand/move/rotate/scale/rect), Cmd+1/2/3 panels.

## Code editor (native, in `crates/nord-editor/src/code/`)
Built on `egui::TextEdit::multiline` + custom `layouter` using our own tokenizer (`code/highlight.rs`, colours from `themes.json`; ADR-016). Added on top: tabs + dirty markers, line-number gutter, current-line highlight,
auto-indent, bracket match + auto-close, Tab/Shift-Tab indent, Cmd+/ comment toggle, find/replace (regex, Cmd+F/Cmd+Opt+F),
goto line, project-wide search, autocomplete popup (nord.js API list + library snippets + words in file), error squiggles
from `node --check`/`cargo check` output, big-file safe (virtualised via galley rows). Evaluate `egui_code_editor` crate for
reuse first; if too limited, keep our own.
**Multi-cursor** (`code/multi.rs`, pure + unit-tested): the primary selection stays in `egui::TextEdit`, secondary ones live in `Doc.extra`. Alt+click adds a cursor, Cmd/Ctrl+D selects the word / next occurrence, Cmd/Ctrl+Alt+Up/Down adds a cursor above/below. While extras exist, typing, paste, Backspace/Delete, Enter (auto-indent), Tab, arrows/Home/End (+Shift) apply to every cursor; Esc or a plain click drops the extras. Not multi-cursor aware yet: word-wise moves, Cmd+/ comment toggle, find-replace, auto-close pairs (they act on the primary only / clear extras on text change). Monaco/CodeMirror-in-webview is the escape hatch (not the default).

## Status bar & play-mode tint (M8-12)
Bottom status bar: dot/spinner + one sentence from `EditorState::activity()` ("Compiling Rust game, then it will start — rapier2d v0.22 (41 crates, 35s)…", "Playing — press Cmd+. to return to editing", "Exporting…", "Unsaved changes", "Ready"). While compiling/exporting (amber) or playing (blue) the editor chrome is tinted (`Settings.tint`, `play_tint`, `build_tint` = PLAYMODE-COLOR, Settings dialog); colours are restored when the activity ends.

## Implemented (M3) — where things live
```
crates/nord-editor/src/
  main.rs app.rs        eframe entry (splash→main window), dock layout, menu, shortcuts, action dispatch, viewport sync
  state.rs undo.rs      EditorState (all state), snapshot Command undo/redo + coalescing, autosave/recovery, hub pump
  scene_ops.rs          pure tree ops: find/insert/remove/reparent/duplicate (unit-tested)
  schema.rs             inspector schemas: built-in component field table + `static attributes` parser (JS literal -> JSON)
  theme.rs icons.rs     skins/themes from assets/themes/themes.json + built-in editor themes (8 dark, 2 light, ~30 *Inspired*) + custom themes (`themes.custom.json`), 10 extra font pairs (assets/fonts/skins/*.ttf), Hack symbol fallback, Lucide SVG icons, `icons::snap` for crisp icons
  assetmeta.rs          per-project asset organisation (`.nord/asset-meta.json`): folder colours/icons, colour tags, descriptions, zebra/guides
  panels/notes.rs       Notes manager tab (`.nord/notes.json`)
  panels/console.rs     Console Pro: level icons, [Tag] filter, search highlight, timestamps, detail pane, export
  panels/modeler.rs     3D Modeler tab: opens scene models / mesh primitives (`ModelerCtx`), save choice handled in prefab.rs `modeler_saved`
  panels/               hierarchy inspector assets console library docs hub palette settings toolbar animation
  code/                 mod.rs (tabs, find/replace, goto, project search, completion, minimap, split) edit.rs (pure text edits) highlight.rs api.rs
  viewport/webview.rs   wry child webview (feature `webview`) + "Open in browser" fallback
editor/viewport/        edit.html edit.js (protocol) edit2d.js (Canvas2D) edit3d.js (Babylon)
crates/nord-serve/      dev server + Hub (shared by `nord serve` and the editor)
```
- Run: `./run.sh [project]`. App bundle: `./build.sh`. `nord-editor [project-dir]` opens a project directly.
- Shortcuts: see Settings window (`panels/settings.rs::SHORTCUTS`). Palette = Cmd+K, quick open = Cmd+P.
- Inspector: schemas for the 25 built-in component types; unknown fields are shown with a guessed widget. Script attributes come from
  `static attributes = {…}` parsed leniently (no JS evaluation). All attribute types: number/int/bool/string/color/vec2/vec3/enum/entity/asset/curve/array<T>.
- Hierarchy **virtual rows** (italic, read-only, ids `v:…`): Environment, Managers, and FPS-level contents under the host entity — game parts that are not scene entities; the Scene view draws them too (skybox, FPS level, paths). See `virt.rs`.
- Hierarchy: drag onto a row = reparent (top 30 % = insert before), drop on empty space = move to root, assets dropped on empty space become entities.
- Assets: drag the divider to widen the folder tree; its scroll area fills the chosen width and scrolls long paths. The thumbnail grid keeps tiles aligned in rows at every size, including icon placeholders and loaded thumbnails. Lazy worker-thread thumbnails (images/spritesheets/audio via nord-core, models via the 3D viewport), OS file drop imports.
- Game console: `[Play]` pages post `console.*` to the server; click `file.js:12` in a line to open it at that line.

## Implementation notes
- State = one `EditorState` struct; every scene mutation goes through `EditorState::edit` (snapshot command, ADR-015). Panels are `fn ui(&mut EditorState, &mut Ui)`.
- Thumbnails: `nord-core` produces PNGs in `.nord-cache/thumbs`; assets panel loads via `egui_extras` image loaders (lazy, visible cells only).
- Never block UI: thumbnails and JS syntax checks run on worker threads (`std::thread` + channel), repaint via `ctx.request_repaint*()`.
- Splash: the same window starts borderless 600×526 showing `assets/brand/splash-600x526.png` and becomes the main window after ≥ 2000 ms (ADR-018).
- Text styles referencing the "bold" family are applied one frame after `set_fonts` (egui panics on an unbound family).
- `egui::Button::image` must not be used for icon buttons before the image loads (it sizes to all remaining space): `icons::button` paints its own.

## Code view wrapping and typography (2026-10-13)
The Code toolbar has persisted **Word wrap** on/off; wrapping changes display only. Settings adds `code_word_wrap` (default false), `code_line_height` (default 1.6 × code font size, slider 1.0–2.2), and `code_letter_spacing` (default 0 points, slider 0–2). Existing settings load their defaults through serde. Highlight cache keys include font size; layout applies spacing to highlighted/plain large-file jobs. Wrapped gutters, current-line shading and error squiggles use the laid-out galley rather than logical-line × font-height guesses. No native build/tests run at owner request; native interaction/compile verification remains unperformed.

## Event sheets, History (M10)
- **Event sheets** tab: see docs/EVENT_SHEETS.md (editor panel section).
- **History** tab (bottom dock): list of snapshots (`<project>/.nord/history/`, newest first), *Snapshot now* with an optional label, select one to see added/removed/modified files and a line diff, *Restore this snapshot* (asks twice; takes a "before restore" safety snapshot first so a restore can itself be undone; images/audio are untouched). Snapshots cover JSON, event sheets, scripts and other text files (not `vendor/`, `runtime/`, `dist/`, dot-folders); the newest 50 are kept; one is taken automatically before the first save in any 10 minutes. Code: `nord-core/src/history.rs`. Add `.nord/` to `.gitignore` if you use git.
- **Project** tab (bottom dock): *Project properties* (name, start scene, game size, scaling mode, pixel art, background, physics engine + gravity, orientation, icon, version → `nord.project.json`; orientation/icon/version live in `export.web`), *Find all references* (whole-word option, `file:line text`), **safe rename** of an object (entity names in scenes/prefabs, `object` and `Obj.X` expressions in event sheets, families, timeline targets — tags and script code are not touched) or an asset (moves the file + `.meta.json`, rewrites quoted references), and project-wide replace. Every rename/replace shows the list of files first, takes a History snapshot, then applies. Code: `nord-core/src/refs.rs`. Folders in the Assets panel already existed (M3).
- **Phone preview** (toolbar "Phone", or `nord serve --lan`): serves the game on your local network and shows a QR code + link. A separate, minimal server: only the game's files (project, `/runtime`, `/vendor`), live reload and the console POST; no editor/desktop/docs endpoints, dot-folders hidden, every request needs the random token in the link (first visit sets a cookie). It stops when you press *Stop phone preview*, close the project or quit. The phone's console output appears in the Console tab as `[phone] …`. Saved scripts and event sheets hot-swap on the phone too. Game size presets (phone portrait/landscape, tablet, HD, Full HD) are in the Project tab.
- **Hot reload keeps state**: saving a script swaps its code in the running game (existing); saving an event sheet now swaps the sheet while keeping global variables, group on/off and the sheet clock (`Game.hotReloadSheet`). Scene JSON changes still reload the page.

## FPS Level tab (M12)
`Tab::Fps` (`panels/fps.rs`) embeds the FPS Creator level editor (`editor/fpsc/index.html`, served by the project's dev server) like the Scene tab embeds the edit viewport. Projects without the runtime see a call-to-action (*Add FPS Creator to this project* → `Action::FpsInstall` → `nord_core::fpsc::install`); projects with `scripts/fpsc/level-script.js` open on this tab. Toolbar: *Open in browser*, *Upgrade runtime*. Menu: Window ▸ FPS Level, Project ▸ Add / upgrade FPS Creator…, palette entries. Spec: `docs/FPS_CREATOR.md`.

FPS Level addon: Objects tab searches placed entities across storeys and focuses selection; placement grid offers 0.25–4 m spacing (default 0.5 m); patrol inspector edits coordinates/waits and inserts, removes, reorders or reverses waypoints. Existing tools remain available. See `FPS_CREATOR.md`.

Settings includes FPS Level Test, Test from here and Stop test bindings (key + Shift/Cmd-Ctrl/Alt; defaults F5, Shift+F5, Shift+Esc). Close Settings to persist; embedded FPS pages and tests update without reloading. Reset shortcuts to defaults restores these plus main Run/Stop while keeping other settings. Esc pauses a test; the Stop binding, Quit or Close test closes it. See the full illustrated FPS Creator manual chapter and FPS Level quick reference.

FPS Level adds a Build cell mode for 45° diagonal and rounded corners; cell Inspector edits shape/direction/materials, Shift-click restores original square walls. The shared footprint cuts floor/ceiling and drives rotated collision/rays/navigation. Individual item Inspector also offers Save as variant and Update variant defaults (project bank saved immediately; level changes still need Save). See FPS_CREATOR and the illustrated chapter/quick reference for limits and runtime upgrades.

## 2D Level Creator and welcome filters (M12-21/22/27)

**2D Level** embeds `/editor/level2d/index.html`, following FPS Level's native webview/browser fallback pattern. It provides a searchable Amiga/Kenney bank, tile tools, layer/object management, body and script Inspector, variants, F5 preview and publication to ordinary Nord scenes. See `LEVEL_CREATOR_2D.md` and manual chapter 29. Workshop templates open this tab automatically. **Use as game start** explicitly applies the saved scene plus project physics/display/input settings.

Welcome starts with a curated Featured set. Starter templates and samples independently filter Featured/All/2D/3D/FPS/Physics/Apps/Rust; search under Featured includes older samples. Originals are kept. Classification uses manifest type and descriptive ID/name, with a maintained Featured list. New templates/samples: 2D Platform Workshop, 2D Top-down Workshop, Machine Workshop (Matter physics puzzle).

Creator game templates **Two Floors — Dungeon Creator** and **Tiny Tank Patrol — NES-style Arena** appear under Featured/2D. Projects with any `levels/*.level2d.json` open directly on 2D Level. Level exposes the controller path and its attributes JSON; object Inspector exposes actor-specific scripts. Choose another bank sprite, reselect an object and use **Use bank sprite** to replace its art while keeping values/scripts. Full manual tutorials T28–T30 cover machine, dungeon and tank workflows.

**Graph tab:** litegraph canvas + Nord nodes (`editor/graph/`), see `docs/GRAPH.md`. **Hierarchy:** Create menu (presets), F2 rename, Create empty parent. **Window ▸ Layout:** presets (Unity 2 by 3 / Wide / Tall too). Menu bar: File, Edit, Assets, GameObject, Component, Window, Project, Help. **Toolbar:** Pause / Step while playing.

**UI Designer tab:** embedded page `editor/uidesigner/` (like FPS/2D Level): palette, tree with drag reorder, live preview using the real runtime, property inspector, JSON tab, undo/redo, saves `ui/*.ui.json`. See `docs/UI_SCENES.md`.

## Unity-style workflow (M8-32)
- **Run**: F5 = Play/Stop project, F6 = *Run this scene* (`Action::PlayScene`, game URL `?scene=<path>`, runtime `devSceneOverride()` in `runtime/core/boot.js`; only plain relative `.json` paths are accepted). Cmd+R unchanged.
- **Console** `Collapse` toggle (`ConsoleUi::collapse`, default on): identical (level, text) lines fold into the first one with `(n)`.
- **Inspector**: script `static attributes` → sliders for min+max numbers, tooltips from `description`/`tooltip` or the type/range; **Signals** section edits `Entity.connections` (`nord_core::scene::Connection`, wired by `Scene.#wireConnections`).
- **Prefab overrides** (`prefab.rs`): the Inspector edits `effective(instance, prefab)`, writes back `diff` as `overrides` for `components, scripts, behaviors, effects, layer`; blue ● + revert per field, *Revert all overrides*.
- **Remote scene tree** (`panels/remote.rs`): while playing, Hierarchy/Inspector render the live game. Editor → game: JS snippets via `WebPanes::eval("game", …)` every 0.5 s (and for edits); game → editor: `POST /api/ipc` `{t:'remoteTree'|'remoteEntity'}` (deduplicated, so the inbox only grows when something changed). No runtime upgrade needed. Never saved.
- **F1** over a component/script header → `Action::OpenDocs("nord/components/component-<type>.html")` in the browser (scripts → `nord/manual/scripting.html`).

- **Build Settings** (File ▸ Build Settings…, Shift+Cmd+B): scenes in build (unchecked scenes are written to `export.excludeScenes` and left out of web exports; the start scene always ships), start scene, platform list, *Build* / *Build And Run*. **Game view toolbar:** resolution drop-down, scale slider, *Maximize on Play*, *Error Pause*, *Stats* overlay.

## Godotize backlog (2026-10-23)
- **Keymap** (`keymap.rs`): `Settings::keymap` stores only changed chords (`"tool.move": "Y"`); `DEFS` holds ids, labels, Unity defaults. `App::shortcuts` and the Scene view `key` message (now sent for every key with `cmd/shift/alt`) both resolve through it. Settings ▸ Shortcuts captures the next key press.
- **Scene view:** multi-selection drags use one `transforms` message (one undo step); 3D attaches the gizmos to a pivot node (primary or bounds centre) and applies its world-matrix delta to every member; 3D marquee, axis gizmo, `locked`/`hidden` entity fields, drops on objects (`addAsset` with `onto`).
- **Hierarchy / Inspector:** lock + eye toggles, prefab children rows (`v:pfc:<instance>:<path>`; edits go to `overrides.children`), component *Enabled* (`componentEnabled`), grouped Add Component (`schema::category_of`), Debug mode, per-field Apply (`apply_prefab_part`), lit material preview (`nord_core::thumbs::render_material`).
- **Native web views hide while any menu/popup is open** (`App::overlays_open`: popups, top-bar menus and every egui `Foreground` layer). In-page `prompt()` / `confirm()` do not exist in the native web view; editor pages use `editor/common/dialog.js`.
- **Event sheets:** Parameters form (`params_form`), debug highlight from `game.debug.ran` (polled with `EVENTS_JS`), F1 per condition/action. **Window menu:** Panels / Editors submenus.

## 3D Modeler, Animator, Profiler (2026-10-23)
Tabs **3D Modeler** (`editor/modeler/`, docs/MODELER.md) and **Animator** (`editor/animator/`, docs/ANIMATOR.md) are embedded pages like the UI Designer (Window ▸ Editors, command palette, double-click an `.animator.json`, Assets ▸ New animator controller). **Window ▸ Profiler** gained phases/scripts/components/spikes/network with Record and Save profile (docs/PROFILER.md). **Project ▸ Play multiplayer (browser windows)** opens 2–3 game windows (host + guests, optional lag). **Export ▸ Hosting preset** (docs/EXPORT_TARGETS.md). Panels are dockable (egui_dock): drag tabs to split, float or rearrange; Window ▸ Reset layout restores the default.

## Look & feel (2026-10-24)
* **Settings ▸ sizes:** Interface / Text / Button size are edited as a draft and applied with **Apply sizes** (no live re-layout); Reset goes back to 1.00. Theme editor makes *custom* themes (never overwrites built-ins) and everything is saved in `editor.json` / `themes.custom.json`.
* **Inspector:** Transform is a grid (Position / Rotation / Scale rows, X/Y/Z columns with red/green/blue letters, same letters in every vector field). Component headers have per-type icons and a ⋮ icon menu.
* **Assets:** folders are drawn as vector shapes (sharp at any scale) in the theme accent colour; user colour, icon badge, own image, tags and descriptions are stored per project. See manual *Organising your project*.
* **Console Pro, Notes tab, Dev Console prefab:** see manual chapters *Organising your project* and *In-game Dev Console*.

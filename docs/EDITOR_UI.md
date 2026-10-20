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
Panels are dockable (M8-05, `egui_dock`): drag a tab to another panel, to an edge (split) or out of the window (floating); tabs have a close button, closed panels come back via **View ▸ <panel>**, **View ▸ Reset layout** restores the default. The layout is saved to `<config>/layout.json` (next to `editor.json`) and survives restarts and project switches.
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
- Undo/redo (Cmd+Z / Shift+Cmd+Z) across hierarchy/inspector/viewport. Copy/paste/duplicate (Cmd+D). Delete. F = focus.
- Console: log/warn/error from game iframe + build output, click error → open file:line.
- Library tab: search → preview → "Insert" (adds script/prefab/component to selection or project).
- Shortcuts (mac): Cmd+P quick open, Cmd+S save, Cmd+R play, Cmd+. stop, W/E/R gizmos, Cmd+1/2/3 panels.

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
  theme.rs icons.rs     skins/themes from assets/themes/themes.json (fonts: assets/fonts/skins/*.ttf), Lucide SVG icons
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
- Hierarchy: drag onto a row = reparent (top 30 % = insert before), drop on empty space = move to root, assets dropped on empty space become entities.
- Assets: drag the divider to widen the folder tree; its scroll area fills the chosen width and scrolls long paths. The thumbnail grid keeps tiles aligned in rows at every size, including icon placeholders and loaded thumbnails. Lazy worker-thread thumbnails (images/spritesheets/audio via nord-core, models via the 3D viewport), OS file drop imports.
- Game console: `[Play]` pages post `console.*` to the server; click `file.js:12` in a line to open it at that line.

## Implementation notes
- State = one `EditorState` struct; every scene mutation goes through `EditorState::edit` (snapshot command, ADR-015). Panels are `fn ui(&mut EditorState, &mut Ui)`.
- Thumbnails: `nord-core` produces PNGs in `.nord-cache/thumbs`; assets panel loads via `egui_extras` image loaders (lazy, visible cells only).
- Never block UI: thumbnails and JS syntax checks run on worker threads (`std::thread` + channel), repaint via `ctx.request_repaint*()`.
- Splash: the same window starts borderless 640×360 showing `assets/brand/splash-640x360.png` and becomes the main window after ≥ 2000 ms (ADR-018).
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
`Tab::Fps` (`panels/fps.rs`) embeds the FPS Creator level editor (`editor/fpsc/index.html`, served by the project's dev server) like the Scene tab embeds the edit viewport. Projects without the runtime see a call-to-action (*Add FPS Creator to this project* → `Action::FpsInstall` → `nord_core::fpsc::install`); projects with `scripts/fpsc/level-script.js` open on this tab. Toolbar: *Open in browser*, *Upgrade runtime*. Menu: View ▸ FPS Level, Project ▸ Add / upgrade FPS Creator…, palette entries. Spec: `docs/FPS_CREATOR.md`.

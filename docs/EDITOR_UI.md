# Editor UI design

Native **egui** editor (eframe, wgpu→Metal) with `egui_dock` panels. Visual model: PlayCanvas editor with Defold-style clean toolbars.
Dark theme default, accent = Nord blue `#4FA3FF` (palette in `assets/brand/palette.json`). Fonts: Inter (UI) + JetBrains Mono (code) as TTF,
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
Panels are dockable/resizable (simple splitter layout first; drag-dock in M8 only if wanted).

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
- Assets: folder tree + grid, lazy worker-thread thumbnails (images/spritesheets/audio via nord-core, models via the 3D viewport), OS file drop imports.
- Game console: `[Play]` pages post `console.*` to the server; click `file.js:12` in a line to open it at that line.

## Implementation notes
- State = one `EditorState` struct; every scene mutation goes through `EditorState::edit` (snapshot command, ADR-015). Panels are `fn ui(&mut EditorState, &mut Ui)`.
- Thumbnails: `nord-core` produces PNGs in `.nord-cache/thumbs`; assets panel loads via `egui_extras` image loaders (lazy, visible cells only).
- Never block UI: thumbnails and JS syntax checks run on worker threads (`std::thread` + channel), repaint via `ctx.request_repaint*()`.
- Splash: the same window starts borderless 640×360 showing `assets/brand/splash-640x360.png` and becomes the main window after ≥ 2000 ms (ADR-018).
- Text styles referencing the "bold" family are applied one frame after `set_fonts` (egui panics on an unbound family).
- `egui::Button::image` must not be used for icon buttons before the image loads (it sizes to all remaining space): `icons::button` paints its own.

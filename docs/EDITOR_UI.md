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
Built on `egui::TextEdit::multiline` + custom `layouter` using `egui_extras::syntax_highlighting` (syntect; bundle extra
`.sublime-syntax` for GLSL/WGSL/TOML if missing). Added on top: tabs + dirty markers, line-number gutter, current-line highlight,
auto-indent, bracket match + auto-close, Tab/Shift-Tab indent, Cmd+/ comment toggle, find/replace (regex, Cmd+F/Cmd+Opt+F),
goto line, project-wide search, autocomplete popup (nord.js API list + library snippets + words in file), error squiggles
from `node --check`/`cargo check` output, big-file safe (virtualised via galley rows). Evaluate `egui_code_editor` crate for
reuse first; if too limited, keep our own. Monaco/CodeMirror-in-webview is the escape hatch (not the default).

## Implementation notes
- `crates/nord-editor/src/{main,app,state,undo,theme}.rs`, `panels/{hierarchy,inspector,assets,console,library,docs,toolbar}.rs`,
  `viewport/{webview,ipc}.rs`, `code/*`. Viewport JS lives in `editor/viewport/`.
- State = one `EditorState` struct; every mutation is a `Command` (do/undo) pushed to the undo stack. Panels are pure `fn ui(&mut EditorState, &mut Ui)`.
- Thumbnails: `nord-core` produces PNGs in `.nord-cache/thumbs`; assets panel loads via `egui_extras` image loaders (lazy, visible rows only).
- Never block UI: file ops/builds on worker threads (`std::thread` + channel), repaint via `ctx.request_repaint()`.
- Splash: first frame shows `assets/brand/splash.png` in a borderless window; main window created after >= 2000 ms.

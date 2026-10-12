# Editor UI design

Visual model: PlayCanvas editor (PCUI) with Defold-style clean toolbars. Dark theme default, accent = Nord blue `#4FA3FF`
(palette in `assets/brand/palette.json`). Fonts: Inter (UI) + JetBrains Mono (code), vendored.

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

## Implementation notes
- `editor/index.html` + `editor/src/{app,backend,state,undo}.js` + `editor/src/panels/*.js` + `editor/css/*`.
- State = one plain object store (`state.js`) with change events; commands go through `undo.js` (do/undo pairs).
- Viewports live in `editor/src/viewport/{babylon,phaser}.js`, reusing `runtime/` adapters in "edit mode".
- Never block UI: file ops async via backend.

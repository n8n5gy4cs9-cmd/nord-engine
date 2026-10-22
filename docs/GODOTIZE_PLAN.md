# Godotize Nord Engine — plan ("Godot's lightness, Unity's feel")

**Owner's goal.** Godot is light, just works and exports everywhere. Unity is heavy and hard to export, but the owner knows it.
So: keep Nord (light, offline, static-HTML + Mac/Win export) and make editing feel exactly like Unity — using **Godot's open
design and MIT code** as the structural reference and **Unity's workflow** as the target feel.
**Keep and improve:** Event sheets, FPS Level editor, 2D Level editor, UI Designer (make it really good), Graph (make better).
**Decision (ADR-028):** evolve the existing egui editor; do **not** rewrite the engine or clone Godot wholesale.

## Reference rules (important)
- `REFE/godot-master` — **MIT**. Port ideas *and* algorithms freely; log each ported area in `THIRD_PARTY.md` (file, commit, what).
  Read it for *how it works*: `editor/docks/{scene_tree_dock,filesystem_dock,inspector_dock,signals_dock,groups_dock}.cpp`,
  `editor/inspector/editor_inspector.cpp` + `editor_properties*.cpp`, `editor/scene/{canvas_item_editor_plugin,3d/node_3d_editor_plugin}.cpp`,
  `editor/scene/connections_dialog.cpp`, `editor/run/`, `editor/export/`, `editor/file_system/`, `editor/import/`, `editor/animation/`.
- `REFE/UnityCsReference-master` — **reference only, never copy code** (Unity C# reference licence). Use it to learn names, menu
  layout, shortcut tables, behaviour (`Editor/Mono/SceneView`, `Inspector`, `Hierarchy*`, `Prefabs/`, `ProjectBrowser`, `GameView`).
- `REFE/` is git-ignored; do not commit it.

## Target feel (Unity), by area
| Area | Unity behaviour to match | Godot reference to borrow from | Nord today |
|---|---|---|---|
| Layout | Scene / Game tabs, Hierarchy left, Inspector right, Project + Console bottom; layouts save/load | `editor_dock_manager` | docks exist (egui_dock); no Scene+Game side-by-side |
| Scene view | orbit/pan/zoom (Alt+LMB, MMB, wheel, RMB-fly+WASD), Q W E R T tools, gizmo handles, Local/Global + Pivot/Center, snapping (hold Ctrl), 2D/3D toggle, Frame (F), grid, selection outline, rect-select, multi-select | `canvas_item_editor_plugin`, `node_3d_editor_plugin` | webview edit viewport (`editor/viewport/edit.js`), basic gizmos |
| Game view | aspect/resolution drop-down, scale slider, Maximize on Play, Stats, Play focused/unfocused | `editor/run` | fixed size + fit |
| Hierarchy | drag-reorder/re-parent, multi-select, Shift/Ctrl, rename F2, active checkbox, prefab icon + blue name, create menu, search with filters | `scene_tree_dock` | tree w/ create, F2, search |
| Inspector | component cards with enable toggle, ⋮ menu (Reset, Copy/Paste values, Remove, Move up/down), Add Component search, multi-edit, lock, debug mode, Undo per field, object picker with preview thumbnails | `editor_inspector`, `editor_properties*`, `multi_node_edit` | schema-driven fields (done) |
| Prefabs | Open prefab mode (breadcrumb), Overrides ▾ (Apply/Revert all), per-field markers, Unpack, nested prefabs, variants | `scene_tree_dock` (instance/editable children), `PackedScene` | overrides + revert (M8-32) |
| Project/Assets | two-column browser, thumbnails, create menu, drag assets into scene/inspector, search by type/label, import settings, Reveal | `filesystem_dock`, `import_dock` | Assets panel exists |
| Materials/textures | Material asset + Inspector with texture slots, tiling/offset, shader pick, preview sphere; sprite import (pivot, PPU, filter, slicing) | `editor/import`, `scene/resources/material` | material component only |
| Play mode | tinted editor, Pause/Step, live Hierarchy/Inspector edits, "Apply play-mode changes?" | `editor/run`, remote tree (`scene_tree_editor` remote) | done (M8-32) |
| Console | Collapse, Clear on Play, Error Pause, stack trace, click-to-open | `editor_log` | Collapse/Clear on Play done |
| Undo | global undo with named steps, per-scene history | `editor_undo_redo_manager` | undo stack |
| Menus/shortcuts | File/Edit/Assets/GameObject/Component/Window/Help; Cmd+Shift+N new empty, Cmd+Shift+P pause… | n/a | partial |
| Export | Build Settings window (platforms list, scenes in build, Build/Build&Run), one-click Web/Mac/Win/Linux/Android(Phase 2) | `editor/export` | export dialog |

## Phases (each ends green: `cargo test -p nord-editor`, JS tests, manual rebuild, commit + push to `main`)
**G0 Foundations (1 session).** Layout presets Unity-style (Default, 2 by 3, Tall, Wide), Scene+Game side-by-side, window menus (GameObject/Component/Assets/Window), full shortcut table in Settings. Remove dead UI.
**G1 Scene view like Unity (2–3 sessions).** Navigation (orbit/pan/fly/zoom), Q/W/E/R/T tools + rect tool, Local/Global, snapping, multi-select + marquee, selection outline, frame, 2D/3D mode switch, gizmo drawing in the webview, drag assets into scene view (sprite/model/prefab). Port Godot's canvas-item snap/pivot/ruler logic.
**G2 Hierarchy + Inspector parity (2 sessions).** Drag reorder/re-parent w/ drop lines, multi-select + multi-edit, component ⋮ menu (reset, copy/paste component values, move), enable toggles, Add Component search, lock, undo per field, debug inspector. Sprite/texture/material pickers with thumbnails.
**G3 Prefabs like Unity (1–2 sessions).** Prefab mode (edit prefab in isolation, breadcrumb), Overrides menu Apply/Revert all, nested prefabs, variants, Unpack, "Create prefab" by dragging Hierarchy → Project. Build on `crates/nord-editor/src/prefab.rs`.
**G4 Project + Materials + Import (2 sessions).** Project browser polish (thumbnails, search filters, labels), `.mat.json` material assets + Inspector (albedo texture, tint, tiling/offset, normal, emissive, shader), texture import settings (filter, PPU, pivot, slicing → sprite editor), change a texture/material by drag & drop onto Inspector or object. Port Godot import-dock ideas.
**G5 Build + Run + Game view (1 session).** Build Settings window, scenes-in-build list, platform picker (Web, Mac, Windows, Linux; Android/iOS later), Game view aspect/scale/maximize/stats, Run This Scene + Run project polish, Error Pause.
**G6 Keep-and-improve tools (parallel, 1–2 sessions each).**
- *UI Designer*: Unity-UI parity — Canvas scaler, anchors preset grid, rect-transform handles on canvas, Layout groups, Image tint (done) incl. skins, sprite-state buttons, 9-slice (done), TextMeshPro-like rich text, preview at several resolutions, undo, prefab-able UI, copy/paste.
- *Graph*: groups/comments, reroute, search-to-add with categories, subgraphs, variables panel, live debug (flow highlight while playing), node docs on F1, auto-layout, minimap.
- *Event sheets*: keep; add Inspector-style param editors, search, F1 docs, debug highlighting.
- *FPS Level / 2D Level editors*: share Scene-view navigation + snapping + hotkeys; fix old bugs listed in KNOWN_ISSUES.
**G7 Fun features.** Scene templates, command palette extensions, project-wide search (Find in scenes), asset usage ("Find References"), play-mode "Apply to scene", gizmo toggles, screenshot/GIF recorder, profiler panel (fps, entities, draw calls), tooltips everywhere, tutorial "first 10 minutes" in-editor.
**G8 Fix the old stuff.** Walk `docs/KNOWN_ISSUES.md` top to bottom, close or document each; the pre-existing `schemas_parse` test (23 vs 22), five Clippy lints, Playwright suites for T36/T38/T40–T43, native egui paths marked unverified.

## Architecture guard-rails
- Keep native egui editor + wry webview viewport (ADR-014..018). Scene view stays JS in the webview (`editor/viewport/`), the egui side owns panels. New editing features: data model in `nord-core`, UI in `crates/nord-editor`, viewport messages in `viewport/edit.js` ⇄ `state.rs::handle_viewport`.
- Everything offline; no CDNs. Tests per feature: kittest UI test + JS unit test; verify in the real editor window when on macOS (`cargo run -p nord-editor`), screenshots into `docs/screenshots/`.
- Keep scene/prefab JSON format backward compatible (minor additions only; major = ADR).
- Update docs with every change: manual chapter, `docs/EDITOR_UI.md`, CHANGELOG, tasks, HANDOFF, then `node tools/build-manual.mjs`.

## Look (G9): PlayCanvas-style aesthetics
Owner reference: the PlayCanvas editor (dark blue-grey, orange accent, vertical tool rail, UPPERCASE collapsible panel headers, floating viewport top bar with Play,
folder-tile Assets panel). Re-create the *look* with our own theme/icons (no PlayCanvas code/assets). Tasks: G9-1…G9-7 in `godotize-nordengine-tasks.md`. Do it after G1–G2 so the structure exists first; theme work (G9-1/2) is cheap and can go early.



## Progress 2026-10-22
See `godotize-nordengine-tasks.md` (Status section) for what is done, partial and not started.

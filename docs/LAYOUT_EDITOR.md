# Layout editor (M10-12/13/14)
Editor: the **Layout** tab (right dock, next to the Inspector) + the 2D scene viewport. Logic: `crates/nord-editor/src/layout.rs` (unit-tested); UI `panels/layout.rs`; viewport `editor/viewport/edit2d.js`; runtime `runtime/phaser/index.js` (layers), `components.js` (camera bounds).

## Layers (M10-12)
`scene.settings.layers = { "<layer number>": { name, visible, locked, opacity, parallax [x,y], blend, transparent, background } }`. An object's `layer` is the number. Layer panel: add, rename, ▲▼ reorder (objects and properties swap), delete (objects drop to the layer below), 🔒 lock (editor only: cannot be picked), visible, opacity, parallax (0 = fixed to the screen like a HUD, 1 = moves with the world), blend (normal/add/multiply/screen), background colour (when not transparent), *Move selection to active layer*. Layers are drawn in number order. Runtime (Phaser): visibility, opacity, parallax (scroll factor), blend and background are applied every frame, so scripts/events can change `scene.settings.layers[n]` live. Edits undo together with the objects (undo snapshots scene settings now). Not done: per-layer *scale rate* and *force own texture* (effects are per scene/object, see EFFECTS.md).

## Layout (M10-13)
- **Layout properties:** layout size (bounds for BoundToLayout/DestroyOutsideLayout and the camera), unbounded scrolling (camera may leave the layout), event sheet link, guides.
- **Rulers and guides** in the viewport: drag from the top/left ruler to create a guide, drag a guide to move it, drop it on a ruler to delete it; moving an object snaps to guides (6 px). Guides are also editable as numbers in the panel.
- **Snapping** (move/rotate/scale steps, grid) existed; guides were added.
- **Arrange selection:** align left/centre/right/top/middle/bottom and distribute horizontally/vertically (objects are boxes from their sprite/collider size).
- **Layouts (scenes):** list, switch (saves first), *New layout*, *Duplicate current*, *set as start*.

## Objects (M10-14)
- **Object types** = entities with the same name (what event sheets call objects): count, *Select all*, *＋ Instance* (duplicate the first one), **Sync instances** (copy components/behaviors/effects/scripts/tags/layer from the first instance to all others, positions stay — Construct's "object type" shared properties).
- **Overview**: small map of the layout's contents (selection in yellow). **Drag an object type (⠿) onto the map to place a new instance** there; click the map to look at that spot in the 2D viewport.
- **Views**: *Save current view* remembers the 2D viewport's camera (it reports pans/zooms back to the editor), *Go to* moves it again (`settings.views`).
- Not done: dropping straight into the viewport (the viewport is a separate web view; use the Overview map or *＋ Instance*), a true per-instance vs per-type property split (use *Sync instances*).

Tests: `cargo test -p nord-editor` (layout unit tests, `layout_panel_layers_arrange_and_undo`), `node tools/viewport-layout-test.mjs` (real `nord serve` + Chromium: lock/hide, guide drawing, ruler drag), `node tools/eventsheet-demo-test.mjs` (layers at runtime, WebGL).

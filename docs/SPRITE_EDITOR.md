# Sprite editor (M10-15/16)
Editor tab **Sprite** (centre dock). Code: `crates/nord-editor/src/pixel.rs` (drawing primitives, unit-tested), `panels/sprite.rs` (UI + undo + metadata). Runtime use of the metadata: `runtime/phaser/` (origin) and `eventsheet/aces.js` (image points).

## Paint (M10-15)
Pick any PNG of the project or *New image* (w × h, transparent). Tools: pencil, brush (size), eraser, flood fill (tolerance), line, rectangle, ellipse (filled or outline), eyedropper (also right-click), rectangle select, move selection; flip H/V and rotate 90° (flip/clear act on the selection when there is one); colour picker + a 16-colour palette you can extend; zoom 1–48× with a pixel grid; undo/redo (100 steps). *Save* writes the PNG (a name in the box makes *Save as*, folders are created; export PNG = save). Pixels are replaced, not blended, so what you paint is what is stored.

## Origin, image points, collision, frames (M10-16)
Mode **Origin, points, collision** stores into `<image>.meta.json`:
- `origin: [x, y]` — pivot in pixels (of one frame for spritesheets). The runtime uses it as the sprite's origin when the component has no `origin` of its own.
- `points: { "muzzle": [x, y] }` — named image points. Event sheets read their world position with `Hero.PointX("muzzle")` / `Hero.PointY("muzzle")`, following position, scale, flip and rotation (e.g. spawn bullets at the gun).
- `collision: [[x, y], …]` — polygon. Click to add vertices (right-click removes the nearest), or **Auto-trace** the opaque pixels (convex outline thinned to *max points*). Stored data only for now: the physics adapters still use `collider` boxes/circles (the polygon is for your own scripts and future physics support).
- `frameProps: { "<frame>": { duration, event } }` (spritesheets, frame size from the sheet's meta) — a per-frame duration multiplier and an event name; both are used by animated sprites (see ANIMATION_EDITOR.md).
Not done: per-frame origin/points, multi-frame editing in one canvas (edit the whole sheet as one image), layers, blending/anti-aliased brushes, selection lasso.
Tests: `cargo test -p nord-editor` (pixel unit tests, `sprite_editor_paints_saves_…`), `tools/plugin-objects-test.mjs` (origin), `tools/eventsheet-demo-test.mjs` (image points).

## Sprites on objects (2026-10-24)
- Hierarchy ▸ Create ▸ **Sprite** adds an object using `assets/sprites/default-white.png` (64×64, made when missing). That file is read-only by rule: *Open in Sprite editor* on it starts a new image, and Save refuses its name.
- Inspector ▸ Sprite / Animated sprite ▸ **Open in Sprite editor** links the object to the editor. Save (name box = bare name, saved in `assets/sprites/`) sets the object's `texture`; for prefab instances/children the change is stored as an override, in prefab mode it edits the prefab. Saving an existing sprite overwrites it for every object that uses it. Assets: double-click a PNG opens it unlinked.
- Mode **Settings**: `filter`, `wrap`, `ppu`, `frameWidth/frameHeight` in the `.meta.json` (same keys as the Assets import settings).

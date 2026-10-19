# Rendering plugin objects (M10-35)
Phaser components in `runtime/phaser/components-extra.js` (the Construct "plugin objects" that draw things). Test: `node tools/plugin-objects-test.mjs` (real WebGL, screenshot `target/plugin-objects.png`).

| component | fields | notes |
|---|---|---|
| `tiledBackground` | `texture`, `size [w,h]`, `scroll [px/s x, y]`, `tileScale`, `tint` | repeating texture that can scroll on its own (≈ Construct *Tiled Background*) |
| `ninePatch` | `texture`, `size`, `slice [left,right,top,bottom]`, `tint` | Phaser NineSlice: corners keep their size, edges stretch; resize with `entity.set('ninePatch','size',[w,h])` |
| `spriteFont` | `texture`, `frameSize [w,h]`, `chars` (glyphs in sheet order, row by row), `text`, `spacing`, `scale`, `align`, `tint` | bitmap font from an image grid; *Set text* works; unknown characters are blank |
| `drawingCanvas` | `size`, `color` | `entity.getComponent('drawingCanvas').api`: `rect circle line fill clear stamp`; event sheet object actions *Canvas draw rect / circle / line / fill / clear* |
| `video` | `src`, `size`, `loop`, `autoplay`, `muted` | `api.play/pause/resume/stop/seek/time`; actions *Video play/pause/resume/stop/seek*. Use WebM/MP4 your target browsers play; muted videos autoplay everywhere |

Text objects are the existing `text` component (*Set text*). These components are 2D/Phaser only; on the Babylon tier use meshes/materials and a GUI texture. Not done: spritefont character widths per glyph, video as a texture for 3D meshes.

# Tilemap editor v2 (M10-18)
Tab **Anim & Tiles** → *Tilemap painter*. Logic: `crates/nord-editor/src/tilemap.rs` (unit-tested); UI `panels/animation.rs`; runtime `runtime/phaser/components.js` (tilemap component). Format (Nord `*.tilemap.json`):
```json
{ "tileset": "assets/sprites/tiles.png", "tileWidth": 16, "tileHeight": 16,
  "layers": [ { "name": "ground", "data": [[-1, 3, …], …], "visible": true }, … ],
  "collides": [3, 4],
  "animatedTiles": { "7": { "frames": [7, 8, 9], "fps": 6 } },
  "terrains": [ { "name": "wall", "tiles": [ /* 16 tile ids, index = neighbour mask */ ] } ] }
```
- **New tilemap…** from any image: tile size and map size; it is the *tileset import + slicing* (the tile grid is the slice).
- **Brushes:** *Paint* (click/drag, right-click erases), *Rectangle* (drag, preview), *Fill* (flood), *Random* (ctrl/cmd-click several tileset tiles; the pick is deterministic per cell so repainting does not flicker), *Terrain* and *Define terrain*.
- **Multiple layers:** add, rename, reorder (▲▼), hide (the runtime skips hidden layers too), delete; the other layers are drawn faded.
- **Tile collision:** tick *tile N blocks movement* → `collides` (the runtime builds Arcade/Matter tile collision from it). Per-tile collision polygons are not supported (boxes only).
- **Animated tiles:** list frames + fps for the brush tile → `animatedTiles`; the runtime cycles every cell holding that tile.
- **Auto-tile (terrain):** *Define terrain* → choose a mask (N=1, E=2, S=4, W=8 = which neighbours are the same terrain) and click the tileset tile for it (16 slots; "alone", "N", "E"…); then paint with *Terrain*: the painted cell and its 4 neighbours pick the right edge/corner tile; right-click erases and fixes the neighbours. The map stores plain tile ids, so the runtime needs nothing extra. 4-neighbour (16-variant) rules only; 8-neighbour "blob" sets (47 tiles) are not supported.
Tests: `cargo test -p nord-editor` (tilemap logic, `tilemap_v2_ui_renders_every_brush_and_layer_controls`), `node tools/plugin-objects-test.mjs` (animated tiles + hidden layer in WebGL).

---
title: T06 Tilemaps
section: Tutorials
order: 6
summary: Paint a level with the tilemap painter and make tiles solid.
---
**Project:** `examples/platformer` (copy via the hub) — uses `assets/sprites/tileset_platformer.png` (16×16 tiles, 8 columns × 4 rows).

1. Open the **Animation / Tilemap** panel and switch its mode to **Tilemap painter**; choose a `*.tilemap.json` (or Tiled `.tmj`) map.
2. Pick a tile from the palette and paint; right-click erases.
3. Solid tiles are the indices in `collides` (component or map file). Players and enemies with bodies now stand on them.
4. Read tiles from code: `const tm = level.getComponent('tilemap'); tm.tileAt(x, y)`; change them with `tm.setTile(tx, ty, index)` (breakable blocks!).
5. Autotiling and dungeon generation: library `proc-autotile.js`, `proc-dungeon.js`.

Reference: [tilemap](component-tilemap.html). **Next:** [T07 Animation & juice](tut-t07-animation-juice.html).

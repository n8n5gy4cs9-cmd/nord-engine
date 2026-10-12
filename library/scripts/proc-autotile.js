// @nord {"id":"procedural.autotile","title":"Autotile (4-bit / 8-bit)","category":"procedural","tier":["2d"],"tags":["autotile","tilemap","bitmask"],"requires":["tilemap"],"description":"Picks edge tiles from neighbour bitmasks. Export autotile4(grid) / autotile8(grid) → grid of mask indices (0–15 / 0–255 mapped to 47-blob); the script applies a 16-tile 'blob-lite' tileset layout (index = mask) to the tilemap from a boolean grid."}
import { NordScript } from 'nord';

/** mask = N(1) E(2) S(4) W(8) of same-kind neighbours. Cells where grid is falsy → -1. */
export const autotile4 = (g) => g.map((row, y) => row.map((v, x) => (v ? (g[y - 1]?.[x] ? 1 : 0) | (g[y]?.[x + 1] ? 2 : 0) | (g[y + 1]?.[x] ? 4 : 0) | (g[y]?.[x - 1] ? 8 : 0) : -1)));
/** 8-neighbour mask reduced to the 47-tile blob set: corners only count if both adjacent edges are set. Returns raw 0–255 masks. */
export const autotile8 = (g) => g.map((row, y) => row.map((v, x) => {
  if (!v) return -1; const n = (dx, dy) => (g[y + dy]?.[x + dx] ? 1 : 0), N = n(0, -1), E = n(1, 0), S = n(0, 1), W = n(-1, 0);
  return N | (N && E && n(1, -1) ? 2 : 0) | (E ? 4 : 0) | (E && S && n(1, 1) ? 8 : 0) | (S ? 16 : 0) | (S && W && n(-1, 1) ? 32 : 0) | (W ? 64 : 0) | (W && N && n(-1, -1) ? 128 : 0);
}));

export default class Autotile extends NordScript {
  static attributes = { grid: { type: 'array', default: [], label: '2D array of 0/1 (1 = filled)' }, firstTile: { type: 'int', default: 0, label: 'Tile index of mask 0' } };
  start() {
    const tm = this.entity.getComponent('tilemap'), m = autotile4(this.attrs.grid);
    if (tm?.setTile) m.forEach((row, y) => row.forEach((v, x) => v >= 0 && tm.setTile(x, y, this.attrs.firstTile + v)));
  }
}

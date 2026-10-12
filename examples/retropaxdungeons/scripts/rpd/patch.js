// Cellular-automaton patches (water / grass). Ported from Shattered Pixel Dungeon `levels/Patch.java` (GPL-3.0).
/** @returns {Uint8Array} 1 where the patch is. fill = seeded fill rate, clustering = smoothing passes, forceFillRate = correct the rate afterwards. */
export function generatePatch(rnd, w, h, fill, clustering, forceFillRate) {
  const length = w * h;
  let cur = new Uint8Array(length), off = new Uint8Array(length);
  let fillDiff = -Math.round(length * fill);
  if (forceFillRate && clustering > 0) fill += (0.5 - fill) * 0.5;
  for (let i = 0; i < length; i++) { off[i] = rnd.float() < fill ? 1 : 0; if (off[i]) fillDiff++; }
  for (let i = 0; i < clustering; i++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const pos = x + y * w; let count = 0, nb = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        nb++; if (off[nx + ny * w]) count++;
      }
      cur[pos] = 2 * count >= nb ? 1 : 0;
      if (cur[pos] !== off[pos]) fillDiff += cur[pos] ? +1 : -1;
    }
    [cur, off] = [off, cur];
  }
  if (forceFillRate && Math.min(w, h) > 2) {
    const nbs = [-w - 1, -w, -w + 1, -1, 0, 1, w - 1, w, w + 1];
    const growing = fillDiff < 0;
    let guard = 0;
    while (fillDiff !== 0 && guard++ < length * 20) {
      let cell, tries = 0;
      do { cell = rnd.range(1, w - 2) + rnd.range(1, h - 2) * w; tries++; } while (!!off[cell] !== growing && tries * 10 < length);
      for (const i of nbs) if (fillDiff !== 0 && !!off[cell + i] !== growing) { off[cell + i] = growing ? 1 : 0; fillDiff += growing ? +1 : -1; }
    }
  }
  return off;
}

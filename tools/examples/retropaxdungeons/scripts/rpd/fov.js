// Recursive shadow casting FOV. Ported from Shattered Pixel Dungeon `mechanics/ShadowCaster.java` (GPL-3.0),
// itself based on RogueBasin’s "FOV using recursive shadowcasting" (source link in THIRD_PARTY.md).
export const MAX_DISTANCE = 20;
const rounding = [];
for (let i = 1; i <= MAX_DISTANCE; i++) {
  rounding[i] = new Array(i + 1).fill(0);
  for (let j = 1; j <= i; j++) rounding[i][j] = Math.min(j, Math.round(i * Math.cos(Math.asin(j / (i + 0.5)))));
}

/** Fill `fov` (Uint8Array w*h) with what is visible from (x,y). `blocking[i]` truthy = blocks sight (the blocking cell itself is visible). */
export function castShadow(x, y, w, fov, blocking, distance) {
  if (distance >= MAX_DISTANCE) distance = MAX_DISTANCE;
  fov.fill(0);
  fov[y * w + x] = 1;
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, +1, -1, false);
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, -1, +1, true);
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, +1, +1, true);
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, +1, +1, false);
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, -1, +1, false);
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, +1, -1, true);
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, -1, -1, true);
  scan(distance, fov, blocking, 1, x, y, w, 0, 1, -1, -1, false);
}

function scan(distance, fov, blocking, row, x, y, w, lSlope, rSlope, mX, mY, mXY) {
  let inBlocking = false;
  let rnd = rounding[distance];
  if (distance === 2) { rnd = rnd.slice(); rnd[2] = 2; } // at distance 2 corners are filled in
  const size = fov.length;
  for (; row <= distance; row++) {
    if (rSlope < lSlope) return;
    const start = lSlope === 0 ? 0 : Math.floor((row - 0.5) * lSlope + 0.499);
    const end = rSlope === 1 ? rnd[row] : Math.min(rnd[row], Math.ceil((row + 0.5) * rSlope - 0.499));
    let cell = x + y * w;
    cell += mXY ? mX * start * w + mY * row : mX * start + mY * row * w;
    for (let col = start; col <= end; col++) {
      if (col === end && inBlocking && Math.ceil((row - 0.5) * rSlope - 0.499) !== end) break;
      if (cell >= 0 && cell < size) fov[cell] = 1;
      if (blocking[cell]) {
        if (!inBlocking) {
          inBlocking = true;
          if (col !== start) scan(distance, fov, blocking, row + 1, x, y, w, lSlope, (col - 0.5) / (row + 0.5), mX, mY, mXY);
        }
      } else if (inBlocking) {
        inBlocking = false;
        lSlope = (col - 0.5) / (row - 0.5);
      }
      cell += mXY ? mX * w : mX;
    }
    if (inBlocking) return;
  }
}

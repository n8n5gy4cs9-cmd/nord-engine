// Split-screen layout — a direct JavaScript port of the pure `layout()` function in n8n5gy4cs9-cmd/nordrep (src/core/split.rs, itself ported from NordCraft):
// 1 player = fullscreen, 2 = top/bottom (or left/right), 3-4 = quadrants (a slot keeps its quadrant when others join/leave) or the Big*/Columns/Rows arrangements.
// Rectangles are fractions of the window, origin top-left: { x, y, w, h }.
export const MAX_PLAYERS = 4;
const R = (x, y, w, h) => ({ x, y, w, h });
export const FULL = R(0, 0, 1, 1);
export const ARRANGE = ['grid', 'bigTop', 'bigLeft', 'columns', 'rows'];

/** `active`: boolean[4]. opts: { two: 'topBottom'|'leftRight', multi: one of ARRANGE, main: slot for Big* } → (rect|null)[4] */
export function layout(active, { two = 'topBottom', multi = 'grid', main = 0 } = {}) {
  const slots = [0, 1, 2, 3].filter((i) => active[i]), n = slots.length, out = [null, null, null, null];
  if (n === 1) out[slots[0]] = FULL;
  else if (n === 2) { const [a, b] = two === 'topBottom' ? [R(0, 0, 1, 0.5), R(0, 0.5, 1, 0.5)] : [R(0, 0, 0.5, 1), R(0.5, 0, 0.5, 1)]; out[slots[0]] = a; out[slots[1]] = b; }
  else if (n > 2) {
    if (multi === 'grid') for (const s of slots) out[s] = R((s % 2) * 0.5, Math.floor(s / 2) * 0.5, 0.5, 0.5);
    else if (multi === 'columns') slots.forEach((s, k) => { out[s] = R(k / n, 0, 1 / n, 1); });
    else if (multi === 'rows') slots.forEach((s, k) => { out[s] = R(0, k / n, 1, 1 / n); });
    else {
      const m = active[Math.min(main, 3)] ? Math.min(main, 3) : slots[0], rest = slots.filter((s) => s !== m), k = rest.length;
      if (multi === 'bigTop') { out[m] = R(0, 0, 1, 0.6); rest.forEach((s, i) => { out[s] = R(i / k, 0.6, 1 / k, 0.4); }); } else { out[m] = R(0, 0, 0.66, 1); rest.forEach((s, i) => { out[s] = R(0.66, i / k, 0.34, 1 / k); }); }
    }
  }
  return out;
}

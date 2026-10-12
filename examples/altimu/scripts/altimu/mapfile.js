// .map text format: '@ <char> <base tile> <top tile|-> [flags…]' legend lines, a '---' line, then one text row per map row.
// Tile names come from assets/tiles/tiles.png.meta.json → "tiles". Flags: solid door gate water chest search sign anim.
export function parseMap(text, tileIdx) {
  const legend = {}, rows = [];
  let inRows = false;
  for (const raw of text.split('\n')) {
    const l = raw.replace(/\r$/, '');
    if (inRows) { if (l.length) rows.push(l); continue; }
    if (l === '---') { inRows = true; continue; }
    if (!l.startsWith('@ ')) continue;
    const [, ch, base, top, ...flags] = l.split(/\s+/);
    if (tileIdx[base] === undefined) throw new Error(`map legend '${ch}': unknown tile '${base}'`);
    if (top !== '-' && tileIdx[top] === undefined) throw new Error(`map legend '${ch}': unknown tile '${top}'`);
    legend[ch] = { ch, base: tileIdx[base], top: top === '-' ? -1 : tileIdx[top], flags: new Set(flags) };
  }
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const cells = new Array(w * h);
  rows.forEach((r, y) => { for (let x = 0; x < w; x++) { const ch = r[x] ?? '.'; cells[y * w + x] = legend[ch] ?? (() => { throw new Error(`map: no legend entry for '${ch}' at ${x},${y}`); })(); } });
  return { w, h, cells, legend };
}

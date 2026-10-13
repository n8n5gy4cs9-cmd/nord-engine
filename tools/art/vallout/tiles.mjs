// Ground tiles (32x16 iso diamonds) and wall/building blocks. Textures are hand-typed 8x8 swatches mapped on the iso faces.
// Colours are dusty/desaturated: alien-fallout Kerava (sand-coloured wasteland, pastel 60s concrete, red brick, old yellow wood).
export const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

// ---- ground swatches (8x8) -------------------------------------------------------------------------------------------
const SAND = { a: '#c9a769', b: '#b99560', c: '#d8b97c', d: '#a8854f' };
const GROUND = {
  sand1: [SAND, ['aabaaaba', 'abaaabaa', 'aaaaadaa', 'baaaaaab', 'aaabaaaa', 'aaaaabaa', 'abaaaaca', 'aaacaaab']],
  sand2: [SAND, ['aaaaaaaa', 'abbaaaca', 'aabbaaaa', 'aaaaaaba', 'acaaaaaa', 'aaaabbaa', 'aaabbaaa', 'daaaaaaa']],
  sand3: [{ ...SAND, g: '#8d8a4a', h: '#6f6c36' }, ['aabaaaba', 'aaaaaaaa', 'abaagaaa', 'aaahgaba', 'aaaaaaaa', 'bagaaaaa', 'aahgaaba', 'aaaaaaaa']],
  asphalt: [{ a: '#4a4844', b: '#3f3d3a', c: '#57544f' }, ['aabaaaba', 'abaaacaa', 'aaaabaaa', 'baaaaaab', 'aaabaaaa', 'acaaabaa', 'abaaaaca', 'aaacaaab']],
  asphaltc: [{ a: '#4a4844', b: '#3f3d3a', c: '#57544f', k: '#1d1c1a' }, ['aabaaaba', 'abaaakaa', 'aaaakkaa', 'baaakaab', 'aaakkaaa', 'acakaaba', 'abkkaaca', 'aaacaaab']],
  pave: [{ a: '#9b9686', b: '#85806f', c: '#aaa597' }, ['aaaabaaa', 'aaaabaaa', 'aaaabaaa', 'bbbbbbbb', 'aaaaaaab', 'caaaaaab', 'aaaaaaab', 'bbbbbbbb']],
  concrete: [{ a: '#8e8a80', b: '#7c786e', c: '#9c988d' }, ['aaaaaaab', 'acaaaaab', 'aaaaaaab', 'aaaaacab', 'aaaaaaab', 'aaaaaaab', 'bbbbbbbb', 'aaaaaaaa']],
  grass: [{ a: '#8a8548', b: '#767238', c: '#a09a58', d: '#5e5a2c' }, ['abaaacab', 'aaabaaaa', 'cadaabaa', 'aaaaaaca', 'baacaaba', 'aaabaada', 'acaaaaab', 'aabaacaa']],
  rubble: [{ a: '#9d9588', b: '#6f685c', c: '#c4bcae', d: '#3e3a34' }, ['abdaacab', 'aabcbaaa', 'cabdaabc', 'aaaadbaa', 'dbaacaab', 'aacabaaa', 'bcaaadba', 'aabaacaa']],
  goo: [{ a: '#4e8a3c', b: '#3b6e2e', c: '#8fd25a', d: '#26501f' }, ['aabaaaba', 'aacaabaa', 'abaaaaca', 'aaaadaab', 'bacaaaaa', 'aaabaaca', 'adaaabaa', 'aabaaaab']],
  sleeper: [{ a: '#6b5a44', b: '#574936', c: '#7e6c52' }, ['aabaaaba', 'bbbbbbbb', 'aaaaaaaa', 'abaaabaa', 'aaaaaaaa', 'bbbbbbbb', 'aabaaaba', 'aaaaaaaa']],
  platform: [{ a: '#a9a493', b: '#8d8878', y: '#d6b04a' }, ['aaaaaaaa', 'abaaaaba', 'aaaaaaaa', 'aaaaaaaa', 'aaaaabaa', 'aaaaaaaa', 'yyyyyyyy', 'aaaaaaaa']],
  floor: [{ a: '#7a5e44', b: '#6a5039', c: '#8a6c50' }, ['aaaaaaab', 'caaaaaab', 'aaaaaaab', 'bbbbbbbb', 'aaabaaaa', 'aaabaaac', 'aaabaaaa', 'bbbbbbbb']],
};
const GL = ['sand1', 'sand2', 'sand3', 'asphalt', 'asphalt_x', 'asphalt_y', 'asphaltc', 'pave', 'concrete', 'grass', 'rubble', 'goo', 'rail_x', 'rail_y', 'platform', 'floor'];
export const GROUND_NAMES = GL;
const halfW = (y) => (y < 8 ? 2 * y + 2 : 2 * (15 - y) + 2);

export function groundTiles(px) {
  const frames = GL.map((name) => {
    const base = name.startsWith('asphalt_') ? 'asphalt' : name.startsWith('rail_') ? 'sand1' : name;
    const [pal, rows] = GROUND[base];
    const img = px.blank(32, 16);
    for (let y = 0; y < 16; y++) for (let x = 16 - halfW(y); x < 16 + halfW(y); x++) img.d.set([...hex(pal[rows[y % 8][(x + (y >> 1)) % 8]]), 255], (y * 32 + x) * 4);
    const dot = (x, y, c) => { if (x >= 0 && x < 32 && y >= 0 && y < 16 && img.d[(y * 32 + x) * 4 + 3]) img.d.set([...hex(c), 255], (y * 32 + x) * 4); };
    const lineX = (off, c, a, b, step = 1) => { for (let i = a; i < b; i += step) dot(i, 8 + Math.floor((i - 16) / 2) + off, c); };
    const lineY = (off, c, a, b, step = 1) => { for (let i = a; i < b; i += step) dot(i, 8 - Math.floor((i - 16) / 2) + off, c); };
    if (name === 'asphalt_x') { lineX(0, '#d8c25a', 8, 14); lineX(0, '#d8c25a', 19, 25); }
    if (name === 'asphalt_y') { lineY(0, '#d8c25a', 8, 14); lineY(0, '#d8c25a', 19, 25); }
    if (name === 'rail_x') { const s = px.grid(['aabaaaba'], { a: '#6b5a44', b: '#574936' }); for (let i = 4; i < 28; i += 6) { lineX(-1, '#6b5a44', i, i + 3); lineX(1, '#574936', i, i + 3); } lineX(-2, '#b8b8c0', 3, 29); lineX(2, '#b8b8c0', 3, 29); lineX(-1, '#707078', 3, 29); lineX(3, '#707078', 3, 29); void s; }
    if (name === 'rail_y') { for (let i = 4; i < 28; i += 6) { lineY(-1, '#6b5a44', i, i + 3); lineY(1, '#574936', i, i + 3); } lineY(-2, '#b8b8c0', 3, 29); lineY(2, '#b8b8c0', 3, 29); lineY(-1, '#707078', 3, 29); lineY(3, '#707078', 3, 29); }
    return img;
  });
  return px.sheet(frames, 8);
}

// ---- wall blocks (32 x 72 cell, anchored at the bottom: the ground diamond is the lowest 16 rows) -----------------------
const T = {
  apt: [{ c: '#a8a392', C: '#8f8a7a', l: '#2e3a48', L: '#46586a', W: '#c9c4b2' }, ['cccccccC', 'clllllcC', 'clLlllcC', 'clllllcC', 'clllllcC', 'cWWWWWcC', 'cccccccC', 'CCCCCCCC']],
  brick: [{ r: '#9a4a36', R: '#823c2c', m: '#b0a090' }, ['rrrrmrrr', 'rRrrmrRr', 'mmmmmmmm', 'rrmrrrrr', 'rrmrRrrr', 'mmmmmmmm', 'rrrrmrrr', 'rrrrmrrr']],
  brickw: [{ r: '#9a4a36', k: '#2a2622', m: '#b0a090' }, ['rrrrrrrr', 'rkkkkkkr', 'rkkkkkkr', 'rkkkkkkr', 'rkkkkkkr', 'rmmmmmmr', 'rrrrrrrr', 'rrrrrrrr']],
  wood: [{ y: '#d0b27a', Y: '#b8995f', w: '#f0e8d0', g: '#34414f' }, ['yyyyyyyy', 'YYYYYYYY', 'ywwwwwwy', 'ywggggwy', 'ywggggwy', 'ywwwwwwy', 'YYYYYYYY', 'yyyyyyyy']],
  shopb: [{ n: '#27324a', b: '#3c4e72', o: '#e08a2a' }, ['nnnnnnnn', 'nbbbbbbn', 'nbbobbbn', 'nbbbbbbn', 'nbbbbbbn', 'nnnnnnnn', 'nnnnnnnn', 'nnnnnnnn']],
  shopu: [{ e: '#d8d0b8', d: '#3a4252' }, ['eeeeeeee', 'eeeeeeee', 'dddddddd', 'dddddddd', 'eeeeeeee', 'eeeeeeee', 'eeeeeeee', 'eeeeeeee']],
  train: [{ t: '#d8d8dc', r: '#b02a2a', q: '#2c3440' }, ['tttttttt', 'tttttttt', 'tqqqqqqt', 'tqqqqqqt', 'tttttttt', 'rrrrrrrr', 'rrrrrrrr', 'tttttttt']],
  conc: [{ c: '#a09b8c', C: '#85806f', s: '#6c8a4a' }, ['cccccccC', 'cccscccC', 'cccccccC', 'CCCCCCCC', 'cccccccC', 'ccsccccC', 'cccccccC', 'CCCCCCCC']],
};
const STYLES = {
  apt: { tex: 'apt', roof: '#6d675c' }, brick: { tex: 'brick', alt: 'brickw', roof: '#5a4a44' }, wood: { tex: 'wood', roof: '#6a4a3a' },
  shop: { tex: 'shopu', base: 'shopb', baseH: 12, roof: '#74705f' }, train: { tex: 'train', roof: '#b8b8bc' }, conc: { tex: 'conc', roof: '#8c887a' },
};
// jagged tops for ruined blocks (rows cut from the top of each of the 32 columns)
const JAG = [0, 1, 3, 2, 5, 4, 3, 6, 9, 7, 5, 4, 2, 3, 6, 8, 7, 5, 3, 2, 4, 7, 9, 8, 6, 4, 3, 5, 6, 4, 2, 1];

function cube(px, styleName, H, ruin) {
  const st = STYLES[styleName], img = px.blank(32, 72), y0 = 72 - (16 + H);
  const tex = (n) => [T[n][0], T[n][1]];
  const get = (n, u, v) => { const [pal, rows] = tex(n); return hex(pal[rows[((v % 8) + 8) % 8][((u % 8) + 8) % 8]]); };
  const put = (x, y, c, k) => { if (x < 0 || x > 31 || y < 0 || y > 71) return; img.d.set([...shade(c, k), 255], (y * 32 + x) * 4); };
  for (let x = 0; x < 32; x++) {
    const left = x < 16, topE = left ? 8 + Math.floor(x / 2) : 16 - Math.floor((x - 16) / 2) - (x === 31 ? 1 : 0);
    const cut = ruin ? JAG[x] : 0, k = left ? 0.78 : 1;
    for (let v = cut; v < H + (left ? 0 : 0); v++) {
      const y = y0 + topE + v, u = left ? x : x - 16;
      const fromBottom = H - 1 - v;
      let c;
      if (st.base && fromBottom < st.baseH) c = get(st.base, u, st.baseH - 1 - fromBottom);
      else if (st.alt && ((u >> 3) + ((v + 4) >> 3)) % 2 === 0) c = get(st.alt, u, v);
      else c = get(st.tex, u, v);
      put(x, y, c, k * (ruin && v - cut < 2 ? 0.7 : 1)); // dark broken edge
    }
    if (!ruin) put(x, y0 + topE, [30, 26, 22], 1); // top edge line
    if (x === 0 || x === 15 || x === 16 || x === 31) for (let v = 0; v < H; v++) put(x, y0 + topE + v, hex('#1a1612'), 1);
  }
  if (!ruin) { // roof diamond
    const roof = hex(st.roof);
    for (let y = 0; y < 16; y++) for (let x = 16 - halfW(y); x < 16 + halfW(y); x++) put(x, y0 + y, roof, (x + y) % 5 === 0 ? 0.88 : y < 3 ? 1.12 : 1);
    for (let y = 0; y < 16; y++) { const w = halfW(y); put(16 - w, y0 + y, [30, 26, 22], 1); put(15 + w, y0 + y, [30, 26, 22], 1); }
  } else { // rubble pile on top
    for (let x = 4; x < 28; x += 3) { put(x, y0 + 8 + JAG[x] + ((x * 7) % 3), hex('#c4bcae'), 1); put(x + 1, y0 + 9 + JAG[x], hex('#3e3a34'), 1); }
  }
  return img;
}
export const WALL_DEFS = [
  ['apt24', 'apt', 24], ['apt40', 'apt', 40], ['apt56', 'apt', 56], ['brick24', 'brick', 24], ['brick40', 'brick', 40], ['wood24', 'wood', 24], ['shop24', 'shop', 24],
  ['train28', 'train', 28], ['conc12', 'conc', 12], ['apt_ruin40', 'apt', 40, 1], ['brick_ruin24', 'brick', 24, 1], ['wood_ruin24', 'wood', 24, 1], ['shop_ruin24', 'shop', 24, 1],
];
export const wallBlocks = (px) => px.sheet(WALL_DEFS.map(([, s, h, r]) => cube(px, s, h, !!r)), 7);

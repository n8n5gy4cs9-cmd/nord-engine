// Built-in procedural textures (no image files → works offline, exports small). Add your own PNG in <project>/fpsc/bank.json (docs/FPS_CREATOR.md §Adding assets).
// Entry: { id, label, cat: 'wall'|'floor'|'ceiling'|'door'|'glass', size (metres per tile), draw(ctx,S,r) }.  `r()` = seeded random 0..1.
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fill = (c, col) => { c.fillStyle = col; c.fillRect(0, 0, 1e4, 1e4); };
function grain(c, S, r, amt = 28) { const img = c.getImageData(0, 0, S, S), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; } c.putImageData(img, 0, 0); }
function bricks(c, S, r, cols, mortar, rows = 8, per = 4) {
  fill(c, mortar); const h = S / rows, w = S / per;
  for (let j = 0; j < rows; j++) for (let i = -1; i < per + 1; i++) { const x = i * w + (j % 2 ? w / 2 : 0); c.fillStyle = cols[(r() * cols.length) | 0]; c.fillRect(x + 1.5, j * h + 1.5, w - 3, h - 3); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x + 1.5, j * h + 1.5, w - 3, 2); }
}
function tiles(c, S, r, n, a, b, grout) { fill(c, grout); const t = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? a : b; c.fillRect(i * t + 1, j * t + 1, t - 2, t - 2); } }
function planks(c, S, r, cols, n = 6, vertical = false) {
  const t = S / n;
  for (let i = 0; i < n; i++) {
    c.fillStyle = cols[(r() * cols.length) | 0]; vertical ? c.fillRect(i * t, 0, t - 1, S) : c.fillRect(0, i * t, S, t - 1);
    c.strokeStyle = 'rgba(0,0,0,.18)';
    for (let k = 0; k < 5; k++) { c.beginPath(); if (vertical) { c.moveTo(i * t + r() * t, 0); c.lineTo(i * t + r() * t, S); } else { c.moveTo(0, i * t + r() * t); c.lineTo(S, i * t + r() * t); } c.stroke(); }
  }
}
function rivets(c, S, step) { c.fillStyle = 'rgba(0,0,0,.35)'; for (let p = step / 2; p < S; p += step) for (const q of [6, S - 6]) { c.beginPath(); c.arc(p, q, 2.2, 0, 7); c.fill(); c.beginPath(); c.arc(q, p, 2.2, 0, 7); c.fill(); } }
const base = (col, amt = 26) => (c, S, r) => { fill(c, col); grain(c, S, r, amt); };
const edge = (c, S, a = 0.2) => { c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, S - 3, S, 3); c.fillRect(S - 3, 0, 3, S); };
const framed = (col, accent, accentAt) => (c, S, r) => { base(col, 16)(c, S, r); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 4; c.strokeRect(6, 6, S - 12, S - 12); c.fillStyle = accent; c.fillRect(S - 34, accentAt ?? S / 2 - 8, 14, 16); };

export const TEXTURES = [
  // ---- walls
  { id: 'brick', label: 'Red brick', cat: 'wall', size: 2, draw: (c, S, r) => { bricks(c, S, r, ['#9c4a38', '#a85543', '#8d4130', '#b05f4a'], '#6f655e'); grain(c, S, r, 20); } },
  { id: 'brick_grey', label: 'Grey brick', cat: 'wall', size: 2, draw: (c, S, r) => { bricks(c, S, r, ['#7c7f86', '#6f7279', '#868990', '#74777e'], '#4b4e54'); grain(c, S, r, 20); } },
  { id: 'stone', label: 'Stone blocks', cat: 'wall', size: 2, draw: (c, S, r) => { bricks(c, S, r, ['#8d8a80', '#7f7c73', '#9a968b', '#85827a'], '#555249', 4, 2); grain(c, S, r, 30); } },
  { id: 'concrete', label: 'Concrete', cat: 'wall', size: 2, draw: (c, S, r) => { base('#8a8c8e', 34)(c, S, r); edge(c, S); } },
  { id: 'concrete_dark', label: 'Dark concrete', cat: 'wall', size: 2, draw: (c, S, r) => { base('#4f5256', 30)(c, S, r); edge(c, S, 0.25); } },
  { id: 'plaster', label: 'Plaster (cream)', cat: 'wall', size: 2, draw: (c, S, r) => { base('#d9cfb8', 14)(c, S, r); c.fillStyle = 'rgba(80,60,30,.35)'; c.fillRect(0, S - 10, S, 10); } },
  { id: 'plaster_blue', label: 'Plaster (blue)', cat: 'wall', size: 2, draw: (c, S, r) => { base('#6f8fb0', 14)(c, S, r); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, S - 10, S, 10); } },
  { id: 'bunker', label: 'Bunker green', cat: 'wall', size: 2, draw: (c, S, r) => { base('#55654a', 34)(c, S, r); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, S / 2 - 1, S, 2); } },
  { id: 'metal_panel', label: 'Metal panel', cat: 'wall', size: 2, draw: (c, S, r) => { base('#6c747c', 20)(c, S, r); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; c.strokeRect(2, 2, S - 4, S - 4); c.lineWidth = 1; c.beginPath(); c.moveTo(0, S / 2); c.lineTo(S, S / 2); c.stroke(); rivets(c, S, S / 4); } },
  { id: 'black_metal', label: 'Black metal (frames)', cat: 'wall', size: 2, draw: (c, S, r) => { base('#15171a', 10)(c, S, r); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 0, S, 3); } },
  { id: 'metal_plate', label: 'Riveted plate', cat: 'wall', size: 2, draw: (c, S, r) => { base('#7c7367', 26)(c, S, r); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; c.strokeRect(1, 1, S - 2, S - 2); rivets(c, S, S / 6); } },
  { id: 'scifi', label: 'Sci-fi panel', cat: 'wall', size: 2, draw: (c, S, r) => { base('#2d3a4a', 14)(c, S, r); c.fillStyle = '#3d5168'; c.fillRect(8, 8, S - 16, S - 16); c.fillStyle = '#6ee7ff'; c.fillRect(16, S / 2 - 3, S - 32, 6); c.fillStyle = '#0b1722'; for (let i = 0; i < 6; i++) c.fillRect(16 + i * ((S - 32) / 6), S - 40, (S - 32) / 6 - 4, 18); c.fillStyle = '#ffb347'; c.fillRect(S - 28, 14, 10, 10); } },
  { id: 'wood_panel', label: 'Wood panels', cat: 'wall', size: 2, draw: (c, S, r) => { planks(c, S, r, ['#7a5430', '#6b4727', '#835a36'], 4, true); grain(c, S, r, 12); } },
  { id: 'tiles_white', label: 'White tiles', cat: 'wall', size: 2, draw: (c, S, r) => { tiles(c, S, r, 8, '#dfe4e6', '#e8ecee', '#aab2b6'); grain(c, S, r, 6); } },
  { id: 'container', label: 'Corrugated metal', cat: 'wall', size: 2, draw: (c, S, r) => { fill(c, '#3f6a55'); for (let x = 0; x < S; x += 16) { const g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#2f5441'); g.addColorStop(0.5, '#4d7d66'); g.addColorStop(1, '#2f5441'); c.fillStyle = g; c.fillRect(x, 0, 16, S); } grain(c, S, r, 16); } },
  { id: 'hazard', label: 'Hazard stripes', cat: 'wall', size: 2, draw: (c, S) => { fill(c, '#e8b923'); c.fillStyle = '#1b1b1b'; for (let i = -S; i < S * 2; i += 48) { c.beginPath(); c.moveTo(i, S); c.lineTo(i + 24, S); c.lineTo(i + 24 + S, 0); c.lineTo(i + S, 0); c.fill(); } } },
  // ---- floors / ceilings
  { id: 'floor_concrete', label: 'Concrete floor', cat: 'floor', size: 2, draw: (c, S, r) => { base('#6f7274', 30)(c, S, r); c.strokeStyle = 'rgba(0,0,0,.3)'; c.strokeRect(0, 0, S, S); } },
  { id: 'tile_checker', label: 'Checker tiles', cat: 'floor', size: 2, draw: (c, S, r) => { tiles(c, S, r, 4, '#d6d2c6', '#3c3f45', '#222'); grain(c, S, r, 10); } },
  { id: 'wood_floor', label: 'Wood planks', cat: 'floor', size: 2, draw: (c, S, r) => { planks(c, S, r, ['#8a6238', '#7a5530', '#946a40', '#6e4d2b'], 6); grain(c, S, r, 10); } },
  { id: 'carpet', label: 'Red carpet', cat: 'floor', size: 2, draw: (c, S, r) => { base('#7b2a2e', 38)(c, S, r); c.strokeStyle = '#c9a24b'; c.lineWidth = 4; c.strokeRect(10, 10, S - 20, S - 20); } },
  { id: 'grass', label: 'Grass', cat: 'floor', size: 4, draw: (c, S, r) => { base('#4c7a38', 40)(c, S, r); for (let i = 0; i < 700; i++) { c.fillStyle = r() > 0.5 ? '#5d9044' : '#3d6a2c'; c.fillRect(r() * S, r() * S, 2, 4); } } },
  { id: 'dirt', label: 'Dirt', cat: 'floor', size: 4, draw: (c, S, r) => { base('#6e5238', 44)(c, S, r); for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(r() * S, r() * S, 3, 3); } } },
  { id: 'sand', label: 'Sand', cat: 'floor', size: 4, draw: base('#cdb27a', 26) },
  { id: 'asphalt', label: 'Asphalt', cat: 'floor', size: 4, draw: base('#34363a', 30) },
  { id: 'grate', label: 'Metal grate', cat: 'floor', size: 2, draw: (c, S, r) => { base('#1c1f22', 10)(c, S, r); c.strokeStyle = '#8a9096'; c.lineWidth = 3; for (let i = 0; i <= S; i += S / 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.moveTo(0, i); c.lineTo(S, i); c.stroke(); } } },
  { id: 'marble', label: 'Marble', cat: 'floor', size: 2, draw: (c, S, r) => { base('#d8d8dc', 10)(c, S, r); c.strokeStyle = 'rgba(90,90,110,.35)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(r() * S, 0); c.bezierCurveTo(r() * S, S / 3, r() * S, S * 2 / 3, r() * S, S); c.stroke(); } c.strokeStyle = 'rgba(0,0,0,.25)'; c.strokeRect(0, 0, S, S); } },
  { id: 'ceiling_tiles', label: 'Ceiling tiles', cat: 'ceiling', size: 2, draw: (c, S, r) => { tiles(c, S, r, 2, '#cfcfc6', '#c6c6bd', '#8a8a82'); grain(c, S, r, 10); } },
  // ---- doors
  { id: 'door_metal', label: 'Steel door', cat: 'door', size: 2, draw: (c, S, r) => { base('#7b8189', 16)(c, S, r); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 4; c.strokeRect(6, 6, S - 12, S - 12); c.fillStyle = '#e8b923'; c.fillRect(0, S * 0.45, S, 10); rivets(c, S, S / 4); } },
  { id: 'door_wood', label: 'Wooden door', cat: 'door', size: 2, draw: (c, S, r) => { planks(c, S, r, ['#7d5330', '#6d4627'], 5, true); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 4; c.strokeRect(6, 6, S - 12, S - 12); c.fillStyle = '#d4b24a'; c.beginPath(); c.arc(S - 24, S / 2, 6, 0, 7); c.fill(); } },
  { id: 'door_scifi', label: 'Sci-fi door', cat: 'door', size: 2, draw: (c, S, r) => { base('#9aa6b4', 12)(c, S, r); c.fillStyle = '#26323f'; c.fillRect(S / 2 - 4, 0, 8, S); c.fillStyle = '#6ee7ff'; c.fillRect(S / 2 - 2, 0, 4, S); c.fillStyle = '#ff5a5a'; c.fillRect(S / 2 + 14, S / 2 - 8, 10, 16); } },
  { id: 'door_red', label: 'Locked door (red)', cat: 'door', size: 2, draw: framed('#8a2a2a', '#ff4040') },
  { id: 'door_blue', label: 'Locked door (blue)', cat: 'door', size: 2, draw: framed('#2a4a8a', '#4aa0ff') },
  { id: 'door_yellow', label: 'Locked door (yellow)', cat: 'door', size: 2, draw: framed('#8a7a22', '#ffe040') },
  { id: 'door_green', label: 'Locked door (green)', cat: 'door', size: 2, draw: framed('#2a7a3a', '#50ff70') },
  // ---- translucent
  { id: 'glass', label: 'Glass', cat: 'glass', size: 2, alpha: 0.28, draw: (c, S) => { fill(c, '#a9d8f0'); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, S - 10); c.lineTo(S / 2, 10); c.stroke(); } },
  { id: 'fence_mesh', label: 'Chain-link', cat: 'glass', size: 2, alphaTest: true, draw: (c, S) => { c.clearRect(0, 0, S, S); c.strokeStyle = '#9aa0a6'; c.lineWidth = 2; for (let i = -S; i < S * 2; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + S, S); c.moveTo(i + S, 0); c.lineTo(i, S); c.stroke(); } } },
];

export const textureDef = (id) => TEXTURES.find((t) => t.id === id) ?? null;

/** Draw a built-in texture into a new canvas (browser only). */
export function paintTexture(def, size = 256) {
  const cv = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const c = cv.getContext('2d', { willReadFrequently: true });
  let h = 7; for (const ch of def.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  def.draw(c, size, rng(h));
  return cv;
}

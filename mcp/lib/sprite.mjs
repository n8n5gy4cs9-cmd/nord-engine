// Headless 2D Sprite editor tools: the same PNG files the editor's Sprite tab edits (assets/**/*.png), with the same drawing primitives
// (pixel, line, rect, ellipse, flood fill, flip/rotate/crop). Stateless: every call reads the PNG, edits it and writes it back, so the
// editor and the AI can take turns. sprite_preview returns a scaled PNG so the AI can *see* the result. Keep docs/MCP.md in sync.
import fs from 'node:fs';
import path from 'node:path';
import { encodePng, decodePng } from './png.mjs';

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const PATH = { type: 'string', description: 'Project-relative PNG path, e.g. "assets/sprites/hero.png"' };
const COLOR = { type: 'string', description: '"#rrggbb" or "#rrggbbaa" ("#00000000" = transparent)' };

const parseColor = (s) => {
  const m = /^#?([\da-f]{6})([\da-f]{2})?$/i.exec(String(s ?? ''));
  if (!m) throw new Error(`Colours are "#rrggbb" or "#rrggbbaa", got ${JSON.stringify(s)}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, m[2] ? parseInt(m[2], 16) : 255];
};
const hex = (c) => '#' + [0, 1, 2].map((i) => c[i].toString(16).padStart(2, '0')).join('') + (c[3] === 255 ? '' : c[3].toString(16).padStart(2, '0'));

const blank = (w, h, c = [0, 0, 0, 0]) => { const data = new Uint8Array(w * h * 4); if (c[3] || c[0] || c[1] || c[2]) for (let i = 0; i < w * h; i++) data.set(c, i * 4); return { w, h, data }; };
const get = (img, x, y) => (x >= 0 && y >= 0 && x < img.w && y < img.h ? [...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4)] : null);
const put = (img, x, y, c) => { if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data.set(c, (y * img.w + x) * 4); }; // replaces, no blending: what you paint is what is stored
const brush = (img, x, y, size, c) => { const s = Math.max(1, size | 0), x0 = x - ((s - 1) >> 1), y0 = y - ((s - 1) >> 1); for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) put(img, x0 + i, y0 + j, c); };
function line(img, x0, y0, x1, y1, size, c) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) { brush(img, x0, y0, size, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function rect(img, x0, y0, x1, y1, filled, size, c) {
  const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [t, d] = [Math.min(y0, y1), Math.max(y0, y1)];
  if (filled) { for (let y = t; y <= d; y++) for (let x = a; x <= b; x++) put(img, x, y, c); return; }
  line(img, a, t, b, t, size, c); line(img, a, d, b, d, size, c); line(img, a, t, a, d, size, c); line(img, b, t, b, d, size, c);
}
function ellipse(img, x0, y0, x1, y1, filled, size, c) { // inscribed in the box, both corners inclusive
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2 + 0.5, ry = Math.abs(y1 - y0) / 2 + 0.5;
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    if (!inside(x, y)) continue;
    if (filled || !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1))) brush(img, x, y, filled ? 1 : size, c);
  }
}
function fill(img, x, y, c, tol = 0) { // 4-connected flood fill of similar colours; returns the number of pixels changed
  const start = get(img, x, y); if (!start) return 0;
  const near = (p) => Math.max(Math.abs(p[0] - start[0]), Math.abs(p[1] - start[1]), Math.abs(p[2] - start[2]), Math.abs(p[3] - start[3])) <= tol;
  if (tol === 0 && start.every((v, i) => v === c[i])) return 0;
  const seen = new Uint8Array(img.w * img.h), stack = [[x, y]]; let n = 0;
  while (stack.length) {
    const [px, py] = stack.pop(); if (px < 0 || py < 0 || px >= img.w || py >= img.h || seen[py * img.w + px]) continue;
    seen[py * img.w + px] = 1; if (!near(get(img, px, py))) continue;
    put(img, px, py, c); n++; stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
  return n;
}
const mapImg = (img, w, h, f) => { const o = blank(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [sx, sy] = f(x, y); o.data.set(img.data.subarray((sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4), (y * w + x) * 4); } return o; };
const flipH = (i) => mapImg(i, i.w, i.h, (x, y) => [i.w - 1 - x, y]);
const flipV = (i) => mapImg(i, i.w, i.h, (x, y) => [x, i.h - 1 - y]);
const rotCw = (i) => mapImg(i, i.h, i.w, (x, y) => [y, i.h - 1 - x]);
const rotCcw = (i) => mapImg(i, i.h, i.w, (x, y) => [i.w - 1 - y, x]);
function crop(img, x0, y0, x1, y1) { // box in source pixels, corners inclusive; outside the image becomes transparent (so it can also grow the canvas)
  const w = Math.abs(x1 - x0) + 1, h = Math.abs(y1 - y0) + 1, ox = Math.min(x0, x1), oy = Math.min(y0, y1), o = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = get(img, ox + x, oy + y); if (p) o.data.set(p, (y * w + x) * 4); }
  return o;
}
const scaleUp = (img, k) => mapImg(img, img.w * k, img.h * k, (x, y) => [Math.floor(x / k), Math.floor(y / k)]);
const paste = (img, src, x, y, transparentSkips = true) => { for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const p = get(src, i, j); if (p && (!transparentSkips || p[3] > 0)) put(img, x + i, y + j, p); } };

export function spriteTools(ctx) {
  const T = [];
  const tool = (name, description, inputSchema, handler) => T.push({ name, description, inputSchema, handler, group: 'sprite' });
  const abs = (p, write = false) => {
    const root = ctx.projectRoot(), f = path.resolve(root, String(p ?? ''));
    if (!f.startsWith(root + path.sep)) throw new Error('Path leaves the project');
    if (!/\.png$/i.test(f)) throw new Error('Sprite files are PNG: the path must end in .png');
    if (write && /(^|[\\/])(\.git|node_modules|target)([\\/]|$)/.test(path.relative(root, f))) throw new Error('Protected folder');
    return f;
  };
  const load = (p) => { const f = abs(p); if (!fs.existsSync(f)) throw new Error(`${p} does not exist (sprite_new creates it)`); const img = decodePng(fs.readFileSync(f)); if (!img) throw new Error(`${p} is not an 8-bit non-interlaced PNG that this tool can read (re-save it as RGBA PNG)`); return img; };
  const save = (p, img) => { const f = abs(p, true); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, encodePng(img.w, img.h, img.data)); };
  const size = (img) => `${img.w}x${img.h}`;

  tool('sprite_new', 'Create a new PNG sprite (default fully transparent). Then draw with sprite_draw / sprite_from_ascii and check it with sprite_preview. Use it in a scene with a sprite component {"type":"sprite","texture":"<path>"}.', obj({ path: PATH, width: { type: 'integer', description: '1..2048' }, height: { type: 'integer', description: '1..2048' }, color: COLOR }, ['path', 'width', 'height']), ({ path: p, width, height, color }) => {
    if (!(width >= 1 && width <= 2048 && height >= 1 && height <= 2048)) throw new Error('width and height must be 1..2048');
    const f = abs(p, true); if (fs.existsSync(f)) throw new Error(`${p} already exists (draw on it with sprite_draw, or pick another path)`);
    save(p, blank(width, height, color ? parseColor(color) : undefined)); return `Created ${p} (${width}x${height}). Next: sprite_draw / sprite_from_ascii, then sprite_preview.`;
  });
  tool('sprite_list', 'List the PNG files of the project (assets/ and everywhere else) with their sizes.', obj({ dir: { type: 'string', description: 'Default "assets"' } }), ({ dir = 'assets' }) => {
    const root = ctx.projectRoot(), base = path.resolve(root, dir); if (!base.startsWith(root)) throw new Error('Path leaves the project'); const out = [];
    const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (/^(\.|node_modules$|target$)/.test(e.name)) continue; const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.png$/i.test(e.name)) { const b = fs.readFileSync(f); out.push(`${path.relative(root, f)} ${b.length > 24 && b.readUInt32BE(0) === 0x89504e47 ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : '?'}`); } } };
    walk(base); return out.slice(0, 300).join('\n') || '(no PNG files)';
  });
  tool('sprite_describe', 'Describe a sprite: size, number of colours, the most used colours (palette letters) and, for images up to 64x64, the pixel grid as text (. = transparent) so you can reason about pixels exactly.', obj({ path: PATH }, ['path']), ({ path: p }) => {
    const img = load(p), count = new Map();
    for (let i = 0; i < img.w * img.h; i++) { const c = hex([...img.data.subarray(i * 4, i * 4 + 4)]); count.set(c, (count.get(c) ?? 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 26), letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', sym = new Map(top.map(([c], i) => [c, c.endsWith('00') && c.length === 9 ? '.' : letters[i]]));
    let grid = '';
    if (img.w <= 64 && img.h <= 64) { for (let y = 0; y < img.h; y++) { let row = ''; for (let x = 0; x < img.w; x++) { const c = hex(get(img, x, y)); row += sym.get(c) ?? (get(img, x, y)[3] === 0 ? '.' : '?'); } grid += row + '\n'; } }
    return `${p}: ${size(img)}, ${count.size} colours\nPalette: ${top.map(([c, n]) => `${sym.get(c)}=${c} (${n}px)`).join(', ')}${grid ? '\n' + grid : '\n(too big for a grid: use sprite_preview)'}`;
  });
  tool('sprite_draw', 'Draw on a PNG with the editor\'s tools. ops run in order; pixels are replaced (no blending). Each op: {shape:"pixel"|"line"|"rect"|"ellipse"|"fill"|"clear", x,y (pixel, top-left origin), x1,y1 (end/corner, inclusive), color, filled (rect/ellipse, default true), size (brush px, default 1), tolerance (fill 0..255)}. "pixel" draws at x,y; "clear" empties the box x,y..x1,y1 (or the whole image without coordinates). Returns a short log; follow with sprite_preview.', obj({ path: PATH, ops: { type: 'array', items: { type: 'object' }, description: 'List of drawing operations' } }, ['path', 'ops']), ({ path: p, ops }) => {
    const img = load(p), log = [];
    for (const [i, o] of ops.entries()) {
      const c = o.color ? parseColor(o.color) : [0, 0, 0, 255], s = o.size ?? 1, num = (k) => { if (!Number.isInteger(o[k])) throw new Error(`op ${i} (${o.shape}): ${k} must be an integer pixel`); return o[k]; };
      switch (o.shape) {
        case 'pixel': brush(img, num('x'), num('y'), s, c); break;
        case 'line': line(img, num('x'), num('y'), num('x1'), num('y1'), s, c); break;
        case 'rect': rect(img, num('x'), num('y'), num('x1'), num('y1'), o.filled !== false, s, c); break;
        case 'ellipse': ellipse(img, num('x'), num('y'), num('x1'), num('y1'), o.filled !== false, s, c); break;
        case 'fill': log.push(`fill ${fill(img, num('x'), num('y'), c, o.tolerance ?? 0)}px`); break;
        case 'clear': if (o.x == null) img.data.fill(0); else rect(img, num('x'), num('y'), num('x1'), num('y1'), true, 1, [0, 0, 0, 0]); break;
        default: throw new Error(`op ${i}: unknown shape "${o.shape}" (pixel, line, rect, ellipse, fill, clear)`);
      }
    }
    save(p, img); return `Drew ${ops.length} op(s) on ${p} (${size(img)}).${log.length ? ' ' + log.join(', ') + '.' : ''} Look at it with sprite_preview.`;
  });
  tool('sprite_from_ascii', 'Paint pixel art from text: rows is an array of strings, one character per pixel, palette maps a character to a colour ("." and " " are transparent unless listed). Easiest way to draw a whole sprite. If the PNG does not exist it is created with the size of the rows. x,y = where to place it (default 0,0).', obj({ path: PATH, rows: { type: 'array', items: { type: 'string' } }, palette: { type: 'object', description: 'e.g. {"#":"#222222","r":"#ff0000"}' }, x: { type: 'integer' }, y: { type: 'integer' } }, ['path', 'rows', 'palette']), ({ path: p, rows, palette, x = 0, y = 0 }) => {
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length, f = abs(p, true), img = fs.existsSync(f) ? load(p) : blank(w + x, h + y), pal = {};
    for (const [k, v] of Object.entries(palette)) { if (k.length !== 1) throw new Error(`Palette keys are single characters, got "${k}"`); pal[k] = parseColor(v); }
    let n = 0; rows.forEach((r, j) => [...r].forEach((ch, i) => { const c = pal[ch] ?? (ch === '.' || ch === ' ' ? null : (() => { throw new Error(`Character "${ch}" at row ${j} col ${i} is not in the palette`); })()); if (c) { put(img, x + i, y + j, c); n++; } }));
    save(p, img); return `Painted ${n} pixels into ${p} (${size(img)}) at ${x},${y}. Look at it with sprite_preview.`;
  });
  tool('sprite_transform', 'Whole-image edits: flip_h, flip_v, rotate_cw, rotate_ccw, crop (box x,y..x1,y1 inclusive; outside = transparent, so it can also grow the canvas), scale (integer factor, nearest neighbour: keeps pixels sharp), stamp (paste another PNG "source" at x,y; transparent pixels are skipped).', obj({ path: PATH, op: { type: 'string', enum: ['flip_h', 'flip_v', 'rotate_cw', 'rotate_ccw', 'crop', 'scale', 'stamp'] }, x: { type: 'integer' }, y: { type: 'integer' }, x1: { type: 'integer' }, y1: { type: 'integer' }, factor: { type: 'integer' }, source: PATH }, ['path', 'op']), ({ path: p, op, x, y, x1, y1, factor, source }) => {
    let img = load(p);
    if (op === 'flip_h') img = flipH(img); else if (op === 'flip_v') img = flipV(img); else if (op === 'rotate_cw') img = rotCw(img); else if (op === 'rotate_ccw') img = rotCcw(img);
    else if (op === 'crop') { if ([x, y, x1, y1].some((v) => !Number.isInteger(v))) throw new Error('crop needs x, y, x1, y1'); img = crop(img, x, y, x1, y1); }
    else if (op === 'scale') { if (!(factor >= 2 && factor <= 16)) throw new Error('scale needs factor 2..16'); if (img.w * factor > 4096 || img.h * factor > 4096) throw new Error('Result too big (4096 max)'); img = scaleUp(img, factor); }
    else if (op === 'stamp') { paste(img, load(source), x ?? 0, y ?? 0); }
    else throw new Error('Unknown op ' + op);
    save(p, img); return `${op} done: ${p} is now ${size(img)}.`;
  });
  tool('sprite_meta', 'Import settings of a texture (written next to it as <path>.meta.json, read by the engine and the editor): frameWidth/frameHeight (cut a sprite sheet into frames, used by animatedSprite), filter ("nearest" keeps pixel art sharp, "linear" smooths), ppu (pixels per world unit in 3D), wrap ("clamp"|"repeat"). Unmentioned keys stay.', obj({ path: PATH, frameWidth: { type: 'integer' }, frameHeight: { type: 'integer' }, filter: { type: 'string', enum: ['nearest', 'linear'] }, ppu: { type: 'number' }, wrap: { type: 'string', enum: ['clamp', 'repeat'] } }, ['path']), ({ path: p, ...rest }) => {
    const img = load(p), mf = abs(p, true) + '.meta.json', cur = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) cur[k] = v;
    if (cur.frameWidth && img.w % cur.frameWidth) throw new Error(`frameWidth ${cur.frameWidth} does not divide the width ${img.w}`);
    if (cur.frameHeight && img.h % cur.frameHeight) throw new Error(`frameHeight ${cur.frameHeight} does not divide the height ${img.h}`);
    fs.writeFileSync(mf, JSON.stringify(cur, null, 2) + '\n'); return `Wrote ${path.relative(ctx.projectRoot(), mf)}: ${JSON.stringify(cur)}`;
  });
  tool('sprite_preview', 'Render the sprite as an enlarged PNG (nearest neighbour, checkerboard behind transparent pixels) so you can look at it. ALWAYS look after drawing. scale defaults to fit about 384 px.', obj({ path: PATH, scale: { type: 'integer', description: '1..32' }, grid: { type: 'boolean', description: 'Draw a pixel grid (default false)' } }, ['path']), ({ path: p, scale, grid = false }) => {
    const img = load(p), k = Math.max(1, Math.min(32, scale ?? Math.max(1, Math.floor(384 / Math.max(img.w, img.h))))), W = img.w * k, H = img.h * k, out = blank(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = get(img, Math.floor(x / k), Math.floor(y / k)), chk = ((x >> 3) + (y >> 3)) & 1 ? 200 : 150, a = px[3] / 255;
      let c = [0, 1, 2].map((i) => Math.round(px[i] * a + chk * (1 - a)));
      if (grid && k >= 6 && (x % k === 0 || y % k === 0)) c = c.map((v) => Math.round(v * 0.75));
      out.data.set([...c, 255], (y * W + x) * 4);
    }
    return { text: `Preview of ${p} (${size(img)}, shown ${W}x${H}${grid ? ', with pixel grid' : ''})`, images: [Buffer.from(encodePng(W, H, out.data)).toString('base64')] };
  });
  return T;
}

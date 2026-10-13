#!/usr/bin/env node
// Hand-drawn pixel art → PNG. NOT a generator: every pixel is typed by a human/AI artist as text in tools/art/<game>/*.mjs
// (one character per pixel, palette maps characters to colours). This file only parses those grids, composes frames out of
// drawn parts (puppet animation), and encodes PNG sheets (+ nord `.meta.json` sidecars).
//
//   node tools/pixelart.mjs <game> [--preview]      games: rpd, noom   (writes into game/assets/…)
//
// Art module contract (tools/art/<game>/index.mjs): `export default (px) => [ { out:'assets/x.png', image, meta? }, … ]`
// where `px` is this module's exports. See tools/art/README.md for the drawing conventions.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** An image is { w, h, d: Uint8Array(w*h*4) RGBA }. */
export const blank = (w, h) => ({ w, h, d: new Uint8Array(w * h * 4) });
const hex = (c) => { const n = parseInt(c.slice(1), 16); return c.length > 7 ? [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; };

/** Parse a text grid. `rows` is a string (leading/trailing blank lines trimmed, indentation NOT stripped) or an array of strings. '.' and ' ' are transparent unless the palette says otherwise. */
export function grid(rows, pal, name = 'grid', { pad = false } = {}) {
  const lines = (Array.isArray(rows) ? rows : String(rows).split('\n')).map((l) => l.replace(/\r$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const w = Math.max(...lines.map((l) => l.length));
  if (pad) lines.forEach((l, i) => { lines[i] = l.padEnd(w, '.'); }); // parts: trailing transparent columns may be omitted
  const img = blank(w, lines.length);
  lines.forEach((l, y) => {
    if (l.length !== w) throw new Error(`${name}: row ${y} has ${l.length} chars, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = l[x];
      const col = pal[ch];
      if (col === undefined) { if (ch === '.' || ch === ' ') continue; throw new Error(`${name}: unknown palette char '${ch}' at ${x},${y}`); }
      if (col === null) continue;
      img.d.set(hex(col), (y * w + x) * 4);
    }
  });
  return img;
}
export const flipH = (a) => { const o = blank(a.w, a.h); for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) o.d.set(a.d.subarray((y * a.w + (a.w - 1 - x)) * 4, (y * a.w + (a.w - x)) * 4), (y * a.w + x) * 4); return o; };
/** Draw `src` onto `dst` at (x,y) (alpha-test blit: opaque pixels overwrite). Mutates and returns dst. */
export function blit(dst, src, x0 = 0, y0 = 0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const dx = x0 + x, dy = y0 + y; if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
    const s = (y * src.w + x) * 4; if (src.d[s + 3] === 0) continue;
    dst.d.set(src.d.subarray(s, s + 4), (dy * dst.w + dx) * 4);
  }
  return dst;
}
/** Mirror a hand-drawn left half into a symmetric whole (front-facing heads/torsos): result is 2× as wide. */
export const mirror = (a) => { const o = blank(a.w * 2, a.h); blit(o, a, 0, 0); blit(o, flipH(a), a.w, 0); return o; };
/** Compose a w×h frame from drawn parts: layers = [[image, x, y, 'flip'?], …] painted in order. */
export const compose = (w, h, layers) => layers.reduce((o, [img, x, y, f]) => blit(o, f === 'flip' ? flipH(img) : img, x, y), blank(w, h));
/** Crop a region (to cut a hand-drawn sheet into frames). */
export const crop = (a, x0, y0, w, h) => { const o = blank(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x0 + x, sy = y0 + y; if (sx < a.w && sy < a.h) o.d.set(a.d.subarray((sy * a.w + sx) * 4, (sy * a.w + sx) * 4 + 4), (y * w + x) * 4); } return o; };
/** Lay equal-size frames out in a grid (cols columns; 0 = one row). */
export function sheet(frames, cols = 0) {
  const fw = frames[0].w, fh = frames[0].h; cols ||= frames.length; const rows = Math.ceil(frames.length / cols);
  const o = blank(fw * cols, fh * rows);
  frames.forEach((f, i) => { if (f.w !== fw || f.h !== fh) throw new Error(`sheet: frame ${i} is ${f.w}x${f.h}, expected ${fw}x${fh}`); blit(o, f, (i % cols) * fw, Math.floor(i / cols) * fh); });
  return o;
}
export const scaleUp = (a, k) => { const o = blank(a.w * k, a.h * k); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.d.set(a.d.subarray((Math.floor(y / k) * a.w + Math.floor(x / k)) * 4, (Math.floor(y / k) * a.w + Math.floor(x / k)) * 4 + 4), (y * o.w + x) * 4); return o; };

// ---- PNG encoder (RGBA8, no filter) ---------------------------------------------------------------------------------
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(t, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
export function png(a) {
  const raw = Buffer.alloc((a.w * 4 + 1) * a.h);
  for (let y = 0; y < a.h; y++) { raw[y * (a.w * 4 + 1)] = 0; Buffer.from(a.d.buffer, a.d.byteOffset + y * a.w * 4, a.w * 4).copy(raw, y * (a.w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(a.w, 0); ihdr.writeUInt32BE(a.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- driver -----------------------------------------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = process.argv[2];
  if (!game) { console.error('usage: node tools/pixelart.mjs <game> [--preview]'); process.exit(1); }
  const mod = await import(pathToFileURL(path.join(ROOT, 'tools/art', game, 'index.mjs')).href);
  const px = { grid, flipH, mirror, blit, compose, crop, sheet, blank, scaleUp };
  const outs = await mod.default(px);
  const base = path.join(ROOT, 'game');
  const prev = process.argv.includes('--preview') ? process.env.PREVIEW_DIR ?? path.join(ROOT, 'target/art-preview') : null;
  const previews = [];
  if (prev) fs.mkdirSync(prev, { recursive: true });
  for (const o of outs) {
    const f = path.join(base, o.out);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, png(o.image));
    if (o.meta) fs.writeFileSync(`${f}.meta.json`, JSON.stringify(o.meta, null, 2) + '\n');
    if (prev) previews.push(o);
    console.log(`${o.out}  ${o.image.w}x${o.image.h}`);
  }
  if (prev && previews.length) { // contact sheet on a neutral background so transparency is visible: <prev>/<game>.png (+ one file per sprite)
    const rows = previews.map((o) => scaleUp(o.image, o.preview ?? 6));
    const W = Math.max(...rows.map((r) => r.w)) + 16, H = rows.reduce((a, r) => a + r.h + 8, 8);
    const sheetImg = blank(W, H);
    for (let i = 0; i < sheetImg.d.length; i += 4) sheetImg.d.set([96, 100, 116, 255], i);
    let y = 8; for (const r of rows) { blit(sheetImg, r, 8, y); y += r.h + 8; }
    fs.writeFileSync(path.join(prev, `${game}.png`), png(sheetImg));
    previews.forEach((o, i) => { const bg = blank(rows[i].w, rows[i].h); for (let k = 0; k < bg.d.length; k += 4) bg.d.set([96, 100, 116, 255], k); fs.writeFileSync(path.join(prev, `${path.basename(o.out, '.png')}.png`), png(blit(bg, rows[i]))); });
  }
}

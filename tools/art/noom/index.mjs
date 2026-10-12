// Reviewed raster masters + hand-drawn font → runtime PNGs. No image API at build time.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { font } from './font.mjs';

export const id = 'noom';
export default (px) => {
  const manifest = JSON.parse(fs.readFileSync(new URL('./redrawn/manifest.json', import.meta.url), 'utf8'));
  return manifest.map(({ out, width, height, meta, preview }) => {
    const d = out.endsWith('/font.png') ? null : zlib.gunzipSync(fs.readFileSync(new URL(`./redrawn/${out.split('/').at(-1)}.rgba.gz`, import.meta.url)));
    if (d && d.length !== width * height * 4) throw new Error(`Noom raster master has wrong size: ${out}`);
    return { out, meta, preview, image: d ? { w: width, h: height, d } : font(px) };
  });
};

// Reviewed X-COM-inspired raster masters + pixel-exact UI/FX. Re-packs entirely offline.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { details } from './details.mjs';

export const id = 'xkom';
export default (px) => {
  const drawn = details(px);
  const manifest = JSON.parse(fs.readFileSync(new URL('./redrawn/manifest.json', import.meta.url), 'utf8'));
  return manifest.map(({ out, width, height, meta, preview }) => {
    const image = drawn[out] ?? { w: width, h: height, d: zlib.gunzipSync(fs.readFileSync(new URL(`./redrawn/${out.slice(7).replaceAll('/', '-')}.rgba.gz`, import.meta.url))) };
    if (image.w !== width || image.h !== height || image.d.length !== width * height * 4) throw new Error(`X-KOM raster master has wrong size: ${out}`);
    return { out, meta, preview, image };
  });
};

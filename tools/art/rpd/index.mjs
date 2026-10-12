// Reviewed raster masters + hand-drawn FX/font → runtime PNGs. Re-packs offline.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { effects, font } from './details.mjs';

export const id = 'retropaxdungeons';
export default (px) => {
  const manifest = JSON.parse(fs.readFileSync(new URL('./redrawn/manifest.json', import.meta.url), 'utf8'));
  return manifest.map(({ out, width, height, meta, preview }) => {
    const name = out.split('/').at(-1);
    const drawn = name === 'font.png' ? font(px) : name === 'fx.png' ? effects(px) : null;
    const d = drawn ? null : zlib.gunzipSync(fs.readFileSync(new URL(`./redrawn/${name}.rgba.gz`, import.meta.url)));
    if (d && d.length !== width * height * 4) throw new Error(`RetroPax raster master has wrong size: ${out}`);
    return { out, meta, preview, image: drawn ?? { w: width, h: height, d } };
  });
};

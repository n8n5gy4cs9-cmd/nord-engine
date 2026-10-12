// Automies art pack → tools/examples/automies/assets/…  (run: node tools/pixelart.mjs automies --preview)
import { PAL, TEX, TEX_NAMES } from './textures.mjs';
import { PAL as IPAL, ICONS, ICON_NAMES } from './icons.mjs';
import { font } from '../noom/font.mjs';

export const id = 'automies';
export default (px) => {
  const out = TEX_NAMES.map((n) => ({ out: `assets/textures/${n}.png`, image: px.grid(TEX[n], PAL, `tex:${n}`), meta: { type: 'texture', filter: 'nearest', wrap: 'repeat', note: n === 'water' ? '32x32 seamless, scrolls' : '16x16 seamless, 4 m per repeat' }, preview: n === 'water' ? 6 : 8 }));
  const icons = px.sheet(ICON_NAMES.map((n) => px.grid(ICONS[n], IPAL, `icon:${n}`)), 8);
  out.push({ out: 'assets/ui/icons.png', image: icons, meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', frames: Object.fromEntries(ICON_NAMES.map((n, i) => [n, i])) }, preview: 6 });
  out.push({ out: 'assets/ui/font.png', image: font(px), meta: { type: 'bitmapfont', cellWidth: 6, cellHeight: 8, filter: 'nearest', note: 'white glyphs, tinted at runtime; upper-case only' }, preview: 4 });
  return out;
};

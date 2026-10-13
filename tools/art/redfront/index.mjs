// Red Front 2026 art pack → tools/examples/redfront/assets/…  Same hand-drawn RTS art as X-KOM 2026 (tools/art/xkom/rts.mjs) painted in two team colours: Allies (blue) and Soviets (red).
import * as R from '../xkom/rts.mjs';
import { font } from '../noom/font.mjs';
export const id = 'redfront';
export default (px) => {
  const outs = R.build(px, ['allies', 'soviet']).filter((o) => !/b_(hive|brood|tower)/.test(o.out));
  outs.push({ out: 'assets/ui/font.png', image: font(px), meta: { type: 'bitmapfont', cellWidth: 6, cellHeight: 8, chars: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_', charsPerRow: 16, note: 'white glyphs, tinted at runtime; upper-case only' }, preview: 4 });
  return outs;
};

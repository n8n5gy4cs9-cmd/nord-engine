import fs from 'node:fs';
import path from 'node:path';
import { E, project } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const shared = (f) => fs.readFileSync(path.join(here, '../xkom/scripts/xk', f), 'utf8'); // the RTS engine is shared with X-KOM 2026 (one source of truth)
const sfx = ['rifle', 'explosion', 'hit', 'die_human', 'click', 'select', 'ack', 'built', 'cannon', 'rocket', 'ore', 'victory', 'defeat', 'error', 'confirm'];
const FONTS = ['vt323/vt323-latin-400-normal.woff2', 'orbitron/orbitron-latin-900-normal.woff2'];
const A = (p) => ({ from: `tools/examples/xkom/assets/audio/${p}`, to: `assets/audio/${p}` });
const input = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], confirm: ['Enter'], cancel: ['Escape'] };

export default () => ({
  name: 'Red Front 2026',
  project: project('redfront', 'Red Front 2026', '2d', { w: 960, h: 600, pixelArt: true, bg: '#180808', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('RedFront', { s: ['scripts/redfront.js'] })] } },
  assets: [...FONTS.map((f) => ({ from: `vendor/fonts/${f}`, to: `assets/fonts/${f.split('/')[1]}` })), ...sfx.map((n) => A(`sfx/${n}.wav`))], // music lives in this example's own assets/audio/music/
  files: {
    'assets.md': read('docs/assets.md'), 'GUIDE.md': read('docs/GUIDE.md'),
    'scripts/xk/ui-config.js': shared('ui-config.js'), 'scripts/xk/base.js': shared('base.js'), 'scripts/xk/rts.js': shared('rts.js'), 'scripts/xk/rtsview.js': shared('rtsview.js'), 'scripts/xk/pixeltext.js': shared('pixeltext.js'), 'scripts/xk/help.js': shared('help.js'),
  },
  readme: read('docs/README.md'),
});

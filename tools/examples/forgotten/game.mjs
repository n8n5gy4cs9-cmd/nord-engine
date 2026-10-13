import fs from 'node:fs';
import path from 'node:path';
import { E, project } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const input = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], confirm: ['Enter', 'KeyZ'], cancel: ['Escape', 'KeyX'] };

export default () => ({
  name: 'Forgotten Wars',
  project: project('forgotten', 'Forgotten Wars', '2d', { w: 640, h: 512, pixelArt: true, bg: '#0c1020', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('ForgottenWars', { s: ['scripts/forgotten.js'] })] } },
  assets: [...['click', 'confirm', 'error', 'open', 'hover', 'whoosh', 'hit', 'shoot', 'explosion_small', 'coin', 'pickup', 'level_up', 'win', 'lose'].map((n) => `assets/audio/sfx/${n}.wav`), 'assets/audio/music/music_action.mp3'],
  files: { 'assets.md': read('docs/assets.md'), 'GUIDE.md': read('docs/GUIDE.md') },
  readme: read('docs/README.md'),
});

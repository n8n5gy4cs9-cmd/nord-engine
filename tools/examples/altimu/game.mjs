import fs from 'node:fs';
import path from 'node:path';
import { E, project } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const input = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], confirm: ['Enter'], cancel: ['Escape'] };

export default () => ({
  name: 'Altimu 5.7',
  project: project('altimu', 'Altimu 5.7', '2d', { w: 960, h: 544, pixelArt: true, bg: '#0a0812', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('Altimu', { s: ['scripts/altimu.js'] })] } },
  assets: [...['step_grass', 'step_stone', 'click', 'error', 'open', 'close', 'swing', 'hit', 'shoot', 'death', 'pickup', 'coin', 'chest', 'heal', 'level_up', 'win', 'lose', 'alarm'].map((n) => `assets/audio/sfx/${n}.wav`), 'assets/audio/music/music_adventure.mp3', 'assets/audio/music/jingle_victory.mp3'],
  files: { 'assets.md': read('docs/assets.md'), 'GUIDE.md': read('docs/GUIDE.md') },
  readme: read('docs/README.md'),
});

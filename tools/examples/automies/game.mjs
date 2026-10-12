import fs from 'node:fs';
import path from 'node:path';
import { E, project, SKY } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const input = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], handbrake: ['Space'], confirm: ['Enter'] };

export default () => ({
  name: 'Automies',
  project: project('automies', 'Automies', '3d', { physics: { engine: 'none', gravity: [0, 0, 0] }, theme: 'nord', input }),
  scenes: { main: { entities: [
    E('Camera', { c: [{ type: 'camera', fov: 65, far: 1600 }] }), // placeholder so the runtime does not add a default camera; the game script makes the player cameras
    E('Automies', { s: [['scripts/automies.js', { players: 1 }]] }),
  ] } },
  assets: [...SKY('day'), ...['checkpoint', 'tick', 'confirm', 'explosion', 'explosion_small', 'spawn', 'win', 'lose'].map((n) => `assets/audio/sfx/${n}.wav`), 'assets/audio/music/music_action.mp3'],
  files: { 'assets.md': read('docs/assets.md'), 'GUIDE.md': read('docs/GUIDE.md') },
  readme: read('docs/README.md'),
});

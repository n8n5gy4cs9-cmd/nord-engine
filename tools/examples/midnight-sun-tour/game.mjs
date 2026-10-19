import fs from 'node:fs';
import path from 'node:path';
import { E, project } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const input = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], confirm: ['Enter'], cancel: ['Escape'] };
export default () => ({
  name: "Midnight Sun Tour",
  project: project('midnight-sun-tour', "Mikko Levon's: Midnight Sun Tour", '2d', { w: 1280, h: 720, pixelArt: true, bg: '#05030c', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('Midnight Sun Tour', { s: ['scripts/midnight_sun_tour.js'] })] } },
  assets: [],
  files: { 'GUIDE.md': read('docs/GUIDE.md'), 'ASSETS.md': read('ASSETS.md'), 'commands.txt': read('commands.txt') },
  readme: read('docs/README.md'),
});

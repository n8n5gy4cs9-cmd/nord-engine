import fs from 'node:fs';
import path from 'node:path';
import { E, project } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const input = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], confirm: ['Enter'], cancel: ['Escape'] };
export default () => ({
  name: 'Vallout 2: New Kerava',
  project: project('vallout', 'Vallout 2: New Kerava', '2d', { w: 640, h: 480, pixelArt: true, bg: '#050403', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('Valout2', { s: ['scripts/valout.js'] })] } },
  assets: [],
  files: Object.fromEntries(['assets.md', 'GUIDE.md', 'STORY.md', 'PLAN.md', 'PRD.md', 'TASKS.md'].map((f) => [f, read(`docs/${f.replace('assets.md', 'assets.md')}`)])),
  readme: read('docs/README.md'),
});

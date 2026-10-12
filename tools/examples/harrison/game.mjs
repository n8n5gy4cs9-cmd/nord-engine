import fs from 'node:fs';
import path from 'node:path';
import { E, project, SKY } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

export default () => ({
  name: "Harrison's Command",
  project: project('harrison', "Harrison's Command", '3d', { physics: { engine: 'none', gravity: [0, 0, 0] }, theme: 'nord' }),
  scenes: { main: { entities: [
    E('Sky', { c: [{ type: 'skybox', path: 'assets/skybox/day' }] }),
    E('Camera', { c: [{ type: 'camera', fov: 60, far: 2600 }] }), // placeholder so the runtime does not add a default camera; the game script makes the two player cameras
    E('Harrison', { s: [['scripts/harrison.js', { players: 1 }]] }),
  ] } },
  assets: [...SKY('day'), ...['hit', 'shoot', 'explosion', 'explosion_small', 'missile', 'whoosh', 'splash', 'click', 'open', 'close', 'lose'].map((n) => `assets/audio/sfx/${n}.wav`), 'assets/audio/music/music_action.mp3', 'assets/audio/music/jingle_victory.mp3'],
  files: { 'assets.md': read('docs/assets.md'), 'GUIDE.md': read('docs/GUIDE.md') },
  readme: read('docs/README.md'),
});

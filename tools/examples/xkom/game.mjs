import fs from 'node:fs';
import path from 'node:path';
import { E, project } from '../lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const sfx = ['rifle', 'plasma', 'explosion', 'hit', 'die_human', 'die_alien', 'step', 'click', 'select', 'confirm', 'error', 'endturn', 'alarm', 'ack', 'built', 'cannon', 'rocket', 'spit', 'ore', 'victory', 'defeat'];
const FONTS = ['vt323/vt323-latin-400-normal.woff2', 'orbitron/orbitron-latin-900-normal.woff2', 'vt323/LICENSE'];
const input = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], confirm: ['Enter'], cancel: ['Escape'] };

export default () => ({
  name: 'X-KOM 2026',
  project: project('xkom', 'X-KOM 2026', '2d', { w: 960, h: 600, pixelArt: true, bg: '#070b18', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('XKom', { s: ['scripts/xkom.js'] })] } },
  assets: FONTS.map((f) => ({ from: `vendor/fonts/${f}`, to: `assets/fonts/${f.split('/')[1]}` })), // + everything in tools/examples/xkom/assets (copied as-is)
  files: { 'commands.txt': read('docs/commands.txt'), 'assets.md': read('docs/assets.md'), 'GUIDE.md': read('docs/GUIDE.md'), 'assets/audio/README.txt': `MUSIC (replace these files, keep names):\n  music/music_title.mp3 — title screen\n  music/music_base.mp3 — globe, HQ, research/base, campaign endings\n  music/music_game.mp3 — tactical missions, radar/shooter, Hive Strike\nSFX (.wav): ${sfx.join(', ')}.\nSee assets.md section 5 for every sound and easy swap steps.\nMusic loops. Stop/Play or reload after replacing. First touch/click enables title music and stays on title; next input plays. M/LISTEN is optional.\n` },
  readme: read('docs/README.md'),
});

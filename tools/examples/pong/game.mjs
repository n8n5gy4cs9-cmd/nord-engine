import { E, rect, text, camera2d, project, SQUARE, keys } from '../lib.mjs';

export default () => ({
  name: 'Pong',
  project: project('pong', 'Pong', '2d', { input: keys({ p2up: ['KeyI'], p2down: ['KeyK'] }) }),
  scenes: { main: { entities: [
    camera2d(320, 180),
    ...Array.from({ length: 12 }, (_, i) => rect(`Dash${i}`, 320, 16 + i * 30, 4, 16, '#4c566a', { z: -1 })),
    rect('P1', 24, 180, 10, 64, '#88c0d0'), rect('P2', 616, 180, 10, 64, '#ebcb8b'), rect('Ball', 320, 180, 10, 10, '#eceff4'),
    text('Score', 320, 28, '0   0', { size: 32 }),
    E('Game', { s: [['scripts/pong.js', {}], 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  lib: ['ui-gameover', 'util-sfx'], assets: SQUARE,
  readme: '# Pong\nW/S or arrows move the left paddle. Second player: I/K (set `twoPlayer` on the Game entity), otherwise the right paddle is an AI. First to 7 wins.\nShows: attributes, global events (`hit`, `pickup`, `game:win`, `game:over`) feeding library scripts (`ui-gameover`, `util-sfx`).\n',
});

import { E, rect, text, camera2d, project, SQUARE, keys } from '../lib.mjs';

export default () => ({
  name: 'Breakout',
  project: project('breakout', 'Breakout', '2d', {}),
  scenes: { main: { entities: [
    camera2d(320, 180),
    rect('Paddle', 320, 340, 70, 10, '#88c0d0'), rect('Ball', 320, 320, 8, 8, '#eceff4'),
    text('Info', 320, 190, 'Press SPACE to launch', { size: 18, color: '#d8dee9' }),
    E('Game', { s: [['scripts/breakout.js', {}], 'scripts/score.js', 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  lib: ['score', 'ui-gameover', 'util-sfx'], assets: SQUARE,
  readme: '# Breakout\nA/D or arrows move the paddle, Space launches. Bricks are spawned by `scripts/breakout.js`; points use the library `gameplay.score` (combo multiplier!). 3 lives.\n',
});

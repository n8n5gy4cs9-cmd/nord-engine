import { E, rect, circle, text, camera2d, project, SQUARE, keys } from '../lib.mjs';

export default () => ({
  name: 'Space Shooter',
  project: project('space-shooter', 'Space Shooter', '2d', { bg: '#0b0e18', input: keys({ fire: ['Space', 'Mouse0'] }) }),
  scenes: { main: { entities: [
    camera2d(320, 180),
    ...Array.from({ length: 40 }, (_, i) => rect(`Star${i}`, (i * 97) % 640, (i * 53) % 360, 2, 2, '#d8dee9', { z: -5, alpha: 0.3 + (i % 5) / 10 })),
    E('Player', { pos: [60, 180, 5], tags: ['player'], c: [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [22, 14], tint: '#88c0d0' }] }),
    E('Game', { s: [['scripts/shooter.js', {}], 'scripts/score.js', 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  lib: ['score', 'ui-gameover', 'util-sfx'], assets: SQUARE,
  template: { id: 'shooter', title: 'Shooter (Space)', description: 'Side-scrolling shooter: player ship, bullets, waves of enemies, score and game over.' },
  readme: '# Space shooter\nWASD/arrows move, Space or click fires. Enemies come in waves; three lives. Uses `gameplay.score` and `ui.game-over` from the library.\n',
});

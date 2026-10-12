import { E, rect, text, camera2d, project, SQUARE } from '../lib.mjs';

export default () => ({
  name: 'Endless Runner',
  project: project('runner', 'Endless Runner', '2d', { bg: '#5b8db8', input: { jump: ['Space', 'ArrowUp', 'KeyW', 'Mouse0'], down: ['ArrowDown', 'KeyS'] } }),
  scenes: { main: { entities: [
    camera2d(320, 180),
    rect('Ground', 320, 330, 640, 60, '#4c7a4a', { z: 1 }),
    rect('Runner', 90, 290, 22, 30, '#ebcb8b', { z: 5, tags: ['player'] }),
    E('Game', { s: [['scripts/runner.js', {}], 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  lib: ['ui-gameover', 'util-sfx'], assets: SQUARE,
  template: { id: 'runner', title: 'Endless runner', description: 'Auto-running character with jump/duck, obstacles, speed ramp and distance score.' },
  readme: '# Endless runner\nSpace/click to jump, Down to duck. Speed increases over time; high score is saved with the project save store.\n',
});

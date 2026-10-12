import { E, rect, circle, text, camera2d, project, SQUARE } from '../lib.mjs';

export default () => ({
  name: 'Flappy',
  project: project('flappy', 'Flappy', '2d', { bg: '#4a90b0', input: { jump: ['Space', 'ArrowUp', 'KeyW', 'Mouse0'] } }),
  scenes: { main: { entities: [
    camera2d(320, 180),
    rect('Ground', 320, 350, 640, 20, '#a3825c', { z: 5 }),
    circle('Bird', 150, 180, 20, '#ebcb8b', { z: 10 }),
    E('Game', { s: [['scripts/flappy.js', {}], 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  lib: ['ui-gameover', 'util-sfx'], assets: SQUARE,
  template: { id: 'endless-runner', title: 'Endless one-button (Flappy)', description: 'Scrolling obstacles, one-button control, score and restart.' },
  readme: '# Flappy\nSpace / click to flap. Pipes are spawned and scrolled by `scripts/flappy.js`; collisions are plain AABB checks (no physics engine needed).\n',
});

import { E, rect, circle, text, project, C, A, sys, EV, setv, addv, V, group, comment, with_, prefab, sqr, cir, col, SHARED_ASSETS } from '../es-lib.mjs';

export default () => {
  const player = with_(rect('Player', 320, 180, 22, 14, '#88c0d0', { z: 5, tags: ['player'], c: [col(18, 18)] }), { behaviors: [{ type: 'EightDirection', properties: { maxSpeed: 190 } }, { type: 'BoundToLayout' }] });
  const events = [
    comment('Top-down shooter — events only. WASD moves, the mouse aims, click shoots. Everything below is editable in the Event sheets tab.'),
    V('score'), V('lives', 3), V('over'),
    group('Aim and shoot', [
      EV([sys('every-tick')], [A('Player', 'set-angle', { angle: 'angle(Player.X, Player.Y, Mouse.X, Mouse.Y)' })]),
      EV([C('Mouse', 'on-click'), sys('compare-variable', { variable: 'over', comparison: '=', value: '0' })], [
        A('System', 'create-object', { object: 'Bullet', layer: '0', x: 'Player.X', y: 'Player.Y' }),
        A('Bullet', 'set-angle-of-motion', { angle: 'Player.Angle' }, { behavior: 'Bullet' }),
        A('Bullet', 'set-angle', { angle: 'Player.Angle' }),
        A('Audio', 'play', { file: '"assets/audio/sfx/shoot.wav"', loop: '"once"' }),
      ]),
    ]),
    group('Enemies', [
      EV([sys('every-x-seconds', { seconds: '0.9' }), sys('compare-variable', { variable: 'over', comparison: '=', value: '0' })], [
        A('System', 'create-object', { object: 'Enemy', layer: '0', x: 'choose(-10, 650)', y: 'random(0, 360)' }),
      ]),
      EV([C('Enemy', 'compare-x', { comparison: '>', value: '-1000' })], [
        A('Enemy', 'move-at-angle', { angle: 'angle(Enemy.X, Enemy.Y, Player.X, Player.Y)', distance: '70 * dt + score * 0.05' }),
      ]),
    ]),
    group('Hits', [
      EV([C('Bullet', 'is-overlapping', { object: 'Enemy' })], [addv('score', '1'), A('Enemy', 'destroy'), A('Bullet', 'destroy'), A('Audio', 'play', { file: '"assets/audio/sfx/explosion_small.wav"', loop: '"once"' })]),
      EV([C('Enemy', 'is-overlapping', { object: 'Player' })], [addv('lives', '-1'), A('Enemy', 'destroy'), A('Audio', 'play', { file: '"assets/audio/sfx/hurt.wav"', loop: '"once"' })]),
    ]),
    group('Game over', [
      EV([sys('compare-variable', { variable: 'lives', comparison: '<=', value: '0' }), sys('compare-variable', { variable: 'over', comparison: '=', value: '0' })], [setv('over', '1'), A('Message', 'set-text', { text: '"GAME OVER   Score " & score & "   (click to restart)"' }), A('Player', 'set-enabled', { state: 'disabled' }, { behavior: 'EightDirection' })]),
      EV([C('Mouse', 'on-click'), sys('compare-variable', { variable: 'over', comparison: '=', value: '1' })], [A('System', 'restart-layout')]),
    ]),
    EV([sys('every-tick')], [A('Hud', 'set-text', { text: '"Score " & score & "    Lives " & lives' })]),
  ];
  return {
    name: 'Top-down shooter (event sheet)',
    project: project('es-topdown-shooter', 'Top-down Shooter', '2d', { bg: '#2b303b', physics: { engine: 'arcade', gravity: [0, 0, 0] } }),
    scenes: { main: { settings: { eventSheet: 'events/main.events.json' }, entities: [
      rect('Floor', 320, 180, 640, 360, '#3b4252', { z: -10 }),
      player,
      text('Hud', 100, 18, '', { size: 14 }), text('Message', 320, 180, '', { size: 22, color: '#ebcb8b' }),
      text('Help', 320, 345, 'WASD move   mouse aim   click shoot', { size: 10, color: '#d8dee9' }),
    ] } },
    prefabs: {
      'prefabs/bullet.prefab.json': prefab('Bullet', [sqr(10, 4, '#ebcb8b'), col(8, 6)], [{ type: 'Bullet', properties: { speed: 460, setAngle: false } }, { type: 'DestroyOutsideLayout', properties: { margin: 30 } }]),
      'prefabs/enemy.prefab.json': prefab('Enemy', [circle('x', 0, 0, 18, '#bf616a').components[0], col(16, 16)], [], ['enemy']),
    },
    files: { 'events/main.events.json': { format: 1, name: 'main', events } },
    assets: [...SHARED_ASSETS, 'assets/audio/sfx/shoot.wav', 'assets/audio/sfx/explosion_small.wav', 'assets/audio/sfx/hurt.wav'],
    template: { id: 'es-topdown-shooter', title: 'Top-down shooter (event sheet)', description: 'WASD + mouse aim, bullets, chasing enemies, score and lives — no scripts, all event sheet + behaviors.' },
    readme: '# Top-down shooter (event sheet)\nWASD moves (EightDirection behavior), the mouse aims, click shoots. Enemies spawn every 0.9 s and chase you; get hit 3 times and click to restart.\nOpen the **Event sheets** tab to read and change the rules; `prefabs/` holds Bullet and Enemy. Placeholder art (square/circle sprites).\n',
  };
};

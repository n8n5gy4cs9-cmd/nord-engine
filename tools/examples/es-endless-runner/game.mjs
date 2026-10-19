import { E, rect, text, project, C, A, sys, EV, setv, addv, V, group, comment, with_, prefab, sqr, col, SHARED_ASSETS } from '../es-lib.mjs';

export default () => {
  const events = [
    comment('Endless runner — events only. Space / click / W jumps. Obstacles spawn on a timer and move left; hit one and press jump to retry.'),
    V('score'), V('over'), V('speed', 230),
    group('Run', [
      EV([sys('every-x-seconds', { seconds: '1.3' }), sys('compare-variable', { variable: 'over', comparison: '=', value: '0' })], [
        A('System', 'create-object', { object: 'Obstacle', layer: '0', x: '660', y: '300' }),
        A('Obstacle', 'set-angle-of-motion', { angle: '180' }, { behavior: 'Bullet' }),
        A('Obstacle', 'set-speed', { value: 'speed' }, { behavior: 'Bullet' }),
      ]),
      EV([sys('every-tick'), sys('compare-variable', { variable: 'over', comparison: '=', value: '0' })], [addv('score', 'dt * 10'), setv('speed', '230 + score * 0.6')]),
    ]),
    group('Crash', [
      EV([C('Runner', 'is-overlapping', { object: 'Obstacle' }), sys('compare-variable', { variable: 'over', comparison: '=', value: '0' })], [
        setv('over', '1'), A('Message', 'set-text', { text: '"CRASH!   Distance " & floor(score) & " m   (jump to retry)"' }),
        A('Obstacle', 'set-speed', { value: '0' }, { behavior: 'Bullet' }), A('Audio', 'play', { file: '"assets/audio/sfx/hurt.wav"', loop: '"once"' }),
      ]),
      EV([C('Input', 'on-action-pressed', { action: 'jump' }), sys('compare-variable', { variable: 'over', comparison: '=', value: '1' })], [A('System', 'restart-layout')]),
    ]),
    EV([sys('every-tick')], [A('Hud', 'set-text', { text: '"Distance " & floor(score) & " m"' })]),
  ];
  return {
    name: 'Endless runner (event sheet)',
    project: project('es-endless-runner', 'Endless Runner', '2d', { bg: '#5b8db8', physics: { engine: 'arcade', gravity: [0, 0, 0] }, input: { jump: ['Space', 'ArrowUp', 'KeyW', 'Mouse0'] } }),
    scenes: { main: { settings: { eventSheet: 'events/main.events.json' }, entities: [
      with_(rect('Ground', 320, 330, 640, 60, '#4c7a4a', { z: 1, c: [col(640, 60)] }), { behaviors: [{ type: 'Solid' }] }),
      with_(rect('Runner', 90, 290, 22, 30, '#ebcb8b', { z: 5, tags: ['player'], c: [col(20, 30)] }), { behaviors: [{ type: 'Platform', properties: { maxSpeed: 0, jumpStrength: 560, gravity: 1500 } }] }),
      text('Hud', 90, 18, '', { size: 14 }), text('Message', 320, 150, '', { size: 22, color: '#2e3440' }),
    ] } },
    prefabs: { 'prefabs/obstacle.prefab.json': prefab('Obstacle', [sqr(24, 34, '#bf616a'), col(22, 32)], [{ type: 'Bullet', properties: { speed: 230, setAngle: false } }, { type: 'DestroyOutsideLayout', properties: { margin: 40 } }], ['hazard']) },
    files: { 'events/main.events.json': { format: 1, name: 'main', events } },
    assets: [...SHARED_ASSETS, 'assets/audio/sfx/hurt.wav'],
    template: { id: 'es-endless-runner', title: 'Endless runner (event sheet)', description: 'Auto-run, jump over obstacles, speed ramp, distance score — event sheet + Platform/Bullet behaviors only.' },
    readme: '# Endless runner (event sheet)\nSpace / W / click jumps (Platform behavior, extra speed comes from the Obstacle bullets moving left). Obstacles spawn every 1.3 s, speed ramps with distance. Jump after a crash to retry.\n',
  };
};

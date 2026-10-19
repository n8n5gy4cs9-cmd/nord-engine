import { E, rect, text, project, C, A, sys, EV, setv, addv, V, group, comment, with_, SHARED_ASSETS } from '../es-lib.mjs';

const N = 5, S = 52, X0 = 320 - ((N - 1) * S) / 2, Y0 = 190 - ((N - 1) * S) / 2;

export default () => {
  const tiles = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) tiles.push({ ...rect('Tile', X0 + c * S, Y0 + r * S, S - 6, S - 6, '#ebcb8b', { z: 2, tags: ['tile'] }), vars: { on: 0 } });
  const near = 'abs(Tile.X - cx) + abs(Tile.Y - cy) <= ' + (S + 2);
  const toggleNeighbours = EV([sys('pick-all', { object: 'Tile' }), sys('pick-by-evaluate', { object: 'Tile', expression: near })], [A('Tile', 'toggle-boolean-instance-var', { variable: 'on' })]);
  const events = [
    comment('Lights Out — click a tile to flip it and its neighbours; turn every light off. The puzzle is shuffled by making random clicks, so it is always solvable.'),
    V('cx'), V('cy'), V('moves'), V('lit'), V('won'),
    group('Setup', [
      EV([sys('on-start-of-layout')], [setv('won', '0')], [
        EV([sys('repeat', { count: '12' }), sys('pick-random-instance', { object: 'Tile' })], [setv('cx', 'Tile.X'), setv('cy', 'Tile.Y')], [toggleNeighbours]),
      ]),
    ]),
    group('Play', [
      EV([C('Mouse', 'on-click'), sys('compare-variable', { variable: 'won', comparison: '=', value: '0' }), sys('pick-by-evaluate', { object: 'Tile', expression: 'abs(Tile.X - Mouse.X) < ' + (S / 2) + ' && abs(Tile.Y - Mouse.Y) < ' + (S / 2) })],
        [setv('cx', 'Tile.X'), setv('cy', 'Tile.Y'), addv('moves', '1'), A('Audio', 'play', { file: '"assets/audio/sfx/click.wav"', loop: '"once"' })], [toggleNeighbours]),
      EV([C('Mouse', 'on-click'), sys('compare-variable', { variable: 'won', comparison: '=', value: '1' })], [A('System', 'restart-layout')]),
    ]),
    group('Look', [
      EV([C('Tile', 'compare-instance-var', { variable: 'on', comparison: '=', value: '1' })], [A('Tile', 'set-opacity', { opacity: '100' })]),
      EV([C('Tile', 'compare-instance-var', { variable: 'on', comparison: '=', value: '0' })], [A('Tile', 'set-opacity', { opacity: '18' })]),
    ]),
    group('Win', [
      EV([sys('every-tick')], [setv('lit', '0')], [EV([C('Tile', 'compare-instance-var', { variable: 'on', comparison: '=', value: '1' })], [setv('lit', 'Tile.Count')])]),
      EV([sys('compare-variable', { variable: 'lit', comparison: '=', value: '0' }), sys('compare-variable', { variable: 'moves', comparison: '>', value: '0' }), sys('compare-variable', { variable: 'won', comparison: '=', value: '0' })], [setv('won', '1'), A('Message', 'set-text', { text: '"Solved in " & moves & " moves!  (click to play again)"' })]),
    ]),
    EV([sys('every-tick')], [A('Hud', 'set-text', { text: '"Moves " & moves & "    Lights on " & lit' })]),
  ];
  return {
    name: 'Lights Out puzzle (event sheet)',
    project: project('es-lights-out', 'Lights Out', '2d', { bg: '#2e3440', physics: { engine: 'none', gravity: [0, 0, 0] }, input: {} }),
    scenes: { main: { settings: { eventSheet: 'events/main.events.json' }, entities: [...tiles, text('Hud', 320, 18, '', { size: 16 }), text('Message', 320, 345, '', { size: 18, color: '#ebcb8b' })] } },
    files: { 'events/main.events.json': { format: 1, name: 'main', events } },
    assets: [...SHARED_ASSETS, 'assets/audio/sfx/click.wav'],
    template: { id: 'es-lights-out', title: 'Lights Out puzzle (event sheet)', description: 'Grid puzzle with instance variables, picking by expression and a solvable shuffle — pure event sheet.' },
    readme: '# Lights Out (event sheet)\nClick a tile to flip it and the tiles next to it; switch all lights off. Shows instance variables (`on`), picking with *Pick by evaluate*, sub-events inside a *Repeat* loop, and a win check. No scripts.\n',
  };
};

import { E, circle, rect, text, camera2d, project } from '../lib.mjs';
import { GraphBuilder } from './graph-build.mjs';

// ── graphs/player.graph.json: move with the keys, collect coins, update the HUD, show "You win!" ──
const player = (() => {
  const g = new GraphBuilder({ score: { default: 0 } });
  // 1) On Update → Move By (direction × speed × dt)
  const up = g.node('event/update', [40, 40]), dir = g.node('input/vec', [40, 230]), spd = g.node('math/mul', [290, 300], { a: 0, b: 180 });
  const scl = g.node('vec/scale', [540, 230]), mv = g.node('entity/translate', [800, 40]);
  g.link(up, 'then', mv, 'exec').link(up, 'dt', spd, 'a').link(dir, 'vec', scl, 'vec').link(spd, 'result', scl, 'scale').link(scl, 'result', mv, 'delta');
  // 2) every frame: for each coin closer than 22 px → pick it up
  const coins = g.node('entity/find-tag', [40, 480], { tag: 'coin' }), each = g.node('flow/foreach', [290, 480]);
  const mePos = g.node('entity/get-pos', [40, 660]), coinPos = g.node('entity/get-pos', [40, 810]), dist = g.node('vec/distance', [290, 700]);
  const near = g.node('logic/compare', [540, 700], { op: '<', b: 22 }), br = g.node('flow/branch', [560, 480]);
  const kill = g.node('entity/destroy', [820, 480]), add = g.node('var/add', [1080, 480], { name: 'score', amount: 1 });
  const snd = g.node('audio/play', [1080, 700], { clip: 'assets/audio/sfx/click.wav' }), ui = g.node('ui/set-var', [1340, 480], { screen: 'hud', name: 'score' });
  const sc = g.node('var/get', [1080, 900], { name: 'score' }), won = g.node('logic/compare', [1340, 900], { op: '>=', b: 5 }), br2 = g.node('flow/branch', [1600, 480]);
  const show = g.node('ui/set-prop', [1860, 480], { screen: 'hud', node: 'win', property: 'visible', value: true });
  g.link(up, 'then', each, 'exec').link(coins, 'entities', each, 'array').link(each, 'body', br, 'exec').link(each, 'item', coinPos, 'entity')
    .link(mePos, 'pos', dist, 'a').link(coinPos, 'pos', dist, 'b').link(dist, 'distance', near, 'a').link(near, 'result', br, 'condition')
    .link(br, 'then', kill, 'exec').link(each, 'item', kill, 'entity').link(kill, 'then', add, 'exec').link(add, 'then', snd, 'exec').link(snd, 'then', ui, 'exec')
    .link(add, 'value', ui, 'value').link(sc, 'value', won, 'a').link(won, 'result', br2, 'condition').link(ui, 'then', br2, 'exec').link(br2, 'then', show, 'exec');
  return g.toJSON();
})();

// ── graphs/game.graph.json (scene-level): load the HUD, restart button ──
const scene = (() => {
  const g = new GraphBuilder();
  const start = g.node('event/start', [40, 40]), load = g.node('ui/load', [300, 40], { file: 'ui/hud.ui.json' });
  const zero = g.node('ui/set-var', [560, 40], { screen: 'hud', name: 'score', value: 0 });
  g.link(start, 'then', load, 'exec').link(load, 'then', zero, 'exec');
  const rs = g.node('event/ui', [40, 260], { action: 'restart' }), restart = g.node('game/restart', [300, 260]);
  g.link(rs, 'then', restart, 'exec');
  return g.toJSON();
})();

const hud = {
  version: 1, name: 'hud', skin: 'assets/ui/skin/pixel.skin.json', theme: {},
  root: { type: 'panel', name: 'root', anchor: 'fill', style: { background: 'none', border: 'none', boxShadow: 'none', padding: 0 }, children: [
    { type: 'label', name: 'score', text: 'Coins: {score}', anchor: 'tl', x: 16, y: 12, size: 26, bold: true },
    { type: 'label', name: 'help', text: 'Arrow keys / WASD to move · collect 5 coins', anchor: 'bl', x: 16, y: -12, size: 15 },
    { type: 'vbox', name: 'win', anchor: 'c', gap: 12, visible: false, class: 'card', style: { padding: 24, alignItems: 'center' }, children: [
      { type: 'label', name: 'winText', text: 'You win!', class: 'title', size: 40 },
      { type: 'button', name: 'restart', text: 'Play again', on: { pressed: 'restart' } },
    ] },
  ] },
};

const coinsAt = [[120, 80], [520, 70], [80, 280], [300, 300], [560, 290], [430, 150], [200, 170], [330, 60]];
export default () => ({
  name: 'Node Graph: Coin Collector',
  project: project('nodegraph-coins', 'Node Graph: Coin Collector', '2d', { bg: '#1d2733', input: undefined }),
  scenes: {
    main: {
      settings: { graphs: ['graphs/game.graph.json'] },
      entities: [
        camera2d(320, 180),
        rect('Background', 320, 180, 640, 360, '#243447', { z: -10 }),
        E('Player', { pos: [320, 180, 0], c: [{ type: 'sprite', texture: 'assets/sprites/circle.png', size: [28, 28], tint: '#88c0d0' }, { type: 'graph', file: 'graphs/player.graph.json' }] }),
        ...coinsAt.map(([x, y], i) => circle(`Coin ${i + 1}`, x, y, 16, '#ebcb8b', { tags: ['coin'] })),
        text('Title', 320, 24, 'Node Graph demo', { size: 14, color: '#7a9caa' }),
      ],
    },
  },
  files: { 'graphs/player.graph.json': player, 'graphs/game.graph.json': scene, 'ui/hud.ui.json': hud },
  assets: [...['panel.png', 'button.png', 'button-hover.png', 'button-down.png', 'button-danger.png', 'bar-back.png', 'field.png', 'pixel.skin.json'].map((f) => ({ from: `assets/ui/skin/${f}`, to: `assets/ui/skin/${f}` })),
    { from: 'assets/particles/square.png', to: 'assets/sprites/square.png' }, { from: 'assets/particles/circle.png', to: 'assets/sprites/circle.png' }],
  template: { id: 'nodegraph-coins', title: 'Node graph: coin collector', description: 'Visual scripting demo: movement, coin pickup, score HUD and a win screen built only from graphs/*.graph.json and ui/hud.ui.json.' },
  readme: '# Node Graph: Coin Collector\nNo scripts. Open the **Graph** tab and edit `graphs/player.graph.json` (movement + coin pickup) and `graphs/game.graph.json` (loads the HUD). The HUD is `ui/hud.ui.json` (UI Designer) with the sample pixel skin.\nArrow keys / WASD move; collect 5 coins.\n',
});

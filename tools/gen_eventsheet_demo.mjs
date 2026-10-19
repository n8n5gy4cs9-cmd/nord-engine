#!/usr/bin/env node
// Generates examples/event-sheets (a platformer made ONLY from an event sheet + behaviors — no JS scripts). Re-runnable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../examples/event-sheets');
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), JSON.stringify(o, null, 2) + '\n'); };

w('nord.project.json', {
  format: 1, name: 'Event Sheet Platformer', id: 'com.crowelian.eventsheets', type: '2d', engineVersion: '0.1.0', startScene: 'scenes/main.scene.json',
  display: { width: 640, height: 360, scale: 'fit', pixelArt: true, background: '#2e3440' },
  physics: { engine: 'arcade', gravity: [0, 0, 0] },
  input: { actions: { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['Space', 'KeyW', 'ArrowUp'] } },
  plugins: ['ui', 'audio'],
});
w('index.html', null); fs.writeFileSync(path.join(root, 'index.html'), fs.readFileSync(path.join(root, '../light2d/index.html'), 'utf8').replace('Crypt of Embers', 'Event Sheet Platformer'));

let n = 0;
const id = () => 'e' + String(++n).padStart(7, '0');
const box = (name, x, y, ww, hh, tint, behaviors = [], tags = []) => ({
  id: id(), name, enabled: true, tags, layer: 0, transform: { pos: [x, y, 1], rot: [0, 0, 0], scale: [1, 1, 1] },
  components: [{ type: 'sprite', texture: 'assets/sprites/items/crate.png', tint, size: [ww, hh] }, { type: 'collider', shape: 'box', size: [ww, hh] }], scripts: [], behaviors, children: [], prefab: null,
});
const anim = (name, x, y, texture, a, csize, behaviors = [], tags = [], extra = {}) => ({
  id: id(), name, enabled: true, tags, layer: 0, transform: { pos: [x, y, 2], rot: [0, 0, 0], scale: [1, 1, 1] },
  components: [{ type: 'animatedSprite', texture, anim: a }, { type: 'collider', shape: 'box', size: csize, offset: [0, 2] }], scripts: [], behaviors, children: [], prefab: null, ...extra,
});
const text = (name, x, y, t, size, color) => ({ id: id(), name, enabled: true, tags: [], layer: 1, transform: { pos: [x, y, 10], rot: [0, 0, 0], scale: [1, 1, 1] }, components: [{ type: 'text', text: t, size, color, stroke: '#2e3440', strokeThickness: 3, bold: true }], scripts: [], children: [], prefab: null });

const entities = [
  { id: id(), name: 'Sky', enabled: true, tags: [], layer: 0, transform: { pos: [0, 0, -100], rot: [0, 0, 0], scale: [1, 1, 1] }, components: [{ type: 'parallax', texture: 'assets/sprites/backgrounds/bg_sky.png', factor: [0, 0] }], scripts: [], children: [], prefab: null },
  box('Ground', 320, 345, 640, 30, '#4c566a', [{ type: 'Solid' }]),
  box('Ledge', 230, 250, 90, 12, '#5e81ac', [{ type: 'Solid' }]),
  box('Cloud platform', 370, 205, 100, 8, '#88c0d0', [{ type: 'Jumpthru' }]),
  box('High ledge', 540, 150, 120, 12, '#5e81ac', [{ type: 'Solid' }]),
  anim('Hero', 48, 314, 'assets/sprites/hero.png', 'idle', [14, 28], [{ type: 'Platform', properties: { maxSpeed: 200, jumpStrength: 560, gravity: 1400, doubleJump: true } }, { type: 'BoundToLayout' }], ['player']),
  anim('Slime', 330, 314, 'assets/sprites/enemy_slime.png', 'idle', [24, 20], [{ type: 'Sine', properties: { movement: 'horizontal', period: 5, magnitude: 90 } }], ['enemy']),
  anim('Slime', 520, 314, 'assets/sprites/enemy_slime.png', 'idle', [24, 20], [{ type: 'Sine', properties: { movement: 'horizontal', period: 3, magnitude: 40, phase: 90 } }], ['enemy']),
  { ...anim('Turret', 600, 60, 'assets/sprites/enemy_robot.png', 'walk', [24, 24], [{ type: 'Turret', properties: { targetType: 'Hero', range: 700, rotateSpeed: 90, rateOfFire: 0.6, requireLineOfSight: true } }]) },
  anim('Flag', 560, 128, 'assets/sprites/flag.png', 'wave', [14, 28]),
  anim('Star', 40, 60, 'assets/sprites/items/star.png', undefined, [14, 14], [{ type: 'Rotate', properties: { speed: 90 } }, { type: 'DragDrop' }, { type: 'Sine', properties: { movement: 'value-only' } }]),
  text('Hud', 110, 18, '', 14, '#eceff4'),
  text('Message', 320, 180, '', 22, '#ebcb8b'),
  text('Help', 320, 345, 'A/D or arrows: move   Space: jump (twice!)   drag the star with the mouse', 10, '#d8dee9'),
];
for (const [x, y] of [[230, 230], [370, 185], [540, 130], [200, 314], [440, 314], [95, 240]])
  entities.push({ ...anim('Coin', x, y, 'assets/sprites/coin.png', 'spin', [12, 12], [{ type: 'Sine', properties: { movement: 'vertical', period: 1.4, magnitude: 3, randomizePhase: true } }], ['pickup']) });
// the Star has no animation: make it a plain sprite
const star = entities.find((e) => e.name === 'Star'); star.components[0] = { type: 'sprite', texture: 'assets/sprites/items/star.png', size: [28, 28] }; star.components[1].size = [28, 28]; star.components[1].offset = [0, 0];
star.behaviors = star.behaviors.filter((b) => b.type !== 'Sine');

w('scenes/main.scene.json', { format: 1, name: 'main', settings: { ambient: '#ffffff', eventSheet: 'events/main.events.json' }, entities });
w('prefabs/bullet.prefab.json', { format: 1, root: {
  id: 'bullet001', name: 'Bullet', enabled: true, tags: ['hazard'], layer: 0, transform: { pos: [0, 0, 3], rot: [0, 0, 0], scale: [1, 1, 1] },
  components: [{ type: 'sprite', texture: 'assets/sprites/items/bullet.png', size: [12, 12] }, { type: 'collider', shape: 'box', size: [8, 8] }], scripts: [],
  behaviors: [{ type: 'Bullet', properties: { speed: 200, setAngle: true } }, { type: 'DestroyOutsideLayout', properties: { margin: 20 } }], children: [], prefab: null } });

// ---------- the event sheet ----------
const C = (object, id, params, extra) => ({ object, id, params, ...extra });
const P = (id, params, extra) => C('Hero', id, params, { behavior: 'Platform', ...extra });
const A = (object, id, params, extra) => ({ object, id, params, ...extra });
const sys = (id, params) => C('System', id, params);
const E = (conditions, actions, children, extra) => ({ type: 'event', conditions, actions, ...(children ? { children } : {}), ...extra });
const respawn = [A('Hero', 'set-position', { x: '48', y: '314' }), A('Hero', 'set-vector-y', { value: '0' }, { behavior: 'Platform' }), A('Hero', 'set-vector-x', { value: '0' }, { behavior: 'Platform' })];

w('events/main.events.json', { format: 1, name: 'main', events: [
  { type: 'comment', text: 'Event Sheet Platformer — everything here is events + behaviors. No scripts.' },
  { type: 'variable', name: 'coins', valueType: 'number', value: 0 },
  { type: 'variable', name: 'lives', valueType: 'number', value: 3 },
  { type: 'variable', name: 'won', valueType: 'number', value: 0 },
  { type: 'group', title: 'Hero animation', active: true, children: [
    E([P('is-jumping'), P('is-falling')], [A('Hero', 'set-animation', { animation: '"jump"' })], undefined, { block: 'or' }),
    E([sys('else'), P('is-moving')], [A('Hero', 'set-animation', { animation: '"walk"' })]),
    E([sys('else')], [A('Hero', 'set-animation', { animation: '"idle"' })]),
    E([sys('every-tick')], [A('Hero', 'set-mirrored', { mirrored: 'Hero.Platform.Facing < 0' })]),
  ] },
  { type: 'group', title: 'Coins', active: true, children: [
    E([C('Hero', 'is-overlapping', { object: 'Coin' })], [A('System', 'add-to-var', { variable: 'coins', value: '1' }), A('Audio', 'play', { file: '"assets/audio/sfx/coin.wav"', loop: '"once"' }), A('Coin', 'destroy')]),
  ] },
  { type: 'group', title: 'Danger', active: true, children: [
    E([C('Hero', 'is-overlapping', { object: 'enemy' }), sys('trigger-once-while-true')], [A('System', 'subtract-from-var', { variable: 'lives', value: '1' }), ...respawn]),
    E([C('Hero', 'is-overlapping', { object: 'Bullet' })], [A('System', 'subtract-from-var', { variable: 'lives', value: '1' }), A('Bullet', 'destroy'), ...respawn]),
    E([C('Hero', 'compare-y', { comparison: '>', value: '420' })], [A('System', 'subtract-from-var', { variable: 'lives', value: '1' }), ...respawn]),
    E([sys('compare-variable', { variable: 'lives', comparison: '<=', value: '0' })], [A('System', 'restart-layout')]),
  ] },
  { type: 'group', title: 'Turret', active: true, children: [
    E([C('Turret', 'on-shoot', undefined, { behavior: 'Turret' })], [
      A('System', 'create-object', { object: 'Bullet', layer: '0', x: 'Turret.X', y: 'Turret.Y' }),
      A('Bullet', 'set-angle-of-motion', { angle: 'Turret.Angle' }, { behavior: 'Bullet' }),
    ]),
  ] },
  { type: 'group', title: 'Win', active: true, children: [
    E([C('Hero', 'is-overlapping', { object: 'Flag' }), sys('compare-variable', { variable: 'won', comparison: '=', value: '0' })], [
      A('System', 'set-var', { variable: 'won', value: '1' }), A('Message', 'set-text', { text: '"You win!  Coins: " & coins' }),
      A('Hero', 'set-enabled', { state: 'disabled' }, { behavior: 'Platform' }),
    ]),
  ] },
  E([sys('every-tick')], [A('Hud', 'set-text', { text: '"Coins " & coins & "   Lives " & lives' })]),
] });
// make the example self-contained (exports validate against the project folder): copy every engine asset the files reference
const engineRoot = path.resolve(root, '../..');
const seen = new Set();
const scan = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) { if (f.name !== 'assets') scan(p); } else if (/\.json$/.test(f.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/assets\/[\w\-./]+\.(?:png|wav|ogg|mp3)/g)) seen.add(m[0]); } };
scan(root);
for (const a of seen) for (const f of [a, `${a}.meta.json`]) { const src = path.join(engineRoot, f), dst = path.join(root, f); if (fs.existsSync(src) && !fs.existsSync(dst)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); } }
console.log('wrote', root, `(+${seen.size} engine assets)`);

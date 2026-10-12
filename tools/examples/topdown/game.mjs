import { E, rect, circle, text, camera2d, project, SQUARE, keys } from '../lib.mjs';

const wall = (name, x, y, w, h) => rect(name, x, y, w, h, '#4c566a', { z: 1, tags: ['solid'], c: [{ type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [w, h] }] });
const trig = (size) => [{ type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size, trigger: true }];
export default () => ({
  name: 'Top-down Adventure',
  project: project('topdown', 'Top-down Adventure', '2d', { physics: { engine: 'arcade', gravity: [0, 0, 0] }, bg: '#2d3b2d', input: keys({ inventory: ['KeyI', 'Tab'] }) }),
  scenes: { main: { entities: [
    camera2d(320, 180, { s: [['scripts/camera-follow.js', { target: 'Hero', smoothing: 8, bounds: [0, 0, 960, 540], viewport: [640, 360] }]] }),
    rect('Floor', 480, 270, 960, 540, '#3e5a3e', { z: -5 }),
    wall('WallTop', 480, 8, 960, 16), wall('WallBottom', 480, 532, 960, 16), wall('WallLeft', 8, 270, 16, 540), wall('WallRight', 952, 270, 16, 540),
    wall('Divider1', 600, 130, 16, 260), wall('Divider2', 600, 450, 16, 180),
    rect('DoorWall', 600, 330, 16, 60, '#8b5e3c', { z: 1, tags: ['solid'], c: [{ type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [16, 60] }] }),
    E('DoorSensor', { pos: [600, 330, 0], s: [['scripts/key-door.js', { mode: 'door', key: 'key', blockers: ['DoorWall'] }]], c: trig([60, 90]) }),
    E('Hero', { pos: [80, 100, 3], tags: ['player'], s: [['scripts/topdown.js', { speed: 120 }], ['scripts/health.js', { max: 5, deathEvent: 'died' }], ['scripts/inventory.js', { slots: 12 }], 'scripts/hero-anim.js'],
      c: [{ type: 'animatedSprite', texture: 'assets/sprites/hero.png', anim: 'idle' }, { type: 'rigidbody', mode: 'dynamic', gravityScale: 0, fixedRotation: true }, { type: 'collider', shape: 'box', size: [14, 14], offset: [9, 14] }] }),
    E('Elder', { pos: [200, 180, 2], tags: ['npc'], s: [['scripts/npc.js', { node: 'elder' }]], c: [{ type: 'sprite', texture: 'assets/sprites/torch.png', size: [24, 36], tint: '#ebcb8b' }] }),
    E('Key', { pos: [760, 100, 2], tags: ['item'], s: [['scripts/item.js', { id: 'key', name: 'Rusty key', icon: '🔑' }]], c: [{ type: 'sprite', texture: 'assets/sprites/items/key.png' }, ...trig([16, 16])] }),
    ...[[300, 400], [420, 300], [800, 440]].map(([x, y], i) => E(`Gem${i}`, { pos: [x, y, 2], tags: ['coin'], s: [['scripts/pickup.js', { kind: 'score', value: 25, sfx: 'assets/audio/sfx/coin.wav' }]], c: [{ type: 'sprite', texture: 'assets/sprites/items/gem_blue.png' }, ...trig([14, 14])] })),
    E('Potion', { pos: [880, 80, 2], s: [['scripts/pickup.js', { kind: 'heal', value: 3, sfx: 'assets/audio/sfx/heal.wav' }]], c: [{ type: 'sprite', texture: 'assets/sprites/items/potion_red.png' }, ...trig([14, 14])] }),
    ...[[680, 400], [800, 300]].map(([x, y], i) => E(`Bat${i}`, { pos: [x, y, 3], tags: ['enemy'], s: [['scripts/ai-chase.js', { speed: 55, sight: 160, contactDamage: 1 }], ['scripts/enemy-hp.js', {}]], c: [{ type: 'animatedSprite', texture: 'assets/sprites/enemy_bat.png', anim: 'fly' }, { type: 'rigidbody', mode: 'dynamic', gravityScale: 0, fixedRotation: true }, { type: 'collider', shape: 'box', size: [16, 12], offset: [8, 10] }] })),
    E('Chest', { pos: [900, 480, 2], s: [['scripts/chest.js', {}]], c: [{ type: 'sprite', texture: 'assets/sprites/items/chest_closed.png' }, ...trig([40, 40])] }),
    E('Systems', { s: [['scripts/ui-hud.js', { target: 'Hero', style: 'hearts', coins: false }], ['scripts/score.js', { y: 40 }], ['scripts/dialogue.js', { file: 'assets/dialogue.json' }], 'scripts/ui-inventory.js', 'scripts/ui-toasts.js', 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  files: { 'assets/dialogue.json': { start: 'elder', nodes: {
    elder: { speaker: 'Elder', text: 'Brave one! A rusty key lies in the east room. It opens the door in the middle wall — the chest beyond holds the treasure.', next: 'hint' },
    hint: { speaker: 'Elder', text: 'Beware the bats. Press I to open your inventory.' },
    chest: { speaker: 'Chest', text: 'You found the treasure! The adventure is complete.' },
  } } },
  lib: ['topdown', 'health', 'inventory', 'dialogue', 'pickup', 'ai-chase', 'key-door', 'camera-follow', 'ui-hud', 'score', 'ui-inventory', 'ui-toasts', 'ui-gameover', 'util-sfx'],
  assets: ['assets/sprites/hero.png', 'assets/sprites/enemy_bat.png', 'assets/sprites/torch.png', 'assets/sprites/items/key.png', 'assets/sprites/items/gem_blue.png', 'assets/sprites/items/potion_red.png', 'assets/sprites/items/chest_closed.png', 'assets/audio/sfx/coin.wav', 'assets/audio/sfx/heal.wav', ...SQUARE],
  template: { id: 'topdown-adventure', title: 'Top-down adventure', description: 'Rooms, NPC dialogue, inventory, key + door, pickups, chasing enemies, HUD.' },
  readme: '# Top-down adventure\nWASD/arrows move, E talks / opens the chest / attacks, I opens the inventory. Find the key, open the door, avoid bats, reach the chest.\nLibrary scripts: `topdown`, `health`, `inventory`, `dialogue`, `pickup`, `ai-chase`, `key-door`, `camera-follow`, `ui-*`. Own scripts: `npc.js`, `item.js`, `chest.js`, `enemy-hp.js`, `hero-anim.js`.\n',
});

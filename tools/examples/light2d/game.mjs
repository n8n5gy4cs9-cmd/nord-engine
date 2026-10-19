import { E, camera2d, project, SQUARE, keys } from '../lib.mjs';

// Crypt of Embers: a dark top-down crypt lit only by what you carry. Showcases the fx.light2d library scripts (lights, cone flashlight,
// real shadows from walls/pillars/crates, flicker) AND uses the light for gameplay: shades burn in light, only seen by their eyes.
const SRC = 'assets/sprites/';
const trig = (size) => [{ type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size, trigger: true }];
const OCC = ['scripts/light2d-occluder.js', {}];
const light = (o) => ['scripts/light2d-source.js', o];

/** Stone wall: one collider + one shadow caster, dressed with 32px brick tiles. */
const wall = (name, x, y, w, h) => {
  const kids = [];
  for (let j = 0; j < h / 32; j++) for (let i = 0; i < w / 32; i++) {
    const v = 150 + ((i * 7 + j * 13 + Math.round(x + y)) % 5) * 12;
    kids.push(E(`${name}_t${i}_${j}`, { pos: [-w / 2 + 16 + i * 32, -h / 2 + 16 + j * 32, 0], c: [{ type: 'sprite', texture: SRC + 'wall.png', tint: '#' + [v, v, v].map((n) => n.toString(16).padStart(2, '0')).join('') }] }));
  }
  return E(name, { pos: [x, y, 1], tags: ['solid'], s: [OCC], kids, c: [{ type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [w, h] }] });
};
const pillar = (x, y) => E('Pillar', { pos: [x, y, 1], s: [['scripts/light2d-occluder.js', { shape: 'circle', radius: 22 }]], c: [{ type: 'sprite', texture: SRC + 'pillar.png', size: [48, 48] }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'circle', radius: 22 }] });
const crate = (x, y, tex = 'crate', n = 40) => E('Crate', { pos: [x, y, 1], s: [['scripts/light2d-occluder.js', { size: [n, n] }]], c: [{ type: 'sprite', texture: `assets/sprites/items/${tex}.png`, size: [n, n] }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [n, n] }] });
const brazier = (i, x, y) => E(`Brazier${i}`, { pos: [x, y, 1], tags: ['brazier'], s: [light({ color: '#ff8a3c', radius: 70, intensity: 0.35, falloff: 1.2, flicker: 0.3, softness: 3 }), 'scripts/brazier.js'],
  c: [{ type: 'sprite', texture: SRC + 'brazier.png', size: [36, 36] }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'circle', radius: 15 },
    { type: 'particles', texture: 'assets/sprites/circle.png', lifespan: 900, speed: [14, 46], angle: [-125, -55], scale: [0.09, 0], alpha: [0.9, 0], tint: '#ff9a40', blend: 'add', frequency: 45, gravityY: -25, emitting: false }] });
const flask = (i, x, y) => E(`Oil${i}`, { pos: [x, y, 2], tags: ['item'], s: [['scripts/pickup.js', { kind: 'custom', event: 'oil-flask', sfx: 'assets/audio/sfx/pickup.wav', bob: 2 }], light({ color: '#ffc34d', radius: 46, intensity: 0.55, falloff: 1.5, shadows: false, flicker: 0.4 })],
  c: [{ type: 'sprite', texture: 'assets/sprites/items/potion_blue.png', size: [22, 22], tint: '#ffc34d' }, ...trig([18, 18])] });
const spawn = (i, x, y) => E(`Spawn${i}`, { pos: [x, y, 0], tags: ['spawn'] });

const eyes = E('Eyes', { pos: [0, -2, 0], c: [{ type: 'sprite', texture: SRC + 'eyes.png', size: [16, 8], tint: '#ff3b30', blend: 'add' }] });
eyes.layer = 1; // layer >= 1 draws above the darkness, so the eyes glow even where the shade is unlit

export default () => ({
  name: 'Crypt of Embers',
  project: project('light2d', 'Crypt of Embers', '2d', {
    physics: { engine: 'arcade', gravity: [0, 0, 0] }, bg: '#05060c',
    input: keys({ shadows: ['KeyL'], ambient: ['KeyB'], lab: ['KeyH'], forceDown: ['BracketLeft'], forceUp: ['BracketRight'], shadowDown: ['Semicolon'], shadowUp: ['Quote'], softDown: ['Comma'], softUp: ['Period'], c1: ['Digit1'], c2: ['Digit2'], c3: ['Digit3'], c4: ['Digit4'], c5: ['Digit5'] }),
  }),
  scenes: { main: { entities: [
    camera2d(320, 180, { s: [['scripts/camera-follow.js', { target: 'Hero', smoothing: 8, bounds: [0, 0, 1280, 800], viewport: [640, 360] }]] }),
    E('Light2D', { s: [['scripts/light2d.js', { ambient: '#14172b', scale: 0.5, shadows: true, softShadows: 3, depth: 500 }]] }),
    E('Floor', { pos: [640, 400, -5], c: [{ type: 'sprite', texture: SRC + 'floor.png', size: [1280, 800] }] }),
    // outer shell
    wall('WallTop', 640, 16, 1280, 32), wall('WallBottom', 640, 784, 1280, 32), wall('WallLeft', 16, 400, 32, 800), wall('WallRight', 1264, 400, 32, 800),
    // west divider, east divider, gallery + upper-east floors, exit alcove (doorways between them)
    wall('WestA', 416, 96, 32, 128), wall('WestB', 416, 350, 32, 220), wall('WestC', 416, 664, 32, 208),
    wall('EastA', 864, 100, 32, 136), wall('EastB', 864, 384, 32, 232), wall('EastC', 864, 684, 32, 168),
    wall('GalleryA', 136, 432, 208, 32), wall('GalleryB', 373, 432, 86, 32), wall('CryptA', 940, 450, 120, 32), wall('CryptB', 1174, 450, 148, 32),
    wall('AlcoveL', 500, 100, 32, 136), wall('AlcoveR', 780, 100, 32, 136), wall('AlcoveBL', 542, 184, 116, 32), wall('AlcoveBR', 738, 184, 116, 32),
    E('Gate', { pos: [640, 184, 1], tags: ['solid'], s: [OCC], c: [{ type: 'sprite', texture: SRC + 'gate.png', size: [80, 32] }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [80, 32] }] }),
    E('Exit', { pos: [640, 100, 0], s: [light({ color: '#7fd6ff', radius: 130, intensity: 1.1, on: false, softness: 4 })], c: [{ type: 'sprite', texture: SRC + 'rune.png', size: [64, 64], tint: '#7fd6ff', blend: 'add', alpha: 0.85 }] }),
    pillar(520, 300), pillar(760, 300), pillar(520, 500), pillar(760, 500),
    crate(140, 560), crate(240, 700), crate(160, 270), crate(330, 330), crate(1000, 210), crate(1180, 570), crate(1090, 700), crate(1090, 744), crate(640, 640, 'barrel', 30), crate(600, 140, 'barrel', 30),
    brazier(1, 340, 660), brazier(2, 110, 110), brazier(3, 1100, 110), brazier(4, 1180, 700),
    flask(1, 250, 560), flask(2, 470, 130), flask(3, 1010, 620), flask(4, 150, 350), flask(5, 1180, 300), flask(6, 640, 540), flask(7, 790, 700),
    spawn(1, 200, 300), spawn(2, 700, 700), spawn(3, 1000, 330), spawn(4, 1200, 520), spawn(5, 640, 330), spawn(6, 250, 120), spawn(7, 560, 620),
    E('ShadeTemplate', { enabled: false, pos: [0, 0, 3], tags: ['enemy'], s: ['scripts/shade.js'], kids: [eyes],
      c: [{ type: 'sprite', texture: SRC + 'shade.png', size: [36, 36] }, { type: 'rigidbody', mode: 'dynamic', gravityScale: 0, fixedRotation: true }, { type: 'collider', shape: 'circle', radius: 10 }] }),
    E('Hero', { pos: [96, 700, 3], tags: ['player'], s: [['scripts/topdown.js', { speed: 120 }], ['scripts/health.js', { max: 5, deathEvent: 'died' }], 'scripts/hero-anim.js', 'scripts/lantern.js'],
      c: [{ type: 'animatedSprite', texture: 'assets/sprites/hero.png', anim: 'idle' }, { type: 'rigidbody', mode: 'dynamic', gravityScale: 0, fixedRotation: true }, { type: 'collider', shape: 'box', size: [14, 14], offset: [9, 14] }],
      kids: [
        E('Halo', { pos: [0, 0, 0], s: [light({ color: '#ffb86b', radius: 190, intensity: 0.8, falloff: 1.4, softness: 6, flicker: 0.1 })] }),
        E('Beam', { pos: [0, 0, 0], s: [light({ color: '#fff1c9', radius: 340, intensity: 0, falloff: 1.1, angle: 54, aim: 'pointer', turn: 900, softness: 4, on: false })] }),
      ] }),
    E('Systems', { s: [['scripts/crypt.js', {}], ['scripts/ui-hud.js', { target: 'Hero', style: 'hearts', coins: false }], ['scripts/score.js', { y: 40 }], 'scripts/ui-toasts.js', 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  lib: ['topdown', 'health', 'pickup', 'camera-follow', 'ui-hud', 'score', 'ui-toasts', 'ui-gameover', 'util-sfx', 'light2d', 'light2d-source', 'light2d-occluder'],
  assets: ['assets/sprites/hero.png', 'assets/sprites/items/crate.png', 'assets/sprites/items/barrel.png', 'assets/sprites/items/potion_blue.png', 'assets/audio/sfx/pickup.wav', ...SQUARE],
  readme: `# Crypt of Embers — 2D light & shadow demo
A dark crypt lit only by what you carry. Light all four braziers, collect oil, and reach the exit while **shades** hunt you in the dark.
Shades are invisible except for their eyes, sprint at you in the dark and burn up in light — but walls, pillars and crates cast real shadows, so light only hurts what it can actually reach.

**Controls:** WASD / arrows move · mouse aims the flashlight cone · hold click / Space = beam (costs oil) · E lights a brazier (15 oil) · 1-5 beam colour · L shadows on/off · B darkness level · hold [ ] light force · hold ; ' shadow strength · hold , . shadow softness · H light-lab stats.

## Reusable library scripts (copy these three files into any 2D project)
- \`light2d.js\` — put on ONE entity. **Look dials:** \`ambient\` (how dark), \`force\` (light brightness ×), \`shadowStrength\` (1 black … 0 none), \`softness\` (× each light's own softness), plus lightmap \`scale\`, \`shadows\`, \`softShadows\`. Live: \`system.setLook({ force, shadowStrength, softness, ambient })\`. Exposes \`game.light2d.lightAt(x, y)\` / \`.sample(x, y)\` for gameplay.
- \`light2d-source.js\` — on any entity (or child): point light or cone flashlight, colour, intensity, radius, falloff, flicker, soft shadows, aim = fixed / pointer / move.
- \`light2d-occluder.js\` — on walls, pillars, crates: box or circle shadow caster (size taken from the sprite/collider).
Layer ≥ 1 entities and the DOM UI draw above the darkness.

Own scripts: \`lantern.js\` (oil, beam, colours), \`brazier.js\`, \`shade.js\` (light-driven AI), \`crypt.js\` (HUD, spawns, win/lose, Light Lab keys). Art is generated by \`tools/examples/light2d/gen_art.py\`.
`,
});

// Entity data factories: the same shape a scene file stores, built in code. One place that knows what a coin or a door looks like.
const make = (name, tags, x, y, z, components, scripts = [], layer = 0) => ({
  name, tags, layer, transform: { pos: [x, y, z], rot: [0, 0, 0], scale: [1, 1, 1] }, components, scripts, children: [],
});
const img = (texture, w, h) => ({ type: 'sprite', texture, size: [w, h], tint: '#ffffff', alpha: 1 });
const body = (mode) => ({ type: 'rigidbody', mode });
const box = (w, h, trigger = false) => ({ type: 'collider', shape: 'box', size: [w, h], ...(trigger ? { trigger: true } : {}) });
const script = (path, attributes = {}) => [{ path, attributes }];
const OCCLUDER = script('scripts/light2d-occluder.js', { static: true });

export const floor = (w, h) => make('Floor', [], w / 2, 400, -5, [img('assets/sprites/floor.png', 1280, 800)]);
export const wallTile = (x, y) => make('WallTile', [], x, y, 1, [img('assets/sprites/wall.png', 32, 32)]);
/** Invisible collider that also blocks light: one per run of wall tiles. */
export const wallBody = (x, y, w, h) => make('Wall', ['solid'], x, y, 0, [body('static'), box(w, h)], OCCLUDER);
export const crate = (x, y, art) => make('Crate', ['solid'], x, y, 2, [img(`assets/sprites/items/${art}.png`, 26, 26), body('static'), box(24, 24)], OCCLUDER);
export const coin = (x, y) => make('Coin', ['coin'], x, y, 2, [{ type: 'animatedSprite', texture: 'assets/sprites/coin.png', anim: 'spin' }, body('static'), box(14, 14, true)], script('scripts/pickup.js', { kind: 'coin' }));
export const key = (x, y) => make('Key', [], x, y, 2, [img('assets/sprites/items/key.png', 20, 20), body('static'), box(16, 16, true)], script('scripts/pickup.js', { kind: 'key' }));
export const potion = (x, y) => make('Potion', [], x, y, 2, [img('assets/sprites/items/potion_red.png', 20, 20), body('static'), box(16, 16, true)], script('scripts/pickup.js', { kind: 'potion' }));
export const chest = (x, y) => make('Chest', [], x, y, 2, [img('assets/sprites/items/chest_closed.png', 28, 28), body('static'), box(24, 24, true)], script('scripts/pickup.js', { kind: 'chest' }));
export const door = (x, y) => make('Door', ['door', 'solid'], x, y, 2, [img('assets/sprites/gate.png', 32, 32), body('static'), box(32, 32)], [...script('scripts/door.js'), ...OCCLUDER]);
export const spikes = (x, y) => make('Spikes', [], x, y, 1, [img('assets/sprites/items/spikes.png', 28, 28)], script('scripts/spikes.js'));
export const brazier = (x, y) => make('Brazier', [], x, y, 2, [img('assets/sprites/brazier.png', 26, 26)],
  script('scripts/light2d-source.js', { color: '#ff9a45', radius: 120, intensity: 0.8, falloff: 1.3, softness: 4, flicker: 0.3, shadows: true }));
export const exitRune = (x, y) => make('Exit', [], x, y, 1, [img('assets/sprites/rune.png', 40, 40)],
  [...script('scripts/exit.js'), ...script('scripts/light2d-source.js', { color: '#7fd6ff', radius: 110, intensity: 0.9, falloff: 1.2, softness: 4, flicker: 0.1 })]);
export const slime = (x, y) => make('Slime', ['enemy'], x, y, 3, [{ type: 'animatedSprite', texture: 'assets/sprites/enemy_slime.png', anim: 'idle' }, body('dynamic'), box(18, 12)],
  script('scripts/enemy.js', { speed: 55, hp: 2, sight: 150, anim: 'idle', zigzag: 0 }));
export const bat = (x, y) => make('Bat', ['enemy'], x, y, 4, [{ type: 'animatedSprite', texture: 'assets/sprites/enemy_bat.png', anim: 'fly' }, body('dynamic'), box(14, 10)],
  script('scripts/enemy.js', { speed: 95, hp: 1, sight: 190, anim: 'fly', zigzag: 1 }));

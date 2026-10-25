---
title: T61 Ember Crypt: a complete game, from art to export
section: Tutorials
order: 61
summary: Build a finished dark-dungeon game with pixel art, an animated hero with a sword, bats and slimes that see you, keys and gates, real shadows, particles, sound, screen shake, a title screen, pause, saved high scores and a web export.
---
This is the capstone of the dungeon series. [T55 to T60](tut-t55-series-dungeon-1.html) built a plain dungeon out of coloured squares. Here we build a **finished game** that looks good: pixel-art tiles, an animated hero with a sword, slimes and bats that really see you (and lose you behind walls), keys and gates, braziers and a lantern that cast real shadows, floating damage numbers, hit-stop, screen shake, particles, sound and music, a title screen, a pause menu, a game-over and a victory screen, and a high score that survives a restart.

It is a good game *and* a map of the engine. Almost every idea from the Examples pages appears once, in one project:

| Idea | Example page it comes from |
|---|---|
| Scripts, input, movement | [Your first script](ex-first-script.html), [Input and movement](ex-input-movement.html) |
| Collisions, triggers, tags | [Collisions, triggers and raycasts](ex-collisions.html) |
| Enemy AI with sight | [Enemy AI and state machines](ex-ai-states.html) |
| Health, damage, grace time | [Health, damage and death](ex-health-damage.html) |
| Keys, items, pickups | [Inventory, items and quests](ex-inventory-quests.html) |
| Floating text, particles, hit-stop, shake | [Juice](ex-juice-effects.html) |
| 2D lights and shadows | [2D lights and shadows](ex-lights-2d.html) |
| Animation | [Animation](ex-animation.html) |
| HUD, panels, buttons | [UI: HUD, buttons and menus](ex-ui-hud.html) |
| Sound and music | [Audio](ex-audio.html) |
| Saving a best score | [Saving and loading](ex-save-load.html) |
| Scenes: title and game | [Scenes and persistent objects](ex-scenes.html) |
| Shipping | [Build, publish and ship](ex-build-publish.html) |

**Prerequisites:** the dungeon series, or at least [T55 to T58](tut-t55-series-dungeon-1.html). Allow three to four hours; every file is printed in full and explained.

![The title screen](assets/screenshots/ember-crypt-title.png)

![Exploring the crypt by lantern light](assets/screenshots/ember-crypt-start.png)

**Download:** [the finished game](assets/downloads/ember-crypt-source.zip), also in `examples/ember-crypt` of the engine. Unzip, open `nord.project.json` in Nord and press **Play**.

**Controls:** WASD or arrows move, Space or J swings the sword, Esc pauses, E restarts after a game over.

## 1 The plan

The game: you are trapped in a crypt of six rooms. The way out is the glowing rune in the far room. Two iron gates stand in the way; each needs a key. Slimes and bats wander and hunt you. You carry a lantern, there are braziers on the walls, and you cannot see further than the light.

Good games are built from small parts that do not know each other. Here they are, and what talks to what:

| Script | Lives on | Job |
|---|---|---|
| `map.js`, `world.js` | no entity | the dungeon as text; asking it questions (is there a wall at x, y? can A see B?) |
| `entities.js`, `fx.js` | no entity | factories that describe entities; little visual effects |
| `level.js` | `Level` | reads the map and builds the world |
| `state.js` | `Game` | the rules of one run: coins, keys, clock, how it ends |
| `hero.js`, `health.js` | `Hero` | steering, sword, animation; hit points |
| `enemy.js` | every enemy | wander, see, chase, take damage, die |
| `pickup.js`, `door.js`, `spikes.js`, `exit.js` | the matching objects | one behaviour each |
| `follow.js` | `Camera` | smooth camera |
| `light2d*.js` | `Light2D`, lights, walls | darkness and shadows (library scripts) |
| `hud.js`, `title.js` | `Hud`, `Title` | screens |

They talk through **events**: `pickup`, `health`, `died`, `exit`, `state`, `ended`, `level` on the game-wide bus, and `hit`, `hurt`, `heal`, `damage` on single entities. When you read the code, follow the events.

## 2 The project

Create a 2D project. The file `nord.project.json` has these differences from a default project:

```json
"startScene": "scenes/title.scene.json",
"display": { "width": 640, "height": 360, "scale": "fit", "pixelArt": true, "background": "#07080c" },
"physics": { "engine": "arcade", "gravity": [0, 0, 0] },
"input": { "actions": {
  "left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"], "down": ["KeyS", "ArrowDown"],
  "attack": ["Space", "KeyJ", "Mouse0"], "interact": ["KeyE", "Enter"] } }
```

* `pixelArt: true` turns off smoothing, so 16 and 32 pixel art stays razor sharp when the screen is scaled up. For hand-drawn art leave it off.
* The game starts at the title scene, which loads the game scene when you press **Play**.
* The new action `attack` is Space, J or a mouse click.

The art is the pixel art that ships with Nord: `hero.png` (a sheet of 32 × 32 frames with the animations `idle`, `walk`, `jump`, `hurt`), the slime and bat sheets, wall and floor textures, the iron gate, a brazier, a rune, items (key, potion, chest, crate, barrel, spikes, hearts) and sound effects and music. Copy them from the download's `assets/` folder; each sheet has a `.png.meta.json` next to it that tells the engine its frame size and animation names.

> **Where do animations come from?** A sprite sheet's meta file lists named clips: `"walk": { "frames": [2, 3, 4, 5], "fps": 10, "loop": true }`. The **Sprite editor** (see [Sprites and animation](ex-animation.html)) writes the same file, so you can draw your own.

## 3 The dungeon as text

`scripts/map.js` is the whole level: `#` wall, `.` floor, `P` the hero's start, `o` coin, `k` key, `D` a gate tile (a gate is two tiles wide), `+` potion, `B` brazier, `c` crate or barrel, `^` spikes, `C` chest, `s` slime, `b` bat, `X` the exit rune.

```js
/** The dungeon. # wall, . floor, P hero start, o coin, k key, D door (2 tiles), + potion, B brazier, c crate,
 *  ^ spikes, C chest, s slime, b bat, X exit. 40 x 22 tiles of 32 px. */
export const MAP = [
  '########################################',
  '########################################',
  '##........####.........B#####.........##',
  '##.P....+.####.s......o.#####......ok.##',
  '##......c..^..............D^....o.....##',
  '##....##....^.....###.....D...........##',
  '##..c...o.####.c.......c#####..o...b..##',
  '##.B......####..o....os.#####.......B.##',
  '#####..#######..........#########..#####',
  '#####..###########..#############DD#####',
  '#####..###########..#############.^#####',
  '#####..###########..#############^.#####',
  '##.B........######..##########........##',
  '##....b...o.####..........####.o..c+..##',
  '##.o........####.+..b...o.####........##',
  '##..c.##......^...........####........##',
  '##..................##..C.####.....c..##',
  '##.......s..####..........####.s...X..##',
  '##..o.....k.####.oc.....s.####......o.##',
  '##..........####.........B####B.......##',
  '########################################',
  '########################################',
];
```

Editing the dungeon is now editing text. Change a `.` to `o` and there is a coin.

`scripts/world.js` asks the map questions:

```js
import { MAP } from './map.js';

export const TILE = 32;

/** The character of the map tile that contains the world point (x, y). Outside the map everything is wall. */
export const tileAt = (x, y) => MAP[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? '#';

/** True when no wall tile lies on the straight line between the two points. Samples every 8 px, which is finer than a tile. */
export function lineClear(ax, ay, bx, by) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (tileAt(ax + (bx - ax) * t, ay + (by - ay) * t) === '#') return false;
  }
  return true;
}
```

* `tileAt` converts a world position to a tile by dividing by 32. Outside the map it answers `#`, so nothing can ever "see" or walk beyond the edge.
* `lineClear` is **line of sight**. It walks along the straight line between two points in 8 pixel steps (finer than a tile, so a corner cannot slip through) and answers false at the first wall. It is not a physics ray, only a map lookup, so it is cheap enough for every enemy every step.

## 4 Describing entities

The earlier series wrote each entity by hand inside the level script. A bigger game wants **one place that knows what a coin is**. `scripts/entities.js` holds small factory functions that return entity data, in the same shape the scene file stores:

```js
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
```

Notice the pattern: a visible thing is `img(...)` (a sprite), a solid thing adds `body('static')` and `box(...)`, a pickup uses a **trigger** collider and the `pickup.js` script with a different `kind`. The wall is two kinds of entity: `wallTile` is only a picture (hundreds of them) and `wallBody` is only a collider and shadow caster (a few dozen long strips). Looks and physics have different needs, so they are different entities.

> **Why a function and not a prefab?** A prefab is a file in the editor; a factory is code. Use prefabs for things a designer should edit with the mouse (see [Spawning, prefabs and Destroy](ex-spawn-destroy.html)). Use factories for things made hundreds of times by a script, like wall tiles.

## 5 Building the level

`scripts/level.js` is the part-3 loader with a table of what each letter makes:

```js
import { NordScript } from 'nord';
import { MAP } from './map.js';
import * as E from './entities.js';

export default class Level extends NordScript {
  static attributes = { tile: { type: 'number', default: 32, min: 8 } };

  async start() {
    const t = this.attrs.tile;
    const width = MAP[0].length * t, height = MAP.length * t;
    const spawn = (data) => this.scene.spawnData(data);
    await spawn(E.floor(width, height));

    const kinds = { o: E.coin, k: E.key, '+': E.potion, C: E.chest, B: E.brazier, '^': E.spikes, s: E.slime, b: E.bat, X: E.exitRune };
    let coins = 0;
    for (let row = 0; row < MAP.length; row++) {
      let col = 0;
      while (col < MAP[row].length) {
        const ch = MAP[row][col];
        const x = col * t + t / 2, y = row * t + t / 2;
        if (ch === '#') {
          let end = col;
          while (MAP[row][end + 1] === '#') end++;
          const w = (end - col + 1) * t;
          await spawn(E.wallBody(col * t + w / 2, y, w, t));            // one collider and one shadow caster for the whole run
          for (let c = col; c <= end; c++) await spawn(E.wallTile(c * t + t / 2, y));   // but one picture per tile
          col = end + 1;
          continue;
        }
        if (ch === 'P') this.scene.find('Hero').pos = [x, y, 3];
        else if (ch === 'c') await spawn(E.crate(x, y, (col + row) % 2 ? 'crate' : 'barrel'));
        else if (ch === 'D') await spawn(E.door(x, y));
        else if (kinds[ch]) { if (ch === 'o') coins++; await spawn(kinds[ch](x, y)); }
        col++;
      }
    }
    this.events.emit('level', { width, height, coins });
  }
}
```

* `kinds` maps a letter to a factory. One line `kinds[ch](x, y)` replaces a long `if` chain; adding a new object type is one line in `kinds` and one in `entities.js`.
* The floor is one big picture. Walls are merged into runs for physics but still drawn tile by tile.
* The `Hero` already exists in the scene. When the loader meets `P`, it moves the hero there.
* At the end it announces the level's size and the number of coins.

## 6 The scene

The game scene `scenes/main.scene.json` needs only seven entities. Everything else the Level builds:

| Entity | Components | Scripts |
|---|---|---|
| `Camera` | camera | `follow.js` |
| `Game` | none | `state.js` |
| `Level` | none | `level.js` |
| `Light2D` | none | `light2d.js` (ambient `#0a0b12`, scale 7.5, shadows on) |
| `Hud` | none | `hud.js` |
| `Hero` (tag `hero`) | animatedSprite `hero.png` anim `idle`, rigidbody dynamic, collider box 14 × 16 | `hero.js`, `health.js` (max 5) |
| `Lantern` (child of `Hero`) | none | `light2d-source.js` (colour `#ffb86b`, radius 200) |

The hero's collider (14 × 16) is smaller than its 32 × 32 picture, so the hero fits into corridors easily and the head can overlap a wall's top edge, which looks natural in a top-down game.

Copy `light2d.js`, `light2d-source.js`, `light2d-occluder.js` from `library/scripts/`, and `follow.js` from part 3.

## 7 The hero

`scripts/hero.js` steers, animates and swings the sword:

```js
import { NordScript } from 'nord';

export default class Hero extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 120, min: 0, label: 'Speed (px/s)' },
    knockback: { type: 'number', default: 220, min: 0 },
    reach: { type: 'number', default: 34, min: 0, label: 'Sword reach (px)' },
    cooldown: { type: 'number', default: 0.35, min: 0, label: 'Seconds between swings' },
  };

  start() {
    this.sprite = this.entity.getComponent('animatedSprite');
    this.facing = [0, 1];
    this.kick = [0, 0];
    this.stun = 0;
    this.wait = 0;
    this.dead = false;
    this.entity.on('hurt', ({ from }) => {
      const dx = this.entity.pos[0] - from.pos[0], dy = this.entity.pos[1] - from.pos[1];
      const d = Math.hypot(dx, dy) || 1;
      this.kick = [dx / d * this.attrs.knockback, dy / d * this.attrs.knockback];
      this.stun = 0.15;
    });
    this.off = this.events.on('died', () => { this.dead = true; this.sprite.play('hurt'); });
  }

  fixedUpdate(dt) {
    if (this.dead) { this.physics.setVelocity(this.entity, 0, 0); return; }
    if (this.stun > 0) {
      this.stun -= dt;
      this.physics.setVelocity(this.entity, this.kick[0], this.kick[1]);
      return;
    }
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    this.physics.setVelocity(this.entity, x * this.attrs.speed, y * this.attrs.speed);
    this.moving = x !== 0 || y !== 0;
    if (this.moving) {
      const len = Math.hypot(x, y);
      this.facing = [x / len, y / len];
      this.sprite.setFlip(x < 0);                                   // the art looks right; mirror it to look left
    }
  }

  update(dt) {
    if (this.dead) return;
    this.wait -= dt;
    const want = this.stun > 0 ? 'hurt' : this.moving ? 'walk' : 'idle';
    if (this.sprite.current !== want) this.sprite.play(want);       // only restart an animation when it changes
    if (this.wait <= 0 && this.input.pressed('attack')) this.swing();
  }

  swing() {
    this.wait = this.attrs.cooldown;
    this.audio.play('assets/audio/sfx/swing.wav', { volume: 0.7 });
    const [fx, fy] = this.facing, [hx, hy] = this.entity.pos;
    this.slash(hx + fx * 20, hy + fy * 20);
    for (const enemy of this.scene.findByTag('enemy')) {
      const dx = enemy.pos[0] - hx, dy = enemy.pos[1] - hy, d = Math.hypot(dx, dy);
      if (d < this.attrs.reach && (dx * fx + dy * fy) / (d || 1) > -0.1) enemy.emit('damage', { amount: 1, from: this.entity });   // in range and in front
    }
  }

  /** The white crescent: a translucent circle that grows and fades. */
  async slash(x, y) {
    const e = await this.scene.spawnData({
      name: 'Slash', tags: [], layer: 1, transform: { pos: [x, y, 6], rot: [0, 0, 0], scale: [1, 1, 1] },
      components: [{ type: 'sprite', texture: 'assets/sprites/circle.png', size: [24, 24], tint: '#fff2c9', alpha: 0.7 }], scripts: [], children: [],
    });
    const s = { k: 0.6, a: 0.7 };
    this.tween(s, { k: 1.5, a: 0 }, { duration: 0.18, onUpdate: () => { if (!e.destroyed) { e.scale = [s.k, s.k, 1]; e.native.setAlpha(s.a); } }, onComplete: () => e.destroy() });
  }

  onDestroy() { this.off?.(); }
}
```

The new ideas compared with part 5:

* `this.entity.getComponent('animatedSprite')` gives the animation component. `sprite.play('walk')` starts a clip and `sprite.current` is the clip that is playing. **Only call `play` when the wanted clip changes**, or the animation restarts every frame and freezes on its first frame. That one comparison, `this.sprite.current !== want`, is the most common animation fix.
* `sprite.setFlip(true)` mirrors the picture horizontally. The art faces forward, so we mirror it when the hero goes left.
* **Facing.** `this.facing` is the last non-zero movement direction as a unit vector. The sword uses it.
* **The sword.** `swing()` starts the cooldown, plays a sound, shows a translucent circle (`slash`) that grows and fades, and then damages every enemy that is closer than `reach` and **in front**. "In front" is a dot product: `(dx * fx + dy * fy) / d` is the cosine of the angle between "where the enemy is" and "where the hero faces". Above −0.1 means roughly the front half-plane. Only the hero decides how big the sword is: enemies simply receive a `damage` message.
* `slash` tweens a scale and an alpha. `this.tween(object, targets, options)` animates numbers of any plain object over time and calls `onUpdate` each frame. The effect sets `e.native.setAlpha(...)`: `native` is the engine's own game object, the escape hatch for things Nord's component fields do not cover.

> **Why `await` in `slash` but not when calling it?** `swing` does not need to wait for the crescent to exist, so it calls `this.slash(...)` and carries on. The async function finishes by itself.

## 8 Health

`scripts/health.js` is the part-5 script with the new things a finished game needs: healing, a hurt sound, camera shake and a blink while protected:

```js
import { NordScript } from 'nord';

export default class Health extends NordScript {
  static attributes = {
    max: { type: 'number', default: 5, min: 1 },
    grace: { type: 'number', default: 1, min: 0, label: 'Invulnerable seconds after a hit' },
  };

  start() {
    this.hp = this.attrs.max;
    this.grace = 0;
    this.entity.on('hit', (e) => this.hit(e));
    this.entity.on('heal', ({ amount = 1 }) => {
      if (this.hp <= 0 || this.hp >= this.attrs.max) return;
      this.hp = Math.min(this.attrs.max, this.hp + amount);
      this.events.emit('health', { hp: this.hp, max: this.attrs.max });
    });
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
  }

  hit({ from, amount = 1 }) {
    if (this.hp <= 0 || this.grace > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.grace = this.attrs.grace;
    this.audio.play('assets/audio/sfx/hurt.wav');
    this.game.camera.shake(160, 0.01);
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
    this.entity.emit('hurt', { from });
    if (this.hp <= 0) this.events.emit('died');
  }

  update(dt) {
    this.grace = Math.max(0, this.grace - dt);
    const blink = this.grace > 0 && Math.floor(this.grace * 12) % 2 === 0;
    this.entity.native.setAlpha(blink ? 0.3 : 1);                   // the escape hatch: the engine's own game object
  }
}
```

* `this.game.camera.shake(160, 0.01)` shakes the camera for 160 milliseconds with a small intensity.
* `this.audio.play(path, { volume })` plays a sound effect once.
* The blink uses the container's alpha. `Math.floor(this.grace * 12) % 2` toggles about six times a second.
* It sends `health` (the HUD listens), `hurt` (the hero's knockback listens) and, at zero, `died`. Health never mentions the HUD or the hero: add a "damage vignette" later by listening to `health` somewhere else.

## 9 Enemies that see you

`scripts/enemy.js` runs both slimes and bats. They differ only in four attributes set by their factories: `speed`, `hp`, `sight` and `zigzag`.

```js
import { NordScript } from 'nord';
import { lineClear } from './world.js';
import { floatText, burst, hitStop } from './fx.js';
import { coin } from './entities.js';

export default class Enemy extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 55, min: 0 },
    hp: { type: 'number', default: 2, min: 1 },
    sight: { type: 'number', default: 150, min: 0, label: 'Sees the hero within (px)' },
    reach: { type: 'number', default: 20, min: 0, label: 'Touch distance (px)' },
    anim: { type: 'string', default: 'idle' },
    zigzag: { type: 'number', default: 0, min: 0, label: 'Sideways wobble (bats)' },
  };

  start() {
    this.hero = this.scene.find('Hero');
    this.sprite = this.entity.getComponent('animatedSprite');
    this.hp = this.attrs.hp;
    this.dir = [0, 0];
    this.think = this.rng.range(0, 1);
    this.stun = 0;
    this.kick = [0, 0];
    this.t = this.rng.range(0, 6);
    this.entity.on('damage', (e) => this.damage(e));
  }

  fixedUpdate(dt) {
    if (!this.hero || this.hero.destroyed) return;
    this.t += dt;
    if (this.stun > 0) { this.stun -= dt; this.physics.setVelocity(this.entity, this.kick[0], this.kick[1]); return; }
    const [ex, ey] = this.entity.pos, [hx, hy] = this.hero.pos;
    const d = Math.hypot(hx - ex, hy - ey);
    const sees = d < this.attrs.sight && lineClear(ex, ey, hx, hy);   // close enough AND no wall in between
    if (sees) {
      this.dir = [(hx - ex) / d, (hy - ey) / d];
      this.think = 0.4;
    } else {
      this.think -= dt;
      if (this.think <= 0) {
        const a = this.rng.range(0, Math.PI * 2);
        this.dir = this.rng.next() < 0.3 ? [0, 0] : [Math.cos(a), Math.sin(a)];
        this.think = this.rng.range(1, 2.5);
      }
    }
    const wobble = Math.sin(this.t * 7) * this.attrs.zigzag * 0.8;     // push sideways: the bat swerves
    const vx = this.dir[0] - this.dir[1] * wobble, vy = this.dir[1] + this.dir[0] * wobble;
    const s = this.attrs.speed * (sees ? 1 : 0.45);
    this.physics.setVelocity(this.entity, vx * s, vy * s);
    if (this.dir[0]) this.sprite.setFlip(this.dir[0] < 0);
  }

  update() {
    if (!this.hero || this.hero.destroyed) return;
    const d = Math.hypot(this.hero.pos[0] - this.entity.pos[0], this.hero.pos[1] - this.entity.pos[1]);
    if (d < this.attrs.reach) this.hero.emit('hit', { from: this.entity });
  }

  damage({ amount, from }) {
    this.hp -= amount;
    const [x, y] = this.entity.pos;
    const dx = x - from.pos[0], dy = y - from.pos[1], d = Math.hypot(dx, dy) || 1;
    this.kick = [dx / d * 260, dy / d * 260];
    this.stun = 0.18;
    floatText(this.scene, x, y, amount, '#ffe27a');
    this.audio.play('assets/audio/sfx/hit.wav', { volume: 0.8 });
    hitStop(this.game, 55);
    burst(this.scene, x, y, { tint: '#ffffff', tintEnd: '#9bd1ff', count: 6, life: 250 });
    if (this.hp <= 0) this.die();
  }

  die() {
    const [x, y] = this.entity.pos;
    burst(this.scene, x, y, { texture: 'assets/particles/smoke.png', tint: '#d8e4ff', tintEnd: '#2a2f45', count: 12, life: 600 });
    this.audio.play('assets/audio/sfx/death.wav', { volume: 0.6 });
    if (this.rng.next() < 0.6) this.scene.spawnData(coin(x, y));      // sometimes drops a coin
    this.entity.destroy();
  }
}
```

* **Seeing.** `sees` is true only when the hero is within `sight` **and** `lineClear` finds no wall in between. Standing behind a wall, you vanish for them. In T59 enemies saw through walls; this is the fix, and it is five characters of difference in the condition.
* **Chasing and wandering.** When they see you they run straight at you; when they do not, they pick random directions every second or two, at 45% speed. `this.think` is a countdown, as before.
* **The bat's swerve.** `zigzag` adds a sideways component that oscillates with a sine of time. A unit vector rotated 90° is `(−dy, dx)`; adding a bit of it to the direction makes a curving path.
* **Taking damage.** `damage()` subtracts hit points, pushes the enemy back (a *stun* time during which it cannot steer), floats the damage number, plays a sound, freezes the game for 55 ms and bursts a few particles. All of them are one-line calls from `fx.js`, which comes next.
* **Dying.** Smoke, a sound, sometimes (60%) a coin, then `destroy()`.

## 10 Juice

Hitting something should feel good. `scripts/fx.js` collects the three small tricks of the [Juice page](ex-juice-effects.html) as plain functions:

```js
// Small effects shared by many scripts. Plain functions: no entity, no state.

/** Text that floats up and fades out. Layer 1 keeps it above the darkness. */
export function floatText(scene, x, y, text, color = '#ffffff', size = 12) {
  scene.spawnData({
    name: 'FloatText', tags: [], layer: 1,
    transform: { pos: [x, y - 10, 5], rot: [0, 0, 0], scale: [1, 1, 1] },
    components: [{ type: 'text', text: String(text), size, color, bold: true, stroke: '#000000', strokeThickness: 3 }],
    scripts: [], children: [],
  }).then((e) => {
    const s = { dy: 0, a: 1 };
    scene.scheduler.tween(s, { dy: -22, a: 0 }, {
      duration: 0.8, ease: 'quadOut',
      onUpdate: () => { if (!e.destroyed) { e.pos = [x, y - 10 + s.dy, 5]; e.native.setAlpha(s.a); } },
      onComplete: () => e.destroy(),
    });
  });
}

/** A one-shot burst of particles at a point. */
export function burst(scene, x, y, { texture = 'assets/particles/spark.png', tint = '#ffd27a', tintEnd = '#ff5a1f', count = 14, speed = [40, 140], life = 450 } = {}) {
  scene.spawnData({
    name: 'Burst', tags: [], layer: 1,
    transform: { pos: [x, y, 6], rot: [0, 0, 0], scale: [1, 1, 1] },
    components: [{ type: 'particles', texture, tint, tintEnd, burst: count, emitting: false, lifespan: life, speed, scale: [0.5, 0], alpha: [1, 0] }],
    scripts: [], children: [],
  }).then((e) => scene.scheduler.after(life / 1000 + 0.2, () => e.destroy()));
}

/** Freezes the game for a blink on a heavy hit. Real time: the game clock is the thing being slowed. */
export function hitStop(game, ms = 60) {
  game.timeScale = 0.05;
  setTimeout(() => { game.timeScale = 1; }, ms);
}
```

* `floatText` spawns a text entity on **layer 1** (above the darkness, so it stays readable in the dark), then moves it up 22 pixels while fading it out over 0.8 seconds, and removes it. `scene.scheduler.tween` is the same tween the scripts use through `this.tween`.
* `burst` spawns a **particles** component set to `burst: count, emitting: false`: one explosion of sparks that fade from `tint` to `tintEnd`, then the entity removes itself after the particles' lifetime.
* `hitStop` slows the game to 5% speed for a few milliseconds. It uses the browser's `setTimeout`, **not** the game's timers, because the game's clock is exactly what we slowed down: a game timer of 55 ms would take 1.1 s of real time. This is a classic trap.

Those few effects (a sound, a number, a spark, a freeze, a shake) are what make a sword swing feel heavy.

## 11 Pickups, gates and the rules

Four pickups share one script, `scripts/pickup.js`, with an attribute `kind`:

```js
import { NordScript } from 'nord';
import { floatText, burst } from './fx.js';

const TEXT = { coin: ['+1', '#ffd34d'], key: ['Key', '#ffffff'], potion: ['+1 ♥', '#ff7b8a'], chest: ['+5', '#ffd34d'] };
const SOUND = { coin: 'coin', key: 'pickup', potion: 'heal', chest: 'chest' };

export default class Pickup extends NordScript {
  static attributes = { kind: { type: 'enum', options: ['coin', 'key', 'potion', 'chest'], default: 'coin' } };

  start() {
    this.y0 = this.entity.pos[1];
    this.t = this.rng.range(0, 6);
    this.taken = false;
  }

  update(dt) {
    this.t += dt;
    const p = this.entity.pos;
    this.entity.pos = [p[0], this.y0 + Math.sin(this.t * 4) * 1.5, p[2]];
  }

  onTriggerEnter(other) {
    if (this.taken || !other.hasTag('hero')) return;
    this.taken = true;
    const { kind } = this.attrs, [x, y] = this.entity.pos;
    const [text, color] = TEXT[kind];
    floatText(this.scene, x, y, text, color);
    this.audio.play(`assets/audio/sfx/${SOUND[kind]}.wav`, { volume: 0.7 });
    if (kind === 'chest') burst(this.scene, x, y, { count: 18 });
    this.events.emit('pickup', { kind });
    this.entity.destroy();
  }
}
```

The script does only what is the same for all: bob up and down, detect the hero, show a text, play a sound and announce `pickup` with the kind.

`scripts/state.js` on the `Game` entity decides what a pickup *means* and runs the clock:

```js
import { NordScript } from 'nord';

/** The rules of one run: what the hero carries, the clock, and how it ends. Everything else only sends it events. */
export default class State extends NordScript {
  start() {
    this.coins = 0;
    this.keys = 0;
    this.elapsed = 0;
    this.ended = false;
    this.best = this.save.get('ember.best', 0);
    this.announce = 0;
    this.offs = [
      this.events.on('pickup', ({ kind }) => this.pickup(kind)),
      this.events.on('died', () => this.end(false)),
      this.events.on('exit', () => this.end(true)),
    ];
    this.audio.music('assets/audio/music/music_adventure.mp3', { volume: 0.35 });
    this.push();
  }

  pickup(kind) {
    if (kind === 'coin') this.coins++;
    else if (kind === 'chest') this.coins += 5;
    else if (kind === 'key') this.keys++;
    else if (kind === 'potion') this.scene.find('Hero').emit('heal', { amount: 1 });
    this.push();
  }

  /** Doors call this: spends a key if there is one. */
  useKey() {
    if (this.keys <= 0) return false;
    this.keys--;
    this.push();
    return true;
  }

  push() { this.events.emit('state', { coins: this.coins, keys: this.keys, time: this.elapsed }); }

  update(dt) {
    if (this.ended) return;
    this.elapsed += dt;
    this.announce -= dt;
    if (this.announce <= 0) { this.announce = 0.25; this.push(); }
  }

  end(win) {
    if (this.ended) return;
    this.ended = true;
    const score = this.coins * 10 + (win ? Math.max(0, 300 - Math.floor(this.elapsed)) * 5 : 0);   // a faster win is worth more
    const record = win && score > this.best;
    if (record) { this.best = score; this.save.set('ember.best', score); }
    this.audio.stopMusic();
    this.audio.play(`assets/audio/music/${win ? 'jingle_victory' : 'jingle_game_over'}.mp3`, { volume: 0.7 });
    this.events.emit('ended', { win, score, best: this.best, record, coins: this.coins, time: this.elapsed });
  }

  onDestroy() { this.offs?.forEach((off) => off()); }
}
```

* Coins, keys and the potion are handled in one function. A potion heals the hero by sending the `heal` message to the hero entity.
* `useKey()` is a plain method other scripts may call (the gates use it). When code must ask a question and get an answer, a method call is simpler than events.
* `end(win)` is called by `died` and `exit`. It computes the score (10 per coin, and a speed bonus of 5 per second under five minutes), saves the best score with `this.save.set('ember.best', score)` and announces `ended` with all the numbers for the screen. The guard `if (this.ended) return` prevents a double ending.
* The music starts here with `this.audio.music(path, { volume })` and stops on the end.

> **Why is `this.elapsed` not `this.time`?** Nord scripts already have a `this.time` (the game clock). Assigning to it throws `Cannot set property time … which has only a getter`. Do not name your fields `entity`, `scene`, `game`, `attrs`, `input`, `audio`, `time`, `events`, `ui`, `physics`, `save` or `rng`.

Gates are `scripts/door.js`:

```js
import { NordScript } from 'nord';
import State from './state.js';
import { floatText, burst } from './fx.js';

export default class Door extends NordScript {
  start() {
    this.hero = this.scene.find('Hero');
    this.state = this.scene.find('Game').getScript(State);
    this.nag = 0;
  }

  update(dt) {
    if (this.opened) return;                                       // a neighbour tile already used the key this frame
    this.nag -= dt;
    const [x, y] = this.entity.pos;
    if (Math.hypot(this.hero.pos[0] - x, this.hero.pos[1] - y) > 30) return;
    if (this.state.useKey()) this.open();
    else if (this.nag <= 0) { this.nag = 1.5; floatText(this.scene, x, y, 'Locked', '#ff8a8a'); this.audio.play('assets/audio/sfx/error.wav', { volume: 0.5 }); }
  }

  /** One key opens the whole gate: this tile and its neighbours. */
  open() {
    this.audio.play('assets/audio/sfx/door.wav');
    const [x, y] = this.entity.pos;
    for (const d of this.scene.findByTag('door')) {
      if (Math.hypot(d.pos[0] - x, d.pos[1] - y) < 40) {
        burst(this.scene, d.pos[0], d.pos[1], { texture: 'assets/particles/smoke.png', tint: '#bbbbbb', tintEnd: '#333333', count: 8 });
        d.getScript(Door).opened = true;
        d.destroy();
      }
    }
  }
}
```

Each gate tile checks whether the hero is within 30 pixels. If the hero has a key (`useKey()` spent one), `open()` destroys this tile **and its neighbours within 40 pixels**, so one key opens both tiles of a two-wide corridor. The `opened` flag matters: both tiles call `update` in the same frame, and without it the second tile would spend a second key. Without a key the gate shows "Locked" (at most every 1.5 seconds) and plays an error sound.

The last two behaviours are tiny. `scripts/spikes.js` sends a `hit` message when the hero stands on it, and `scripts/exit.js` turns the rune slowly (`this.entity.rot`) and announces `exit` when the hero reaches it:

```js
import { NordScript } from 'nord';

export default class Spikes extends NordScript {
  start() { this.hero = this.scene.find('Hero'); }
  update() {
    const [x, y] = this.entity.pos;
    if (Math.hypot(this.hero.pos[0] - x, this.hero.pos[1] - y) < 14) this.hero.emit('hit', { from: this.entity });
  }
}
```

```js
import { NordScript } from 'nord';

export default class Exit extends NordScript {
  start() { this.hero = this.scene.find('Hero'); this.t = 0; this.done = false; }
  update(dt) {
    this.t += dt;
    this.entity.rot = [0, 0, this.t * 30];                          // the rune slowly turns
    const [x, y] = this.entity.pos;
    if (!this.done && Math.hypot(this.hero.pos[0] - x, this.hero.pos[1] - y) < 16) { this.done = true; this.events.emit('exit'); }
  }
}
```

## 12 Light

The lights are exactly part 6: `Light2D` with the system script, `Lantern` as a child of the hero, **braziers** with `light2d-source` (orange, flickering 0.3, shadows on) and walls and crates with the occluder. A few details that make it look good:

* The darkness `ambient` is `#0a0b12`, almost black but with a hint of blue, so the dark has a colour.
* The lantern has `flicker: 0.07`: a tiny breathing makes it alive. The braziers flicker 0.3, wild.
* The exit rune has a **cyan** light (`#7fd6ff`). Warm light in the rooms and cold light at the exit tells the player where to go without a single arrow.
* Wall pictures are on layer 0, so the walls are darkened like the floor, and the occluders give them real shadows.

![Gates, spikes and shadows](assets/screenshots/ember-crypt-gate.png)

## 13 The HUD, pause and end screens

`scripts/hud.js`:

```js
import { NordScript } from 'nord';

const px = { 'image-rendering': 'pixelated' };

export default class Hud extends NordScript {
  start() {
    this.hearts = [];
    this.coin = this.ui.label('', { screen: 'hud', x: 12, y: 34, size: 18, color: '#ffd34d' });
    this.keys = this.ui.label('', { screen: 'hud', x: 12, y: 58, size: 18, color: '#ffffff' });
    this.clock = this.ui.label('', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 18, color: '#cfd8ff' });
    this.offs = [
      this.events.on('health', ({ hp, max }) => this.drawHearts(hp, max)),
      this.events.on('state', ({ coins, keys, time }) => {
        this.coin.set(`● ${coins}`);
        this.keys.set(keys ? `🗝 ${keys}` : '');
        this.clock.set(`${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`);
      }),
      this.events.on('ended', (r) => this.finish(r)),
    ];
    this.onKey = (e) => { if (e.code === 'Escape' && !this.over) this.togglePause(); };
    window.addEventListener('keydown', this.onKey);
  }

  drawHearts(hp, max) {
    this.hearts.forEach((h) => h.remove());
    this.hearts = Array.from({ length: max }, (_, i) =>
      this.ui.image(`assets/sprites/items/heart_${i < hp ? 'full' : 'empty'}.png`, { screen: 'hud', x: 10 + i * 22, y: 8, w: 20, h: 20, style: px }));
  }

  togglePause() {
    if (this.pauseUi) { this.pauseUi.forEach((p) => p.remove()); this.pauseUi = null; this.game.resume(); return; }
    this.game.pause();
    this.pauseUi = [this.ui.label('Paused', { screen: 'hud', anchor: 'c', size: 44, color: '#ffb86b' }),
      this.ui.label('Esc to continue', { screen: 'hud', anchor: 'c', y: 40, size: 18 })];
  }

  finish({ win, score, best, record, coins, time }) {
    this.over = true;
    const color = win ? '#a3e6a0' : '#ff7b8a';
    this.ui.panel({ screen: 'hud', anchor: 'c', w: 360, h: 190, style: { background: 'rgba(5,6,10,0.82)', borderRadius: '10px' } });
    this.ui.label(win ? 'You escaped the crypt!' : 'The crypt keeps you…', { screen: 'hud', anchor: 'c', y: -62, size: 30, color });
    this.ui.label(`Score ${score}${record ? '  — new best!' : `   Best ${best}`}`, { screen: 'hud', anchor: 'c', y: -22, size: 20, color: '#ffd34d' });
    this.ui.label(`${coins} coins   ${Math.floor(time)} s`, { screen: 'hud', anchor: 'c', y: 8, size: 16 });
    this.ui.button('Play again', () => this.game.restart(), { screen: 'hud', anchor: 'c', x: -70, y: 56 });
    this.ui.button('Title', () => this.game.loadScene('scenes/title.scene.json'), { screen: 'hud', anchor: 'c', x: 70, y: 56 });
  }

  onDestroy() {
    window.removeEventListener('keydown', this.onKey);
    this.hearts.forEach((h) => h.remove());
    [this.coin, this.keys, this.clock].forEach((l) => l?.remove());
    this.pauseUi?.forEach((p) => p.remove());
    this.offs?.forEach((off) => off());
  }
}
```

* **Hearts** are images. Each time `health` arrives the old images are removed and the right number of full and empty hearts are created. `style: { 'image-rendering': 'pixelated' }` keeps them crisp at the scaled size.
* **The clock** shows minutes and seconds from the `state` event.
* **Pause.** Esc calls `this.game.pause()`, which stops the game's update loop; Esc again resumes. We listen to the browser's `keydown` directly, because scripts are not updated while the game is paused, so `input.pressed` would never fire. Remember to remove the listener in `onDestroy`.
* **The end panel** appears on `ended`. Buttons take a callback: `this.game.restart()` rebuilds the scene, `this.game.loadScene('scenes/title.scene.json')` goes back to the title. `anchor: 'c'` centres a widget; `x`, `y` are offsets from the centre.

![The victory screen](assets/screenshots/ember-crypt-win.png)

![Game over](assets/screenshots/ember-crypt-over.png)

## 14 The title scene

The second scene is `scenes/title.scene.json` with a camera and one entity, `Title`, running `scripts/title.js`:

```js
import { NordScript } from 'nord';

export default class Title extends NordScript {
  async start() {
    const best = this.save.get('ember.best', 0);
    this.audio.music('assets/audio/music/music_menu_chill.mp3', { volume: 0.5 });
    const at = (name, x, y, z, comps, layer = 0) => this.scene.spawnData({ name, tags: [], layer, transform: { pos: [x, y, z], rot: [0, 0, 0], scale: [1, 1, 1] }, components: comps, scripts: [], children: [] });
    await at('Floor', 320, 400, -5, [{ type: 'sprite', texture: 'assets/sprites/floor.png', size: [1280, 800], tint: '#3a3a4a', alpha: 1 }]);
    await at('Embers', 320, 370, 1, [{ type: 'particles', texture: 'assets/particles/spark.png', tint: '#ffb86b', tintEnd: '#ff4a1c', frequency: 70, lifespan: 3200,
      speed: [15, 40], angle: [255, 285], emitRadius: 280, scale: [0.5, 0], alpha: [1, 0] }]);
    await at('Hero', 250, 246, 3, [{ type: 'animatedSprite', texture: 'assets/sprites/hero.png', anim: 'idle', tint: '#ffffff' }]);
    await at('Slime', 392, 252, 3, [{ type: 'animatedSprite', texture: 'assets/sprites/enemy_slime.png', anim: 'idle' }]);
    await at('Brazier', 320, 244, 3, [{ type: 'sprite', texture: 'assets/sprites/brazier.png', size: [40, 40], tint: '#ffffff', alpha: 1 }]);

    this.widgets = [                                                // keep them: UI outlives the scene unless we remove it
      this.ui.label('EMBER CRYPT', { screen: 'hud', anchor: 'c', y: -100, size: 60, color: '#ffb86b' }),
      this.ui.label('Find two keys. Open two gates. Escape.', { screen: 'hud', anchor: 'c', y: -52, size: 18, color: '#cfd8ff' }),
      this.ui.button('Play', () => this.game.loadScene('scenes/main.scene.json'), { screen: 'hud', anchor: 'c', y: 20 }),
      this.ui.label('WASD / arrows move   Space or J attacks   Esc pauses', { screen: 'hud', anchor: 'c', y: 138, size: 14, color: '#8d93b3' }),
    ];
    if (best) this.widgets.push(this.ui.label(`Best score ${best}`, { screen: 'hud', anchor: 'c', y: 62, size: 16, color: '#ffd34d' }));
  }

  onDestroy() { this.widgets?.forEach((w) => w.remove()); }
}
```

It builds its own picture with the same `spawnData`: a tinted floor, rising embers (a **particles** component that keeps emitting), the hero, a brazier and a slime. It reads the saved best score with `this.save.get('ember.best', 0)` and shows it. Every widget is kept in `this.widgets` and removed in `onDestroy`, because **UI outlives a scene change**: forget it and the title text stays on top of your game.

## 15 Check yourself

* The title shows, with embers drifting up. **Play** starts the game and the music.
* Walk: the hero animates and mirrors. The camera follows. Walls cast shadows.
* Swing the sword at a slime: sound, a yellow `1`, a freeze, a few sparks. The second hit kills it and it sometimes drops a coin.
* Stand behind a wall: the slime stops hunting you and wanders.
* Touch spikes or an enemy: a heart disappears, you flash and are pushed away. A red potion refills one.
* A gate says "Locked" until you hold a key; with a key it opens with a puff of smoke. Reach the cyan rune: the victory screen shows your score and, the first time, "new best".
* Lose all five hearts: game over. **Play again** restarts with full hearts.
* Quit the game and open it again: the title remembers your best score.

The project has an automated test, `node tools/ember-crypt-test.mjs`, which does all that in a headless browser and produced the screenshots on this page.

## 16 Ship it

```bash
nord check ember-crypt
nord build ember-crypt --minify --zip -o ember-crypt-web
nord build ember-crypt --single-file -o ember-crypt-one
```

Upload the folder to any web host, or send the single `index.html`. See [Ship it with a hosting preset](tut-t51-hosting-presets.html) for itch.io and GitHub Pages.

## 17 Where to go next

Each of these is one small, separate script, because that is how the game was built:

* **More enemies.** A *spitter* that shoots (see [Spawning, prefabs and Destroy](ex-spawn-destroy.html)): a `Projectile` factory in `entities.js`, a copy of `enemy.js` that stops at `sight` and fires every second.
* **A real inventory.** Keys are a counter now. [Inventory, items and quests](ex-inventory-quests.html) shows items with names and icons.
* **Dialogue.** An old man at the start who explains the keys: [Talking to NPCs](ex-dialogue-npc.html).
* **A second level.** Make `map.js` an array of maps and load the next one from `state.js` when `exit` fires ([Scenes and persistent objects](ex-scenes.html)).
* **Touch controls.** A virtual joystick and an attack button: [Touch, mobile and responsive games](ex-mobile-touch.html).
* **Options.** Volume sliders and key rebinding: [Options menu](ex-settings-menu.html).
* **Multiplayer.** Two heroes: [Multiplayer basics](ex-multiplayer.html).
* **No-code rules.** Replace the Spikes script with an event sheet ([T24](tut-t24-event-sheet-platformer.html)).

## What you learned

* Describe the world as data, build it with factories, and let small scripts talk through events.
* The native `NordScript` API is enough for a whole game: lifecycle methods, `entity`, `scene`, `input`, `audio`, `physics`, `ui`, `save`, `events`, `tween`, `rng`.
* A dot product makes "in front", a map lookup makes "can see".
* Juice is four small effects: a number, a spark, a freeze, a shake.
* Light is three library scripts and a child entity; colour tells the player where to go.
* Always clean up in `onDestroy`: labels, widgets, listeners.
* Games ship as a folder, a single file or a zip.

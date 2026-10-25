---
title: T59 Nord Dungeon 5: Enemies and health
section: Tutorials
order: 59
summary: Series part 5 of 6. Wandering and chasing enemies, a Health script with a grace period, knockback, hearts on the HUD and game over.
---
Part 5 of the native-scripting dungeon series, continuing from [part 4, coins and score](tut-t58-series-dungeon-4.html). Allow 50 minutes.

**What you will build:** six red enemies that wander, chase you when you come near, hurt you on contact (with a short protection time and knockback), three hearts on the HUD and a game-over screen.

![An enemy chases the hero](assets/screenshots/series-dungeon-5-chase.png)

**Download:** [Part 5 project](assets/downloads/series-dungeon-part5-source.zip), also in `examples/series-dungeon/part5`.

## 1 Enemies in the map

The letter `e` marks an enemy in `map.js`. In the `Level` loop add one branch, like the coin one:

```js
} else if (ch === 'e') {
  await this.scene.spawnData(data('Enemy', ['enemy'], x, y, 2, [
    sprite(22, 22, '#bf616a'), { type: 'rigidbody', mode: 'dynamic' }, { type: 'collider', shape: 'box', size: [22, 22] },
  ], [{ path: 'scripts/enemy.js', attributes: {} }]));
}
```

An enemy is a **dynamic** body: it moves, it collides with walls and with the hero.

## 2 The enemy brain

An enemy has two moods. If the hero is close, **chase**. If not, **wander**: pick a random direction, walk for a second or two, pick another, and sometimes stand still.

```js
import { NordScript } from 'nord';

export default class Enemy extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 80, min: 0 },
    sight: { type: 'number', default: 170, min: 0, label: 'Sees the hero within (px)' },
    reach: { type: 'number', default: 24, min: 0, label: 'Touch distance (px)' },
  };

  start() {
    this.hero = this.scene.find('Hero');
    this.dir = [0, 0];
    this.think = this.rng.range(0, 1);
  }

  distance() {
    return Math.hypot(this.hero.pos[0] - this.entity.pos[0], this.hero.pos[1] - this.entity.pos[1]);
  }

  fixedUpdate(dt) {
    if (!this.hero || this.hero.destroyed) return;
    const d = this.distance();
    if (d < this.attrs.sight) {                                     // chase
      this.dir = [(this.hero.pos[0] - this.entity.pos[0]) / d, (this.hero.pos[1] - this.entity.pos[1]) / d];
      this.think = 0.3;
    } else {                                                        // wander: pick a new direction every second or two
      this.think -= dt;
      if (this.think <= 0) {
        const a = this.rng.range(0, Math.PI * 2);
        this.dir = this.rng.next() < 0.3 ? [0, 0] : [Math.cos(a), Math.sin(a)];
        this.think = this.rng.range(1, 2.5);
      }
    }
    const s = this.attrs.speed * (d < this.attrs.sight ? 1 : 0.4);
    this.physics.setVelocity(this.entity, this.dir[0] * s, this.dir[1] * s);
  }

  update() {
    if (this.hero && !this.hero.destroyed && this.distance() < this.attrs.reach) this.hero.emit('hit', { from: this.entity });
  }
}
```

* The sight test is the distance between two points, `Math.hypot(dx, dy)`. Dividing the difference by the distance gives a **unit vector** pointing at the hero, so speed is the same however far away the hero is.
* `this.think` is a countdown. Every fixed step it goes down by `dt`; at 0 the enemy chooses again. This is the simplest way to make something happen "every now and then" with no timer objects. (`this.after(seconds, fn)` and `this.every(seconds, fn)` also exist if you prefer callbacks.)
* The wandering enemy uses 40% of its speed (`0.4`) so it looks relaxed.
* The enemy moves with `setVelocity` like the hero, so the same walls stop it.
* In `update` the enemy checks the distance to the hero. If it is smaller than `reach`, it sends the hero a `hit` message: `this.hero.emit('hit', { from: this.entity })`. That is an **entity event**: the message goes to one specific entity only, not to the whole game.

> **Isn't it unfair that they see through walls?** Yes, and it is a good thing to notice. In this part we accept it; in part 6 darkness makes it feel like a feature, and the follow-up [T61](tut-t61-ember-crypt.html) adds real line-of-sight.

## 3 Health

Health is a small reusable script. It could sit on an enemy, a crate or a door. Add `scripts/health.js` to the `Hero`:

```js
import { NordScript } from 'nord';

export default class Health extends NordScript {
  static attributes = {
    max: { type: 'number', default: 3, min: 1 },
    grace: { type: 'number', default: 1, min: 0, label: 'Invulnerable seconds after a hit' },
  };

  start() {
    this.hp = this.attrs.max;
    this.grace = 0;
    this.entity.on('hit', (e) => this.hit(e));
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
  }

  hit({ from }) {
    if (this.hp <= 0 || this.grace > 0) return;                     // already dead, or still protected
    this.hp--;
    this.grace = this.attrs.grace;
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
    this.entity.emit('hurt', { from });                             // the hero script reacts with knockback
    if (this.hp <= 0) this.events.emit('died');
  }

  update(dt) {
    this.grace = Math.max(0, this.grace - dt);
    const blink = this.grace > 0 && Math.floor(this.grace * 10) % 2 === 0;
    this.entity.set('sprite', 'alpha', blink ? 0.35 : 1);
  }
}
```

* `this.entity.on('hit', fn)` listens for the hit messages sent to this entity.
* **Grace period.** After a hit the hero is protected for `grace` seconds. Without it an enemy touching the hero would deal 60 damage per second. `hit()` ignores calls while `this.grace > 0`.
* Health announces itself with the game-wide event `health` (for the HUD) and the entity event `hurt` (for the hero's own knockback).
* The blink: while protected, `Math.floor(this.grace * 10) % 2 === 0` flips every tenth of a second, so the sprite alternates between 35% and full opacity. `this.entity.set('sprite', 'alpha', value)` changes a field of the sprite component.
* `died` is announced once when the hit points reach zero.

## 4 Knockback and death

The hero reacts to `hurt` by being pushed away from the attacker for a moment. Extend `hero.js`:

```js
import { NordScript } from 'nord';

export default class Hero extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 160, min: 0, label: 'Speed (px/s)' },
    knockback: { type: 'number', default: 260, min: 0 },
  };

  start() {
    this.kick = [0, 0];
    this.stun = 0;
    this.dead = false;
    this.entity.on('hurt', ({ from }) => {
      const dx = this.entity.pos[0] - from.pos[0], dy = this.entity.pos[1] - from.pos[1];
      const d = Math.hypot(dx, dy) || 1;
      this.kick = [dx / d * this.attrs.knockback, dy / d * this.attrs.knockback];
      this.stun = 0.15;                                             // no steering while we fly backwards
    });
    this.off = this.events.on('died', () => { this.dead = true; });
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
  }

  onDestroy() { this.off?.(); }
}
```

* The direction away from the attacker is `hero − attacker`, normalised. Multiply by `knockback` for the speed.
* While `this.stun > 0` the player cannot steer; the push velocity is applied instead. 0.15 seconds is long enough to feel, short enough not to annoy.
* After `died` the hero stops (`this.dead`). The script listens with `this.events.on` and unsubscribes in `onDestroy`.

## 5 Hearts and game over

The HUD gets a second label at the top right (`anchor: 'tr'`) and two more subscriptions:

```js
this.hearts = this.ui.label('', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 26, color: '#bf616a' });
// …
this.events.on('health', ({ hp, max }) => this.hearts.set('♥'.repeat(hp) + '♡'.repeat(max - hp))),
this.events.on('died', () => this.finish('Game over', '#bf616a')),
```

The two endings, winning and dying, share one `finish(text, color)` function, which also prevents showing both. The complete script:

```js
import { NordScript } from 'nord';

export default class Hud extends NordScript {
  start() {
    this.count = 0;
    this.total = 0;
    this.over = false;
    this.score = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 22, color: '#ebcb8b' });
    this.hearts = this.ui.label('', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 26, color: '#bf616a' });
    this.offs = [
      this.events.on('level', ({ coins }) => { this.total = coins; this.refresh(); }),
      this.events.on('coin', () => { this.count++; this.refresh(); }),
      this.events.on('health', ({ hp, max }) => this.hearts.set('♥'.repeat(hp) + '♡'.repeat(max - hp))),
      this.events.on('died', () => this.finish('Game over', '#bf616a')),
    ];
    this.refresh();
  }

  refresh() {
    this.score.set(`● ${this.count} / ${this.total}`);
    if (this.total > 0 && this.count === this.total) this.finish('You found all the coins!', '#a3be8c');
  }

  finish(text, color) {
    if (this.over) return;
    this.over = true;
    this.ui.label(text, { screen: 'hud', anchor: 'c', size: 34, color });
    this.ui.label('Press E to play again', { screen: 'hud', anchor: 'c', y: 44, size: 20 });
  }

  update() {
    if (this.over && this.input.pressed('interact')) this.game.restart();
  }

  onDestroy() { this.score?.remove(); this.hearts?.remove(); this.offs?.forEach((off) => off()); }
}
```

Press **Play**. Walk near an enemy: it comes for you, a heart disappears, you are pushed back and blink for a second. Lose all three: *Game over*, and E restarts.

![Game over](assets/screenshots/series-dungeon-5-over.png)

## 6 Check yourself

* Stand still next to an enemy: you lose one heart per second, not per frame.
* Collect the last coin and die in the same second: only one message appears.
* Restart three times: the hearts are full each time and no label is doubled.

If an enemy never hurts you, check that the hero is tagged `hero` (the enemy finds it by name `Hero`), and that `Health` is attached to the hero.

## What you learned

* A simple enemy is a state decision every fixed step: chase or wander.
* Unit vectors (difference ÷ distance) give direction without speed.
* Entity events (`entity.emit` / `entity.on`) talk to one entity; `this.events` talks to everyone.
* Grace time prevents damage every frame.
* One script does one job: Health knows hearts, not enemies.

Next: [Part 6, light and shipping](tut-t60-series-dungeon-6.html).

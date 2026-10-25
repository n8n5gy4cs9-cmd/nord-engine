---
title: T33 Code a full 2D game — Coin Rush
section: Tutorials
order: 33
summary: Learn JavaScript and Nord by coding a timed platformer with combos, lives, checkpoints, boss victory, pause menus and persistent records. Includes all source.
---

This time **you write the game rules**. Coin Rush starts with Nord's Platformer foundation and becomes a timed arcade challenge: collect eight coins, stomp the boss, preserve three lives and build a combo before time expires. Coins add time; spare time and lives become a victory bonus. A pause menu and a persistent best score finish the loop.

**Allow two sessions of about an hour.** Basic typing is enough; each new JavaScript idea is explained below. You will use Nord's Assets, code editor, Hierarchy, Inspector, Console, Play and Export. No external service or library installation is needed.

[Download the complete Coin Rush project source](assets/downloads/coin-rush-source.zip). This includes every script, scene, asset and project file. Extract it to a writable folder, then open `nord.project.json` in Nord. It runs through Nord's server; the source archive is not a standalone web export.

<figure class="shot"><img src="assets/screenshots/ed-code-coin-rush.png" alt="Coin Rush with its coded countdown, lives and combo HUD" loading="lazy"><figcaption>The finished sample. You will write the controller that turns the platformer into this arcade challenge.</figcaption></figure>

## 1. Start from a known foundation

Choose **New project → Platformer**, save it as `my-coin-rush`, then Play. Click the game for focus. A/D or arrows move, Space jumps, Shift/K dashes; descending onto slimes stomps them. Flags are checkpoints and the giant slime is the boss. Stop before editing.

The original project already supplies terrain, physics, movement, health, pickup sounds, animation and enemy contact. We deliberately reuse those systems. The code you write owns the **run**: time, score, lives and victory. The full-source appendix includes the reused scripts too, so there is no hidden custom code.

Open `scenes/main.scene.json`. Select **Systems** in Hierarchy. In Inspector remove the attached `scripts/score.js` and `scripts/ui-gameover.js` scripts from **this entity**. Keep the health HUD, sound helper and hitstop scripts. Do not delete their files. Removing those two attachments prevents a second score counter and an old Game Over menu from competing with your rules.

In the project folder create `scripts/course.js` using your file manager, refresh Assets if necessary, then open it in Nord's code editor. Save this first working version:

```js
import { NordScript } from 'nord';

export default class CoinRush extends NordScript {
  start() {
    console.log('Coin Rush rules started');
  }
}
```

Select Systems → **Add script** → `scripts/course.js`. Save the scene. Play and inspect **Console**: the message appears once per run. Stop and Play again; it should appear once again, not twice in a single run. If it appears twice, remove the duplicate attachment.

`import` loads an exported value from another module. `'nord'` is Nord's supplied module name. `class` groups state and functions; `extends NordScript` gives access to `this.scene`, `this.ui`, `this.events`, `this.save` and the other engine services. `this` means this particular script instance. Nord calls `start()` when the scene is ready.

## 2. Declare settings the Inspector can edit

Add this inside the class, above `start()`:

**File: `scripts/course.js`** (add this inside the class, above `start()`)
```js
static attributes = {
  seconds: { type: 'number', default: 150, min: 10 },
  lives: { type: 'int', default: 3, min: 1 },
  requiredCoins: { type: 'int', default: 8, min: 1 },
  comboWindow: { type: 'number', default: 2, min: 0.1 },
};
```

An **object** is a set of named values inside braces. `seconds` is a key; the smaller object describes that setting. `int` means a whole number. `min` lets Nord clamp invalid low values. During a run read the resolved settings through `this.attrs.seconds`, not `this.seconds`.

Select Systems and find the new script settings. Set seconds to `180`, save the scene, then later compare it with `150`. An Inspector override is saved in the scene. Changing a JavaScript default does not overwrite an explicit scene override.

**Checkpoint:** the settings appear and you can save an override without changing the script.

## 3. Store run state and show it

Replace the temporary `start()` with this smaller teaching version. Add the other two methods beside it, inside the same class:

**File: `scripts/course.js`** (replace the temporary `start()` with this one and add the two other methods beside it, inside the class)
```js
start() {
  this.remaining = this.attrs.seconds;
  this.lives = this.attrs.lives;
  this.coins = 0;
  this.score = 0;
  this.hud = this.ui.label('', {
    screen: 'course', x: 12, y: 55, size: 14,
  });
  this.ui.show('course');
  this.draw();
}

update(dt) {
  this.remaining = Math.max(0, this.remaining - dt);
  this.draw();
}

draw() {
  this.hud.set(`Time ${Math.ceil(this.remaining)} | Lives ${this.lives}`);
}
```

Nord calls `update(dt)` each frame. `dt` is seconds since the previous frame. Subtracting it gives a clock that works at different frame rates; subtracting one each frame would run sixty times too fast on a 60 FPS display.

`Math.max(0, value)` prevents negative time. `Math.ceil` rounds up for the display without rounding the stored clock. Backticks form a **template string**, and `${...}` inserts a calculated value. `this.hud` stores the returned UI handle so `draw()` updates one label instead of creating hundreds.

Custom UI screens start hidden. `this.ui.show('course')` is essential. If you see the label in DOM inspection but not on screen, check that call before changing colours.

**Checkpoint:** Play for a few seconds. The countdown decreases about once a second and never creates overlapping copies. At this intermediate stage zero does not end the run yet.

## 4. Give events a job

Add listeners in `start()` after initializing state:

**File: `scripts/course.js`** (inside `start()`, after the state is initialised)
```js
this.offs = [
  this.events.on('score', n => this.addScore(n)),
  this.events.on('pickup', p => this.pickup(p)),
];
```

`on` subscribes to an event and returns an unsubscribe function. `n => this.addScore(n)` is an **arrow function**: when a score arrives, call this instance's method with the supplied number. Storing unsubscribe functions in an array lets you clean them up together.

The existing pickup script emits a numeric `score` event and then `pickup` with `{ kind, value }`. Use score for points and pickup for the number of collected coins. Boss and enemy rewards also emit score, so counting every score event as a coin would make the objective wrong.

Start with these simple methods:

**File: `scripts/course.js`** (add these methods inside the class, beside `start()`)
```js
addScore(n) {
  if (typeof n !== 'number' || n <= 0) return;
  this.score += n;
}

pickup(p) {
  if (p.kind !== 'score') return;
  this.coins++;
  this.remaining += 2;
}
```

`if` runs a condition; `return` exits early. `||` means OR. `+=` adds to an existing value, and `++` adds one. Extend your label to show coins and score using template-string fields.

**Checkpoint:** a coin disappears, increases the coin count by one and adds two seconds. A stomp awards points but does not increase the coin count.

## 5. Build the combo deliberately

The complete version replaces the simple addScore with:

**File: `scripts/course.js`** (replace the simple `addScore` with this one)
```js
addScore(n) {
  if (this.ended || typeof n !== 'number' || n <= 0) return;
  this.combo = this.comboLeft > 0 ? Math.min(5, this.combo + 1) : 1;
  this.comboLeft = this.attrs.comboWindow;
  this.score += n * this.combo;
}
```

Initialize `combo` and `comboLeft` to zero in start. In update, subtract dt from comboLeft and clamp it to zero. When it expires, reset combo to zero. Add these fields using the final source below before testing this step.

`condition ? a : b` is a **conditional expression**: use a when true, otherwise b. A quick second reward advances the multiplier; a reward after the window starts a fresh x1 chain. `Math.min(5, ...)` caps it. The displayed multiplier is at least one even when the internal chain is idle.

**Try:** collect two nearby coins rapidly; the second should score more. Then wait longer than two seconds before taking another. That next reward starts at x1. Change comboWindow to four in Inspector and feel the difference.

## 6. Lives, checkpoint ownership and a fair goal

Subscribe to `died`, `checkpoint` and `game:win` as shown in the final controller. `loseLife()` spends one life and resets the combo. The existing checkpoint scripts already listen for death, heal the hero and return to the last flag after a delay; your controller should not schedule a second competing teleport.

The final checkWin deliberately has two conditions: `bossCleared` and enough collected coins. Defeating the boss first displays how many more coins you need. A later pickup rechecks victory, so the run is not stuck after the boss is gone.

**File: `scripts/course.js`** (add this method inside the class)
```js
checkWin() {
  if (!this.bossCleared) return;
  if (this.coins < this.attrs.requiredCoins) {
    this.notice = `Boss defeated! Find ${this.attrs.requiredCoins - this.coins} more coins.`;
    return;
  }
  this.finish(true, 'Canyon cleared!');
}
```

An **invariant** is a condition your game must always preserve. Here, “the run finishes once” matters: a dying boss can emit events while a pickup is also being processed. `finish()` begins with `if (this.ended) return` and sets ended immediately, so the bonus and save only happen once.

**Checkpoint:** at zero lives you get a retry menu; at zero time you get a different loss message. A living player with eight coins still needs the boss. Boss-first completion remains recoverable.

## 7. Pause without locking the player out

A pause function can stop updates with `this.game.pause()`. A keyboard check inside update would then stop too, so it could never detect the key that resumes the game. Use DOM menu buttons: their click callbacks still run while simulation is paused.

**File: `scripts/course.js`** (inside `start()`, after the HUD exists)
```js
this.ui.menu('course-menu', [
  { text: 'Resume', onClick: () => {
    this.ui.clear('course-menu');
    this.game.resume();
  } },
  { text: 'Restart run', onClick: () => this.restart() },
], { x: 20, y: 195 });
this.ui.show('course-menu');
```

The final pause method ignores clicks after ending or while already paused, preventing duplicate menus. Restart resumes first, then asks Nord to reload the current scene. It does not manually rebuild every coin.

**Checkpoint:** pause for five seconds. The remaining time stays still. Resume moves it again. Restart restores the coins and lives.

## 8. Save the result and clean up

A win adds `ceil(remaining) * 5 + lives * 100` to score, then stores the larger of the old record and current score:

**File: `scripts/course.js`** (inside the method that ends the run)
```js
this.best = Math.max(this.best, this.score);
this.save.set('coin-rush.best', this.best);
```

Load the record in start with `this.save.get('coin-rush.best', 0)`. This is a local best score, not a mid-run save. The key is specific to this game; sharing the generic name `highscore` with another prototype would mix records.

Cleanup is part of game code:

**File: `scripts/course.js`** (add this method inside the class)
```js
onDestroy() {
  this.offs.forEach(off => off());
  this.ui.clear('course');
  this.ui.clear('course-menu');
  this.game.resume();
}
```

`forEach` calls each stored unsubscribe function. Without it, old script instances keep hearing events after Restart, producing duplicate scoring and leaking memory. Clearing custom UI screens prevents old labels remaining over a new run.

## 9. Assemble, debug and export

Replace your teaching version with the **complete course.js below**. The earlier blocks were focused stages, not extra scripts to attach. Keep exactly one CoinRush script on Systems. Save both code and scene, Stop, then Play for a clean start; hot reload does not rerun start, so new state fields need a restart.

Use Console while learning. Temporarily add `console.log('pickup', p)` inside pickup to inspect payloads, then remove it. A red syntax error usually points to a missing brace, quote or comma. An undefined field often means you pasted a method but did not initialize its state in start. A missing HUD usually means the custom screen was not shown. Default changes that appear ineffective may have scene overrides.

Test a full loop: coin → combo → flag → damage/death → respawn → boss → victory → retry. Also test boss-first, no lives and timeout. Finish a win, reload the page and check that Best persists while the run resets.

From the parent folder of your personal project:

**Terminal** (in the folder that contains your project folder):
```sh
nord check my-coin-rush
nord build my-coin-rush --out coin-rush-web --zip
python3 -m http.server 8000 --directory coin-rush-web
```

Open `http://localhost:8000` and test that exported copy. Upload the entire output folder or zip, with index.html at the root. The source zip below instead belongs in Nord so you can inspect and change it.

**Experiment:** change requiredCoins to twelve, increase the first-life time allowance, or award three seconds per coin. Predict the result before editing, then compare it with Play. Keep the invariant that every legal order of boss and coins can reach victory.

## Complete game source

The first file below is every line of the custom game controller. The remaining disclosures contain **all other text source files** in the finished project, including inherited JavaScript, project/scene JSON, map data, HTML and asset metadata. Art/audio binaries are included in the [complete source download](assets/downloads/coin-rush-source.zip). Copying course.js alone still requires the Platformer foundation and the two attachment removals described in step 1.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

### scripts/course.js

**File: `scripts/course.js`** (the complete file, for comparison)
```js
import { NordScript } from 'nord';

export default class CoinRush extends NordScript {
  static attributes = {
    seconds: { type: 'number', default: 150, min: 10 },
    lives: { type: 'int', default: 3, min: 1 },
    requiredCoins: { type: 'int', default: 8, min: 1 },
    comboWindow: { type: 'number', default: 2, min: 0.1 },
  };

  start() {
    this.remaining = this.attrs.seconds;
    this.lives = this.attrs.lives;
    this.coins = 0;
    this.score = 0;
    this.combo = 0;
    this.comboLeft = 0;
    this.bossCleared = false;
    this.ended = false;
    this.best = this.save.get('coin-rush.best', 0);
    this.notice = `Collect ${this.attrs.requiredCoins} coins, then defeat the boss. Shift/K dashes.`;
    this.hud = this.ui.label('', { screen: 'course', x: 12, y: 55, size: 14, style: { whiteSpace: 'pre-wrap', maxWidth: '95%' } });
    this.pauseButton = this.ui.button('Pause', () => this.pause(), {
      screen: 'course', x: 12, y: 105,
    });
    this.offs = [
      this.events.on('score', n => this.addScore(n)),
      this.events.on('pickup', p => this.pickup(p)),
      this.events.on('died', () => this.loseLife()),
      this.events.on('checkpoint', () => { this.notice = 'Checkpoint activated!'; }),
      this.events.on('game:win', () => { this.bossCleared = true; this.checkWin(); }),
    ];
    this.ui.show('course');
    this.draw();
  }

  addScore(n) {
    if (this.ended || typeof n !== 'number' || n <= 0) return;
    this.combo = this.comboLeft > 0 ? Math.min(5, this.combo + 1) : 1;
    this.comboLeft = this.attrs.comboWindow;
    this.score += n * this.combo;
  }

  pickup(p) {
    if (this.ended || p.kind !== 'score') return;
    this.coins++;
    this.remaining += 2;
    this.notice = '+2 seconds! Keep the combo alive.';
    this.checkWin();
  }

  loseLife() {
    if (this.ended) return;
    this.lives--;
    this.comboLeft = 0;
    this.combo = 0;
    this.notice = 'Life lost. Returning to your last flag.';
    if (this.lives <= 0) this.finish(false, 'No lives left');
    // Existing checkpoint scripts heal and return the hero after a short delay.
  }

  checkWin() {
    if (!this.bossCleared) return;
    if (this.coins < this.attrs.requiredCoins) {
      this.notice = `Boss defeated! Find ${this.attrs.requiredCoins - this.coins} more coins.`;
      return;
    }
    this.finish(true, 'Canyon cleared!');
  }

  update(dt) {
    if (this.ended) return;
    this.remaining = Math.max(0, this.remaining - dt);
    this.comboLeft = Math.max(0, this.comboLeft - dt);
    if (this.comboLeft === 0) this.combo = 0;
    if (this.remaining === 0) this.finish(false, 'Time ran out');
    this.draw();
  }

  draw() {
    this.hud.set(`Time ${Math.ceil(this.remaining)} | Lives ${this.lives} | ` +
      `Coins ${this.coins}/${this.attrs.requiredCoins} | Score ${this.score} | ` +
      `Combo x${Math.max(1, this.combo)} | Best ${this.best}\n${this.notice}`);
  }

  pause() {
    if (this.ended || this.game.paused) return;
    this.ui.show('course-menu');
    this.game.pause();
    this.ui.label('Paused', { screen: 'course-menu', x: 20, y: 150, size: 32 });
    this.ui.menu('course-menu', [
      { text: 'Resume', onClick: () => { this.ui.clear('course-menu'); this.game.resume(); } },
      { text: 'Restart run', onClick: () => this.restart() },
    ], { x: 20, y: 195 });
  }

  finish(won, title) {
    if (this.ended) return;
    this.ended = true;
    if (won) {
      this.score += Math.ceil(this.remaining) * 5 + this.lives * 100;
      this.best = Math.max(this.best, this.score);
      this.save.set('coin-rush.best', this.best);
    }
    this.draw();
    this.ui.clear('course-menu');
    this.ui.label(`${title} — score ${this.score}`, {
      screen: 'course-menu', x: 20, y: 150, size: 28,
    });
    this.ui.menu('course-menu', [
      { text: 'Try again', onClick: () => this.restart() },
    ], { x: 20, y: 195 });
    this.ui.show('course-menu');
    this.game.pause();
  }

  restart() {
    this.game.resume();
    this.game.restart();
  }

  onDestroy() {
    this.offs.forEach(off => off());
    this.ui.clear('course');
    this.ui.clear('course-menu');
    this.game.resume();
  }
}
```

<details>
<summary>Complete assets/maps/level.tilemap.json</summary>

**File: `assets/maps/level.tilemap.json`** (the complete file, for comparison)
```json
{
  "tileset": "assets/sprites/tileset_platformer.png",
  "tileWidth": 16,
  "tileHeight": 16,
  "collides": [
    0,
    3
  ],
  "layers": [
    {
      "name": "ground",
      "data": [
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1,
          -1
        ],
        [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          -1,
          -1,
          -1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ],
        [
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3
        ],
        [
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3
        ],
        [
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3
        ],
        [
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          -1,
          -1,
          -1,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3,
          3
        ]
      ]
    }
  ]
}
```

</details>

<details>
<summary>Complete assets/sprites/coin.png.meta.json</summary>

**File: `assets/sprites/coin.png.meta.json`** (the complete file, for comparison)
```json
{
  "type": "spritesheet",
  "frameWidth": 16,
  "frameHeight": 16,
  "filter": "nearest",
  "anims": {
    "spin": {
      "frames": [
        0,
        1,
        2,
        3,
        4,
        5
      ],
      "fps": 10,
      "loop": true
    }
  }
}
```

</details>

<details>
<summary>Complete assets/sprites/enemy_slime.png.meta.json</summary>

**File: `assets/sprites/enemy_slime.png.meta.json`** (the complete file, for comparison)
```json
{
  "type": "spritesheet",
  "frameWidth": 32,
  "frameHeight": 32,
  "filter": "nearest",
  "anims": {
    "idle": {
      "frames": [
        0,
        1,
        2,
        1
      ],
      "fps": 6,
      "loop": true
    }
  }
}
```

</details>

<details>
<summary>Complete assets/sprites/flag.png.meta.json</summary>

**File: `assets/sprites/flag.png.meta.json`** (the complete file, for comparison)
```json
{
  "type": "spritesheet",
  "frameWidth": 16,
  "frameHeight": 32,
  "filter": "nearest",
  "anims": {
    "wave": {
      "frames": [
        0,
        1,
        2,
        3
      ],
      "fps": 6,
      "loop": true
    }
  }
}
```

</details>

<details>
<summary>Complete assets/sprites/hero.png.meta.json</summary>

**File: `assets/sprites/hero.png.meta.json`** (the complete file, for comparison)
```json
{
  "type": "spritesheet",
  "frameWidth": 32,
  "frameHeight": 32,
  "filter": "nearest",
  "anims": {
    "idle": {
      "frames": [
        0,
        1
      ],
      "fps": 3,
      "loop": true
    },
    "walk": {
      "frames": [
        2,
        3,
        4,
        5
      ],
      "fps": 10,
      "loop": true
    },
    "jump": {
      "frames": [
        6
      ],
      "fps": 1,
      "loop": false
    },
    "hurt": {
      "frames": [
        7
      ],
      "fps": 1,
      "loop": false
    }
  }
}
```

</details>

<details>
<summary>Complete assets/sprites/tileset_platformer.png.meta.json</summary>

**File: `assets/sprites/tileset_platformer.png.meta.json`** (the complete file, for comparison)
```json
{
  "type": "tileset",
  "tileWidth": 16,
  "tileHeight": 16,
  "filter": "nearest",
  "columns": 8,
  "layout": "cols: top, top-left, top-right, mid, left, right, bottom, platform; rows: grass, stone, sand, snow"
}
```

</details>

<details>
<summary>Complete index.html</summary>

**File: `index.html`** (the complete file, for comparison)
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coin Rush — code workshop</title>
<style>html,body{margin:0;height:100%;background:#101418;overflow:hidden}#stage{position:relative;width:100vw;height:100vh}</style>
<script type="importmap">{"imports":{"nord":"/runtime/core/index.js"}}</script></head>
<body><div id="stage"></div>
<script src="/vendor/phaser/phaser.min.js"></script>
<script type="module">
import { boot } from '/runtime/phaser/index.js';
try {
  const project = await (await fetch('nord.project.json')).json();
  await boot(project, { container: document.getElementById('stage') });
  window.__nord_ready = true;
} catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete nord.project.json</summary>

**File: `nord.project.json`** (the complete file, for comparison)
```json
{
  "format": 1,
  "name": "Coin Rush — code workshop",
  "id": "com.crowelian.coinrush",
  "type": "2d",
  "engineVersion": "0.1.0",
  "startScene": "scenes/main.scene.json",
  "display": {
    "width": 640,
    "height": 360,
    "scale": "fit",
    "pixelArt": true,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "arcade",
    "gravity": [
      0,
      900,
      0
    ]
  },
  "input": {
    "actions": {
      "left": [
        "KeyA",
        "ArrowLeft"
      ],
      "right": [
        "KeyD",
        "ArrowRight"
      ],
      "up": [
        "KeyW",
        "ArrowUp"
      ],
      "down": [
        "KeyS",
        "ArrowDown"
      ],
      "jump": [
        "Space",
        "KeyW",
        "ArrowUp"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
      ],
      "dash": [
        "ShiftLeft",
        "KeyK"
      ]
    }
  },
  "plugins": [
    "ui",
    "audio"
  ],
  "ui": {
    "skin": "cyber",
    "theme": "tokyo-night"
  }
}
```

</details>

<details>
<summary>Complete scenes/main.scene.json</summary>

**File: `scenes/main.scene.json`** (the complete file, for comparison)
```json
{
  "format": 1,
  "name": "main",
  "settings": {
    "ambient": "#ffffff"
  },
  "entities": [
    {
      "id": "eeeeeee1",
      "name": "Sky",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          -100
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "parallax",
          "texture": "assets/sprites/bg_sky.png",
          "factor": [
            0,
            0
          ]
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee2",
      "name": "Hills",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          -90
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "parallax",
          "texture": "assets/sprites/bg_hills_far.png",
          "factor": [
            0.3,
            0
          ]
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee3",
      "name": "Level",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          -1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "tilemap",
          "map": "assets/maps/level.tilemap.json",
          "tileset": "assets/sprites/tileset_platformer.png"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee4",
      "name": "Hero",
      "enabled": true,
      "tags": [
        "player"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          48,
          250,
          2
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/hero.png",
          "anim": "idle"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "mass": 1
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            14,
            28
          ],
          "offset": [
            9,
            4
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/platformer2d.js",
          "attributes": {
            "speed": 130,
            "jumpForce": 340,
            "wallSlide": false,
            "dash": true,
            "dashSpeed": 280
          }
        },
        {
          "path": "scripts/health.js",
          "attributes": {
            "max": 3,
            "deathEvent": "died",
            "invulnTime": 1
          }
        },
        {
          "path": "scripts/hero-fx.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee5",
      "name": "Coin0",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          230,
          260,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee6",
      "name": "Coin1",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          262,
          215,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee7",
      "name": "Coin2",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          298,
          215,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee8",
      "name": "Coin3",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          334,
          215,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeee9",
      "name": "Coin4",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          500,
          180,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeea",
      "name": "Coin5",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          540,
          180,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeeb",
      "name": "Coin6",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          580,
          180,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeec",
      "name": "Coin7",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          640,
          196,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeed",
      "name": "Coin8",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          700,
          196,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeee",
      "name": "Coin9",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          960,
          215,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeef",
      "name": "Coin10",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1000,
          215,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeeg",
      "name": "Coin11",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1040,
          180,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeeh",
      "name": "Coin12",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1130,
          260,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeei",
      "name": "Coin13",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1170,
          260,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeej",
      "name": "Coin14",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1250,
          196,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeek",
      "name": "Coin15",
      "enabled": true,
      "tags": [
        "coin"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1300,
          156,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/coin.png",
          "anim": "spin"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            12,
            12
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/pickup.js",
          "attributes": {
            "kind": "score",
            "value": 10,
            "bob": 0,
            "sfx": "assets/audio/sfx/coin.wav"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeel",
      "name": "Slime",
      "enabled": true,
      "tags": [
        "enemy"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          300,
          268,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/enemy_slime.png",
          "anim": "idle"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "fixedRotation": true
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            20,
            14
          ],
          "offset": [
            6,
            14
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/ai-patrol.js",
          "attributes": {
            "speed": 35,
            "distance": 90
          }
        },
        {
          "path": "scripts/enemy.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeem",
      "name": "Slime",
      "enabled": true,
      "tags": [
        "enemy"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          520,
          268,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/enemy_slime.png",
          "anim": "idle"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "fixedRotation": true
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            20,
            14
          ],
          "offset": [
            6,
            14
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/ai-patrol.js",
          "attributes": {
            "speed": 35,
            "distance": 90
          }
        },
        {
          "path": "scripts/enemy.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeen",
      "name": "Slime",
      "enabled": true,
      "tags": [
        "enemy"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          760,
          268,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/enemy_slime.png",
          "anim": "idle"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "fixedRotation": true
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            20,
            14
          ],
          "offset": [
            6,
            14
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/ai-patrol.js",
          "attributes": {
            "speed": 35,
            "distance": 90
          }
        },
        {
          "path": "scripts/enemy.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeeo",
      "name": "Slime",
      "enabled": true,
      "tags": [
        "enemy"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1100,
          268,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/enemy_slime.png",
          "anim": "idle"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "fixedRotation": true
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            20,
            14
          ],
          "offset": [
            6,
            14
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/ai-patrol.js",
          "attributes": {
            "speed": 35,
            "distance": 90
          }
        },
        {
          "path": "scripts/enemy.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeep",
      "name": "Boss",
      "enabled": true,
      "tags": [
        "enemy"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          1380,
          268,
          1
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          2,
          2,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/enemy_slime.png",
          "anim": "idle"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "fixedRotation": true
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            20,
            14
          ],
          "offset": [
            6,
            14
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/ai-patrol.js",
          "attributes": {
            "speed": 40,
            "distance": 120
          }
        },
        {
          "path": "scripts/boss.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeeq",
      "name": "Checkpoint",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          720,
          256,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/flag.png",
          "anim": "wave"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            16,
            32
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/checkpoint.js",
          "attributes": {
            "killY": 400
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeer",
      "name": "Checkpoint",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          1290,
          256,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "animatedSprite",
          "texture": "assets/sprites/flag.png",
          "anim": "wave"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            16,
            32
          ],
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/checkpoint.js",
          "attributes": {
            "killY": 400
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeees",
      "name": "Camera",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          320,
          180,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "camera",
          "zoom": 1,
          "bounds": [
            0,
            0,
            1600,
            368
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/camera-follow.js",
          "attributes": {
            "target": "Hero",
            "smoothing": 7,
            "bounds": [
              0,
              0,
              1600,
              368
            ],
            "lookAhead": 24
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeet",
      "name": "Systems",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [],
      "scripts": [
        {
          "path": "scripts/ui-hud.js",
          "attributes": {
            "target": "Hero",
            "style": "hearts",
            "coins": false
          }
        },
        {
          "path": "scripts/util-sfx.js",
          "attributes": {}
        },
        {
          "path": "scripts/fx-hitstop.js",
          "attributes": {}
        },
        {
          "path": "scripts/course.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    }
  ]
}
```

</details>

<details>
<summary>Complete scripts/ai-patrol.js</summary>

**File: `scripts/ai-patrol.js`** (the complete file, for comparison)
```js
// @nord {"id":"ai.patrol","title":"Enemy AI: patrol","category":"ai","tier":["2d"],"tags":["enemy","patrol","platformer"],"requires":["rigidbody"],"description":"Walks back and forth over a distance, turning at walls/ledge ends (checks ground ahead with overlapBox) and pauses at the ends."}
import { NordScript } from 'nord';

export default class Patrol extends NordScript {
  static attributes = { speed: { type: 'number', default: 50 }, distance: { type: 'number', default: 96 }, pause: { type: 'number', default: 0.5 }, ledgeCheck: { type: 'bool', default: true } };
  start() { this.x0 = this.entity.pos[0]; this.dir = 1; this.wait = 0; this.sprite = this.entity.getComponent('animatedSprite') ?? this.entity.getComponent('sprite'); }
  fixedUpdate(dt) {
    if (this.entity.stunned) return;
    if (this.wait > 0) { this.wait -= dt; this.physics.setVelocity(this.entity, 0, null); return; }
    const x = this.entity.pos[0], far = Math.abs(x - this.x0) > this.attrs.distance / 2 && Math.sign(x - this.x0) === this.dir;
    const ahead = this.attrs.ledgeCheck && this.physics.isGrounded(this.entity) && !(this.physics.overlapBox?.(x + this.dir * 14, this.entity.pos[1] + 15, 4, 6)?.filter((o) => o !== this.entity).length ?? 1);
    if (far || ahead) { this.dir = -this.dir; this.wait = this.attrs.pause; return; }
    this.sprite?.setFlip?.(this.dir < 0);
    this.physics.setVelocity(this.entity, this.dir * this.attrs.speed * (this.entity.speedMul ?? 1), null);
  }
  onCollisionEnter(o) { if (!o.hasTag('player') && Math.abs(o.pos[1] - this.entity.pos[1]) < 12) this.dir = -this.dir; }
}
```

</details>

<details>
<summary>Complete scripts/boss.js</summary>

**File: `scripts/boss.js`** (the complete file, for comparison)
```js
import Enemy from './enemy.js';

export default class Boss extends Enemy {
  static attributes = { ...Enemy.attributes, hp: { type: 'int', default: 5 }, damage: { type: 'number', default: 2 } };
  hurt() {
    this.game.camera?.shake?.(200, 0.01); this.physics.setVelocity(this.entity, null, -120);
    super.hurt();
    if (this.hp <= 0) { this.events.emit('score', 200); this.after(0.6, () => this.events.emit('game:win')); }
  }
}
```

</details>

<details>
<summary>Complete scripts/camera-follow.js</summary>

**File: `scripts/camera-follow.js`** (the complete file, for comparison)
```js
// @nord {"id":"camera.follow","title":"Camera follow (lerp + deadzone + look-ahead)","category":"camera","tier":["2d"],"tags":["camera","follow","deadzone"],"description":"Put on the camera entity (its position is the view centre; remove the camera's own 'follow'): smoothly follows a target (by name or tag) with a deadzone and optional look-ahead in the movement direction, clamped to world bounds."}
import { NordScript } from 'nord';

export default class CameraFollow extends NordScript {
  static attributes = {
    target: { type: 'string', default: 'Player', label: 'Target entity name (or tag if no name matches)' },
    smoothing: { type: 'number', default: 6, min: 0, label: 'Follow speed (0 = snap)' },
    deadzone: { type: 'vec2', default: [24, 16] },
    lookAhead: { type: 'number', default: 0, min: 0, label: 'Look-ahead distance (px)' },
    bounds: { type: 'array', default: [], label: 'World bounds [minX,minY,maxX,maxY] (empty = none)' },
    viewport: { type: 'vec2', default: [640, 360] },
  };
  start() {
    const t = this.scene.find(this.attrs.target) ?? this.scene.findByTag(this.attrs.target)[0];
    this.t = t; this.pos = t ? [t.pos[0], t.pos[1]] : [0, 0]; this.last = t ? [...t.pos] : [0, 0, 0]; this.ahead = 0;
    this.entity.pos = [...this.pos, this.entity.pos[2]];
  }
  lateUpdate(dt) {
    const t = this.t; if (!t || t.destroyed) return;
    const a = this.attrs, dx = t.pos[0] - this.last[0];
    this.last = [...t.pos];
    this.ahead += ((Math.sign(dx) * a.lookAhead || (dx === 0 ? this.ahead : 0)) - this.ahead) * Math.min(1, 4 * dt);
    const gx = t.pos[0] + this.ahead, gy = t.pos[1];
    let tx = this.pos[0], ty = this.pos[1];
    if (Math.abs(gx - tx) > a.deadzone[0]) tx = gx - Math.sign(gx - tx) * a.deadzone[0];
    if (Math.abs(gy - ty) > a.deadzone[1]) ty = gy - Math.sign(gy - ty) * a.deadzone[1];
    const k = a.smoothing ? Math.min(1, a.smoothing * dt) : 1;
    this.pos[0] += (tx - this.pos[0]) * k; this.pos[1] += (ty - this.pos[1]) * k;
    let [x, y] = this.pos;
    if (a.bounds.length === 4) {
      const hw = a.viewport[0] / 2, hh = a.viewport[1] / 2;
      x = Math.max(a.bounds[0] + hw, Math.min(a.bounds[2] - hw, x)); y = Math.max(a.bounds[1] + hh, Math.min(a.bounds[3] - hh, y));
    }
    this.entity.pos = [x, y, this.entity.pos[2]];
  }
}
```

</details>

<details>
<summary>Complete scripts/checkpoint.js</summary>

**File: `scripts/checkpoint.js`** (the complete file, for comparison)
```js
// @nord {"id":"gameplay.checkpoint","title":"Checkpoints & respawn","category":"gameplay","tier":["2d","3d"],"tags":["checkpoint","respawn"],"requires":["trigger"],"description":"Put on every checkpoint trigger entity: touching one sets the respawn point; when the global 'died' event fires (or y passes killY) the player is moved back and healed after a delay. Emits 'checkpoint' and 'respawned'."}
import { NordScript } from 'nord';

export default class Checkpoint extends NordScript {
  static attributes = { tag: { type: 'string', default: 'player' }, respawnEvent: { type: 'string', default: 'died' }, killY: { type: 'number', default: 1e9, label: 'Respawn when player y exceeds this (2D, y down)' }, delay: { type: 'number', default: 0.8 } };
  start() {
    this.player = this.scene.findByTag(this.attrs.tag)[0]; this.point = this.player ? [...this.player.pos] : null;
    this.offs = [this.events.on('checkpoint', (pos) => { this.point = [...pos]; }), this.events.on(this.attrs.respawnEvent, () => this.after(this.attrs.delay, () => this.respawn()))];
  }
  onDestroy() { this.offs.forEach((o) => o()); }
  onTriggerEnter(o) { if (o.hasTag(this.attrs.tag)) { this.events.emit('checkpoint', this.entity.pos); this.entity.emit('activated'); } }
  update() { if (this.player && this.player.pos[1] > this.attrs.killY) this.respawn(); }
  respawn() {
    if (!this.player || !this.point) return; this.player.pos = [...this.point]; this.physics.setVelocity?.(this.player, 0, 0);
    this.player.emit('heal', { amount: 999 }); this.events.emit('respawned', this.player);
  }
}
```

</details>

<details>
<summary>Complete scripts/enemy.js</summary>

**File: `scripts/enemy.js`** (the complete file, for comparison)
```js
import { NordScript } from 'nord';

// Contact rules: land on top of it (falling) → it dies and you bounce; touch it from the side → you take damage.
export default class Enemy extends NordScript {
  static attributes = { hp: { type: 'int', default: 1 }, damage: { type: 'number', default: 1 }, bounce: { type: 'number', default: 260 } };
  start() { this.hp = this.attrs.hp; }
  onCollisionEnter(o) {
    if (!o.hasTag('player')) return;
    const [, vy] = this.physics.velocity(o), above = o.pos[1] < this.entity.pos[1] - 6 * this.entity.scale[1];
    if (above && vy >= 0) { this.physics.setVelocity(o, null, -this.attrs.bounce); this.hurt(); } else o.emit('damage', { amount: this.attrs.damage, from: this.entity });
  }
  hurt() {
    this.events.emit('sfx', 'hit'); this.events.emit('hitstop', 40);
    if (--this.hp > 0) return;
    this.events.emit('score', 25); this.entity.emit('death'); this.entity.destroy();
  }
}
```

</details>

<details>
<summary>Complete scripts/fx-hitstop.js</summary>

**File: `scripts/fx-hitstop.js`** (the complete file, for comparison)
```js
// @nord {"id":"fx.hitstop-slowmo","title":"Hit-stop, slow-mo, flash","category":"fx","tier":["2d","3d"],"tags":["juice","hitstop","slowmo","flash"],"description":"Game-feel events: 'hitstop' (ms) freezes time briefly, 'slowmo' ({scale,time}) eases timeScale, 'flash' flashes the screen. Also reacts to the global 'hit' event with a tiny hit-stop."}
import { NordScript } from 'nord';

export default class Juice extends NordScript {
  static attributes = { hitStopOnHit: { type: 'number', default: 50, min: 0, label: 'ms of hit-stop on "hit"' }, flashColor: { type: 'color', default: '#ffffff' } };
  start() {
    this.offs = [this.events.on('hitstop', (ms) => this.stop(ms)), this.events.on('hit', () => this.attrs.hitStopOnHit && this.stop(this.attrs.hitStopOnHit)),
      this.events.on('slowmo', ({ scale = 0.3, time = 1 } = {}) => { this.game.timeScale = scale; setTimeout(() => { const o = { s: scale }; this.scene.scheduler.tween(o, { s: 1 }, { duration: 0.4, onUpdate: () => { this.game.timeScale = o.s; } }); }, time * 1000); }),
      this.events.on('flash', (ms = 120) => this.game.camera?.flash?.(ms, this.attrs.flashColor))];
  }
  onDestroy() { this.offs.forEach((o) => o()); this.game.timeScale = 1; }
  stop(ms) { const prev = this.game.timeScale || 1; if (this.frozen) return; this.frozen = true; this.game.timeScale = 0.0001; setTimeout(() => { this.game.timeScale = prev; this.frozen = false; }, ms); }
}
```

</details>

<details>
<summary>Complete scripts/health.js</summary>

**File: `scripts/health.js`** (the complete file, for comparison)
```js
// @nord {"id":"gameplay.health","title":"Health & damage","category":"gameplay","tier":["2d","3d"],"tags":["health","damage","invulnerable","game-ready"],"description":"Hit points with damage/heal, invulnerability frames with blink, death handling. Listens for the entity 'damage' event {amount}; emits 'health' {hp,max} on the entity and global 'died' when it hits 0."}
import { NordScript } from 'nord';

export default class Health extends NordScript {
  static attributes = {
    max: { type: 'number', default: 5, min: 1 },
    invulnTime: { type: 'number', default: 0.8, min: 0 },
    destroyOnDeath: { type: 'bool', default: false },
    barName: { type: 'string', default: '', label: 'Name of a uiBar entity to update' },
    deathEvent: { type: 'string', default: 'died' },
  };
  start() {
    this.hp = this.attrs.max; this.inv = 0;
    this.entity.on('damage', (d) => this.damage(d?.amount ?? 1, d?.from));
    this.entity.on('heal', (d) => this.heal(d?.amount ?? 1));
    this.bar = this.attrs.barName ? this.scene.find(this.attrs.barName) : null; this.#sync();
  }
  update(dt) {
    if (this.inv <= 0) return;
    this.inv -= dt; this.entity.set('sprite', 'alpha', this.inv > 0 && Math.floor(this.inv * 20) % 2 ? 0.3 : 1);
  }
  damage(n, from) {
    if (this.inv > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - n); this.inv = this.attrs.invulnTime; this.#sync();
    this.events.emit('hit', n);
    if (this.hp === 0) { this.entity.emit('death', from); this.events.emit(this.attrs.deathEvent, this.entity); if (this.attrs.destroyOnDeath) this.entity.destroy(); }
    return true;
  }
  heal(n) { this.hp = Math.min(this.attrs.max, this.hp + n); this.#sync(); }
  #sync() { this.entity.emit('health', { hp: this.hp, max: this.attrs.max }); this.bar?.set('uiBar', 'value', this.hp / this.attrs.max); }
}
```

</details>

<details>
<summary>Complete scripts/hero-fx.js</summary>

**File: `scripts/hero-fx.js`** (the complete file, for comparison)
```js
import { NordScript } from 'nord';

// Hero animation + sound glue (kept separate from the movement controller on purpose).
export default class HeroFx extends NordScript {
  start() { this.sprite = this.entity.getComponent('animatedSprite'); this.off = [this.events.on('jump', () => this.audio.play('assets/audio/sfx/coin.wav', { volume: 0.2 }))]; }
  onDestroy() { this.off?.forEach((o) => o()); }
  update() {
    const g = this.physics.isGrounded(this.entity), dir = this.input.axis('left', 'right'), want = this.entity.stunned ? 'hurt' : !g ? 'jump' : dir ? 'walk' : 'idle';
    if (want !== this.sprite.current) this.sprite.play(want);
  }
}
```

</details>

<details>
<summary>Complete scripts/mk.js</summary>

**File: `scripts/mk.js`** (the complete file, for comparison)
```js
// Tiny helpers to spawn coloured rectangles / circles / text at runtime (placeholder art). Generated by tools/gen_examples.mjs.
const base = (name, x, y, z, tags, comps) => ({ name, tags: tags ?? [], transform: { pos: [x, y, z ?? 0], rot: [0, 0, 0], scale: [1, 1, 1] }, components: comps, scripts: [], children: [] });
export const rectData = (name, x, y, w, h, color, o = {}) => base(name, x, y, o.z, o.tags, [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [w, h], tint: color, alpha: o.alpha ?? 1 }]);
export const circleData = (name, x, y, d, color, o = {}) => base(name, x, y, o.z, o.tags, [{ type: 'sprite', texture: 'assets/sprites/circle.png', size: [d, d], tint: color, alpha: o.alpha ?? 1 }]);
export const textData = (name, x, y, t, o = {}) => base(name, x, y, o.z ?? 50, o.tags, [{ type: 'text', text: t, size: o.size ?? 20, color: o.color ?? '#eceff4' }]);
export const rect = (scene, ...a) => scene.spawnData(rectData(...a));
export const circle = (scene, ...a) => scene.spawnData(circleData(...a));
export const label = (scene, ...a) => scene.spawnData(textData(...a));
export const aabb = (a, b) => Math.abs(a.pos[0] - b.pos[0]) * 2 < a.w + b.w && Math.abs(a.pos[1] - b.pos[1]) * 2 < a.h + b.h;
```

</details>

<details>
<summary>Complete scripts/pickup.js</summary>

**File: `scripts/pickup.js`** (the complete file, for comparison)
```js
// @nord {"id":"gameplay.pickup","title":"Pickups & power-ups","category":"gameplay","tier":["2d","3d"],"tags":["coin","pickup","powerup","game-ready"],"requires":["trigger"],"description":"Put on collectible entities: when the player touches it, emits a global event (default 'score' + value), or applies a power-up (heal / speed / shield via entity events), plays a sound and disappears with a pop tween. Magnetises toward the player when close."}
import { NordScript } from 'nord';

export default class Pickup extends NordScript {
  static attributes = { kind: { type: 'enum', options: ['score', 'heal', 'speed', 'shield', 'xp', 'custom'], default: 'score' }, value: { type: 'number', default: 10 }, duration: { type: 'number', default: 5 }, event: { type: 'string', default: '', label: 'Custom global event' }, sfx: { type: 'asset', assetType: 'audio', default: '' }, tag: { type: 'string', default: 'player' }, magnet: { type: 'number', default: 0, label: 'Magnet radius' }, bob: { type: 'number', default: 3 } };
  start() { this.y0 = this.entity.pos[1]; this.t = this.rng.range(0, 6); this.taken = false; }
  update(dt) {
    const a = this.attrs, e = this.entity; this.t += dt;
    const p = a.magnet && this.scene.findByTag(a.tag)[0];
    if (p && Math.hypot(p.pos[0] - e.pos[0], p.pos[1] - e.pos[1]) < a.magnet) { const dx = p.pos[0] - e.pos[0], dy = p.pos[1] - e.pos[1], d = Math.hypot(dx, dy) || 1; e.pos = [e.pos[0] + (dx / d) * 220 * dt, e.pos[1] + (dy / d) * 220 * dt, e.pos[2]]; this.y0 = e.pos[1]; }
    else if (a.bob) e.pos = [e.pos[0], this.y0 + Math.sin(this.t * 4) * a.bob, e.pos[2]];
  }
  onTriggerEnter(o) {
    if (this.taken || !o.hasTag(this.attrs.tag)) return; this.taken = true; const a = this.attrs;
    if (a.kind === 'score') this.events.emit('score', a.value); else if (a.kind === 'xp') this.events.emit('xp', a.value); else if (a.kind === 'heal') o.emit('heal', { amount: a.value });
    else if (a.kind === 'speed') o.emit('apply', { type: 'haste', duration: a.duration, power: 1 }); else if (a.kind === 'shield') o.emit('shield', a.duration);
    else if (a.event) this.events.emit(a.event, o);
    if (a.sfx) this.audio.play(a.sfx); this.events.emit('pickup', { kind: a.kind, value: a.value });
    const s = { k: 1 }; this.tween(s, { k: 1.6 }, { duration: 0.12, onUpdate: () => { this.entity.scale = [s.k, s.k, s.k]; }, onComplete: () => this.entity.destroy() });
  }
}
```

</details>

<details>
<summary>Complete scripts/platformer2d.js</summary>

**File: `scripts/platformer2d.js`** (the complete file, for comparison)
```js
// @nord {"id":"controller.platformer2d","title":"Platformer 2D","category":"controllers","tier":["2d"],"tags":["platformer","jump","game-ready"],"requires":["rigidbody","collider"],"description":"Side-scroller controller: run, coyote time, jump buffer, variable jump height, wall slide/jump and dash. Needs actions left/right/jump (+ optional dash)."}
import { NordScript } from 'nord';

export default class Platformer2D extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 180, min: 0, label: 'Run speed' },
    jumpForce: { type: 'number', default: 420, min: 0 },
    coyoteTime: { type: 'number', default: 0.1, min: 0, label: 'Coyote time (s)' },
    jumpBuffer: { type: 'number', default: 0.12, min: 0, label: 'Jump buffer (s)' },
    cutJump: { type: 'number', default: 0.5, min: 0, max: 1, label: 'Velocity kept when jump released early' },
    wallSlide: { type: 'bool', default: false },
    wallSlideSpeed: { type: 'number', default: 60, min: 0 },
    dash: { type: 'bool', default: false },
    dashSpeed: { type: 'number', default: 420, min: 0 },
    dashTime: { type: 'number', default: 0.14, min: 0 },
    dashCooldown: { type: 'number', default: 0.6, min: 0 },
  };

  start() {
    this.coyote = 0; this.buffer = 0; this.dashLeft = 0; this.dashCd = 0; this.facing = 1; this.jumping = false;
    this.sprite = this.entity.getComponent('animatedSprite') ?? this.entity.getComponent('sprite');
  }

  fixedUpdate(dt) {
    const a = this.attrs, p = this.physics, e = this.entity;
    const dir = this.input.axis('left', 'right');
    const grounded = p.isGrounded(e);
    const [, vy] = p.velocity(e);
    this.coyote = grounded ? a.coyoteTime : this.coyote - dt;
    this.buffer = this.input.pressed('jump') ? a.jumpBuffer : this.buffer - dt;
    this.dashCd -= dt;
    if (dir) { this.facing = dir; this.sprite?.setFlip?.(dir < 0); }

    if (a.dash && this.dashCd <= 0 && this.input.pressed('dash')) { this.dashLeft = a.dashTime; this.dashCd = a.dashCooldown; this.events.emit('dash', e); }
    if (this.dashLeft > 0) { this.dashLeft -= dt; p.setVelocity(e, this.facing * a.dashSpeed, 0); return; }

    p.setVelocity(e, dir * a.speed, null);
    if (this.buffer > 0 && this.coyote > 0) {
      p.setVelocity(e, null, -a.jumpForce); this.buffer = 0; this.coyote = 0; this.jumping = true; this.events.emit('jump', e);
    } else if (this.jumping && vy < 0 && !this.input.down('jump')) { p.setVelocity(e, null, vy * a.cutJump); this.jumping = false; }
    if (grounded) this.jumping = false;
    if (a.wallSlide && !grounded && dir && vy > a.wallSlideSpeed) {
      const w = p.overlapBox?.(e.pos[0] + dir * 10, e.pos[1], 4, 12)?.filter((o) => o !== e) ?? [];
      if (w.some?.((o) => o !== e && !o.getComponent?.('collider')?.data.trigger)) {
        p.setVelocity(e, null, a.wallSlideSpeed);
        if (this.input.pressed('jump')) { p.setVelocity(e, -dir * a.speed, -a.jumpForce); this.facing = -dir; }
      }
    }
  }
}
```

</details>

<details>
<summary>Complete scripts/score.js</summary>

**File: `scripts/score.js`** (the complete file, for comparison)
```js
// @nord {"id":"gameplay.score","title":"Score, combo & high score","category":"gameplay","tier":["2d","3d"],"tags":["score","combo","highscore","hud","game-ready"],"requires":["ui"],"description":"Score counter with a combo multiplier that decays, persistent high score and a HUD label. Add points via the global event 'score' (number) or addScore(n)."}
import { NordScript } from 'nord';

export default class Score extends NordScript {
  static attributes = { comboWindow: { type: 'number', default: 2, min: 0 }, maxCombo: { type: 'int', default: 8, min: 1 }, hud: { type: 'bool', default: true }, x: { type: 'number', default: 12 }, y: { type: 'number', default: 8 }, saveKey: { type: 'string', default: 'highscore' } };
  start() {
    this.score = 0; this.combo = 1; this.t = 0; this.high = this.save.get(this.attrs.saveKey, 0);
    this.off = this.events.on('score', (n) => this.addScore(typeof n === 'number' ? n : 1));
    this.label = this.attrs.hud ? this.ui.label('', { screen: 'hud', x: this.attrs.x, y: this.attrs.y, size: 22 }) : null; this.#draw();
  }
  onDestroy() { this.off?.(); this.label?.remove(); }
  addScore(n) {
    this.score += n * this.combo; this.combo = Math.min(this.attrs.maxCombo, this.combo + 1); this.t = this.attrs.comboWindow;
    if (this.score > this.high) { this.high = this.score; this.save.set(this.attrs.saveKey, this.high); }
    this.events.emit('score:changed', { score: this.score, combo: this.combo, high: this.high }); this.#draw();
  }
  update(dt) { if (this.t > 0 && (this.t -= dt) <= 0) { this.combo = 1; this.#draw(); } }
  #draw() { this.label?.set(`Score ${this.score}${this.combo > 1 ? `  x${this.combo}` : ''}   Best ${this.high}`); }
}
```

</details>

<details>
<summary>Complete scripts/ui-gameover.js</summary>

**File: `scripts/ui-gameover.js`** (the complete file, for comparison)
```js
// @nord {"id":"ui.game-over","title":"Game over / win screen","category":"ui","tier":["2d","3d"],"tags":["game-over","win","restart","game-ready"],"requires":["ui"],"description":"Shows a Game Over screen on the global 'game:over' (or the configured death event) and a You Win screen on 'game:win' (also 'wave:all-done'), with Restart. Shows the score if gameplay.score is present."}
import { NordScript } from 'nord';

export default class GameOver extends NordScript {
  static attributes = { loseEvent: { type: 'string', default: 'died' }, delay: { type: 'number', default: 0.8 }, winEvent: { type: 'string', default: 'game:win' } };
  start() { this.offs = [this.events.on(this.attrs.loseEvent, () => this.after(this.attrs.delay, () => this.show('Game Over'))), this.events.on('game:over', () => this.show('Game Over')), this.events.on(this.attrs.winEvent, () => this.show('You Win!')), this.events.on('wave:all-done', () => this.show('You Win!'))]; }
  onDestroy() { this.offs.forEach((o) => o()); }
  show(text) {
    const ui = this.ui; ui.clear('end'); ui.panel({ screen: 'end', x: 0, y: 0, style: { inset: 0, width: '100%', height: '100%', background: '#000b', border: 0, borderRadius: 0 } });
    ui.label(text, { screen: 'end', x: 0, y: 90, size: 56, style: { width: '100%', textAlign: 'center' } });
    const sc = this.scene.all && [...this.scene.all()].flatMap((e) => e.scripts).find((s) => 'score' in s && 'high' in s);
    if (sc) ui.label(`Score ${sc.score}   Best ${sc.high}`, { screen: 'end', x: 0, y: 170, size: 22, style: { width: '100%', textAlign: 'center' } });
    ui.menu('end', [{ text: 'Restart', onClick: () => { ui.hide('end'); this.game.restart(); } }], { x: 0, y: 220 }).el.style.cssText += ';left:50%;transform:translateX(-50%)';
    ui.show('end');
  }
}
```

</details>

<details>
<summary>Complete scripts/ui-hud.js</summary>

**File: `scripts/ui-hud.js`** (the complete file, for comparison)
```js
// @nord {"id":"ui.hud","title":"HUD: hearts, bars, score","category":"ui","tier":["2d","3d"],"tags":["hud","hearts","health-bar","game-ready"],"requires":["ui","gameplay.health"],"description":"Heads-up display bound to events: hearts or a health bar from the target's 'health' entity event, optional mana bar from the global 'mana' event, and a coin counter from 'pickup'. Put anywhere in the scene."}
import { NordScript } from 'nord';

export default class Hud extends NordScript {
  static attributes = { target: { type: 'string', default: 'Player' }, style: { type: 'enum', options: ['hearts', 'bar'], default: 'hearts' }, coins: { type: 'bool', default: true } };
  start() {
    const t = this.scene.find(this.attrs.target); this.hearts = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 26, color: '#bf616a' }); this.bar = this.ui.bar(1, { screen: 'hud', x: 12, y: 12, color: '#bf616a' });
    this.bar.el.hidden = this.attrs.style !== 'bar'; this.hearts.el.hidden = this.attrs.style !== 'hearts';
    t?.on('health', ({ hp, max }) => { this.hearts.set('♥'.repeat(Math.ceil(hp)) + '♡'.repeat(Math.max(0, Math.ceil(max - hp)))); this.bar.set(hp / max); });
    this.n = 0; if (this.attrs.coins) { this.coin = this.ui.label('● 0', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 22, color: '#ebcb8b' }); this.off = this.events.on('pickup', (p) => { if (p.kind === 'score') this.coin.set(`● ${++this.n}`); }); }
  }
  onDestroy() { this.hearts?.remove(); this.bar?.remove(); this.coin?.remove(); this.off?.(); }
}
```

</details>

<details>
<summary>Complete scripts/util-sfx.js</summary>

**File: `scripts/util-sfx.js`** (the complete file, for comparison)
```js
// @nord {"id":"util.sfx-synth","title":"Procedural sfx (jsfxr-style)","category":"utilities","tier":["any"],"tags":["audio","sfx","synth","retro"],"description":"Generates retro sound effects with WebAudio, no files needed: sfx(game,'coin'|'jump'|'hit'|'laser'|'explosion'|'powerup'). Listens to global events 'sfx' (name). import { sfx } from './util-sfx.js' for direct use."}
import { NordScript } from 'nord';

const P = { coin: { w: 'square', f: [880, 1760], d: 0.18, v: 0.25 }, jump: { w: 'square', f: [260, 620], d: 0.2, v: 0.25 }, hit: { w: 'sawtooth', f: [220, 60], d: 0.18, v: 0.3 }, laser: { w: 'sawtooth', f: [1400, 200], d: 0.25, v: 0.2 }, powerup: { w: 'triangle', f: [300, 1200], d: 0.4, v: 0.3 }, explosion: { w: 'noise', f: [800, 40], d: 0.6, v: 0.4 } };
let ctx;
export function sfx(name, vol = 1) {
  const p = P[name]; if (!p) return; ctx ??= new (window.AudioContext || window.webkitAudioContext)(); const t = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(p.v * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + p.d); g.connect(ctx.destination);
  let src;
  if (p.w === 'noise') { const b = ctx.createBuffer(1, ctx.sampleRate * p.d, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); src = ctx.createBufferSource(); src.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(p.f[0], t); f.frequency.exponentialRampToValueAtTime(p.f[1], t + p.d); src.connect(f); f.connect(g); }
  else { src = ctx.createOscillator(); src.type = p.w; src.frequency.setValueAtTime(p.f[0], t); src.frequency.exponentialRampToValueAtTime(p.f[1], t + p.d); src.connect(g); }
  src.start(t); src.stop(t + p.d);
}

export default class SfxSynth extends NordScript {
  static attributes = { volume: { type: 'number', default: 1, min: 0, max: 1 }, map: { type: 'string', default: '{"pickup":"coin","jump":"jump","hit":"hit","explosion":"explosion","enemy:shoot":"laser"}', label: 'JSON global-event → sfx name' } };
  start() { this.offs = [this.events.on('sfx', (n) => sfx(n, this.attrs.volume)), ...Object.entries(JSON.parse(this.attrs.map)).map(([ev, n]) => this.events.on(ev, () => sfx(n, this.attrs.volume)))]; }
  onDestroy() { this.offs.forEach((o) => o()); }
}
```

</details>

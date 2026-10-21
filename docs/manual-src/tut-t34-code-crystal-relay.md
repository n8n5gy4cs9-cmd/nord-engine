---
title: T34 Code a full 3D game — Crystal Relay
section: Tutorials
order: 34
summary: Write an ordered-collection 3D time trial: sprint stamina, moving hazard, checkpoint lives, medals, pause/retry and saved records, with all source included.
---

Crystal Relay is a 3D time trial built on Nord's 3D Platformer. Sprint and double-jump along the route, collect crystals **in order**, dodge a moving red hazard and reach the last crystal before time expires. Each crystal grants time, refills energy and becomes a respawn checkpoint. Limited lives and a persistent best time make replay meaningful.

You will write the rules in JavaScript, attach them to Player, add one visible hazard and test every system in Nord. The scene continues to use Babylon/Havok through Nord; you do not need to learn a second rendering or physics API.

**Allow two hours.** Do T03 first if imports and functions are completely new. [Download the entire Crystal Relay source project](assets/downloads/crystal-relay-source.zip) to inspect the finished version in Nord while building your own. Extract it before opening its `nord.project.json`.

<figure class="shot"><img src="assets/screenshots/ed-code-crystal-relay.png" alt="Crystal Relay's 3D route with coded time, lives and sprint-energy display" loading="lazy"><figcaption>The enlarged crystal is the next objective. The red moving sphere is a hazard; collecting a crystal saves a safe landing.</figcaption></figure>

## 1. Make the playable starting project

Choose **New project → 3D platformer**, name your folder `my-crystal-relay`, then Play. WASD/arrows move; Space jumps and a second press after releasing gives an air jump. Stop and open `scenes/main.scene.json`.

Select **Player**. Keep `scripts/platformer3d.js` and the sound helper, but remove the old `scripts/collect.js` attachment. That script owns the original gem counter and would compete with your ordered objective.

Select every **Gem0** through **Gem6** and remove each `scripts/pickup.js` attachment. Keep `scripts/spin.js`, the mesh/material, and the `gem` tag. Our controller will decide which gem is legal and destroy it itself. If you leave the old pickup attached, an out-of-order gem can disappear before your controller wants it.

Select **Ground** and remove its rigidbody and collider components, keeping the visible sand mesh and material. In this variant the sand is distant scenery: missing the platforms falls through it and eventually costs a life. Keep collision on Start and every Plat entity.

**Checkpoint:** Play now. Movement and jumping still work, gems spin, but touching a gem no longer gives the old counter. That temporary absence confirms ownership has moved out of the old script.

## 2. Add one action, one hazard and one script

Open `nord.project.json`. Within the existing `input.actions` object add:

```json
"sprint": ["ShiftLeft", "ShiftRight"]
```

Keep a comma between neighboring entries. Do not replace the other actions. This maps physical keys to a named gameplay intent, so code asks for sprint rather than hard-coding a browser key handler.

In the scene add an entity named **Hazard** at `[3, 3.3, 18]`. Add a **mesh** component with shape `sphere` and size `[0.8, 0.8, 0.8]`, and a **material** with color `#ff4433` and emissive `#aa1100`. It needs no rigidbody or collider: the controller tests a deliberately simple spherical danger radius.

Create `scripts/relay.js` in your project folder and open it in Nord's code editor. Start with:

```js
import { NordScript } from 'nord';

export default class CrystalRelay extends NordScript {
  start() {
    console.log('Relay attached to', this.entity.name);
  }
}
```

Attach it **once to Player**, save the scene and Play. Console must say Relay attached to Player. If it says Camera or Systems, move the attachment now: the complete script treats its own entity as the player.

## 3. Declare state and find the world

The final file starts with four attributes: seconds, lives, normal speed and sprintSpeed. These appear in Inspector and let you tune difficulty without editing logic. It then finds the existing movement controller, the ordered gems and Hazard:

```js
this.player = this.entity;
this.controller = this.player.scripts.find(s => 'jumpSpeed' in s.attrs);
this.gems = this.scene.findByTag('gem')
  .sort((a, b) => a.name.localeCompare(b.name));
this.hazard = this.scene.find('Hazard');
this.spawn = [...this.player.pos];
```

`find` returns the first match. The arrow function identifies the existing movement script by its jumpSpeed attribute. This project has exactly one such script; for a larger project you would use an explicit component/script reference instead of relying on that convention.

`findByTag` returns an array of entities. `sort` orders Gem0 through Gem6 by name. With more than nine gems, names such as Gem10 sort before Gem2; use padded names or a numeric route index if expanding this example.

`[...this.player.pos]` makes a **copy** of the three coordinates. Saving the original array by reference could accidentally let later edits move the saved checkpoint. World coordinates are `[x, y, z]`, with positive Y upward.

The remaining start fields initialize elapsed time, countdown, next index, lives, normalized energy from zero to one, a short hazard-protection timer, the saved record and UI. The final source contains that complete setup; install it before testing the later systems.

## 4. Use time correctly: two clocks, two jobs

Inside update:

```js
this.elapsed += dt;
this.remaining = Math.max(0, this.remaining - dt);
this.safeTime = Math.max(0, this.safeTime - dt);
```

Elapsed time measures performance and determines medals. Remaining time is a resource, so crystals can add to it. If you used remaining time as your record, a time bonus would make a slower run appear faster. Both clocks stop while Nord is paused because the engine stops calling update.

`dt` is seconds. A rate multiplied by dt has consistent behavior across frame rates. Never increment your clock by one per frame.

**Checkpoint:** after adding the full controller, standing still reduces the countdown; pausing keeps it unchanged. Inspector's seconds setting changes the starting allowance, not your medal thresholds.

## 5. Turn sprint into a resource

The player movement script already controls velocity. We change its speed setting instead of moving the body a second time:

```js
const sprint = this.input.down('sprint') && this.energy > 0;
this.controller.attrs.speed = sprint ? this.attrs.sprintSpeed : this.attrs.speed;
this.energy = Math.max(0, Math.min(1,
  this.energy + (sprint ? -0.45 : 0.25) * dt));
```

`const` declares a local binding that will not be reassigned. `&&` means AND: sprint requires a held input **and** available energy. The conditional expression chooses the fast or normal speed. Energy drains at 0.45 per second and recharges at 0.25; the nested min/max clamps it between zero and one.

This simple version permits small bursts while energy recharges if Shift remains held. A more advanced version could require release or a recovery threshold before re-entering sprint. First learn the displayed version, then implement that extension deliberately.

**Try:** hold Shift on Start and watch Sprint fall. Release and watch it refill. Compare a first-gap jump at normal speed with a sprint jump. Keep safe landing width while tuning; speed changes affect every gap.

## 6. Animate a hazard and test distance

The hazard moves side to side:

```js
this.hazard.pos = [3 + Math.sin(this.elapsed * 1.5) * 2, 3.3, 18];
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
```

`Math.sin` oscillates between -1 and 1. Multiplying by two gives a two-unit reach each side of X=3. The `1.5` controls angular speed, not travel distance. Y and Z remain constant.

The distance helper subtracts matching coordinates with `map`. The spread operator passes the resulting three numbers to `Math.hypot`, which calculates their combined distance. The hazard hits below `0.9` units while safeTime is zero. This is a simple centre-distance gameplay test, not mesh collision: changing the artwork size does not automatically change the danger radius.

`p[1] < -5` detects a fall. The OR operator combines fall and hazard conditions. `respawn()` spends one life, teleports using Nord physics, clears velocity, refills energy and grants two seconds of hazard protection. Teleporting without clearing velocity can immediately launch or drop the player again.

**Checkpoint:** fall from Start. With lives remaining you return to the initial checkpoint. Later, test contact with the red sphere and verify one lost life rather than one per frame.

## 7. Make ordered collection and checkpoints work together

The controller checks only `this.gems[this.next]`. It enlarges that crystal as a visual cue. Touching a later gem does nothing, preserving a clear route.

```js
const gem = this.gems[this.next];
if (gem) {
  gem.scale = [1.4, 1.4, 1.4];
  if (distance(this.player.pos, gem.pos) < 1.25) this.collect(gem);
}
```

`next` is an array index, starting at zero. `if (gem)` handles the end of the array safely. The code uses real world distance; a gem looking close in the camera projection is not enough if it is far above or behind the player.

Collection destroys the gem, finds its matching platform, copies a safe spawn position above that platform, advances next and gives the bonuses:

```js
const platform = this.scene.find('Plat' + this.next);
this.spawn = [platform.pos[0], platform.pos[1] + 1.5, platform.pos[2]];
this.next++;
this.remaining += 6;
this.energy = 1;
```

The naming contract is important: Gem0 belongs to Plat0, and so on. Rename both together or change the mapping. A missing platform produces a useful Console error rather than a valid checkpoint. The extra Y places the capsule above the landing rather than inside it.

**Checkpoint:** approach Gem2 first; it stays. Collect Gem0; it disappears, the counter advances, the next gem grows and time increases. Fall afterward; you return to Plat0 with collected progress preserved.

## 8. Finish once, award medals and persist a record

When next reaches the array length, call `finish(true, ...)`. Zero time or lives calls it with false. The ended guard makes a finish idempotent: calling it again has no effect.

On victory:

```js
this.best = this.best === null ? this.elapsed : Math.min(this.best, this.elapsed);
this.save.set('crystal-relay.best', this.best);
const medal = this.elapsed < 45 ? 'Gold'
  : this.elapsed < 70 ? 'Silver' : 'Bronze';
```

The first record starts as null, meaning no completed run. A smaller elapsed value wins. Strict `<` means exactly 45 seconds earns Silver and exactly 70 earns Bronze. These are tuning values, not a claim that a beginner must finish in that time.

The result menu shows Try again. A pause menu uses Resume and Restart buttons whose callbacks continue running while simulation is paused. Do not put the only resume handler in update: update is stopped during pause.

`onDestroy()` restores the movement speed, clears both custom screens and resumes the engine. The new scene then starts with clean state while its best record is loaded from local storage. This saves the record, not a suspended run or cross-device progress.

## 9. Assemble and learn through debugging

Replace your temporary relay.js with the complete file below. Keep one relay attachment, no old collect attachment, and no pickup script on the seven gems. Save **code, scene and project input changes**. Stop and Play to initialize all new fields; adding state through hot reload alone does not call start again.

Common errors tell you which contract to inspect:

| Symptom | Check |
|---|---|
| HUD invisible | Custom `relay` screen must be shown |
| Reading attrs of undefined | Player must retain platformer3d.js |
| Hazard pos error | Entity must be named exactly Hazard |
| Checkpoint pos error | GemN needs a matching PlatN |
| Out-of-order gem disappears | Remove the old pickup attachment |
| Shift does nothing | Save sprint under input.actions; click game for focus |
| Fall lands safely on sand | Ground still has a collider |
| Two counters overlap | Remove old collect.js attachment |

Use `console.log(this.next, this.spawn)` inside collect to inspect progression, then remove it. Change one value, predict the effect and test it. Compare the sample project if the script never starts; don't paste a second controller to compensate for a missing attachment.

## 10. Verify and deliver

Play a full run and test alternate paths through the state machine: early fall, hazard contact, pause/resume, timeout, no lives, complete collection, retry and page reload. A retry resets crystals and lives while preserving Best. A failed run must not overwrite a completed best time.

From the parent folder of your own project:

```sh
nord check my-crystal-relay
nord build my-crystal-relay --out crystal-relay-web --zip
python3 -m http.server 8001 --directory crystal-relay-web
```

Open `http://localhost:8001`, click for keyboard focus and play the exported copy. Upload all files in the output folder, or its zip. The download below is the editable source for Nord, while this build creates the standalone web delivery.

**Extend it:** add numbered crystals, make a second hazard with a different sine phase, expose medal thresholds as Inspector attributes, or implement a sprint recovery threshold. Add a visible rule and a test for each feature. If you add Gem7, also add Plat7 and test its landing before extending the route again.

## Complete game source

The first file is the entire custom relay controller, followed by all other text source files: movement, camera, moving-platform and sound helpers, full scene/project data, HTML and asset metadata. Binaries are included in the [full source project archive](assets/downloads/crystal-relay-source.zip). These files reproduce the finished game; no omitted controller code or CDN is required.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

### scripts/relay.js

```js
import { NordScript } from 'nord';

export default class CrystalRelay extends NordScript {
  static attributes = {
    seconds: { type: 'number', default: 100, min: 10 },
    lives: { type: 'int', default: 3, min: 1 },
    speed: { type: 'number', default: 6, min: 1 },
    sprintSpeed: { type: 'number', default: 10, min: 1 },
  };

  start() {
    this.player = this.entity;
    this.controller = this.player.scripts.find(s => 'jumpSpeed' in s.attrs);
    this.gems = this.scene.findByTag('gem').sort((a, b) => a.name.localeCompare(b.name));
    this.hazard = this.scene.find('Hazard');
    this.spawn = [...this.player.pos];
    this.next = 0;
    this.elapsed = 0;
    this.remaining = this.attrs.seconds;
    this.lives = this.attrs.lives;
    this.energy = 1;
    this.safeTime = 0;
    this.ended = false;
    this.best = this.save.get('crystal-relay.best', null);
    this.notice = 'Follow the large crystal. Hold Shift to sprint.';
    this.hud = this.ui.label('', { screen: 'relay', x: 12, y: 8, size: 16, style: { whiteSpace: 'pre-wrap', maxWidth: '95%' } });
    this.ui.button('Pause', () => this.pause(), { screen: 'relay', x: 12, y: 85 });
    this.ui.show('relay');
    this.draw();
  }

  update(dt) {
    if (this.ended) return;
    this.elapsed += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    this.safeTime = Math.max(0, this.safeTime - dt);
    const sprint = this.input.down('sprint') && this.energy > 0;
    this.controller.attrs.speed = sprint ? this.attrs.sprintSpeed : this.attrs.speed;
    this.energy = Math.max(0, Math.min(1, this.energy + (sprint ? -0.45 : 0.25) * dt));
    // Move a red hazard across the middle landing in world units.
    this.hazard.pos = [3 + Math.sin(this.elapsed * 1.5) * 2, 3.3, 18];
    const p = this.player.pos;
    const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    if (p[1] < -5 || (this.safeTime === 0 && distance(p, this.hazard.pos) < 0.9)) {
      this.respawn();
      if (this.ended) return;
    }
    // Only the next crystal can be collected; later crystals remain in the scene.
    const gem = this.gems[this.next];
    if (gem) {
      gem.scale = [1.4, 1.4, 1.4];
      if (distance(this.player.pos, gem.pos) < 1.25) this.collect(gem);
    }
    if (!this.ended && this.remaining === 0) this.finish(false, 'Time ran out');
    this.draw();
  }

  collect(gem) {
    gem.destroy();
    const platform = this.scene.find('Plat' + this.next);
    this.spawn = [platform.pos[0], platform.pos[1] + 1.5, platform.pos[2]];
    this.next++;
    this.remaining += 6;
    this.energy = 1;
    this.notice = 'Checkpoint saved. +6 seconds and full sprint energy!';
    this.audio.play('assets/audio/sfx/coin.wav');
    if (this.next === this.gems.length) this.finish(true, 'Relay complete');
  }

  respawn() {
    this.lives--;
    if (this.lives <= 0) { this.finish(false, 'No lives left'); return; }
    this.physics.teleport(this.player, ...this.spawn);
    this.physics.setVelocity(this.player, 0, 0, 0);
    this.safeTime = 2;
    this.energy = 1;
    this.notice = 'Back at your last crystal. Two seconds of hazard protection.';
  }

  draw() {
    this.hud.set(`Crystal ${this.next}/${this.gems.length} | Time ${Math.ceil(this.remaining)} | ` +
      `Lives ${this.lives} | Sprint ${Math.round(this.energy * 100)}%\n` +
      `Best ${this.best === null ? '—' : this.best.toFixed(1) + 's'} | ${this.notice}`);
  }

  pause() {
    if (this.ended || this.game.paused) return;
    this.ui.show('relay-menu');
    this.game.pause();
    this.ui.menu('relay-menu', [
      { text: 'Resume relay', onClick: () => { this.ui.clear('relay-menu'); this.game.resume(); } },
      { text: 'Restart', onClick: () => this.restart() },
    ], { x: 20, y: 150 });
  }

  finish(won, title) {
    if (this.ended) return;
    this.ended = true;
    if (won) {
      this.best = this.best === null ? this.elapsed : Math.min(this.best, this.elapsed);
      this.save.set('crystal-relay.best', this.best);
      const medal = this.elapsed < 45 ? 'Gold' : this.elapsed < 70 ? 'Silver' : 'Bronze';
      title += ` — ${medal}, ${this.elapsed.toFixed(1)}s`;
    }
    this.draw();
    this.ui.clear('relay-menu');
    this.ui.label(title, { screen: 'relay-menu', x: 20, y: 130, size: 30 });
    this.ui.menu('relay-menu', [{ text: 'Try again', onClick: () => this.restart() }], { x: 20, y: 180 });
    this.ui.show('relay-menu');
    this.game.pause();
  }

  restart() { this.game.resume(); this.game.restart(); }

  onDestroy() {
    this.controller.attrs.speed = this.attrs.speed;
    this.ui.clear('relay');
    this.ui.clear('relay-menu');
    this.game.resume();
  }
}
```

<details>
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crystal Relay — code workshop</title>
<style>html,body{margin:0;height:100%;background:#101418;overflow:hidden}#stage{position:relative;width:100vw;height:100vh}</style>
<script type="importmap">{"imports":{"nord":"/runtime/core/index.js"}}</script></head>
<body><div id="stage"></div>
<script src="/vendor/babylonjs/babylon.js"></script>
<script src="/vendor/babylonjs-loaders/babylonjs.loaders.min.js"></script>
<script src="/vendor/babylonjs-gui/babylon.gui.min.js"></script>
<script src="/vendor/havok/HavokPhysics_umd.js"></script>
<script type="module">
import { boot } from '/runtime/babylon/index.js';
try {
  const project = await (await fetch('nord.project.json')).json();
  await boot(project, { container: document.getElementById('stage'), preserveDrawingBuffer: true });
  window.__nord_ready = true;
} catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete nord.project.json</summary>

```json
{
  "format": 1,
  "name": "Crystal Relay — code workshop",
  "id": "com.crowelian.crystalrelay",
  "type": "3d",
  "engineVersion": "0.1.0",
  "startScene": "scenes/main.scene.json",
  "display": {
    "width": 1280,
    "height": 720,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "havok",
    "gravity": [
      0,
      -9.81,
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
        "Space"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
      ],
      "camLeft": [
        "KeyQ"
      ],
      "camRight": [
        "KeyE"
      ],
      "sprint": [
        "ShiftLeft",
        "ShiftRight"
      ]
    }
  },
  "plugins": [
    "ui",
    "audio"
  ],
  "ui": {
    "skin": "cyber",
    "theme": "nord"
  }
}
```

</details>

<details>
<summary>Complete scenes/main.scene.json</summary>

```json
{
  "format": 1,
  "name": "main",
  "settings": {},
  "entities": [
    {
      "id": "eeeeeeeu",
      "name": "Sun",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          10,
          0
        ],
        "rot": [
          50,
          -30,
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
          "type": "light",
          "kind": "directional",
          "intensity": 1.4,
          "castShadows": true,
          "color": "#fff4e0"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeev",
      "name": "Ambient",
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
      "components": [
        {
          "type": "light",
          "kind": "hemispheric",
          "intensity": 0.55,
          "color": "#b0c0ff"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeew",
      "name": "Sky",
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
      "components": [
        {
          "type": "skybox",
          "path": "assets/skybox/sunset"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeex",
      "name": "Ground",
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
      "components": [
        {
          "type": "mesh",
          "shape": "ground",
          "size": [
            120,
            0.2,
            120
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/sand.png",
          "uvScale": [
            30,
            30
          ],
          "roughness": 1
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeey",
      "name": "Start",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0.25,
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
          "type": "mesh",
          "shape": "box",
          "size": [
            6,
            0.5,
            6
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/stone.png",
          "uvScale": [
            3,
            3
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            6,
            0.5,
            6
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeeeez",
      "name": "Plat0",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0.25,
          6
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
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee10",
      "name": "Plat1",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          4,
          0.9,
          10
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
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee11",
      "name": "Plat2",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          8,
          1.6,
          14
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
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee12",
      "name": "Plat3",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          3,
          2.4,
          18
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
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee13",
      "name": "Plat4",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          -2,
          3.2,
          22
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
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee14",
      "name": "Plat5",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          -7,
          3.9,
          25
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
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee15",
      "name": "Plat6",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          -12,
          4.6,
          29
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
          "type": "mesh",
          "shape": "box",
          "size": [
            4,
            0.5,
            4
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            2,
            2
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            4,
            0.5,
            4
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee16",
      "name": "Mover",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          14,
          2.4,
          22
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
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "color": "#88c0d0",
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "kinematic",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [
        {
          "path": "scripts/physics-moving-platform.js",
          "attributes": {
            "offset": [
              0,
              0,
              8
            ],
            "period": 5,
            "carryTag": "player"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee17",
      "name": "Gem0",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          1.45,
          6
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee18",
      "name": "Gem1",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          4,
          2.1,
          10
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee19",
      "name": "Gem2",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          8,
          2.8,
          14
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1a",
      "name": "Gem3",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          3,
          3.5999999999999996,
          18
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1b",
      "name": "Gem4",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          -2,
          4.4,
          22
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1c",
      "name": "Gem5",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          -7,
          5.1,
          25
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1d",
      "name": "Gem6",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          -12,
          5.8,
          29
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1e",
      "name": "Player",
      "enabled": true,
      "tags": [
        "player"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          1.5,
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
          "type": "mesh",
          "shape": "capsule",
          "size": [
            0.8,
            1.6,
            0.8
          ]
        },
        {
          "type": "material",
          "color": "#a3be8c"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "mass": 1,
          "fixedRotation": true,
          "drag": 0
        },
        {
          "type": "collider",
          "shape": "capsule",
          "size": [
            0.8,
            1.6,
            0.8
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/platformer3d.js",
          "attributes": {
            "speed": 6,
            "jumpSpeed": 8.5
          }
        },
        {
          "path": "scripts/util-sfx.js",
          "attributes": {}
        },
        {
          "path": "scripts/relay.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1f",
      "name": "Camera",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          5,
          -8
        ],
        "rot": [
          20,
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
          "fov": 60
        },
        {
          "type": "postProcess",
          "fxaa": true,
          "bloom": true,
          "vignette": 0.3,
          "tonemap": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/camera-follow3d.js",
          "attributes": {
            "target": "Player",
            "offset": [
              0,
              5,
              -8
            ],
            "smoothing": 4
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1g",
      "name": "Hazard",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          3,
          3.3,
          18
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
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.8,
            0.8,
            0.8
          ]
        },
        {
          "type": "material",
          "color": "#ff4433",
          "emissive": "#aa1100"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    }
  ]
}
```

</details>

<details>
<summary>Complete scripts/camera-follow3d.js</summary>

```js
// @nord {"id":"camera.follow3d","title":"Camera follow (3D rig)","category":"camera","tier":["3d"],"tags":["camera","follow","chase"],"description":"Chase camera for 3D: keeps an offset from a target entity (by name), smoothing position. Put on a camera entity (non-orbit) — it looks at the target."}
import { NordScript } from 'nord';

export default class CameraFollow3D extends NordScript {
  static attributes = { target: { type: 'string', default: 'Player' }, offset: { type: 'vec3', default: [0, 4, -8] }, smoothing: { type: 'number', default: 5, min: 0 } };
  start() { this.t = this.scene.find(this.attrs.target); }
  lateUpdate(dt) {
    if (!this.t || this.t.destroyed) return;
    const a = this.attrs, tp = this.t.worldPos, p = this.entity.pos, k = Math.min(1, a.smoothing * dt || 1);
    const want = [tp[0] + a.offset[0], tp[1] + a.offset[1], tp[2] + a.offset[2]];
    const np = p.map((v, i) => v + (want[i] - v) * k);
    this.entity.pos = np;
    const d = [tp[0] - np[0], tp[1] - np[1], tp[2] - np[2]];
    this.entity.rot = [(-Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0];
  }
}
```

</details>

<details>
<summary>Complete scripts/mk.js</summary>

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
<summary>Complete scripts/physics-moving-platform.js</summary>

```js
// @nord {"id":"physics.moving-platform","title":"Moving platform","category":"physics","tier":["2d","3d"],"tags":["platform","path","carry"],"description":"Moves back and forth between its start and start+offset (sine or linear). Riders (anything standing on it with a rigidbody) are carried by applying the platform's delta."}
import { NordScript } from 'nord';

export default class MovingPlatform extends NordScript {
  static attributes = { offset: { type: 'vec3', default: [120, 0, 0] }, period: { type: 'number', default: 4, min: 0.1 }, mode: { type: 'enum', options: ['sine', 'pingpong'], default: 'sine' }, carryTag: { type: 'string', default: 'player' } };
  start() { this.o = [...this.entity.pos]; this.t = 0; this.prev = [...this.o]; }
  fixedUpdate(dt) {
    const a = this.attrs; this.t += dt / a.period;
    const f = a.mode === 'sine' ? (1 - Math.cos(this.t * Math.PI * 2)) / 2 : 1 - Math.abs(((this.t * 2) % 2) - 1);
    const np = this.o.map((v, i) => v + a.offset[i] * f), d = np.map((v, i) => v - this.prev[i]);
    this.entity.pos = np; this.prev = np;
    for (const r of this.scene.findByTag(a.carryTag)) {
      const dx = r.pos[0] - np[0], top = this.entity.getComponent('collider')?.data.size ?? [64, 16];
      if (Math.abs(dx) < top[0] / 2 && this.physics.isGrounded(r)) r.pos = r.pos.map((v, i) => v + d[i]);
    }
  }
}
```

</details>

<details>
<summary>Complete scripts/pickup.js</summary>

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
<summary>Complete scripts/platformer3d.js</summary>

```js
// @nord {"id":"controller3d.platformer","title":"3D platformer","category":"controllers","tier":["3d"],"tags":["platformer","jump","coyote"],"requires":["rigidbody","collider"],"description":"World-axis movement (works with a fixed or follow camera looking down +z): coyote time, jump buffer, variable jump height, double jump."}
import { NordScript } from 'nord';

export default class Platformer3D extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 5, min: 0 }, jumpSpeed: { type: 'number', default: 8, min: 0 },
    coyote: { type: 'number', default: 0.1, min: 0 }, buffer: { type: 'number', default: 0.12, min: 0 },
    doubleJump: { type: 'bool', default: true }, cut: { type: 'number', default: 0.5, min: 0, max: 1 },
  };
  start() { this.ct = 0; this.bt = 0; this.air = 0; }
  fixedUpdate(dt) {
    const a = this.attrs, e = this.entity, g = this.physics.isGrounded(e);
    const [mx, mz] = this.input.vec('left', 'right', 'down', 'up');
    this.physics.setVelocity(e, mx * a.speed, null, mz * a.speed);
    if (mx || mz) e.rot = [0, (Math.atan2(mx, mz) * 180) / Math.PI, 0];
    this.ct = g ? a.coyote : this.ct - dt; if (g) this.air = 0;
    this.bt = this.input.pressed('jump') ? a.buffer : this.bt - dt;
    const vy = this.physics.velocity(e)[1];
    if (this.bt > 0 && (this.ct > 0 || (a.doubleJump && this.air === 1))) {
      if (this.ct <= 0) this.air = 2; else this.air = 1;
      this.physics.setVelocity(e, null, a.jumpSpeed, null); this.bt = 0; this.ct = 0;
    } else if (!g && vy > 0 && this.input.released('jump')) this.physics.setVelocity(e, null, vy * a.cut, null);
  }
}
```

</details>

<details>
<summary>Complete scripts/spin.js</summary>

```js
// @nord {"id": "util.spin", "title": "Spin", "category": "utilities", "tier": ["2d", "3d"], "tags": ["rotate", "simple"], "description": "Rotates the entity continuously around one axis.", "requires": []}
// Spin — rotates the entity continuously. Works in 2D (z axis) and 3D (y axis).
import { NordScript } from 'nord';

export default class Spin extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 90, label: 'Degrees / second' },
    axis: { type: 'enum', options: ['x', 'y', 'z'], default: 'z' },
  };

  update(dt) {
    const r = [...this.entity.rot];
    r[{ x: 0, y: 1, z: 2 }[this.attrs.axis]] += this.attrs.speed * dt;
    this.entity.rot = r;
  }
}
```

</details>

<details>
<summary>Complete scripts/util-sfx.js</summary>

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

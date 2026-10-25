---
title: 55 · Ember Crypt: a complete game, from art to export
section: Examples
order: 55
summary: Build a finished dark-dungeon game in Unity-style code with pixel art, an animated hero with a sword, slimes and bats with line of sight, keys and gates, real shadows, particles, sound, a title screen, pause, saved high score and a web export.
---
This is the capstone of the dungeon series. [Pages 49 to 54](ex-dungeon-1-hero.html) built a plain dungeon out of coloured squares. Here we build a **finished game that looks good**: pixel-art tiles, an animated hero with a sword, slimes and bats that really see you (and lose you behind walls), keys and gates, braziers and a lantern that cast real shadows, floating damage numbers, hit-stop, screen shake, particles, sound and music, a title screen, a pause menu, game over and victory screens and a high score that survives a restart.

It is written **Unity-style from the first line to the last**: `MonoBehaviour`, prefabs, `Instantiate`, `GameManager`, `Singleton`, `UnityEvent`, coroutines, triggers, `PlayerPrefs`, `SceneManager`. It is also a map of the engine: almost every idea from the Examples pages appears once, in one project.

| Idea | Page it comes from |
|---|---|
| Scripts, input, movement | [Your first script](ex-first-script.html), [Input and movement](ex-input-movement.html) |
| Prefabs, spawning, overrides | [Spawning, prefabs and Destroy](ex-spawn-destroy.html) |
| Collisions and triggers | [Collisions, triggers and raycasts](ex-collisions.html) |
| Enemy AI | [Enemy AI and state machines](ex-ai-states.html) |
| Health and damage | [Health, damage and death](ex-health-damage.html) |
| Keys and pickups | [Inventory, items and quests](ex-inventory-quests.html) |
| Floating text, particles, hit-stop, shake | [Juice](ex-juice-effects.html) |
| 2D lights and shadows | [2D lights and shadows](ex-lights-2d.html) |
| Animation | [Animation](ex-animation.html) |
| HUD, panels, buttons | [UI: HUD, buttons and menus](ex-ui-hud.html) |
| Sound and music | [Audio](ex-audio.html) |
| Saving a best score | [Saving and loading](ex-save-load.html) |
| Scenes: title and game | [Scenes and persistent objects](ex-scenes.html) |
| The GameManager | [GameManager and Singletons](ex-game-manager.html) |
| Shipping | [Build, publish and ship](ex-build-publish.html) |

**Prerequisites:** the dungeon series, or at least [pages 49 to 52](ex-dungeon-1-hero.html). Allow three to four hours; every file is printed in full and explained.

![The title screen](assets/screenshots/ember-crypt-title.png)

![Exploring the crypt by lantern light](assets/screenshots/ember-crypt-start.png)

**Download:** [the finished game](assets/downloads/ember-crypt-source.zip), also in `examples/ember-crypt` of the engine. Unzip, open `nord.project.json` in Nord and press @ui[Play].

**Controls:** WASD or arrows move, Space or J swings the sword, Esc pauses.

## Start from the starter project

Unity projects usually come with a **starter project**: every asset imported, prefabs built, scenes laid out, no game code. Here it is:

**[Download the starter project](assets/downloads/ember-crypt-starter.zip)**. Unzip it, open `nord.project.json`, press @ui[Play]: you see the title scene's pictures with no title text and no working buttons. Inside:

![Every sprite the game uses: hero frames, slime, bat, coin, wall, gate, brazier, rune, key, potion, chest, crate, barrel, spikes and hearts](assets/screenshots/ember-crypt-assets.png)

* `assets/`: all the sprites above, the floor texture, particle textures, 14 sound effects, 4 music tracks and the `.meta.json` files with the hero's clips (`idle`, `walk`, `jump`, `hurt`) and the slime, bat and coin animations.
* `prefabs/`: all 18 prefabs of section 4, set up with sprites, colliders, rigidbodies and the **library light scripts**, but **without your scripts**.
* `scenes/title.scene.json` (complete) and `scenes/main.scene.json` (`Camera`, `GameManager`, `Run`, `Level`, `Light2D` with its settings, `Hud`, `Hero` with its `Lantern`): entities and components in place, no scripts attached.
* `scripts/`: only `map.js` (the dungeon as text, which is data, not code) and the three light library scripts. Everything else you write while reading this page.

Each section below says which object gets which script. In short: `Follow.js`, `Run.js`, `Level.js`, `Hud.js`, `GameManager.js` go on the scene objects of the same name (`Follow` on `Camera`); `Hero.js` and `Health.js` on `Hero`; `Pickup.js` on the four pickup prefabs (with `kind` = `coin`, `key`, `potion`, `chest`); `Door.js`, `Spikes.js`, `Exit.js` on the prefabs of those names; `Enemy.js` on `slime` (speed 55, hp 2, sight 150) and `bat` (speed 95, hp 1, sight 190, zigzag 1); `FloatText.js` on `floattext`; `Slash.js` on `slash`; `Title.js` on the `Title` object of the title scene; `World.js` and `Fx.js` are helper modules.

## 1 The plan

You are trapped in a crypt of six rooms. The way out is the glowing rune in the far room. Two iron gates stand in the way; each needs a key. Slimes and bats wander and hunt you. You carry a lantern, there are braziers on the walls, and you cannot see further than the light.

Good games are small parts that do not know each other. Here they are:

| Script | On | Job |
|---|---|---|
| `map.js`, `World.js` | nothing | the dungeon as text; questions about it (what is at x, y? can A see B?) |
| `Fx.js` | nothing | static helpers: floating text, bursts, hit-stop |
| `Level.js` | `Level` | reads the map, instantiates prefabs |
| `GameManager.js` | `GameManager` | the engine's manager: **lives are the hero's hearts** |
| `Run.js` | `Run` | a Singleton: coins, keys, clock, how a run ends |
| `Hero.js`, `Health.js` | `Hero` | steering, animation, sword; grace time and shake |
| `Enemy.js` | slime and bat prefabs | wander, see, chase, take damage, die |
| `Pickup.js`, `Door.js`, `Spikes.js`, `Exit.js` | the matching prefabs | one behaviour each |
| `FloatText.js`, `Slash.js` | effect prefabs | move and fade themselves, then `Destroy` |
| `Follow.js` | `Camera` | smooth camera |
| `light2d*.js` | `Light2D`, lights, walls | darkness and shadows (library scripts) |
| `Hud.js`, `Title.js` | `Hud`, `Title` | screens |

They talk the way Unity scripts do: **singletons** (`Run.instance`, `GameManager.instance`), **method calls** through `GetComponent`, a **`UnityEvent`** (`Run.instance.onChanged`) and the global **`EventBus`** (`level`, `lives`, `gameover`).

## 2 The project

Open the @ui[Project] tab. In **Project properties** set:

1. **Start scene**: `scenes/title.scene.json`.
2. **Game size**: `640` × `360`, **Scaling** `fit`.
3. **Pixel art**: **on** (it turns off smoothing).
4. **Background**: `#07080c`.
5. **Physics**: `arcade`, **gravity Y** `0`.
6. Press **Apply project properties**.

Then unfold **Input Manager (actions and keys)** just below: add the action `attack` (type the name, press **Add action**, then **＋ key** and press Space; again for `J`; **＋ mouse/pad** for `Mouse0`) and give the existing `interact` action the keys `E` and `Enter`.

**In the file** `nord.project.json` (open it in a text editor to check what the editor wrote), these keys differ from a default project:
```json
"startScene": "scenes/title.scene.json",
"display": { "width": 640, "height": 360, "scale": "fit", "pixelArt": true, "background": "#07080c" },
"physics": { "engine": "arcade", "gravity": [0, 0, 0] },
"input": { "actions": { "attack": ["Space", "KeyJ", "Mouse0"], "interact": ["KeyE", "Enter"] } }
```

`pixelArt: true` turns off smoothing so 16 and 32 pixel art stays razor sharp (Unity: *Filter Mode: Point*). The game starts at the title scene, which loads the game scene when you press Play.

The art is the pixel art bundled with Nord: `hero.png` (a sheet of 32 × 32 frames with the clips `idle`, `walk`, `jump`, `hurt`), the slime and bat sheets, wall and floor textures, an iron gate, a brazier, a rune, items (key, potion, chest, crate, barrel, spikes, hearts), sound effects and music. Copy `assets/` from the download. Each sheet has a `.png.meta.json` next to it with its frame size and clip names, written by the **Sprite editor** ([Animation](ex-animation.html)): `"walk": { "frames": [2, 3, 4, 5], "fps": 10, "loop": true }`.

## 3 The dungeon as text

`scripts/map.js`: `#` wall, `.` floor, `P` the hero's start, `o` coin, `k` key, `D` a gate tile (a gate is two tiles wide), `+` potion, `B` brazier, `c` crate or barrel, `^` spikes, `C` chest, `s` slime, `b` bat, `X` the exit rune.

@@code map.js | new file, the whole file@@

`scripts/World.js` asks the map questions (a static helper class, like a Unity utility):

@@code World.js | new file, the whole file@@

* `TileAt` converts a world position to a tile by dividing by 32. Outside the map everything is `#`, so nothing can see or walk beyond the edge.
* `LineClear` is **line of sight**: it walks the straight line between two points in 8 pixel steps (finer than a tile, so no corner slips through) and answers false at the first wall. It is a map lookup, not a physics raycast, so it is cheap enough for every enemy every step.

## 4 Prefabs

Everything that appears in the level is a **prefab**: a saved entity with its components and scripts. Make these in the editor (select an object ▸ @ui[right-click ▸ Create prefab]); the download has them all in `prefabs/`:

| Prefab | Contents |
|---|---|
| `floor` | one sprite, `floor.png` 1280 × 800 |
| `wall-tile` | only a picture: sprite `wall.png` 32 × 32 |
| `wall-body` | no picture: static rigidbody + box collider + `light2d-occluder.js`, tag `solid` |
| `crate`, `barrel` | sprite, static rigidbody, box collider 24 × 24, occluder, tag `solid` |
| `coin` | animated sprite `coin.png` (clip `spin`), static rigidbody, **trigger** collider, `Pickup.js` with `kind: coin`, tag `Coin` |
| `key`, `potion`, `chest` | a sprite, a trigger collider, `Pickup.js` with the matching `kind` |
| `door` | sprite `gate.png`, static rigidbody, box collider, `Door.js`, occluder, tags `Door`, `solid` |
| `spikes` | sprite, `Spikes.js` |
| `brazier` | sprite + `light2d-source.js` (orange, flicker 0.3) |
| `exit` | rune sprite, `Exit.js`, `light2d-source.js` (cyan) |
| `slime`, `bat` | animated sprite, dynamic rigidbody, box collider, `Enemy.js`, tag `Enemy`. Slime: `speed 55, hp 2, sight 150`. Bat: `speed 95, hp 1, sight 190, zigzag 1` |
| `floattext` | a text component, `FloatText.js` |
| `burst` | a particles component, no emitting, `burst: 14` |
| `slash` | a translucent circle sprite, `Slash.js` |

Notice the **wall is two prefabs**: `wall-tile` is only a picture (hundreds of them) and `wall-body` is only a collider and shadow caster (a few dozen long strips). Looks and physics have different needs. And notice **slime and bat are the same script** with different numbers: in Unity that is a *prefab variant*. Pickups are one script with a `kind` field. One script, many prefabs.

## 5 Building the level

`scripts/Level.js` is part 3's loader with a table from letter to prefab:

@@code Level.js | new file, the whole file; attach it to the `Level` object@@

* `PREFAB` maps a letter to a prefab name. Adding a new kind of object is one line here and one prefab file.
* `overrides: { components: { 1: { size: [w, t] } } }` makes the long wall strips: component 1 of `wall-body` is its collider.
* The `Hero` already exists in the scene; the loader moves it to the `P`.
* At the end it announces the level's size (for the camera) and how many coins there are.

## 6 The scene

`scenes/main.scene.json` needs only eight entities; the Level builds everything else:

| Entity | Components | Scripts |
|---|---|---|
| `Camera` | camera | `Follow.js` |
| `GameManager` | none | `GameManager.js` (`startLives` 5) |
| `Run` | none | `Run.js` |
| `Level` | none | `Level.js` |
| `Light2D` | none | `light2d.js` (ambient `#0a0b12`, scale 7.5, shadows on) |
| `Hud` | none | `Hud.js` |
| `Hero` (tag `Hero`) | animated sprite `hero.png` (clip `idle`), rigidbody dynamic, collider box 14 × 16 | `Hero.js`, `Health.js` |
| `Lantern` (child of `Hero`) | none | `light2d-source.js` (colour `#ffb86b`, radius 200) |

The hero's collider (14 × 16) is smaller than its 32 × 32 picture: it fits corridors easily and its head can overlap a wall's top edge, which looks natural from above. `Follow.js` is part 3's camera script.

## 7 The hero

`scripts/Hero.js` steers, animates and swings the sword:

@@code Hero.js | new file, the whole file; attach it to `Hero`@@

* `this.GetComponent('animatedSprite')` is the Animator. `animator.play('walk')` starts a clip and `animator.current` names the playing one. **Only call `play` when the wanted clip changes**, or the animation restarts every frame and freezes on its first frame. That one comparison is the most common animation fix.
* `animator.setFlip(true)` mirrors the picture. The art faces forward, so we mirror it when going left.
* **Facing** is the last non-zero move direction as a unit `Vector2`. The sword uses it.
* **The sword.** `Swing()` sets the cooldown with `Time.time`, plays a sound, spawns the crescent prefab and damages every `Enemy` that is closer than `reach` and **in front**. "In front" is a dot product: `Vector2.Dot(to.normalized, this.facing)` is the cosine of the angle between "where the enemy is" and "where I look"; above −0.1 means roughly the front half-plane. The hero calls `TakeDamage` on the enemy: a plain method call.
* The y of `facing` is `-move.y`: input is Unity-style (up is +), the screen is not.

## 8 Health

`scripts/Health.js` wraps the GameManager's lives with what a finished game needs:

@@code Health.js | new file, the whole file; attach it to `Hero`, next to `Hero.js`@@

* **Grace period**: after a hit the hero is protected for `grace` seconds; `Math.floor(protectedFor * 12) % 2` blinks it about six times a second.
* `this.game.camera.shake(160, 0.01)` shakes the camera for 160 ms (Unity: a Cinemachine impulse).
* `GameManager.instance.LoseLife()` emits `lives` (the HUD redraws the hearts) and, at zero, `gameover`.
* `this.GetComponent(Hero).Knockback(from)` pushes the hero away.
* `this.entity.native` is the engine's own game object: the escape hatch for what components do not expose, here the sprite's alpha.

## 9 Enemies that see you

`scripts/Enemy.js` runs both slimes and bats:

@@code Enemy.js | new file, the whole file; attach it to the `slime` and `bat` prefabs@@

* **Seeing**: `sees` is true only when the hero is closer than `sight` **and** `World.LineClear` finds no wall in between. Behind a wall you vanish from their eyes. In [part 5](ex-dungeon-5-enemies.html) enemies saw through walls; this is the fix, one extra condition.
* **Chasing and wandering**: they run at you when they see you; otherwise the `Wander` coroutine picks a random direction every second or two, at 45% speed.
* **The bat's swerve**: `zigzag` adds a sideways push that oscillates with a sine of time. Rotating a unit vector 90° is `(−y, x)`; adding a bit of it bends the path.
* **Taking damage**: subtract hit points, push back (a stun time in which it cannot steer), float the damage number, play a sound, freeze the game for 55 ms, burst some particles. All one-liners from `Fx`, next.
* **Dying**: smoke, a sound, sometimes (60%) a coin prefab, then `Destroy(this.entity)`.

## 10 Juice

Hitting something should feel good ([Juice](ex-juice-effects.html)). `scripts/Fx.js` collects three tricks as static functions:

@@code Fx.js | new file, the whole file@@

* `FloatText` instantiates the `floattext` prefab on **layer 1** (above the darkness, so it stays readable) with the text and colour as **overrides**. The prefab's own script moves it:

@@code FloatText.js | new file, the whole file; attach it to the `floattext` prefab@@

* `Burst` instantiates the `burst` prefab (a particles component that explodes once) with overrides for colour and count, and destroys it after the particles' lifetime. `Destroy(object, seconds)` is the delayed destroy you know.
* `HitStop` slows the game to 5% for a few milliseconds with `Time.timeScale`. It resets with the browser's `setTimeout`, **not** a game timer: the game clock is exactly what we slowed, so a 55 ms game timer would take 1.1 s of real time. A classic trap.

The sword's crescent is another self-removing prefab:

@@code Slash.js | new file, the whole file; attach it to the `slash` prefab@@

A sound, a number, a spark, a freeze, a shake: that is what makes a swing feel heavy.

## 11 Pickups, gates and the rules

Four pickups share `scripts/Pickup.js` with a `kind` field:

@@code Pickup.js | new file, the whole file; attach it to the `coin`, `key`, `potion` and `chest` prefabs@@

It does what is common (bob, detect the hero, text, sound) and tells the **Run** what happened. `scripts/Run.js` is a `Singleton` with the rules and the clock:

@@code Run.js | new file, the whole file; attach it to the `Run` object@@

* `Run.instance.AddCoin()` and friends: **singleton calls**, the way Unity GameManagers work. `UseKey()` returns whether a key was spent: when code needs an answer, a method call beats an event.
* `onChanged` and `onEnded` are `UnityEvent`s: `AddListener(fn)` (it returns a function that removes the listener) and `Invoke(data)`. The HUD listens; the Run does not know it exists.
* A run ends on `gameover` (the GameManager says the last heart is gone) or when the hero reaches the rune (`End(true)`). `End` computes the score (10 per coin and a speed bonus of 5 per second under five minutes), saves the best score with `PlayerPrefs.SetInt` and invokes `onEnded`. The guard `if (this.ended) return` prevents a double ending.
* `Awake` resets the GameManager, so a run after a trip to the title screen starts with full hearts. The music starts in `Start`.

> **Why `this.elapsed` and not `this.time`?** Scripts already have a `this.time`. Assigning to it throws *Cannot set property time … which has only a getter*. Do not name fields `entity`, `scene`, `game`, `attrs`, `input`, `audio`, `time`, `events`, `ui`, `physics`, `save` or `rng`.

Gates are `scripts/Door.js`:

@@code Door.js | new file, the whole file; attach it to the `door` prefab@@

Each gate tile checks whether the hero is within 30 pixels. If the Run spent a key, `Open()` destroys this tile **and its neighbours within 40 pixels**, so one key opens both tiles of a two-wide corridor. The `opened` flag matters: both tiles run `Update` in the same frame, and without it the second tile would spend a second key. Without a key the gate shows "Locked" (at most every 1.5 s) and plays an error sound.

The last two behaviours are tiny:

@@code Spikes.js | new file, the whole file; attach it to the `spikes` prefab@@

@@code Exit.js | new file, the whole file; attach it to the `exit` prefab@@

## 12 Light

The lights are part 6 again: `Light2D` with the system script, `Lantern` as a child of the hero, **braziers** with `light2d-source` and walls, crates and gates with the occluder (all in their prefabs). Details that make it look good:

* The darkness `ambient` is `#0a0b12`: almost black, with a hint of blue so the dark has a colour.
* The lantern flickers 0.07, a tiny breathing; the braziers 0.3, wild.
* The exit rune has a **cyan** light. Warm light in the rooms and cold light at the exit tells the player where to go without an arrow.
* Wall pictures are on layer 0, so walls are darkened like the floor, and the occluders give them real shadows.

![Gates, spikes and shadows](assets/screenshots/ember-crypt-gate.png)

## 13 The HUD, pause and end screens

@@code Hud.js | new file, the whole file; attach it to the `Hud` object@@

* **Hearts** are images redrawn on every `lives` event: full and empty hearts, `image-rendering: pixelated` to stay crisp.
* **The clock** formats `Run.instance.elapsed`.
* **Pause**: Esc calls `GameManager.instance.Pause()` (`game.pause()` plus the state `paused`); Esc again calls `Resume()`. We listen to the browser's `keydown` directly because **nothing updates while the game is paused**, so `Input.GetKeyDown` would never fire. Remove the listener in `OnDestroy`.
* **The end panel** appears when `Run.onEnded` fires. Buttons take callbacks: `GameManager.instance.Restart()` rebuilds the scene; `SceneManager.LoadScene('scenes/title.scene.json')` returns to the title.

![The victory screen](assets/screenshots/ember-crypt-win.png)

![Game over](assets/screenshots/ember-crypt-over.png)

## 14 The title scene

`scenes/title.scene.json` holds a camera, a dark floor, an `Embers` entity (a particles component that keeps emitting), the hero, a brazier, a slime and an entity `Title` running:

@@code Title.js | new file, the whole file; attach it to the `Title` object of the title scene@@

`PlayerPrefs.GetInt('ember.best', 0)` reads the saved score. `SceneManager.LoadScene` is Unity's. Every widget is kept in `this.widgets` and removed in `OnDestroy`, because **UI outlives a scene change**: forget it and the title text stays on top of your game.

## 15 Check yourself

* The title shows with embers drifting up. **Play** starts the game and the music.
* Walk: the hero animates and mirrors; the camera follows; walls cast shadows.
* Swing at a slime: a sound, a yellow `1`, a freeze, sparks. The second hit kills it and it sometimes drops a coin.
* Stand behind a wall: the slime stops hunting and wanders.
* Touch spikes or an enemy: a heart disappears, you flash and are pushed away. A red potion refills one.
* A gate says "Locked" until you hold a key, then opens in a puff of smoke. Reach the cyan rune: the victory screen shows your score and, the first time, "new best".
* Lose all five hearts: game over; **Play again** restarts with full hearts.
* Close the game and open it again: the title remembers your best score.

The project has an automated test, `node tools/ember-crypt-test.mjs`, that does all of this in a headless browser and made the screenshots on this page.

## 16 Ship it

**Terminal** (in the folder that contains the `ember-crypt` project folder):
```bash
nord check ember-crypt
nord build ember-crypt --minify --zip -o ember-crypt-web
nord build ember-crypt --single-file -o ember-crypt-one
```

Upload the folder to any web host, or send the single `index.html`. See [Ship it with a hosting preset](tut-t51-hosting-presets.html) for itch.io and GitHub Pages.

## 17 Where to go next

Each is one small separate script, because that is how the game was built:

* **More enemies.** A *spitter* that shoots: a `projectile` prefab and a copy of `Enemy.js` that stops at `sight` and fires every second.
* **A real inventory.** Keys are a counter now. [Inventory, items and quests](ex-inventory-quests.html) shows items with names and icons.
* **Dialogue.** An old man at the start who explains the keys: [Talking to NPCs](ex-dialogue-npc.html).
* **A second level.** Make `map.js` an array of maps and load the next when the rune is touched ([Scenes and persistent objects](ex-scenes.html)).
* **Touch controls.** A virtual joystick and an attack button: [Touch, mobile and responsive games](ex-mobile-touch.html).
* **Options.** Volume sliders and key rebinding: [Options menu](ex-settings-menu.html).
* **Another whole game.** [Vector Rocks](ex-vector-rocks.html), Asteroids on a green vector monitor.

## What you learned

* Describe the world as data, build it from prefabs, let small scripts talk through singletons, method calls and events.
* Prefab variants (slime and bat) are the same script with different numbers.
* A dot product makes "in front"; a map lookup makes "can see".
* Juice is four small effects: a number, a spark, a freeze, a shake.
* Light is three library scripts and a child entity; colour tells the player where to go.
* Always clean up in `OnDestroy`: labels, widgets, listeners.
* Games ship as a folder, a single file or a zip.

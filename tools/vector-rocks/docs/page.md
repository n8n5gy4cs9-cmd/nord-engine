---
title: 44 · Vector Rocks: Asteroids on a green vector monitor
section: Examples
order: 44
summary: A whole game in Unity-style code: Asteroids with glowing phosphor lines, a monitor bezel, waves, a heartbeat that speeds up, and five power-ups. About 370 lines of MonoBehaviours, prefabs, coroutines and triggers.
---
**Goal:** make a real, fun game in an afternoon: **Asteroids on an old XY vector monitor**. Deep green phosphor lines with a soft glow, scanlines, a plastic monitor bezel with a nameplate and a power LED, a heartbeat that speeds up as the rocks run out, and five power-ups (shield, rapid fire, triple shot, nova and an extra life). Everything is written Unity-style: `MonoBehaviour`, `Singleton`, `Instantiate`, `Destroy`, coroutines, triggers, `PlayerPrefs`, `EventBus`.

![Vector Rocks: ship with shield and triple shot, rocks, a nova power-up](assets/screenshots/vector-rocks-showcase.png)

**Download:** [the project](assets/downloads/vector-rocks-source.zip), also in `examples/vector-rocks`. Open `nord.project.json` and press @ui[Play].

**Controls:** A / D or ← → turn, W or ↑ thrust, Space fire, Shift hyperspace (a random jump), Enter after Game Over.

## The parts

| File | Unity equivalent | Job |
|---|---|---|
| `Game.js` | a `GameManager` singleton | score, lives, waves, the heartbeat, hi-score |
| `Ship.js` | the player script | turn, thrust, fire, power-ups, die, respawn |
| `Rock.js` | an enemy script | drift, spin, split when hit, drop power-ups |
| `Bullet.js` | a projectile | fly, hit a rock, disappear |
| `PowerUp.js` | a pickup | drift, throb, fade, get collected |
| `Playfield.js` | a static helper class | the screen edges and wrapping |
| `Hud.js` | a Canvas with a Canvas Scaler | score, lives, notices, the bezel and the bloom |
| `prefabs/*.prefab.json` | prefabs | bullet, 9 rock shapes, 5 power-ups, explosion, nova |

About 370 lines in total, comments included. The art is made by `python3 tools/gen_vector_rocks_art.py`: every line drawing is drawn with a core, a mid-green and a wide blurred halo, which is what makes a line look like it is made of light.

## 1 How to make a vector monitor

A real XY monitor has no pixels: an electron beam draws lines, and the phosphor keeps glowing for a moment. We fake the three things you notice:

1. **Lines made of light.** The sprites are line drawings with a baked glow: a thin white-green core, a stronger green around it and a wide soft halo. On a very dark green background (`#010a03`) they look lit from inside.
2. **Bloom.** Bright things bleed light over their surroundings. The HUD adds a layer that blurs and brightens what is behind it and puts it back on top with the `screen` blend mode: a one-line CSS `backdropFilter: 'blur(6px) brightness(2.3) saturate(1.5)'`.
3. **Scanlines, curved glass and the bezel.** The scene effect `{ "type": "crt", "intensity": 0.35 }` adds scanlines. The bezel is one 800 × 600 image with a transparent screen opening, rounded corners, an inner shadow, a glass reflection, screws, a nameplate and an LED. It lies on top of the whole game.

The project settings for the look:

```json
"display": { "width": 800, "height": 600, "scale": "fit", "pixelArt": false, "background": "#010a03" },
"physics": { "engine": "arcade", "gravity": [0, 0, 0] }
```
and in the scene `"settings": { "effects": [ { "type": "crt", "intensity": 0.35 } ] }`.

> **Why a 4:3 game?** The monitors this imitates were 4:3. The game stays 800 × 600 and is scaled to fit any window; the black bars are the table the monitor stands on.

## 2 The screen, and wrapping

`Playfield.js` knows where the visible screen is (inside the bezel) and wraps objects around it:

@@code Playfield.js@@

Unity has no equivalent of `static` helper *classes* because C# has them built in; in JavaScript a class with only `static` members does the same. Anything can call `Playfield.Wrap(this.entity)`.

## 3 The ship

The scene has an entity `Ship` (tag `Player`) with a sprite, a **rigidbody** (dynamic), a **circle collider** that is a **trigger**, and two disabled children `Flame` and `Shield`. The script:

@@code Ship.js@@

The Unity ideas, in order:

* `static attributes = SerializeField({ turnSpeed: 200, … })` is `[SerializeField] float turnSpeed = 200;`. The fields show up in the Inspector and you read them as `this.turnSpeed`.
* `Input.GetAxis('Horizontal')`, `Input.GetKey(KeyCode.W)` and `Input.GetKeyDown(KeyCode.LeftShift)` are the Unity input calls, working on WASD, arrows and gamepads.
* **Angles.** The ship's `heading` is in degrees, **0 = up, clockwise**, the same as `entity.rot[2]`. The direction it points to is `(sin h, −cos h)` (the y axis of a Nord screen points **down**).
* **Inertia.** Thrust adds to the velocity vector `this.v`, a `Vector2`; friction multiplies it by `1 − drag·dt`; `Vector2.ClampMagnitude` limits the top speed. `FixedUpdate` hands it to the physics body with `this.velocity = this.v`, exactly `rb.velocity = v`.
* `Time.time >= this.nextShot` is the usual fire-rate gate.
* **Power-ups are three timers** (`shieldLeft`, `rapidLeft`, `tripleLeft`) that count down in `Update`. Firing looks at them: rapid fire shortens the delay, triple fire shoots at −12°, 0° and +12°.
* `OnTriggerEnter(other)` is Unity's `OnTriggerEnter2D`. `other` is the entity that entered; `other.hasTag('Rock')` is `CompareTag`, `other.getScript(Rock)` is `GetComponent<Rock>()`.
* The **flame** flickers by turning a child on and off 15 times a second: `this.flame.enabled = …`. The **shield** blinks when it is about to run out.
* **Dying and respawning.** `Die()` hides the ship, spends a life and asks the `Game` to bring it back. `Spawn()` is a coroutine: it places the ship in the middle and blinks it for two seconds, during which it is `safe`.

> **Trap: coroutines stop when their object is disabled.** In Unity too! If the dead ship started its own respawn coroutine and then hid itself, the coroutine would never continue. That is why `Die()` calls `Game.instance.StartCoroutine(Game.instance.Respawn(this))`: the Game is always active.

## 4 Rocks, bullets, power-ups

`Rock.js`:

@@code Rock.js@@

* One script, three sizes: each prefab sets `size` (0 small, 1 medium, 2 large) and has a different picture and collider. Three shapes per size make the sky look varied: `Random.Range(0, 3)` picks one.
* `Hit()` is the whole life of a rock after birth: score, sound, explosion, **split into two smaller rocks** that inherit half of the parent's speed plus a random push, sometimes a power-up (small rocks drop them most often), and finally `Destroy(this.entity)`.
* `Instantiate(path, { pos })` returns a Promise (loading a prefab may touch the network). In `async Hit()` we simply `await` it; in a normal method we use `.then(...)`.
* **Trap: `Random.Range` with two whole numbers returns an integer**, like in C#. `Random.Range(-70, 70)` would give integers; `Random.Range(-70.5, 70.5)` gives a float. JavaScript cannot tell `70.0` from `70`.

`Bullet.js` and `PowerUp.js` are tiny:

@@code Bullet.js@@

@@code PowerUp.js@@

A bullet remembers it is `spent` so that one shot hits one rock, even if it touches two in the same frame. `Destroy(obj, seconds)` removes the bullet after its lifetime. The power-up throbs with a sine and fades during its last two seconds. There is **one prefab per kind** (`pu-shield`, `pu-rapid`, …) with the same script and a different `type`: an easy way to get an icon per kind without any code that picks pictures.

## 5 The game: waves, lives, heartbeat

`Game.js` is a `Singleton`: `Game.instance` works from anywhere (`Game.instance.AddScore(50)`).

@@code Game.js@@

* `Waves()` is a coroutine: wait, spawn `count` rocks on the screen edge **away from the ship**, wait until they have all arrived, wait until the sky is empty, wait a moment, next wave. `WaitForSeconds` and `WaitUntil` are the Unity yield instructions.
* **Trap: `Instantiate` is asynchronous.** If the coroutine only waited for `RockCount() === 0`, it would see an empty sky for a few frames while the rocks are still loading, and start the next wave at once. `pending` counts the rocks that really exist. This was a real bug while building the game.
* `Heartbeat()` plays two alternating tones; the pause between them is `Mathf.Lerp(0.3, 1.0, Mathf.Clamp01(rocks / 16))`: the fewer rocks, the faster the heart. That one effect makes the game tense.
* `PlayerPrefs.GetInt` and `SetInt` store the hi-score; it survives closing the game.
* `EventBus.Publish('hud')` tells whoever is interested that something changed, without the Game knowing the HUD exists.

## 6 The monitor: HUD, scaler, bezel and bloom

`Hud.js`:

@@code Hud.js@@

* The UI layer is measured in **screen pixels**, but the game is scaled to fit the window. The `frame` is one 800 × 600 box that `LateUpdate` scales and moves to sit exactly on the game canvas. That is what a Canvas Scaler does in Unity. Every label, the bloom and the bezel are children of it, so they stay glued to the picture in any window.
* The labels use a monospace font with a green `textShadow`, the cheapest phosphor glow there is.
* `this.Invoke('ClearNotice', 1)` is Unity's `Invoke`: the name of a power-up appears in the middle for one second.
* `bloom` sits **under** the bezel and uses `mix-blend-mode: screen`.
* `OnDestroy` removes everything, because the UI is not part of the scene and would otherwise pile up after a restart.

## 7 Power-ups

| Icon | Name | Effect |
|---|---|---|
| shield | Shield | 8 s invulnerable; the ring blinks at the end |
| rapid | Rapid fire | 8 s of a shot every 0.08 s |
| triple | Triple shot | 8 s of three-way fire |
| nova | Nova | every rock on the screen is hit at once, with a flash and a shake |
| life | Extra life | +1 ▲ |

They are all in `Ship.Collect(type)`: five lines. To add a sixth, make a prefab, give the ship a timer, make `Fire` or `Update` look at it.

![A nova clears the sky](assets/screenshots/vector-rocks-nova.png)

## 8 Check yourself

* The title of the game is the screen itself: green rocks drift on black, the ship waits in the middle.
* Turn and thrust: the ship keeps drifting after you let go. Fly off one edge and come back on the other.
* Shoot a big rock: two medium ones, then four small ones; the score goes up 20, 50 and 100.
* Collect an icon: its name flashes in the middle and the effect runs for 8 seconds.
* Hit a rock: the ship explodes, the screen shakes, you come back in the middle and blink for two seconds.
* Lose three ships: **GAME OVER**. Press Enter. The hi-score stays.

The project has an automated test, `node tools/vector-rocks-test.mjs`: it flies, shoots, collects every power-up, dies, runs out of lives and restarts in a headless browser, and made the screenshots on this page.

![Game over](assets/screenshots/vector-rocks-over.png)

## 9 Ideas

* A **flying saucer** that crosses the screen and shoots (a new prefab and a script like `Rock` that aims with `Vector2.Distance` and `Mathf.Atan2`).
* Rocks that **wobble** their outline by drawing a new random polygon each wave: see the art script.
* **Sound per power-up**, a **combo** counter for shots in a row, a **boss rock**.
* Gamepad: `Input.GetAxis('Horizontal')` already reads the stick.
* Ship it: `nord build vector-rocks --minify --zip` makes a folder you can put on a web page. See [Build, publish and ship](ex-build-publish.html).

Back to [Examples](examples.html).

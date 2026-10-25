---
title: Examples (coming from Unity)
section: Examples
order: 0
summary: Short, copy-and-run code examples for everything a Unity developer does every day, each with the C# version next to the Nord JavaScript version, plus a complete small game.
---

These pages show **how to do the everyday things** in Nord, written for someone who already knows Unity. Every page has the same shape: *the goal*, the **Unity (C#)** way, the **Nord (JavaScript)** way, what to click in the editor, and the traps. Everything is plain JavaScript in `scripts/*.js` files that you attach to objects (@ui[Inspector ▸ + Add script]).

::: dummies
Never used Unity? These pages still work: each example is a small script plus the steps to try it. Start with *1 · Your first script* and follow the numbers.
:::

## How the Unity-style coding works
Nord keeps Unity's mental model: a **scene** holds **objects**, an object holds **components**, and a **script** is one more component whose methods the engine calls at the right moment. The difference is the language (JavaScript instead of C#) and that nothing needs compiling: save the file and press @ui[Play].

::: dummies
Think of a stage play. The **scene** is the stage, each **object** is an actor, and a **script** is the actor's instruction card: "when the curtain rises do this, every second do that". You never call those methods yourself. The engine reads the card and calls them for you.
:::

### 1. A script is a class with Unity's method names
A script is a JavaScript class that `extends MonoBehaviour`. You write only the methods you need; the engine calls them by name, exactly like Unity.

**File: `scripts/hello.js`** (new file, the whole file)
```js
import { MonoBehaviour, Debug } from 'nord';

export default class Hello extends MonoBehaviour {
  Start() { Debug.Log('I exist'); }          // once, before the first frame
  Update() { /* every frame */ }             // like Unity's Update()
}
```
Attach it with @ui[Inspector ▸ + Add script ▸ hello] on an object, press @ui[Play], and **I exist** appears in the Console.

::: dummies
`class Hello extends MonoBehaviour` means "Hello is a kind of script". `Start` and `Update` are the two cards you will use most: `Start` runs once, `Update` runs again and again, about 60 times a second.
:::

### 2. `this` is your object, and the components are on it
Inside a script `this` is the object the script sits on. Move it with `this.transform`, find its other components with `this.GetComponent('sprite')`, and read the time since the last frame with `Time.deltaTime`.

**In the file** `scripts/hello.js` (replace the `Update` line from step 1)
```js
Update() { this.transform.Translate(2 * Time.deltaTime, 0, 0); } // 2 units per second to the right
```
Add `Time` to the `import` line (`import { MonoBehaviour, Debug, Time } from 'nord';`), press @ui[Play], and the object slides right. Multiplying by `Time.deltaTime` keeps the speed the same on slow and fast computers.

::: dummies
Why multiply by `Time.deltaTime`? A fast computer draws 144 frames a second and a slow one 30. Without it the object would move 5 times farther on the fast one. `deltaTime` is "how long the last frame took", so speed stays fair.
:::

### 3. Fields you can edit in the Inspector
The Unity `[SerializeField]` is a line at the top of the class. Every key becomes a field in the Inspector, and the script reads it as `this.speed`.

**In the file** `scripts/hello.js` (add as the first line inside the class, and use `this.speed` in `Update`)
```js
static attributes = SerializeField({ speed: 2 });   // shows as "speed" in the Inspector
```
Add `SerializeField` to the `import` line too and replace `2` in `Update` with `this.speed`. Change the number in the Inspector without touching the code; each object that has the script can use its own value.

::: dummies
Think of a field as a dial on the actor's instruction card. The card (the script) is the same for everyone, but you can turn the dial differently on each object.
:::

### 4. Objects talk to each other
`Find`, `GetComponent` and `Instantiate` work the way they do in Unity (see the table below). Collisions and triggers arrive as methods too: write `OnTriggerEnter(other)` and the engine calls it when something enters the trigger.

### 5. Two naming styles, one engine
`MonoBehaviour` uses Unity's capitalised names (`Start`, `Update`). `NordScript` uses lower-case names (`start`, `update(dt)`). Pick **one style per script**; both can live in the same project. The Unity names are a thin layer over the native ones, so there is no speed penalty.

::: dummies
You do not need to learn both. If you know Unity, use `MonoBehaviour`. If you have never used Unity, either works; just copy the style of the first example you try.
:::

**Check yourself:** attach `hello.js` to an object and press @ui[Play]. You should see the Console line **I exist**, and the object slides to the right at the speed you set in the Inspector.

**Next:** [Your first script](ex-first-script.html) shows the same idea in both styles, with Unity C# next to it.

## The 10-minute map: Unity to Nord
| In Unity | In Nord |
|---|---|
| Scene, GameObject, Component | **Scene** (`.scene.json`), **Entity**, **Component** (sprite, rigidbody, collider…) |
| C# script on a GameObject | JavaScript file in `scripts/`, attached in the Inspector |
| `MonoBehaviour` | @api[MonoBehaviour] (Unity names) **or** @api[NordScript] (lower-case names). Both work together |
| `Start / Update / FixedUpdate` | `Start / Update / FixedUpdate` (MonoBehaviour) or `start / update(dt) / fixedUpdate(dt)` (NordScript) |
| `[SerializeField] float speed` | `static attributes = SerializeField({ speed: 5 })` |
| `GetComponent<T>()` | `this.GetComponent('sprite')` or `entity.getScript(MyScript)` |
| `Instantiate(prefab)` | `await this.Instantiate('prefabs/x.prefab.json', { pos })` |
| `Destroy(obj)` | `this.Destroy(obj)` / `entity.destroy()` |
| `Input.GetAxis("Horizontal")` | `Input.GetAxis('Horizontal')` or project actions: `this.input.axis('left','right')` |
| `Rigidbody2D.velocity = …` | `this.physics.setVelocity(entity, vx, vy)` |
| `OnTriggerEnter2D(Collider2D o)` | `OnTriggerEnter(other)` (other is the entity) |
| `StartCoroutine` / `yield return new WaitForSeconds` | the same, with `function*` and `yield new WaitForSeconds(s)` |
| Singleton / `GameManager.Instance` | `class X extends Singleton` → `X.instance`; built-in @api[GameManager] |
| `UnityEvent`, C# events | @api[UnityEvent], `this.events.on / emit`, `entity.on / emit` |
| `PlayerPrefs` | @api[PlayerPrefs] or `this.save.get / set` |
| `SceneManager.LoadScene` | `SceneManager.LoadScene(path)` / `this.game.loadScene(path)` |
| ScriptableObject | JSON file + `ScriptableObject.Load(path)` |
| Canvas / UI Toolkit | `this.ui.label / button / bar` or declarative `.ui.json` (UI Designer) |
| Debug.Log | `Debug.Log` / `this.log` (shows in the editor Console, with [Tag] filtering) |

## The examples
1. [Your first script](ex-first-script.html): lifecycle, Inspector fields, logging.
2. [Input and movement](ex-input-movement.html): keys, axes, 2D and 3D, physics movement.
3. [Finding objects and talking to scripts](ex-find-and-talk.html): Find, tags, GetComponent, calling other scripts.
3.5. [Build a clock: objects, hierarchy, materials and your first script](ex-clock.html): the classic first Unity exercise from primitives, with the same numbers and colours.
3.6. [Build a digital clock: primitives and 3D text in the world](ex-digital-clock.html): a desk clock whose numbers are world-space text, with a Unity-style script, a blinking colon and a 12/24 hour switch.
4. [GameManager and Singletons](ex-game-manager.html): score, lives, state; other scripts call and listen.
5. [Spawning, prefabs and Destroy](ex-spawn-destroy.html)
6. [Collisions, triggers and raycasts](ex-collisions.html)
7. [Time: coroutines, Invoke, timers, tweens](ex-time-coroutines.html)
8. [UI: HUD, buttons, menus](ex-ui-hud.html)
9. [Audio](ex-audio.html)
9.5. [A music player and sound effects](ex-music-player.html): a playlist with autoplay, skip, stop and volume buttons, plus a tick and an hour chime for the clock.
10. [Saving and loading](ex-save-load.html)
11. [Scenes and persistent objects](ex-scenes.html)
12. [Events and messages](ex-events.html): UnityEvent, EventBus, entity events, Inspector signals.
13. [Enemy AI and state machines](ex-ai-states.html)
14. [Data assets (ScriptableObject)](ex-data-assets.html)
15. [Camera, 3D and effects](ex-camera-3d.html)
16. [Debugging and the Dev Console](ex-debug-tools.html)
17. [**Coin Dash**: a whole small game](ex-coin-dash.html) (project `examples/coin-dash`, every script explained)
18. [Migration guide: C# habits to JavaScript](ex-migration.html): the traps.

### Bigger examples and more topics
19. [**A platformer: Jump Dash**](ex-platformer.html): coyote time, jump buffer, variable jump, hazards, camera, goal (project `examples/jump-dash`).
20. [**A shooter: Star Shooter**](ex-shooter.html): mouse aiming, pooled bullets, waves, particles, health (project `examples/star-shooter`).
21. [Health, damage and death](ex-health-damage.html)
22. [Animation: sprites and the Animator](ex-animation.html)
23. [Tilemaps and level design](ex-tilemap-levels.html)
24. [Inventory, items and quests](ex-inventory-quests.html)
25. [Talking to NPCs: interaction and dialogue](ex-dialogue-npc.html)
26. [Juice: particles, shake, hit-stop](ex-juice-effects.html)
27. [Touch, mobile and responsive games](ex-mobile-touch.html)
28. [Multiplayer basics](ex-multiplayer.html)
29. [The editor for Unity users](ex-editor-for-unity-users.html): every Unity window and menu, with screenshots.

### Language, systems and shipping
30. [C# to JavaScript: the language side by side](ex-language.html)
31. [Physics recipes](ex-physics-recipes.html)
32. [Clicking, hovering and dragging objects](ex-picking-dragging.html)
33. [Options menu: volume, language, fullscreen, key rebinding](ex-settings-menu.html)
34. [3D: controllers, cameras, vehicles, interaction](ex-3d-controllers.html)
35. [Structuring a bigger game: patterns](ex-architecture.html)
36. [Unity packages and features: what to use in Nord](ex-unity-packages.html)
37. [Starting points by game type](ex-genres.html)
38. [Build, publish and ship](ex-build-publish.html)
39. [Optimising and testing your game](ex-optimization-testing.html)
40. [Procedural content and randomness](ex-procedural.html)

### Converting an existing Unity project or tutorial
41. [Converting Unity projects and tutorials to Nord](ex-unity-conversion.html): the step-by-step playbook, also for AI agents (the MCP server has tools for it).

## How to try an example
1. Create a project: `nord new my-game -t 2d` (or start the editor and use @ui[New project]).
2. Save the script in `my-game/scripts/`, for example `scripts/spin.js`.
3. Select an object in the @ui[Hierarchy], @ui[+ Add script], pick the file. Press @ui[Play].
4. Errors show in the @ui[Console] with the file and line; scripts hot-reload while the game runs.

## More Unity-style
42. [Unity helpers cookbook](ex-unity-helpers.html): Random, Color, KeyCode, mouse events, free Instantiate/Destroy.
43. [Input actions and the Input editor](ex-input-editor.html)
44. [Vector Rocks: Asteroids on a green vector monitor](ex-vector-rocks.html): a whole game with phosphor glow, a monitor bezel, waves and five power-ups.
45. [Which platform? Editor, Mac, Windows, web, phone](ex-platform.html): `Application.platform`, `isEditor`, `os`, `Cursor`.
46. [Pathfinding and NavMesh: moving around obstacles](ex-pathfinding.html): grid A*, waypoint paths, `NavMeshAgent` mapped to Nord.
47. [Cutscenes and the Timeline](ex-cutscenes.html): `PlayableDirector` mapped to the Timeline tab, events, skipping.
48. [2D lights and shadows](ex-lights-2d.html): URP 2D Lights mapped to the `light2d` library scripts, flashlight, stealth.

### Build a whole game, step by step (Unity style)
49. [Dungeon 1: A hero that moves](ex-dungeon-1-hero.html): project, scene, `Input.GetAxis`, `Time.deltaTime`.
50. [Dungeon 2: Walls](ex-dungeon-2-walls.html): a level from a text map, prefabs, `Rigidbody2D.velocity`.
51. [Dungeon 3: Camera and a bigger level](ex-dungeon-3-camera.html): `LateUpdate` follow camera, `EventBus`, merging tiles.
52. [Dungeon 4: Coins and score](ex-dungeon-4-coins.html): triggers, the `GameManager`, a HUD, restart.
53. [Dungeon 5: Enemies and health](ex-dungeon-5-enemies.html): coroutines, `GetComponent`, grace time, knockback, game over.
54. [Dungeon 6: Light and shipping](ex-dungeon-6-light.html): 2D light and shadows, building for the web.
55. [Ember Crypt: a complete game](ex-ember-crypt.html): pixel art, sword, line of sight, keys and gates, juice, title, pause, saved high score.

### Unity API in Nord: every command, and Shadertoy
56. [**Shadertoy: use any shader from shadertoy.com**](ex-shadertoy.html): paste a shader, use it as a background, on a 3D plane, or as a post effect; textures, Buffer A–D, keyboard, audio, mouse.
57. [**Unity API in Nord: the map**](ex-unity-api.html): where every Unity command lives, and the honest "not built yet" list.
58. [Scripting and objects](ex-unity-api-scripting.html): OnBecameVisible, SetParent, RequireComponent, Awaitable, PlayerPrefs.
59. [Math types](ex-unity-api-math.html): Vector4, Matrix4x4, Bounds, Rect, Ray, Plane, Color32, AnimationCurve, Gradient.
60. [Input](ex-unity-api-input.html): axes, touches, sensors, the New Input System and `.inputactions` files.
61. [Physics 2D](ex-unity-api-physics2d.html): constraints, capsule/polygon/composite colliders, casts, joints.
62. [Physics 3D, joints and the camera](ex-unity-api-physics3d.html): SphereCast, BoxCast, overlaps, joints, ScreenPointToRay.
63. [Lines, trails, masks and shapes](ex-unity-api-rendering.html): LineRenderer, TrailRenderer, SpriteMask, SpriteShape.
64. [Physics Lab](ex-physics-lab.html): three test projects, how to run their checks, and play-mode editing.

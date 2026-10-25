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

## Choose an example by task

| Task | Read in this order | You should finish with |
|---|---|---|
| Start writing behavior | [First script](ex-first-script.html) → [Input and movement](ex-input-movement.html) | A controllable object |
| Connect objects | [Find and talk](ex-find-and-talk.html) → [Events](ex-events.html) | One object responding to another |
| Make a game loop | [Spawning](ex-spawn-destroy.html) → [Health](ex-health-damage.html) → [Scenes](ex-scenes.html) | Objects can appear, take damage and restart |
| Add player feedback | [UI](ex-ui-hud.html) → [Audio](ex-audio.html) → [Juice](ex-juice-effects.html) | A result the player can see and hear |
| Use maths or physics | [Unity API map](ex-unity-api.html) → the relevant API group → [Physics Lab](ex-physics-lab.html) | A small isolated experiment |
| Finish something | [Coin Dash](ex-coin-dash.html), [Dungeon part 1](ex-dungeon-1-hero.html), or [Ember Crypt](ex-ember-crypt.html) | A whole game to inspect and adapt |
| Bring a Unity tutorial | [Language comparison](ex-language.html) → [Conversion workflow](ex-unity-conversion.html) | A port based on supported Nord features |

## Before copying a file
Use a project of the page's stated type. Follow its scene setup and component requirements, copy the complete file into the named path, then attach it in the Inspector. Imports alone do not attach behavior. C# code is a comparison; the Nord JavaScript file is the runnable version.

> **Trap:** `Instantiate` returns a Promise in Nord. Await it before using the result. Import `UnityInput as Input` when using Unity-style input names; the native Input service has a different contract.

## Try a tiny challenge
Combine just two recipes: a moving object and a score label. Add one point when the object reaches your target. Only then add particles, triumphant music, or the world's smallest victory parade.

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

## Browse the recipes
Use the grouped topic directory below or the sidebar: fundamentals, gameplay, production tools, complete projects and Unity API recipes. **Old** retains earlier duplicate overviews. Choose one complete example, verify it alone, then adapt it.

## How to try an example
1. Create a project: `nord new my-game -t 2d` (or start the editor and use @ui[New project]).
2. Save the script in `my-game/scripts/`, for example `scripts/spin.js`.
3. Select an object in the @ui[Hierarchy], @ui[+ Add script], pick the file. Press @ui[Play].
4. Errors show in the @ui[Console] with the file and line; scripts hot-reload while the game runs.

## Check yourself

Confirm the example works on its own before combining it with another. Check the Console and required components if the expected result is missing.

Next: [Your first script](ex-first-script.html). Back to: [Manual topics](manual-paths.html).

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
4. [GameManager and Singletons](ex-game-manager.html): score, lives, state; other scripts call and listen.
5. [Spawning, prefabs and Destroy](ex-spawn-destroy.html)
6. [Collisions, triggers and raycasts](ex-collisions.html)
7. [Time: coroutines, Invoke, timers, tweens](ex-time-coroutines.html)
8. [UI: HUD, buttons, menus](ex-ui-hud.html)
9. [Audio](ex-audio.html)
10. [Saving and loading](ex-save-load.html)
11. [Scenes and persistent objects](ex-scenes.html)
12. [Events and messages](ex-events.html): UnityEvent, EventBus, entity events, Inspector signals.
13. [Enemy AI and state machines](ex-ai-states.html)
14. [Data assets (ScriptableObject)](ex-data-assets.html)
15. [Camera, 3D and effects](ex-camera-3d.html)
16. [Debugging and the Dev Console](ex-debug-tools.html)
17. [**Coin Dash**: a whole small game](ex-coin-dash.html) (project `examples/coin-dash`, every script explained)
18. [Migration guide: C# habits to JavaScript](ex-migration.html): the traps.

## How to try an example
1. Create a project: `nord new my-game -t 2d` (or start the editor and use @ui[New project]).
2. Save the script in `my-game/scripts/`, for example `scripts/spin.js`.
3. Select an object in the @ui[Hierarchy], @ui[+ Add script], pick the file. Press @ui[Play].
4. Errors show in the @ui[Console] with the file and line; scripts hot-reload while the game runs.

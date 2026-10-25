---
title: 58 · Unity API: scripting and objects
section: Examples
order: 58
summary: MonoBehaviour events including OnBecameVisible and OnApplicationFocus, SetParent at run time, RequireComponent, Awaitable, PlayerPrefs, and the scene-tree commands.
---

**Goal:** use the Unity scripting commands you know for objects, the scene tree and saving, and know exactly where Nord differs.

All names come from `import { … } from 'nord'`. Start every script with `export default class Name extends MonoBehaviour`.

## Events (the lifecycle)
| Unity | When it runs in Nord |
|---|---|
| `Awake()` | Before the scene starts (after all objects exist). |
| `OnEnable()` / `OnDisable()` | The object (or a parent) is switched on or off with `SetActive`. |
| `Start()` | Once, before the first `Update`. |
| `FixedUpdate()` | 60 times a second, before physics. |
| `Update()` / `LateUpdate()` | Every frame. |
| `OnDestroy()` | The object is destroyed (also when the scene changes). |
| `OnTriggerEnter/Exit(other)`, `OnCollisionEnter/Exit(other)` | Physics events (2D and 3D use the same names; there is no `…2D` suffix). |
| `OnMouseDown/Up/Enter/Exit/Over` | Pointer on the object's collider. |
| **`OnBecameVisible()` / `OnBecameInvisible()`** | The camera starts or stops seeing the object. Called at the first frame it is on screen. |
| **`OnApplicationFocus(bool)`** | The game window gains or loses focus. |
| **`OnApplicationPause(bool)`** | The browser tab is hidden / shown (phone: app in the background). |
| **`OnApplicationQuit()`** | The page is closed or `Application.Quit()` is called. |
| **`OnValidate()`** | After the script's fields were set (at start and when you spawn or edit it). |
| **`OnTransformParentChanged()` / `OnTransformChildrenChanged()`** | After `SetParent`. |
| `Reset`, `OnDrawGizmos` | editor-only in Unity, not called in Nord. |

**File: `scripts/Offscreen.js`** (new file, the whole file)
```js
import { MonoBehaviour, Application } from 'nord';

export default class Offscreen extends MonoBehaviour {
  OnBecameInvisible() { this.entity.set('sprite', 'alpha', 0.2); this.log('left the screen'); }
  OnBecameVisible()   { this.log('on screen again'); }
  OnApplicationFocus(hasFocus) { if (!hasFocus) this.log('click the game to continue'); }
  OnApplicationQuit() { this.log('saving before the page closes'); }
}
```
Walk the object out of the camera view and the Console prints `left the screen`.

> **Trap:** `OnBecameVisible` is only checked for objects whose script defines it, so it costs nothing elsewhere. In 2D the object's picture (its sprites) is compared with the camera; in 3D its meshes with the camera frustum.

## Attributes: RequireComponent, DisallowMultipleComponent
JavaScript has no attributes, so these are static fields on the class (the names match Unity).

**File: `scripts/Player.js`** (new file, the whole file)
```js
import { MonoBehaviour, Rigidbody2D, CapsuleCollider2D } from 'nord';

export default class Player extends MonoBehaviour {
  static RequireComponent = [Rigidbody2D, CapsuleCollider2D];   // added for you when the script is added
  static DisallowMultipleComponent = true;                      // a second Player on the same object is refused

  Start() {
    const rb = this.GetComponent(Rigidbody2D);
    rb.freezeRotation = true;
    rb.interpolation = 'Interpolate';
  }
}
```
`RequireComponent` takes Unity classes (`Rigidbody2D`, `BoxCollider`, `HingeJoint2D`), Nord component names (`'audioSource'`), or other script classes. A required Unity component is added with Unity's defaults (a `Rigidbody2D` starts as **Dynamic**).

## The scene tree at run time
| Unity | Nord |
|---|---|
| `Instantiate(prefab, position, rotation, parent)` | `Instantiate('prefabs/coin.prefab.json', { pos: [x, y, 0], rot, scale, parent })` returns a Promise (use `await`). |
| `Destroy(obj, delay)` | the same. |
| `transform.SetParent(parent, worldPositionStays = true)` | **works at run time** in 2D and 3D. `true` keeps the object where it is on screen, `false` keeps its local numbers. `null` makes it a root object. |
| `transform.parent = other` | same as `SetParent(other)`. |
| `transform.DetachChildren()` | every child becomes a root object, keeping its place in the world. |
| `transform.SetSiblingIndex(i)`, `SetAsFirstSibling()` | yes. |
| `GameObject.Find`, `FindWithTag`, `FindObjectOfType`, `GetComponentInChildren/Parent` | yes. |

**File: `scripts/Hand.js`** (new file, the whole file: pick up an item and carry it)
```js
import { MonoBehaviour, Physics2D, Vector2, UnityInput as Input, KeyCode } from 'nord';

export default class Hand extends MonoBehaviour {
  held = null;
  Update() {
    if (!Input.GetKeyDown(KeyCode.E)) return;
    if (this.held) {                                   // let go: it stays where it is, back in the scene root
      this.held.transform.SetParent(null);
      this.held = null;
      return;
    }
    const item = Physics2D.OverlapCircle(new Vector2(...this.transform.position.toArray()), 40);
    if (item && item.CompareTag('item')) {
      item.transform.SetParent(this.transform);        // worldPositionStays = true: no jump
      this.held = item;
    }
  }
}
```
The item follows the hand without jumping when you pick it up, and stays put when you drop it.

> **Trap:** A child of a rotating or scaled parent rotates and scales with it. After `SetParent(x, true)` Nord recomputes the child's local position, rotation and scale so the picture does not change; if the parent is later rotated, the child turns with it, as in Unity.

## Coroutines and `Awaitable`
Coroutines work like Unity (`StartCoroutine`, `yield return new WaitForSeconds(1)`, `WaitUntil`, `WaitForEndOfFrame`). The newer `Awaitable` API works with `async`:

**File: `scripts/Wave.js`** (new file, the whole file)
```js
import { MonoBehaviour, Awaitable } from 'nord';

export default class Wave extends MonoBehaviour {
  async Start() {
    for (let i = 0; i < 3; i++) {
      await Awaitable.WaitForSecondsAsync(1);   // game time: it stops while the game is paused
      this.log(`wave ${i + 1}`);
    }
    await Awaitable.NextFrameAsync();
    await Awaitable.FixedUpdateAsync();
  }
}
```
`NextFrameAsync`, `EndOfFrameAsync`, `FixedUpdateAsync`, `WaitForSecondsAsync`, `MainThreadAsync` and `BackgroundThreadAsync` exist (the last two return at once: there are no threads in the browser). Unlike a plain `await new Promise(r => setTimeout(r, 1000))`, these use game time.

## PlayerPrefs
| Unity | Nord |
|---|---|
| `PlayerPrefs.SetInt/SetFloat/SetString(key, v)` | saves at once (the game's save slot in the browser's storage). `SetInt` truncates to a whole number, `SetFloat` stores a number. |
| `GetInt/GetFloat/GetString(key, default)` | typed: `GetInt` always gives an integer, `GetString` a string. |
| `HasKey(key)` | yes. |
| **`DeleteKey(key)`** | removes one key. |
| `DeleteAll()` | clears the save slot. |
| **`Save()`** | does nothing (every write is already stored); it is there so old scripts keep working. |

**File: `scripts/Score.js`** (new file, the whole file)
```js
import { MonoBehaviour, PlayerPrefs } from 'nord';

export default class Score extends MonoBehaviour {
  Start() {
    this.best = PlayerPrefs.GetInt('best', 0);
    if (!PlayerPrefs.HasKey('name')) PlayerPrefs.SetString('name', 'Player');
  }
  Finish(score) {
    if (score > this.best) PlayerPrefs.SetInt('best', score);
    PlayerPrefs.Save();
  }
  Reset() { PlayerPrefs.DeleteKey('best'); }
}
```

## Check yourself
* A script with `static RequireComponent` shows the extra component in the Inspector after Play (look at the live Inspector while playing).
* `SetParent` on a moving object: it does not jump; `GetComponent` on a script's parent finds the new parent.
* The Physics Lab project (`examples/physics-lab`) runs the SetParent, RequireComponent and PlayerPrefs checks through `runtime/core/unity-extra.test.mjs` (`node --test runtime/core/unity-extra.test.mjs`).

Next: [Math types](ex-unity-api-math.html). Back to: [Unity API map](ex-unity-api.html).

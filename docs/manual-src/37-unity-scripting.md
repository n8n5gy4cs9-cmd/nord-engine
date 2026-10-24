---
title: Unity-style scripting
section: Manual
order: 37
summary: MonoBehaviour, Singleton, GameManager, AudioManager, coroutines, Invoke, UnityEvent, ScriptableObject and ObjectPool: how to create them, attach them, and every method, with Unity names and step-by-step examples.
---

If you know Unity, you can write Nord scripts the way you already do. @term[MonoBehaviour], @term[Singleton], @term[GameManager] and friends use Unity's names and rules (`Awake`, `Start`, `Update`, coroutines, `Instantiate`, `PlayerPrefs`…), on top of the normal Nord script system. Everything here is optional: a plain `NordScript` (lower-case `start()`/`update()`) works side by side in the same project.

::: dummies
A **script** is a file with instructions for one object. A **MonoBehaviour** is the Unity name for "a script that lives on an object and gets Start/Update calls". A **Singleton** is a script of which there is only ever one, reachable from everywhere by name (`Score.instance`). A **GameManager** is a ready-made singleton that keeps score, lives and the game state.
:::

## Create a script (3 ways)
1. In the @ui[Assets] tab right-click a folder (for example `scripts`) ▸ @ui[New MonoBehaviour script (Unity-style)], @ui[New Singleton script] or @ui[New GameManager script]. Type a name and press @key[Enter]. The file opens in the @ui[Code] tab.
2. Same menu in the @ui[Create] menu of the Assets tab (the **+** button).
3. By hand: make `scripts/Player.js` and start it with `import { MonoBehaviour } from 'nord';`.

## Attach it to an object
1. Select the object in the @ui[Hierarchy].
2. In the @ui[Inspector] press @ui[+ Add script] and pick your script, **or** drag the `.js` file from @ui[Assets] onto the object (in the Hierarchy or the Scene view).
3. The script's fields (see `SerializeField` below) appear in the Inspector under the script's name. Change them there; they are saved in the scene.
4. Press @ui[Play]. Errors show in the @ui[Console] with a clickable file and line.

A script can be on many objects; each gets its own copy and its own field values. A @term[Singleton] must be on **one** object only.

## MonoBehaviour: the Unity script
@ui[Assets ▸ Create ▸ MonoBehaviour script] gives you this:

```js
import { MonoBehaviour, SerializeField, Time, WaitForSeconds, UnityInput as Input } from 'nord';

export default class Player extends MonoBehaviour {
  static attributes = SerializeField({ speed: 5, jump: { default: 3, min: 0, max: 10 } });

  Awake() {}                       // once, when the object is created
  Start() {                        // once, before the first Update
    this.StartCoroutine(this.Blink());
  }
  Update() {                       // every frame
    this.Translate(Input.GetAxis('Horizontal') * this.speed * Time.deltaTime);
  }
  OnTriggerEnter(other) {          // a trigger collider was entered
    if (other.CompareTag('coin')) this.Destroy(other);
  }
  *Blink() {                       // a coroutine
    while (true) { this.SetActive(false); yield new WaitForSeconds(0.1); this.SetActive(true); yield new WaitForSeconds(0.4); }
  }
}
```

@ui[Rules:] extend @api[MonoBehaviour]; use the **capitalised** Unity names; never mix them with the lower-case Nord names (`start`, `update`) in the same class.

### Fields: `[SerializeField]`
`static attributes = SerializeField({ speed: 5, name: 'Bob', alive: true, color: '#ff0000', pos: [0, 0, 0] })` makes **Inspector fields**. Numbers get drag boxes (add `{ default, min, max }` for a slider), booleans checkboxes, `#rrggbb` strings colour pickers, 2/3 numbers vectors. Read them as `this.speed` anywhere in the script.

### Lifecycle (in order)
| Method | When |
|---|---|
| @api[Awake()] | The object and its scripts are created. Set up your own data here. |
| @api[OnEnable()] | The object or script becomes active (also after `SetActive(true)`). |
| @api[Start()] | Once, just before the first `Update`, after every `Awake` ran. Find other objects here. |
| @api[FixedUpdate()] | Fixed 60 times per second. Physics work. |
| @api[Update()] | Every frame. Input, movement. |
| @api[LateUpdate()] | After all `Update`s: cameras that follow things. |
| @api[OnCollisionEnter(other)] @api[OnCollisionExit(other)] | Solid colliders touch / separate. |
| @api[OnTriggerEnter(other)] @api[OnTriggerExit(other)] | A trigger volume is entered / left. |
| @api[OnDisable()] | Switched off. |
| @api[OnDestroy()] | The object is removed or the scene ends. Clean up here. |

### What a MonoBehaviour can do
| Unity | Nord |
|---|---|
| `gameObject`, `transform` | `this.gameObject`, `this.transform` (both the entity) |
| `transform.position` / `localPosition` | `this.position`, `this.localPosition` (a `Vector3`) |
| `transform.Translate(x,y,z)` / `Rotate` | `this.Translate(x, y, z)`, `this.Rotate(x, y, z)` |
| `name`, `tag`, `CompareTag("x")` | `this.name`, `this.tag`, `this.CompareTag('x')` |
| `GetComponent<T>()` | `this.GetComponent('sprite')`, `this.GetComponent(MyScript)`; also `GetComponentInChildren`, `GetComponentInParent`, `GetComponents`, `TryGetComponent` |
| `GameObject.Find("Name")` | `this.Find('Name')` |
| `FindWithTag`, `FindGameObjectsWithTag` | same names |
| `FindObjectOfType<T>()` | `this.FindObjectOfType(MyScript)`, `FindObjectsOfType` |
| `SetActive(bool)` | `this.SetActive(true/false)` |
| `Instantiate(prefab, pos)` | `await this.Instantiate('prefabs/bullet.prefab.json', { pos: [x, y, 0] })` or `this.Instantiate(entity)` to clone |
| `Destroy(obj, delay)` | `this.Destroy(obj, 2)` |
| `Invoke("M", 2)` / `InvokeRepeating("M", 1, 0.5)` / `CancelInvoke` / `IsInvoking` | same names |
| `StartCoroutine` / `StopCoroutine` / `StopAllCoroutines` | same names; `yield null` waits a frame |
| `SendMessage("Method", arg)` | `this.SendMessage('Method', arg)` |

Coroutine yields: `null` (next frame), @api[new WaitForSeconds(s)], @api[new WaitUntil(() => cond)], @api[new WaitWhile(() => cond)], @api[new WaitForFixedUpdate()], @api[new WaitForEndOfFrame()], or another coroutine (nested).

### Static helpers (import from `'nord'`)
* @api[Time]: `deltaTime`, `fixedDeltaTime`, `time`, `timeScale` (settable: 0 pauses, 0.1 slow motion), `frameCount`.
* @api[UnityInput] (import as `Input`): `GetKey / GetKeyDown / GetKeyUp('Space' | 'KeyA' | 'ArrowLeft' | 'Mouse0')`, `GetAxis('Horizontal' | 'Vertical')` (WASD + arrows + stick), `GetButton / GetButtonDown / GetButtonUp('jump')` for your project's input actions, `GetMouseButton(n)`, `mousePosition`.
* @api[Mathf]: `PI, Abs, Floor, FloorToInt, Clamp, Lerp, LerpUnclamped, InverseLerp, MoveTowards, SmoothStep, Repeat, PingPong, Approximately, DeltaAngle, LerpAngle, Random`.
* @api[Vector2] / @api[Vector3]: `zero, one, up, down, left, right, forward, back, Distance, Dot, Cross, Lerp, MoveTowards, magnitude, sqrMagnitude, normalized, Clone, Add, Sub, Mul, Set, Equals, toArray`.
* @api[Debug]: `Log, LogWarning, LogError, Assert` (to the @ui[Console]).
* @api[PlayerPrefs]: `GetInt/GetFloat/GetString(key, default)`, `SetInt/SetFloat/SetString`, `HasKey`, `DeleteAll` (saved in the browser / app).
* @api[SceneManager]: `LoadScene('scenes/level2.scene.json')`, `ReloadScene()`, `sceneName`. @api[Application]: `Quit()`, `isPlaying`.

### More Unity helpers (import from `'nord'`)
* @api[KeyCode]: `Input.GetKey(KeyCode.Space)`, `KeyCode.W`, `Alpha1`, `LeftShift`, `UpArrow`, `Mouse0`, `F1`… Also `Input.GetMouseButtonUp`, `GetAxisRaw`, `anyKey`, `anyKeyDown`.
* @api[Random]: `Random.Range(0, 10)` (two integers = int in [0, 10) like C#), `Random.Range(0.5, 1.5)` (floats), `value`, `insideUnitCircle`, `onUnitSphere`, `insideUnitSphere`, `Pick(array)`, `InitState(seed)`.
* @api[Color]: `Color.red`, `new Color(1, .5, 0)`, `Color.FromHex('#ff8800')`, `Color.Lerp`, `c.toHex()` for tints.
* More @api[Mathf]: `SmoothDamp` (returns `{ value, velocity }`), `Atan, Asin, Acos, Log, Exp`. More @api[Vector2]/@api[Vector3]: `Scale, Div, negative, Normalize, Angle, SignedAngle, ClampMagnitude, Project, Reflect, Perpendicular, Min, Max, LerpUnclamped`.
* @api[Time]: also `unscaledDeltaTime`, `fixedTime`, `realtimeSinceStartup`; coroutines: `WaitForSecondsRealtime`.
* Free functions like Unity: `Instantiate(...)`, `Destroy(obj, delay)`, `DontDestroyOnLoad(obj)`, `GameObject.Find / FindWithTag / FindGameObjectsWithTag`, `UnityObject.FindObjectOfType(MyScript)`, `Screen.width/height`, `Physics2D.OverlapBox(center, size)`, `Debug.LogFormat`.
* Field helpers: `SerializeField({ speed: Range(0, 10, 5), mode: Enum(['idle', 'chase'], 'idle'), target: EntityRef() })`.
* On a MonoBehaviour: `localScale`, `eulerAngles`, `parent`, `childCount`, `GetChild(i)`, `FindChild(name)`, `AddComponent(type)`, `LookAt(target)` (2D), `isGrounded`, `velocity` / `SetVelocity(x, y)` (2D physics), `print(...)`, and the mouse events @api[OnMouseDown] @api[OnMouseUp] @api[OnMouseEnter] @api[OnMouseExit] @api[OnMouseOver] @api[OnMouseDrag] @api[OnMouseUpAsButton] (pointer over the object's box).

Rotations are Euler degrees (`eulerAngles`), there is no `Quaternion`. Vectors have no `+`/`*` operators in JavaScript: use `a.Add(b)`, `a.Mul(k)`.

## Singleton: one object, reachable everywhere
@ui[Assets ▸ Create ▸ Singleton script]:

```js
import { Singleton } from 'nord';

export default class Score extends Singleton {
  static persistent = false;      // true = survives scene loads
  Awake() { this.value = 0; }
  Add(n) { this.value += n; }
}
```
1. Put `Score` on **one** object in the scene (an empty object named `Score` is the usual place).
2. Use it from any script: `Score.instance.Add(10)`. @api[Score.require()] does the same but throws a clear error when the script is missing from the scene.
3. A second copy destroys itself and warns in the Console.
4. `static persistent = true` keeps the object when you load another scene (it adds the @term[Persist] behaviour), ideal for settings, inventory, music.

## GameManager: score, lives, state
@ui[Assets ▸ Create ▸ GameManager script] makes `export default class extends GameManager {}`, a persistent singleton with batteries included. Put it on one object in your first scene.

| Member | What it does |
|---|---|
| @api[GameManager.instance] | the one manager |
| `score`, `lives`, `state`, `data` | current values (`state` starts as `'playing'`) |
| @api[AddScore(n)] | adds to `score`, emits `score` |
| @api[SetLives(n)] @api[LoseLife()] | change lives, emits `lives`; reaching 0 calls `GameOver()` |
| @api[SetState(name)] | `'playing'`, `'paused'`, `'gameover'` or your own, emits `state` `{ state, previous }` |
| @api[GameOver()] | state `'gameover'` and the `gameover` event with the score |
| @api[Get(key, default)] @api[Set(key, value)] | free data store, emits `data` |
| @api[Pause()] @api[Resume()] @api[TogglePause()] | freeze / continue the game |
| @api[LoadScene(path)] @api[Restart()] | change scene / restart with score and lives reset |
| @api[SaveHighScore(key)] | stores the best score (default key `highscore`) and returns it |

Fields in the Inspector: `startLives` (3) and `startState`. Listen to its events from anywhere:
```js
this.game.events.on('score', ({ score }) => this.label.set(`Score ${score}`));
this.game.events.on('gameover', () => GameManager.instance.LoadScene('scenes/menu.scene.json'));
```

## AudioManager
A persistent singleton: add `AudioManager` (import from `'nord'` and extend it, or attach a script that is `export default class extends AudioManager {}`), then `AudioManager.instance.PlaySfx('assets/audio/jump.ogg')`, `PlayMusic(path)`, `StopMusic()`, `SetVolume('music', 0.5)`, `Mute('sfx')`.

## Events and data
* @api[UnityEvent]: `const onHit = new UnityEvent(); onHit.AddListener(fn); onHit.Invoke(5);` (`AddListener` returns an unsubscribe function).
* @api[EventBus]: `EventBus.Subscribe('hit', fn)` and `EventBus.Publish('hit', data)`, a global message bus (same bus as `this.game.events`).
* @api[ScriptableObject]: shared JSON data files: `const sword = await ScriptableObject.Load('data/sword.asset.json')`.
* @api[ObjectPool]: reuse bullets instead of creating them: `const pool = new ObjectPool(this.scene, 'prefabs/bullet.prefab.json'); await pool.Warm(10); const b = await pool.Get({ pos }); pool.Release(b);`.

## Unity to Nord cheat sheet
| Unity | Nord |
|---|---|
| Assets ▸ Create ▸ C# Script | @ui[Assets ▸ Create ▸ MonoBehaviour script] |
| Add Component ▸ script | @ui[Inspector ▸ + Add script] or drag the file onto the object |
| `[SerializeField] float speed` | `static attributes = SerializeField({ speed: 5 })` |
| `public static Score Instance` | `class Score extends Singleton` → `Score.instance` |
| `DontDestroyOnLoad` | `static persistent = true` |
| `Debug.Log` | `Debug.Log` (shows in the Console) |
| `Time.deltaTime` | `Time.deltaTime` |
| `Input.GetAxis("Horizontal")` | `Input.GetAxis('Horizontal')` (import `UnityInput as Input`) |
| `SceneManager.LoadScene` | `SceneManager.LoadScene` / `GameManager.instance.LoadScene` |
| `Resources.Load` / ScriptableObject | `ScriptableObject.Load(path)` |
| `PlayerPrefs` | `PlayerPrefs` |
| `Rigidbody`, `Collider` | the @term[rigidbody] / @term[collider] components in the Inspector |
| `OnTriggerEnter(Collider)` | `OnTriggerEnter(other)` (needs a collider with *trigger* ticked) |

## Troubleshooting
* @bad[Nothing happens:] the script is not attached, or the object is disabled. Check the Inspector and the Console.
* @bad["second X found, destroying the duplicate":] a Singleton is on two objects (or in two scenes). Keep one.
* @bad[`X.instance` is null:] the Singleton script is not in the current scene, or it runs later than the caller. Use `X.require()` in `Start()`, not `Awake()`, or set `persistent = true` and put it in the first scene.
* @bad[Method never runs:] you used a lower-case name (`update`) in a MonoBehaviour class or a typo. Use `Update`.
* Attributes you added show only after saving the script (the Inspector re-reads it).

Many runnable recipes next to the C# versions: [Examples](examples.html) (start with [GameManager and Singletons](ex-game-manager.html) and the whole game [Coin Dash](ex-coin-dash.html)).

Reference: [Scripting](scripting.html), [Unity-style editor](unity-workflow.html), [T03 First script](tut-t03-first-script.html). Source: `runtime/core/unity.js`.

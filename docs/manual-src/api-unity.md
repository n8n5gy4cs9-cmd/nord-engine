---
title: Unity-style scripting API
section: API
order: 3
summary: Scripting reference for the Unity-style layer (MonoBehaviour, Transform, Vector3, Quaternion, Time, Input, Physics2D, components…) in the format of the Unity Scripting API, with the differences from C#.
---
This is the reference for everything a Unity developer finds under **UnityEngine** in Nord. Every name is the Unity name, written in JavaScript: `Start()`, `Update()`, `transform.Translate(...)`, `Vector3.Lerp(...)`. Learn the ideas first in [How the Unity-style coding works](examples.html), then come back here for an exact name or signature.

Everything on this page is imported from `'nord'`. One name differs: Unity's `Input` is exported as **`UnityInput`** (Nord already has its own `Input` class), so import it as `UnityInput as Input`.

**Example** (not a file: the first line of any script that uses these names):
```js
import { MonoBehaviour, SerializeField, Vector3, Quaternion, Mathf, Time, Debug, UnityInput as Input } from 'nord';
```

::: dummies
Read each class like a Unity manual page: **Properties** are values you read or set (`transform.position`), **Methods** are things you call (`Destroy(obj)`), and **Messages** are methods *you write* and the engine calls (`Update`, `OnTriggerEnter`). A member marked **static** is used on the class itself (`Mathf.Clamp`, `Vector3.Distance`), not on an object.
:::

## Differences from C# at a glance
| Unity (C#) | Nord (JavaScript) |
|---|---|
| `public float speed;` / `[SerializeField]` | `static attributes = SerializeField({ speed: 5 })`, read as `this.speed` |
| `GameObject` reference field | `EntityRef()` field: `this.target` is the object itself |
| `KeyCode.Space` | `KeyCode.Space` is the string `'Space'`; raw strings (`'KeyA'`, `'Mouse0'`) work too |
| `Instantiate(prefab)` returns the clone | returns a **Promise**: `const b = await this.Instantiate('prefabs/bullet.prefab.json', { pos })` |
| `SmoothDamp(..., ref velocity)` | returns `{ value, velocity }`; pass the velocity back next frame |
| `Random.Range(0, 10)` int / float by argument type | same rule: two integers give an integer in `[0, 10)`; use `0.5, 1.5` for floats |
| `transform.SetParent(parent, worldPositionStays)` | works at run time (2D and 3D); see [Scripting and objects](ex-unity-api-scripting.html) |
| `Vector3 + Vector3` operators | no operator overloading: `a.Add(b)`, `a.Sub(b)`, `a.Mul(k)` |
| Coroutine `IEnumerator` | generator `*Fade() { yield new WaitForSeconds(1); }` |
| 2D uses X/Y, rotation around Z | same; in a 3D project use Y for turntable rotation |

## MonoBehaviour
`class MyScript extends MonoBehaviour`. The base class of every Unity-style script. A script is a component on an object: one script file, any number of objects.

### Properties
| Name | Description |
|---|---|
| `gameObject` | The object this script is attached to (an *entity*). |
| `transform` | The [Transform](#transform) of this object. |
| `name` | The object's name. |
| `tag` | The first tag of the object (`'Untagged'` if none); settable. |
| `isActiveAndEnabled` | `true` while the object is enabled. |
| `enabledSelf` | `true` if the object itself is enabled. |
| `velocity` | 2D physics velocity as a `Vector2` (settable). |
| `isGrounded` | `true` when the physics body stands on something (2D). |
| `position`, `localPosition`, `localScale`, `eulerAngles` | Shortcuts for the same properties on [Transform](#transform), as `Vector3`. |
| `parent`, `childCount` | The parent object, and the number of children. |
| *each serialized field* | A field declared in `SerializeField` is a property: `this.speed`. An `EntityRef` field is the referenced object. |

### Methods
| Signature | Description |
|---|---|
| `GetComponent(type)` | A component or script on this object, or `null`. `type` is a script class, a Unity name (`'Rigidbody2D'`, `'SpriteRenderer'`), a wrapper class, or a Nord component name (`'sprite'`). |
| `GetComponentInChildren(type)`, `GetComponentInParent(type)`, `GetComponents(type)`, `TryGetComponent(type)` | As in Unity. |
| `AddComponent(type, data?)` | Add a script class or a component (`this.AddComponent('sprite', { texture: 'a.png' })`). |
| `Find(nameOrObject)` | The object with that name or id; an object passed in is returned unchanged. |
| `FindWithTag(tag)`, `FindGameObjectsWithTag(tag)` | One / all objects with the tag. |
| `FindObjectOfType(Class)`, `FindObjectsOfType(Class)` | The script instance(s) of that class in the scene. |
| `FindChild(name)`, `GetChild(index)` | A descendant by name; a child by index. |
| `CompareTag(tag)` | `true` if the object has the tag. |
| `SetActive(bool)` | Enable or disable the object. |
| `Instantiate(pathOrObject, { pos, parent }?)` | Create a prefab (path) or clone an object. Returns a Promise. |
| `Destroy(obj?, delay?)` | Destroy an object (default: this one), optionally after `delay` seconds. |
| `Translate(x, y, z)`, `Rotate(x, y, z)`, `LookAt(target)` | Move, turn (degrees) or face a point/object. |
| `Invoke(method, seconds)` | Call the named method once after a delay. |
| `InvokeRepeating(method, first, every)` | Call it after `first` seconds, then every `every` seconds. |
| `CancelInvoke(method?)`, `IsInvoking(method)` | Stop a pending call (all if no name); ask if one is pending. |
| `StartCoroutine(generator)` | Start a [coroutine](#coroutines); returns a handle for `StopCoroutine`. |
| `StopCoroutine(handle)`, `StopAllCoroutines()` | Stop one or all coroutines of this script. |
| `SendMessage(method, arg?)` | Call a method by name on every script of this object. |
| `print(...)` | Same as `Debug.Log`. |

### Messages
You write these; the engine calls them. Write only what you need.

| Message | When it is called |
|---|---|
| `Awake()` | When the object is created, before any `Start`. |
| `OnEnable()` / `OnDisable()` | When the object becomes active / inactive. |
| `Start()` | Once, before the first frame the script runs, after every `Awake`. |
| `FixedUpdate()` | At a fixed 60 times per second; use for physics. |
| `Update()` | Every frame. |
| `LateUpdate()` | Every frame, after all `Update` calls. |
| `OnDestroy()` | When the object is destroyed (coroutines and `Invoke`s are cancelled first). |
| `OnTriggerEnter(other)`, `OnTriggerStay(other)`, `OnTriggerExit(other)` | A trigger collider is entered / touched every frame / left. `other` is the other object. |
| `OnCollisionEnter(other)`, `OnCollisionStay(other)`, `OnCollisionExit(other)` | A solid collision starts / continues / ends. |
| `OnMouseEnter()`, `OnMouseExit()`, `OnMouseOver()`, `OnMouseDown()`, `OnMouseUp()`, `OnMouseDrag()`, `OnMouseUpAsButton()` | The pointer against the object's bounding box. Only checked when you define one. |

**Example** (not a file: a complete script):
```js
export default class Pickup extends MonoBehaviour {
  static attributes = SerializeField({ points: 10 });
  OnTriggerEnter(other) {
    if (!other.hasTag('Player')) return;
    GameManager.instance.AddScore(this.points);
    this.Destroy();
  }
}
```

## SerializeField and Inspector attributes
`static attributes = SerializeField({ ... })` declares the fields that appear in the Inspector. A plain value gives the type (number, string, bool, `'#rrggbb'` colour, array of 3 numbers = vector).

| Helper | Unity equivalent | Description |
|---|---|---|
| `SerializeField({ speed: 5 })` | `[SerializeField] float speed = 5` | Declares fields. |
| `Range(min, max, default)` | `[Range(0, 10)]` | A slider. |
| `Enum(['a', 'b'], 'a')` | `enum` field | A dropdown. |
| `EntityRef(name?)` | `GameObject` / `Transform` field | A slot for another object: drag one from the Hierarchy. `this.field` is the object. |
| `Header(text, field)` | `[Header]` | A bold heading above the field. |
| `Tooltip(text, field)` | `[Tooltip]` | Hover text. |
| `Space(px, field)` | `[Space]` | Extra space above the field. |
| `TextArea(field)` | `[TextArea]` | A multi-line text box. |
| `ReadOnly(field)` | `[ReadOnly]` | Shown, not editable. |
| `HideInInspector(field)` | `[HideInInspector]` | Not shown. |
| `Button(label, method)` | `[ContextMenu]` / editor button | A button that runs the script's **static** method in the editor. |

## Transform
`this.transform` (or `someObject.transform`). Position, rotation and scale of an object, and its place in the hierarchy.

### Properties
| Name | Type | Description |
|---|---|---|
| `position` | Vector3 | World position. |
| `localPosition` | Vector3 | Position relative to the parent. |
| `rotation`, `localRotation` | Quaternion | World / local rotation. |
| `eulerAngles`, `localEulerAngles` | Vector3 | Rotation in degrees. |
| `localScale` | Vector3 | Scale relative to the parent. |
| `lossyScale` | Vector3 | Scale including all parents (read-only). |
| `right`, `up`, `forward` | Vector3 | The object's own axes in world space (read-only). |
| `parent`, `root` | Transform | The parent / the top-most parent. |
| `childCount` | number | Number of children. |
| `gameObject`, `name`, `tag` | | The object, its name and first tag. |

### Methods
| Signature | Description |
|---|---|
| `Translate(x, y, z)` / `Translate(vector, space?)` | Move. `Space.Self` (default) moves along the object's axes, `Space.World` along the world axes. |
| `Rotate(x, y, z)` / `Rotate(vector)` | Add degrees to each axis. |
| `RotateAround(point, axis, angle)` | Orbit around a point. |
| `LookAt(target, worldUp?)` | Face a Transform, object or point. In 2D this turns around Z. |
| `TransformPoint(p)` / `InverseTransformPoint(p)` | Local to world / world to local position. |
| `TransformDirection(d)` / `InverseTransformDirection(d)` | The same for directions (no scale or position). |
| `GetChild(index)`, `Find("Child/Grandchild")` | A child by index / by path. |
| `IsChildOf(t)` | `true` if `t` is a parent or ancestor. |
| `GetSiblingIndex()`, `SetSiblingIndex(i)`, `SetAsFirstSibling()`, `SetAsLastSibling()` | Order among the parent's children. |
| `SetParent(p, worldPositionStays = true)` | Moves the object under `p` (a Transform, GameObject or `null` for the scene root). `DetachChildren()` makes all children roots. |

**Example** (not a file: rotate an arm, like the clock tutorial):
```js
Update() {
  this.arm.transform.localRotation = Quaternion.Euler(0, 0, -6 * Time.time); // 6 degrees per second
}
```

## Vector2 and Vector3
Two and three numbers. Create with `new Vector3(x, y, z)`. There are no operators, so use the methods below; they return a **new** vector.

| Static properties | Value |
|---|---|
| `Vector3.zero`, `one`, `up`, `down`, `left`, `right`, `forward`, `back` | The usual constants. `Vector2` has `zero`, `one`, `up`, `down`, `left`, `right`. |

| Instance | Description |
|---|---|
| `x`, `y`, `z` | The components. |
| `magnitude`, `sqrMagnitude` | Length, and length squared (faster to compare). |
| `normalized` | A copy with length 1. |
| `Add(v)`, `Sub(v)`, `Mul(k)`, `Div(k)`, `Scale(v)` | `+`, `-`, multiply by a number, divide, per-component multiply. |
| `Normalize()` | Make this vector length 1 (changes it). |
| `Set(x, y, z)`, `Clone()`, `Equals(v)`, `toArray()` | Set components, copy, compare, `[x, y, z]`. |

| Static | Description |
|---|---|
| `Distance(a, b)`, `Dot(a, b)`, `Cross(a, b)` | Distance, dot product, cross product (`Cross` is Vector3 only). |
| `Angle(a, b)`, `SignedAngle(a, b)` | Angle in degrees (`SignedAngle` is Vector2 only). |
| `Lerp(a, b, t)`, `LerpUnclamped(a, b, t)` | Blend; `Lerp` clamps `t` to 0..1. |
| `MoveTowards(a, b, maxDelta)` | Step towards `b` without overshooting. |
| `ClampMagnitude(v, max)`, `Project(v, normal)`, `Reflect(dir, normal)` | As in Unity (`Project` is Vector3 only). |
| `Min(a, b)`, `Max(a, b)`, `Scale(a, b)` | Per component. |
| `From([x, y, z])` | Make a vector from an array. |

**Example** (not a file: move towards a target at a fixed speed):
```js
Update() {
  const p = this.transform.position, t = this.target.transform.position;
  this.transform.position = Vector3.MoveTowards(p, t, 3 * Time.deltaTime);
}
```

## Quaternion
A rotation without gimbal lock. Components `x, y, z, w`.

| Member | Description |
|---|---|
| `Quaternion.identity` | No rotation. |
| `Quaternion.Euler(x, y, z)` | From degrees (also accepts a Vector3). |
| `Quaternion.AngleAxis(angle, axis)` | Rotate `angle` degrees around `axis`. |
| `Quaternion.LookRotation(forward, up?)` | Look along `forward`. |
| `Quaternion.FromToRotation(from, to)` | The rotation that turns one direction into another. |
| `Quaternion.Lerp(a, b, t)`, `Slerp(a, b, t)` | Blend two rotations. |
| `Quaternion.RotateTowards(from, to, maxDegrees)` | Turn by at most `maxDegrees`. |
| `Quaternion.Angle(a, b)`, `Dot(a, b)`, `Inverse(q)` | Angle between, dot product, inverse. |
| `q.Multiply(q2 or vector)` | Combine rotations, or rotate a vector. |
| `q.eulerAngles` | The rotation as degrees (Vector3). |

## Mathf
Static maths. Constants: `PI`, `Infinity`, `NegativeInfinity`, `Epsilon`, `Deg2Rad`, `Rad2Deg`.

| Group | Members |
|---|---|
| Basics | `Abs`, `Min`, `Max`, `Sign`, `Sqrt`, `Pow`, `Exp`, `Log`, `Log10`, `Log2`, `Truncate` |
| Rounding | `Floor`, `Ceil`, `Round`, `FloorToInt`, `CeilToInt`, `RoundToInt` |
| Trigonometry | `Sin`, `Cos`, `Tan`, `Asin`, `Acos`, `Atan`, `Atan2`, `Sinh`, `Cosh`, `Tanh` |
| Limits | `Clamp(v, min, max)`, `Clamp01(v)`, `Repeat(t, length)`, `PingPong(t, length)` |
| Blending | `Lerp`, `LerpUnclamped`, `InverseLerp`, `SmoothStep`, `MoveTowards`, `SmoothDamp` |
| Angles | `DeltaAngle`, `LerpAngle`, `MoveTowardsAngle` |
| Misc | `Approximately(a, b)`, `PerlinNoise(x, y)` (0..1), `NextPowerOfTwo`, `ClosestPowerOfTwo`, `IsPowerOfTwo` |

`Mathf.SmoothDamp(current, target, velocity, smoothTime, maxSpeed?, dt?)` returns `{ value, velocity }` instead of using a `ref` parameter.

## Time
| Property | Description |
|---|---|
| `Time.deltaTime` | Seconds since the last frame (scaled by `timeScale`). |
| `Time.unscaledDeltaTime`, `Time.smoothDeltaTime` | Not scaled; smoothed. |
| `Time.fixedDeltaTime` | Always `1/60`. |
| `Time.time`, `Time.fixedTime` | Seconds since the game started. |
| `Time.realtimeSinceStartup`, `Time.unscaledTime` | Real clock seconds, ignoring pause and scale. |
| `Time.timeScale` | Game speed: `1` normal, `0.5` slow motion, `0` frozen (read / write). |
| `Time.frameCount` | Frames since start. |

## Input
`UnityInput` (import it `as Input`): keyboard, mouse and project actions. Key names are the strings in `KeyCode`.

| Member | Description |
|---|---|
| `GetKey(code)`, `GetKeyDown(code)`, `GetKeyUp(code)` | Held, pressed this frame, released this frame. |
| `GetButton(action)`, `GetButtonDown(action)`, `GetButtonUp(action)` | The same for a named action from the Input Manager (@ui[Window ▸ Panels ▸ Project] ▸ Input Manager). |
| `GetAxis('Horizontal' / 'Vertical' / name)`, `GetAxisRaw(name)` | `-1..1`. A custom `name` uses the actions `nameNegative` and `namePositive`. |
| `GetMouseButton(n)`, `GetMouseButtonDown(n)`, `GetMouseButtonUp(n)` | Mouse button `0` left, `1` right, `2` middle. |
| `mousePosition` | Pointer position as a `Vector2`. |
| `anyKey`, `anyKeyDown` | Any key held / pressed this frame. |

`KeyCode` has `Space`, `Return`, `Escape`, `Tab`, `Backspace`, `Delete`, `LeftShift`, `RightShift`, `LeftControl`, `RightControl`, `LeftAlt`, `RightAlt`, the four arrows (`UpArrow`…), `A`–`Z`, `Alpha0`–`Alpha9`, `Keypad0`–`Keypad9`, `F1`–`F12`, `Mouse0`–`Mouse2`.

**Example** (not a file: jump on the button, move on the axis):
```js
Update() {
  this.Translate(Input.GetAxis('Horizontal') * 5 * Time.deltaTime, 0, 0);
  if (Input.GetButtonDown('jump')) this.SetVelocity(this.velocity.x, 8);
}
```

## Coroutines
A coroutine is a generator method that can wait. Start it with `StartCoroutine`.

| Yield | Waits |
|---|---|
| `yield new WaitForSeconds(s)` | `s` seconds of game time. |
| `yield new WaitForSecondsRealtime(s)` | Seconds of game time (same as above in the web runtime). |
| `yield new WaitUntil(() => cond)` | Until the function returns `true`. |
| `yield new WaitWhile(() => cond)` | While the function returns `true`. |
| `yield new WaitForFixedUpdate()`, `yield new WaitForEndOfFrame()` | One step. |
| `yield null` | One frame. |
| `yield this.OtherCoroutine()` | Until the nested coroutine finishes. |

**Example** (not a file: fade out, then destroy):
```js
Start() { this.StartCoroutine(this.Die()); }
*Die() {
  yield new WaitForSeconds(2);
  this.Destroy();
}
```

## Physics2D and Physics
Queries run against the colliders in the scene. Hits are objects `{ collider, transform, rigidbody, gameObject, point, normal, distance, fraction }`; a miss has `collider: null`.

| Physics2D | Description |
|---|---|
| `Raycast(origin, direction, distance?, layerMask?)`, `RaycastAll`, `RaycastNonAlloc` | First hit / all hits / fill an array (Vector2). Exact for box, circle, capsule, polygon, edge and composite colliders. |
| `Linecast(a, b)` | Hit on the line between two points. |
| `CircleCast`, `BoxCast`, `CapsuleCast` (+ `All`, `NonAlloc`) | A shape swept along a direction. |
| `OverlapPoint(p)`, `OverlapCircle(c, r)`, `OverlapBox(c, size, angle)`, `OverlapArea(a, b)`, `OverlapCapsule(...)` | The first object found (or `null`); `…All` gives an array, `…NonAlloc` fills one. |
| `OverlapCollider`, `Distance(a, b)`, `ClosestPoint`, `IsTouching`, `IgnoreCollision`, `IgnoreLayerCollision` | See [Physics 2D](ex-unity-api-physics2d.html). |
| `gravity` | World gravity as a Vector2 (read / write). |
| `queriesHitTriggers` | Whether queries also hit trigger colliders (default `true`). |

| Physics (3D) | Description |
|---|---|
| `Raycast(origin, direction, maxDistance?)`, `Linecast(a, b)` | One ray / line test (Vector3). |
| `OverlapSphere(center, radius)` | Objects inside a sphere. |
| `gravity` | World gravity as a Vector3 (read / write). |

## Components
`GetComponent('SpriteRenderer')` and the other Unity names return a wrapper with Unity's property names. Each wrapper also has `gameObject`, `transform`, `tag`, `CompareTag(tag)` and `GetComponent(type)`.

| Class | Main members |
|---|---|
| `Rigidbody2D`, `Rigidbody` | `velocity`, `angularVelocity`, `bodyType`, `isKinematic`, `mass`, `drag` / `linearDamping`, `gravityScale`, `freezeRotation`, `simulated`, `AddForce(force, ForceMode2D.Impulse)`, `AddTorque`, `MovePosition(target)`, `MoveRotation(angle)` |
| `BoxCollider2D`, `CircleCollider2D`, `BoxCollider`, `SphereCollider` | `isTrigger`, `size`, `radius`, `offset` |
| `SpriteRenderer` | `sprite` (texture path), `color`, `flipX`, `flipY`, `enabled`, `sortingOrder`, `size` |
| `Animator` | `SetFloat`, `SetInteger`, `SetBool`, `SetTrigger`, `ResetTrigger`, `GetFloat`, `GetInteger`, `GetBool`, `Play(state)`, `currentState`, `speed` |
| `AudioSource` | `clip`, `volume`, `loop`, `Play()`, `Stop()`, `isPlaying` |
| `Camera` | `Camera.main`, `orthographicSize`, `zoom`, `fieldOfView`, `aspect`, `backgroundColor`, `ScreenToWorldPoint(p)` and `WorldToScreenPoint(p)` (2D) |
| `Light` | `intensity`, `color`, `shadows`, `type`, `enabled` |
| `ParticleSystem` | `Play()`, `Stop()`, `isPlaying` |
| `TextMesh` | `text`, `color`, `fontSize` |
| `MeshRenderer`, `Material` | `material`, `enabled`; material `color`, `metallic`, `roughness`, `SetColor(name, c)`, `SetFloat(name, v)` |

`ForceMode2D` has `Force` and `Impulse`; `ForceMode` also has `Acceleration` and `VelocityChange`.

## Object lifetime
Free functions you can also call without `this.`:

| Function | Description |
|---|---|
| `Instantiate(pathOrObject, { pos })` | Create a prefab or clone an object (Promise). |
| `Destroy(obj, delay?)` | Destroy an object or the object of a script. |
| `DontDestroyOnLoad(obj)` | Keep the object when another scene loads. |
| `GameObject.Find(name)`, `FindWithTag(tag)`, `FindGameObjectsWithTag(tag)` | Look objects up from anywhere. |
| `UnityObject.FindObjectOfType(Class)`, `FindObjectsOfType(Class)` | Look scripts up from anywhere. (Named `UnityObject` so it does not hide JavaScript's `Object`.) |

## Application, SceneManager, PlayerPrefs
| Class | Members |
|---|---|
| `SceneManager` | `LoadScene(path)`, `ReloadScene()`, `sceneName`, plus `LoadSceneAsync`, `GetActiveScene()` |
| `Application` | `platform` (`'OSXEditor'`, `'WebGLPlayer'`…), `isEditor`, `isPlaying`, `isMobilePlatform`, `isDesktopApp`, `isWebPlayer`, `os`, `Quit()`, `targetFrameRate`, `persistentDataPath`, `OpenURL(url)` |
| `PlayerPrefs` | `GetInt/GetFloat/GetString(key, default)`, `SetInt/SetFloat/SetString(key, value)`, `HasKey(key)`, `DeleteAll()` |
| `Screen` | `width`, `height` |
| `Cursor` | `lockState = CursorLockMode.Locked`, `visible` |
| `Resources` | `Load(path)` returns a Promise of a JSON/text file; `LoadAsync`, `UnloadUnusedAssets()` |
| `JsonUtility` | `ToJson(obj, pretty?)`, `FromJson(json, Class?)`, `FromJsonOverwrite(json, obj)` |
| `LayerMask` | `GetMask(...layers)`, `NameToLayer`, `LayerToName` |
| `Debug` | `Log`, `LogWarning`, `LogError`, `LogFormat`, `Assert`, `DrawLine`, `DrawRay` (2D), `Break` |
| `Random` | `Range(a, b)`, `value`, `insideUnitCircle`, `onUnitSphere`, `insideUnitSphere`, `Pick(array)`, `InitState(seed)` |
| `Color` | `new Color(r, g, b, a)` (0..1), `Color.red/green/blue/white/black/yellow/cyan/magenta/gray/clear`, `Color.Lerp`, `Color.FromHex('#rrggbb')`, `toHex()` |

## Ready-made services
Scripts you attach once; reach them from anywhere with `.instance`.

| Class | Description |
|---|---|
| `Singleton` | Base class: `class Score extends Singleton {}` then `Score.instance`. A second copy destroys itself; `static persistent = true` keeps it across scenes; `Score.require()` throws a clear error when missing. |
| `GameManager` | `score`, `lives`, `state`; `AddScore(n)`, `SetLives(n)`, `LoseLife()`, `SetState(s)`, `GameOver()`, `Pause()`, `Resume()`, `TogglePause()`, `LoadScene(path)`, `Restart()`, `SaveHighScore()`, `Get(key)` / `Set(key, v)`. Events: `score`, `lives`, `state`, `gameover`. |
| `AudioManager` | `PlaySfx(path)`, `PlayMusic(path)`, `StopMusic()`, `SetVolume(bus, v)`, `Mute(bus, on)`. |
| `UnityEvent` | `AddListener(fn)` (returns an unsubscribe function), `RemoveListener(fn)`, `RemoveAllListeners()`, `Invoke(...args)`, `listenerCount`. |
| `EventBus` | `Subscribe(name, fn)`, `Publish(name, data)`: global messages. |
| `ScriptableObject` | `await ScriptableObject.Load('data/sword.asset.json')`: a shared JSON data file. |
| `ObjectPool` | `new ObjectPool(scene, prefabPath)`: `Warm(n)`, `Get({ pos })`, `Release(obj)`, `countInactive`. |

**Check yourself:** open a script of yours and find every Unity name it uses on this page. If a name is *not* here, it is not part of the Unity layer: look it up in [NordScript](api-nordscript.html) or the [full export list](api-exports.html).

**Next:** [Examples](examples.html) shows these classes inside complete scripts.


## Check yourself

Confirm the result in your saved project. Check Console errors and compare exact names with the linked reference if the result differs.

Next: [Unity scripting cheatsheet](cheat-sheet-unity.html). Back to: [Cheatsheets](cookbook.html).

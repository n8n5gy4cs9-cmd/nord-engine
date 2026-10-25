---
title: 42 · Unity helpers cookbook
section: Examples
order: 42
summary: Random, Color, KeyCode, mouse events, free Instantiate/Destroy, field helpers and SmoothDamp: the Unity habits that now work as-is.
---

**Goal:** know which everyday Unity calls exist in Nord, with the C# next to the JavaScript. All of them come from `import { … } from 'nord'`.

## Random and Color
```cs
int die = Random.Range(1, 7);          float f = Random.Range(0.5f, 1.5f);
Vector2 p = Random.insideUnitCircle;   sprite.color = Color.red;
```
```js
import { MonoBehaviour, Random, Color } from 'nord';
export default class Dice extends MonoBehaviour {
  Start() {
    const die = Random.Range(1, 7);          // two integers: int in [1, 7) like C#
    const f = Random.Range(0.5, 1.5);        // floats: float in [0.5, 1.5]
    const p = Random.insideUnitCircle;       // Vector2
    this.GetComponent('sprite').set('tint', Color.Lerp(Color.red, Color.blue, 0.5).toHex());
  }
}
```
@bad[Trap:] `Random.Range(0, 1)` is two integers in JavaScript, so it returns `0`. For a 0..1 float use `Random.value`.

## Keys, buttons and axes
```js
import { MonoBehaviour, UnityInput as Input, KeyCode, Time } from 'nord';
export default class Mover extends MonoBehaviour {
  speed = 5;
  Update() {
    if (Input.GetKeyDown(KeyCode.Space)) this.Translate(0, 1, 0);   // a hop (write your own Jump() method for more)
    if (Input.GetKey(KeyCode.LeftShift)) this.speed = 8;
    const x = Input.GetAxisRaw('Horizontal');
    this.Translate(x * this.speed * Time.deltaTime);
    if (Input.anyKeyDown) this.log('something pressed');
  }
}
```
Use `GetButton('jump')` for the names in your [Input editor](ex-input-editor.html) and `GetKey(KeyCode.X)` for fixed keys.

## Mouse events on an object
```js
export default class Clickable extends MonoBehaviour {
  OnMouseEnter() { this.localScale = new Vector3(1.1, 1.1, 1); }
  OnMouseExit()  { this.localScale = Vector3.one; }
  OnMouseDown()  { Debug.Log('clicked ' + this.name); }
}
```
The pointer is tested against the object's box. Also `OnMouseUp`, `OnMouseOver`, `OnMouseDrag`, `OnMouseUpAsButton`.

## Create and destroy without `this`
```js
import { Instantiate, Destroy, GameObject, UnityObject, DontDestroyOnLoad } from 'nord';
const bullet = await Instantiate('prefabs/bullet.prefab.json', { pos: [0, 0, 0] });
Destroy(bullet, 2);                         // after 2 s
const player = GameObject.Find('Player');
const hud = UnityObject.FindObjectOfType(HudScript);
DontDestroyOnLoad(player);
```

## Inspector field helpers
```js
import { SerializeField, Range, Enum, EntityRef } from 'nord';
static attributes = SerializeField({
  speed: Range(0, 10, 5),                   // [Range(0,10)] slider
  mode: Enum(['idle', 'chase'], 'idle'),    // enum dropdown
  target: EntityRef(),                      // an object name: this.Find(this.target)
});
```

## Smooth camera follow
```js
import { MonoBehaviour, Mathf, GameObject } from 'nord';
export default class Follow extends MonoBehaviour {
  Start() { this.t = GameObject.Find('Player'); this.vx = 0; }
  LateUpdate() {
    const r = Mathf.SmoothDamp(this.position.x, this.t.pos[0], this.vx, 0.25);
    this.vx = r.velocity; this.position = this.position.Set(r.value, this.position.y, this.position.z);
  }
}
```
(`SmoothDamp` has no `ref` in JavaScript: it returns `{ value, velocity }`.)

## Vectors without operators
| C# | Nord |
|---|---|
| `a + b`, `a - b`, `a * 2f` | `a.Add(b)`, `a.Sub(b)`, `a.Mul(2)` |
| `Vector3.Scale(a, b)` | `Vector3.Scale(a, b)` |
| `Vector3.ClampMagnitude(v, 5)` | `Vector3.ClampMagnitude(v, 5)` |
| `Vector2.Perpendicular(v)` | same |
| `Quaternion.Euler(0,0,90)` | none: rotations are Euler degrees, `this.eulerAngles = new Vector3(0, 0, 90)` |

Next: [the Input editor](ex-input-editor.html), [a whole game: Vector Rocks](ex-vector-rocks.html). Reference: [Unity-style scripting](unity-scripting.html).

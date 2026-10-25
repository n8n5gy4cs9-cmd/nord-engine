---
title: Unity scripting cheatsheet
section: Guides
order: 1
summary: Copy a minimal MonoBehaviour, then look up lifecycle, movement, input, objects and saving.
---
Use this page beside the Code tab. For the full explanations, read [Unity-style scripting](unity-scripting.html); for signatures, read [Unity API](api-unity.html).

::: dummies
A cheatsheet is a reminder, not a complete game. The file below is complete. The table contains individual calls for use inside your own methods. JavaScript is case-sensitive: `Update` and `update` are different names.
:::

## Create and attach a script
1. In @ui[Assets], right-click the scripts folder and choose @ui[New MonoBehaviour script (Unity-style)]. Name it `Mover`.
2. Replace the opened file with the complete file below.
3. Select a visible object in @ui[Hierarchy], then use @ui[Inspector ▸ + Add script] to attach it. Set `speed` in the script's Inspector fields.
4. Press @ui[Play]. The object moves to the right. Stop Play to edit its starting position.

**File: `scripts/Mover.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, Time } from 'nord';

export default class Mover extends MonoBehaviour {
  static attributes = SerializeField({ speed: 100 });

  Update() {
    this.Translate(this.speed * Time.deltaTime, 0, 0);
  }
}
```

**In the file** `scenes/main.scene.json` (check the selected object's `scripts` array; preserve its other components and scripts):
```json
{ "path": "scripts/Mover.js", "attributes": { "speed": 100 } }
```

## Lifecycle

| Name | When to use it | Value or unit |
|---|---|---|
| `Awake()` | Initialize this script | Once per instance |
| `Start()` | Find other objects after construction | Once before updates |
| `Update()` | Read input and update gameplay | Once per frame |
| `FixedUpdate()` | Fixed-step work | Fixed update interval |
| `OnDestroy()` | Release resources and subscriptions | On destruction |
| `Time.deltaTime` | Convert a speed to a frame displacement | Seconds |

## Calls to remember

These calls belong inside methods of a `MonoBehaviour`. Import the named helpers from `nord` as needed.

| Task | Call | Check |
|---|---|---|
| Move an object | `this.Translate(dx, dy, dz)` | 2D uses pixels; 3D uses world units |
| Read Unity input | `Input.GetAxis('Horizontal')` | Import `UnityInput as Input`; configure the axis in the Project tab |
| Find an object | `this.Find('Player')` | Check the result before using it |
| Read a component | `this.GetComponent('Rigidbody2D')` | The required component must be present |
| Create a prefab | `await this.Instantiate('prefabs/coin.prefab.json', { pos: [0, 0, 0] })` | Call from an `async` method |
| Destroy this object | `this.Destroy()` | Do not keep using its components afterward |
| Print a value | `Debug.Log(this.name)` | Import `Debug`; inspect Console |
| Save a number | `PlayerPrefs.SetInt('best', score)` | Import `PlayerPrefs`; give your key a stable name |
| Read a number | `PlayerPrefs.GetInt('best', 0)` | `0` is the fallback |

> **Trap:** Instantiate returns a Promise in Nord. Unity's synchronous C# example cannot be copied line for line. Vector operators also become explicit method calls in JavaScript. See the API reference's differences table.

## Check yourself
- `Mover.js` imports the real Nord exports and uses capitalized `Update()`.
- In a 2D project with the object on screen, it travels about 100 pixels per second at the default speed.
- If it does not move, check attachment, enabled state and the Console's first error.

Next: [Unity API map and recipes](ex-unity-api.html). Back to: [Cheatsheets](cookbook.html).

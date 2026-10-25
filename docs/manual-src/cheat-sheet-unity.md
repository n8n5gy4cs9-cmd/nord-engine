---
title: Unity scripting cheatsheet
section: Guides
group: Unity scripting and gameplay
order: 10
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

## Choose the lifecycle hook

| Hook | Use for | Avoid |
|---|---|---|
| Awake | Initialize this instance's own state | Assuming another object's Start has already run |
| Start | Initial lookup and scene setup | Adding the same listener every frame |
| Update | Read frame input; render-frame gameplay | Treating a one-frame press as a held key |
| FixedUpdate | Controller work tied to the fixed scene step | Fighting the physics body with another transform controller |
| LateUpdate | Follow-up work after normal updates | Using it to hide an unexplained ordering bug |
| OnEnable / OnDisable | Lifetime of enabled-only work | Disabling an object and expecting its own Update to wake it |
| OnDestroy | Remove UI and release external subscriptions | Keeping callbacks attached to a destroyed scene object |

## Import and field decisions

| Need | Import / pattern | Check |
|---|---|---|
| Editable number | SerializeField; read `this.speed` | The object's saved override may differ from the code default |
| Bounded number | Range | Helper arguments are min, max, default |
| Dropdown | Enum | Options and stored selection agree |
| Object slot | EntityRef | Assign the target in Inspector; handle an empty slot |
| Key input | UnityInput as Input, KeyCode | Native Input has a different contract |
| Vector math | Vector2 / Vector3 | Use Add/Sub/Mul, not JavaScript operators |
| Scene transition | SceneManager | Async scene change replaces scene-local objects |
| Global manager | Your Singleton / GameManager / AudioManager subclass | One attached instance must exist; importing does not create it |

## JavaScript differences worth remembering

- Use `===` for strict comparisons and guard absent objects before accessing components.
- `await this.Instantiate(...)` belongs in an async method. Handle load failures instead of using an unresolved Promise like an entity.
- Use a generator method (`*Sequence()`) for coroutines and capitalized lifecycle names for MonoBehaviour.
- A C# comparison block is orientation, not JavaScript you can paste into a script.
- The implementation is a documented Unity-style subset. Check coverage before planning around an unfamiliar Unity package.

## More complete lookup sheets
[Objects and events](cheat-sheet-objects.html) · [Input and physics](cheat-sheet-input-physics.html) · [Maths and timing](cheat-sheet-maths-time.html) · [UI, audio and saves](cheat-sheet-presentation.html).

## Check yourself
- `Mover.js` imports the real Nord exports and uses capitalized `Update()`.
- In a 2D project with the object on screen, it travels about 100 pixels per second at the default speed.
- If it does not move, check attachment, enabled state and the Console's first error.

Next: [Unity API map and recipes](ex-unity-api.html). Back to: [Cheatsheets](cookbook.html).

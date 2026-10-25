---
title: Programming basics — your first MonoBehaviour
section: Start here
order: 2
summary: Learn variables, methods, lifecycle, fields and elapsed time through one complete Unity-style movement script.
---
You will attach one script to a visible object and make it drift to the right. This is JavaScript using Nord's Unity-style API. It is a small enough example to read from top to bottom.

::: dummies
A script is an instruction card. `Start()` means “when this object begins,” and `Update()` means “each frame.” The engine calls these methods for you. You write the instructions inside them.
:::

## Before you start
Open a **2D** project with a visible object. Press Play once to confirm it works, then Stop. Keep the Console visible so you can see errors. No physics components are required for this movement example.

## Create the complete script
1. In @ui[Assets], right-click the scripts folder and select @ui[New MonoBehaviour script (Unity-style)]. Name the file `Drift` and open it in @ui[Code].
2. Replace its contents with the complete file below. Save the file.
3. Select the visible object in @ui[Hierarchy]. In @ui[Inspector], press @ui[+ Add script] and select `scripts/Drift.js`. A `speed` field appears.

**File: `scripts/Drift.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, Time, Debug } from 'nord';

export default class Drift extends MonoBehaviour {
  static attributes = SerializeField({ speed: 40 });

  Start() {
    Debug.Log('Drift is ready');
  }

  Update() {
    const distance = this.speed * Time.deltaTime;
    this.Translate(distance, 0, 0);
  }
}
```

Press @ui[Play]. The Console shows `Drift is ready`, and the object moves right at about 40 pixels per second. Stop, set `speed` to `-40` in the Inspector, and Play again. It now moves left.

**In the file** `scenes/main.scene.json` (or your selected scene), the entity's `scripts` array contains this entry alongside any existing scripts:
```json
{ "path": "scripts/Drift.js", "attributes": { "speed": 40 } }
```

The JSON shows the starting value. If you saved `-40` in the Inspector, its stored attribute will be `-40` instead.

## Read the file one piece at a time

| Code | Meaning | Change it when |
|---|---|---|
| `import { ... } from 'nord'` | Bring named helpers into this file | You need another documented helper |
| `class Drift extends MonoBehaviour` | Define one kind of attached behavior | You create a different behavior |
| `SerializeField({ speed: 40 })` | Declare an editable number with a default | You want an Inspector setting |
| `this.speed` | Read this object's saved field value | You use that setting in a method |
| `Start()` | Run setup once | You need to find another object or initialize state |
| `Update()` | Run frame work repeatedly | You need ongoing movement or input |
| `const distance = ...` | Calculate a local value for this call | A readable intermediate value helps |
| `Time.deltaTime` | Elapsed frame time in seconds | You convert units per second into units this frame |
| `this.Translate(x, y, z)` | Move by the supplied displacement | You want direct transform movement |

`this` means the current script instance. Attach Drift to two objects and each has its own `speed`. A **property** is a stored or calculated value such as `this.speed`; a **method** is an operation called with parentheses, such as `this.Translate(...)`.

## Numbers, text and decisions
A number such as `40` can be multiplied. Text such as `'Drift is ready'` has quotes. `true` and `false` are Boolean values used for decisions. JavaScript arrays such as `[20, 30, 0]` keep ordered values; Nord positions use x, y, z order.

You can add branches and loops later. First understand the small path already here: read a setting, calculate a distance, move the object, repeat next frame.

> **Trap:** capitalization matters. `Update()` is the MonoBehaviour callback. `update()` belongs to the original NordScript API. Also, 2D y points down; 3D y points up. This example uses only x.

## Try a tiny challenge
Set speed to `0`, predict the result, and Play. Then give two objects the same Drift file with opposite speeds. They should travel apart while sharing one file. Your object parade now has a very small traffic problem.

## Check yourself
- The log appears once per script instance when Play starts.
- Positive speed moves right, negative speed moves left, and zero stops movement.
- You can explain why multiplying by elapsed seconds makes a speed independent of frame rate.

Next: [Input and movement](ex-input-movement.html). Back to: [Getting started](getting-started.html).

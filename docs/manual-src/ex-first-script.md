---
title: 1 · Your first script
section: Examples
order: 1
summary: A script with Awake/Start/Update, Inspector fields and logging: Unity C# next to Nord JavaScript.
---

**Goal:** an object that spins and logs a message when the game starts, with a speed you can change in the Inspector.

## Unity (C#)
```cs
using UnityEngine;

public class Spin : MonoBehaviour
{
    [SerializeField] float speed = 90f;

    void Start() { Debug.Log("Spin ready"); }
    void Update() { transform.Rotate(0, 0, speed * Time.deltaTime); }
}
```

## Before you write the file
Create a visible sprite using the editor's Create controls, then create a MonoBehaviour script in Assets. Select the sprite in Hierarchy and attach the script with Inspector's + Add script. After replacing the file below and saving, Play should print one message and rotate the sprite.

## Nord: the Unity style
**File: `scripts/spin.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, Time, Debug } from 'nord';

export default class Spin extends MonoBehaviour {
  static attributes = SerializeField({ speed: 90 }); // the [SerializeField]: shows in the Inspector

  Start() { Debug.Log('Spin ready'); }
  Update() { this.Rotate(0, 0, this.speed * Time.deltaTime); }
}
```

The recommended beginner path uses the Unity-style file above. The original lower-case version is retained at the end for readers maintaining older projects.

## 2D or 3D? Which axis spins
`Rotate(x, y, z)` adds degrees to each axis. In a **2D** project the object spins around **Z** (what you see on screen). In a **3D** project Z is "roll"; to turn a cube like a turntable use **Y**: `this.Rotate(0, this.speed * Time.deltaTime, 0)`. The script above is otherwise identical in 2D and 3D, and it needs no input actions or physics.

## Try it
1. Make a sprite object (@ui[Hierarchy ▸ + Create ▸ Sprite]) and give it a texture.
2. @ui[Assets ▸ right-click `scripts` ▸ New MonoBehaviour script], name it `spin`, paste the code.
3. Select the sprite, @ui[Inspector ▸ + Add script ▸ spin]. The **speed** field appears. Press @ui[Play] and change it while playing (it is a copy for this run; stopping resets it).

## The lifecycle in order
| Unity | Nord MonoBehaviour | Nord native | When |
|---|---|---|---|
| `Awake` | `Awake()` | `init()` | the object is created |
| `OnEnable` | `OnEnable()` | `onEnable()` | active (also after SetActive(true)) |
| `Start` | `Start()` | `start()` | once, before the first frame, after every Awake |
| `FixedUpdate` | `FixedUpdate()` | `fixedUpdate(dt)` | 60 times per second (physics) |
| `Update` | `Update()` | `update(dt)` | every frame |
| `LateUpdate` | `LateUpdate()` | `lateUpdate(dt)` | after all Updates |
| `OnDisable` / `OnDestroy` | same | `onDisable()` / `onDestroy()` | switched off / removed |

## Inspector fields (attributes)

**File: `scripts/spin.js`** (the `static attributes` block goes inside the class, above `Start()`)
```js
static attributes = {
  speed:   { type: 'number', default: 5, min: 0, max: 20 },   // slider
  name:    { type: 'string', default: 'Bob' },
  alive:   { type: 'bool',   default: true },
  tint:    { type: 'color',  default: '#ff8800' },
  offset:  { type: 'vec3',   default: [0, 1, 0] },
  mode:    { type: 'enum',   options: ['walk', 'run'], default: 'walk' },
  target:  { type: 'entity' },                                 // name or id of another object
  sound:   { type: 'asset',  assetType: 'audio' },             // pick a file
};
```
Types: `number int bool string color vec2 vec3 enum entity asset curve array`. Read them as `this.attrs.speed` (native) or `this.speed` (MonoBehaviour with `SerializeField`). Wrong types fall back to the default with a warning in the Console.

::: tip
Unity runs `Awake` of *all* objects before any `Start`; Nord too. Put "set up my own data" in `Awake/init` and "find other objects" in `Start/start`.
:::


<details>
<summary>Old · the same behavior using native NordScript</summary>

## Nord: the native style (lower-case)

**File: `scripts/spin.js`** (new file, the whole file; the same script written in the native style)
```js
import { NordScript } from 'nord';

export default class Spin extends NordScript {
  static attributes = { speed: { type: 'number', default: 90, min: 0, max: 720, label: 'Degrees per second' } };

  start() { this.log('Spin ready'); }          // shows as [Spin] Spin ready in the Console
  update(dt) {                                 // dt = seconds since the last frame
    const r = this.entity.rot;                 // [x, y, z] degrees
    this.entity.rot = [r[0], r[1], r[2] + this.attrs.speed * dt];
  }
}
```
Pick **one style per script**; do not mix `Update` and `update` in the same class. Both styles can be used in the same project.



</details>

## Check yourself
The Console prints Spin ready once per instance at the start. The sprite rotates about Z; for a 3D turntable use Y as described above. Stop Play before saving a different starting transform.

Next: [Input and movement](ex-input-movement.html). Back to: [Examples](examples.html).

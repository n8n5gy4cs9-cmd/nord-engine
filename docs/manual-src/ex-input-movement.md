---
title: 2 · Input and movement
section: Examples
order: 2
summary: Complete Unity-style scripts for 2D transform movement, 2D physics movement and 3D ground-plane movement.
---
Make one object respond to input, then choose who owns its motion: its transform or a physics body. Use **one** movement script on the object at a time.

::: dummies
Input is a direction request. Movement turns that request into a change in position or velocity. In 2D, up means negative y. In this 3D example, up on the controls means negative z. A speed of 200 pixels per second is sensible in 2D; 200 world units per second is usually far too fast in 3D.
:::

## Before you start
Open a saved project with a visible object. Press Play once, confirm the object appears, then Stop. In @ui[Assets], create a @ui[New MonoBehaviour script (Unity-style)]. Use @ui[Inspector ▸ + Add script] on the selected object to attach the file you choose below.

The code uses `UnityInput as Input`, imported from `nord`. `Horizontal` and `Vertical` are Unity-style axes; named buttons such as `jump` use the project's action mapping. In the @ui[Project] tab, open **Input Manager (actions and keys)** to inspect or rebind the actions. [Input editor](ex-input-editor.html) explains the controls.

**In the file** `nord.project.json` (the `input` property's value, not the whole manifest), a basic action map is:
```json
{
  "actions": {
    "left": ["KeyA", "ArrowLeft"],
    "right": ["KeyD", "ArrowRight"],
    "up": ["KeyW", "ArrowUp"],
    "down": ["KeyS", "ArrowDown"],
    "jump": ["Space", "Gamepad0"],
    "fire": ["Mouse0"]
  }
}
```
Preserve additional actions or axis settings already used by your project. Focus the running Game view before testing keyboard input.

## 1. Move a 2D object by its transform
Use a **2D project** and an object with a visible sprite or text. This version deliberately does not simulate a body against walls.

**File: `scripts/Walker2D.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, UnityInput as Input, Time, Vector2 } from 'nord';

export default class Walker2D extends MonoBehaviour {
  static attributes = SerializeField({ speed: 200 });

  Update() {
    let direction = new Vector2(Input.GetAxis('Horizontal'), -Input.GetAxis('Vertical'));
    if (direction.sqrMagnitude > 1) direction = direction.normalized;
    const distance = this.speed * Time.deltaTime;
    this.Translate(direction.x * distance, direction.y * distance, 0);
  }
}
```
Save and Play. Horizontal input moves left/right; W or Up moves upward on the screen. Diagonal input is limited so it does not move faster than a full-speed cardinal direction.

## 2. Move a 2D physics body
Use a **2D project**. In @ui[Inspector ▸ + Add component], add the required rigidbody and collider, configure the moving body as dynamic, and make a static obstacle with a solid collider. Remove Walker2D before attaching this version. Keep gravity for a platformer; use an appropriate no-gravity setup for top-down movement.

**File: `scripts/BodyWalker2D.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, UnityInput as Input, Rigidbody2D, Vector2, Debug } from 'nord';

export default class BodyWalker2D extends MonoBehaviour {
  static attributes = SerializeField({ speed: 200, jumpSpeed: 420 });

  Start() {
    this.body = this.GetComponent(Rigidbody2D);
    this.jumpRequested = false;
    if (!this.body) Debug.LogError('BodyWalker2D needs a Rigidbody2D');
  }

  Update() {
    if (Input.GetButtonDown('jump')) this.jumpRequested = true;
  }

  FixedUpdate() {
    if (!this.body) return;
    let verticalSpeed = this.body.velocity.y;
    if (this.jumpRequested && this.isGrounded) verticalSpeed = -this.jumpSpeed;
    this.jumpRequested = false;
    this.body.velocity = new Vector2(Input.GetAxis('Horizontal') * this.speed, verticalSpeed);
  }
}
```
Press Play. Horizontal movement is controlled by body velocity; vertical velocity is preserved unless a grounded jump is requested. Test one wall and one floor before adding a full level.

**In the file** your current `.scene.json`, the selected entity stores its rigidbody, collider and one script entry. Compare those component fields with the [rigidbody](component-rigidbody.html) and [collider](component-collider.html) references. Do not attach both transform and physics movement scripts to the same body.

> **Trap:** a press edge is available for one frame. Read it in Update, then retain the request until FixedUpdate consumes it. Reading it only in a fixed step can miss the event. This small controller has no coyote-time, jump-buffer or slope-handling system; use the platformer example when you need those features.

## 3. Move a 3D object on the ground plane
Use a **3D project**, a visible mesh/model, and a camera that can see it. This transform-only version uses x/z for the ground and keeps y unchanged.

**File: `scripts/Walker3D.js`** (new file, the whole file)
```js
import { MonoBehaviour, SerializeField, UnityInput as Input, Time, Vector3 } from 'nord';

export default class Walker3D extends MonoBehaviour {
  static attributes = SerializeField({ speed: 5 });

  Update() {
    let direction = new Vector3(Input.GetAxis('Horizontal'), 0, -Input.GetAxis('Vertical'));
    if (direction.sqrMagnitude > 1) direction = direction.normalized;
    const distance = this.speed * Time.deltaTime;
    this.Translate(direction.x * distance, 0, direction.z * distance);
  }
}
```
Save and Play. Left/right changes x; W/Up moves toward negative z. If the camera faces another direction, screen-left and world-left can differ. Use the [3D controllers](ex-3d-controllers.html) when you need camera-relative or physical movement.

## Buttons, pointer and devices

| Need | Unity-style call | Important distinction |
|---|---|---|
| Continuous action | `Input.GetButton('fire')` | True while mapped input is held |
| One action | `Input.GetButtonDown('jump')` | True on the new press |
| Release | `Input.GetButtonUp('fire')` | True on release |
| Raw key | `Input.GetKeyDown(KeyCode.Space)` | Import KeyCode too; independent of action name |
| Mouse position | `Input.mousePosition` | Screen coordinates; convert through the active camera for world picking |
| Mouse press | `Input.GetMouseButtonDown(0)` | Left mouse button |
| Touch/gamepad action | Project mappings / on-screen controls | Test the intended device and mappings |

Jump and Shoot are not built-in methods on your script. Define any method you call, or use one of the complete controllers linked from [Examples](examples.html). See [Picking](ex-picking-dragging.html) and [Mobile controls](ex-mobile-touch.html) for those workflows.

## Check yourself
- Exactly one movement script owns this object's motion.
- In 2D, Up moves toward negative y; in the 3D version it moves toward negative z.
- Holding a direction moves continuously; a jump request is consumed once.
- The physics version has a body, collider and floor; the transform versions do not promise physical contact.

Next: [Finding objects](ex-find-and-talk.html). Back to: [Examples](examples.html).

---
title: Input and physics cheatsheet
section: Guides
group: Unity scripting and gameplay
order: 12
summary: Held versus pressed input, 2D/3D coordinates, transform versus body motion, queries, triggers and contact troubleshooting.
---
Use this sheet to choose the right input test and movement method. Start with two simple shapes before adding models, animations or a complex controller.

::: dummies
A key held down is a continuous signal. A key pressed this frame is one short pulse. Use the continuous signal to move; use the pulse for one jump or menu action. Physics adds another rule: one system should own an object's motion at a time.
:::

## Set up in the editor
1. Select the moving object in @ui[Hierarchy]. Add the required rigidbody and collider through @ui[Inspector ▸ + Add component]. Check the component reference for the selected backend.
2. Add a second collider as a simple obstacle. Save, press Play and confirm the bodies can meet.
3. For named actions, configure the project's input in the @ui[Project] tab. Focus the Game view before testing. See [Input](input.html) and [Physics](physics.html) for the exact setup.

**In the file** `nord.project.json`, input and physics settings belong to the project. The selected entity's `.scene.json` entry owns its rigidbody and collider data. [Project format](project-format.html) describes both; do not copy a 2D body configuration into a 3D project unchanged.

## Input lookup
Import `UnityInput as Input` and `KeyCode` from `nord` for these Unity-style names.

| Intention | Call | Value / use |
|---|---|---|
| Key is held | `Input.GetKey(KeyCode.Space)` | Boolean every frame held |
| Key was pressed | `Input.GetKeyDown(KeyCode.Space)` | Boolean on the new press |
| Key was released | `Input.GetKeyUp(KeyCode.Space)` | Boolean on release |
| Named action held / pressed | `Input.GetButton('jump')` / `Input.GetButtonDown('jump')` | Action must exist in project input |
| Horizontal / vertical axis | `Input.GetAxis('Horizontal')` / `Input.GetAxis('Vertical')` | Signed input value; choose world direction explicitly |
| Left mouse press | `Input.GetMouseButtonDown(0)` | Button 0 left, 1 right, 2 middle |
| Pointer position | `Input.mousePosition` | Screen-space vector; not automatically a world position |

Named actions help keyboard, touch and gamepad share one behavior. Read a one-frame press in Update and store a request if a later fixed update must consume it; do not assume a press survives until another tick.

## Choose movement ownership

| Goal | Use | Avoid |
|---|---|---|
| Decorative drifting or a marker | Transform movement in Update | Expecting it to simulate physical contact |
| Dynamic movement against walls | Rigidbody velocity / forces in the controller's physics step | Reassigning transform position every frame too |
| Teleport or reset | Explicit position change, then verify body state | Treating a teleport as normal walking |
| A continuous push | AddForce with the appropriate force mode | Repeated impulse calls when only one impulse was intended |
| A single impact | An impulse at the triggering event | Multiplying the impulse every render frame |

Use `this.GetComponent('Rigidbody2D')` for 2D and `this.GetComponent('Rigidbody')` for 3D. The wrappers' properties and backend limits are in the [Unity physics examples](ex-unity-api-physics2d.html) and [3D reference](ex-unity-api-physics3d.html).

## Units and queries

| Feature | 2D | 3D |
|---|---|---|
| Coordinates | Pixels; x right, y down | World units; y up |
| Planar movement | x/y | Usually x/z |
| Query helper | Physics2D with Vector2 inputs | Physics with Vector3 inputs |
| Ray miss check | Inspect the hit's collider | Inspect the hit's collider; use the documented overload |
| Overlap / cast variants | First / All / NonAlloc variants differ | Check the specific 3D API entry |

Do not assume a result object is a successful hit. Check its documented collider field, and distinguish an overlap result from a raycast-hit record. Native adapter methods may return a different shape from the Unity wrapper.

## When contact does not happen

| Symptom | Check first |
|---|---|
| Passes through walls | Body, collider, layers, detection mode and competing transform movement |
| Trigger does not physically block | Trigger is for notification; use solid collision when blocking is required |
| No callback | Enabled objects, matching backend, collider setup, and exact callback capitalization |
| Query sees the player itself | Origin/shape, layer filter and intended collider exclusions |
| Sprite jumps downward | 2D upward velocity is negative y |
| Mouse pick is displaced | Convert screen input through the active camera before using world coordinates |

## Check yourself
Verify held movement, a single press, solid contact and a trigger separately. Then run the [Physics Lab](ex-physics-lab.html) for the backend you actually use.

Next: [Maths and timing](cheat-sheet-maths-time.html). Back to: [Cheatsheets](cookbook.html).

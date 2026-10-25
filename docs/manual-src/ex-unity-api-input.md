---
title: 60 · Unity API: input
section: Examples
order: 60
summary: The classic Input class (axes, mouse, touches, sensors, location) and the New Input System (InputAction, .inputactions files, PlayerInput, Keyboard.current) in Unity names.
---

**Goal:** use both Unity input systems. The classic `Input` class is for quick scripts, the New Input System for rebindable, multi-device games. They read the same keyboard, mouse, touch and gamepad of the Nord engine, so you can mix them.

**Example** (not a file: the import line of a script that uses everything on this page)
```js
import { UnityInput as Input, KeyCode, InputAction, InputActionAsset, PlayerInput, Keyboard, Mouse, Gamepad, Touchscreen, TouchPhase } from 'nord';
```

## The classic Input class
| Unity | Nord |
|---|---|
| `Input.GetKey/GetKeyDown/GetKeyUp(KeyCode.Space)` or `("space")` | yes, key names and `KeyCode`. New in `KeyCode`: `JoystickButton0…19`, `Mouse3…6`, `Insert`, `Home`, `End`, `PageUp/Down`, `LeftCommand`, punctuation (`Comma`, `Period`, `Minus`, `Equals`, `Slash` …), the keypad. |
| `Input.GetButton/GetButtonDown/GetButtonUp("Jump")` | project actions first, then Unity's defaults (`Jump` = Space, `Fire1` = left mouse or Ctrl, `Submit`, `Cancel`). |
| `Input.GetAxis("Horizontal" / "Vertical")`, `GetAxisRaw` | A/D, arrows and the gamepad stick. |
| **`Input.GetAxis("Mouse X" / "Mouse Y" / "Mouse ScrollWheel")`** | mouse movement of this frame × 0.1 (Y up like Unity), wheel × 0.1. With the pointer locked (`Cursor.lockState = CursorLockMode.Locked`) it keeps counting at the edge of the screen: use that for mouse-look. |
| **project axes** | `nord.project.json` ▸ `input.axes` (see below). |
| `Input.mousePosition`, `mouseScrollDelta`, `GetMouseButton*` | yes (pixels, origin top-left like the 2D world). |
| **`Input.inputString`** | the characters typed this frame (`\b` for Backspace, `\n` for Enter). |
| `Input.anyKey`, `anyKeyDown`, `ResetInputAxes()` | yes. |
| `Input.GetJoystickNames()` | names of the connected gamepads. |

### Smooth axes (Unity's gravity and sensitivity)
@ui[Project ▸ Project properties] has no panel for input axes yet, so this is edited in the project file. By default `GetAxis` is instant (the value jumps to -1, 0, 1), which feels crisp for games with stopping control. Switch on Unity's ramp-up and ramp-down for the keyboard axes with one line:

**File: `nord.project.json`** (inside `input`)
```json
"input": {
  "smoothAxes": true,
  "axes": {
    "Strafe": { "negative": "KeyQ", "positive": "KeyE", "sensitivity": 5, "gravity": 8, "dead": 0.001, "snap": true },
    "Throttle": { "negative": "KeyS", "positive": "KeyW", "joyAxis": 3, "invert": false }
  }
}
```
`sensitivity` (units per second towards the key), `gravity` (back to zero), `dead` (below this the value is 0), `snap` (pressing the opposite key resets to 0 first), `joyAxis` (gamepad axis index), `invert`. A project axis defined here works with `Input.GetAxis("Strafe")`. `Input.smoothAxes = true` in a script does the same at run time.

## Touches
| Unity | Nord |
|---|---|
| `Input.touchCount`, `Input.touches`, `Input.GetTouch(i)` | yes |
| `touch.fingerId`, `position`, `rawPosition`, `deltaPosition`, `deltaTime` | yes |
| `touch.phase` | `TouchPhase.Began`, `Moved`, `Stationary`, `Ended`, `Canceled`. A lifted finger is reported once as `Ended`, then gone. |
| **`touch.pressure`**, `maximumPossiblePressure`, **`radius`**, `radiusVariance`, `altitudeAngle`, `azimuthAngle`, `type` | pressure and radius come from the device when it reports them (otherwise 1 / 0). |
| **`touch.tapCount`** | 1, 2, 3 … for quick repeated taps near the same place (within 350 ms and 40 px). |

**File: `scripts/Tap.js`** (new file, the whole file)
```js
import { MonoBehaviour, UnityInput as Input, TouchPhase } from 'nord';

export default class Tap extends MonoBehaviour {
  Update() {
    for (const t of Input.touches) {
      if (t.phase === TouchPhase.Ended && t.tapCount === 2) this.log('double tap at', t.position.toString());
      if (t.phase === TouchPhase.Moved) this.transform.Translate(t.deltaPosition.x, t.deltaPosition.y, 0);
    }
  }
}
```

## Accelerometer, gyroscope, compass, location
| Unity | Nord |
|---|---|
| `Input.acceleration` | in g, Unity axes: a phone lying face up reads `(0, 0, -1)`. |
| `Input.gyro.enabled = true`, `attitude`, `rotationRate`, `rotationRateUnbiased`, `userAcceleration`, `gravity` | the browser's `deviceorientation` / `devicemotion`. Set `enabled` first. |
| `Input.compass.enabled = true`, `magneticHeading`, `trueHeading`, `headingAccuracy` | degrees from north. |
| `Input.location.Start()`, `status`, `lastData.latitude/longitude/altitude/horizontalAccuracy/timestamp`, `Stop()` | the browser's geolocation (asks the user). `status` is `Stopped`, `Initializing`, `Running` or `Failed`. |
| `Input.deviceOrientation` | from the screen orientation. |

> **Trap:** On iPhone the browser asks for sensor permission and only after a tap. Nord asks on the first tap on the game after your script touched `acceleration` or `gyro`. Desktop computers have no sensors: the values stay at zero. Test with a phone on your network (`nord serve --lan`).

**File: `scripts/Tilt.js`** (new file, the whole file: steer by tilting the phone)
```js
import { MonoBehaviour, UnityInput as Input, Time } from 'nord';

export default class Tilt extends MonoBehaviour {
  Start() { Input.gyro.enabled = true; }
  Update() {
    const a = Input.acceleration;                           // read it every frame
    this.transform.Translate(a.x * 300 * Time.deltaTime, 0, 0);
    this.transform.rotation = Input.gyro.attitude;          // 3D: follow the phone's rotation
  }
}
```

## The New Input System
The names are Unity's: actions, maps, assets, bindings with paths like `<Keyboard>/space`, composites, processors, `PlayerInput`.

### One action, in code
**File: `scripts/Jumper.js`** (new file, the whole file)
```js
import { MonoBehaviour, InputAction, Rigidbody2D, Vector2 } from 'nord';

export default class Jumper extends MonoBehaviour {
  Awake() {
    this.jump = new InputAction('Jump', 'Button', '<Keyboard>/space');   // name, type, first binding
    this.jump.AddBinding('<Gamepad>/buttonSouth');                        // a second way to trigger it
    this.move = new InputAction('Move', 'Value');
    this.move.AddCompositeBinding('2DVector')                            // WASD as a Vector2
      .With('Up', '<Keyboard>/w').With('Down', '<Keyboard>/s').With('Left', '<Keyboard>/a').With('Right', '<Keyboard>/d');
    this.move.AddBinding('<Gamepad>/leftStick');                          // the stick works too
    this.jump.performed.AddListener((ctx) => this.log('jump!', ctx.phase));
  }
  OnEnable()  { this.jump.Enable(); this.move.Enable(); }
  OnDisable() { this.jump.Disable(); this.move.Disable(); }
  FixedUpdate() {
    const v = this.move.ReadValue();                                      // Vector2, normalised diagonal
    this.GetComponent(Rigidbody2D).velocity = new Vector2(v.x * 200, this.GetComponent(Rigidbody2D).velocity.y);
    if (this.jump.WasPressedThisFrame()) this.GetComponent(Rigidbody2D).AddForce(new Vector2(0, -400), 1);
  }
}
```
In 2D the y axis points down, so a "jump" is a negative y force and `Up` on a stick is `+y` in the action value (Unity's convention): flip the sign when you apply it to a 2D body.

| `InputAction` | |
|---|---|
| `new InputAction(name, type, binding)`; type `'Value'`, `'Button'` or `'PassThrough'` | |
| `AddBinding(path, interactions, processors)`, `AddCompositeBinding("2DVector" / "1DAxis" / "3DVector" / "ButtonWithOneModifier" / "ButtonWithTwoModifiers")` + `.With(part, path)` | |
| `Enable()`, `Disable()`, `enabled`, `phase` | |
| `ReadValue()` (number or `Vector2`), `ReadValueAsButton()`, `IsPressed()`, `WasPressedThisFrame()`, `WasReleasedThisFrame()`, `WasPerformedThisFrame()` | |
| `started`, `performed`, `canceled` | events: `.AddListener(ctx => …)`. `ctx` has `action`, `phase`, `ReadValue()`, `ReadValueAsButton()`, `time`, `startTime`, `duration`, `control.path` |

Control paths: `<Keyboard>/space` `w` `leftShift` `upArrow` `f5` `anyKey` · `<Mouse>/leftButton` `rightButton` `middleButton` `position` `delta` `scroll` · `<Gamepad>/buttonSouth` `buttonEast` `buttonWest` `buttonNorth` `leftShoulder` `rightShoulder` `leftTrigger` `rightTrigger` `start` `select` `leftStick` `rightStick` `dpad` (and `leftStick/x`, `leftStick/up` …) · `<Pointer>/position`, `<Touchscreen>/primaryTouch/position`, `/press`. Processors (separated by `;`): `invert`, `invertVector2(invertX=false)`, `scale(factor=2)`, `scaleVector2(x=2,y=2)`, `clamp(min=0,max=1)`, `normalize`, `normalizeVector2`, `axisDeadzone`, `stickDeadzone`.

### Unity's `.inputactions` file
Make the actions in Unity's *Input Actions* editor, copy the `.inputactions` file (JSON) into your project, load it:

**File: `scripts/Controls.js`** (new file, the whole file)
```js
import { MonoBehaviour, InputActionAsset, PlayerInput, InputSystem } from 'nord';

export default class Controls extends MonoBehaviour {
  async Awake() {
    const asset = await InputSystem.LoadActionAsset('input/PlayerControls.inputactions');
    this.player = new PlayerInput(this.entity, asset, { defaultActionMap: 'Player', notificationBehavior: 'SendMessages' });
  }
  // PlayerInput (SendMessages) calls On<ActionName>(InputValue) on the scripts of this object when the action is performed
  OnMove(value)  { this.dir = value.Get(); }          // Vector2
  OnFire(value)  { this.log('fire', value.isPressed); }
  OnInteract()   { this.player.SwitchCurrentActionMap('UI'); }
}
```
`InputActionAsset.FindActionMap("Player")`, `FindAction("Player/Move")`, `Enable()`, `Disable()`, `onActionTriggered(fn)`. `PlayerInput`: `SwitchCurrentActionMap(name)`, `ActivateInput()`, `DeactivateInput()`, notification behaviours `SendMessages`, `BroadcastMessages`, `InvokeCSharpEvents` (`player.onActionTriggered.AddListener`), `InvokeUnityEvents`. Composite parts written by Unity (`up`, `down`, `left`, `right`) are read case-insensitively.

### Direct device access
**File: `scripts/Devices.js`** (new file, the whole file)
```js
import { MonoBehaviour, Keyboard, Mouse, Gamepad } from 'nord';

export default class Devices extends MonoBehaviour {
  Update() {
    if (Keyboard.current.spaceKey.wasPressedThisFrame) this.log('space');
    if (Keyboard.current['leftShift'].isPressed) this.log('shift held');
    if (Mouse.current.leftButton.wasPressedThisFrame) this.log('click at', Mouse.current.position.ReadValue().toString());
    const pad = Gamepad.current;                                   // null when no pad is connected
    if (pad && pad.buttonSouth.isPressed) this.log('stick', pad.leftStick.ReadValue().toString());
  }
}
```
Keys are `Keyboard.current.<name>Key` (`aKey`, `digit1Key`, `escapeKey`) or `Keyboard.current['name']`. Controls have `isPressed`, `wasPressedThisFrame`, `wasReleasedThisFrame`, `ReadValue()`. `Touchscreen.current.touches` and `primaryTouch` exist.

## Check yourself
* `node --test runtime/core/unity-extra.test.mjs` covers axes, touches, the 2DVector composite, an `.inputactions` file with `PlayerInput` messages and `Keyboard.current`.
* The new-system actions need `Enable()`: a disabled action reads zero and fires nothing.
* On a phone (`nord serve --lan`) the sensors move; on a desktop they read zero.

Next: [Physics 2D](ex-unity-api-physics2d.html). Back to: [Math types](ex-unity-api-math.html).

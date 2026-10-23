# Animator controller (`anim/*.animator.json`)

Unity-style state machine for 2D sprite animation. Behaviour cloned from Unity's `Animator` / `AnimatorController`
(`AnimatorConditionMode`, `AnimatorControllerParameterType`; see `REFE/UnityCsReference-master/Editor/Mono/StateMachine.bindings.cs`).
No blending: a transition switches the clip of the entity's `animatedSprite` (2D) or the glTF animation of its `model` component (3D, Babylon animation group). Runtime: `runtime/core/animator.js`, component `animator`
(`runtime/core/components.js`), editor: **Animator** tab (`editor/animator/`). Tests: `runtime/core/animator.test.mjs`.

## File format
```json
{
  "parameters": [ { "name": "speed", "type": "float", "default": 0 }, { "name": "jump", "type": "trigger" } ],
  "states": [ { "name": "Idle", "anim": "idle", "speed": 1, "length": 0, "x": 320, "y": 220 } ],
  "default": "Idle",
  "transitions": [ { "from": "Idle", "to": "Run", "hasExitTime": false, "exitTime": 1, "conditions": [ { "param": "speed", "mode": "greater", "value": 0.1 } ] } ],
  "editor": { "any": { "x": 60, "y": 60 } }
}
```
* Parameter types: `float`, `int`, `bool`, `trigger`. Condition modes: `if`, `ifNot` (bool/trigger), `greater`, `less` (float), `greater`, `less`, `equals`, `notEqual` (int).
* `from: "*"` is **Any State** (checked before a state's own transitions; does not re-enter the state it is already in unless `canTransitionToSelf`).
* A transition fires when its exit time (if `hasExitTime`, normalised: 1 = one clip length) is reached **and** all conditions hold. With no exit time and no conditions it can never fire (the editor warns).
* A **trigger** stays set until a transition that uses it fires, then resets (Unity semantics).
* `state.anim` = clip name of the sprite sheet (2D) or name of the glTF animation (3D; the `model` component's `animations`), `loop` (3D, default true) loops the group (`<sheet>.meta.json` `anims`), `speed` = playback speed, `length` = clip length in seconds for exit times (0 = ask the running sprite, 1 s in the editor test).
* `x`/`y`/`editor` are only layout for the editor.

## Component
`{ "type": "animator", "controller": "anim/player.animator.json", "params": { "speed": 0 } }` next to an `animatedSprite` or a `model`. Leave the model's own `animation` field empty so the controller decides. Two states may use the same clip with different `speed` (the running group just changes speed).
Script API (`this.entity.getComponent('animator')`): `setBool(n, v)`, `setInt(n, v)`, `setFloat(n, v)`, `setTrigger(n)`, `resetTrigger(n)`, `get(n)`, `play(state)`, `state`.
`entity.set('animator', 'speed', 2)` sets a parameter too. Event-sheet actions are not added yet (use a script or the Graph `Run code` node).

## Editor
Window ▸ Editors ▸ Animator (or double-click an `.animator.json`; Assets ▸ New animator controller creates `anim/new-controller.animator.json`).
Add states and parameters, drag states, select a state ▸ *Make transition* ▸ click the target, edit exit time and conditions on the right, **▶ Test** runs the real controller with live parameter controls.

---
title: Input
section: Manual
order: 10
summary: Actions, keyboard, mouse, touch, gamepad, rebinding.
---

Input connects a player’s keys, pointer, touch or gamepad to game actions. Give actions names such as left and jump so game code can stay simple.

::: dummies
down means a button is held. pressed means it just became held this frame. Use down for walking and pressed for a single jump or menu action.
:::

Scripts never read raw keys. You declare **actions** in the project and ask about the action:

```json
"input": { "actions": {
  "jump":  ["Space", "ArrowUp", "Gamepad0"],
  "left":  ["KeyA", "ArrowLeft", "GamepadLeft"],
  "right": ["KeyD", "ArrowRight", "GamepadRight"],
  "fire":  ["Mouse0"]
} }
```

::: dummies
An **action** is a job name ("jump") that several buttons can trigger. Your code says "was *jump* pressed?" and doesn't care whether it was the spacebar or a gamepad button — so players can remap keys without you changing the game.
:::

| Call | Meaning |
|---|---|
| `input.down('jump')` | held this frame |
| `input.pressed('jump')` | went down this frame |
| `input.released('jump')` | went up this frame |
| `input.axis('left','right')` | −1, 0 or 1 |
| `input.vec('left','right','up','down')` | normalised 2D vector (analog stick wins when pushed) |
| `input.key('KeyW')` | raw key code (debug) |
| `input.pointer` | `{ x, y, worldX, worldY, down }` — canvas and world coordinates |
| `input.stick` | analog left stick `[x, y]` |

**Codes** are `KeyboardEvent.code` names (`KeyA`, `Space`, `ArrowLeft`, `ShiftLeft`…), `Mouse0/1/2`, `Gamepad0…n` (button index) and
`GamepadLeft/Right/Up/Down` (left stick past 50 %). Gamepads are polled each frame (first connected pad; dead-zone 0.2).

## Input editor (per project)
Open the @ui[Project] tab ▸ @ui[Input (actions and keys)]. Every new project starts with the basic map: `left right up down` (WASD + arrows), `jump` (Space/W/Up), `fire` (Space/Mouse0), `interact` (E/Enter). Per project you can:
* press @ui[＋ key], then the key on your keyboard, to bind it; @ui[＋ mouse/pad] adds `Mouse0-2`, `Gamepad0-3`, Shift/Ctrl/Alt; click a key chip to remove it;
* @ui[Add action] with a new name (then press its first key); the 🗑 button deletes an action;
* @ui[Add missing basics] restores only the basic actions you deleted (your own are never touched); @ui[Reset to basics] replaces the whole map.

It saves into `nord.project.json` (`input.actions`). Scripts use the names: `this.input.down('jump')`, Unity-style `Input.GetButtonDown('jump')`; raw keys work without any action: `Input.GetKey(KeyCode.Space)`.

## Rebinding
`input.actions` is a plain object — change it at runtime: `this.input.actions.jump = ['KeyZ']` and persist it with `this.save.set('bindings', this.input.actions)`.
Build a settings screen with `game.ui` (the library's `ui-settings.js` covers volume).

## Touch
Pointer events cover touch (`input.pointer`). Add a virtual joystick and on-screen buttons (`input.setVirtual('jump', true)` while held).

::: tip
Use `fixedUpdate` for physics-related input (jumping) and `update` for everything else; `pressed` is evaluated once per rendered frame, so read it in `update` if you must not miss a tap.
:::

## Mobile and on-screen controls
For a complete code-drawn joystick plus hold buttons, see **[Mobile and on-screen touch controls](mobile-controls.html)**. It includes the existing virtual joystick, reusable button code, action mapping, pointer cancellation/cleanup, desktop pointer testing, and the Star-Not touch example.

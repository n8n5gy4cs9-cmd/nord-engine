---
title: Input
section: Manual
order: 10
summary: Actions, keyboard, mouse, touch, gamepad, rebinding.
---
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

## Rebinding
`input.actions` is a plain object — change it at runtime: `this.input.actions.jump = ['KeyZ']` and persist it with `this.save.set('bindings', this.input.actions)`.
Build a settings screen with `game.ui` (the library's `ui-settings.js` covers volume).

## Touch
Pointer events cover touch (`input.pointer`). Add a virtual joystick and on-screen buttons (`input.setVirtual('jump', true)` while held).

::: tip
Use `fixedUpdate` for physics-related input (jumping) and `update` for everything else; `pressed` is evaluated once per rendered frame, so read it in `update` if you must not miss a tap.
:::

## Phones and tablets
Exported web games get **on-screen touch controls for free**: a stick or D-pad plus buttons, built from your `input.actions` (`left/right/up/down` become the pad, every other action a button, `pause`/`menu` a corner button). They appear only on touch devices; add `?touch=1` to the URL to preview on a desktop, `?touch=0` to turn them off. They work by sending ordinary keyboard events, so every export mode is covered — HTML, Phaser, Babylon, PlayCanvas and Rust/WASM.

For a hand-written `html` project, copy `runtime/touch/nord-touch.js` next to your page and add one line (see `examples/html-touch`):

```html
<script src="nord-touch.js" data-preset="platformer" data-buttons="Space:Jump,ShiftLeft:Dash"></script>
```
Presets: `arrows`, `wasd`, `platformer`, `topdown`, `shooter`, `tap`. Details: `docs/EXPORT_TARGETS.md`.

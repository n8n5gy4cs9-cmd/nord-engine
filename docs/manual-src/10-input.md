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

**In the editor:** @ui[Project] tab ▸ **Input Manager (actions and keys)**: **＋ key** next to an action, then press the key ([the steps](ex-input-editor.html)).

**In the file** `nord.project.json` (check it in a text editor):
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

## Input Manager (per project)
This is Nord's version of Unity's **Edit ▸ Project Settings ▸ Input Manager**. Open the @ui[Project] tab (bottom, next to Console; or the Window menu ▸ Project) and scroll to @ui[Input Manager (actions and keys)]. Every new project starts with the basic map: `left right up down` (WASD + arrows), `jump` (Space/W/Up), `fire` (Space/Mouse0), `interact` (E/Enter). Per project you can:
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

## Keyboard focus in the editor (like Unity)
While you play in the editor, the **Game view** owns the keyboard once it has focus (Play focuses it; clicking inside it focuses it): `Q W E R T F Delete`, arrows and every other plain key go to **your game**, never to the editor tools. Cmd/Ctrl combos and F-keys (Play, Pause, Step, Save…) still work. Click the Scene view, Hierarchy, Inspector or any other panel and the editor shortcuts are back.

**Esc releases the mouse.** If your game locked the cursor (first-person look), Esc in the Game view unlocks it, even when your code never does. Turn it off in @ui[Settings ▸ Game view mouse ▸ Esc releases a locked mouse]. This exists only in the editor: an exported web game or desktop app does not add it (the browser's own Esc still unlocks a locked mouse; your game decides the rest).

## Which platform am I on?

**File: your script, for example `scripts/Boot.js`** (the `import` line at the top, the checks inside `start()`)
```js
import { Application, RuntimePlatform } from 'nord';
if (Application.isEditor) Debug.Log('testing inside the Nord editor');
switch (Application.platform) {
  case RuntimePlatform.WebGLPlayer: /* browser tab or exported web game */ break;
  case RuntimePlatform.OSXPlayer: case RuntimePlatform.WindowsPlayer: case RuntimePlatform.LinuxPlayer: /* exported desktop app */ break;
  case RuntimePlatform.OSXEditor: case RuntimePlatform.WindowsEditor: case RuntimePlatform.LinuxEditor: /* Game view in the editor */ break;
  case RuntimePlatform.IPhonePlayer: case RuntimePlatform.Android: /* phone browser */ break;
}
if (Application.os === 'mac') { /* the machine, whatever the shell: 'mac' | 'win' | 'linux' | 'ios' | 'android' */ }
if (Application.isMobilePlatform) showTouchControls();
```
`isEditor`, `isDesktopApp`, `isWebPlayer`, `isMobilePlatform` are plain booleans. Use it to hide a Quit button on the web, show touch controls on phones, enable cheats only in the editor, or choose Cmd vs Ctrl labels with `Application.os`. Also `Cursor.lockState = CursorLockMode.Locked` (lock the mouse) and `Cursor.visible = false`.

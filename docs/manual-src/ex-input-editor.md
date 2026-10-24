---
title: 43 · Input actions and the Input editor
section: Examples
order: 43
summary: Edit your project's input map in the Project tab: bind keys by pressing them, add actions, restore the basics.
---

**Goal:** give your game its own controls (like Unity's Input Manager) and read them in scripts.

## The basics every project has
New projects start with: `left right up down` (WASD + arrows), `jump` (Space / W / Up), `fire` (Space / left mouse), `interact` (E / Enter).

## Edit them
1. This is Unity's Input Manager. @ui[Project] tab ▸ (next to Console) scroll to @ui[Input Manager (actions and keys)].
2. Click @ui[＋ key] next to `jump`, then press the key you want. Click a key chip to remove it.
3. @ui[＋ mouse/pad] adds `Mouse0-2`, `Gamepad0-3`, Shift, Ctrl, Alt.
4. Type a name and press @ui[Add action] (for example `dash`), then press its first key.
5. Deleted a basic one by accident? @ui[Add missing basics] brings back only the missing ones and never touches yours. @ui[Reset to basics] replaces everything.

It is saved in `nord.project.json` under `input.actions`, so each project has its own map.

## Use them
```js
import { MonoBehaviour, UnityInput as Input, Time } from 'nord';
export default class Dasher extends MonoBehaviour {
  Update() {
    if (Input.GetButtonDown('dash')) this.Translate(3);
    if (Input.GetButton('left')) this.Translate(-5 * Time.deltaTime);
  }
}
```
Native style: `this.input.pressed('dash')`, `this.input.down('left')`, `this.input.axis('left', 'right')`.

## Let players rebind
`this.input.actions.dash = ['KeyQ']` at runtime, saved with `this.save.set('bindings', this.input.actions)`; see [Options menu](ex-settings-menu.html).

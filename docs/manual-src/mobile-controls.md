---
title: Mobile and on-screen touch controls
section: Guides
group: Reference tables
order: 43
summary: Code-drawn joystick and hold buttons for any Nord 2D/3D game, with desktop pointer testing.
---
Yes: draw simple mobile controls **with code**. Nord already provides a virtual joystick. Buttons can drive the same named input actions as keyboard controls, so your player controller does not need a separate mobile version.

The complete reusable example is **`examples/star-not/scripts/sn/touch.js`**. Star-Not automatically shows it in combat on touch devices; its orbit menu also lets you turn it on for desktop pointer testing. No button or joystick image is required.

## 1. Use named actions in your player code
Read actions such as `left`, `right`, `up`, `down`, `fire` and `jump` through `this.input`. The project can map them to physical keys; virtual controls set those same actions.

**File: your script, for example `scripts/Player.js`** (inside `update(dt)`)
```javascript
const direction = this.input.vec('left', 'right', 'up', 'down');
if (this.input.down('fire')) {
  // Keep firing while the touch button or keyboard key is held.
}
if (this.input.pressed('jump')) {
  // Jump only on the first frame of the press.
}
```

::: dummies
An action is a name for what the player wants to do. A keyboard key and an on-screen button can both say “fire.” Your game reads that name and does not need to care which device said it.
:::

## 2. Add a joystick
From a NordScript, create it under the game's UI root:

**File: `scripts/Controls.js`** (inside `start()` of a script on any object)
```javascript
import { NordScript, virtualJoystick } from 'nord';

export default class TouchMovement extends NordScript {
  start() {
    this.joy = virtualJoystick(this.input, this.ui.root, {
      left: 'left', right: 'right', up: 'up', down: 'down', size: 112,
    });
    this.joy.el.style.pointerEvents = 'auto';
  }
  onDestroy() {
    for (const action of ['left', 'right', 'up', 'down']) {
      this.input.setVirtual(action, false);
    }
    this.joy?.destroy();
  }
}
```

The joystick is a circular DOM element and a knob. It uses pointer capture, so dragging beyond its circle still works. It sets directional actions and `input.stick`. Position it with its element's CSS: left/right/bottom/top. Clearing actions when removing controls prevents a direction staying held.

## 3. Add hold buttons and cleanup
Copy the module below to `scripts/touch.js`. It draws a joystick, FIRE and a second action button; buttons release on pointer-up, cancellation and lost capture. Blur/hiding resets actions too.

::: example-code examples/star-not/scripts/sn/touch.js javascript

The second button is labelled SHIELD in this game's module; change that label to JUMP if your own second action is jump. The `shield` option accepts whichever action name you want to use.

## 4. Mount it from your game

**File: `scripts/Controls.js`** (new file, the whole file)
```javascript
import { NordScript } from 'nord';
import { mountTouchControls } from './touch.js';

export default class MobileControls extends NordScript {
  start() {
    this.controls = mountTouchControls(this.input, this.ui.root, {
      left: 'left', right: 'right', up: 'up', down: 'down',
      fire: 'fire', shield: 'jump', rightInset: 24, bottomInset: 24,
    });
  }
  onDestroy() { this.controls?.destroy(); }
}
```

Attach this script to one entity. Keep it enabled only while the game is playing. For a DOM menu that covers controls, hide/remove the control layer too. For Star-Not the action names are `p1Left`, `p1Right`, `p1Thrust`, `p1Brake`, `p1Fire` and `p1Shield`; do not copy those names into a game whose actions are named differently.

## 5. Show controls automatically, or with a switch

**File: `scripts/Controls.js`** (inside `start()`, after the joystick exists)
```javascript
const touchDevice = matchMedia('(pointer: coarse)').matches;
```

This is a useful default, not a complete device detector. Give the user an override, especially on tablets with a keyboard. Star-Not's orbit menu has **Touch controls: on/off** so you can enable the controls and drag them with your desktop mouse before trying a phone.

## 6. Open the game on your phone
Serve the project with Nord's local server and use its LAN option when needed; see [command-line reference](cli.html#serve) for the flags. Your phone must reach the same computer on the local network. Exported games can also be served by an ordinary web host with all local files included.

Use responsive screen sizing, large enough hit targets, and `touch-action: none` on the controls. Keep controls out of menus and important HUD text. A fixed 1024×720 game such as Star-Not is easier to play in landscape. Multiple fingers work through separate pointer capture on joystick and buttons.

## 7. Reuse for 2D or 3D
The controls drive Nord input actions, not a Phaser or Babylon object. The same module can drive a 2D controller, a 3D controller or a custom NordScript. Steering rules still belong to that controller: a boat or spaceship might turn, while a platformer moves horizontally.

The editor's Library also includes **ui-joystick.js** for joystick-only insertion. Use the ready-made helper before building a new input system.


## Check yourself

Confirm the result in your saved project. Check Console errors and compare exact names with the linked reference if the result differs.

Next: [Unity scripting cheatsheet](cheat-sheet-unity.html). Back to: [Cheatsheets](cookbook.html).

---
title: 27 · Touch, mobile and responsive games
section: Examples
order: 27
summary: Virtual joystick and buttons, tap and swipe, screen scaling and orientation, and shipping a web app that installs on a phone.
---

**Goal:** the same game playable with keyboard and with thumbs.

## Actions make it easy
If your game reads **actions** (`input.axis('left','right')`, `input.pressed('jump')`) touch support is one script. Library **Virtual joystick & touch buttons** (`ui-joystick.js`):
| Attribute | Meaning |
|---|---|
| `always` | show on desktop too (for testing); default: only on touch devices |
| `buttons` | action names for the right-hand buttons, e.g. `["jump", "fire"]` (max 2) |
| `size` | joystick size in pixels |

The joystick drives the actions `left right up down`; the buttons press your named actions. Nothing else changes in your scripts. Unity: the Input System's on-screen controls.

## Taps, drags and swipes
`Mouse0` is also the first finger. Pointer position is in `input.pointer` (`x, y` screen; `worldX, worldY`; `down`).

**File: your script, for example `scripts/Touch.js`** (the `update()` method)
```js
update() {
  const p = this.input.pointer;
  if (this.input.pressed('fire')) this.onTap(p.worldX, p.worldY);              // 'fire': ["Mouse0"]
}
```
A swipe:

**File: your script, for example `scripts/Touch.js`** (replace `update()` with this one)
```js
update() {
  const p = this.input.pointer;
  if (this.input.pressed('tap')) this.from = [p.x, p.y];                        // 'tap': ["Mouse0"]
  if (this.input.released('tap') && this.from) {
    const dx = p.x - this.from[0], dy = p.y - this.from[1];
    if (Math.hypot(dx, dy) > 40) this.onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    this.from = null;
  }
}
```
Dragging an object: while `input.down('fire')` set `entity.pos` to `[p.worldX, p.worldY, z]`.

## Buttons and UI on a small screen
* UI `anchor`s keep things in corners at any screen size; use `size` in pixels that are readable (at least 18 for text, 48 for tap targets).
* Avoid *hover* effects; there is no hover on touch.
* The UI layer is HTML: it scrolls and zooms like a web page unless the game page prevents it (Nord does for the canvas).

## Screen size and orientation
`nord.project.json` ▸ `display`: `{ "width": 960, "height": 540, "scale": "fit" }` letterboxes the game inside any window. Design for one fixed size and let `fit` scale it. For portrait games use `540 × 960`. Read the real window size with `window.innerWidth / innerHeight` if you must adapt layouts.

## Ship it

**Terminal** (in the folder that contains your project folder):
```bash
nord build --target web-2d --pwa --single-file      # an installable offline web app in one file
nord build --target web-2d --zip --host itch        # a zip for itch.io
```
Open the page on the phone (same Wi-Fi: `nord serve --lan` prints a link with a token) and "Add to Home Screen". See [Export](export.html) and [Mobile controls](mobile-controls.html).

## Performance on phones
Fewer objects (pool bullets, [Spawning](ex-spawn-destroy.html)), small textures, no heavy post-processing, 30 fps is fine. Test with the profiler ([Debugging](ex-debug-tools.html)).

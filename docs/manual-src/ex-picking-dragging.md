---
title: 32 · Clicking, hovering and dragging objects
section: Examples
order: 32
summary: Select things with the mouse or a finger, hover highlights, drag and drop, drag-select boxes, and telling clicks on the UI from clicks on the world.
---

**Goal:** click a unit to select it, hover to highlight, drag a card or an item across the screen.

## Pointer basics
`this.input.pointer` is `{ x, y, worldX, worldY, down }`: screen pixels and world coordinates (the camera is already applied). A mouse button or a finger is the action you bind to `Mouse0` (`"fire": ["Mouse0"]`), so `pressed / down / released` work for both.

## Which object is under the pointer? (Unity: `Physics2D.OverlapPoint` / `RaycastHit2D`)
For 2D, the easy way is a small helper that tests the object's size:
```js
// scripts/pick.js : export a function you can import everywhere
export function hit(entity, x, y) {
  const s = entity.getComponent('sprite')?.data.size ?? [32, 32];
  const w = s[0] * entity.scale[0], h = s[1] * entity.scale[1];
  return Math.abs(x - entity.pos[0]) <= w / 2 && Math.abs(y - entity.pos[1]) <= h / 2;
}
export function pickAt(scene, x, y, tag) {                     // the top-most tagged object under (x, y)
  return scene.findByTag(tag).filter((e) => e.enabled && hit(e, x, y)).sort((a, b) => b.pos[2] - a.pos[2])[0] ?? null;
}
```
Sprites are centred on their position (origin 0.5); rotated objects need a rotated test. The physics alternative: `this.physics.overlapBox(p.worldX, p.worldY, 2, 2)` returns every body at the point (only objects with colliders).

## Click to select
```js
import { MonoBehaviour } from 'nord';
import { pickAt } from './pick.js';

export default class Selector extends MonoBehaviour {
  Update() {
    const p = this.input.pointer;
    if (!this.input.pressed('fire')) return;
    const unit = pickAt(this.scene, p.worldX, p.worldY, 'unit');
    if (this.selected && this.selected !== unit) this.selected.set('sprite', 'tint', '#ffffff');   // deselect
    this.selected = unit;
    if (unit) { unit.set('sprite', 'tint', '#ffe066'); this.game.events.emit('selected', { unit }); }
  }
}
```
Right-click to command: bind `"command": ["Mouse2"]` and `if (this.input.pressed('command') && this.selected) this.selected.callScripts('moveTo', p.worldX, p.worldY)`. (Library `click-move.js` does click-to-move; `click-move3d.js` in 3D.)

## Hover
```js
Update() {
  const p = this.input.pointer, over = pickAt(this.scene, p.worldX, p.worldY, 'button');
  if (over !== this.over) { this.over?.set('sprite', 'tint', '#ffffff'); over?.set('sprite', 'tint', '#ccddff'); this.over = over; }
}
```
Fine for a mouse; touch has no hover.

## Drag and drop
```js
Update() {
  const p = this.input.pointer;
  if (this.input.pressed('fire')) {
    this.drag = pickAt(this.scene, p.worldX, p.worldY, 'card');
    if (this.drag) { this.off = [this.drag.pos[0] - p.worldX, this.drag.pos[1] - p.worldY]; this.drag.pos = [this.drag.pos[0], this.drag.pos[1], 50]; }   // bring to front
  }
  if (this.drag && this.input.down('fire')) this.drag.pos = [p.worldX + this.off[0], p.worldY + this.off[1], 50];
  if (this.drag && this.input.released('fire')) {
    const slot = pickAt(this.scene, p.worldX, p.worldY, 'slot');              // dropped on a slot?
    if (slot) this.drag.pos = [slot.pos[0], slot.pos[1], 5]; else this.drag.pos = [...this.home];
    this.drag = null;
  }
}
```
The library `physics-drag.js` drags *physics* bodies with a spring. A complete card game: template `card-game`.

## Drag-select rectangle
```js
if (this.input.pressed('fire')) this.start = [p.worldX, p.worldY];
if (this.input.released('fire') && this.start) {
  const [x0, x1] = [this.start[0], p.worldX].sort((a, b) => a - b), [y0, y1] = [this.start[1], p.worldY].sort((a, b) => a - b);
  const picked = this.scene.findByTag('unit').filter((u) => u.pos[0] >= x0 && u.pos[0] <= x1 && u.pos[1] >= y0 && u.pos[1] <= y1);
  this.start = null;
}
```

## UI clicks vs world clicks
UI elements (buttons, labels) are HTML on top of the game: a click on a button never reaches the game's pointer state through the canvas, but the key `Mouse0` is also set by `pointerdown` on the canvas only, so a button click does **not** count as a world click. If you make an area that must block clicks (an inventory panel), put it in a UI screen: it is above the canvas.

## 3D picking
```js
const hit = this.physics.raycast(camPos, targetPos, { ignore: this.entity });   // ray between two world points
if (hit) hit.entity.emit('clicked');
```
Library `click-move3d.js` and `interact-ray.js` already convert the mouse / the crosshair to a ray.

## Touch
Same code: a finger down is `Mouse0`. Make hit areas generous (at least 48 px) and avoid hover.

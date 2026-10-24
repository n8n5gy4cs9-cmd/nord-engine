---
title: 3 · Finding objects and talking to scripts
section: Examples
order: 3
summary: Find, tags, GetComponent, calling methods on other scripts, parents and children.
---

**Goal:** a turret finds the player, reads their health and tells them to take damage.

## Finding things
| Unity | Nord (native) | Nord (MonoBehaviour) |
|---|---|---|
| `GameObject.Find("Player")` | `this.scene.find('Player')` | `this.Find('Player')` |
| `GameObject.FindWithTag("enemy")` | `this.scene.findByTag('enemy')[0]` | `this.FindWithTag('enemy')` |
| `FindGameObjectsWithTag` | `this.scene.findByTag('enemy')` | `this.FindGameObjectsWithTag('enemy')` |
| `FindObjectOfType<Health>()` | loop `scene.all()` + `getScript(Health)` | `this.FindObjectOfType(Health)` |
| `transform.Find("Child")` | `this.entity.find('Child')` | same |
| `other.CompareTag("x")` | `other.hasTag('x')` | `this.CompareTag('x')` (own tag) |

`scene.find()` returns `null` when nothing matches: check before using. Names are the object names in the Hierarchy; **tags** are the fast, safe way to find groups (Inspector ▸ Tag).

```js
start() {
  this.player = this.scene.find('Player');          // do it once in start(), not every frame
}
update(dt) {
  if (!this.player || this.player.destroyed) return; // the object may have been destroyed
  const d = Math.hypot(this.player.pos[0] - this.entity.pos[0], this.player.pos[1] - this.entity.pos[1]);
}
```

## Components and other scripts
Components (sprite, rigidbody, collider, …) are data on the entity; scripts are classes.
```cs
// Unity
var health = target.GetComponent<Health>();
health.TakeDamage(10);
var sr = GetComponent<SpriteRenderer>(); sr.color = Color.red;
```
```js
// Nord
import Health from './health.js';                      // the other script's class (default export)
const health = target.getScript(Health);               // null when the object has no Health script
health?.takeDamage(10);

this.entity.getComponent('sprite');                    // component data, or null
this.entity.set('sprite', 'tint', '#ff0000');          // change a component field at runtime
this.entity.set('text', 'text', 'Hello');              // a text component's string
```
Importing the class from its file (`import Health from './health.js'`) is the Nord way of "knowing the type". Paths are relative to the importing file.

## A complete example: damage and health
`scripts/health.js`
```js
import { NordScript } from 'nord';
export default class Health extends NordScript {
  static attributes = { max: { type: 'number', default: 100 } };
  init() { this.hp = this.attrs.max; }
  takeDamage(n) {
    this.hp = Math.max(0, this.hp - n);
    this.entity.emit('hp', { hp: this.hp, max: this.attrs.max });  // anyone can listen (see Events)
    if (this.hp === 0) { this.entity.emit('died'); this.entity.destroy(); }
  }
}
```
`scripts/turret.js`
```js
import { NordScript } from 'nord';
import Health from './health.js';

export default class Turret extends NordScript {
  static attributes = { range: { type: 'number', default: 250 }, damage: { type: 'number', default: 5 }, every: { type: 'number', default: 1 } };
  start() { this.player = this.scene.find('Player'); this.cool = 0; }
  update(dt) {
    this.cool -= dt;
    const p = this.player;
    if (!p || p.destroyed || this.cool > 0) return;
    const d = Math.hypot(p.pos[0] - this.entity.pos[0], p.pos[1] - this.entity.pos[1]);
    if (d < this.attrs.range) { p.getScript(Health)?.takeDamage(this.attrs.damage); this.cool = this.attrs.every; }
  }
}
```

## Calling a method by name (SendMessage)
```js
other.callScripts('takeDamage', 10);     // calls takeDamage(10) on every script of `other` that has it
```
Unity's `SendMessage`. Handy, but a typed `getScript(Class)` call is easier to refactor.

## Parent and children
```js
this.entity.parent;                       // null for a root object
this.entity.children;                     // array of child entities
this.entity.find('Muzzle');               // child by name (searches all descendants)
for (const e of this.entity.all()) {}     // this object and all descendants
```
Child positions are relative to the parent, like `localPosition`; `entity.worldPos` gives the absolute position.

## Enable / disable
```js
other.enabled = false;        // SetActive(false): hidden, scripts stop, onDisable is called
other.tags.includes('boss');  // tags are a plain array
```

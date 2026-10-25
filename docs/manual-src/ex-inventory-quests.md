---
title: 24 · Inventory, items and quests
section: Examples
order: 24
summary: Item data in JSON, a stacking inventory, a grid UI, equipment and a quest log driven by events.
---

**Goal:** collect keys and potions, show them in a grid, equip a sword, finish a "collect 5 coins" quest.

## The ready-made pieces (library)
| Script | What it gives you |
|---|---|
| `inventory.js` | stacking slots, `add / remove / has / count`, equip slots, optional save under a key; emits `inventory` |
| `ui-inventory.js` | the toggleable grid (action `inventory`, default key I) with tooltips; click to equip |
| `quests.js` | quests as `{ id, title, goal: { event, count } }` driven by global events; emits `quest:update`, `quest:done` |
| `pickup.js` | collectibles: score, heal, speed, shield; magnet and bob |

Put `inventory.js` and `ui-inventory.js` on the Player, add an `inventory` action to `nord.project.json`.

## Items as data
`data/items.json`
```json
{ "key":    { "id": "key",    "name": "Brass key", "max": 1 },
  "potion": { "id": "potion", "name": "Potion",    "max": 9 },
  "sword":  { "id": "sword",  "name": "Iron sword", "slot": "weapon", "damage": 3 } }
```
A pick-up that gives an item:

**File: `scripts/Chest.js`** (new file, the whole file; it goes on the pick-up prefab)
```js
import { MonoBehaviour, ScriptableObject } from 'nord';
import Inventory from './inventory.js';          // the library script (copied into scripts/)

export default class ItemPickup extends MonoBehaviour {
  static attributes = { item: { type: 'string', default: 'potion' }, count: { type: 'int', default: 1 } };
  async OnTriggerEnter(other) {
    if (!other.hasTag('player')) return;
    const items = await ScriptableObject.Load('data/items.json');
    const left = other.getScript(Inventory).add(items[this.attrs.item], this.attrs.count);   // returns how many did NOT fit
    if (left === 0) this.Destroy();
  }
}
```
Use / count / equip:

**File: your script, for example `scripts/Shop.js`** (inside a method, after `Start()` has found the player)
```js
const inv = player.getScript(Inventory);
inv.has('key');               // true when at least 1 key (has(id, n = 1))
inv.count('potion');          // how many in all stacks
inv.remove('potion', 1);      // false when there are not enough
inv.equip(slotIndex);         // moves a slot's item (needs "slot") into inv.equipped[slot]
this.game.events.on('inventory', ({ items, equipped }) => this.refresh(items));   // redraw when it changes (a global event)
this.entity.on('equip', (item) => {});                                           // on the inventory's object
```
`items` is an array of slots (`null` or `{ id, name, n, … }`).

## Your own tiny inventory (Singleton)

**File: `scripts/Inventory.js`** (new file, the whole file; put the script on the player or on an empty `Inventory` object)
```js
import { Singleton } from 'nord';
export default class Bag extends Singleton {
  static persistent = true;
  Awake() { this.items = {}; }
  Add(id, n = 1) { this.items[id] = (this.items[id] ?? 0) + n; this.game.events.emit('bag', this.items); }
  Has(id, n = 1) { return (this.items[id] ?? 0) >= n; }
  Take(id, n = 1) { if (!this.Has(id, n)) return false; this.items[id] -= n; this.game.events.emit('bag', this.items); return true; }
}
// a door:  if (Bag.instance.Take('key')) this.entity.enabled = false;
```

## A hotbar HUD from code

**File: `scripts/HotbarHud.js`** (inside `Start()` of a HUD script; create the labels before this call)
```js
this.game.events.on('bag', (items) => {
  this.ui.clear('bag');
  Object.entries(items).filter(([, n]) => n > 0).forEach(([id, n], i) =>
    this.ui.label(`${id} x${n}`, { screen: 'bag', anchor: 'bl', x: 16 + i * 110, y: 12, size: 18 }));
  this.ui.show('bag');
});
```

## Quests

**In the Inspector** of the object that has `quests.js`, the `quests` field (an array of events to count). As text it is stored like this:
```js
// the `quests` attribute of quests.js (Inspector, an array): events to count
[{ "id": "coins", "title": "Collect 5 coins", "goal": { "event": "coin", "count": 5 } }]
```
Any script advances it by emitting that global event (`this.game.events.emit('coin')`). React when it completes:

**File: `scripts/Gate.js`** (inside `Start()`, subscribing once; keep the returned function and call it in `OnDestroy()`)
```js
this.game.events.on('quest:done', ({ id }) => { if (id === 'coins') this.scene.find('Gate').enabled = false; });
```
Quest progress is saved in the current save slot.

## Equipment changes stats

**File: your script, for example `scripts/Player.js`** (inside the method that computes damage, after `inv` is the player's `Inventory`)
```js
const weapon = inv.equipped.weapon;                       // { id: 'sword', damage: 3, ... } or undefined
const damage = 1 + (weapon?.damage ?? 0);
target.emit('damage', { amount: damage, from: this.entity });
```

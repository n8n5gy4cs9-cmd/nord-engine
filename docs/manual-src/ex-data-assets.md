---
title: 14 · Data assets (ScriptableObject)
section: Examples
order: 14
summary: Keep items, enemy stats and levels as JSON files that scripts load: the Nord version of ScriptableObjects.
---

**Goal:** define swords and potions in one file and use them from any script.

## Unity (C#)
```cs
[CreateAssetMenu] public class ItemData : ScriptableObject { public string title; public int damage; public Sprite icon; }
```

## Nord: a JSON file
`data/items.json` (any path you like; plain JSON)
```json
{
  "sword":  { "title": "Iron sword", "damage": 5,  "icon": "assets/ui/sword.png", "price": 40 },
  "potion": { "title": "Potion",     "heal": 25,    "icon": "assets/ui/potion.png", "price": 10 }
}
```
Load it:

**File: `scripts/Shop.js`** (new file, the whole file)
```js
import { MonoBehaviour, ScriptableObject } from 'nord';

export default class Shop extends MonoBehaviour {
  async Start() {
    this.items = await ScriptableObject.Load('data/items.json');   // loaded once, shared by everyone
    for (const [id, item] of Object.entries(this.items)) this.log(id, item.title, item.price);
  }
}
```
Native: `const data = await this.game.loadJSON('data/items.json');` (each call loads again; cache it yourself or use `ScriptableObject.Load`). `ScriptableObject.Clear()` empties the cache (useful while editing in Play mode).

## Using the data

**File: `scripts/Shop.js`** (add this method to the class above)
```js
buy(id) {
  const item = this.items[id];
  if (GameManager.instance.Get('coins', 0) < item.price) return false;
  GameManager.instance.Set('coins', GameManager.instance.Get('coins', 0) - item.price);
  this.scene.find('Player').callScripts('equip', item);
  return true;
}
```

## Share one data object between scripts

**File: `data/enemies.json`** (new file) and the script that reads it:
```js
// data/enemies.json: { "slime": { "hp": 10, "speed": 40 }, "bat": { "hp": 4, "speed": 90 } }
async Start() {
  const defs = await ScriptableObject.Load('data/enemies.json');
  const d = defs[this.attrs.kind];                    // attribute: kind = "slime"
  this.hp = d.hp; this.speed = d.speed;
}
```
A designer edits a number in the JSON, no code change. Add an Inspector attribute `kind` (enum or string) to choose which row an enemy uses.

## Level data as JSON

**File: your script, for example `scripts/Level.js`** (inside `Start()`; the comment shows the file it reads)
```js
const level = await ScriptableObject.Load('data/level1.json');   // { "enemies": [["slime", 100, 40], ...] }
for (const [kind, x, y] of level.enemies)
  await this.scene.spawn('prefabs/enemy.prefab.json', { pos: [x, y, 2], overrides: { scripts: { 0: { attributes: { kind } } } } });
```

## Data inside the Inspector instead
For small things, an `array` / `curve` attribute is enough:

**File: your script, for example `scripts/Spawner.js`** (inside the class, above `Start()`)
```js
static attributes = { waves: { type: 'array', default: [3, 5, 8] }, damageCurve: { type: 'curve' } };
```

## Validating
The project checker (`nord check`, or the Console's *Validate project*) warns about files that scenes reference but are missing. Keep data files valid JSON: the editor's code tab marks syntax errors as you type.

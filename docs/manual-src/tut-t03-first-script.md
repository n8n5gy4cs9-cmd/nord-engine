---
title: T03 Your first script
section: Tutorials
order: 3
summary: Attributes, lifecycle, events, hot reload.
---
**Project:** any 2D project. Library reference: `spin.js`.

1. Create `scripts/pulse.js`:
```js
import { NordScript } from 'nord';
export default class Pulse extends NordScript {
  static attributes = {
    amount: { type: 'number', default: 0.2, min: 0, max: 1 },
    rate:   { type: 'number', default: 3 },
  };
  start() { this.base = [...this.entity.scale]; }
  update() {
    const k = 1 + Math.sin(this.time.elapsed * this.attrs.rate) * this.attrs.amount;
    this.entity.scale = this.base.map((v) => v * k);
  }
  onHotReload() { this.entity.scale = this.base; }
}
```
2. Attach it to a sprite. While the game **runs**, edit `amount` to `0.5` in the file and save: the object keeps pulsing — **hot reload** swapped the code without restarting.
3. Add a message: in `start()` write `this.events.emit('hello', this.entity.name)` and listen in another script with `this.events.on('hello', (n) => console.log('hi', n))`. Look at the Console tab.
4. Break it on purpose (remove a bracket): the game keeps its last good code and the error shows with `file:line`.

Concepts: [Scripting](scripting.html). **Next:** [T04 Platformer from template](tut-t04-platformer.html).

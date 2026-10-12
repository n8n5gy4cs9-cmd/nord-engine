---
title: T13 Save & load
section: Tutorials
order: 13
summary: Persistent data, slots, high scores.
---
**Project:** `examples/idle-clicker` (autosave + offline earnings).

```js
// settings & scores
this.save.set('best', 120);
const best = this.save.get('best', 0);

// slots
this.save.slot(2).set('hero', { x: 10, y: 4, hp: 3 });
if (this.save.has(2)) { const h = this.save.slot(2).get('hero'); }
```
Try it here (a throw-away in-memory store):
```nord-live
const save = new nord.Save('demo', { storage: new nord.MemoryStorage() });
save.set('best', 120);
save.slot(2).set('hero', { hp: 3 });
log(save.slot(1).get('best'), save.slot(2).get('hero'), save.has(3));
```
* Data is JSON in localStorage under `nord:<project id>:slot<n>`, with a `version`; pass `migrate(data, fromVersion)` to `new Save` when your format changes.
* Library `save-slots.js`: tag entities `persist`, then `events.emit('game:save', 1)` / `'game:load'`.
* Rust tier: use the platform's storage via egui/macroquad APIs (not covered by `Ctx` yet).

**Next:** [T14 Export & host](tut-t14-export-host.html).

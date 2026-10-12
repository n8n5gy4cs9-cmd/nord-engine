---
title: T18 Writing library snippets
section: Tutorials
order: 18
summary: Create a reusable script, document it, add it to the index.
---
1. Write the script in `library/scripts/fx-flash.js`:
```js
// @nord {"id":"fx.flash","title":"Flash on damage","category":"fx","tier":["2d"],"tags":["damage","feedback"],"description":"Tints the sprite white briefly when the entity receives 'damage'."}
import { NordScript } from 'nord';

export default class Flash extends NordScript {
  static attributes = { time: { type: 'number', default: 0.08, min: 0 }, color: { type: 'color', default: '#ffffff' } };
  start() { this.off = this.entity.on('damage', () => { this.entity.set('sprite', 'tint', this.attrs.color); this.after(this.attrs.time, () => this.entity.set('sprite', 'tint', '#ffffff')); }); }
  onDestroy() { this.off?.(); }
}
```
2. Rules of thumb: small, event-driven (`entity.on` / `events.on`), clean up in `onDestroy`, expose tweakable numbers as attributes, work for 2D and 3D when feasible.
3. Run `node tools/build-library-index.mjs` — the script appears in the editor's Library tab and the [catalog](library-catalog.html).
4. Test it in an example (`node tools/smoke-examples.mjs <id>`) and add a line to `docs/CHANGELOG.md`.

That's the end of the tutorial track — see the [Cookbook](cookbook.html) for more recipes.

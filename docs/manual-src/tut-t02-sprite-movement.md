---
title: T02 Sprite & movement
section: Tutorials
order: 2
summary: Show a sprite and move it with the keyboard using actions.
---
**Project:** `nord new walker -t topdown-adventure` (look at `examples/topdown` for the finished version).

1. Drag `assets/sprites/hero.png` from the Assets panel into the viewport: an entity with a [`sprite`](component-sprite.html) appears. Name it `Player`, add the tag `player`.
2. Open `nord.project.json` → `input.actions` and make sure `left`, `right`, `up`, `down` exist (templates already have them).
3. Create `scripts/walk.js`:
```js
import { NordScript } from 'nord';
export default class Walk extends NordScript {
  static attributes = { speed: { type: 'number', default: 120 } };
  update(dt) {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    this.entity.pos = [this.entity.pos[0] + x * this.attrs.speed * dt,
                       this.entity.pos[1] + y * this.attrs.speed * dt, 0];
  }
}
```
4. Select `Player`, **+ Add script → walk.js**. Play, then change `speed` in the Inspector.
5. Multiplying by `dt` makes movement frame-rate independent. `input.vec` returns a normalised vector, so diagonals aren't faster.

::: dummies
`dt` is the time one picture took to draw. Slow computer: big dt, small steps more often skipped; fast computer: small dt. Speed × dt = distance this frame, always the same overall speed.
:::
**Next:** [T03 Your first script](tut-t03-first-script.html).

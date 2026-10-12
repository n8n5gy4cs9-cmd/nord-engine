---
title: T12 Enemy AI
section: Tutorials
order: 12
summary: Patrol, chase, state machines, waves.
---
**Project:** `examples/topdown` (bats), `examples/tower-defense` (waves).

1. Patrol: `ai-patrol.js` walks between two points; set `distance` and `speed`.
2. Chase: `ai-chase.js` — attributes `target` (a **tag**, default `player`), `sight`, `lose`, `speed`, `keepDistance`. The enemy chases when the target comes within `sight` and gives up beyond `lose`.
3. Combine states with `ai-fsm.js`, or build trees with `ai-behaviour-tree.js`.
4. Damage: contact scripts emit `entity.emit('damage', { amount: 1, from })`; `health.js` handles hit points and invulnerability frames.
5. Waves: `wave-spawner.js` (`prefabs`, `base`, `growth`, `waves`) emits `wave:start`, `wave:clear`, `wave:all-done`.
6. Pathfinding on grids: `ai-astar.js`.

**Next:** [T13 Save & load](tut-t13-save-load.html).

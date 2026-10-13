# Red Front 2026 — guide

> **Press `F1` (or `H`) in the game for the in-game help.**

Red Alert-style skirmish on a **procedural map** (new seed every launch, `?seed=123` to repeat one). You are the Allies (blue, bottom-left); the Soviets (red, top-right) have a full base and a harvester.
**Win:** destroy every Soviet structure. **Lose:** all your structures fall.

## Play
* You start with a Construction Yard, Power Plant, Barracks, War Factory, Refinery, a Gun Turret, a harvester, 5 infantry and 2 light tanks, **$2500**.
* Train units from the sidebar (click an icon or press `1`–`5`; Barracks → infantry, War Factory → tanks/harvester). Credits come from **ore** — your harvester mines the gold fields and unloads at the Refinery automatically. Build more harvesters early.
* **Left-drag** = select · **right-click** = move / attack · **A** then click = attack-move · **S** stop · **Space** jump to base · click the minimap to scroll · arrows or screen edge scroll.
* No power plant → production at half speed. Rocket infantry are good against tanks, rifles against infantry; tanks are tough against bullets.
* The computer builds units, harvests, defends and attacks in growing waves. `difficulty` (Inspector) scales its income.

## Where the code is
| File | What |
|---|---|
| `scripts/redfront.js` | title + match controller |
| `scripts/xk/rts.js` | **pure RTS sim** (A*, harvester loop, production queues, combat, AI). `node tools/rts-sim.mjs redfront` runs it headless |
| `scripts/xk/rtsview.js` | view: map, sidebar, minimap, selection, effects |
| `scripts/xk/help.js` | F1 help pages |
| `scripts/xk/base.js`, `pixeltext.js` | shared helpers (fonts, bevelled panels) |
`rts.js` and `rtsview.js` are the same files as in X-KOM 2026 (single source: `tools/examples/xkom/scripts/xk/`, copied by `game.mjs`). Tune stats in `U` / `B` at the top of `rts.js`.

## Origins and licences
Costs, HP, speeds and ranges adapted from OpenRA's Red Alert rules (GPL-3, `mods/ra/rules`); pathfinding follows OpenRA's grid A*; rules reference: EA CnC Remastered source (GPL-3). No art/sound from those projects — new hand-pixelled sprites, synthesized audio. See `THIRD_PARTY.md`.
## Honest limits
No fog of war, no base building (pre-built bases), no naval/air units, units face left/right only. Headless-verified only.

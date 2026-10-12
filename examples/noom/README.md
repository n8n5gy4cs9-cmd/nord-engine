# Noom — Crypt of the Baron
A one-level first-person shooter proof of concept: **Doom's gameplay in a Barony-style crypt.** Fight skeleton archers, goblins and imps through the Hall of Columns,
grab the blunderbuss, find the **blue key**, open the blue door and kill the **Baron of Barony**, then step through the exit gate. Blow up the powder kegs (they chain!),
find the secret alcove behind the start crypt's north wall (look for the mossy brick; press Space/E on it).

**Controls** — WASD move, mouse or ←/→ turn, Shift run, click / Ctrl / F fire, Space or E use (doors, secret walls, exit gate), 1 mace, 2 blunderbuss, Tab automap, R restart, Esc pause.

**Ported from DOOM** (id Software, GPL-2.0, https://github.com/id-software/doom): the `P_Random` table, monster think logic (`A_Look`, `A_Chase`, `P_NewChaseDir`, `P_Move`, melee/missile range rolls, pain chance and threshold),
mobjinfo stats (Imp, Baron of Hell, Zombieman, Demon), attack damage formulas, shotgun spread (7 pellets, 5×(1-3)), armor absorption (⅓), barrel blast radius (`P_RadiusAttack`), sound-wakes-monsters (`P_NoiseAlert`),
Doom's 35 Hz tic rate and door timing. **From Barony** (TurningWheel/Barony, GPL-3.0): the setting and monster roster (skeletons, goblins, crypt/dungeon look); no Barony code or art is used — Barony's code is a different engine (SDL/OpenGL, voxels).
Simplified: grid-based map instead of BSP/linedefs, front-facing sprites (no 8-way rotations), one hand-designed level, no infighting.
All **art is original and hand-drawn** — see `assets.md` to replace it. Derived from Doom code, this example is **GPL-2.0-or-later**.

Code: `scripts/noom.js` (glue), `scripts/noom/sim.js` (rules), `render.js` (Babylon level + billboards), `hud.js` (canvas HUD), `level.js` (the level). Headless test: `node tools/noom-sim.mjs`.

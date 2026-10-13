# X-KOM 2026 — guide

> **In the game press `F1` (or `H`) at any time for the full multi-page help** (all modes, controls, rules, tips; the game pauses). This file is the same information plus code/licence notes.

A pragmatic proof of concept that is a *whole* game: an X-COM-style campaign with a **Red Alert RTS** boss operation.

## Campaign loop
1. **Geoscape** (rotatable textured globe + HQ regional map). Three mission sites appear. Pick one (click, or press `1` `2` `3`). `B` opens the **Base**.
2. **Interception** (skippable): radar animation → `ENTER` engage (Star Fox-style shooter), `SPACE` auto-resolve, `ESC` skip. Each shot-down ship = **one fewer alien** on the ground and +$300.
3. **Tactical mission**: procedural farm + crashed UFO; 6 soldiers vs 4–8 aliens, turn-based with time units.
4. Back to the Geoscape: **alien presence** rises (+10, +5 per site you ignored) and drops when you win (−8…−14). At **100 %** → siren → **Operation: Hive Strike** (RTS): destroy the Alien Hive with your base force. Win → presence resets to 20 %. Lose → the war is lost.
5. **Win the war** by killing enough aliens (default 40, tactical + RTS kills combined). Lose when the base is overrun.
Funds ($100 per alien killed, $500 mission bonus, $2000 hive) buy **research** in the Base.

## Controls
**Geoscape** — arrows rotate the globe · `+`/`-` zoom · `Z` toggles the HQ regional map · `G` returns to the globe · `B` opens Base. Buttons do the same. Click a visible map contact or the numbered contact list (all three remain available even on the far side), or press `1`/`2`/`3`, to launch interception. HQ remains centered in regional mode; zoom magnifies the existing world raster.
**Tactical** — click soldier = select · click a blue tile = walk (TU cost shown top right) · click a visible alien = fire · `1/2/3` SNAP / AIMED / AUTO (or the buttons, right-click cycles) · `Tab/Space` next soldier · `Enter` end turn · arrows scroll smoothly. Walking alternates two poses; short moves leave the camera still, while edge moves pan only enough to stay visible. Ground and movement overlays stay below units; walls/trees still obscure units correctly. Unseen tiles are black (fog of war); you only see what your soldiers see.
*Rules you should know (they come from OpenXcom):* walking costs 4 TU (diagonal 6); a shot costs a % of max TU (snap 25 %, aimed 80 %, auto 35 % for 3 shots); hit chance = firing × weapon accuracy; damage = random 0–200 % of power minus armour. **Reaction fire:** if you end a turn with TU left, soldiers with TU shoot at aliens that move into view — keep some TU back. Rushing in kills your squad.
**Interception** — radar first: `Enter` engage, `Space` auto-resolve, `Esc` skip. Shooter: mouse or arrows move (the jet banks) · `Space` / hold mouse button = lasers · `X` / right-click = homing missile · `Shift`, `Z` or double-tap left/right = **barrel roll** (invulnerable, **reflects enemy shots** back at them) · pick up **P** (weapon level 1→3: twin → triple → five-way), **M** (+3 missiles), **S** (+1 shield). Waves of drones, diving darts and ground turrets, then the UFO boss (2 phases). Kill ≥ 8 fighters for a bonus second ship. `Esc` skips.
**RTS** — left-drag = select · right-click = move/attack · `A` then click = attack-move · `S` stop · `Space` jump to base · sidebar icons (or `1`–`5`) train units, click the minimap to scroll · arrows or screen edge scroll. Harvesters mine automatically; no power plant = production at half speed.

## How to play each mode (short)
1. **Start**: Enter on the title. You are in the geoscape. Press `B` once and start a research project (ALIEN ALLOYS is a good first: it makes the later RTS easier).
2. **Pick a site** (1/2/3). Radar appears — press `Enter` to fly the shooter yourself or `Esc` to skip to the ground.
3. **Tactical**: move your 6 soldiers up to the UFO in short hops (keep TU back for reaction fire), shoot with AIMED at range / SNAP when close, kill every alien. Don't line soldiers up in the open.
4. After every mission watch ALIEN PRESENCE (geoscape, bottom left). At 100 % the siren sounds → **Hive Strike**: train riflemen/tanks from the sidebar, keep your harvester alive, then attack the hive as one big group (`A` + click). Destroying it resets presence to 20 %.
5. Reach 40 total alien kills to win the war.

## URL helpers (testing)
`?start=geo|base|air|tac|rts` jump to a screen · `?seed=123` fixed campaign seed. Inspector attributes: seed, goal (aliens to kill), presence (start %).

## Where the code is
| File | What |
|---|---|
| `scripts/xk/geoview.js` | CPU canvas globe projection, horizon-clipped markers and HQ regional zoom (reuses world.png; no new 3D dependency) |
| `scripts/xkom.js` | campaign controller: title, geoscape, base, endings, mode routing |
| `scripts/xk/tactical.js` | **pure rules** (map generator, TU, LOS, fog, shooting, reaction fire, alien AI) — `node tools/xk-sim.mjs` |
| `scripts/xk/tacview.js` | isometric view, HUD, replay of rule events as animation |
| `scripts/xk/rts.js` | **pure RTS sim** (A*, harvesting, production, combat, AI waves) — `node tools/rts-sim.mjs xkom` |
| `scripts/xk/rtsview.js` | RTS view (sidebar, minimap, selection, effects) |
| `scripts/xk/intercept.js` | radar + Star Fox/Raptor-style shooter (barrel roll, power-ups, missiles, boss) |
| `scripts/xk/research.js` | 7 techs and their effects |
| `scripts/xk/help.js` | the F1 help pages (edit the text here) |
| `scripts/xk/base.js` | shared helpers (HUD container, fonts, bevelled panels) |
Tuning: unit stats `U`/`B` in `rts.js`, weapons/races in `tactical.js`, techs in `research.js`, site sizes/relief in `xkom.js` (`SITE_TYPES`).

## Origins and licences
Ideas + numbers from OpenXcom (GPL-3: item/unit stats, TU costs, reaction fire), OpenRA (GPL-3: Red Alert unit/building cost, HP, speed; A* pathing idea) and the EA CnC Remastered source (GPL-3: reference for the RA rules). No art or sound from those projects is used — all pictures are new hand-pixelled sprites and all audio is synthesized. See `THIRD_PARTY.md`. The interception shooter takes only the *idea* of a short Star Fox-style action sequence; no code or assets from any Star Fox project.
## Honest limits
Single-level tactical maps (no stairs), no inventory/grenades/morale, RTS without fog of war and without building placement (base is pre-built), flat geoscape (no globe), headless-verified only (Chromium). See `docs/KNOWN_ISSUES.md`.

# X-KOM 2026 — guide

> **In the game press `F1` (or `H`) at any time for the full multi-page help** (all modes, controls, rules, tips; the game pauses). This file is the same information plus code/licence notes.

A compact playable campaign with research, procedural missions, escalating opposition, a Hive Strike and win/loss endings: an X-COM-style campaign with a **Red Alert RTS** boss operation.

## Campaign loop
1. **Geoscape** (rotatable textured globe + HQ regional map). Three persistent mission sites target six named towns. Pick one (click, or press `1` `2` `3`). `B` opens the **Base**.
2. **Interception** (skippable): radar animation → `ENTER` engage (Star Fox-style shooter), `SPACE` auto-resolve, `D` skip. Each shot-down ship = **one fewer alien** on the ground and +$300.
3. **Tactical mission**: procedural farm + crashed UFO; 6 soldiers vs 4–20 aliens, turn-based with time units.
4. Back to the Geoscape: **alien presence** rises with time and losses; victories reduce it (site relief −8…−14, plus +4 background war pressure). At **100 %** → siren → **Operation: Hive Strike** (RTS): destroy the Alien Hive with your base force. Win → presence resets to 20 %. Lose → the war is lost.
5. **Locate the source**: gather alien intel (default 40 tactical + RTS kills), research **ALIEN ALLOYS → LASER WEAPONS → ELERIUM POWER**, then launch **SOURCE RAID [F]** from HQ. Win this harder tactical mission to unlock **FINAL ASSAULT [F]**, a tougher RTS Hive battle. Destroy that final Hive to win the war. A failed source raid can be retried; losing a Hive operation ends the war. The current objective appears on the map.
Funds ($100 per alien killed, $500 mission bonus, $2000 hive) buy **research** in the Base.

## Music and sounds
Three music loops: `assets/audio/music/music_title.mp3` (title), `music_base.mp3` (globe/HQ/research/endings), `music_game.mp3` (radar/shooter/tactical/Hive Strike). The first touch/click (or key) dismisses the ready-made Nord audio gate and starts title music without leaving the title. The next Enter/click starts the campaign. The old LISTEN button is removed; the entry gate handles title audio. `assets.md` section 5 lists every music/SFX filename, when it plays, and replacement steps. Keep filenames/extensions, swap the audio, then Stop/Play or reload. For permanent repo changes edit `tools/examples/xkom/assets/audio/` before regenerating examples.

## Slow campaign clock and towns
The clock runs only on **Geoscape/HQ map and Base/research**, while the page is visible. **One waiting day = 90 seconds** of active campaign time. It pauses during title, interception, tactical/RTS missions, alerts/endings, help and the developer console. **P / Esc** opens the pause menu, which includes a strategic-clock toggle; the countdown and occupied-town count remain visible. No offline/background-tab catch-up.

Contacts persist when you switch between globe and Base. Initial contacts expire after **4, 5 and 6 waiting days** (first occupation after about six minutes). Ignoring a contact lets aliens occupy its town: **−$200 and +8 threat**. Occupied towns then cost **$50 and +1 extra threat per waiting day**; ordinary background pressure adds +1 threat/day. Ignored occupied-town raids reinforce aliens (+3 threat). Fresh contacts refill the three slots, and squad sizes grow with mission count and waiting days (capped at 20). Win a mission at an occupied town to liberate it. Research advances with waiting days as well as mission rewards. Mission-calendar jumps do not consume waiting deadlines.

At 100 threat, Hive Strike begins. A successful Hive Strike resets threat to 20%; town occupation remains until liberated. These towns are abstract campaign states on the existing world map; tactical maps remain procedural farm/UFO battlefields.

## Save, load and pause
**P / Esc** opens pause in the map, Base, radar/shooter, tactical and RTS modes. Resume, Save campaign, Load campaign, Export save, Import save, strategic-clock toggle and Return to title are available. The simulation, scene timers and walking tweens freeze while paused. Escape closes help/console first when one is open.

Saves use the engine's local browser storage, one campaign slot per project/site/device. The title offers **CONTINUE [Enter]** when a compatible unfinished save exists, plus **NEW CAMPAIGN [N]**; otherwise **BEGIN CAMPAIGN**. A new campaign starts when selected and replaces the previous save. Corrupt/obsolete saves are ignored. Completed/lost campaigns no longer offer Continue.

Strategic saves retain the seed, funds, squad experience, intel, mission counts, research/progress, towns/occupation, contacts and deadlines, countdown and final-phase progress. Checkpoints save before deployment, after missions, research choices and waiting days, and when hiding/leaving the page. **Combat Save/Load restores the last strategic checkpoint at HQ and restarts the operation**. This preserves interception bonuses already applied before ground deployment; unit positions, battle health, RTS cash/production and shooter positions are not serialized. No offline time catch-up. If browser storage is blocked/full, manual Save reports that failure. Clearing site data removes saves; export hosts have separate storage. **Export save** downloads `xkom-save.json` from the current strategic checkpoint (works even if browser storage is blocked). **Import save** chooses that JSON file, validates it before replacing the local slot, and resumes at HQ. Invalid, foreign, oversized or completed saves are rejected without replacing your campaign. Import needs writable browser storage. Keep exported files as backups or move them between devices/sites.

## Developer console
**F2** or **backtick** opens/closes it; **Escape** closes it; Up/Down browse typed history. Its command reference is **commands.txt** in this project folder. Commands are deliberately not listed in console help or game help. The console pauses live updates and the campaign clock while open.

## Controls
**Geoscape** — WASD or arrows rotate the globe · `+`/`-` zoom · `Z` toggles the HQ regional map · `G` returns to the globe · `B` opens Base. Buttons do the same. Click a visible map contact or the numbered contact list (all three remain available even on the far side), or press `1`/`2`/`3`, to launch interception. HQ remains centered in regional mode; zoom magnifies the existing world raster.
**Tactical** — click soldier = select · click a blue tile = walk (TU cost shown top right) · click a visible alien = fire · `1/2/3` SNAP / AIMED / AUTO (or the buttons, right-click cycles) · `Tab/Space` next soldier · `Enter` end turn · WASD/arrows or hover near a playfield edge to scroll smoothly. The bottom HUD does not trigger scrolling; hovering just above it scrolls down. Edge scrolling stops outside the canvas and during tactical action replay. Walking alternates two poses; short moves leave the camera still, while edge moves pan only enough to stay visible. Ground and movement overlays stay below units; walls/trees still obscure units correctly. Unseen tiles are black (fog of war); you only see what your soldiers see.
*Rules you should know (they come from OpenXcom):* walking costs 4 TU (diagonal 6); a shot costs a % of max TU (snap 25 %, aimed 80 %, auto 35 % for 3 shots); hit chance = firing × weapon accuracy; damage = random 0–200 % of power minus armour. **Reaction fire:** if you end a turn with TU left, soldiers with TU shoot at aliens that move into view — keep some TU back. Rushing in kills your squad.
**Interception** — radar first: `Enter` engage, `Space` auto-resolve, `D` skip. Shooter: mouse or arrows move (the jet banks) · `Space` / hold mouse button = lasers · `X` / right-click = homing missile · `Shift`, `Z` or double-tap left/right = **barrel roll** (invulnerable, **reflects enemy shots** back at them) · pick up **P** (weapon level 1→3: twin → triple → five-way), **M** (+3 missiles), **S** (+1 shield). Waves of drones, diving darts and ground turrets, then the UFO boss (2 phases). Kill ≥ 8 fighters for a bonus second ship. `D` skips.
**RTS** — left-drag = select · right-click = move/attack · `Q` then click = attack-move · `X` stop · `Space` jump to base · sidebar icons (or `1`–`5`) train units, click the minimap to scroll · WASD/arrows or playfield-edge hover scroll (including the map edge beside the sidebar). Sidebar/minimap/build buttons do not trigger edge scrolling; clicking the minimap intentionally jumps the camera. Harvesters mine automatically; no power plant = production at half speed.

## How to play each mode (short)
1. **Start**: Enter on the title. You are in the geoscape. Press `B` once and start a research project (ALIEN ALLOYS is a good first: it makes the later RTS easier).
2. **Pick a site** (1/2/3). Radar appears — press `Enter` to fly the shooter yourself or `D` to skip to the ground.
3. **Tactical**: move your 6 soldiers up to the UFO in short hops (keep TU back for reaction fire), shoot with AIMED at range / SNAP when close, kill every alien. Don't line soldiers up in the open.
4. Watch THREAT, contact deadlines and occupied towns on the geoscape. At 100 % the siren sounds → **Hive Strike**: train riflemen/tanks from the sidebar, keep your harvester alive, then attack the hive as one big group (`Q` + click). Destroying it resets presence to 20 %.
5. Reach 40 intel, finish Elerium research, then complete Source Raid and Final Assault [F].

## URL helpers (testing)
`?start=geo|base|air|tac|rts` jump to a screen · `?seed=123` fixed campaign seed. Inspector attributes: seed, goal (intel required to locate the source), presence (start %).

## Music tuning
Edit `tools/examples/xkom/scripts/music-config.js` for title/base/interception/tactical/RTS start offsets in seconds (decimals work) and `fadeInSeconds` (default 0.35 for a quick fade-in/crossfade). Regenerate with `node tools/gen_examples.mjs xkom redfront`, then reload. Radar-to-shooter and globe-to-base playback continues; tactical/RTS missions restart at their configured offsets. Songs loop the whole track.

## UI font tuning
Edit **`tools/examples/xkom/scripts/xk/ui-config.js`**, then run `node tools/gen_examples.mjs xkom redfront` and reload. `FONT_SIZES` owns body, button, heading, title, bitmap fallback/RTS, pause, note and console sizes, plus Red Front defaults. Canvas sizes are logical pixels (3× display zoom); DOM pause/console sizes are screen pixels. Existing per-label scales multiply the configured base size. Button labels center their visible pixels, so font ascent/descent padding cannot push the label up or down. Tactical TU/HP bars remain inside the inset status panel.

## Where the code is
| File | What |
|---|---|
| `scripts/xk/campaign.js` | campaign clock, contacts, objective phases and versioned checkpoints |
| `scripts/xk/pause.js` | pause overlay, save/load and first-level input consumption |
| `scripts/xk/geoview.js` | CPU canvas globe projection, horizon-clipped markers and HQ regional zoom (reuses world.png; no new 3D dependency) |
| `scripts/xkom.js` | campaign controller: title, geoscape, base, endings, mode routing |
| `scripts/xk/tactical.js` | **pure rules** (map generator, TU, LOS, fog, shooting, reaction fire, alien AI) — `node tools/xk-sim.mjs` |
| `scripts/xk/tacview.js` | isometric view, HUD, replay of rule events as animation |
| `scripts/xk/rts.js` | **pure RTS sim** (A*, harvesting, production, combat, AI waves) — `node tools/rts-sim.mjs xkom` |
| `scripts/xk/rtsview.js` | RTS view (sidebar, minimap, selection, effects) |
| `scripts/xk/intercept.js` | radar + Star Fox/Raptor-style shooter (barrel roll, power-ups, missiles, boss) |
| `scripts/xk/research.js` | 7 techs and their effects |
| `scripts/xk/help.js` | the F1 help pages (edit the text here) |
| `scripts/xk/ui-config.js` | all UI font sizes, shared with Red Front |
| `scripts/xk/base.js` | shared helpers (HUD container, fonts, bevelled panels) |
Tuning: unit stats `U`/`B` in `rts.js`, weapons/races in `tactical.js`, techs in `research.js`, site sizes/relief and waiting-day timing in `campaign.js`.

## Origins and licences
Ideas + numbers from OpenXcom (GPL-3: item/unit stats, TU costs, reaction fire), OpenRA (GPL-3: Red Alert unit/building cost, HP, speed; A* pathing idea) and the EA CnC Remastered source (GPL-3: reference for the RA rules). No art or sound from those projects is used — all pictures are new hand-pixelled sprites and all audio is synthesized. See `THIRD_PARTY.md`. The interception shooter takes only the *idea* of a short Star Fox-style action sequence; no code or assets from any Star Fox project.
## Honest limits
Single-level tactical maps (no stairs), no inventory/grenades/morale, RTS without fog of war and without building placement (base is pre-built), campaign checkpoint saves (combat restarts from HQ), headless-verified only (Chromium). See `docs/KNOWN_ISSUES.md`.

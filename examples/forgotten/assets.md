# Forgotten Wars — assets (how to replace them)

Every picture is **hand-pixelled** (one character = one pixel, typed in `tools/art/forgotten/*.mjs` in the engine repo and packed by `node tools/pixelart.mjs forgotten`; no image generation, no filters).
The PNGs in `assets/` are what the game loads — **replace a file at the same path with the same size and frame grid and the game uses it.** Everything is **16×16**, nearest-neighbour (`"filter":"nearest"`), shown at 2×.
Any pixel editor works (Aseprite, LibreSprite, Pixelorama, Piskel): keep the canvas size, paint, export PNG over the old file. The names → frame numbers are in each PNG's `.meta.json`.

## Pictures

| File | Size | Layout |
|---|---|---|
| `assets/tiles/terrain.png` | 256×48 | 16 columns × 3 rows of **16×16** tiles. Frame numbers: `plain 0, forest 1, mountain 2, sea1 3, sea2 4` (sea animates between the two), `shoal 5, bridgeH 6, bridgeV 7`, then **`road0…road15` = frames 8…23** and **`river0…river15` = frames 24…39** (neighbour masks: N=1, E=2, S=4, W=8 — e.g. `road5` is a vertical road, `road10` a horizontal one, `road15` a crossing; roads join cities/factories/bridges, rivers join sea/shoals/bridges), then properties: `city_none 40, city_ember 41, city_cobalt 42, factory_none 43, factory_ember 44, factory_cobalt 45, hq_ember 46, hq_cobalt 47`. Add terrain by appending frames and listing them in `terrain.png.meta.json`, then in `data.js` (`TERRAIN`, `LEGEND`, `MOVE`) and `buildTerrain()` in `forgotten.js`. |
| `assets/sprites/units.png` | 256×32 | **Two rows** (row 0 Ember, row 1 Cobalt), 16 frames per row: for each unit in this order — `infantry, mech, recon, tank, mdtank, artillery, antiair, copter` — **idle frame A, idle frame B** (the game alternates them every 0.4 s). Units face **right**; the game mirrors Cobalt's. Team colour is pre-painted, so a replacement sheet needs both rows. Add a unit: append two frames to each row (widen the sheet by 32 px), add its name to `units` in `units.png.meta.json` and `UNITS` / `BASE` / `BUILD_LIST` in `scripts/fw/data.js`. |
| `assets/ui/ui.png` | 128×16 (7 used) | cursor A, cursor B (gold corners, blinks), move-range tile (translucent blue), attack-range tile (translucent red), path dot, target reticle, "done" shade. Semi-transparent PNG pixels are fine here. |
| `assets/sprites/fx.png` | 128×16 (6 used) | `boom1…boom4` (explosion, played in order when a unit dies), `spark` (hit), `smoke`. |
| `assets/ui/icons.png` | 128×16 (4 used) | `coin 0, star 1, flag 2, heart 3` (the bottom bar shows `coin` and the terrain's defence `star`s). |
| `assets/ui/font.png` | 96×32 | bitmap font: ASCII 32…95 (space … underscore), 16 columns × 4 rows of **6×8** cells, white glyphs (tinted at run time); upper-case only. Shared with the other Nord pixel examples. |

Team colours (so you can recolour or add a third army): Ember `#8a1c10 #d83a1e #ff7a3c #ffc468`, Cobalt `#14307a #2e5fd0 #5f9af0 #b4d8ff` (dark, mid, light, highlight) — see `TEAMS` in `tools/art/forgotten/tiles.mjs`;
the unit/property grids use the letters `D M L H` for these four ramps, so re-colouring is one table.

## The map — `assets/maps/crossing.map`

Plain text. Lines starting `@` are notes. `U <owner> <unit> <x> <y>` places a starting unit. After the `---` line every character is one tile (all rows the same length, 20×14 here):

| char | meaning | char | meaning |
|---|---|---|---|
| `.` | plain | `=` | road |
| `f` | woods | `r` | river (impassable except air; crossed by bridges and shoals) |
| `m` | mountain | `s` | shoal (ford) |
| `~` | sea | `b` | bridge (orientation is picked automatically) |
| `c` | neutral city | `k` | neutral factory |
| `A` / `a` / `e` | Ember HQ / factory / city | `Z` / `z` / `x` | Cobalt HQ / factory / city |

Roads and rivers are auto-tiled from their neighbours, so just draw the line. Change the grid size freely — the view fits 20×14 tiles on screen today (see `GUIDE.md` for scrolling bigger maps).

## Sound (shared Nord placeholders — replace by file name)

`assets/audio/sfx/`: `click confirm error open hover whoosh hit shoot explosion_small coin pickup level_up win lose` (mono WAV) and `assets/audio/music/music_action.mp3` (looping). Which sound plays when: search for `sfx(` in `scripts/forgotten.js`
(select = `click`, menus = `open`/`hover`, moving = `whoosh`, attacks = `shoot`/`hit`, unit dies = `explosion_small`, capture = `pickup` then `level_up`, build = `coin`, end = `win`/`lose`).

## Re-packing the artwork

Edit the grids in `tools/art/forgotten/` (`tiles.mjs`, `buildings.mjs`, `units.mjs`, `ui.mjs`), run `node tools/pixelart.mjs forgotten --preview` (contact sheet in `target/art-preview/forgotten.png`), then `node tools/gen_examples.mjs forgotten`.
If you replace PNGs by hand instead, copy them into `tools/examples/forgotten/assets/` so re-generating keeps them.

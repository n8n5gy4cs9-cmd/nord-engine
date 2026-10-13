# X-KOM 2026 — assets (what each picture / sound is and how to replace it)

**Every picture is hand-pixelled** (one character = one pixel, typed as text in `tools/art/xkom/*.mjs` of the Nord Engine repo and packed into PNGs by `node tools/pixelart.mjs xkom`; no image generation, no filters).
**Sounds + music are synthesized** by `node tools/gen_xkom_audio.mjs` (tiny oscillator synth → WAV/MP3). Everything is *placeholder-quality but real* and meant to be swapped.

## How replacing works (read this first)
* The game loads files **by path**. Put your own file at the **same path**, with the **same pixel size and frame grid**, and the game uses it. No code change.
* A *spritesheet* is one PNG that holds several equal-size frames side by side (left→right, then top→bottom). The `*.png.meta.json` next to each PNG records `frameWidth`/`frameHeight` and, where useful, the frame names. **Frame number = position in the grid, counted from 0.** Example: a 160×16 sheet of 32×16 frames has 5 frames, numbered 0…4.
* Pixel art is shown with nearest-neighbour scaling at **3×** (the virtual screen is 320×200, the window 960×600). Don't anti-alias; export PNG with transparency.
* "Faces right" sprites are mirrored by the game for left. Team colours / alien colours are painted into the pixels.
* Any pixel editor works (Aseprite, LibreSprite, Pixelorama, Piskel). Keep the canvas size, paint, export PNG over the old file.
* Audio: `.wav` sfx and `.mp3` music in `assets/audio/…` — replace by name (any length; music loops).

## The game in 4 parts → which assets belong to which part
| Part | Screen | Script | Assets used |
|---|---|---|---|
| Title / Geoscape / Base | flat world map, mission sites, alien-presence bar, **Base** (research) | `scripts/xkom.js` | `geo/*`, `ui/font.png`, music `music_geoscape` |
| Interception (radar + optional Star Fox / Raptor-style shooter) | radar, then a top-down shooter | `scripts/xk/intercept.js` | `air/*`, `tactical/fx.png` (explosions), sfx |
| Tactical mission (X-COM) | isometric, turn-based | `scripts/xk/tacview.js` (+ rules `tactical.js`) | `tactical/*`, music `music_tactical` |
| Hive Strike (Red Alert RTS) | scrolling map + sidebar | `scripts/xk/rtsview.js` (+ rules `rts.js`) | `rts/*`, music `music_rts` |

---
## 1. Tactical mission (isometric, UFO Defense look) — `assets/tactical/`
The ground is a grid of **32×16 diamonds**. Taller things are drawn as **32×32** blocks whose *bottom* diamond (rows 16–31) sits on the tile and whose top diamond (rows 0–15) is the roof. Units are **16×24**.

| File | Size | Frame size | Frames (number → what) |
|---|---|---|---|
| `ground.png` | 160×16 | 32×16 | 0 grass · 1 dirt · 2 metal (UFO floor) · 3 wheat field · 4 road. One flat diamond each; the map picks one per tile. |
| `objects.png` | 160×32 | 32×32 | 0 wood wall block (barn) · 1 hull block (UFO wall) · 2 power block (UFO reactor, glowing) · 3 crate · 4 tree. These stand on top of a ground tile and block movement + sight (crate blocks movement only). |
| `units.png` | 80×72 | 16×24 | **3 rows × 5 frames.** Row 0 = X-KOM soldier, row 1 = Sectoid, row 2 = Muton. Per row: **0 idle · 1 walk (idle with legs swapped; the game alternates 0/1 while moving) · 2 aim (weapon raised) · 3 shoot (aim + muzzle flash) · 4 dead (lying down)**. Frame number = `row*5 + state`. "2 sprites max per action" rule: walk = 2 frames, shoot = 2 frames. Faces right/down; mirrored for left. |
| `ui.png` | 96×16 | 32×16 | 0 cursor (yellow diamond outline, follows the mouse tile) · 1 move-range tile (translucent blue, shown on every tile the selected soldier can reach with its TU) · 2 hit tile (translucent red, reserved). Semi-transparent pixels are fine here. |
| `fx.png` | 128×16 | 16×16 | 0–3 `boom1…boom4` (explosion, played in order when a unit dies) · 4 `spark` (a hit) · 5 `plasma` (alien/laser bolt) · 6 `bullet` (rifle tracer). |

Adding a race: append a row of 5 frames to `units.png`, add it to `RACES` in `scripts/xk/tactical.js` and `RACE_IDX` in `scripts/xk/tacview.js`.

## 2. Hive Strike RTS (Red Alert / C&C look) — `assets/rts/`
Everything sits on a **16 px grid** (1 map tile = 16×16). Buildings occupy whole tiles (footprint below).

| File | Size | Frame size | Frames |
|---|---|---|---|
| `terrain.png` | 160×16 | 16×16 | 0 grass A · 1 grass B (variety) · 2 dirt · 3 water A · 4 water B (water animates A↔B) · 5 tree (on grass; blocks) · 6 rock (blocks) · 7 ore small · 8 ore rich (gold; harvested, then the tile shows dirt) · 9 road (unused spare). |
| `units.png` | 384×16 (1 row) | 16×16 | **8 units × 3 frames**, in this order: `rifle, rocket, ltank, mtank, harv, warrior, spitter, walker`. Per unit: **frame 0 idle / walk step 1 · frame 1 walk step 2 · frame 2 shoot**. Frame number = `unitIndex*3 + state`. Faces right; mirrored for left. First five are X-KOM (team colour blue), last three are the aliens. |
| `b_fact.png` | 48×48 | 48×48 | Construction Yard (3×3 tiles). 1 frame. |
| `b_powr.png` | 32×32 | 32×32 | Power Plant (2×2). 1 frame. |
| `b_barr.png` | 32×32 | 32×32 | Barracks (2×2) — trains rifle + rocket infantry. 1 frame. |
| `b_weap.png` | 48×32 | 48×32 | War Factory (3×2) — trains tanks + harvester. 1 frame. |
| `b_proc.png` | 48×32 | 48×32 | Refinery (3×2) — harvesters unload ore here for credits. 1 frame. |
| `b_gun.png` | 32×16 | 16×16 | Gun Turret (1×1). 2 frames: 0 idle · 1 firing (muzzle flash). |
| `b_hive.png` | 48×48 | 48×48 | **Alien Hive (3×3)** — destroy this to win. 1 frame. |
| `b_brood.png` | 32×32 | 32×32 | Brood Pool (2×2) — alien spitter factory. 1 frame. |
| `b_tower.png` | 32×16 | 16×16 | Spore Tower (1×1) alien turret. 2 frames: 0 idle · 1 spitting. |
| `ui.png` | 128×16 | 16×16 | 0 mouse arrow · 1 attack cursor (red crosshair over an enemy) · 2 selection corners (spare) · 3 move marker (green ring dropped where you right-click). |
| `fx.png` | 128×16 | 16×16 | 0–3 `boom1…boom4` · 4 `muzzle` (flash at the shooter and spark at the target) · 5 `spit` (acid) · 6 `rocket` (spare). |

Buildings are drawn so their art sits at the **bottom** of the frame (top may be transparent). A frame's size must equal the footprint × 16.
Sidebar build icons are the unit sprites themselves (frame 0 of each player unit). The minimap is drawn from the map data.
Sidebar, selection boxes and health bars are drawn with plain rectangles in code (`rtsview.js`), not images.

## 3. Interception — `assets/air/`
Top-down shooter in the spirit of Star Fox / Raptor (the jet always flies up the screen; the jet banks when you steer, **barrel-rolls** to reflect enemy shots, grabs power-ups, fires homing missiles; a two-phase UFO boss ends the stage). All shown 1:1 on the 320×200 virtual screen. The jet's bank and roll are done in code by squashing/rotating `jet.png`, so you only need the two engine frames.

| File | Size | Frame size | Frames |
|---|---|---|---|
| `jet.png` | 48×24 | 24×24 | 0 exhaust long · 1 exhaust short (alternated for the engine flicker). Nose points up. |
| `saucer.png` | 48×16 | 24×16 | 0 / 1 = rim lights yellow / red (alternated). The UFO boss (28 hits). |
| `drone.png` | 24×12 | 12×12 | 0 / 1 = wing flap. Escort drones (2 hits each). |
| `shots.png` | 32×8 | 8×8 | 0 player laser · 1 / 2 alien plasma orb (alternated) · 3 hit spark. |
| `dart.png` | 28×14 | 14×14 | 0 / 1 = wing flicker. Fast red diving fighter (faces down), 2 hits. |
| `turret.png` | 32×16 | 16×16 | 0 idle · 1 firing (yellow core). Ground gun emplacement; scrolls with the sea. 5 hits. |
| `pickups.png` | 36×12 | 12×12 | 0 **P** power-up (weapon level 1→3) · 1 **M** missiles (+3 homing) · 2 **S** shield (+1). Dropped by formation leaders and turrets. |
| `island.png` | 48×32 | single image | ground scenery that scrolls past slower than the clouds (parallax); turrets sit on islands. |
| `cloud.png` | 32×16 | single image | high layer, drifts down fast over everything (parallax). |
| `sea.png` | 16×16 | single image | tiled and scrolled as the sea background. |
Explosions reuse `tactical/fx.png` frames 0–3.

## 4. Geoscape / Base — `assets/geo/` and `assets/ui/`
| File | Size | Notes |
|---|---|---|
| `geo/world.map` | text | **40×18 characters, one character = one 8×8 tile** of the world map. `~` ocean · `,` ocean waves · `g` land · `d` desert · `i` ice. Mission sites appear on `g`/`d` tiles. Lines before `---` are notes. Edit it, then run `node tools/pixelart.mjs xkom` to redraw `world.png`. |
| `geo/world.png` | 320×144 | The world picture (shown at 0,0). If you replace it with your own 320×144 art, keep `world.map` roughly matching the land so sites don't sit in the sea. |
| `geo/icons.png` | 64×16 | 16×16 frames: 0 base (HQ marker) · 1 UFO (landing site) · 2 terror site · 3 alien hive (spare). |
| `ui/font.png` | 96×32 | **Fallback** bitmap font (ASCII 32…95, 16 columns × 4 rows of **6×8** cells, white glyphs, upper-case only). Used only if the TTF fonts below fail to load. |
| `fonts/vt323-latin-400-normal.woff2` | font | **VT323** (Google Fonts, OFL) — all small UI text (terminal/X-COM look). |
| `fonts/orbitron-latin-900-normal.woff2` | font | **Orbitron Black** (Google Fonts, OFL) — headings, titles, big numbers. |
To change the look swap the two `.woff2` files (keep the names) or edit `loadFonts()` / `FText` in `scripts/xk/base.js`. The fonts are vendored (`node tools/vendor.mjs`, `vendor/fonts/…`, licences in `THIRD_PARTY.md`) and copied into each game's `assets/fonts/` — no CDN.

The **Base screen** (facilities + research list + soldier roster) and every panel/button are drawn in code as **bevelled rectangles** (light top/left edge, dark bottom/right — the X-COM button look; `Bevel` in `scripts/xk/base.js`, palette `UI` there) — no images. Research data: `scripts/xk/research.js`.

## 5. Audio — `assets/audio/`
Synthesized placeholders (`node tools/gen_xkom_audio.mjs` regenerates them all). Replace any file by name.

| File | When it plays |
|---|---|
| `sfx/rifle.wav` | X-KOM rifle shot (tactical + RTS bullets + shooter) |
| `sfx/plasma.wav` | plasma / laser shot (tactical) |
| `sfx/hit.wav` | bullet hit, claw hit |
| `sfx/die_human.wav` / `die_alien.wav` | a soldier / an alien dies |
| `sfx/explosion.wav` | building or vehicle destroyed, shooter crash/boom |
| `sfx/step.wav` | soldier footstep |
| `sfx/click.wav` `select.wav` `confirm.wav` `error.wav` | UI |
| `sfx/endturn.wav` | End Turn |
| `sfx/alarm.wav` | siren — mission deployment, "UFO!" and the Red Alert hive strike |
| `sfx/ack.wav` | RTS unit acknowledges an order |
| `sfx/built.wav` | RTS unit ready / research complete |
| `sfx/cannon.wav` `rocket.wav` `spit.wav` | tank shell, rocket, alien acid |
| `sfx/ore.wav` | harvester unloads |
| `sfx/victory.wav` `defeat.wav` | end cards |
| `music/music_geoscape.mp3` | title, geoscape, base, endings (slow, ambient) |
| `music/music_tactical.mp3` | radar + tactical missions (tense) |
| `music/music_rts.mp3` | Hive Strike RTS + the shooter (fast, drums) |

## Palettes (so new art matches)
* Tactical grass `#4a7a2c #62933a #386020`, dirt `#8a6a3c #a28048 #6e5230`, metal `#6a7480 #8a96a2 #4c5560`, soldier blue `#1e2c58 #3a58a0 #6c8ad8`, alien green `#2c4c1c #486a2c #7ab04a`, outline `#14141c`.
* RTS team ramp (dark/mid/light/highlight) X-KOM blue `#1c2a58 #3860b8 #6a98e8 #c0daff`; alien bio ramp `#1c3a24 #2f6a3a #58a04a #a8e070` + purple `#5a2a6a #9a4ab0 #e080f0`.
* In the art sources the letters `D M L H` are the team ramp (see `TEAMS` in `tools/art/xkom/rts.mjs`) — re-colouring a faction is one table.

## Regenerating
```
node tools/pixelart.mjs xkom --preview   # redraw all PNGs from tools/art/xkom/*.mjs (+ contact sheet in target/art-preview/)
node tools/gen_xkom_audio.mjs            # all sfx + music
node tools/gen_examples.mjs xkom         # copy everything into examples/xkom/
```

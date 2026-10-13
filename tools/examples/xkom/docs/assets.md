# X-KOM 2026 — assets (what each picture / sound is and how to replace it)

**All 31 PNG sheets were redrawn on 2026-10-13.** Original artwork combines the gritty 1990s X-COM look with XCOM 2-inspired blue combat armor, gray Sectoids, purple-armored Mutons, alien reactors and industrial military buildings. Built-in ImageGen raster atlases were reviewed, cropped and packed at the **original dimensions and frame grids**; tiny functional cursors, effects, map markers, pickups and terminal lettering are drawn pixel-by-pixel in `tools/art/xkom/details.mjs`. No original X-COM game assets are included.

**Offline sources:** reviewed native-size RGBA masters, frame manifest and exact generation/edit prompts live in `tools/art/xkom/redrawn/`. `node tools/pixelart.mjs xkom` re-packs these sources without an image service or external dependencies. The older `tools/art/xkom/rts.mjs` drawings are retained for Red Front; they no longer supply X-KOM artwork.
**Sounds + music are synthesized** by `node tools/gen_xkom_audio.mjs` (tiny oscillator synth → WAV/MP3). X-KOM has three distinct synthesized music loops (title/base/game) and 21 replaceable SFX; the two vendored fonts are separate.

**Swapping audio? Start with [the three music files and all 21 sound effects](#5-audio--easy-music-and-sfx-replacement) below.**

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
| Title / Geoscape / Base | illustrated title, globe / HQ regional map, mission sites, alien-presence bar, **Base** (research) | `scripts/xkom.js` | `geo/*`, `ui/title.png`, `ui/font.png`, music `music_title` / `music_base` |
| Interception (radar + optional Star Fox / Raptor-style shooter) | radar, then a top-down shooter | `scripts/xk/intercept.js` | `air/*`, `tactical/fx.png` (explosions), sfx |
| Tactical mission (X-COM) | isometric, turn-based | `scripts/xk/tacview.js` (+ rules `tactical.js`) | `tactical/*`, music `music_game` |
| Hive Strike (Red Alert RTS) | scrolling map + sidebar | `scripts/xk/rtsview.js` (+ rules `rts.js`) | `rts/*`, music `music_game` |

---
## 1. Tactical mission (isometric, UFO Defense look) — `assets/tactical/`
The ground is a grid of **32×16 diamonds**. Taller things are drawn as **32×32** blocks whose *bottom* diamond (rows 16–31) sits on the tile and whose top diamond (rows 0–15) is the roof. Units are **16×24**.

| File | Size | Frame size | Frames (number → what) |
|---|---|---|---|
| `ground.png` | 160×16 | 32×16 | 0 grass · 1 dirt · 2 metal (UFO floor) · 3 wheat field · 4 road. One flat diamond each; the map picks one per tile. |
| `objects.png` | 160×32 | 32×32 | 0 wood wall block (barn) · 1 hull block (UFO wall) · 2 power block (UFO reactor, glowing) · 3 crate · 4 tree. These stand on top of a ground tile and block movement + sight (crate blocks movement only). |
| `units.png` | 80×72 | 16×24 | **3 rows × 5 frames.** Row 0 = X-KOM soldier, row 1 = Sectoid, row 2 = Muton. Per row: **0 idle · 1 walk (idle with legs swapped; the game alternates 0/1 while moving) · 2 aim (weapon raised) · 3 shoot (aim + muzzle flash) · 4 dead (lying down)**. Frame number = `row*5 + state`. "2 sprites max per action" rule: walk = 2 frames, shoot = 2 frames. Faces right/down; mirrored for left. |
| `ui.png` | 96×16 | 32×16 | 0 cursor (cyan diamond outline, follows the mouse tile) · 1 move-range tile (translucent blue, shown on every tile the selected soldier can reach with its TU) · 2 hit tile (translucent red, reserved). Semi-transparent pixels are fine here. |
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
| `drone.png` | 24×12 | 12×12 | 0 / 1 = wing pose. Escort drones (2 hits each). |
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
| `geo/world.map` | text | **40×18 characters, one character = one 8×8 tile** of the world map. `~` ocean · `,` ocean waves · `g` land · `d` desert · `i` ice. Mission sites appear on `g`/`d` tiles. Lines before `---` are notes. This mission-placement mask matches the reviewed `world.png` master. Edit it alongside a replacement world picture; the art command re-packs the raster master rather than rebuilding a picture from these characters. |
| `ui/title.png` | 320×200 | Original Earth-and-defenders title illustration; raster master `ui-title.png.rgba.gz` and exact prompt `title-prompt.txt` in `tools/art/xkom/redrawn/`. |
| `geo/world.png` | 320×144 | Detailed tactical world picture with mountain ranges, forests, desert dunes, ice and a cyan coordinate grid (shown at 0,0). If you replace it with your own 320×144 art, keep `world.map` roughly matching the land so sites don't sit in the sea. |
| `geo/icons.png` | 64×16 | 16×16 frames: 0 base (HQ marker) · 1 UFO (landing site) · 2 terror site · 3 alien hive (spare). |
| `ui/font.png` | 96×32 | **Fallback** bitmap font (ASCII 32…95, 16 columns × 4 rows of **6×8** cells, white glyphs, upper-case only). Used only if the TTF fonts below fail to load. |
| `fonts/vt323-latin-400-normal.woff2` | font | **VT323** (Google Fonts, OFL) — all small UI text (terminal/X-COM look). |
| `fonts/orbitron-latin-900-normal.woff2` | font | **Orbitron Black** (Google Fonts, OFL) — headings, titles, big numbers. |
To change the look swap the two `.woff2` files (keep the names) or edit `loadFonts()` / `FText` in `scripts/xk/base.js`. The fonts are vendored (`node tools/vendor.mjs`, `vendor/fonts/…`, licences in `THIRD_PARTY.md`) and copied into each game's `assets/fonts/` — no CDN.

Small UI text is **9 virtual pixels** (VT323, down from 13); title and heading text are also smaller. Bevelled panels have subtle deterministic 32×32 grain created in code, not an external texture. The globe is a shaded orthographic canvas projection of `world.png`; regional mode crops the same raster around HQ. No network or extra 3D library is needed.

The **Base screen** (facilities + research list + soldier roster) and panels/buttons are drawn in code as **bevelled rectangles** (light top/left edge, dark bottom/right — the X-COM button look; `Bevel` in `scripts/xk/base.js`, palette `UI` there) — no images. Interception radar uses texture-free terminal panels, dim scan lines, range rings and compass ticks (all drawn in code). Research data: `scripts/xk/research.js`.

## 5. Audio — EASY music and SFX replacement

**Exactly three music files. Every sound effect has its own WAV file. No code edits needed.** All paths below are relative to this X-KOM project folder (the folder containing this document and `nord.project.json`).

### Quick swap
1. Pick a filename in the tables below. Replace that file in `assets/audio/music/` or `assets/audio/sfx/` with your own audio. **Keep the filename and extension exactly the same.**
2. Use a real **MP3** for music or a real **WAV** for SFX; renaming another format's extension does not convert it. Music may be mono or stereo and any length; it loops automatically. SFX play once. Trim leading silence from effects and use a loop-friendly music edit.
3. Stop/Play in the editor, or reload the game, to hear the new file. Already-decoded audio stays cached until the game reloads.

**Working in the Nord Engine repository?** For a lasting change, replace the same file under `tools/examples/xkom/assets/audio/`, then run `node tools/gen_examples.mjs xkom`. This copies it to `examples/xkom/assets/audio/`. Changing only the generated example works immediately but the next example rebuild overwrites it. **Do not run `node tools/gen_xkom_audio.mjs` after installing your own sounds**: that command restores the synthesized defaults.

### Music — three separate slots
| File to replace | Screens using it | Default track |
|---|---|---|
| `assets/audio/music/music_title.mp3` | **Title screen only** | 42.7 s — dramatic 90 BPM retro alien-defense theme, pulsing bass, melody and drums. |
| `assets/audio/music/music_base.mp3` | **Geoscape/globe, HQ regional map, Base/research, campaign victory/defeat screen** | 53.3 s — quiet 72 BPM command-center ambience, soft synth pads and sparse melody. |
| `assets/audio/music/music_game.mp3` | **Tactical missions, interception radar/auto/shooter, Hive Strike alert and RTS battle** | 34.3 s — tense 112 BPM combat theme with bass, percussion and restrained synth lead. |

Browsers start audio after a click/key gesture. The first touch/click dismisses the ready-made Nord start gate and plays title music while staying on the title; the next interaction is normal game input. The title no longer needs a separate LISTEN button. Enter starts the campaign and switches to base music. Music crossfades between different files; radar-to-shooter keeps the loop playing; tactical and RTS mission starts restart the game track from the beginning.

### Sound effects — replace one sound at a time
| File to replace | Exactly when it plays | Replacement suggestion |
|---|---|---|
| `assets/audio/sfx/rifle.wav` | Human rifle fire in tactical/RTS; interceptor lasers; auto-resolve gunfire. | Short dry gunshot. Shared by these weapons. |
| `assets/audio/sfx/plasma.wav` | Tactical alien/plasma shots (including energy-weapon fire routed as plasma). | Short sci-fi energy discharge. |
| `assets/audio/sfx/hit.wav` | Tactical impacts; RTS claw attacks; interceptor takes damage. | Short impact/thud. |
| `assets/audio/sfx/die_human.wav` | A human soldier/infantry unit dies in tactical or RTS. | Brief human death vocal/effect. |
| `assets/audio/sfx/die_alien.wav` | An alien dies in tactical or RTS. | Brief alien death cry. |
| `assets/audio/sfx/explosion.wav` | Vehicle/building destruction; interception explosions and jet crash; UFO auto-resolve success. | Short explosion with a fading tail. |
| `assets/audio/sfx/step.wav` | Each tactical walking step, for soldiers and visible/hidden alien replay. | Very short boot/footstep sound. |
| `assets/audio/sfx/click.wav` | UI buttons/help and RTS production requests. | Quiet interface click. |
| `assets/audio/sfx/select.wav` | Soldier/unit selection and next soldier; interceptor roll and reflected shots. | Short positive selection chirp. |
| `assets/audio/sfx/confirm.wav` | Campaign/mission selection; research accepted; returning from Base. | Short confirmation chime. |
| `assets/audio/sfx/error.wav` | Invalid shot, unavailable research, or failed RTS production request. | Brief negative/error buzz. |
| `assets/audio/sfx/endturn.wav` | Player ends a tactical turn. | Distinct short end-turn cue. |
| `assets/audio/sfx/alarm.wav` | Deployment/interception warning, UFO boss arrival, Hive Strike alert. | Short alien-alert siren. |
| `assets/audio/sfx/ack.wav` | RTS units receive movement, attack or attack-move orders. | Short radio acknowledgement/chirp. |
| `assets/audio/sfx/built.wav` | RTS unit ready, research finished, or interceptor collects a pickup. | Positive completion/pickup cue. |
| `assets/audio/sfx/cannon.wav` | RTS tank shell fire. | Heavy cannon blast. |
| `assets/audio/sfx/rocket.wav` | RTS rocket fire; interceptor launches a homing missile. | Rocket launch/whoosh. |
| `assets/audio/sfx/spit.wav` | RTS alien acid weapon; interceptor enemy plasma fire. | Alien spit/energy effect. |
| `assets/audio/sfx/ore.wav` | Harvester unloads ore and credits are added. | Small metal/cash delivery chime. |
| `assets/audio/sfx/victory.wav` | Successful tactical mission, RTS victory, UFO shooter win, campaign win. | Victory sting, about 1–3 seconds. |
| `assets/audio/sfx/defeat.wav` | Failed tactical mission, RTS loss, UFO loss/escape, campaign loss. | Defeat sting, about 1–3 seconds. |

The default SFX are short synthesized placeholders (0.08–2.4 s). You can use other lengths; short effects work best for rapid/repeated actions. Several weapons share one sound as documented above. The game changes volume/pitch for some repeated actions; changing a file changes every use of that file. A music replacement never replaces the separate victory/defeat stings.

## Art direction (so replacements match)
* Dark navy outlines and shadows, muted olive/brown terrain, silver-blue steel, cyan cockpit lights and targeting marks.
* Human faction: blue segmented armor, dark visors, chunky rifles, blue military vehicles and industrial buildings.
* Alien faction: gray Sectoids; green Mutons with purple armor; purple hive structures and acid-green power cores/plasma.
* Upper-left highlights, hard pixel edges, clear silhouettes and transparent sprite backgrounds. Terrain stays subdued so units stand out.
* The packed masters preserve action order and bottom alignment. Animation poses are distinct; do not include atlas labels, background glows or neighboring frames in replacement cells.

## Regenerating
```
node tools/pixelart.mjs xkom --preview   # re-pack reviewed raster masters + pixel-exact details (+ contact sheet in target/art-preview/)
node tools/gen_xkom_audio.mjs            # all sfx + music
node tools/gen_examples.mjs xkom         # copy everything into examples/xkom/
```

RTS HUD uses the native 6×8 bitmap font for crisp prices/selection labels; prices sit below icons without a redundant currency prefix. HQ/body text uses rounded 8px VT323 sizing (small labels 6–7px); help pages split into at most 15 lines. Pause/console are plain terminal-style DOM overlays; no new art or music slots are required.

### Interception music start point
Edit `scripts/music-config.js`:

```js
export const MUSIC_CONFIG = {
  interceptStartSeconds: 30,
};
```

This starts `assets/audio/music/music_game.mp3` at 30 seconds when interception begins. Change the number to the action-packed part of your song, or use `0` for the beginning. Radar and shooter keep the same playback; starting a tactical or RTS mission restarts the same MP3 at **0 seconds**. Music loops automatically in both mission modes. Invalid offsets or offsets beyond the song length fall back to the beginning. Reload or Stop/Play after editing. For permanent repo changes, edit `tools/examples/xkom/scripts/music-config.js`; the generated game copy is `examples/xkom/scripts/music-config.js`.

# ASSETS.md — every asset, where it is, how to replace it

**Everything here is a generated placeholder** (procedural code in `tools/gen/*.py`, run with `python3 tools/gen_assets.py`),
except the Lucide icons (ISC licence) and Inter / DejaVu fonts (OFL / Bitstream-Vera licence).
Replace any file by dropping a new one **at the same path and size/format** — nothing is referenced by hash.
To regenerate placeholders: `python3 tools/gen_assets.py [brand|textures|sprites|audio|docs|md]`.
When you add or replace assets by hand, delete/adjust the generator step (or the file will be overwritten on the next regen) and note it below.

## Replacement guide

| Group | Path | Used by | Spec to keep | Notes |
|---|---|---|---|---|
| **Logo** | `assets/brand/logo.svg`, `logo.png` (1024), `logo-512.png`, `logo-256.png`, `logo-mark-transparent.png`, `wordmark.png` | editor header, About, manual, README | square, rounded-corner mark; PNG 1024 is the source for icons | After changing `logo.png`, rebuild icons: `python3 tools/gen_assets.py brand` (or replace icns/ico manually) |
| **Splash** | `assets/brand/splash.png` (1280×720), `splash-640x360.png` | editor start (**shown ≥ 2 s**, `nord-editor`) | 16:9, ≥ 1280×720 | credit text "Crowelian 2026 + Sonnet" is baked in |
| **App icons** | `assets/brand/icon.icns` (mac), `icon.ico` (win), `icons/icon-{16..512}.png`, `favicon.png` | `.app` bundle, window icon, exported games' default icon | icns must contain ≥ 512@2x; ico ≥ 256 | Games override with `export.mac.icon` in `nord.project.json` |
| **Palette** | `assets/brand/palette.json` | editor theme, manual CSS | hex values | single source of UI colours |
| **Fonts** | `assets/fonts/Inter-*.otf`, `DejaVuSansMono*.ttf`, `vendor/fonts/*` (woff2 for manual) | editor UI/code, manual | TTF/OTF for egui; woff2 for web | Swap DejaVuSansMono for JetBrains Mono TTF (OFL) when desired |
| **Icons** | `assets/icons/lucide/*.svg` | editor toolbar, hierarchy, asset types | SVG 24×24 stroke icons, `#ffffff` stroke (tinted at runtime) | Add names to `tools/lucide-icons.txt`, run `node tools/vendor.mjs` |
| **Textures** | `assets/textures/*.png` (+ `*_n.png` normal maps) | 3D materials, 2D backgrounds, examples | 512×512 seamless tileable PNG | `grid_dev`, `uv_test`, `checker` are dev textures — keep names |
| **Skyboxes** | `assets/skybox/{day,sunset,night}/{px,nx,py,ny,pz,nz}.png` | 3D scenes (Babylon CubeTexture) | 6 square faces, same size | Names follow Babylon's `_px/_nx…` convention (files are folder-based) |
| **Particles** | `assets/particles/*.png` | particle presets in library | 128×128 white-on-alpha (tinted in engine) | |
| **Characters/enemies** | `assets/sprites/hero.png`, `enemy_*.png` (+ `.meta.json` anim data) | platformer templates/examples | horizontal strip, 32×32 frames, nearest filter | Update the `.meta.json` anims if frame counts change |
| **Items & props** | `assets/sprites/items/*.png`, `props/*.png`, `coin.png`, `flag.png`, `torch.png` | examples, library | 16×16 items; coin/flag/torch are strips | |
| **Tileset** | `assets/sprites/tileset_platformer.png` (+ meta) | tilemap demos | 16×16 tiles, 8 cols × 4 rows (grass/stone/sand/snow) | layout described in the meta file |
| **Backgrounds** | `assets/sprites/backgrounds/*.png` | parallax demos | 320×180 layers | |
| **UI kit** | `assets/ui/*.png` | in-game UI templates (buttons, bars, joystick, arrows, cursor) | 9-slice friendly panels (corner ≥ 12 px for 64 px buttons) | |
| **SFX** | `assets/audio/sfx/*.wav` | library scripts, examples (names are referenced: jump, coin, hit, …) | mono 44.1 kHz WAV, short | Keep file names so scripts keep working |
| **Music** | `assets/audio/music/*.mp3` | examples, templates | MP3 96 kbps mono loops (`music_*`), one-shot jingles (`jingle_*`) | MP3 adds ~25 ms encoder delay → for gapless loops use OGG/WAV |
| **Manual art** | `assets/docs/manual-banner.png`, `tutorial-cover-template.png`, `icons/NN-*.png` (17 section badges) | HTML manual & tutorials | banner 1600×320; badges 128×128 | |

## Noom artwork

Noom's ten image sheets were redrawn on 2026-10-12 with gritty Barony/Doom-inspired dungeon artwork, using the built-in
ImageGen tool for nine illustrated sheets and original hand-drawn pixel lettering/digits. No external game art was copied.
Runtime PNGs: `examples/noom/assets/{sprites,textures,ui}/`; source PNGs: `tools/examples/noom/assets/`.
Reviewed lossless RGBA masters, dimensions, metadata and generation prompts: `tools/art/noom/redrawn/`; font: `tools/art/noom/font.mjs`.
Re-pack offline with `node tools/pixelart.mjs noom --preview`, then `node tools/gen_examples.mjs noom`.
All existing frame sizes, names and atlas rectangles are preserved. Full inventory: `examples/noom/assets.md`.

## RetroPaxDungeons artwork

All eleven image sheets were redrawn on 2026-10-12 for the retro dungeon game: a bronze-armored warrior, sewer creatures,
Goo boss, inventory items, slate masonry, teal water, effects and HUD. Nine illustrated sheets use original built-in ImageGen
art; effect markers and slashes are hand-drawn. The redrawn 6×8 dungeon font is shared with Noom. No external game art was copied.
Runtime PNGs: `examples/retropaxdungeons/assets/{tiles,sprites,ui}/`; sources: `tools/examples/retropaxdungeons/assets/`.
Lossless raster masters, metadata and prompts: `tools/art/rpd/redrawn/`; hand-drawn details: `tools/art/rpd/details.mjs`.
Re-pack offline with `node tools/pixelart.mjs rpd --preview`, then `node tools/gen_examples.mjs retropaxdungeons`.
Existing frame sizes, counts and names are preserved. Inventory: `examples/retropaxdungeons/assets.md`.

## Planned / missing (tracked in task.md)
- More real CC0 packs (Kenney 2D sprites etc.) — kenney.nl/opengameart.org unreachable from the sandbox; drop them into `assets/packs/<name>/` with a README
- 3D model placeholders (glTF props/characters) — **M6**
- Top-down character & tileset, more UI icons — **M6**
- JetBrains Mono TTF — **M3-01**

## Optional CC0 packs (`assets/packs/`)
Placeholders stay the defaults (offline, tiny); real packs live beside them and are opt-in. Refetch with `tools/fetch-packs.sh`.

| Pack | Path | Content | Licence |
|---|---|---|---|
| Kenney 3D Platformer Kit | `assets/packs/kenney-platformer-3d/` | 15 glTF models (character, coin, platforms, flag…), 6 OGG sfx, coin/particle/shadow sprites | CC0 |

To replace a placeholder with a pack asset, copy it to the placeholder's path (keep the spec in the table above).

## Licences
Placeholder art/audio generated by this repo: MIT (same as the project). Lucide icons: ISC. Kenney pack: CC0. Fonts: Inter OFL-1.1, DejaVu (Bitstream Vera licence). See `THIRD_PARTY.md`.

## Inventory
<!-- INVENTORY:START (generated by tools/gen_assets.py — do not edit) -->

**458 asset files** in 18 folders. Folder → files:

- `assets/audio/music/` (7) — `jingle_game_over.mp3`, `jingle_victory.mp3`, `music_action.mp3`, `music_adventure.mp3`, `music_ambient_space.mp3`, `music_boss.mp3`, `music_menu_chill.mp3`
- `assets/audio/sfx/` (47) — `alarm.wav`, `back.wav`, `bell.wav`, `bounce.wav`, `checkpoint.wav`, `chest.wav`, `click.wav`, `close.wav`, `coin.wav`, `confirm.wav`, `death.wav`, `door.wav`, `double_jump.wav`, `empty.wav`, `error.wav`, `explosion.wav`, `explosion_small.wav`, `heal.wav`, `hit.wav`, `hover.wav`, `hurt.wav`, `jetpack.wav`, `jump.wav`, `land.wav`, `laser.wav`, `laser2.wav`, `level_up.wav`, `lose.wav`, `magic.wav`, `missile.wav`, `notification.wav`, `open.wav`, `pickup.wav`, `powerup.wav`, `reload.wav`, `shield.wav`, `shoot.wav`, `spawn.wav`, `splash.wav`, `step_grass.wav`, … (+7)
- `assets/brand/` (12) — `favicon.png`, `icon.icns`, `icon.ico`, `logo-256.png`, `logo-512.png`, `logo-mark-transparent.png`, `logo.png`, `logo.svg`, `palette.json`, `splash-640x360.png`, `splash.png`, `wordmark.png`
- `assets/brand/icons/` (8) — `icon-128.png`, `icon-16.png`, `icon-180.png`, `icon-256.png`, `icon-32.png`, `icon-48.png`, `icon-512.png`, `icon-64.png`
- `assets/docs/` (2) — `manual-banner.png`, `tutorial-cover-template.png`
- `assets/docs/icons/` (17) — `01-rocket.png`, `02-layout-dashboard.png`, `03-folder-open.png`, `04-code.png`, `05-layers.png`, `06-box.png`, `07-magnet.png`, `08-music.png`, `09-layout-template.png`, `10-gamepad-2.png`, `11-images.png`, `12-library.png`, `13-cpu.png`, `14-upload.png`, `15-gauge.png`, `16-book-open.png`, `17-info.png`
- `assets/fonts/` (6) — `DejaVuSansMono-Bold.ttf`, `DejaVuSansMono.ttf`, `Inter-Bold.otf`, `Inter-Medium.otf`, `Inter-Regular.otf`, `Inter-SemiBold.otf`
- `assets/icons/lucide/` — 241 Lucide SVG icons (ISC licence; see `tools/lucide-icons.txt`)
- `assets/particles/` (9) — `circle.png`, `flame.png`, `ring.png`, `smoke.png`, `soft.png`, `spark.png`, `square.png`, `star.png`, `streak.png`
- `assets/skybox/day/` (6) — `nx.png`, `ny.png`, `nz.png`, `px.png`, `py.png`, `pz.png`
- `assets/skybox/night/` (6) — `nx.png`, `ny.png`, `nz.png`, `px.png`, `py.png`, `pz.png`
- `assets/skybox/sunset/` (6) — `nx.png`, `ny.png`, `nz.png`, `px.png`, `py.png`, `pz.png`
- `assets/sprites/` (8) — `coin.png`, `enemy_bat.png`, `enemy_robot.png`, `enemy_slime.png`, `flag.png`, `hero.png`, `tileset_platformer.png`, `torch.png`
- `assets/sprites/backgrounds/` (5) — `bg_cloud.png`, `bg_hills_far.png`, `bg_hills_near.png`, `bg_sky.png`, `bg_trees.png`
- `assets/sprites/items/` (18) — `barrel.png`, `bullet.png`, `chest_closed.png`, `chest_open.png`, `crate.png`, `door.png`, `gem_blue.png`, `gem_green.png`, `gem_red.png`, `gem_yellow.png`, `heart_empty.png`, `heart_full.png`, `heart_half.png`, `key.png`, `potion_blue.png`, `potion_red.png`, `spikes.png`, `star.png`
- `assets/sprites/props/` (4) — `bush.png`, `cloud.png`, `rock.png`, `tree.png`
- `assets/textures/` (28) — `brick.png`, `brick_n.png`, `checker.png`, `concrete.png`, `concrete_n.png`, `dirt.png`, `dirt_n.png`, `grass.png`, `grass_n.png`, `grid_dev.png`, `lava.png`, `lava_n.png`, `leaves.png`, `leaves_n.png`, `metal.png`, `metal_n.png`, `noise.png`, `sand.png`, `sand_n.png`, `snow.png`, `snow_n.png`, `stone.png`, `stone_n.png`, `uv_test.png`, `water.png`, `water_n.png`, `wood.png`, `wood_n.png`
- `assets/ui/` (28) — `arrow_down.png`, `arrow_left.png`, `arrow_right.png`, `arrow_up.png`, `bar_bg.png`, `bar_fill_blue.png`, `bar_fill_green.png`, `bar_fill_red.png`, `bar_fill_yellow.png`, `btn_a.png`, `btn_b.png`, `btn_x.png`, `btn_y.png`, `button_disabled.png`, `button_hover.png`, `button_normal.png`, `button_pressed.png`, `checkbox_off.png`, `checkbox_on.png`, `cursor.png`, `joystick_base.png`, `joystick_knob.png`, `panel.png`, `panel_dark.png`, `panel_light.png`, `slider_knob.png`, `slider_track.png`, `tooltip.png`

<!-- INVENTORY:END -->

## Altimu 5.7 artwork
Hand-pixelled 16x16 tiles, 18 people × 6 frames, wolf/spider/corpses, combat FX, window frame (one character = one pixel, typed in `tools/art/altimu/*.mjs`).
Runtime PNGs: `examples/altimu/assets/{tiles,sprites,ui}/`; sources `tools/examples/altimu/assets/`. Re-pack: `node tools/pixelart.mjs altimu --preview`, then `node tools/gen_examples.mjs altimu`. Map: `assets/maps/trinsic.map` (text). Inventory: `examples/altimu/assets.md`.

## Harrison's Command assets
Generated low-poly glTF (carrier, Walrus, Manta, tower, mortar, 3 islands): `node tools/gen_harrison_models.mjs`. Hand-pixelled 32x32 seamless textures + map icons: `node tools/pixelart.mjs harrison --preview`.
Kenney Starter-Kit models/sounds (MIT) in `examples/harrison/assets/{models/kenney,audio/kenney}/`. Inventory + how to replace: `examples/harrison/assets.md`.

## Forgotten Wars artwork
Hand-pixelled 16x16 terrain (roads/rivers composed from drawn arm pieces into 16 neighbour masks), properties, 8 units × 2 armies × 2 idle frames, cursor/range tiles, explosion FX, icons (typed in `tools/art/forgotten/*.mjs`; letters D/M/L/H are the army colour ramps).
Runtime PNGs: `examples/forgotten/assets/{tiles,sprites,ui}/`; sources `tools/examples/forgotten/assets/`. Re-pack: `node tools/pixelart.mjs forgotten --preview`, then `node tools/gen_examples.mjs forgotten`. Map: `assets/maps/crossing.map` (text). Inventory + how to replace: `examples/forgotten/assets.md`.

## Automies assets
Generated low-poly glTF (5 cars with steerable wheel nodes, 4 towers, bank/warehouse/safehouse, street props): `node tools/gen_automies_models.mjs`. Hand-pixelled 16x16 / 32x32 seamless textures (4 facades, roof, pavement, concrete, metal, marble, container, water) + HUD icons: `node tools/pixelart.mjs automies --preview`.
Kenney City + Racing kit models and engine/skid/impact/ambience sounds (MIT): `tools/fetch-automies-assets.sh` → `examples/automies/assets/{models/kenney,audio/kenney}/`. Map: `assets/maps/haven.map`. Inventory + how to replace: `examples/automies/assets.md`.

## X-KOM 2026 artwork
All 31 PNG sheets redrawn with original 1990s X-COM / XCOM 2-inspired art; existing dimensions, frame grids and asset paths preserved. Built-in ImageGen raster masters + exact prompts: `tools/art/xkom/redrawn/`; pixel-exact FX, cursors, pickups, map icons and font: `tools/art/xkom/details.mjs`. Offline re-pack: `node tools/pixelart.mjs xkom --preview`, then `node tools/gen_examples.mjs xkom`. The 40×18 `world.map` mission mask matches the world raster; update both together. Inventory: `examples/xkom/assets.md`. Audio remains synthesized (`tools/gen_xkom_audio.mjs`); VT323/Orbitron fonts retain their OFL licences. Crowelian 2026 + Sonnet.

X-KOM UI follow-up (M6-28): added `assets/ui/title.png` (320×200, original ImageGen Earth/defenders illustration; reviewed raster master + exact `title-prompt.txt`), bringing the pack to 32 PNG sheets. Panels use subtle code-drawn grain; globe/HQ views sample the existing world raster. No reference-image pixels are shipped.

X-KOM audio (M6-29): exactly three original synthesized loops in `examples/xkom/assets/audio/music/` — `music_title.mp3` (title), `music_base.mp3` (globe/HQ/research/endings), `music_game.mp3` (all mission gameplay). All 21 SFX have individual filenames/descriptions and easy replacement instructions in `examples/xkom/assets.md` section 5. Permanent replacements go in `tools/examples/xkom/assets/audio/`, then regenerate the example; running `tools/gen_xkom_audio.mjs` restores defaults. Red Front retains its own `tools/examples/redfront/assets/audio/music/music_rts.mp3`.

X-KOM command UI follow-up (M6-30/31): radar uses untextured navy/green terminal panels and scan lines; RTS labels/prices use the existing 6×8 bitmap sheet with separate icon/cost rows, HQ body text is rounded to 8px. Start gate, console and pause menu are code-drawn DOM overlays. No new image/audio files or swap paths.

## Vallout 2: New Kerava (example)
PNG/WAV/MP3 files in `tools/examples/vallout/assets/` are authoritative; no sprite or audio generators. M6-38 replaces all nine PNG sheets with original Fallout-inspired quarantined Kerava art, plus twelve talking-head portraits, sentinel title, municipal survey map and scratched metal casing. Utility sprites/font are pixel-drawn; other raster art uses built-in ImageGen. Exact prompts: `examples/vallout/ART_DIRECTION.md`. Menus/HUD use metal, green CRTs, amber labels and red controls. Copy replacements with `node tools/gen_examples.mjs vallout`; inventory: `examples/vallout/assets.md`. Owner music/SFX preserved.

## HTML manual screenshots (M7-14)
The manual reuses original project captures `docs/screenshots/{vallout-03-classic-explore,automies-2-drive,xkom-tactical}.png`, with explanatory captions; these are copied to `docs/manual/assets/screenshots/` by the manual builder. `manual-hello-nord.png` is a real 640×360 Nord Phaser-runtime capture of the text entity in T01, not an editor mockup. Documentation preview captures `manual-{home,code,api,mobile}.png` show the redesigned site itself. No new external art, stock photos or audio. Crowelian 2026 + Sonnet.

`assets/docs/editor-layout.svg` is an original vector panel map, explicitly labelled as a diagram, with numbered beginner areas and accessible descriptions. It replaces the manual’s ASCII editor map; no native editor screenshot is implied.

## notepaint, Star-Not and Shader Terrain Lab (2026-10-13)
- **notepaint:** original built-in ImageGen transparent UI atlas `tools/examples/notepaint/assets/ui/tools.png` (1254×1254, 4×4; Nord metadata 313×313 cells). Runtime copy: `examples/notepaint/assets/ui/`. Sixteen paper/paint/file icons, exact prompt in `ART_DIRECTION.md`, numbered inventory in `assets.md`. MIT original art; Inter OFL licence retained.
- **Star-Not:** original built-in ImageGen `assets/sprites/space.png` and `assets/ui/portraits.png` under source/runtime example folders. Three ships and race portraits, Sun/eight planets, satellite, asteroid, projectile, explosion and UI symbols. Exact prompts and UI layout revision in ART_DIRECTION.md; raw PNGs authoritative. Sidecars are integer 313×313 frames; UI CSS uses per-row portrait framing. Original 3 looping WAV music files + 8 WAV effects in `assets/audio/`, explicitly regenerable via `node tools/gen_star_not_audio.mjs`. Original art/audio MIT; no UQM content copied.
- **Shader Terrain Lab:** exact owner-pasted `terrain.glsl` retained; origin/licence not specified. Original 16-second ambient WAV in `tools/examples/shader-terrain/assets/audio/ambience.wav`, generated by `tools/gen_shader_audio.mjs`. Code-drawn falling cube and controls; no raster artwork needed.
- Use `node tools/gen_examples.mjs notepaint star-not shader-terrain` to copy permanent sources to the runnable examples. Manual tutorials show the paths and image sheets, explain reuse, and embed the shipped code. Regenerating examples does not redraw PNGs or regenerate audio. No gameplay tests, browser runs or native builds were performed in this task (owner instruction).

## Midnight Sun Tour (2026-10-19)
The owner title PNG is preserved. All 97 other legacy PNGs are replaced with original built-in ImageGen art and code-native UI exports, plus packed environment/cast atlases. Weathered band portraits match the title. Sources, exact prompts, repacking and audio replacement instructions: `tools/examples/midnight-sun-tour/ASSETS.md`. Pack reviewed artwork with `python3 tools/art/midnight/pack.py`; generate only the named example. Existing 22 music loops, six artist recordings and 40 SFX are retained; no new audio was needed. Ruisrock plays each booked artist's recording during that set; no unbooked artist fallback. Third-party recordings retain the provenance in THIRD_PARTY.md.

- M6-46: `tools/examples/midnight-sun-tour/assets/sprites/retro_*` adds native-pixel scenes, vehicles/wildlife, gear, four band portraits, standing/walking frames and two performance poses per musician. Built-in ImageGen exact prompts: game `RETRO_ART.md`. Runtime packing: `python3 tools/art/midnight/retro.py` (called by `pack.py`), with alpha trimming before sizing and nearest-neighbor display. Existing music/SFX retained; original title bytes preserved.

## FPS Creator addon (M12)
No binary assets are shipped by the addon: textures (`runtime/fpsc/bank/textures.js`, 35 canvas-drawn tileable patterns with seeded noise), models (`runtime/fpsc/models.js`, boxes/cylinders/spheres), sounds (`runtime/fpsc/audio.js`, WebAudio recipes) and the HUD are generated in code (MIT). The demo level is generated by `node tools/gen_fpsc_level.mjs`. To replace or extend any of them with files, follow the rules in `docs/FPS_CREATOR.md` §Adding assets (`<project>/fpsc/bank.json`).

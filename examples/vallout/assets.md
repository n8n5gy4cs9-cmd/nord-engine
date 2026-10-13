# Assets — Vallout 2: New Kerava (replace by filename; keep sizes/frame layout)
> **PNG/WAV/MP3 files are the source assets.** There are no Vallout sprite or audio generators. Edit or replace files in `tools/examples/vallout/assets/` directly, then run `node tools/gen_examples.mjs vallout`.

## Art direction (2026-10-13 redraw)
All nine original PNG sheets are remade. Original ImageGen-assisted raster art captures the worn, pre-rendered look of 1990s Fallout with Kerava architecture: yellow timber station, red/silver commuter train, concrete balconies, blue shopfronts, birches and globe lamps. Ashy soil, wrecks, toxic sludge and hazard-marked concrete barriers form the quarantine zone. Utility sprites and the terminal font are pixel-drawn. Every gameplay frame keeps its original size/name/anchor. Reference photographs/screenshots are not shipped.

Menus, HUD, intro, endings, dialogue, character creation, character sheet, inventory, Nokia quests, options, wall-kicking and world map use worn metal, recessed green CRTs, amber labels, red controls and rivets. Exact ImageGen prompts and packing notes: [ART_DIRECTION.md](ART_DIRECTION.md).
## Sprite sheets (PNG, nearest filter; `*.png.meta.json` holds frame size + frame names)
| File | Frame size | Layout |
|---|---|---|
| `tiles/ground.png` | 32×16 | iso diamonds, 8 per row: sand1 sand2 sand3 asphalt asphalt_x asphalt_y asphaltc pave · concrete grass rubble goo rail_x rail_y platform floor |
| `tiles/walls.png` | 32×72 (bottom-anchored cube; ground diamond = lowest 16 rows) | apt24 apt40 apt56 brick24 brick40 wood24 shop24 · train28 conc12 apt_ruin40 brick_ruin24 wood_ruin24 shop_ruin24 |
| `sprites/props.png` | 48×48 (bottom-centre) | pine birch bush lamp bench · barrel_a barrel_b bin car_se car_sw · kiosk crate moped ufo_big grave · loot exit sign car2_se car2_sw |
| `sprites/actors.png` | 24×32, 11 frames per row | rows: tero pena kalle saku mottonen rane soldier ranger harmaa komentaja blob gull. Frames: stand_f walkA_f walkB_f shoot_f kick_f · stand_b walkA_b walkB_b shoot_b kick_b · dead (flipped in game for E/W) |
| `sprites/boss.png` | 48×64 | same 11 frames (Overmind) |
| `sprites/fx.png` | 16×16 | muzzle_a muzzle_b bolt bullet spark blood goo boom_a boom_b |
| `ui/items.png` | 16×12 | inventory icons (names in meta) |
| `ui/ui.png` | 16×16 | cursors (move, command, look, attack, wait), metal HUD texture, LEDs, buttons |
| `ui/font.png` | 6×8 cells, 16 per row, ASCII 32..95 (upper-case) | newly pixel-drawn compact terminal font |
| `ui/portraits.png` | 64×64, 4 columns × 3 rows | same twelve character names/order as actors; dialogue talking heads and survivor records |
| `art/title.png` | 640×480 | original civil-defense sentinel over the abandoned Kerava station/train; title and endings |
| `art/metal.png` | 64×64 | repeated worn steel casing; every menu and HUD |
| `art/world.png` | 612×346 | fictional quarantine-region survey map; route/pin labels drawn by code |

## Replacement and verification
Replace a PNG with the same dimensions and keep its metadata sidecar. Run `node tools/gen_examples.mjs vallout` to copy the source files into the engine example. Music and SFX retain the owner's existing files. `node tools/vallout-art-test.mjs [export-directory]` checks sprite dimensions, nonempty/distinct animation frames, stable standing height, corpses, menu bounds, real volume buttons and offline loading. `node tools/vallout-shots.mjs` captures twenty game/menu/location screens; `node tools/vallout-smoke.mjs` verifies gameplay.

## Audio
- `audio/sfx/*.wav` (29): click step hit hit_goo hurt die_alien die_human gull blob levelup win lose pickup open error miss combat shoot_pistol shoot_shotgun shoot_rifle ray swing kick punch whoosh wallkick heal drink confirm
- `audio/music/music_title.mp3` (title + endings), `music_wasteland.mp3` (exploration), `music_combat.mp3` (turn-based combat). Loop seamlessly.

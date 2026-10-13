# Assets — Vallout 2: New Kerava (replace by filename; keep sizes/frame layout)
All art is **hand-typed pixel art** (text grids in `tools/art/valout/*.mjs`, built with `node tools/pixelart.mjs valout`). Audio is synthesized (`node tools/gen_audio.mjs`). To replace: drop a file with the same name/size in `game/assets/…` (do not re-run the generators afterwards, they overwrite).

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
| `ui/font.png` | 6×8 cells, 16 per row, ASCII 32..95 (upper-case) | bitmap font, from nord-engine |
## Audio
- `audio/sfx/*.wav` (29): click step hit hit_goo hurt die_alien die_human gull blob levelup win lose pickup open error miss combat shoot_pistol shoot_shotgun shoot_rifle ray swing kick punch whoosh wallkick heal drink confirm
- `audio/music/music_title.mp3` (title + endings), `music_wasteland.mp3` (exploration), `music_combat.mp3` (turn-based combat). Loop seamlessly.

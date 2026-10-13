# Red Front 2026 — assets (what each picture / sound is and how to replace it)

Pictures are **hand-pixelled** (typed as text in `tools/art/xkom/rts.mjs`, packed by `node tools/pixelart.mjs redfront`; same art as X-KOM 2026's RTS half, painted in two team colours). Sounds are **synthesized** (`node tools/gen_xkom_audio.mjs`, shared with X-KOM 2026).
Replace any file at the **same path / same size / same frame grid** and the game uses it. A *spritesheet* = one PNG of equal-size frames (left→right, top→bottom, numbered from 0; sizes also in each `.png.meta.json`). Pixel art is shown at 3× with nearest-neighbour (virtual screen 320×200).

## Pictures — `assets/rts/` (1 map tile = 16×16)
| File | Size | Frame size | Frames |
|---|---|---|---|
| `terrain.png` | 160×16 | 16×16 | 0 grass A · 1 grass B · 2 dirt · 3 water A · 4 water B (animates A↔B) · 5 tree (blocks) · 6 rock (blocks) · 7 ore small · 8 ore rich (harvested for credits) · 9 road (spare). |
| `units.png` | 384×32 | 16×16 | **2 rows = 2 teams** (row 0 Allies blue, row 1 Soviets red). Per row **8 units × 3 frames** in the order `rifle, rocket, ltank, mtank, harv, warrior, spitter, walker` (the last three are X-KOM's aliens and unused here). Per unit: **frame 0 idle / walk step 1 · frame 1 walk step 2 · frame 2 shoot**. Index = `team*24 + unitIndex*3 + state`. Faces right; mirrored for left. |
| `b_fact.png` | 96×48 | 48×48 | Construction Yard (3×3). Frame 0 Allies, frame 1 Soviets. Destroy-all-buildings is the win rule. |
| `b_powr.png` | 64×32 | 32×32 | Power Plant (2×2). Frames: Allies, Soviets. No power plant = production at half speed. |
| `b_barr.png` | 64×32 | 32×32 | Barracks (2×2) — rifle + rocket infantry. Allies, Soviets. |
| `b_weap.png` | 96×32 | 48×32 | War Factory (3×2) — light tank, medium tank, harvester. Allies, Soviets. |
| `b_proc.png` | 96×32 | 48×32 | Refinery (3×2) — ore unloading. Allies, Soviets. |
| `b_gun.png` | 64×16 | 16×16 | Gun Turret (1×1). 4 frames: Allies idle, Allies firing, Soviets idle, Soviets firing. |
| `ui.png` | 128×16 | 16×16 | 0 mouse arrow · 1 attack cursor · 2 selection corners (spare) · 3 move marker. |
| `fx.png` | 128×16 | 16×16 | 0–3 explosion `boom1…boom4` · 4 muzzle/hit spark · 5 acid (unused) · 6 rocket (spare). |
| `assets/ui/font.png` | 96×32 | 6×8 cells | Fallback bitmap font (ASCII 32…95), only used if the TTF fonts fail to load. |
| `assets/fonts/vt323-latin-400-normal.woff2` | font | **VT323** (Google Fonts, OFL): small UI text. |
| `assets/fonts/orbitron-latin-900-normal.woff2` | font | **Orbitron Black** (Google Fonts, OFL): titles. Swap by name; vendored offline via `tools/vendor.mjs`. |

Buildings are drawn so the art sits at the **bottom** of the frame; frame size = footprint × 16. Sidebar icons are frame 0 of each player unit. Sidebar / health bars / selection boxes are rectangles drawn in code.
Team colour ramp (dark, mid, light, highlight): Allies `#1c2a58 #3860b8 #6a98e8 #c0daff`, Soviets `#5a1010 #b02818 #e85a30 #ffb070` — `TEAMS` in `tools/art/xkom/rts.mjs`.

## Audio — `assets/audio/` (replace by name)
`sfx/`: `rifle` (infantry), `cannon` (tank shell), `rocket`, `hit`, `die_human` (infantry death), `explosion` (vehicle/building), `ack` (order acknowledged), `built` (unit ready), `ore` (harvester unloads), `click` `select` `confirm` `error` (UI), `victory`, `defeat`. `music/music_rts.mp3` loops on the title and in the match.

## Regenerating
```
node tools/pixelart.mjs redfront --preview   # PNGs from tools/art (contact sheet: target/art-preview/)
node tools/gen_xkom_audio.mjs                # sfx + music (written under tools/examples/xkom, copied here)
node tools/gen_examples.mjs redfront         # → examples/redfront/
```

# RetroPaxDungeons — assets (how to replace them)

The sprites and dungeon tiles were **redrawn on 2026-10-12** with a Japanese 16-bit dungeon style: bold
silhouettes, bronze and leather equipment, slate sewer masonry, teal water and vivid potions. Nine illustrated sheets
use original artwork from the built-in ImageGen tool; effect markers/slashes and bitmap lettering are hand-drawn.
No Shattered Pixel Dungeon or other game art files were copied. Prompts are preserved in `tools/art/rpd/redrawn/prompts.json`.

The PNGs in `assets/` are what the game loads. Replace a file at the same path with the same size/frame layout.
The existing frame IDs, animation metadata and gameplay remain compatible.

All sprites use **nearest-neighbour** filtering (`"filter":"nearest"`, `display.pixelArt: true`) and are drawn at **16×16 px per tile, shown 3× larger**.
Characters are drawn facing right/front; the game mirrors them for left (`flipX`).

## Pictures

| File | Size | Frames (left → right, top → bottom) | Notes |
|---|---|---|---|
| `assets/tiles/dungeon.png` | 256×16 | 16 tiles, 16×16: 0 void, 1-3 floor, 4 wall face, 5 wall top, 6 mossy wall, 7 wall torch, 8 door closed, 9 door open, 10 stairs down, 11 stairs up, 12-13 water (animated), 14 grass, 15 floor+bones | Frame ids are named in `dungeon.png.meta.json` → `tiles`. *Wall face* is shown where the cell below is floor, *wall top* elsewhere. |
| `assets/sprites/hero.png` | 96×16 | 0-1 idle, 2-3 walk, 4 attack, 5 dead (16×16) | animations: `idle walk attack dead` (meta). Warrior holding a sword on the right side. |
| `assets/sprites/rat.png`, `albino.png` | 64×16 | 0-1 idle, 2 attack, 3 dead (16×16) | pale variant with red eyes |
| `assets/sprites/gnoll.png` | 64×16 | 0-1 idle, 2 attack, 3 dead | Gnoll scout |
| `assets/sprites/crab.png` | 64×16 | 0-1 idle, 2 attack, 3 dead | Sewer crab |
| `assets/sprites/goo.png` | 128×32 | 0-1 idle, 2 pumped-up, 3 dead (**32×32** frames) | Boss. The pumped-up frame is shown while it charges its big attack. |
| `assets/sprites/items.png` | 128×32 | 16×16 icons, 8 per row — names → frame ids in `items.png.meta.json` → `items`: wornSword, sword, mace, clothArmor, leatherArmor, potion_crimson/azure/jade/amber/violet, scroll_rune, scroll_blue, ration, gold, key | Used both on the floor and in the inventory slots. Potion colours and scroll runes are shuffled per run; keep the 5 potion colours distinguishable. |
| `assets/sprites/fx.png` | 96×16 | excl (!), quest (?), zzz (asleep), spark, slash1, slash2 | Markers above monsters, melee slash |
| `assets/ui/ui.png` | 48×16 | heart, slot, slot-selected | HUD |
| `assets/ui/font.png` | 96×32 | **bitmap font**: ASCII 32…95 (space … underscore), 16 columns × 4 rows of **6×8** cells, white glyphs (5×7 px), tinted at runtime | Upper-case only (lower-case is upper-cased). To use another bitmap font keep the 16×4 / 6×8 grid. |

Tip: an easy way to re-skin is to open a sheet in any pixel editor (Aseprite, LibreSprite, Pixelorama, Piskel), keep the canvas size, paint, export PNG over the old file.

## Sound (shared Nord placeholders — replace by file name)

`assets/audio/sfx/`: `hit swing hurt heal death step_stone coin pickup open close magic bell level_up teleport win lose` (mono WAV, 44.1 kHz, short).
`assets/audio/music/`: `music_adventure.mp3` (exploring), `music_boss.mp3` (when the Goo wakes). Replace with any MP3/OGG of the same name or edit the paths in
`scripts/dungeon.js` (search for `assets/audio`).

## Re-packing the artwork (offline)

Reviewed raster masters live in `tools/art/rpd/redrawn/*.rgba.gz` (lossless gzip-compressed RGBA bytes);
`manifest.json` records dimensions and metadata. Hand-drawn effects live in `tools/art/rpd/details.mjs`;
the compact dungeon font is shared with Noom (`tools/art/noom/font.mjs`).

Run `node tools/pixelart.mjs rpd --preview` to restore all eleven PNGs and metadata without an image service.
Then run `node tools/gen_examples.mjs retropaxdungeons` to refresh this example. Preview: `target/art-preview/rpd.png`.
To keep a later manual PNG replacement through re-packing, update its raster master too.

## Credits

Art: Crowelian 2026 + Sonnet; redraw with OpenAI ImageGen and original hand-drawn effects/lettering. Game rules and level logic ported from Shattered Pixel Dungeon (GPL-3.0) — see README.md and THIRD_PARTY.md.

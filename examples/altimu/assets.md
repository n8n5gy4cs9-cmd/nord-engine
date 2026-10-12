# Altimu 5.7 — assets (how to replace them)

Every picture is **hand-pixelled**: one character = one pixel, typed in `tools/art/altimu/*.mjs` in the engine repo and packed to PNG by
`node tools/pixelart.mjs altimu` (no image generation, no noise filters). The PNGs in `assets/` are what the game loads — **replace a file at the same path with the
same size / frame grid and the game uses it.** Everything is 16×16 with nearest-neighbour filtering (`"filter":"nearest"`), shown 2× (32 px) on screen.
Any pixel editor works (Aseprite, LibreSprite, Pixelorama, Piskel): keep the canvas size, paint, export PNG over the old file.

## Pictures

| File | Size | Layout |
|---|---|---|
| `assets/tiles/tiles.png` | 256×64 | 16 columns × 4 rows of **16×16** tiles. Names → frame numbers are in `tiles.png.meta.json` → `tiles` (grass1…forestfloor). *Ground* tiles fill the cell; *object* tiles (tree, pine, bush, rock, stump, fence, well, barrel, crate, chests, bed, table, chair, bookshelf, anvil, forge, counter, stall, lamp, sign, hay, stable, campfire1/2, tent, grave, blood) have a **transparent background** and are drawn over a ground tile. Water and campfire have two animation frames (`water1/2`, `campfire1/2`). |
| `assets/sprites/folk.png` | 96×288 | **One row per person**, 6 frames of 16×16: front A, front B, back A, back B, side A, side B (the *side* frames face **right**; the game mirrors them for left). Row order = `folk.png.meta.json` → `rows`: avatar, iolo, shamino, dupre, finnigan, spark, klog, ellen, guard, weston, villager, villagerf, elder, innkeeper, jaana, merchant, bandit, chief. Add a person: append a row (grow the PNG by 16 px), add its name to `rows`, use it as `sprite:` in `scripts/altimu/data.js`. |
| `assets/sprites/beasts.png` | 96×16 | frames: wolf1, wolf2 (side, faces right), spider1, spider2 (top view), corpse_smith, corpse_gargoyle. Monsters that use a person sprite (bandit, chief) take it from `folk.png`. |
| `assets/sprites/fx.png` | 112×16 | slash, arrow (faces right), spark, hit, miss, cursor (gold corners), bolt |
| `assets/ui/frame.png` | 96×8 | **8×8** pieces of the ornate window frame (drawn at 2×): tl, top, tr, left, fill, right, bl, bottom, br, caret, heart, coin |
| `assets/ui/font.png` | 96×32 | bitmap font: ASCII 32…95 (space … underscore), 16 columns × 4 rows of **6×8** cells, white glyphs (tinted at runtime); upper-case only |

## The map — `assets/maps/trinsic.map`

Plain text. Lines `@ <char> <base tile> <top tile or -> <flags…>` define what each character means; after the `---` line every character is one tile.
Flags: `solid` (blocks), `door` (bump to open; `d` is the open door), `gate`, `water` (blocks, animated with `anim`), `chest`, `search`, `sign`, `anim`.
Edit it in any text editor (keep every row the same length). Trees, buildings and rooms are all in there — see `GUIDE.md` for how to add a town.

## Sound (shared Nord placeholders — replace by file name)

`assets/audio/sfx/`: `step_grass step_stone click error open close swing hit shoot death pickup coin chest heal level_up win lose alarm` (mono WAV).
`assets/audio/music/music_adventure.mp3` (looping) and `jingle_victory.mp3` (ending). Which sound plays when: search for `sfx(` in `scripts/altimu.js`.

## Re-packing the artwork

Edit the grids in `tools/art/altimu/` (`tiles.mjs`, `chars.mjs`, `fx.mjs`), run `node tools/pixelart.mjs altimu --preview` (contact sheets in `target/art-preview/`),
then `node tools/gen_examples.mjs altimu`. If you replace PNGs by hand instead, copy them into `tools/examples/altimu/assets/` so re-generating keeps them.

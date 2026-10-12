# Noom — assets (how to replace them)

All pictures were **redrawn for Noom in a Barony/Doom-inspired style**: gritty sculpted pixel sprites, warm stone, rusty iron,
bone highlights, crimson demons and vivid spell effects. The nine illustrated sheets use original artwork from the built-in
ImageGen tool, reviewed and packed at the existing game resolution. The compact font and red HUD digits are hand-drawn.
No Doom or Barony art files were copied. Prompts are preserved in `tools/art/noom/redrawn/prompts.json` in the engine repo.

The PNGs in `assets/` are what the game loads. Replace a file at the same path with the same size/layout.
Frame names, counts, atlas rectangles and nearest-neighbour filtering are unchanged. Monster feet are aligned to the bottom
of each frame; textures use 64 px per cell (2 m). Audio remains the shared Nord placeholder set.

## Textures (tiled on walls, floors, ceilings, doors)

| File | Size | Layout (left → right, top → bottom; every tile 64×64) |
|---|---|---|
| `assets/textures/walls.png` | 256×64 | brick (cracked) · mossy brick · crypt (skull frieze) · hell wall (flesh bricks + rune) |
| `assets/textures/surfaces.png` | 256×128 | row 1: stone floor · blood-stained floor · hell floor · ceiling — row 2: wooden door · blue-key door · exit gate (portal) · door track (door sides) |

Tiles must be **seamless** where they repeat (walls repeat horizontally every cell; floors every cell).

## Monsters (front-facing billboards; 9 frames in a row, all frames the same size)

Frame order for every monster sheet: `stand, walk1, walk2, windup/aim, attack/shoot, pain, die1, die2, die3` (see each meta → `frames`). The walk cycle is stand→walk1→stand→walk2.
Feet must sit on the **bottom row** of the frame; the game scales a sprite by its frame height.

| File | Frame size | Monster |
|---|---|---|
| `assets/sprites/skeleton.png` | 32×48 | Skeleton Archer (shoots arrows) |
| `assets/sprites/goblin.png` | 32×40 | Goblin (fast melee) |
| `assets/sprites/imp.png` | 40×52 | Imp (fireballs + claws) |
| `assets/sprites/baron.png` | 64×72 | Baron of Barony (boss) |

## Props, pickups, projectiles, effects — `assets/sprites/props.png` (atlas)

A free-form atlas; every sprite's rectangle `[x, y, w, h]` is listed in `props.png.meta.json` → `rects`: torch1/torch2 (flame flicker), barrel (powder keg), bones, flaskSmall (+10 HP),
flaskBig (+25 HP), shells (ammo box), armor (iron cuirass), key (blue key), gun (blunderbuss pickup), impBall/impBall2, baronBall/baronBall2 (projectile flicker), arrow, puff1/puff2 (bullet impact),
boom1-3 (explosion), blood1-3. Keep the names; you may resize a rect if you update it (the sprite is scaled by height from the table in `scripts/noom/sim.js`/`render.js`).

## First-person weapons — `assets/sprites/weapons.png`

7 frames of **80×80** (redrawn with chunky Doom-style shading): `mace_idle, mace_swing1, mace_swing2, gun_idle, gun_fire, gun_pump1, gun_pump2`.
Drawn on a 320×180 virtual screen, bottom-centre.

## HUD — `assets/ui/hud.png` (atlas) and `assets/ui/font.png`

`hud.png.meta.json` → `rects`: plate (16×16 status-bar tile), box (54×25 inset), faceFrame, crosshair, face0-6 (24×26: 100-80%, 80-60, 60-40, 40-20, <20, dead, ouch), d0-d9 + dpct (8×11 big red digits).
`font.png`: bitmap font, ASCII 32…95, 16 columns × 4 rows of **6×8** cells, white glyphs (tinted at runtime), upper-case only.

## Sound (shared Nord placeholders — replace by file name)

`assets/audio/sfx/*.wav`: shoot, swing, hit, hurt, death, explosion, explosion_small, pickup, powerup, open, close, magic, laser, reload, error, win, step_stone, lose.  Music: `assets/audio/music/music_action.mp3` (level), `music_boss.mp3` (when the Baron wakes).
Which sound plays for which event is the table at the top of `scripts/noom.js` (`SFX`).

## Re-packing the artwork (offline)

Reviewed raster masters live in `tools/art/noom/redrawn/*.rgba.gz`: lossless gzip-compressed RGBA bytes,
with dimensions and metadata in `manifest.json`. The bitmap font lives in `tools/art/noom/font.mjs`.

Run `node tools/pixelart.mjs noom --preview` to restore all ten PNGs and metadata without calling an image service;
then `node tools/gen_examples.mjs noom` to refresh the playable example. The contact sheet is `target/art-preview/noom.png`.
To keep a later manual PNG replacement through re-packing, update its raster master too.

## Credits

Art: Crowelian 2026 + Sonnet; 2026-10-12 redraw with OpenAI ImageGen and original hand-drawn lettering. Rules/AI ported from id Software's DOOM source (GPL-2.0); setting inspired by Barony — see README.md and THIRD_PARTY.md.

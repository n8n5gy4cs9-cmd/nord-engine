import { E, project } from '../lib.mjs';

const SFX = ['shoot', 'swing', 'hit', 'hurt', 'death', 'explosion', 'explosion_small', 'pickup', 'powerup', 'open', 'close', 'magic', 'laser', 'reload', 'error', 'win', 'step_stone', 'lose'];
const ASSETS_MD = `# Noom — assets (how to replace them)

All pictures are **original, hand-drawn pixel art** (one character = one pixel, typed by hand in \`tools/art/noom/*.mjs\` — no procedural generation,
no AI-image output). The PNGs in \`assets/\` are what the game loads. **Replace any file by dropping a new one at the same path with the same
size/layout** — the game reads sizes from the \`*.meta.json\` next to each PNG, so if you change frame counts or sizes, edit the meta too.
Everything is drawn with nearest-neighbour filtering, 64 px = 1 cell (2 m) so wall/floor textures and sprites share the same pixel density.

## Textures (tiled on walls, floors, ceilings, doors)

| File | Size | Layout (left → right, top → bottom; every tile 64×64) |
|---|---|---|
| \`assets/textures/walls.png\` | 256×64 | brick (cracked) · mossy brick · crypt (skull frieze) · hell wall (flesh bricks + rune) |
| \`assets/textures/surfaces.png\` | 256×128 | row 1: stone floor · blood-stained floor · hell floor · ceiling — row 2: wooden door · blue-key door · exit gate (portal) · door track (door sides) |

Tiles must be **seamless** where they repeat (walls repeat horizontally every cell; floors every cell).

## Monsters (front-facing billboards; 9 frames in a row, all frames the same size)

Frame order for every monster sheet: \`stand, walk1, walk2, windup/aim, attack/shoot, pain, die1, die2, die3\` (see each meta → \`frames\`). The walk cycle is stand→walk1→stand→walk2.
Feet must sit on the **bottom row** of the frame; the game scales a sprite by its frame height.

| File | Frame size | Monster |
|---|---|---|
| \`assets/sprites/skeleton.png\` | 32×48 | Skeleton Archer (shoots arrows) |
| \`assets/sprites/goblin.png\` | 32×40 | Goblin (fast melee) |
| \`assets/sprites/imp.png\` | 40×52 | Imp (fireballs + claws) |
| \`assets/sprites/baron.png\` | 64×72 | Baron of Barony (boss) |

## Props, pickups, projectiles, effects — \`assets/sprites/props.png\` (atlas)

A free-form atlas; every sprite's rectangle \`[x, y, w, h]\` is listed in \`props.png.meta.json\` → \`rects\`: torch1/torch2 (flame flicker), barrel (powder keg), bones, flaskSmall (+10 HP),
flaskBig (+25 HP), shells (ammo box), armor (iron cuirass), key (blue key), gun (blunderbuss pickup), impBall/impBall2, baronBall/baronBall2 (projectile flicker), arrow, puff1/puff2 (bullet impact),
boom1-3 (explosion), blood1-3. Keep the names; you may resize a rect if you update it (the sprite is scaled by height from the table in \`scripts/noom/sim.js\`/\`render.js\`).

## First-person weapons — \`assets/sprites/weapons.png\`

7 frames of **80×80** (drawn at 40×40 and doubled for chunky Doom pixels): \`mace_idle, mace_swing1, mace_swing2, gun_idle, gun_fire, gun_pump1, gun_pump2\`.
Drawn on a 320×180 virtual screen, bottom-centre.

## HUD — \`assets/ui/hud.png\` (atlas) and \`assets/ui/font.png\`

\`hud.png.meta.json\` → \`rects\`: plate (16×16 status-bar tile), box (54×25 inset), faceFrame, crosshair, face0-6 (24×26: 100-80%, 80-60, 60-40, 40-20, <20, dead, ouch), d0-d9 + dpct (8×11 big red digits).
\`font.png\`: bitmap font, ASCII 32…95, 16 columns × 4 rows of **6×8** cells, white glyphs (tinted at runtime), upper-case only.

## Sound (shared Nord placeholders — replace by file name)

\`assets/audio/sfx/*.wav\`: ${SFX.join(', ')}.  Music: \`assets/audio/music/music_action.mp3\` (level), \`music_boss.mp3\` (when the Baron wakes).
Which sound plays for which event is the table at the top of \`scripts/noom.js\` (\`SFX\`).

## Re-packing the pixel-art sources (optional)

The drawings live as text in \`tools/art/noom/\` of the Nord Engine repo; \`node tools/pixelart.mjs noom --preview\` packs them into these PNGs (+ a contact sheet at
\`target/art-preview/noom.png\`) and \`node tools/gen_examples.mjs noom\` regenerates this folder. If you replaced PNGs by hand, do **not** re-run the packer.

## Credits

Art: Crowelian 2026 + Sonnet (original). Rules/AI ported from id Software's DOOM source (GPL-2.0); setting inspired by Barony — see README.md and THIRD_PARTY.md.
`;

const input = { fwd: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'], turnL: ['ArrowLeft', 'KeyQ'], turnR: ['ArrowRight'], run: ['ShiftLeft', 'ShiftRight'], fire: ['Mouse0', 'ControlLeft', 'KeyF'], use: ['Space', 'KeyE'], w1: ['Digit1'], w2: ['Digit2'], map: ['Tab'], restart: ['KeyR'] };

export default () => ({
  name: 'Noom',
  project: project('noom', 'Noom', '3d', { w: 1280, h: 720, bg: '#000000', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('Player', { pos: [7.5, 0.6, -31.5], s: ['scripts/noom.js', ['scripts/mouse-capture.js', { hint: false }]], kids: [E('Camera', { c: [{ type: 'camera', fov: 60, near: 0.03, far: 80 }] })] })] } },
  lib: ['mouse-capture'],
  assets: [...SFX.map((n) => `assets/audio/sfx/${n}.wav`), 'assets/audio/music/music_action.mp3', 'assets/audio/music/music_boss.mp3'],
  files: { 'assets.md': ASSETS_MD },
  readme: `# Noom — Crypt of the Baron
A one-level first-person shooter proof of concept: **Doom's gameplay in a Barony-style crypt.** Fight skeleton archers, goblins and imps through the Hall of Columns,
grab the blunderbuss, find the **blue key**, open the blue door and kill the **Baron of Barony**, then step through the exit gate. Blow up the powder kegs (they chain!),
find the secret alcove behind the start crypt's north wall (look for the mossy brick; press Space/E on it).

**Controls** — WASD move, mouse or ←/→ turn, Shift run, click / Ctrl / F fire, Space or E use (doors, secret walls, exit gate), 1 mace, 2 blunderbuss, Tab automap, R restart, Esc pause.

**Ported from DOOM** (id Software, GPL-2.0, https://github.com/id-software/doom): the \`P_Random\` table, monster think logic (\`A_Look\`, \`A_Chase\`, \`P_NewChaseDir\`, \`P_Move\`, melee/missile range rolls, pain chance and threshold),
mobjinfo stats (Imp, Baron of Hell, Zombieman, Demon), attack damage formulas, shotgun spread (7 pellets, 5×(1-3)), armor absorption (⅓), barrel blast radius (\`P_RadiusAttack\`), sound-wakes-monsters (\`P_NoiseAlert\`),
Doom's 35 Hz tic rate and door timing. **From Barony** (TurningWheel/Barony, GPL-3.0): the setting and monster roster (skeletons, goblins, crypt/dungeon look); no Barony code or art is used — Barony's code is a different engine (SDL/OpenGL, voxels).
Simplified: grid-based map instead of BSP/linedefs, front-facing sprites (no 8-way rotations), one hand-designed level, no infighting.
All **art is original and hand-drawn** — see \`assets.md\` to replace it. Derived from Doom code, this example is **GPL-2.0-or-later**.

Code: \`scripts/noom.js\` (glue), \`scripts/noom/sim.js\` (rules), \`render.js\` (Babylon level + billboards), \`hud.js\` (canvas HUD), \`level.js\` (the level). Headless test: \`node tools/noom-sim.mjs\`.
`,
});

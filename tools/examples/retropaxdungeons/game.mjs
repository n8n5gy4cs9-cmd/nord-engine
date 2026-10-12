import { E, project } from '../lib.mjs';

const ASSETS_MD = `# RetroPaxDungeons — assets (how to replace them)

Every picture in this game is **original, hand-drawn pixel art** (one character = one pixel, typed by hand in \`tools/art/rpd/*.mjs\`;
no procedural/Python generation). The PNGs in \`assets/\` are what the game loads. **To replace any asset, drop a new file at the same path
with the same size/frame layout** — nothing is referenced by hash. Sprite sheets are plain horizontal strips (or grids) of equally sized
frames; the \`.meta.json\` next to each PNG tells the engine the frame size and animations — edit it if you change frame counts.

All sprites use **nearest-neighbour** filtering (\`"filter":"nearest"\`, \`display.pixelArt: true\`) and are drawn at **16×16 px per tile, shown 3× larger**.
Characters are drawn facing right/front; the game mirrors them for left (\`flipX\`).

## Pictures

| File | Size | Frames (left → right, top → bottom) | Notes |
|---|---|---|---|
| \`assets/tiles/dungeon.png\` | 256×16 | 16 tiles, 16×16: 0 void, 1-3 floor, 4 wall face, 5 wall top, 6 mossy wall, 7 wall torch, 8 door closed, 9 door open, 10 stairs down, 11 stairs up, 12-13 water (animated), 14 grass, 15 floor+bones | Frame ids are named in \`dungeon.png.meta.json\` → \`tiles\`. *Wall face* is shown where the cell below is floor, *wall top* elsewhere. |
| \`assets/sprites/hero.png\` | 96×16 | 0-1 idle, 2-3 walk, 4 attack, 5 dead (16×16) | animations: \`idle walk attack dead\` (meta). Warrior holding a sword on the right side. |
| \`assets/sprites/rat.png\`, \`albino.png\` | 64×16 | 0-1 idle, 2 attack, 3 dead (16×16) | albino = same drawing, other palette |
| \`assets/sprites/gnoll.png\` | 64×16 | 0-1 idle, 2 attack, 3 dead | Gnoll scout |
| \`assets/sprites/crab.png\` | 64×16 | 0-1 idle, 2 attack, 3 dead | Sewer crab |
| \`assets/sprites/goo.png\` | 128×32 | 0-1 idle, 2 pumped-up, 3 dead (**32×32** frames) | Boss. The pumped-up frame is shown while it charges its big attack. |
| \`assets/sprites/items.png\` | 128×32 | 16×16 icons, 8 per row — names → frame ids in \`items.png.meta.json\` → \`items\`: wornSword, sword, mace, clothArmor, leatherArmor, potion_crimson/azure/jade/amber/violet, scroll_rune, scroll_blue, ration, gold, key | Used both on the floor and in the inventory slots. Potion colours and scroll runes are shuffled per run; keep the 5 potion colours distinguishable. |
| \`assets/sprites/fx.png\` | 96×16 | excl (!), quest (?), zzz (asleep), spark, slash1, slash2 | Markers above monsters, melee slash |
| \`assets/ui/ui.png\` | 48×16 | heart, slot, slot-selected | HUD |
| \`assets/ui/font.png\` | 96×32 | **bitmap font**: ASCII 32…95 (space … underscore), 16 columns × 4 rows of **6×8** cells, white glyphs (5×7 px), tinted at runtime | Upper-case only (lower-case is upper-cased). To use another bitmap font keep the 16×4 / 6×8 grid. |

Tip: an easy way to re-skin is to open a sheet in any pixel editor (Aseprite, LibreSprite, Pixelorama, Piskel), keep the canvas size, paint, export PNG over the old file.

## Sound (shared Nord placeholders — replace by file name)

\`assets/audio/sfx/\`: \`hit swing hurt heal death step_stone coin pickup open close magic bell level_up teleport win lose\` (mono WAV, 44.1 kHz, short).
\`assets/audio/music/\`: \`music_adventure.mp3\` (exploring), \`music_boss.mp3\` (when the Goo wakes). Replace with any MP3/OGG of the same name or edit the paths in
\`scripts/dungeon.js\` (search for \`assets/audio\`).

## Editing the pixel-art sources (optional)

The drawings live as text in \`tools/art/rpd/\` of the Nord Engine repo (\`tiles.mjs\`, \`chars.mjs\`, \`items.mjs\`); \`node tools/pixelart.mjs rpd --preview\`
packs them into the PNGs above (and writes a contact sheet to \`target/art-preview/rpd.png\`). Then \`node tools/gen_examples.mjs retropaxdungeons\`
regenerates this folder. If you replace PNGs by hand, do **not** re-run the packer afterwards (it would overwrite your files).

## Credits

Art: Crowelian 2026 + Sonnet (original). Game rules and level logic ported from Shattered Pixel Dungeon (GPL-3.0) — see README.md and THIRD_PARTY.md.
`;

const input = {
  left: ['KeyA', 'ArrowLeft', 'Numpad4'], right: ['KeyD', 'ArrowRight', 'Numpad6'], up: ['KeyW', 'ArrowUp', 'Numpad8'], down: ['KeyS', 'ArrowDown', 'Numpad2'],
  ul: ['KeyQ', 'Numpad7'], ur: ['KeyE', 'Numpad9'], dl: ['KeyZ', 'Numpad1'], dr: ['KeyC', 'Numpad3'],
  rest: ['Space', 'Period', 'Numpad5'], restart: ['KeyR'], click: ['Mouse0'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`use${n}`, [`Digit${n}`]])),
};

export default () => ({
  name: 'RetroPaxDungeons',
  project: project('retropaxdungeons', 'RetroPaxDungeons', '2d', { w: 960, h: 540, pixelArt: true, bg: '#0d0a14', physics: { engine: 'none', gravity: [0, 0, 0] }, input }),
  scenes: { main: { entities: [E('Dungeon', { s: ['scripts/dungeon.js'] })] } },
  assets: [...['hit', 'swing', 'hurt', 'heal', 'death', 'step_stone', 'coin', 'pickup', 'open', 'close', 'magic', 'bell', 'level_up', 'teleport', 'win', 'lose'].map((n) => `assets/audio/sfx/${n}.wav`), 'assets/audio/music/music_adventure.mp3', 'assets/audio/music/music_boss.mp3'],
  files: { 'assets.md': ASSETS_MD },
  readme: `# RetroPaxDungeons
A one-level, turn-based roguelike proof of concept in the spirit of **Shattered Pixel Dungeon**: a sewer level (depth 5) with rats, gnoll scouts and crabs,
sleeping and wandering monsters, fog of war, unidentified potions and scrolls, hunger — and the **Goo** boss, which heals in water and pumps itself
up for triple-damage slams. Kill the Goo, then take the stairs down.

**Controls** — arrows / WASD move or attack (bump), Q E Z C diagonals, Space rest, 1-8 use / equip items, mouse click = travel (click a monster to attack), R new game (\`?seed=N\` replays a level).

**What is ported from Shattered Pixel Dungeon** (GPL-3.0, https://github.com/00-Evan/shattered-pixel-dungeon): \`ShadowCaster\` field of view, \`PathFinder\` BFS, \`Patch\` water/grass
generation, \`Char.hit/attack\` combat maths (accuracy vs. evasion, damage − armour DR, \`NormalIntRange\`), the \`Mob\` AI states (sleeping / wandering / hunting with
SPD's noticing odds), Rat/Gnoll/Crab/Goo stats and Goo's pump-up + water-healing behaviour, hero levelling and regeneration, weapon/armour strength penalties.
**Simplified:** one hand-written room-and-door generator instead of SPD's builders, no buffs system, no ranged items.
All **art is original and hand-drawn** — see \`assets.md\` to replace it. Because it derives from SPD code, this example is **GPL-3.0**.

Code: \`scripts/dungeon.js\` (Phaser view + input + HUD) and \`scripts/rpd/*.js\` (pure rules; headless balance test: \`node tools/rpd-sim.mjs\`).
`,
});

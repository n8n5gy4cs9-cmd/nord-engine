# Harrison's Command — assets (how to replace them)

Everything the game loads lives in `assets/`. **Replace a file at the same path** and the game uses it; no code changes needed unless noted.

## Models (`assets/models/*.glb`, glTF binary, +Y up, **+Z = forward/bow**, metres)

| File | What | Notes |
|---|---|---|
| `carrier.glb` | the carrier: hull, deck, command centre with glass windows, bridge tower, radar, consoles, cargo, rails | Generated. Materials are matched **by name** — `deck`, `hull`, `wall`, `floor` get the PNG textures below, `glass` is transparent. If you replace it with your own model keep the walls/consoles where `scripts/hc/layout.js` says (they are the collision boxes and screen positions), or edit that file. |
| `walrus.glb` | amphibious tank; the child node named `turret` rotates to aim | ≈ 3.2 × 6 m, +Z forward |
| `manta.glb` | flying gunship | ≈ 9 × 6 m |
| `tower.glb` | enemy gun tower; child node `head` rotates | |
| `mortar.glb` | enemy mortar pit; child node `head` rotates | |
| `island_alpha/beta/gamma.glb` | terrain with vertex colours (sand/grass/rock) | The *gameplay* height of the ground comes from `islandHeight()` in `layout.js` — keep a replacement island's silhouette close to it, or edit that function. |
| `kenney/fps/` | blaster, enemy-flying drone (Kenney Starter-Kit-FPS, MIT) | |
| `kenney/city/` | enemy base buildings, trees (Starter-Kit-City-Builder, MIT) | |
| `kenney/racing/` | two trucks parked on the deck (Starter-Kit-Racing, MIT) | |
| `kenney/platformer/` | the player character the *other* player sees (Starter-Kit-3D-Platformer, MIT) | |

Each Kenney folder has its own `Textures/colormap.png` — keep it next to the `.glb` files (glTF refers to it by relative path).
Regenerate the generated models any time: `node tools/gen_harrison_models.mjs` (engine repo) → copy via `node tools/gen_examples.mjs harrison`.

## Textures (`assets/textures/*.png`, 32×32, seamless, nearest-neighbour)

`deck.png` (steel deck plates) · `hull.png` (riveted hull) · `wall.png` (bulkhead panels) · `floor.png` (diamond plate) · `water.png` (sea, scrolls slowly).
They tile every 4 m on the carrier (16 m for the sea). Any size works (power of two is best); keep them tileable.

## Interface (`assets/ui/map-icons.png`, 160×16 = ten 16×16 icons, order: carrier, walrus, manta, tower, hq, waypoint, cursor, select, drone, mortar)

Used on the map screens (they point up = north). Order is fixed in `ICON` at the top of `scripts/harrison.js`.

## Sound

`assets/audio/kenney/` — `blaster_repeater.ogg` (your gun), `enemy_attack.ogg`, `enemy_destroy.ogg`, `blaster.ogg`, `enemy_hurt.ogg` (Kenney FPS kit).
`assets/audio/sfx/*.wav` — shared Nord placeholders: `hit shoot explosion explosion_small missile whoosh splash click open close lose`. Music: `assets/audio/music/music_action.mp3`, `jingle_victory.mp3`.
Which sound plays for which event is in `handleEvents()` in `scripts/harrison.js`.

## Re-packing the hand-drawn art

`tools/art/harrison/index.mjs` holds the pixel grids (one character = one pixel; each texture is two drawn 16×16 tiles laid ABBA). Run `node tools/pixelart.mjs harrison --preview`.

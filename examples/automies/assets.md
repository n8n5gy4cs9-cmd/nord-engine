# Automies — assets (how to replace them)

Everything the game loads lives in `assets/`. **Replace a file at the same path** and the game uses it; no code changes needed unless noted. Models are glTF binary (`.glb`), **+Y up, +Z = front of a car**, metres; the city is 25×21 tiles of 18 m.

## Cars (`assets/models/*.glb`) — generated low-poly (`node tools/gen_automies_models.mjs`)

| File | What | Notes |
|---|---|---|
| `muscle.glb` | player 1's car (4.7 m) | Materials matched **by name**: `body` is tinted per car from `scripts/am/cars.js` (`color`) — so keep it white; `glass`, `light`, `tail`, `chrome`, `tire`, `dark`, `black`, `stripe`, `white` are plain colours. |
| `coupe.glb` | player 2's car | same naming |
| `cop.glb` | police cruiser | `redLight` / `blueLight` materials flash (the game animates their emissive colour) — keep those names on the light bar |
| `taxi.glb`, `van.glb` | civilian traffic | |
| any car | | **Wheels must be child nodes named `wheel-fl`, `wheel-fr`, `wheel-bl`, `wheel-br`** (pivot at the wheel centre, +Z front) — the game steers the front ones and spins all four. Kenney's `wheel-front-left`… names also work. Set `length`, `width`, `wheelbase`, `track` in `cars.js` to match the model (they drive the physics and collision box). |

To add a car: drop `mycar.glb` in `assets/models/`, add `'mycar'` to the `OWN` list at the top of `scripts/automies.js`, add an entry to `CARS` in `scripts/am/cars.js` (`model: 'mycar'`, power, grip class `hnd`, size) — and list it in `CIVILIAN` to put it in traffic.

## City models

| File | What |
|---|---|
| `tower_a…d.glb` | generated downtown towers (materials `facadeA…D` + `roof`, `concrete`, `dark`, `metal`, `white`) — map characters `1 2 3 4` |
| `bank.glb`, `warehouse.glb`, `safehouse.glb` | landmarks — `B`, `H`, `S` |
| `tree.glb`, `hydrant.glb`, `bin.glb`, `barrier.glb`, `cone.glb` | street props (placed by `city.js`: hydrants/bins along roads, roadworks from `W` lines, trees in parks) |
| `crate.glb`, `bench.glb`, `billboard.glb` | extra props, not placed yet — see the guide |
| `kenney/city/*.glb` | **Kenney City Kit** (MIT): `road-straight(-lightposts), road-corner, road-split, road-intersection, pavement(-fountain), grass, building-small-a…d, building-garage` (a-d and garage = map characters `a b c d y`). Keep `kenney/city/Textures/colormap.png` next to them. |
| `kenney/racing/*.glb` | **Kenney Racing Kit** trucks used by civilian traffic (`truck-red/green/purple`); `Textures/colormap.png` alongside. |

Regenerate the generated models any time: `node tools/gen_automies_models.mjs` → `node tools/gen_examples.mjs automies`. The Kenney files come from `tools/fetch-automies-assets.sh` (re-runnable).

## Textures (`assets/textures/*.png`, hand-pixelled, 16×16 unless noted, nearest-neighbour, seamless)

| File | Used by |
|---|---|
| `facadeA.png` concrete + blue windows · `facadeB.png` red brick · `facadeC.png` blue glass curtain wall · `facadeD.png` sandstone with sills | the tower models (4 m per repeat horizontally, 2 floors per repeat) |
| `roof.png`, `concrete.png`, `metal.png`, `marble.png`, `container.png` | roofs/plinths, harbour quay, warehouse walls, bank columns, shipping containers |
| `pavement.png` | the ground under the whole city |
| `water.png` (32×32) | harbour water (scrolls slowly) |

Materials in the `.glb` files get their texture **by name** (`facadeA`, `roof`, …, see `TEXTURES` in `scripts/automies.js`); a new texture needs its name added there and a material of that name in a model. Any size works (power of two is best); keep them tileable.
Re-pack the hand-drawn art: `node tools/pixelart.mjs automies --preview` (grids in `tools/art/automies/*.mjs`, one character = one pixel).

## Interface (`assets/ui/`)

`icons.png` — 128×16 = frames of 16×16: `damage, felony, flag, clock, siren, arrow, car, gear` (the HUD uses damage, felony, flag, siren and arrow). `font.png` — shared 6×8 bitmap font (kept for your own text; the HUD uses the system monospace font).

## The city — `assets/maps/haven.map`

Plain text. `@` lines are notes. `C x y` = checkpoint (cell, in order; the last one is the safehouse), `P slot x y yawDeg offX offZ` = start position, `K x y` = cop spawn cell (informational), `W x y` = roadworks on a straight road cell (a barrier across the right-hand lane
and cones; traffic and police route around it). After `---` each character is one 18 m tile (x = east, y = south = world +Z):

| char | meaning | char | meaning |
|---|---|---|---|
| `+` | road (the right Kenney piece and rotation are chosen from the neighbours) | `.` | pavement / pier |
| `~` | water (solid) | `g` | park (grass: half the tyre grip; trees are solid) |
| `f` | fountain | `1 2 3 4` | towers A–D |
| `a b c d y` | Kenney buildings (small a–d, garage) | `B` `H` `S` | bank, warehouse, safehouse |

## Sound

`assets/audio/kenney/` (Kenney, MIT): `engine.ogg` (looped; its pitch follows the ported rev model), `skid.ogg` (looped, volume follows tyre slip), `impact.ogg` (crashes), `ambience.ogg` (city ambience). `assets/audio/sfx/*.wav` (shared Nord placeholders): `checkpoint tick confirm explosion explosion_small spawn win lose`;
music `assets/audio/music/music_action.mp3`. The **police siren and the horn are synthesised** at run time with WebAudio oscillators (`ensureSiren()` in `automies.js`) — replace them by `audio.play(file)` calls if you prefer samples. Which sound plays when: search `sfx(` / `sfxK(` in `scripts/automies.js`.

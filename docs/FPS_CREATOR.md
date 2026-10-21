# FPS Creator addon (M12)

A grid-based **first-person level editor + game runtime** for Nord, modelled on the workflow of *FPS Creator Classic* (segment/entity based building, ready-made enemies and pickups, attachable scripts, in-editor testing) — but written from scratch for Nord. It is an **addon**: nothing in the existing editor, runtimes or exports changes; a project opts in by installing it (`nord fpsc init`, the editor's **FPS Level ▸ Add FPS Creator** button, or the **FPS Creator** template).

> **Licence note.** The upstream project (Dark-Basic-Software-Limited/FPS-Creator-Classic) is published without an open-source licence (personal, non-commercial compile-and-run only). **No code, models, textures, sounds or file formats were copied**; only the general workflow (grid segments, entity bank, script attachment, test-level button, markers/lights/triggers/waypoints) inspired this addon. All art is procedural; all code is original (ADR-026, `THIRD_PARTY.md`).

## At a glance
| Piece | Where | What |
|---|---|---|
| **Level editor** | `editor/fpsc/` (served at `/editor/fpsc/index.html`; the editor's **FPS Level** tab embeds it) | 2D map + live 3D preview, palettes, inspector, assets, play-test (F5) |
| **Runtime** | `runtime/fpsc/` → copied into projects as `scripts/fpsc/` | level builder, baked lighting, collision, AI, weapons, HUD, scripts, rules |
| **Level files** | `<project>/levels/*.fpsl.json` | plain JSON (format below) |
| **Your content** | `<project>/fpsc/` (`bank.json`, `textures/`, `art/`, `models/`, `sounds/`, `scripts/`) | custom textures, pieces, entities, scripts… |
| **Rust glue** | `nord-core::fpsc`, `nord-serve` `/api/fpsc/*`, `nord fpsc init`, `panels/fps.rs` | install + jailed file API + editor tab |
| **Template / example** | `templates/fps-creator`, `examples/fps-creator` (source `tools/examples/fps-creator/`, demo level `tools/gen_fpsc_level.mjs`) | a playable "Outpost Zero" demo |

## Concepts
* **Grid.** 1 cell = **4 m**; 1 storey (layer) = **3.2 m**. Level size up to 256×256 cells, any number of layers (storeys).
* **Edge pieces ("segments").** Walls, doors, windows, arches, fences… sit on the **edge between two cells** (`H` edges run east–west at `z = k·4`, `V` edges north–south at `x = k·4`). A piece (what shape) and a texture (what it looks like) are chosen separately, so every piece works with every texture.
* **Cells.** Floor texture, ceiling texture, floor height (`h`, steps/platforms/pits), stairs/ramps (`s`), pillars/blocks (`p`). A missing floor is a hole; a missing ceiling is open sky.
* **Entities.** Everything else: player start, enemies, pickups, lights, props, trigger zones… Each has a position, rotation, optional name/tag/target, properties, **scripts** and **rules**.
* **Scripts.** One JS file = one behaviour; attach any number to any entity. **Rules** are the no-code alternative (*when → do → target*).
* **Baked lighting.** Static lights are baked into vertex colours with real occlusion (walls block light; thousands of lights are free). Lights that are named/targeted/scripted become *dynamic* (up to 8 nearest feed the shader per frame).
* **Everything is data.** The editor and runtime share one **bank** (textures, pieces, entities, models, scripts, weapons, sounds). Add your own in JSON — no engine rebuild.

## Using the editor
Open a project → **FPS Level** tab (or `nord serve .` → `/editor/fpsc/index.html`). The page works in any browser; inside Nord it uses the project server's jailed file API (`levels/` and `fpsc/` only).

### Tools (hotkeys)
| Key | Tool | How |
|---|---|---|
| `V` | Select | click = select · drag empty space = box select · drag item = move · `Del` · `Q/E` rotate · arrows nudge · `Ctrl+C/X/V/D` |
| `W` | Wall | click an edge, or drag between grid points to draw a line; Shift = erase. Pick piece + texture in **Build** |
| `R` | Room | drag a rectangle → floor + ceiling + wall ring (Build ▸ Room options) |
| `F` / `C` | Floor / Ceiling paint | drag (Ctrl = rectangle, Shift = erase / open sky) |
| `G` | Fill | flood-fills the connected region (walls stop it) |
| `S` | Stairs · height · pillars | click a cell; for stairs drag toward the direction they climb |
| `A` | Add item | pick in **Items**, click the map (or drag the card onto it); `Q/E` rotate; Alt = free; Ctrl = cell centre |
| `P` | Path | patrol waypoints of the selected enemy |
| `X` | Erase | click or drag a rectangle |
| `I` / Alt+click | Eyedropper | copies texture / piece / item type |
Other: wheel zoom, middle/right-drag or Space-drag pans, `Home` fits, `PageUp/Down` storey, `Tab` 2D/split/3D, `F5` play-test, `Shift+F5` from cursor, `Ctrl+S` save, `Ctrl+Z/Y` undo/redo (snapshot history), `F1` help.

### Palettes
* **Build** — material slots (wall, back side, trim, door leaf, floor, ceiling) + 35 procedural textures; 25 wall pieces drawn with *your chosen textures*; room options; stairs/height/pillar options.
* **Items** — categories **Markers, Triggers, Enemies, Allies, Pickups, Lights, Props** (≈ 75 ready-made entities; see below).
* **Scripts** — the script library with descriptions and parameters; drag a script card onto an entity to attach it.
* **Level** — name, size, sky (day/dusk/night/overcast/void/custom), ground, fog, ambient light, intro text, objective, time limit, music, next level, layer manager, 3D preview options.
* **Objects** — searchable list of placed entities across all storeys or the current storey. Search by name, tag, type, id or attached script; click to select and centre the map, Shift-click to toggle selection, double-click to focus the 3D preview.
* **Assets** — add textures, sprite/3D-model entities, sounds and scripts (rules below).

Placement grid: choose **0.25, 0.5 (default), 1, 2 or 4 m** beside Snap. It applies to entities, drag movement and drawn waypoints. Snap off permits free placement; Ctrl retains the existing cell-centre placement shortcut. Build cells and wall edges retain their 4 m grid.

### Inspector
*General* (name, tag, target, rotation, height, position, layer) · *Properties* (from the entity's schema) · *Patrol path* · **Scripts** (default scripts with editable parameters, enable/disable, remove, attach more) · **Rules** (no-code logic). Wall pieces: type, front/back/trim/door textures, flip; doors: **name**, **key lock** (red/blue/yellow/green), auto-open, stay-open time. Cells: floor/ceiling/height/stairs/pillar. Multiple selection: copy, duplicate, delete, rotate.

The **Patrol path** inspector exposes each waypoint’s X/Z coordinates and wait in seconds (default 0.8). Move points earlier/later, insert a midpoint after a point, remove points or reverse the route. Changes use normal undo/redo and save in the existing `[x,z,wait]` format. Drawing and Shift-click removal remain available.

### Play-test
`F5` runs the **unsaved** level in an overlay (iframe of `play.html`; the editor posts the level over `postMessage`). `Shift+F5` starts at the cursor or selected item. Script errors and warnings appear in the editor's console. `Esc` leaves pointer-lock → pause menu → Quit. **Shift+Esc** (default) or the top-right **Close test** button closes the test directly, including while the game iframe has focus.

### Configurable test shortcuts
Whole-editor **Settings** has **FPS Level: Test**, **Test from here**, and **Stop test**: enter a key name and select Shift/Cmd-Ctrl/Alt modifiers. Defaults are F5, Shift+F5 and Shift+Escape. Close Settings to save; the embedded editor and an already-running test receive changes without navigation or loss of unsaved work. Invalid key names fall back to defaults; use distinct bindings. Stop wins duplicate bindings, and test-start bindings override FPS tools (except while typing).

**Reset shortcuts to defaults** restores main-editor Run/Stop plus these three FPS bindings, keeping other settings. **Open in browser** receives current bindings in its opening URL; reopen separate browser pages after changes. Direct server URLs use defaults. Main-editor Play remains a separate project run, reading the saved level specified by its start scene; save level + scene before checking it.

Illustrated user guide: manual chapter 28 (`docs/manual-src/28-fps-creator.md`), tutorial T27, and **FPS Level — quick reference** under Guides.

### Problems checker (✓ button)
Missing player start, no exit, unknown entity types, entities outside the level, duplicate names, targets/rule targets that do not exist (entity names, `#tags` and named doors all count).

## Ready-made content
**Wall pieces** (25): Walls (wall, skirting, thick, pilasters, low wall, high opening) · Windows (window, wide, slit, open, barred) · Doors (slide-up, sideways, swinging, wide, glass, **secret**, doorway, wide opening, arch, prison bars) · Barriers (chain-link, railing, glass wall, barricade). **Cell pieces**: pillar, thin pillar, big pillar, low block, solid block. **Stairs**: full/half/step stairs, ramps. **Textures** (35, procedural, offline): brick, stone, concrete, plaster, bunker, metal plates/panels, sci-fi, wood, tiles, corrugated, hazard, floors (concrete, checker, wood, carpet, grass, dirt, sand, asphalt, grate, marble), ceiling tiles, five door skins (steel, wood, sci-fi, red/blue/yellow/green locked), glass, chain-link.

**Entities**
* *Markers* — Player start (health/armor/loadout), Checkpoint, Level exit (optional `need` event + `next` level), Teleporter, Sound emitter, Spawn point.
* *Triggers* — Trigger zone, Message zone, Ambush trigger (spawns enemies), Hazard zone (damage/s).
* *Enemies* — Soldier, Guard, Heavy gunner, Sniper, Zombie, Runner, Robot trooper, Drone (flying), Auto turret, Mech (splash rockets), **Boss** (3 phases, summons, boss bar).
* *Allies* — Scientist, Civilian (talk with E, multi-line dialogue).
* *Pickups* — medkits, armor, ammo (bullets/shells/rockets/cells), weapons (pistol, shotgun, rifle, rocket launcher, plasma), 4 key colours, coin, gem, custom pickup.
* *Lights* — point (white/warm/cold/red/green/blue), ceiling lamp, neon tube, floor lamp, torch, fire barrel, broken/flickering light, alarm light.
* *Props* — explosive barrel, barrel, crates (breakable, big, metal), table, chair, locker, plant, sandbags, tree, rock, column, terminal, wall switch, **fire / smoke / steam / sparks emitters**.

**Weapons** (player): knife, pistol, shotgun, assault rifle, rocket launcher, plasma rifle (`weapons.js`; add your own via `bank.json`). **HUD**: health/armor/ammo/weapon bar/keys/objective/minimap/boss bar/messages/prompts/damage flash, pause, death (retry from checkpoint), level-complete screens. **Audio**: every sound is synthesized (WebAudio, positional); override any name with a file.

## Scripts (behaviours)
A script is a plain ES module with a default export:
```js
export default {
  id: 'my-script', title: 'My script', cat: 'Custom', desc: 'What it does',
  params: { speed: { type: 'number', label: 'Speed', default: 2, min: 0, max: 10 } },   // → form in the Inspector
  dynamicLight: false,                       // true: a light entity with this script is never baked
  start(c) {}, update(c, dt) {}, use(c, by) {}, hurt(c, amount, src, kind) {}, die(c, src, kind) {},
  event(c, name, data) {}, heard(c, pos, src, dist) {}, idle(c, dt) {},
};
```
Parameter types: `number`, `int`, `bool`, `string`, `text`, `color`, `enum` (`options`), `sound`, `key`, `target`. Only values that differ from the default are stored in the level.

Context `c`: `c.self` (entity: `x y z rot layer hp maxHp alive enabled name tag target props data model state`), `c.p` (params), `c.s` (private state), `c.player`, `c.game`, `c.say(text, secs)`, `c.sound(name)`, `c.emit(evt, data)` (publishes `<name>.<evt>`), `c.on(eventName, fn)`, `c.after(sec, fn)`, `c.find(nameOrTag)`, `c.targets()`.
Game API (`c.game`): `world`, `player`, `spawn(type,x,z,layer,props)`, `find(q)`, `doorsNamed(n)`, `setDoor(d, open, {force})`, `damage`-style helpers `explode(at,radius,dmg,src)`, `hitscan(...)`, `enemyShot(e,{…})`, `fireProjectile(...)`, `noise(pos,radius)`, `give(item,n)`, `win()`, `lose(msg)`, `objective(text)`, `saveCheckpoint()`, `fx` (particles/flash/tracer), `bus`.
AI helpers (`scripts/fpsc/ai.js`): `canSee`, `yawTo`, `turnTo`, `step`, `moveToward`, `followPath` (A\*), `patrol`.

**Built-in scripts (28)** — *AI*: `ai-shooter`, `ai-melee`, `ai-turret`, `ai-sniper`, `ai-flyer`, `ai-boss`, `ai-patrol` · *Items*: `pickup` · *Triggers*: `trigger-zone`, `trigger-message`, `trigger-checkpoint`, `trigger-win`, `trigger-teleport`, `trigger-spawn`, `hazard` · *Props*: `switch`, `usable-message`, `npc-talk`, `explosive`, `breakable`, `ambient-sound`, `emitter`, `spin` · *Lights*: `light-flicker`, `light-pulse` · *Logic*: `spawner`, `timer`, `objective-kill-all`. Open one in the editor (Scripts tab ▸ View source) and **Make an editable copy** to customise it. (Adding a *built-in* script to the engine: drop the file in `runtime/fpsc/behaviours/`, run `node tools/fpsc-tools.mjs index`, then `node tools/fpsc-tools.mjs sync`.)

**Attaching.** Default scripts come from the entity definition. Per entity the level stores only overrides: `{ "id", "params": {…}, "off": true }` to tune/disable, `{ "id", "remove": true }` to drop a default, or a new `{ "id" }` to attach another. `resolveScripts(def, entity)` (in `bank.js`) merges them for editor and runtime.

## Rules (no code)
`{ when, event?, every?, do, target?, text?, value?, delay?, once? }`
* **when**: `start`, `used` (E), `died`, `hurt`, `enter`, `exit`, `touched`, `alert`, `timer` (`every`), `event` (`event` = full name such as `switch1.used`, `door1.opened`, `warden.died`, `alarm`).
* **do**: `open close toggle unlock lock` (doors by name; lights toggle), `message objective sound emit spawn show hide enable disable destroy kill damage heal give teleport checkpoint light shake win lose`.
* **target**: entity name · `#tag` (group) · door name · `self` · `player`.
Events published automatically: `<name>.<evt>` for entity events (`used died hurt enter exit touched alert on off cleared talked timer`), `<door>.opened/closed`, `level.start`, `level.won`, `player.died`, `player.hurt`, `entity.killed`, `boss.died`.

## Adding assets — the rules
All additions live in `<project>/fpsc/` and are listed in `fpsc/bank.json`; the **Assets** tab does the file copying and JSON editing for you.

| Add | Rule |
|---|---|
| **Texture** | Seamless PNG/JPG (power-of-two, 256–512 px). `fpsc/textures/x.png` + `{ "id", "label", "cat": "wall\|floor\|ceiling\|door", "size": 2, "url": "fpsc/textures/x.png", "alpha"?: 0.3, "alphaTest"?: true }` in `textures`. `size` = metres per repeat. Works on every piece. |
| **Wall piece** | `pieces: [{ "id", "label", "cat", "parts": [ { "u": [0,1], "y": [0,3.2], "t": [-0.15,0.15], "mat": "main" } ], "door"?: { "style": "up\|side\|swing", "speed", "secret"? } }]`. Boxes in edge space: `u` fraction along the 4 m edge, `y` metres (`"H"` = 3.2), `t` thickness across. `mat`: `main` (chosen texture), `trim`, `door`, `glass`, `mesh`. Flags (default true): `solid`, `opaque`, `bullet`; `vis:false` = invisible blocker; `leaf:true` marks the moving boxes of a door. |
| **Entity** | `entities: [{ "id", "label", "cat", "extends"?: "enemy_boss", "model", "color", "glyph", "radius", "height", "props": {schema}, "scripts": [{ "id", "params" }] }]`. Anything not given is inherited from `extends`. |
| **Sprite (billboard)** | PNG with transparency, feet at the bottom: `model: { "kind": "billboard", "url", "w", "h" }` (Assets ▸ Sprite does it). |
| **3D model** | `.glb`, 1 unit = 1 m, origin at the feet: `model: { "kind": "glb", "url", "scale", "rotY"? }` (needs `babylonjs.loaders` — the template page already loads it). Lit by one flat light. |
| **Procedural model** | `model: { "kind": "parts", "parts": [ { "shape": "box\|cyl\|sph\|cone", "s": [w,h,d], "p": [x,y,z], "c": "#hex", "e": true } ] }` or reuse a built-in id (`soldier`, `crate`, …). Named `group` pivots can be animated by scripts. |
| **Sound** | `sounds: { "pistol": "fpsc/sounds/my.wav" }` — a built-in name replaces the synth sound; any other name is usable in rules/script params. |
| **Weapon** | `weapons: { "id": { type, dmg, rate, mag, ammo, spread, view: { pos, parts, aim } … } }` (same fields as `runtime/fpsc/weapons.js`). Give with the Player start's *Weapons* list or `pickup` with `give: "weapon_<id>"`. |
| **Script** | `fpsc/scripts/name.js` (default export as above) + path in `scripts`. Assets ▸ New script has templates (blank / enemy / pickup / trigger). |

Rules of thumb: ids are lowercase `a-z 0-9 _`; never edit `scripts/fpsc/` (re-installed on upgrade) — put everything of yours in `fpsc/`; a missing/bad custom item only produces a **warning** (editor console, game console) and is skipped.

## Importing FPS Creator scripts (.fpi) — M12-23
FPS Creator (Classic/Modern) behaviours are small state machines in plain-text `.fpi` files (`scriptbank/`). Nord runs them with its own interpreter (`runtime/fpsc/fpi.js`); **nothing from the FPS Creator files is shipped in Nord** — you import from your own local copy (see the licence note in `THIRD_PARTY.md`).

```sh
node tools/fpsc-import-fpi.mjs <path/to/scriptbank> <your-project> --dry     # preview: what converts, what is skipped
node tools/fpsc-import-fpi.mjs <path/to/scriptbank> <your-project>          # write the scripts
node tools/fpsc-import-fpi.mjs <path/to/scriptbank> <your-project> --only door1,switch1,pickuphealth   # just some
```
Each convertible script becomes `fpsc/scripts/fpi-<name>.js` (a data-only module that holds the original text in `fpi`) and is added to `fpsc/bank.json` → `scripts`; a report goes to `fpsc/fpi/IMPORT_REPORT.md`. Re-running is safe. Reopen the editor: the imported scripts appear in the **Scripts** tab under the categories *FPI*, *FPI destroy*, … Attach them like any script (drag onto an entity, or *Attach* in the Inspector).

**How a line works.** `:conditions:actions` — every update the lines run top to bottom and a line fires when all its conditions hold. `state=N` as a condition tests the state, as an action sets it (later lines see the new state in the same update). Example (proximity door): `:state=0,plrdistwithin=120:state=4`.

**Setting the script up (Inspector → Scripts → parameters).**
| Parameter | Meaning |
|---|---|
| `$0 … $3` sounds (`s0…s3`) | FPS Creator passes sound files from the entity (`soundset`). Enter a Nord sound name (`pickup`, `door`, `switch`…) or any name from `bank.json` → `sounds`. Paths written in the script (`audiobank\items\pickup.wav`) use the file name without extension as the sound name. |
| Pickup gives / amount / message | What `playertake` hands over: `health`, `armor`, `ammo_bullets`, `weapon_shotgun`, `key_red` … (the FPS Creator item definition is not imported). |
| Animation time | FPS Creator animates a model with frames (`incframe`, `frameatend` …). Nord does not import those animations; the frame counter simply runs over this many seconds, so door/switch cycles keep their timing. |
| **Target** field of the entity | Replaces FPS Creator's *IfUsed* field: `activate`, `activateifused` and `plrmoveifused` act on it (a door name, a light, an entity name or `#tag`). A door opens/closes; a plain Nord light **toggles on every press**; an entity that runs an imported script (e.g. `fpi-light1`) receives the activation and reacts as in FPS Creator. |

The Inspector lists only the parameters a script actually uses (e.g. no sounds for a script without `$0`).

**Supported (79 of the 166 stock scripts convert):** pickups (ammo, health, weapons, keys, items), doors/lifts/switches in all their variants, lights (on/off/toggle), zones (heal, hurt, sound, music text, story, activate, transport), appear/disappear, vars and timers. **Conditions:** `state plrdistwithin plrdistfurther plrhigher plrusingaction plrwithinzone anywithinzone anywithin anyfurther activated varequal/notequal/less/greater timergreater random frameatend frameatstart cantake plrhaskey plrcanbeseen alphafadeequal playerassociated raycastup`. **Actions:** `state sound plrsound loopsound hudshow activate activateifused activateallinzone playertake plraddhealth plrsubhealth addhealth subhealth sethealth plrmoveto plrmoveifused lighton lightoff moveup associateplayer unassociateplayer timerstart setvar incvar decvar dimvar setframe incframe decframe setalphafade incalphafade spinrate floatrate destroy spawnon spawnoff`.
**Accepted but without effect** (visual/engine-only): `coloff colon animate alttexture rundecal lightintensity music hud layout …` (full list: `IGNORED` in `fpi.js`). Distances are converted at 1 unit = 2.5 cm; `raycastup=A B` is approximated as "lift reached B units above where it started"; 3D-model frame animation, collision toggling and decals are not reproduced.

**Skipped:** the enemy-AI scripts (`people/*`, `Dark AI/*`: `aiattack`, `settarget`, weapons, waypoints, teams…) cannot be interpreted. The report names the closest Nord AI script for each: `shoot*`→`ai-shooter`, `snipe*`→`ai-sniper`, `melee*/chase*`→`ai-melee`, `pace*/cover*/coward*`→`ai-patrol`, `mover*`→`ai-flyer`. Use the matching Nord enemy entity instead.

**Your own `.fpi` scripts.** Any text following those rules works: put it in a data-only module `export default { id: 'my-door', title: 'My door', fpi: ':state=0,plrdistwithin=120:state=1\n…' }` in `fpsc/scripts/` and list the file in `bank.json`. Unknown commands make a line never fire (the importer lists them) — check `unsupported(parseFpi(text))` from `runtime/fpsc/fpi.js`.

## Level format (`*.fpsl.json`, `"format": "fpsc-level/1"`)
```jsonc
{
  "format": "fpsc-level/1", "name": "Outpost Zero", "author": "…", "w": 44, "d": 42,
  "settings": { "sky": "day", "skyColor": "#8fb8e8", "ground": "grass", "fog": false, "fogColor": "#9bb0c8", "fogDensity": 0.012,
                "ambient": 0.4, "ambientColor": "#a6b2c8", "music": "", "intro": "", "objective": "", "timeLimit": 0, "next": "", "bake": "full" },
  "layers": [ { "name": "Ground",
      "cells": { "4,4": { "f": "floor_concrete", "c": "ceiling_tiles", "h": 0.4, "s": { "id": "stairs", "d": "N" }, "p": "pillar", "pt": "concrete" } },
      "edges": { "4,4,H": { "k": "door", "t": "bunker", "tb": "brick", "tt": "metal_panel", "td": "door_metal", "name": "door1", "lock": "red", "auto": false, "close": 4, "flip": false } } } ],
  "entities": [ { "id": "e001", "type": "enemy_soldier", "x": 72, "z": 80, "y": 0, "layer": 0, "rot": 90, "name": "guard1", "tag": "wave1", "target": "",
                  "props": { "health": 80 }, "scripts": [ { "id": "ai-shooter", "params": { "damage": 12 } } ],
                  "rules": [ { "when": "died", "do": "open", "target": "door1" } ], "path": [[72,80],[72,100]] } ]
}
```
`x,z` are metres (cell = 4 m). Edge keys `"x,z,H|V"`: `H` = east–west edge at `z·4`, `V` = north–south edge at `x·4`; the "front" is +z / +x. Cell keys `"x,z"`. Layer *i* sits at `y = i·3.2`. `normalize()` repairs hand-written files. `settings.bake`: `"fast"` skips light occlusion (instant start for huge levels; walls then no longer block light); the runtime also does this automatically when vertices × lights would exceed ~12 million.

## Running a level
* **In Nord**: a 3D project with an entity running `scripts/fpsc/level-script.js` (attributes `level`, `autostart`). The runtime creates its own camera, HUD, input and audio on Nord's Babylon scene; physics can be `none`. Exports include `scripts/`, `levels/` and `fpsc/` automatically. (Custom scripts in `fpsc/scripts/` are imported dynamically — use the default folder export, not the bundled single-file export.)
* **Stand-alone** (editor play-test, own pages): `import { runLevel, loadBank, fetchLevel } from '/runtime/fpsc/index.js'`; `runLevel({ canvas, container, level, bank })` or `attachLevel({ scene, … })` + `run.update(dt)`.
* **Upgrade** the runtime after updating Nord: `nord fpsc init` (or the tab's *Upgrade runtime* button). It rewrites `scripts/fpsc/` only; levels, `fpsc/`, scenes are never touched.

## Install / CLI / server API
`nord fpsc init [project] [--start]` — copies `runtime/fpsc` → `scripts/fpsc`, creates `fpsc/bank.json`, `levels/level1.fpsl.json`, `scenes/fps.scene.json` (and with `--start` makes it the start scene).
`GET /api/fpsc/ls?dir=levels` · `POST /api/fpsc/save?path=levels/x.fpsl.json` (raw body, header `x-nord-fpsc: 1`, only `levels/` and `fpsc/`, known extensions, ≤ 64 MB, no `..`/hidden parts) · `POST /api/fpsc/install[?start=true]`. The custom header forces a CORS preflight, so other web pages cannot write to your project.

## Controls in the game
WASD move · mouse look · Shift sprint · Space jump · C crouch · **E** use / open doors · LMB fire · **RMB (hold) aim down sights** · R reload · 1-6 / wheel / Q weapons · **F** flashlight · M minimap · Esc pause.

**Aiming (right mouse button).** Hold RMB to raise any gun to the sights: the weapon slides to the screen centre, the view zooms in a little, bullet spread and mouse sensitivity drop and the crosshair fades. It is off while reloading/swapping, for melee weapons, and in the "hold RMB to look" fallback (no pointer lock). The pose of each weapon is editable with `view.aim` in `fpsc/bank.json` — every field is optional:

```json
"weapons": { "pistol": { "view": { "pos": [0.26, -0.26, 0.55], "parts": [ … ],
  "aim": { "pos": [0, -0.08, 0.5], "zoom": 0.8, "spread": 0.3, "sens": 0.7 } } } }
```

* `aim.pos` `[x, y, z]` — view-model position while aiming (camera space; x right, y up, z forward). Default: x 0, and y chosen so the top of the barrel/sights sits just under the crosshair, so a custom weapon is centred automatically.
* `aim.zoom` — field-of-view multiplier (default 0.85; the rifle uses 0.72; 1 = no zoom).
* `aim.spread` — multiplier on `spread` while aiming (default 0.35). `aim.sens` — mouse-look multiplier (default 0.75).

## Testing
`node tools/fpsc-test.mjs [unit|api|nord|game|editor]` (needs `cargo build -p nord-cli`, Playwright + Chromium): node unit tests (`runtime/fpsc/fpi.test.mjs`: 9 for the .fpi interpreter and importer; `runtime/fpsc/fpsc.test.mjs`: level model, collision, rays, A\*, geometry+baking, bank, rules), the file API/CLI, Nord boot of the template, 17 gameplay scenarios on the demo level (doors, locks, keys, shooting, AI, stairs, rules, ambush, hazards, checkpoints, boss, win/death/restart, custom glb/sprite/script bank) and 17 editor scenarios (every tool with real mouse input, inspector, undo, save/reload, assets, play-test). Rust: `cargo test -p nord-core fpsc`, `cargo test -p nord-editor --test ui fps_tab`. Screenshots land in `target/fpsc/`.

## Known limits
See `docs/KNOWN_ISSUES.md` (FPS Creator section): software-GL only verified headlessly; no shadows from dynamic lights; static light changes at runtime re-bake (short hitch); multi-storey light bleeding through floors is approximate; sprites/glb are flat-lit; touch controls/gamepad not implemented; bundled single-file export cannot import custom scripts dynamically; web-editor (wasm) shows the tab but cannot install the runtime (use the CLI on the server).

## FPS Creator Modern comparison (2026-10-21, M12-14)
Inspected the owner-provided `TEMP/FPS-Creator-Modern`: `README.md`, MapEditor `FPSC-MapEditor.dba` (grid-lock modes), `FPSC-Interface.dba` (entity properties), and Waypoints `FPSC-Waypoints.dba` (move/delete/insert nodes). Nord already provides grid segments, storeys, entity/script banks, properties, lighting, weapons, AI, testing and export. The useful additions in this pass are adjustable placement spacing, detailed patrol editing, and placed-object navigation (a Nord usability addition).

The Modern README explicitly states that its source is MIT and describes Black Ice features including improved lighting, AI and dual wielding. This differs from the earlier Classic reference above; it does not establish redistribution rights for every bundled binary/media file. No Modern code or assets were copied. Nord’s Babylon renderer and JS runtime make the Dark Basic/DirectX implementation unsuitable for a direct drop-in. Dual wielding, cover AI, dynamic shadows, moving platforms and skinned characters remain future work, not implemented claims.

## Diagonal and round corners (M12-17)
The default editor starter (New / first-open fallback) demonstrates four diagonal corners in its first room and four rounded corners in its second room. Outpost Zero in the template/example demonstrates diagonal start-bunker corners and rounded main-hall corners. Existing saved levels are not rewritten; use New or open a refreshed built-in example/new template to see them. Original gameplay placements, doors, window and mission paths are preserved.
**Existing projects:** click **Upgrade runtime** before main-editor Play/export (or run `nord fpsc init`). The FPS test uses the engine runtime immediately; project exports use the installed `scripts/fpsc/` copy.

In **Build → Cell objects → Mode**, choose **Diagonal / rounded corner**. Choose **45° diagonal** or **Rounded quarter-circle** and the corner to **cut off** (NE/NW/SE/SW), then click a room's corner cell. Floor and ceiling are cut to the same retained footprint, and the new solid wall uses the current Wall/Back materials. Existing floor/ceiling materials and floor height are retained. Shift-click restores Square. You can also select a cell with V and edit **Corner shape**, cut direction and wall/back materials in its Inspector. Undo/redo and JSON save retain all settings.

The two original edge pieces on the removed side stay in JSON, but are hidden and non-colliding while the corner is active. Restoring Square reveals them again. The diagonal/curved wall is a solid wall, not a door/window piece. Stairs and pillars cannot share a shaped cell; the UI asks you to remove/restore them explicitly. Arbitrary wall angles and variable curve radii are not supported. Each cell is 4 m; a rounded corner is a 4 m-radius quarter circle approximated with eight segments, with matching oriented collision and ray tests. Four appropriately oriented round cells in a 2×2 square make a circular room. Larger rooms can have rounded corners and straight walls between them.

New FPS Creator projects include **`levels/corners.fpsl.json` (Corner workshop)**: an octagonal room and a circular room joined by teleporters. Open it through FPS Level → Open; it does not replace Outpost Zero or change the project's start scene. Generator: `tools/fpsc-corner-demo.mjs` via `node tools/fpsc-tools.mjs sync`.

The shared `runtime/fpsc/corners.js` footprint drives cut floor/ceiling meshes, 2D map/minimap, rotated wall geometry, circle collision, shots/sight/light occlusion and navigation (retained-side centroids and accessible sides). Flat levels and original H/V edges keep their existing behaviour. Format extension on a cell: `"shape": { "kind": "diagonal|round", "corner": "NE|NW|SE|SW", "t": "brick", "tb": "concrete" }`. Older runtimes do not interpret this field: upgrade before exporting.

## Easy reusable FPS item variants (M12-18)
1. Place a built-in or custom item and select it. Change its **Properties**, **Scripts** (parameters/enabled state) and **Rules** in the normal Inspector.
2. Under **Reusable item**, click **Save as variant…**. Enter a display name and unique lowercase id, then **Save variant**. This writes a custom entity definition to `fpsc/bank.json`; the original bank item stays available.
3. Place the new item through **Items**. It inherits the original model/category/collision and uses your property, script and rule defaults. Position, name, tags, direct target and patrol coordinates are instance-specific; rules may still contain named targets, so verify those in each level.
4. To revise a variant, place/select it, adjust it, then choose **Update variant defaults…** and confirm. Instances inherit updated property/script defaults unless they have their own overrides. Rules are copied on placement, so existing objects keep their rule lists. Other objects are not bulk-rewritten. The selected object's property/script overrides are cleared after capture because they are now the variant defaults.
5. Save the level after saving a variant: bank changes are saved immediately, but level edits use normal Save/undo. Undoing a level edit does not delete a bank definition. This needs the project file API (Nord or `nord serve`); offline file-only pages cannot save a bank.

This is an item variant workflow, not a whole-room prefab editor. A variant carries its inherited appearance/model, properties, scripts and rules. Swap a model by creating a sprite/GLB entity in Assets and making variants of that entity, or use an available model property. No external model generator is required for basic wall/corner shapes. Custom content stays in `fpsc/` and is included in the normal folder export.

## Level files and native mouse capture (M12-20)

Open maps through FPS Level → Open… (lists the current project's top-level `levels/*.fpsl.json`), edit, then use FPS Save. `level1.fpsl.json` is Outpost Zero; `corners.fpsl.json` is the workshop. New creates the unsaved starter; last-used map storage does not choose the game start map. Main Play/export use the saved start scene's FPS Level entity → script `scripts/fpsc/level-script.js` → **Level file** attribute. Save both files after changing that reference. Full illustrated instructions: manual chapter 28, “Open, edit and switch level files”.

macOS `viewport/mac_pointer_lock.rs` adds WebKit's `_webViewDidRequestPointerLock:completionHandler:` to an ivar-free subclass of Wry's existing UI delegate. Reassigning the delegate refreshes WebKit's selector cache; inherited upload/media methods remain intact. Grant only focused loopback content; DOM gesture/iframe permission checks remain WebKit's responsibility. This isolated SPI shim is necessary with Wry 0.50.5 and should be removed when upstream supports this callback. Original code based on WebKit API declarations/behavior, no upstream code copied.

Native reproduction on macOS: run.sh-built editor, disposable template, main Play → Click to play previously fell back to right-drag; with the shim actual `document.pointerLockElement === canvas` succeeds, Esc releases/pauses, Resume recaptures. FPS Level → Open → level1 → Test also captures in its iframe; Shift+Esc closes it and returns to editing. Temporary DOM lock-state probes were removed. Windows capture remains unverified.

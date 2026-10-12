# Automies — guide: from this proof of concept to a full Driver-style game

Everything gameplay-related runs **without a renderer** (`scripts/am/*.js`, pure JavaScript); the Babylon view (`scripts/automies.js`) only draws it. That split is what lets you grow the game with fast node tests
(`node tools/am-sim.mjs` for handling numbers, `node tools/am-sim.mjs --mission 120 2` for whole missions played by bots) and change the look without touching the rules.

## 0. How the pieces fit

```
scripts/am/car.js       Driver 2 handling (port of REDRIVER2 wheelforces.c / handling.c / gamesnd.c): pad → forces → motion, gears/revs
scripts/am/cars.js      the car table: power, grip class, yaw inertia, size, model
scripts/am/collide.js   car↔world (buildings, trees, props, map edge) and car↔car: impulses + damage
scripts/am/city.js      haven.map parser: road pieces + rotations, colliders, props, road graph, BFS path-finding
scripts/am/traffic.js   CivDriver (lane following) and Chaser (police / test bot): both just produce a *pad*, like a human
scripts/am/sim.js       players, checkpoints, timer, felony, police spawning, wrecks and respawns, events (the game rules)
scripts/automies.js     the view/controller: scene, city build, car views, cameras, split-screen, HUD, effects, audio, input
assets/maps/haven.map   the city; assets/models, textures, audio — see assets.md
tools/gen_automies_models.mjs  generates the low-poly models;  tools/art/automies  the hand-pixelled textures;  tools/fetch-automies-assets.sh  Kenney files
```

Run: `node tools/gen_examples.mjs automies`, then `nord serve examples/automies` (or Play in the Nord editor). Export: `nord export examples/automies --target html`, Mac app: `nord bundle-mac`.
Handy URL flags: `?players=2` (force split-screen), `?bot=1` (bots drive — good for screenshots and soak tests), `?seed=N`.

## 1. Handling: what is ported, what is missing, how to tune

**Ported faithfully (formulas and constants, in Driver 2's own units, converted at the edges):** the four-wheel slip model (`wheelForces`), grip split between axles (`frictionScales`, including auto-brake build-up, handbrake, burnouts, locked wheels), analogue and digital steering (`processPad`), gears and revs (`engineRevs`/`revsStep`), the fixed 30 Hz step.
**Replaced by a flat planar model:** the 3D rigid body — suspension height, pitch/roll physics, ground normals, jumps. The body in the view tilts from the longitudinal/lateral acceleration only.
**Tuning knobs** (all in plain sight): `LINEAR_DAMP` and `twistY` (turn-in speed) in `car.js` / `cars.js`, `powerRatio` (top speed ≈ ∝ power), `hnd` (grip class 0–6 = `HANDLING` table: 0 standard RWD with auto-brake, 1 heavy/slippery, 2–4 high-grip "4WD" classes), `traction` (4096 = normal).
`node tools/am-sim.mjs` prints for each car: 0-60/0-100, top speed, braking distance, skid-pad radius at 20/30 m/s and handbrake-turn rotation — change a number, run it, compare.

**Next steps for the handling:**
1. **Hills, ramps, jumps, bridges**: give the city a height function `groundY(x, z)` (a heightmap in `haven.map` rows or per-tile heights). Add a vertical axis to `Car` (`y`, `vy`) and run the suspension as in `AddWheelForcesDriver1`
   (`susForce = compression·230 − previous·100`, the spring that the port skipped); with ground normals the lateral forces already work on slopes (the C code multiplies the friction by `normal.y`). Then pitch/roll become real state (`orientation` quaternion as in `RebuildCarMatrix`).
2. **Surfaces and weather**: `friction_coef` already has a wetness term (`(forcefac·(32400−wetness) >> 15) + 500`); add `wetness` to the sim and a rain effect — instant slippery tarmac. `city.grass()` is the only surface query today; make it return a surface id (tarmac, grass, sand, water, ice).
3. **Damage that matters**: D2 reduces engine power and adds pull to one side as damage grows (`MaxPlayerDamage`, denting zones). Scale `powerRatio` by `1 − damage/200`, add a steering bias above 60 %, and swap the body mesh vertices (dents) with a small dent function in the view.
4. **More cars**: copy a car in `cars.js` and generate/replace a model (see `assets.md`). Tune the class; give trucks `mass` > 1.3 so collisions favour them.

## 2. The city

- **Bigger / more varied**: `haven.map` is text. Add a character per feature (see `LEGEND` in `city.js` and the `buildCity()` switch in `automies.js`). Tower variants: add a function to `tools/gen_automies_models.mjs` (it is a tiny box/loft/cylinder kit).
- **Streaming**: today every tile is instantiated once and frozen (`freeze()`), fine for ~500 tiles. For a Driver-sized city (hundreds of thousands of tiles) create tile meshes only within ~300 m of the cameras (a ring buffer keyed by `(cx,cy)`), and key the collider boxes the same way — `carVsWorld` already only looks at the 3×3 cells around the car.
- **Roads that are not a grid**: the road graph (`city.nbrs`) is cell-based; for diagonals/curves introduce a node/edge graph with lane polylines and keep `CivDriver`'s *vertex list* idea (it follows a list of lane points — any polyline works).
- **Props**: `crate`, `bench`, `billboard` models exist but are not placed — add them to the props loop in `city.js` (with a collider if cars should hit them). Knockable props (cones, bins) = remove their circle from `city.circles` on the first impact and tween the mesh away.
- **Traffic lights and signs**: add a signal cycle to `sim.js` (`this.signals[cell] = phase`) and make `CivDriver.drive` stop at an intersection entry when its direction is red (`want = 0` just before the intersection vertex). Draw lights as emissive boxes on the Kenney lamp posts.
- **Pedestrians**: simple walkers on the pavement along the road graph; flee on a close pass; felony for hitting them. (Driver 2's on-foot mode is a much bigger step: a second controller that swaps the camera and the car.)
- **Day / night / weather**: `buildEnvironment()` owns sun, fog and clear colour — drive them from `sim.t` or a mission setting; add headlight cones (spot lights, two per car, only for the nearest cars) and emissive window textures at night.

## 3. Missions (Driver 2 has Take a Ride, Getaway, Checkpoint, Pursuit, Tail, Trailblazer…)

Today one mission is hard-coded in `sim.js` (`MISSION` constants, `gameplay()`). Turn it into data:

```js
const MISSIONS = [{ id: 'bank', name: 'The Getaway', time: 100, bonus: 12, cps: 'haven.map', cops: { start: 2, max: 4 }, civs: 16,
  rules: { wreckRespawn: true, timeLimit: true }, intro: 'You have 100 seconds before the road blocks go up…' }];
```

- Add mission types as small classes with `update(sim)` and `onEvent(e)`: **Pursuit** (be the cop: the "criminal" is a `Chaser` that flees — reverse its target logic), **Tail** (stay 20–60 m behind an AI car without being noticed: distance band + a "suspicion" meter), **Trailblazer** (checkpoints in a larger area, no cops), **Survive** (stay alive N seconds), **Delivery** (pick up / drop off markers).
- Mission files: put missions in `assets/missions/*.json` (checkpoint list, spawn list, time, rules, briefing text) and load them like `haven.map`. Add a mission-select screen where the title screen is.
- Cutscenes: the camera code is isolated in `updateCameras()` — add a *director* mode that follows a scripted path (a list of positions/targets) and fades the HUD.
- Save progress and best times with `game.save` (see `docs/SCRIPTING_API.md`).

## 4. Police and felony (Driver 2's "felony" system)

`felonyFor()` adds felony for hitting civilians and cops and it decays over time; `wantCops` scales with it. To get closer to Driver 2: felony for *speeding past a cop*, *running a red light in view of a cop*, *wrong-way driving*; **cop states** (patrol → pursuit → roadblock → give up) in a small state machine on the actor;
**roadblocks** (two parked cars + barrier prop ahead of the player on the planned route — you already have `city.path`); **busted** = surrounded and stopped for 3 s by a cop: set `p.busted` and end the mission; **cops lose you** when out of sight for N seconds (line-of-sight against `city.solidAt`).
Police tune: `Chaser` takes `cruise`, `brakeDecel`; rubber-banding is the `car.boost` line in `sim.js` (Driver 2 does the same to its chasers).

## 5. Split-screen and multiplayer

- The viewport layout is `am/split.js` — a direct port of `layout()` from your `nordrep` (`src/core/split.rs`): 1 player full, 2 top/bottom or left/right, 3–4 quadrants plus *Big*/columns/rows arrangements. The game uses two slots; for three or four players add cameras in `buildPlayers()`, a `padFor` slot per gamepad in `readInput()`,
  extend `Sim` players (slots 3–4 start positions as `P 3 …` lines in the map) and enable more `active` flags — `applyLayout()` and the HUD panels (`buildHud`) are already per-slot.
- Modes for two: today a **race**. Add **cops and robbers** (P2 spawns as a `cop` actor with a *human* pad instead of a `Chaser`, wins by ramming P1 to 100 % damage), **co-op** (shared checkpoint progress), **demolition** (damage battle in an arena map).
- Online: the sim is deterministic given a seed and the inputs per 30 Hz tick — send the pad objects (`sim.input[slot]`) every tick and re-simulate (lock-step), or run the sim on one machine and stream car transforms.

## 6. Audio and effects

- Engine: the single Kenney loop is pitched by the ported rev value (`c.revs`); for a richer sound add idle/low/high samples per car and cross-fade by `revs` and `thrust` (the C code does exactly that with `idlevol/revsvol`).
- Tyres: `skid.ogg` volume follows `rearVel` / locked wheels — add a surface switch (gravel/grass) when `city.grass()` is true. Add **doppler and distance attenuation** for AI cars (Web Audio panner nodes, one per nearby car) — the siren is synthesised and ready for it.
- Effects: skid marks, smoke, fire and camera shake are pooled instances (`buildFx`) — add sparks on `crash` events, glass/debris bits, tyre smoke colour by surface, headlight glow.
- Music: Driver 2 has a licensed-style soundtrack with a menu; add `music/*.mp3` per mission in `MISSIONS`.

## 7. Interface

HUD panels are DOM (`buildHud`): one per viewport, so any layout works. Add a **speedometer dial** (a canvas with the font in `assets/ui/font.png`), a **rear-view mirror** (a second small camera + `RenderTargetTexture`, see Harrison's Command for render-to-texture), a **pause / options menu**, **controller remapping**, a **replay** (record the pad stream and re-simulate it — the director camera makes it a film mode, like Driver 2's).

## 8. Performance

~500 frozen tile roots, instanced meshes, ~25 cars, pooled effects: it runs smoothly on a normal GPU (the headless screenshot runs in software GL are slow, not the game). If you grow the city: stream tiles (§2), merge static props (`Mesh.MergeMeshes` per material), use `scene.blockMaterialDirtyMechanism = true`, lower `maxZ`/fog for the second viewport, and keep the AI at 30 Hz (it already is) with a cheaper `ahead()` (spatial hash).

## 9. Licence note

`scripts/am/car.js` is derived from **REDRIVER2 (GPL-2.0)**: keep that notice (it is in the file header and `THIRD_PARTY.md`) and keep the example GPL-compatible if you distribute it. Kenney assets are MIT (keep `assets/models/kenney/LICENSE-*`). Nothing from Driver 2's data or art (Reflections / Ubisoft) is included — keep it that way: write your own cars, city and sounds.

## 10. Ship it

Checklist: `node tools/am-sim.mjs` numbers sane · `node tools/am-sim.mjs --mission 200 2` finishes with no stuck bots · `node tools/smoke-examples.mjs automies` green · two-player test with real gamepads (the gamepad mapping is the *standard* layout; verify on your hardware) · export `--target html` and the Mac bundle.

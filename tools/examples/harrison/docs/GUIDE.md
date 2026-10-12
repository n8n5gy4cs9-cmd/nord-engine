# Harrison's Command — guide: from the proof of concept to a full game

The game is split into a **pure simulation** (`scripts/hc/sim.js`: no graphics, runs under plain node) and a **view** (`scripts/harrison.js`: Babylon scene, players, computers, HUD).
New content is mostly data in `buildLevel()` / `layout.js`; new *systems* go in the sim, the view only mirrors state.

## Add things to the level
- **Another enemy base / island**: add an entry to `ISLANDS` in `scripts/hc/layout.js` (centre, radius, peak, seed) → `node tools/gen_harrison_models.mjs` writes `island_<id>.glb` → add it to `MODELS` in `harrison.js` and place structures with `sim.addStruct(type, x, z, id)` in `buildLevel()`.
- **New structure type** (e.g. a radar or a factory that spawns drones): add a branch in `Sim.addStruct`/`updateStruct`, a model in the generator (or a Kenney model), and an entry in the `vis` setup in `buildActors()`.
- **New unit type**: add a body/weapon in `Sim.addUnit` (use any weapon from `wz-stats.json` or copy more from Warzone 2100's `data/mp/stats/weapons.json`), a model, a map icon and a bay in `BAYS`.
- **A second carrier / more players**: `layout.js` + `split.js` already handle up to 4 viewports; `buildPlayers()` creates two — extend the loop and the gamepad lookup in `readInput` (`navigator.getGamepads()[n]`).

## Add a computer (the "Lua nodes" of Carrier Command 2, in plain code)
1. Put a station in `STATIONS` (layout.js): label, box (collision + model), where to stand, the screen plane, and a camera view position. Add the console geometry in `tools/gen_harrison_models.mjs` (it loops over `STATIONS`).
2. Give it a screen: any `Texture` — a `RenderTargetTexture` (a camera on anything), a `DynamicTexture` (2D canvas, see `drawStatus()`), or a video. Register it in `buildScreens()` (`screens = { name: texture }`).
3. Handle its inputs in `updateConsole()` (cursor, buttons) and its help text in `updateHud()`.
A data-driven "node graph" version is the natural next step: make each station run a small JSON program (inputs → conditions → sim commands such as `setCourse`, `orderAttack`) so the player can script automatic behaviour — the sim's order methods are already the API.

## Carrier Command depth, cheapest first
- **Economy**: a resource counter in `Sim`, gained by capturing structures (stand a Walrus in range of the HQ-like building), spent on rebuilding units at the carrier.
- **Fuel / ammo** for units (fuel burns in `updateUnit`, docking refills — docking already heals).
- **Day/night, weather**: change `scene.clearColor`, fog and the sun in `boot()`; the sky is the engine's `assets/skybox/{day,sunset,night}` — swap the `skybox` component in `scenes/main.scene.json`.
- **Walk-up docking**: `Sim.launch/dock` are the hooks; make the hangar a station with a lift animation.
- **Direct control**: add a "possess unit" station: switch the player's camera to the unit chase camera (the feed camera code in `updateFeedCam`) and map the player's input to `u.order = {kind:'move'}` each frame.
- **Save/load**: `Sim` is plain data (`ship`, `units`, `structs`, `drones`) — `JSON.stringify` it; rebuild visuals from it.
- **Mission scripting**: a `missions` array of `{when(sim), then(sim)}` evaluated each frame.

## Testing the sim without a browser
```
node -e "import('./scripts/hc/sim.js').then(async ({Sim,buildLevel})=>{const wz=JSON.parse(require('fs').readFileSync('scripts/hc/wz-stats.json'));const s=new Sim(wz);buildLevel(s);s.setCourse(-40,330);for(let i=0;i<3000;i++)s.update(0.1);console.log(s.ship.z)})"
```

# Forgotten Wars — guide: from this proof of concept to a full game

The PoC is deliberately **data-driven and layered**, so growing it is mostly adding data and then one layer at a time. This guide is a build order: each step lists *what to change*, *which file*, and *how to check it*.

## 0. How the pieces fit

```
scripts/fw/data.js       ARMIES, MOVE (move-type costs), TERRAIN (stars), LEGEND (map chars), UNITS, BUILD_LIST, BASE (damage chart), money constants
scripts/fw/rules.js      pure game logic: parseMap, newGame, reach (Dijkstra), damage, targetsFrom, doMove/doAttack/doCapture/doBuild/endTurn, income, repair
scripts/fw/ai.js         the computer player: aiNext(g) returns ONE action; weights W at the top; production table PRODUCTION
scripts/forgotten.js     the view/controller: tiles, unit sprites, cursor, menus, animations, input (mouse+keyboard), title/banner/end screens
assets/maps/*.map        levels (text). assets/{tiles,sprites,ui}/*.png art (see assets.md). tools/art/forgotten/*.mjs art sources.
tools/fw-sim.mjs         headless AI-vs-AI games on the shipped map: `node tools/fw-sim.mjs 20 80` — your balance + regression harness
```

The rule that keeps it maintainable: **`rules.js` never touches Phaser, `forgotten.js` never decides rules.** The view calls `doMove / doAttack / …` which return *events* (`move`, `hit`, `die`, `capturing`, `captured`, `build`, `repair`) and `playEvents()` animates them.
Player and AI both go through `perform()`, so anything you add to the rules works for both.

Run it: `node tools/gen_examples.mjs forgotten`, then `nord serve examples/forgotten` (or open the folder in the Nord editor → Play). Export: `nord export examples/forgotten --target html`; a Mac app with `nord bundle-mac`.

## 1. More levels → a campaign (cheapest, biggest payoff)

1. Draw a map: copy `crossing.map`, edit the grid (legend in `assets.md`), add `U` lines for starting units. Keep `@ title:` and add `@ goal: rout | hq | survive 12` and `@ brief:` lines — `parseMap` already collects every `@ key: value` into `map.meta`.
2. Load by name: `PATH.map` in `forgotten.js` is one file. Make a `LEVELS = [{ file, goal, brief, funds, cobaltAI }]` list, a `levelIndex`, and call `newGame(parseMap(text))` for the current one. Show `meta.brief` on the banner before day 1.
3. Win conditions live in `checkWin()` / `doCapture()` in `rules.js`. Add `goal` handling there (e.g. *survive N days* = `g.day > N` with the player alive; *rout* is already there; *capture X* = a flagged tile).
4. Progression: `game.save` (see `docs/SCRIPTING_API.md`) with `{ level, bestDays }`. After `checkOver()` show *Next mission*.
5. Different screen sizes: the view is fixed at 20×14 tiles (`VW`, `VH`, `MAPH`). For bigger maps add a camera: keep the tile sprites where they are, scroll `this.cam` with the cursor (`cam.scrollX = clamp(cx*16 - VW/2, 0, mapW - VW)`), and keep the HUD on a second camera like Altimu does (`uiCam.ignore(world layers)`).

## 2. More units and terrain

1. **Unit**: draw two frames per army in `tools/art/forgotten/units.mjs` (copy the closest unit; letters `D M L H` are the army colour ramps) and re-pack. Add it to `UNITS` (cost, move, move type, range, flags), to `BASE` (a row *and* a value in every other row, in `BUILD_LIST` order), to `BUILD_LIST`. `node tools/fw-sim.mjs` immediately shows whether the AI builds it and whether the game still ends.
2. **Move types / terrain**: new move type = a row in `MOVE` (sea units use `sea`, `shoal`, `port`). New terrain = `TERRAIN` stars + `LEGEND` char + a tile (see `assets.md`) + a cost in each `MOVE` row that may cross it.
3. **Ammo and fuel** (AW2 has both): add `ammo`/`fuel` to the unit instance in `addUnit`, decrement in `doAttack` / `doMove` (cost = path length), forbid attacking at 0 ammo in `targetsFrom`, add an APC or `supply` action. Show them in the info bar.
4. **Transports** (APC, copters, ships): a `cargo` array on the unit, `load`/`unload` actions in the action menu (`openMenu('action')`) and `perform()`. Moving onto a friendly transport = load; `unload` = pick an adjacent free tile (reuse the *target* mode with the `move` overlay).
5. **Air / sea production**: airports and ports are factories with a different `BUILD_LIST` (make `builds: [...]` a property of the tile type in `TERRAIN`; `openMenu('build')` already receives the tile).
6. **Fog of war**: add `vision` to `UNITS`, compute `visible` tiles per army after every action (`reach`-style flood with vision cost), draw a dark overlay on the rest and hide enemy sprites outside it. The AI must only see what its army sees — pass the visibility set into `aiNext`.

## 3. Commanding Officers and powers (AW2's signature)

1. Data: `COS = { rudd: { name, atk: {all: 100, tank: 110}, def: {…}, power: { cost: 6, apply(g, army) {…} }, passive: {…} } }`. Each army picks one (`ARMIES.ember.co`, already shown in the data).
2. Hook the modifiers into `damage()` in `rules.js` — it has the formula `base × atkHP × defence`; multiply by `atkMod(g, a)` and divide the defence term by `defMod(g, d)`.
3. Power meter: `g.power[army] += damageDealt * 0.5 + damageTaken * 0.5`, spent from a *Power* item in the system menu; the effect is an immediate function (heal all, +10 % atk for the turn, extra move) plus a banner and a tint. AI: use the power when it would kill something or at full meter.
4. Portrait art in `assets/ui/` (e.g. 48×48 sheet), shown on the day banner and in a small box in the bar.

## 4. A better computer player

- Today `aiNext` scores each reachable tile as *damage dealt − damage taken − threat + terrain*, plus a pull towards objectives and a cheap production table. It is a decent opponent and a good baseline.
- **Difficulty**: expose `W` (aggression, threat weight) as `AI_LEVELS = { easy, normal, hard }`; easy ignores threat and builds randomly, hard adds *focus fire* (prefer targets already damaged), *HQ defence* (keep a unit near the HQ when an enemy capturer is close) and *counter-pick production* (build what beats the enemy's biggest cost group using `BASE`).
- **Threat map**: precompute once per turn the damage every enemy unit can deal to every tile (it is `damage()` over `reach()` ∪ range) instead of recomputing inside `threat()`; it makes the AI ~10× faster, which you will want on big maps.
- Test every change with `node tools/fw-sim.mjs 20 80`: games must end (winners both sides, average day count sensible) and `node tools/e2e.mjs` still passes. Keep a fixed-seed regression file of results.

## 5. Interface and feel

- **Undo move**: before `commit()` the unit's sprite is only *previewed* at its destination; keep `s.from`, so *cancel* already restores it. For *Undo after moving but before acting*, call `doMove` only when the action is chosen (as now) and offer *Wait* as the minimal action.
- **Battle animation**: `playEvents` handles `hit`; make `hit` open a short scene (two big sprites trading blows, `assets/sprites/battle.png`) — it is just another event handler.
- **Speed options**: `attrs.aiDelay` already exists; add *skip animations* by shortening the `wait()` calls via one `this.speed` factor.
- **Sound / music**: per-army themes through `game.audio.music(path)` when the turn changes (the day banner is in `endAndStart`).
- **Save / load**: the whole game is `this.g` (plain JSON: tiles, units, funds, day, seed). `game.save.set('slot1', this.g)` and rebuild sprites from it in `newGame()` (loop `addUnitSprite`) — a 20-line feature.
- **Tutorial**: a list of `{ when(g), text }` hints shown in the bottom bar (`tHint`), e.g. *“Select a unit by clicking it”* until the first unit moved.

## 6. Multiplayer

- **Hot-seat** is built in (`?hotseat=1`). For a screen between turns, show a *“pass the controller”* banner in `endAndStart` when `humans.length > 1`.
- **Online / async**: every state change already goes through the five `do…` functions with plain-JSON arguments (`{ unit id, path, act, target id }`). Send those to a tiny relay (a Nord *app* tier export with `desktop.net`, or any WebSocket), apply them with the same code on both sides, and use the shared `seed` for luck — the games stay in sync. Replays are the same list saved to a file.

## 7. Content pipeline and tools

- A **map editor** is a weekend project with this engine: a second script that paints `LEGEND` characters into `this.g.tiles` with the mouse, then writes `rows.join('\n')` back as a `.map` (the format is just text).
- **Art**: grids → PNG with `tools/pixelart.mjs`; run `--preview` to look at the contact sheet. Add a third army by adding one entry to `TEAMS` (tiles.mjs), `ORDER`/`ARMIES` (data.js) and one row to the unit sheet; nothing else assumes two armies except the title screen text.
- **Balance**: the damage chart (`BASE`) and costs are one table each; the AI-vs-AI harness gives you win rates in seconds.

## 8. Where the real Advance Wars data comes from (and what not to copy)

`Eebit/aw2bhr` (cloned into `third_party/` by `tools/fetch-upstreams.sh`-style clones) is an assembly decompilation that still ships `.incbin "baserom.gba"` for its data sections; the damage chart, unit stats and map data are not decoded yet.
If a later revision of that project labels and decodes them (look in `data/*.s` for named tables), you may *read* them to correct `BASE`/`UNITS` here — the structure is already the same (an attacker × defender byte table). **Do not** copy Nintendo / Intelligent Systems art, music, text, names or maps; keep the original
Forgotten Wars content, and keep the credit line `Crowelian 2026 + Sonnet` on the title screen.

## 9. Ship it

Checklist: all maps load · `node tools/fw-sim.mjs 20 80` ends every game · `node tools/smoke-examples.mjs forgotten` is green · title/credits screen · sound volume setting (`game.audio.volume('sfx', v)`) · export `nord export … --target html` and the Mac bundle.

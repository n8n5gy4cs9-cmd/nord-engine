# Altimu 5.7 — guide: from this proof of concept to the full game

The PoC is deliberately *data-driven*: the world is a text file, the people/quests are one JS file, the rules are small. Growing it into a full game is
mostly **adding data**. This guide lists the steps, in the order that pays off.

## 0. How the pieces fit

```
assets/maps/trinsic.map        tiles of one town/overworld region (text)
scripts/altimu/data.js         START, PARTY, MONSTERS, GROUPS (roaming enemies), CHESTS, SEARCH, SIGNS, NPCS (dialogue), DEAD
scripts/altimu/rules.js        dice, levels, breadth-first monster steps (pure; test with node)
scripts/altimu/mapfile.js      parser for the .map format
scripts/altimu.js              the view: tiles, party-in-a-line, time of day, typed talk, tactical battle, HUD
```

## 1. Add a person

1. Draw them: a new row in `assets/sprites/folk.png` (6 frames, see `assets.md`) — or reuse a row.
2. Add an entry to `NPCS` in `data.js`: `name`, `sprite`, `x`,`y`, `wander` (tiles they roam), `greeting`, and `talk: { WORD: 'answer' | (ctx) => 'answer' }`.
   Words in `[brackets]` become topics the player has *learned* (shown after ASK:). Only the first 4 letters of a typed word matter, as in Ultima V.
3. Replies can change the game: `ctx.set('flag', true)`, `ctx.give(gold)`, `ctx.food(n)`, `ctx.herb(n)`, `ctx.healAll()`, `ctx.rest()`, `ctx.join('shamino')`, `ctx.openGate()`.
   Read flags with `ctx.f.flag`. Quests are just flags (see `quest`, `witness`, `rag`, `letter`, `chiefDead`).

## 2. Add a town or a region

1. Copy `trinsic.map`, change the rows, keep or extend the legend. Add new tiles by drawing them in `tiles.png` (append, update the `tiles` names in `tiles.png.meta.json` or re-pack with `tools/art/altimu/tiles.mjs`).
2. Load it: today `PATH.map` in `altimu.js` points at one file. For several maps, make `PATH.map` a lookup (`maps[name]`), keep the player's position per map,
   and add a **warp** list `{ from:[x,y], map:'brittany', to:[x,y] }` checked in `tryMove` (like `getAt` checks chests). Moongates and the Ultima V "enter town by walking onto it"
   are the same warp with a different tile.
3. Give each map its own `NPCS`, `GROUPS`, `CHESTS`: move the three constants in `data.js` under a map name (`MAPS.trinsic.NPCS`) and select by the current map.

## 3. Importing the *exact* Ultima VII Trinsic

This repository ships no Ultima VII data (the engines we studied — Exult, the Ultima V web engine, the U7 decompilation — all need your own copy of the game, which you must own).
To get the real map from **your** copy:

1. Install **Exult** (https://github.com/exult/exult) and point it at your Black Gate folder. Exult Studio (`exult_studio`) can open `STATIC/U7MAP`, `U7CHUNKS`, `U7IREG??` and export them.
   Find Trinsic (south-east coast, walled town with a north gate and a harbour) in Exult Studio's map view and note its chunk range; the world is made of 16×16-tile chunks, 12×12 chunks per superchunk.
2. Export the chunk grid as text: for every chunk, 16×16 *shape,frame* pairs from `U7CHUNKS`, plus the *ireg* objects (walls, doors, furniture, trees) with their (x,y,lift).
3. Write a small converter `tools/u7-import.mjs` that maps **shape numbers → this game's legend characters** (an illustrative table: `{ <grass shape>: '.', <cobble shape>: 'o', <tree shape>: 'T', <wall shape>: 'W', … }` — you fill in the real shape numbers from Exult Studio) and writes a `.map` file.
   Ground shapes (0–150) are tiles; walls/doors/furniture come from the ireg lists. Unmapped shapes become `.` and are printed so you can extend the table.
4. Replace the art as you go: the table above is the *only* place the original shape numbers appear, so the game stays free of original graphics.
5. Take dialogue from `Ultima7_Decomp/ultima7-portable/Black Gate/game/usecode/*.use` (e.g. `Finnigan.use`, `Spark.use`, `Klog.use`, `Gilberto.use`) as a *reference for who says what* — rewrite
   it in your own words into `NPCS` (the original text is Electronic Arts' copyright).

## 4. Next features, cheapest first

- **Save/load**: `st` (the state object in `newGame`) plus the `cells` that changed is the whole game; `JSON.stringify` it into `game.save`.
- **Shops**: a `shop` field already exists on NPCs; add a `BUY` word that opens a numbered list in the log and spends `st.gold` (Brom, Jaana and Dalla do it inline today).
- **Schedules**: give NPCs a list `[{ at: 6, x, y }, …]` and move them at the matching hour in `tick()` (Ultima VII did this; Ultima V's townsfolk simply wander).
- **Spells and reagents**: add `st.reagents` and a `C` command listing spells; spells call the same `attack()` used for arrows (`fx: 'bolt'` is already drawn).
- **Dungeons**: a second map type with a first-person or tile view; reuse the *battle arena* for fights.
- **Overworld**: scale the map to 256×256 and add chunked loading (create sprites only inside the camera rectangle — see `buildWorld`).
- **Ship**: a movable `st.vehicle` that changes which tiles are `blocked()` (water passable, land not).

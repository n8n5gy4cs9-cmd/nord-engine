---
title: FPS Creator — build first-person levels
section: Manual
order: 28
summary: A grid level editor with walls, doors, windows, stairs, lights, ready-made enemies, pickups, scripts and no-code rules. Build, play-test with F5, ship with your game.
---

**FPS Creator** is an addon for Nord that turns the editor into a *level editor on steroids* for first-person shooters (and adventures): you draw rooms on a grid, drop in doors, windows, lights, enemies and pickups, attach scripts, press **F5** and play. It is inspired by the classic FPS Creator workflow, but everything is original and works offline. Nothing in the normal editor changes — you opt in per project.

::: dummies
Think of it as a toy box. The **map** (left) is a top-down plan, the **3D view** (right) shows what you built, and the **Items** tab holds ready-made guards, zombies, health packs and lamps. Click an item, click the map: done. Press **F5** to walk around in your level.
:::

<figure class="shot"><img src="assets/screenshots/ed-fpsc-editor.png" alt="The FPS level editor with the 2D map on the left, the live 3D preview in the middle and the inspector with scripts and rules on the right" loading="lazy"><figcaption>The FPS Level tab: item palette (left), map and live 3D preview (centre), inspector with scripts and no-code rules (right). The selected lab terminal opens the boss gate with its rules.</figcaption></figure>

## Start in one minute
1. On the project hub choose **New project ▸ FPS Creator (level editor)** — or open any 3D project and click **Project ▸ Add / upgrade FPS Creator…** (or the button in the **FPS Level** tab).
2. Open the **FPS Level** tab. The demo level *Outpost Zero* is loaded: a bunker, hall, armory behind a red-key door, a lab terminal, a courtyard, a tower with stairs and a boss arena.
3. Press **F5**. Click the game to capture the mouse. WASD, mouse, **E** to use things, **F** flashlight, **1–6** weapons.
4. Press **Run** in the normal editor to play the same level as your finished game.

<figure class="shot"><img src="assets/screenshots/ed-fpsc-yard.png" alt="First-person view of the courtyard in the demo level: trees, sandbags, soldiers and a stone tower" loading="lazy"><figcaption>Press F5 and you are standing in your level. The demo level "Outpost Zero" is the template's starting point.</figcaption></figure>

## The editor window
* **Top bar**: file (New / Open / Save / Save as / download / import), undo/redo, **tools**, the active **layer** (storey), 2D · split · 3D view, **▶ Test** and **▶ From here**, the **✓** problems checker and **?** help.
* **Left**: **Build** (materials and wall pieces), **Items** (entities), **Scripts**, **Level** (sky, fog, ambient, intro, layers) and **Assets** (add your own).
* **Centre**: the 2D map and the live 3D preview. Wheel = zoom, middle/right-drag = pan, `Tab` = cycle views. In 3D: right-drag to look, **WASD/QE** to fly, **F** to focus the selection, click to select.
* **Right**: the **Inspector** for whatever is selected.

### Drawing
| Key | Tool | What it does |
|---|---|---|
| `R` | **Room** | Drag a rectangle: floor, ceiling and a wall ring |
| `W` | **Wall** | Click an *edge* between two cells, or drag between grid points. Choose **Door**, **Window**, **Arch**, **Fence**… in *Build* |
| `F` `C` | Floor / Ceiling | Paint cells (Ctrl = rectangle, Shift = erase) |
| `G` | Fill | Fill a closed region with the floor texture |
| `S` | Stairs · height · pillars | Click a cell; drag to aim the stairs |
| `A` | Add item | Click the map with the chosen item, or drag a card from *Items* |
| `P` | Path | Patrol route of the selected enemy |
| `V` | Select | Click, box-select, move, rotate (`Q`/`E`), copy/paste (`Ctrl+C/V/D`) |
| `X` `I` | Erase · eyedropper | Alt+click copies a texture or item |

Walls live **on edges**, so a door in a wall is one click. A piece (shape) and a texture are separate choices: any piece with any texture, and you can give the back side its own texture. **Storeys**: add a layer, build the upper room, put **stairs** on the lower layer and leave the cell above the stairs' top without a floor.

<figure class="shot"><img src="assets/screenshots/ed-fpsc-build.png" alt="Build palette with materials, textures and wall pieces such as walls, windows and doors" loading="lazy"><figcaption>Build tab: pick a material slot, a texture and a wall piece — every piece works with every texture.</figcaption></figure>

## Ready-made things
* **Enemies**: Soldier, Guard, Heavy gunner, Sniper (laser warning), Zombie, Runner, Robot trooper, flying Drone, Auto turret, Mech (rockets), **Boss** (3 phases, summons minions, health bar). They see, hear gunshots, open doors, find paths around walls and patrol routes you draw.
* **Pickups**: medkits, armor, four ammo types, five weapons, four key colours, coins and gems.
* **Lights**: lamps, neon, torches, fire barrels, a broken flickering light, an alarm light. Lights are *baked* — walls block them, so rooms really are dark next door.
* **Props**: barrels (some explode), breakable crates, tables, plants, trees, sandbags, a **terminal**, a **wall switch** and **fire / smoke / steam / spark emitters**.
* **Markers & triggers**: player start, checkpoint, level exit, teleporter, message zone, ambush trigger, hazard zone, sound emitter.

## Doors, keys and switches
Select a door piece. Give it a **name** (`vault`), tick a **key colour** to lock it, and untick *Opens by itself* if a switch should control it. Then:
* put the matching **key** pickup somewhere, **or**
* place a **Wall switch**, set its **Target** to `vault`, **or**
* give any entity a **rule**: *When used → Open → vault*.

## Scripts: attach behaviour
Every entity already has the right scripts (an enemy has a brain, a pickup gives something). In the **Inspector ▸ Scripts**:
* tune the parameters (damage, accuracy, speed, sight…), switch a script off or remove it;
* **attach** another one with *+ Attach script…*, or drag a card from the **Scripts** tab onto an entity;
* write your own: **Assets ▸ New script**, or open a built-in script in the Scripts tab and **Make an editable copy**.

A script is a small JavaScript file:
```js
export default {
  id: 'hello', title: 'Hello', cat: 'Custom', desc: 'Says hello when used.',
  params: { text: { type: 'string', label: 'Text', default: 'Hello!' } },   // becomes a form in the Inspector
  use(c, by) { c.say(c.p.text, 2); c.emit('used'); },                        // E pressed on it
  update(c, dt) { /* every frame */ },
};
```
Hooks: `start update use hurt die event heard idle`. `c.self` is the entity, `c.p` your parameters, `c.player`, `c.game`, plus `c.say`, `c.sound`, `c.emit`, `c.on`, `c.after`, `c.find`.

## Rules: logic without code
A rule reads *when → do → target*. Examples:
* *Terminal* — **When used → Open → bossgate**, **When used → Emit → alarm**, **When used → Spawn → enemy_drone ×2**.
* *Trigger zone* — **When enters → Message → "They are coming!"**.
* *Boss* — **When dies → Open → exit**. The **Level exit** has a *Needs event* property (`warden.died`) so it stays shut until then.
Targets are entity names, `#tags` (groups) or door names. The ✓ checker warns about targets that do not exist.

<figure class="shot"><img src="assets/screenshots/ed-fpsc-hall.png" alt="A dim wooden hall with windows, crates, a soldier and a checkpoint flag" loading="lazy"><figcaption>Baked lighting: walls block light, so lamps matter. The hall of the demo level.</figcaption></figure>

## Add your own assets
Everything you add lives in your project's `fpsc/` folder and works offline and in exports. Use the **Assets** tab:
* **Texture** — a seamless PNG/JPG; say how many metres one repeat covers. Every wall piece can use it.
* **Sprite enemy/prop** — a PNG with transparency (classic billboard look) that *behaves like* a built-in entity.
* **3D model** — a `.glb` (1 unit = 1 m, feet at the origin).
* **Sound** — WAV/OGG/MP3; if the name matches a built-in (`pistol`, `door`, `pickup`…) yours replaces it.
* **Script** — from a template.
<figure class="shot"><img src="assets/screenshots/ed-fpsc-assets.png" alt="Assets tab with forms to add textures, sprites, 3D models, sounds and scripts" loading="lazy"><figcaption>The Assets tab copies your files into <code>fpsc/</code> and registers them in <code>bank.json</code>.</figcaption></figure>

Power users edit `fpsc/bank.json` directly (new wall pieces, entities that *extend* built-ins, weapons). The full rules table is in **Help (F1)** and in `docs/FPS_CREATOR.md`.

## Playing, exporting, upgrading
* **Run** the project: the *FPS Level* entity loads the level named in `levels/`. Change **Level file** in its Inspector or set the *Next level* field to chain levels.
* **Export** as usual — `scripts/`, `levels/` and `fpsc/` are part of the project, so they ship automatically.
* **Upgrade** after updating Nord: *FPS Level ▸ Upgrade runtime* (or `nord fpsc init`). Your levels and `fpsc/` content are never overwritten.

## Troubleshooting
* *Rooms are very dark* → add lights, raise **Level ▸ Ambient light**, or choose a lighter floor texture.
* *Enemy stands still* → give it a path (`P`) or check that its **sight range** reaches the player and that a wall is not in the way.
* *Door will not open* → is it **locked**? Does the key exist? With *Opens by itself* off you need a switch, rule or `E`.
* *"Unknown entity type"* → a custom entity was removed from `fpsc/bank.json`.
* Console messages from play-testing appear in the editor's console (bottom of the map); errors name the script and hook.

## Find objects and refine patrols
Use the **Objects** tab to search placed entities by name, tag, type or script across every storey. Click a result to select it and centre the map; Shift-click toggles selection; double-click focuses the 3D preview. Choose **Current storey** to narrow the list.

The toolbar’s placement grid offers **0.25, 0.5, 1, 2 and 4 metres**; the default stays 0.5 m. It applies to entity placement, dragging and drawn waypoints. Turn Snap off for free placement. Room cells and wall edges still use the 4 m building grid.

Select an enemy and expand **Patrol path** to edit each point’s X/Z and wait in seconds (default 0.8). The arrow buttons reorder points; **+** inserts a midpoint after one; **×** removes it; **Reverse route** reverses the order. Drawing with P and Shift-click removal still work. Every route edit supports undo/redo and saves with your level.

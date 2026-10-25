---
title: 2D Level Creator — sprites, maps and physics
section: Manual
group: 2D and 3D worlds
order: 29
summary: Paint side-scroller and top-down maps, browse the Amiga and Kenney sprite bank, edit scripts and physics, test and export. Includes Machine Workshop.
---

## Where does my 2D level go? {#level-to-scene}

::: tip
**Save creates the real scene for you.** In 2D Level Creator, saving a level named `first_steps` writes **both** `levels/first_steps.level2d.json` and `scenes/first_steps.scene.json`. Then **Use as game start** selects that generated scene for the main Play button and export. You do not drag the `.level2d.json` into an empty scene.
:::

<div class="handoff-flow" aria-label="2D authoring level is compiled into a normal scene, which the project selects as its start scene">
<div><b>1 · EDIT</b><strong>2D Level Creator</strong><code>levels/<wbr>first_steps.level2d.json</code><span>Your editable map, layers, objects and scripts.</span></div>
<div><b>2 · SAVE</b><strong>A normal Nord scene</strong><code>scenes/<wbr>first_steps.scene.json</code><span>The generated tiles, Player, Camera and object components.</span></div>
<div><b>3 · USE AS GAME START</b><strong>Main Play and export</strong><code>nord.project.json → startScene</code><span>The project runs that saved scene.</span></div>
</div>

::: dummies
The level file is your editable recipe. Save cooks that recipe into a normal scene. The project's **Start scene** setting tells Play which cooked scene to open. **Test**, **Save**, and **Use as game start** are three different actions; testing alone does not publish or select anything.
:::

[Follow the complete walkthrough below](#first-playable-2d-level), or jump to [opening the generated scene](#open-generated-scene). The existing tool reference follows the walkthrough.

## Tutorial: your first playable 2D level {#first-playable-2d-level}

**Goal:** paint a small platform level, save it as `first_steps`, see its ordinary scene, and run it through the project's normal Play button. No JavaScript is required.

### 1. Start with a working player

1. From the project hub, create a project using **2D Platform Workshop**. Keep it in its own project folder. The editor opens the **2D Level** tab with a working map.
2. To make a fresh practice level, use @ui[2D Level ▸ New], select **Side-scroller workshop**, and confirm with **OK**. Save any previous work before replacing it.
3. Keep the starter's existing **Player**, floor, pickups and exit for this exercise. You should see their pictures on the map. Press **Home** if the map is outside the view.

::: tip
**Checkpoint:** you already have a playable foundation. The starter's Player has the controller, tags and body setup it needs. First change the environment around that player; creating a second Player is unnecessary.
:::

### 2. Paint a small platform

1. In @ui[Level], select the **World** layer. Keep it visible and unlocked, with **Parallax** set to `1` for colliding terrain.
2. Switch to @ui[Build], choose a terrain tile, and enable **Solid tiles** in the toolbar. Press **B** for Brush.
3. Paint a short ledge above the existing floor, leaving space for the Player to stand and jump. Use **R Rectangle** for a larger block. Use **X** to erase a mistake, or undo it.
4. Keep a continuous floor below the Player. The painted tile pictures should now appear on the map; solid tiles will act as obstacles in the game.

::: warn
**A visible tile is not automatically solid.** Check **Solid tiles** while painting and keep colliding tiles on a layer with Parallax `1`. A decorative background layer is a different job.
:::

### 3. Place a pickup and check the player

1. Open @ui[Items]. Choose a ready-made pickup card from the project's item bank, then use **B Brush** to click once above the floor. The new object appears at that position with its existing behavior.
2. Press **V** and select the placed object. Its Inspector shows its position, body and scripts. Move it somewhere reachable without putting it inside a solid tile.
3. Select the starter Player. Keep its name **Player** and its `player` tag. Those are used by the camera and interactions.

If you use **Create an item from a sprite** instead of a ready-made card, choose the appropriate **Placement role** before placing it. A decorative picture has different behavior from a Pickup or Player start. The ready-made item cards are the easiest route for this first exercise.

### 4. Test the unsaved map

1. Click @ui[▶ Test · F5] inside the 2D Level toolbar. The game opens over the level editor.
2. Focus the test, move with A/D or the arrows, and jump with Space. Try the new ledge and pickup.
3. Click **Stop · Shift+Esc**, or press Shift+Esc, to return to building. Adjust the map and test again until the player can move and land correctly.

::: tip
**Checkpoint:** your new ledge appears and blocks the Player in Test. This proves the map works in the Creator preview. It does **not** prove that main Play has selected this map yet.
:::

### 5. Save the level AND generate the scene

1. In the Creator's own top bar, click @ui[Save as…].
2. Enter **`first_steps`** and confirm with **OK**. Enter the basename only: no `levels/` prefix and no extension.
3. Read the status line at the bottom. It should report both **`levels/first_steps.level2d.json`** and **`scenes/first_steps.scene.json`** as saved. Future **Save** clicks update this pair.

![Save as dialog in the real 2D Level Creator with first_steps entered as the filename](assets/screenshots/ed-level2d-handoff-name.png)

![The Creator after saving, with the status line naming both the authoring level and generated scene](assets/screenshots/ed-level2d-handoff-save.png)

| File just created | Open it to do what? | Which file should you keep editing? |
|---|---|---|
| `levels/first_steps.level2d.json` | Reopen the editable map in **2D Level ▸ Open…** | This is your authoring source |
| `scenes/first_steps.scene.json` | Inspect the generated ordinary scene in Nord's **Scene** tab | Treat it as generated output while using the Creator |

Saving also copies the referenced bank assets and required scripts into your project. A successful save message is the handoff from the Creator to normal Nord files.

### 6. Tell the real game to use this scene

1. Still in **2D Level**, click @ui[Use as game start].
2. Read the confirmation: it saves the level and scene and updates the project's starting scene, display, physics and movement keys. Confirm with **OK** for this workshop project.
3. Check the status line for **game start updated**. This is the step that connects your map to the project's normal starting point.

![Use as game start confirmation explaining the saved scene and project-wide settings](assets/screenshots/ed-level2d-handoff-start.png)

**In the file** `nord.project.json` (check this one field; keep the rest of the manifest):
```json
{ "startScene": "scenes/first_steps.scene.json" }
```

::: warn
**This changes project-wide settings too.** Display size, physics and input are applied from the level. Use a separate workshop project while learning. For an existing game, review those settings before replacing them; all its scenes share the project configuration.
:::

### 7. Open the generated scene in the real Scene tab {#open-generated-scene}

1. Stop the Creator test and main Play, if either is running.
2. In Nord's normal @ui[Assets] panel, open the project's **scenes** folder and double-click **`first_steps.scene.json`**. The ordinary Scene tab opens that file.
3. Inspect @ui[Hierarchy]. You should find ordinary scene entities, including **Player**, **Camera**, and generated tile/object entities. This is already the “real scene”—it is not a picture of the Creator map.
4. In the normal @ui[Project] tab, expand **Project properties** and check **Start scene**. It should name `scenes/first_steps.scene.json`. If the field still shows an older setting, reopen the project first to refresh it. If you deliberately need to change it, select that path and click **Apply project properties**.
5. Press the normal editor's **Play** button. The saved `first_steps` map should run, including your ledge and pickup.

If the new scene is not listed or main Play still uses an older project setting, stop and reopen the project, then check the same paths again. Do not solve a file-selection problem by copying the tiles manually into another scene.

![The saved first_steps scene running through the normal game entry, showing the Player, floor, pickup line and added tile](assets/screenshots/ed-level2d-handoff-game.png)

::: dummies
Opening a scene for editing and choosing the project's Start scene are separate choices. The Scene tab says “this is what I am looking at.” **Start scene** says “this is where the whole game starts.” They can point at different files.
:::

### 8. Make a change and export

1. Return to **2D Level ▸ Open…** and open **`first_steps.level2d.json`**. Change one visible tile or pickup position.
2. Click the Creator's **Save**. That regenerates `scenes/first_steps.scene.json` from the updated authoring file. Test with normal Play again; the saved change should now appear there too.
3. Stop, save any other edited project files, then use @ui[File ▸ Export…] for a normal web-folder export. Open the exported game through a web server and verify the same starting map. See [Export](export.html) for hosting details.

::: warn
**Do not use the generated scene as a second independent source.** Manual edits to `scenes/first_steps.scene.json` can be overwritten by the next Creator Save. Make map/object/script changes in the Creator's authoring file when you want them to survive recompilation. There is no automatic merge into an unrelated scene you already made.
:::

### Tutorial checkpoint

- The Creator status line names **two** saved files with the same basename.
- The normal Scene tab can open `scenes/first_steps.scene.json` and shows generated entities.
- `nord.project.json` starts at that scene, and normal Play shows your latest saved edit.
- You can reopen `levels/first_steps.level2d.json` to continue authoring.

## Already have a title scene or custom game logic? {#level-in-existing-game}

Keep the authoring level and generated gameplay scene **inside the same 2D project** as your menu, assets and scripts. You do not have to make the gameplay scene the permanent project start if the game should begin with a title screen.

| What you want | Use this workflow |
|---|---|
| Game starts directly in the new map | Follow **Use as game start** above |
| Game starts at a title/menu scene, then opens the map | Keep the title as the project's Start scene; its Play action loads `scenes/first_steps.scene.json` |
| Custom level-wide HUD or controller | In Creator **Level ▸ Level controller**, choose your project script; Save preserves that authoring choice in the generated scene |
| Custom pickup or enemy behavior | Attach/configure scripts on objects in the Creator, then Save |
| Manually add entities to a generated scene | Know that a later Creator Save can overwrite those edits; prefer authoring-owned objects/scripts |

For a scripted transition, import `SceneManager` from `nord` and call `await SceneManager.LoadScene('scenes/first_steps.scene.json')` inside an async menu action. [Scenes and persistent objects](ex-scenes.html) supplies the complete workflow. The title and gameplay scene share project-wide physics and input, so review those settings before applying another level's defaults.

::: tip
**A useful mental model:** one project can hold a title scene and several generated level scenes. You choose which scene starts first, then scene-loading logic chooses what comes next. The Creator builds each level scene; it does not automatically add it as a child of your title scene.
:::

## Test works, but the real scene is wrong {#level-handoff-troubleshooting}

| What you see | Likely missing step | What to do |
|---|---|---|
| Test shows the new level, main Play shows the old one | Start scene still points at the previous scene | Use **Use as game start**, then check Project properties |
| Main Play shows an earlier version of the right map | Unsaved Creator changes | Stop Test and click Creator **Save** |
| You saved `first_steps` but still have `main.scene.json` open | Save does not automatically replace the document you are viewing | Open `scenes/first_steps.scene.json` in Assets |
| You drag `.level2d.json` and nothing useful happens | It is an authoring file, not a scene entity | Open it through Creator **Open…**, then Save and open its generated scene |
| Two files have similar names | Authoring map versus generated scene | `.level2d.json` is edited in the Creator; `.scene.json` runs as a normal scene |
| Scene edits vanish after a Creator Save | The generated scene was edited independently | Put persistent map/object changes in the authoring level |
| Player falls through art | Decoration or non-solid terrain | Check collision, Solid tiles, layer Parallax and body setup |
| No Player/camera behavior | Player role, name or tag was changed | Start from the workshop Player; keep **Player** and `player` |

## Existing tools and reference

The sections below remain the general reference for the Creator, sprites, layers, physics and project files.



The **2D Level** tab brings the FPS Level workflow to platform games, top-down games and physics puzzles. Start from **2D Platform Workshop**, **2D Top-down Workshop**, or **Machine Workshop** on the welcome screen.

::: dummies
A tile is a picture stamped on the grid. An object is a picture you can move independently and give scripts or a physics body. The Inspector changes how that object behaves. You can make a small game by painting solid ground, placing a player and pickups, and adding an exit.
:::

<figure class="shot"><img src="assets/screenshots/ed-level2d-bank.png" alt="2D Level Creator with the sprite palette, level map and physics object Inspector" loading="lazy"><figcaption>Build and Items share the sprite bank. The Inspector edits object values and scripts.</figcaption></figure>

## Find a useful starting point

The welcome screen has **Featured / All / 2D / 3D / FPS / Physics / Apps / Rust** filters for templates and samples. Featured keeps the short list manageable. Choose All to browse older examples; searching also finds older examples while Featured is active. No examples are deleted.

## Build a platform or top-down game

1. Create a project from the matching workshop template. Open **2D Level**; its saved workshop opens automatically.
2. In **Build**, filter by pack/category or search. The bank contains the original Amiga collection and CC0 Kenney terrain, characters, industrial parts, dungeon tiles, sports and shooter art. Cards show frame previews; animated sheets play their real presets.
3. Choose **B Brush**, **R Rectangle** or **F Fill** and paint on the map. **Solid tiles** gives those cells collision. Use X to erase and I to pick a picture from a tile/object.
4. In **Items**, the first cards are working project items with their scripts and values. Select one and use **B Brush** to click/drag on the map, or drag its card onto the map. Two Floors includes Rat/Key/Door/Potion/Stairs/Relic; tanks include Enemy/Brick/Steel/Base. To create a generic item from raw art, select **Player start**, **Pickup**, **Hazard**, **Exit / win**, **Door (E)**, **Patrolling enemy**, or a decoration/physics role, then choose a sprite and click to place. E is the object tool. Player must be named **Player** for the camera and have the `player` tag for interactions.
5. V selects and moves objects; Shift-click selects several. The Inspector changes position, size, rotation, frame/animation, tags, body and scripts. Script fields are editable values; advanced attributes use JSON. Controllers and pickups are copied from Nord's existing library.
6. F5 tests the unsaved level. WASD/arrows move, Space jumps in platform mode, E uses a nearby door, Esc pauses and R restarts. **Shift+Esc** returns to editing.

Middle/right drag or Space-drag pans, wheel zooms and Home fits the map. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, Ctrl/Cmd+D duplicates, Delete removes selected objects.

## Moving around
The view works like the Scene view: middle- or right-drag, Alt+drag, Space+drag or the **Q** Hand tool pans, the wheel zooms about the cursor, **Ctrl/Cmd** flips snapping while you drag, **Home** fits the level and **Shift+F** frames the selection.

## Layers and reusable items

**Level** manages layers from back to front. Select a layer to paint on it; hide, lock, reorder or rename it. Opacity and parallax control scenery. Parallax 1 is the normal world; 0 is fixed to the screen. Solid tile layers require 1. Hidden layers do not appear in gameplay. Brush clicks and palette drops both reject locked or hidden active layers; unlock and show the layer before placing content.

Select an object and use **Save as variant** to keep its appearance, body and scripts as a reusable item. **Assets** lists the saved variants; each placement gets a new independent identity. Variants live in the level file and are saved with it.

**Objects** finds placed things by name, tag or script and centres the map on them. **Scripts** attaches ready-made behaviors. Custom project scripts use `scripts/*.js` paths and can be edited through Nord's Code tab. Attach and configure the `Hazard / exit / switch / door` script to choose its action, target name, damage amount, win message and required score.

## Side-view physics and Machine Workshop

Choose **Level → Physics → Arcade** for ordinary platforms and action games. Choose **Matter** for rolling circles, rotated ramps and freely rotating boxes. Inspector controls include:

| Control | Effect |
|---|---|
| Body | None, static obstacle, dynamic simulated body, or script-driven kinematic body. |
| Trigger | Sends overlap events without blocking motion. |
| Shape | Box or circle; Arcade boxes remain axis-aligned. |
| Fixed rotation | Keeps a character upright; turn off for tumbling physics props. |
| Mass | Changes impulse and collision response. |
| Bounce | Restitution: 0 absorbs impact, larger values bounce. |
| Friction | Matter surface friction. |
| Drag | Slows body movement. |
| Gravity scale | 0 makes the body weightless; 1 uses normal gravity. |

Gravity is in pixels/s²; top-down mode uses zero gravity. Matter's kinematic bodies are static bodies moved by scripts. Joint/constraint editing is not included.

**Machine Workshop** is an original *The Incredible Machine*-style example. The main game begins in setup mode. Tune the two ramp angles, click **Release**, and guide the ball into the basket. **Reset** restores the apparatus. In 2D Level you can also move ramps and change body size, mass, bounce and friction. The sample's `scripts/machine.js` implements its setup controls; it uses normal Nord entities and Matter physics. No original TIM code or media is bundled.

<figure class="shot"><img src="assets/screenshots/ed-level2d-machine.png" alt="Machine Workshop with two sloped ramps, a ball and a goal basket" loading="lazy"><figcaption>A small side-view physics puzzle. Edit the apparatus through the same Inspector as a platform game.</figcaption></figure>

## Import your own art

**Assets → Import PNG** copies a local PNG into the project. **Register project image** adds an existing PNG or uniform spritesheet: set frame width/height, column count and optional consecutive-frame loop/FPS. A still image uses its full dimensions and one column. Save writes Nord metadata next to custom images. Remote image URLs are not accepted.

## Save and export the correct level

**Save** writes two files:

- `levels/<name>.level2d.json`: editable map, layers, objects, custom sprites and variants.
- `scenes/<name>.scene.json`: compiled ordinary Nord scene for Play/export.

Save copies only referenced bundled sheets, metadata and licence documents into the project. The editor bank and `TEMP/ART` are not required by an exported game. Existing edited scripts are preserved. A conflicting bundled asset is reported instead of overwritten.

Use **Use as game start** when this map should run from the main Play button or export. It saves the level/scene and applies project display, physics and input settings. Those settings affect the whole project. Then use Nord's normal **Export** command. F5 always tests unsaved data; main Play/export run saved files.

::: warn
The authoring JSON is the source of truth. If you edit its compiled scene in the ordinary Scene tab, a later 2D Level Save regenerates that scene. Machine Workshop keeps its setup controls through **Level → Level controller → scripts/machine.js**. Ordinary maps use `scripts/level2d/level-hud.js`; enter your own project script there to replace the HUD/controller.
:::

The editor currently supports finite orthogonal maps. It has no isometric/hex maps, automatic terrain rules, polygon/joint editor or Tiled/LDtk importer. Drag-and-drop feel in the native editor window has had less testing than the browser version.


## Check yourself

- Find your matching `.level2d.json` and generated `.scene.json`; both have the intended basename.
- Confirm Project properties points at the intended starting scene, or that your menu loads the generated gameplay scene.
- Change one Creator tile, Save, then prove it appears in normal Play and the exported game.
- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).

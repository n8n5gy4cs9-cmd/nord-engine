---
title: Getting started
section: Start here
order: 1
summary: A complete first-hour guide - install, tour the editor, learn the mental model, change a real game, export it.
---
Nord is an **editor**, like Unity or Godot. You open **NordEditor**, click through windows, press **▶ Play**, and see your game run. This guide takes about an hour and ends with a game you changed, understood and exported.

::: dummies
**Is `nord` a command I must type?** No. Everything in this guide is done by clicking in the editor. A small companion program also called `nord` exists for people who want to automate things (build servers, scripts). It is optional, and [Part 10](#part-10-the-optional-nord-command) explains exactly what it is. If you never open a terminal, you miss nothing.
:::

## Pick your path

| You are… | Do this |
|---|---|
| **New to game making** | Read every part in order. Parts 4–6 are the heart of it. |
| **Coming from Unity or Godot** | Skim Part 1, read the [translation table in Part 5](#part-5-the-mental-model), then jump to Part 6. |
| **Impatient** | Do Parts 1–3 (ten minutes), then [T01: Hello Nord](tut-t01-hello-nord.html). Come back for the rest. |
| **Just want to see what Nord can do** | Open the hub's **Examples** and play a few. Nothing in them is mocked up. |

## What you will have at the end
* A running platformer game, opened and played in the editor.
* A game you tuned (higher jumps, new text, a new script) without breaking it.
* A clear picture of **project → scene → entity → component → script**.
* An exported web folder you can put on any website.

---

## Part 1: Install and open the editor

**macOS (recommended).** Open **NordEditor.app**. If you are working from this repository instead, run `./run.sh` in the repo folder to start the editor from source, or `./build.sh` to produce the `.app`. The first compile of the editor takes a few minutes; later starts are quick.

**Windows and Linux.** Build with `./build.sh` (Linux) or `build-win.sh` (see `docs/BUILD_WINDOWS.md` in the repository). The editor is the `nord-editor` program in the output folder.

A splash screen shows for a moment, then the **project hub** opens.

::: tip
Everything here works **offline**. The manual you are reading is also inside the editor: click **Docs** in the hub or in any project.
:::

## Part 2: The project hub

The hub is the editor's front door. It has three jobs.

| Area | What it is for |
|---|---|
| **New project** | Pick a template, pick a folder, press create. Templates are complete starting points, such as *Platformer*, *3D platformer*, *Shooter*, *Puzzle grid* or *UI app*. |
| **Recent** | Projects you opened lately. Hover a row to see its full folder path. |
| **Examples and Tutorials** | Finished games and the lessons from this manual. Use the filter chips (**Featured, All, 2D, 3D, FPS, Physics, Apps, Rust**) and the search box. |

Two buttons are worth knowing now: **Docs** opens this manual, and **Back to projects** (inside a project) returns you here.

::: dummies
A **template** is a project somebody already built so you do not start from a blank page. In real engines too (Unity "Templates", Godot "demo projects"), the fastest way to learn is to open something that works and change it.
:::

## Part 3: Create your first project and press Play

1. In the hub choose **New project** and expand **Starter templates**.
2. Pick **Platformer**. Choose a folder you will find again, for example `Projects/my-first-game`. Create it.
3. The editor opens your new project. Press **▶ Play** in the toolbar (or **Cmd+R**).
4. Play it. **A / D** or the arrow keys run, **Space** jumps, **Shift** dashes. Stomp the slimes, collect coins, touch flags for checkpoints. The big slime at the end is the boss.
5. Press **■ Stop** (**Cmd+.**) to go back to editing.

**Checkpoint:** you can run left and right and jump. If the Game view is blank, look at the **Console** panel and read the first red message before touching anything.

::: tip
Always press Play on an untouched template first. If it works, any later breakage is *your* change, and undo (**Cmd+Z**) can fix it. If it does not work, tell yourself the template is broken before you hunt in your own edits.
:::

## Part 4: A guided tour of the editor

Look at the screen. The scene is in the middle, the list of things on the left, the settings of the selected thing on the right, files and messages at the bottom. (Dock tabs can be dragged around, so your layout may differ.)

<figure class="shot"><img src="assets/editor-layout.svg" alt="Nord editor diagram: toolbar above Hierarchy, Scene/Game and Inspector; Assets and Console below"><figcaption>Panel map. Start by clicking an item on the left and reading what appears on the right.</figcaption></figure>

Do each "try this" now. They take under a minute and each one teaches a reflex you will use daily.

### Toolbar
**▶ Play / ■ Stop** runs or stops the game. **Export…** packages it. The magnifier opens the **command palette** (**Cmd+K**): type what you want ("export", "new script") and run it. Forgotten where something lives? Use the palette.

*Try this:* press **Cmd+K**, type `play`, look at what it offers, press **Esc**.

### Hierarchy (left): *what exists*
The tree of every **entity** in the current scene: `Sky`, `Hills`, `Level`, `Hero`, the coins, the slimes, the `Boss`. Click one to select it. **Right-click** for Add child, Duplicate, Delete, Copy and Paste. Drag a row onto another to make it a child.

*Try this:* click `Hero`. The Scene view highlights the character and the Inspector fills with its settings.

### Scene view (centre): *arrange things*
The **Scene** tab is the edit view. Pan, zoom and drag things around. Keys **W / E / R** switch the move, rotate and scale handles, **F** focuses on the selection.

*Try this:* click a coin, press **W**, drag it somewhere else, then press **Cmd+Z** to undo.

### Game view (centre): *what the player sees*
The **Game** tab runs the real game. When you press Play, it shows here. Use Scene to build, Game to test.

### Inspector (right): *how each thing is set up*
For the selected entity: its **transform** (position, rotation, scale), its **components**, and its **scripts** with their adjustable values. Everything is a field you can type into. **+ Add component** and **+ Add script** live here.

*Try this:* select `Hero` and find the `platformer2d` script. You will see fields such as **Run speed** and `jumpForce`. You will use them in Part 6.

### Assets (bottom): *your files*
Pictures, sounds, 3D models and sprite sheets, shown as thumbnails. Drop a file from Finder to import it. Dropping an asset into empty Hierarchy space creates an entity from it.

### Library: *ready-made scripts and prefabs*
Searchable scripts, prefabs and kits. **Insert** adds one to the selected entity. This is how the template got its jumping, health and score: it is mostly library scripts glued together.

### Console (bottom): *messages and errors*
Everything the running game prints with `console.log`, plus errors. Click `file.js:12` to jump to that line. **When something is wrong, the Console is your first stop.**

### Code and Docs
**Code** is the built-in code editor with highlighting, autocomplete and error squiggles. **Docs** is this manual.

| Where you click | What it means |
|---|---|
| Hierarchy | Choose the thing you want to change. |
| Inspector | Change that thing's settings. |
| Scene view | Arrange things before the game runs. |
| Game view | See what a player will actually see. |
| Console | Read messages and errors from the game. |
| Assets | Browse, import and drag files. |
| Library | Add ready-made behaviour. |

## Part 5: The mental model

Nord has five ideas. Learn them once and every tutorial makes sense.

```
Project (a folder)
 └─ Scene (one level or screen, a .scene.json file)
     └─ Entity (one thing: hero, coin, camera, label)
         ├─ Components (data: sprite, collider, light, text...)
         └─ Scripts (code you attach: what it does)
```

* **Project** - a plain folder. Contains `nord.project.json`, scenes, scripts and assets. Copy the folder and you copied the game. It works with git.
* **Scene** - one saved arrangement of entities: a level, a menu, a title screen. `game.loadScene()` switches between them.
* **Entity** - an empty box with a name and a position. On its own it does nothing.
* **Component** - a feature you put in the box: a **sprite** (what it looks like), a **rigidbody** (obeys physics), a **text**, a **camera**, a **light**. Components are *data*.
* **Script** - a JavaScript file attached to an entity. Scripts are *behaviour*: "move when a key is pressed", "turn on when the player is near".

::: dummies
Build a player like a character sheet: the entity is the blank card, the **sprite** is the portrait, the **rigidbody** is "falls and collides", and the **script** is "moves when I press a key". You add only the features that thing needs.
:::

### If you already know another engine

| Nord | Unity | Godot | Notes |
|---|---|---|---|
| Entity | GameObject | Node | Entities can have children; child positions are relative to the parent. |
| Component | Component | (built into node types) | Plain JSON in the scene file. |
| Script (`NordScript`) | MonoBehaviour | Script on a node | `start()`, `update()`, `fixedUpdate()` are the familiar callbacks. |
| Scene | Scene | Scene | One JSON file. |
| Prefab | Prefab | Packed scene | Spawn at runtime with `this.scene.spawn(...)`. |
| Inspector | Inspector | Inspector | Script `static attributes` appear here, like `[SerializeField]` / `@export`. |
| Hierarchy | Hierarchy | Scene dock | |
| Console | Console | Output | |
| Library | Asset Store (offline) | AssetLib | Local and searchable. |

2D uses **pixels, y points down**. 3D uses **metres, y points up**. Rotation is in degrees.

### What actually runs the game
Nord is the workshop; under the hood it uses existing engines to draw: **Phaser** for 2D, **Babylon.js** with Havok physics for 3D, and Rust compiled to WebAssembly for the Rust tiers. You use Nord's own API (`entity.pos`, `game.loadScene(...)`); you do not need to learn Phaser or Babylon first. [How Nord works](how-nord-works.html) explains the pieces in plain English.

## Part 6: Change a real game (five small wins)

Do these on your Platformer project, in order. Save with **Cmd+S** after each, press Play, observe, press Stop. Keep the loop: **change → save → play → observe.**

### Win 1: Move something
Select a `Coin` in Hierarchy. In Inspector, change **Position** `x` or `y` by about 50. Press Play. The coin is now somewhere else.

### Win 2: Make the hero jump higher
Select `Hero`. In its `platformer2d` script, raise `jumpForce` from `420` to `520`. Play. You jump higher. Now try **Run speed** `180` → `260`. Try tick-boxes: turn **dash** off, turn **wallSlide** on.

Why this works: the script declared `static attributes`, and Nord shows each one as an Inspector field. You are editing *data*, not code.

### Win 3: Add text
Select the root of the scene (or add an entity with **Add entity**), name it `Welcome`, set position near `[320, 40, 0]`, then **+ Add component → text**. Set `text` = `Collect everything!`, `size` = `28`, `color` = `#ebcb8b`. Play: your words are on screen. (This is [T01](tut-t01-hello-nord.html) in miniature.)

### Win 4: Write your own script
Create `scripts/pulse.js` in the **Code** panel and paste:

```js
import { NordScript } from 'nord';
export default class Pulse extends NordScript {
  static attributes = {
    amount: { type: 'number', default: 0.2, min: 0, max: 1 },
    rate:   { type: 'number', default: 3 },
  };
  start() { this.base = [...this.entity.scale]; }
  update() {
    const k = 1 + Math.sin(this.time.elapsed * this.attrs.rate) * this.attrs.amount;
    this.entity.scale = this.base.map((v) => v * k);
  }
}
```

Select a `Coin`, **+ Add script**, choose `scripts/pulse.js`. Play: the coin breathes. Read it aloud: *when I start, remember my scale; every frame, scale me by a sine wave.*

### Win 5: Hot reload and breaking things on purpose
While the game is **running**, change `3` to `8` in `rate` through the Inspector, or edit the script and save. The game keeps running with the new behaviour: that is **hot reload**. Now delete a bracket and save. The game keeps its last working code and the Console shows the error with a `file:line` link. You cannot ruin anything by trying.

**Checkpoint:** you changed settings, text and code, and each time the game told you what happened.

::: tip
When you want a feature (health bar, enemy patrol, pickups), search the **Library** before writing code. Then read [Scripting](scripting.html) when you want to know why a library script works.
:::

## Part 7: Save, undo and your files

* **Cmd+S** saves. The editor also autosaves for crash recovery.
* **Cmd+Z / Shift+Cmd+Z** undo and redo almost everything in a scene.
* Your project is a folder of readable files:

```
my-first-game/
├─ nord.project.json      project settings (type, start scene, display size)
├─ scenes/main.scene.json entities and components
├─ scripts/pulse.js       your code
├─ assets/                pictures, sounds, models
└─ dist/                  export output (created when you export)
```

::: dummies
**Examples edit their own source.** With **Settings → USE CACHED CONTENT** off (the default), opening an example and saving changes that example's files. For experiments, always create your own project from a template, as you did in Part 3. [Details](editor-tour.html#current-example-content).
:::

## Part 8: Make something of your own

You now know enough to start. A good order, borrowed from how other engines teach:

1. **Reshape the template.** Move platforms, add coins, change colours. Keep playing after each tweak.
2. **Follow the tutorials in order.** [T01 Hello Nord](tut-t01-hello-nord.html), [T02 Sprite and movement](tut-t02-sprite-movement.html), [T03 First script](tut-t03-first-script.html), [T04 Platformer](tut-t04-platformer.html). Each names its goal, shows the expected result and ends with a visible check.
3. **Build one complete small game** such as Coin Canyon from the [tutorial list](tutorials.html) before starting a big one. Finishing teaches more than starting.
4. **Reach for the reference only when you need it.** The [Manual](welcome.html) explains tools; the [API](api.html) lists exact methods.

Habits that save hours:

* Change **one thing at a time**, then Play.
* Read the **first** error in the Console, not the last.
* Prefer Inspector fields and Library scripts to hand-written code until you need something unique.
* Keep a copy (git, or just duplicate the folder) before big experiments.
* Name entities clearly: `Hero`, `CoinTrail`, `ScoreLabel`.

## Part 9: Export your game

When the game runs well, press **Export…** in the toolbar and follow the dialog. The result is a static folder (`dist`) containing `index.html` and all assets.

* Share **the whole folder**, never only `index.html`.
* Put it on any web host (itch.io, GitHub Pages, your own server). Most browsers need the folder to be *served*; double-clicking `index.html` may fail because of browser security rules.
* Mac app, Windows and Linux bundles are also possible: see [Export and hosting](export.html) and the [desktop apps chapter](desktop-apps.html).

## Part 10: The optional `nord` command

You may have seen commands such as `nord new` or `nord build` in places. Here is what they are.

**`nord` is the Nord Engine command-line tool.** It is a small program that does the same project jobs as the editor, but without a window. It exists for:

* **Automation** - export on a build server or in a GitHub Action.
* **Scripting** - validate projects (`nord check`), generate thumbnails, pack addons.
* **Tinkerers** - people who prefer a terminal to menus.

**It is not how you use the engine.** Creating, editing, playing and exporting from the editor needs no terminal.

**Where it lives.** It ships inside the app, next to the editor. On macOS that is `NordEditor.app/Contents/MacOS/nord`; in a source checkout it is built with `cargo build --release -p nord-cli` and lands in `target/release/nord`. It is **not on your PATH automatically**, so typing `nord` in a fresh terminal says "command not found" until you add it, for example:

```bash
sudo ln -s /Applications/NordEditor.app/Contents/MacOS/nord /usr/local/bin/nord
```

Adjust the path to wherever your app is. Without installing, run it by its full path.

| Command | Does the same as |
|---|---|
| `nord info` | Print engine info. |
| `nord doctor` | Check your toolchain and recommend a project tier. |
| `nord new my-game -t platformer` | Hub → **New project** → *Platformer*. |
| `nord serve my-game` | A development server with live reload at `http://localhost:4173`, so you can play in a browser tab. |
| `nord check my-game` | Validate ids, scenes and missing files. |
| `nord build my-game` | Toolbar → **Export…**; writes `my-game/dist`. |

`nord --help` lists everything else, including the bundling and addon commands.

## If you get stuck

| What you see | Try this |
|---|---|
| A blank Game view | Check Console. Confirm the project has a start scene and visible entities inside the camera view. |
| Play does nothing | Click once inside the Game view so it has keyboard focus. |
| Your change disappeared | Save (**Cmd+S**). Check that you reopened *your* project folder, not an example. |
| A picture will not load | Check its project-relative path and the exact filename, including capitals. |
| No sound | Click or tap the game once; browsers wait for a gesture before playing audio. |
| Code changed but an imported helper did not | Stop and Play again; imported helper modules need a full restart. |
| `nord: command not found` | You do not need it. See [Part 10](#part-10-the-optional-nord-command) if you want it. |
| You broke something | **Cmd+Z**. If that is not enough, recreate the project from the template and compare. |

## Words you met

| Word | Meaning |
|---|---|
| Project | The folder holding the whole game. |
| Scene | A saved level or screen. |
| Entity | One thing in a scene. |
| Component | A feature attached to an entity. |
| Script | A code file that gives an entity behaviour. |
| Attribute | A script setting shown as an Inspector field. |
| Hot reload | Code changes applied while the game runs. |
| Export | Packaging the game into a folder others can play. |
| Tier | Project kind: HTML, 2D, 3D, Rust game, Rust app. |

More terms are in the [glossary](glossary.html).

## Where next

* [How Nord works](how-nord-works.html) - the pieces and the engines under the hood.
* [T01 Hello Nord](tut-t01-hello-nord.html) - your first from-scratch scene.
* [Editor tour](editor-tour.html) - every panel in detail.
* [Scripting](scripting.html) - lifecycle, input, events and the full API.

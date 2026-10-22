---
title: How Nord works
section: Start here
order: 2
summary: What is on your computer, what runs your game, and which libraries do the work - in plain words, with exact versions.
---
**Nord is a workbench for making games and apps.** You arrange pictures, 3D shapes, sounds and rules in the editor, press Play, and the game runs. When you are happy, Nord packs the game into a folder anyone can open in a web browser.

This page explains what is going on behind the Play button, and which other people's software Nord relies on. You do not need any of it to make your first game. Read it when you want to know *why* things behave the way they do.

## The whole picture on one screen

<div class="flow" role="img" aria-label="You use the Nord editor, which saves your game folder. Play or Export runs the game player, made of nord.js plus a drawing library plus a physics library, which produces a game in the editor, a browser tab or a stand-alone window.">
<div class="row">
<div class="node you"><b>1 · You</b>Click, type, press Play<small>No terminal needed</small></div>
<div class="arrow">→</div>
<div class="node"><b>2 · Nord editor</b>Windows, panels, tools<small>A desktop program</small></div>
<div class="arrow">⇄</div>
<div class="node files"><b>3 · Your game folder</b>Scenes, scripts, pictures, sounds<small>Plain files you own</small></div>
</div>
<div class="down"><span>Play / Export</span><i>↓</i></div>
<div class="node player"><b>4 · The game player</b>A small web page that runs your game
<div class="stack">
<div class="chip">Nord's own code<em>nord.js</em></div>
<div class="chip">+ a drawing library<em>Phaser · Babylon.js</em></div>
<div class="chip">+ a physics library<em>Havok · Arcade · Matter</em></div>
</div></div>
<div class="down"><i>↓</i></div>
<div class="out">
<div class="node"><b>5 · In the editor</b>Game tab<small>Test as you build</small></div>
<div class="node"><b>5 · In a browser</b>Browser tab<small>Share the exported folder</small></div>
<div class="node"><b>5 · On the desktop</b>Stand-alone window<small>A Mac app, for example</small></div>
</div>
<p class="hint">Click a box to highlight it.</p>
</div>

Three things to take from it:

1. **The editor and the game are separate.** The editor is a desktop program you use. The game is a small web page that Nord starts when you press Play.
2. **Your work is saved as ordinary files** in a folder. The editor reads and writes them; the game reads them too.
3. **Nord does not draw things itself.** It hands the drawing and the physics to well-known open-source libraries. Nord's job is to give you one friendly set of tools in front of them.

## Part 1: The pieces, in plain words

| Word | What it means | Where you meet it |
|---|---|---|
| **Editor** | The desktop program where you build. | The Nord Engine app, before you press Play. |
| **Project** | A folder with everything about one game. | The folder you picked in the hub. |
| **Scene** | One screen or level, saved as a file. | `scenes/main.scene.json`. |
| **Entity** | One thing in a scene: a hero, a coin, a camera, a label. | The Hierarchy list. |
| **Component** | A feature attached to an entity: a picture, a shape for collisions, a light. | The Inspector's **+ Add component**. |
| **Script** | A code file that tells an entity how to behave. | `scripts/*.js`, **+ Add script**. |
| **Runtime** | The code that runs while someone plays. | The Game view, or an exported game. |
| **Export** | A finished copy of the game for players. | The `dist` folder, or an app bundle. |

::: dummies
A player character: the **entity** is a blank card. A **sprite component** is its portrait. A **physics component** makes it fall and bump into things. A **script** says "move when I press an arrow key". You add only what that thing needs.
:::

## Part 2: What happens when you press Play

1. **Nord saves a snapshot of your project** and starts a tiny local web server. (A web server is a program that hands files to a browser; this one only talks to your own computer.)
2. **A game page opens inside the editor** (the **Game** tab). It loads Nord's own code, `nord.js`, plus the drawing and physics libraries for your project's type.
3. **The page reads your start scene** and creates every entity and component in it.
4. **Your scripts get their first call.** Each script's `start()` runs once.
5. **Then the game loop begins.** About 60 times every second, the game does the same short cycle, called a **frame**: read the keyboard, run every script's `update()`, step the physics, redraw the picture.
6. **Save a script while it runs** and Nord swaps in the new code without restarting. This is *hot reload*.
7. **Press Stop** and the page is thrown away. Your project is unchanged, except for what you saved.

::: dummies
A game is a flip-book drawn very quickly. A frame is one page of the flip-book. Between pages, the game checks what you pressed and moves things a little. At 60 pages a second, it looks like movement.
:::

The same game page, packed into a folder, is what **Export** gives you. That is why a game that works in Play also works on a website: it is literally the same program.

## Part 3: The libraries Nord uses

Nord stands on these open-source libraries. Versions are the ones bundled with Nord, checked on **2026-10-22** against `vendor/VENDOR.json` and `Cargo.lock`. Everything is included in the app and works offline.

### Drawing and physics for games (run in the game page)

| Library | Version | Used for | Project type |
|---|---|---|---|
| **Phaser** | 4.2.1 | Drawing 2D pictures, text, tile maps and particles; Arcade and Matter physics. | `2d` |
| **Babylon.js** | 9.30.0 | Drawing 3D models, cameras, lights, materials and 3D menus (plus its loaders, GUI, materials, post-process, procedural textures and serializers add-ons, all 9.30.0). | `3d` |
| **Havok Physics** | 1.3.14 | 3D physics: falling, bouncing, colliding. Used with Babylon. | `3d` |
| **PlayCanvas** | 2.23.2 | Optional alternative 3D renderer. Physics, particles and some effects are not supported yet. | optional |

### Rust projects (compiled to run in a browser)

| Library | Version | Used for | Project type |
|---|---|---|---|
| **macroquad** | 0.4.16 | Drawing and sound for Rust games. | `wasm-game` |
| **rapier2d** | 0.22 | 2D physics for Rust games. | `wasm-game` |
| **eframe / egui** | 0.31.1 | Buttons, text boxes and windows for Rust apps (and for the editor itself). | `wasm-app` |

### The editor program itself

| Library | Version | Used for |
|---|---|---|
| **Rust** (compiler used to build Nord) | 1.96.0 | The language the editor and command-line tool are written in. |
| **eframe / egui** | 0.31.1 | The editor's windows, panels and buttons. |
| **wry** | 0.50.5 | The web view inside the editor that shows your running game. |
| **tao** | 0.33.0 | Opens native windows for the game player. |
| **CodeMirror** | 6 | The code editor with highlighting and autocomplete. |
| **esbuild (WASM)** | 0.25.10 | Minifies and bundles a game into a single file when you export (optional). |
| **marked** | 18.1.0 | Turns Markdown into pages (this manual). |
| **Lucide** | 1.55.0 | The icons. |
| **Fonts** | 5.3.0 | The bundled typefaces. |

::: tip
A newer version of a library may exist. Nord ships the versions above on purpose: they are the ones tested together. The authoritative list is `vendor/VENDOR.json` (web libraries) and `Cargo.lock` (Rust libraries); `AGENTS.md` records that this table must be updated when they change.
:::

### Words you can skip until you are curious

* **WebGL** - a web-browser feature that lets a page use the computer's graphics chip. Phaser and Babylon use it to draw quickly. You never call it yourself.
* **WebAssembly (WASM)** - a format that lets a browser run programs written in languages like Rust. Nord uses it for the two Rust project types. JavaScript scripts are *not* converted to Rust.
* **Shader** - a tiny program that decides the colour of each pixel or surface. Optional; advanced.
* **Physics engine** - code that works out how things fall, bounce and collide so that you do not have to.

## Part 4: What each project type uses

Pick the type when you create a project; it is stored in `nord.project.json` as `type`.

| You want | Type | Drawn by | Physics by | You write |
|---|---|---|---|---|
| A platformer, puzzle, top-down or arcade game | `2d` | Phaser 4.2.1 | Arcade or Matter | JavaScript, or no code with the creators |
| A 3D world, first-person or driving game | `3d` | Babylon.js 9.30.0 | Havok 1.3.14 | JavaScript, or the FPS Creator |
| A tool, dashboard or plain web app | `html` | The browser | none | HTML, CSS, JavaScript |
| A game written in Rust | `wasm-game` | macroquad 0.4.16 | rapier2d 0.22 | Rust |
| An app written in Rust | `wasm-app` | egui 0.31.1 | none | Rust |

For a first game, **choose `2d`**. It has the fewest moving parts. You can make a 3D project later; nothing is lost.

The Rust types need **Rust installed** on your computer (with the WebAssembly target). Nord runs Rust's own build tool, `cargo`, and packages the result for the browser; it does not include a Rust compiler. They also do not read all of Nord's JavaScript features. [The Rust guide](rust-wasm.html) covers setup, what has been tested and what they support.

## Part 5: Nord's tools sit on top

Besides the editor panels, Nord includes tools that build things for you. They all save normal project files that the same player runs:

* **2D Level Creator** (the **2D Level** tab) paints platform and top-down maps and places objects. [Guide](level-creator-2d.html).
* **FPS Creator** (the **FPS Level** tab) builds first-person levels on a grid. [Guide](fps-creator.html).
* **Event sheets** and **Behaviors** make game logic without code. [Event sheets](event-sheets.html), [Behaviors](behaviors.html).
* **Sprite, animation, tilemap, particle and timeline editors** make art and motion. [Sprites](sprites-animation-tilemaps.html), [Effects](effects-particles-timelines.html).
* **Debugger and profiler** show what a running game is doing. [Debugger](debugger.html).

## Part 6: Nord's API and the libraries' APIs

An **API** is the list of commands a library understands. You will meet three layers:

1. **Nord's API** - what you should use first. Examples: `this.entity.pos`, `this.input.axis('left', 'right')`, `game.loadScene('scenes/level2.scene.json')`. It works the same in 2D and 3D. Reference: [API](api.html).
2. **Nord's components** - the settings you edit in the Inspector, such as `sprite`, `text`, `rigidbody`, `light`. Reference: [Components](components.html).
3. **The library underneath** - Phaser or Babylon. Nord keeps these hidden on purpose. For something Nord has not wrapped yet, an *escape hatch* gives you the raw object: `entity.native`, and on some components `component.obj` or `component.mesh`. The raw objects differ between Phaser and Babylon, so code that uses them is tied to that engine and version. Reference: [Engine documentation](engine-docs.html), which is labelled by engine and version.

::: dummies
Think of Nord as a car's dashboard. You press the pedal and turn the wheel (Nord's API). Under the bonnet there is an engine you did not build (Phaser, Babylon). There is a hatch if you ever need to reach it, but most drivers never open it.
:::

## Part 7: Where your files are, and what is stored

| What | Where |
|---|---|
| Your game | The project folder you chose: `nord.project.json`, `scenes/`, `scripts/`, `assets/` |
| Your export | `dist/` inside the project |
| Thumbnails and autosaves | `.nord-cache/` inside the project (safe to delete) |
| Editor preferences, recent projects, layout | `~/.config/nord/` on macOS and Linux; `%APPDATA%\NordEngine\` on Windows |

Nothing is uploaded anywhere. Nord never needs the internet to edit, play or export.

## Part 8: The same engine without the window

The editor and the optional `nord` command-line tool use the same project code. Anything you do by clicking, such as creating, validating, serving or exporting a project, the command line can also do for scripts and build servers. It is not required. See [Getting started, Part 11](getting-started.html#part-11-the-optional-nord-command).

## Where next

* [Getting started](getting-started.html) - install, tour the editor, change a real game.
* [T01 Hello Nord](tut-t01-hello-nord.html) - your first scene, from nothing.
* [Editor tour](editor-tour.html) - every panel in detail.
* [Scripting](scripting.html) - the full script guide.

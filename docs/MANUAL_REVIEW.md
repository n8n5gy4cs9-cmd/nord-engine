# Manual page review — 25 October 2026

This report inventories every published content page. The pass checks current/Old navigation, a beginner explanation on each page, retained local illustrations, archive notices, and topic directories on all six section landing pages. The manual builder separately checks links, anchors and live snippets. The browser pass checks all eleven themes, text contrast, offline search and collapse behavior.

Earlier workflows are retained for existing projects. Old does not mean that a supported native API is broken. Existing tutorial/example code is preserved, apart from correcting T01's claim that Play edits save the starting scene. This is a navigation, clarity and structural review; it is not a new human execution of every older workshop.

261 content pages: 245 current, 16 Old.

| Page | Area | Disposition and topic |
|---|---|---|
| [Getting started](manual/nord/start/getting-started.html) | Start here | Open a working project, learn the five editor concepts, make a safe change and choose your next lesson. |
| [How Nord works](manual/nord/start/how-nord-works.html) | Start here | What is on your computer, what runs your game, and which libraries do the work - in plain words, with exact versions. |
| [Programming basics — your first MonoBehaviour](manual/nord/start/programming-basics.html) | Start here | Learn variables, methods, lifecycle, fields and elapsed time through one complete Unity-style movement script. |
| [Original first-hour guide (old)](manual/nord/start/start-legacy.html) | Start here | **Old:** Original first-hour guide, including older shortcuts and the native Pulse script. Retained as a historical snapshot; use the revised first-session workflow. |
| [Programming for dummy developers](manual/nord/start/developer-basics.html) | Start here | **Old:** Original programming introduction uses the lower-case NordScript lifecycle. New beginners should learn MonoBehaviour first. |
| [Manual — choose a task](manual/nord/manual/manual-paths.html) | Manual | A structured reading path through the editor, gameplay systems and publishing tools. |
| [Editor tour](manual/nord/manual/editor-tour.html) | Manual | Panels, viewport, inspector, code editor, console, shortcuts. |
| [Editor appearance](manual/nord/manual/appearance.html) | Manual | Themes, font pairs, interface/text/button size with reset, and the built-in theme editor for your own themes. Everything is saved when you close the app. |
| [Organising your project](manual/nord/manual/organise-project.html) | Manual | Colour folders, custom folder icons, colour tags and descriptions for any asset, the Notes manager, the Console with tags and search, and the Transform grid. Saved per project. |
| [Projects & scenes](manual/nord/manual/projects-scenes.html) | Manual | Folder layout, entities, components, prefabs, tags and layers. |
| [The library](manual/nord/manual/library.html) | Manual | Scripts, prefabs, shaders, apps and templates you can drop in — and how to add your own. |
| [Unity-style workflow](manual/nord/manual/unity-workflow.html) | Manual | Layouts, menus, Scene-view tools, prefabs, materials, Build Settings, Game view, New scene and the first-10-minutes checklist. |
| [AI and MCP](manual/nord/manual/ai-mcp.html) | Manual | Let Claude Code, opencode, Codex or pi build a Nord game for you: install the Nord MCP server, what the tools do, and the 3D Modeler tools with a preview the AI can look at. |
| [Unity coverage](manual/nord/manual/unity-coverage.html) | Manual | What of Unity's scripting API works in Nord, what works with limits, and what is missing. Honest list with counts. |
| [Unity-style scripting](manual/nord/manual/unity-scripting.html) | Manual | MonoBehaviour, Singleton, GameManager, AudioManager, coroutines, Invoke, UnityEvent, ScriptableObject and ObjectPool: how to create them, attach them, and every method, with Unity names and step-by-step examples. |
| [2D games](manual/nord/manual/2d.html) | Manual | Sprites, animation, tilemaps, cameras, particles, lights, text, parallax. |
| [3D games](manual/nord/manual/3d.html) | Manual | Models, materials, lights/shadows, skybox, cameras, animation, post-processing, GUI. |
| [Physics](manual/nord/manual/physics.html) | Manual | 2D arcade/matter, 3D Havok, bodies, triggers, raycasts. |
| [Assets](manual/nord/manual/assets.html) | Manual | Importing, thumbnails, spritesheets, models, audio, fonts, optional packs. |
| [Layout, layers and objects](manual/nord/manual/layout-editor.html) | Manual | Layers with parallax and opacity, guides and rulers, aligning objects, object types, saved views and layouts — the Construct-style layout tools. |
| [Sprites, animation and tilemaps](manual/nord/manual/sprites-animation-tilemaps.html) | Manual | Paint pixel art, set origins and image points, build animations from frames or GIFs, and paint tilemaps with auto-tiling. |
| [FPS Creator — build first-person levels](manual/nord/manual/fps-creator.html) | Manual | A grid level editor with walls, doors, windows, stairs, lights, ready-made enemies, pickups, scripts and no-code rules. Build, play-test with F5, ship with your game. |
| [2D Level Creator — sprites, maps and physics](manual/nord/manual/level-creator-2d.html) | Manual | Paint side-scroller and top-down maps, browse the Amiga and Kenney sprite bank, edit scripts and physics, test and export. Includes Machine Workshop. |
| [3D Modeler](manual/nord/manual/modeler.html) | Manual | Full guide to the 3D Modeler: build a model from scratch, open and change the models of your scene with their textures, paint, fix UVs, and save as overwrite, new model, prefab or variant. Every tool explained with screenshots. |
| [Audio](manual/nord/manual/audio.html) | Manual | Sound effects, music, buses, autoplay rules. |
| [UI & HUD](manual/nord/manual/ui.html) | Manual | DOM HUD, menus, themes and skins, touch controls, 3D labels. |
| [Input](manual/nord/manual/input.html) | Manual | Actions, keyboard, mouse, touch, gamepad, rebinding. |
| [Event sheets](manual/nord/manual/event-sheets.html) | Manual | Build game logic without code — conditions, actions, picking, triggers, loops, variables and functions, the Construct way. |
| [Behaviors](manual/nord/manual/behaviors.html) | Manual | Attach ready-made movement and gameplay (Platform, 8-Direction, Bullet, Sine, Turret, Pathfinding…) to any entity. |
| [Effects, particles and timelines](manual/nord/manual/effects-particles-timelines.html) | Manual | Blur, glow, vignette and colour effects; a particle editor with live preview; keyframe timelines with easing. |
| [Addons, data objects and languages](manual/nord/manual/addons-data-localisation.html) | Manual | Extend event sheets with your own plugins, keep data in Array/Dictionary/JSON objects, and translate your game. |
| [UI Designer](manual/nord/manual/ui-designer.html) | Manual | Build menus, HUDs and dialogs visually. Layout, text, images and 9-slice, skins, input fields, and how a button reaches your code. |
| [Node graphs (visual scripting)](manual/nord/manual/graph.html) | Manual | Make gameplay by connecting nodes: events, flow, math, entities, input, UI, audio and scenes. No code needed, and an escape hatch to any code when you need it. |
| [Animator](manual/nord/manual/animator.html) | Manual | A Unity-style state machine for sprite animation. Parameters, states, transitions with conditions, Any State, live testing. |
| [Multiplayer](manual/nord/manual/multiplayer.html) | Manual | Host and join a room, send messages, call functions on other players (RPC), spawn and sync entities, and test with fake lag. Peer to peer, no server. |
| [In-game Dev Console](manual/nord/manual/dev-console.html) | Manual | Drop one prefab into your game and get a command console with cheats, autocomplete and your own commands. Add commands with one line of code. |
| [Rust / WASM](manual/nord/manual/rust-wasm.html) | Manual | Rust game runtime (macroquad + rapier) and Rust apps (egui), building and limits. |
| [Export & hosting](manual/nord/manual/export.html) | Manual | Static web builds, single-file, Mac app, hosting recipes, offline guarantee. |
| [Performance & debugging](manual/nord/manual/performance.html) | Manual | Profiling, pooling, texture and physics budgets. |
| [Find an API or file setting](manual/nord/manual/reference.html) | Manual | Choose the Unity API, native Nord API, component fields or file reference for the task in front of you. |
| [Desktop apps](manual/nord/manual/desktop-apps.html) | Manual | Real native apps — files, dialogs, notifications, tray, menus, storage, a local web server — from the same project, in JS or Rust. |
| [Debugger and profiler](manual/nord/manual/debugger.html) | Manual | Pause, step, breakpoints on events, live instance editing, an expression console and a frame profiler — in any running game. |
| [Preview, history and project tools](manual/nord/manual/preview-history-tools.html) | Manual | Test on your phone, undo a bad afternoon with version history, rename safely, and export an installable web app. |
| [Run the editor in a browser or on a server](manual/nord/manual/web-editor.html) | Manual | The same Nord editor in a browser tab (no install, projects stay in your browser) or on your own Linux server for you and your team. |
| [Welcome](manual/nord/manual/welcome.html) | Manual | **Old:** Earlier welcome and chapter list duplicates the current entry points. Feature details remain in the relevant Manual chapters. |
| [Scripting](manual/nord/manual/scripting.html) | Manual | **Old:** Native NordScript lifecycle reference, preserved for existing projects. New gameplay scripts use the Unity-style layer. |
| [Learn by building](manual/nord/tutorials/tutorials.html) | Tutorials | Pick a learning path or browse every tutorial by level and topic. |
| [T01 Hello Nord](manual/nord/tutorials/tut-t01-hello-nord.html) | Tutorials | Create a project, add an entity with text, press Play. |
| [T04 Platformer from template](manual/nord/tutorials/tut-t04-platformer.html) | Tutorials | Start from the platformer template and customise it with attributes. |
| [T05 Physics & collisions](manual/nord/tutorials/tut-t05-physics.html) | Tutorials | Rigidbodies, colliders, triggers, bounce pads, pickups. |
| [T06 Tilemaps](manual/nord/tutorials/tut-t06-tilemaps.html) | Tutorials | Paint a level with the tilemap painter and make tiles solid. |
| [T07 Animation & juice](manual/nord/tutorials/tut-t07-animation-juice.html) | Tutorials | Animated sprites, tweens, particles, camera shake, hit-stop. |
| [T08 UI & HUD](manual/nord/tutorials/tut-t08-ui-hud.html) | Tutorials | Score, hearts, menus and game-over screen. |
| [T09 Audio](manual/nord/tutorials/tut-t09-audio.html) | Tutorials | Sound effects through events, music crossfades, volume sliders. |
| [T10 3D scene & camera](manual/nord/tutorials/tut-t10-3d-scene.html) | Tutorials | Primitives, lights, shadows, skybox and an orbit camera. |
| [T11 3D physics (FPS)](manual/nord/tutorials/tut-t11-3d-physics.html) | Tutorials | First-person controller, crates, hit-scan shooting. |
| [T12 Enemy AI](manual/nord/tutorials/tut-t12-enemy-ai.html) | Tutorials | Patrol, chase, state machines, waves. |
| [T13 Save & load](manual/nord/tutorials/tut-t13-save-load.html) | Tutorials | Persistent data, slots, high scores. |
| [T14 Export to web & host it](manual/nord/tutorials/tut-t14-export-host.html) | Tutorials | Build a static folder, test it, upload it. |
| [T15 Mac app](manual/nord/tutorials/tut-t15-mac-app.html) | Tutorials | Wrap a build into a double-clickable .app and .dmg. |
| [T16 Rust/WASM game](manual/nord/tutorials/tut-t16-rust-game.html) | Tutorials | A Rust-scripted 2D game running natively and in the browser. |
| [T17 Rust egui app](manual/nord/tutorials/tut-t17-rust-egui-app.html) | Tutorials | A tool/app with egui that runs natively and on the web. |
| [T18 Writing library snippets](manual/nord/tutorials/tut-t18-library-snippets.html) | Tutorials | Create a reusable script, document it, add it to the index. |
| [T19 Build notepaint, from a blank folder](manual/nord/tutorials/tut-t19-notepaint.html) | Tutorials | Recreate a complete notes-and-paint app, with every file, autosave, drawing tools and portable documents. |
| [T20 Build Star-Not, a complete small space adventure](manual/nord/tutorials/tut-t20-star-not.html) | Tutorials | Recreate the solar chart, three races, diplomacy, ship combat, campaign saves, co-op and ending. |
| [T21 Plan a bigger Nord project](manual/nord/tutorials/tut-t21-project-design.html) | Tutorials | A plain-text game design and folder example, with responsibilities, milestones and practical scope choices. |
| [T22 Put a terrain shader in a Nord app](manual/nord/tutorials/tut-t22-shader-terrain.html) | Tutorials | Render the provided synthwave shader in Play/export, add audio, click terrain and drop a cube onto a matching GPU height. |
| [T23 2D lights and real shadows](manual/nord/tutorials/tut-t23-light-shadows.html) | Tutorials | Make any 2D scene dark, add torches and a flashlight that cast real shadows, tune darkness / light force / shadow softness, and use the light in gameplay. Includes a copy-paste kit. |
| [T24 A platformer from events](manual/nord/tutorials/tut-t24-event-sheet-platformer.html) | Tutorials | Make a small platformer with an event sheet and behaviors — coins, enemies, a turret and a win — with no scripts. |
| [T25 A top-down shooter from events](manual/nord/tutorials/tut-t25-topdown-shooter.html) | Tutorials | Open the shooter template, read how aiming, shooting, enemies and game-over are built from events, and change them. |
| [T26 Menus and two languages](manual/nord/tutorials/tut-t26-menus-languages.html) | Tutorials | Build a main menu, an options screen and a game scene that switch with events, then add a second language. |
| [T27 Build your first FPS level](manual/nord/tutorials/tut-t27-fps-level.html) | Tutorials | Rooms, a door, enemies, a key, a switch and an exit — then play it. |
| [T28 Machine Workshop — build a gravity puzzle in 2D Level](manual/nord/tutorials/tut-t28-machine-workshop.html) | Tutorials | Learn the new 2D editor by placing ramps and a ball, editing Matter bodies, testing a machine and exporting it. |
| [T29 Two Floors — edit a Shattered Pixel Dungeon adaptation](manual/nord/tutorials/tut-t29-dungeon-two-floors.html) | Tutorials | Build and change two connected dungeon floors with tile collision, turn-based combat, keys, doors, fog, potions and a relic. |
| [T30 Tiny Tank Patrol — build a top-down tank arena](manual/nord/tutorials/tut-t30-tank-patrol.html) | Tutorials | Learn 2D Level Creator through NES-style tank movement, shells, destructible cover, steel obstacles, enemy tuning and base defense. |
| [T31 Full game workshop — Coin Canyon (2D)](manual/nord/tutorials/tut-t31-full-2d-platformer.html) | Tutorials | Turn the working Platformer into your own coin-and-slime obstacle course, tune jumps, edit terrain, build a boss finale and export it. |
| [T32 Full game workshop — Sunset Gems (3D)](manual/nord/tutorials/tut-t32-full-3d-platformer.html) | Tutorials | Build a complete seven-gem jumping challenge from the 3D Platformer, with a deliberate route, moving platform, camera tuning, victory and web export. |
| [T33 Code a full 2D game — Coin Rush](manual/nord/tutorials/tut-t33-code-coin-rush.html) | Tutorials | Learn JavaScript and Nord by coding a timed platformer with combos, lives, checkpoints, boss victory, pause menus and persistent records. Includes all source. |
| [T34 Code a full 3D game — Crystal Relay](manual/nord/tutorials/tut-t34-code-crystal-relay.html) | Tutorials | Write an ordered-collection 3D time trial: sprint stamina, moving hazard, checkpoint lives, medals, pause/retry and saved records, with all source included. |
| [T35 Prism Relay — code reactive GLSL game materials](manual/nord/tutorials/tut-t35-advanced-prism-shaders.html) | Tutorials | Build a real 3D shader game from Crystal Relay: UV grids, moving scan waves, gameplay uniforms, live controls and GPU resource cleanup. Complete JavaScript and GLSL included. |
| [T36 Circuit Vault — a web game with a real Node server](manual/nord/tutorials/tut-t36-advanced-node-vault.html) | Tutorials | Code a memory-heist game and its HTTP API: fetch, async UI, server-owned rules, sessions, validation, deadlines, lives and a leaderboard. Full browser and Node source included. |
| [T37 Orbital Salvage — code Rust gameplay and export real WASM](manual/nord/tutorials/tut-t37-advanced-rust-wasm.html) | Tutorials | Build a complete Rust arcade game with dash/shield, bouncing hazards, timed cargo collection, pause/retry, pure rule tests and a verified WebAssembly export. |
| [T38 Coastline Sprint — code an Amiga racer with two-player split-screen](manual/nord/tutorials/tut-t38-coastline-sprint.html) | Tutorials | Build a complete one-course pseudo-3D racer using the supplied Amiga Lotus-style cars: keyboard solo, keyboard/gamepad split-screen, traffic, nitro, checkpoints, MP3 music and SFX. All source and assets included. |
| [T39 Vector Patrol — code a retro 3D rail shooter](manual/nord/tutorials/tut-t39-vector-patrol.html) | Tutorials | Original Blocksmith ships, combat, boss, vertex snapping, palette dithering, ground dots and local MP3 audio; full code and assets. |
| [T40 JengaTedris — grid, physics and Node battle](manual/nord/tutorials/tut-t40-jengatedris.html) | Tutorials | Complete array-based grid game, real Matter compound tower and authoritative two-browser battle, with every source file. |
| [T41 Nord Engine Office — interns, bugs and AI](manual/nord/tutorials/tut-t41-nord-office.html) | Tutorials | Build a multiplayer office game with JavaScript puzzles, wiring, coffee timing, pranks, Node authority and a pathfinding AI coworker. |
| [T42 Paper Worlds — draw in 2D, explore your ideas in 3D](manual/nord/tutorials/tut-t42-paper-worlds.html) | Tutorials | A complete local-first drawing app with ten paper boards, Phaser tools, Babylon textures, Havok sticky toys, doors, minigames and an exportable 3D portfolio. Full source and original sprites. |
| [T43 RSS River — build a calm reader with a physical paper view](manual/nord/tutorials/tut-t43-rss-river.html) | Tutorials | A complete HTML news reader with RSS/Atom import, three default subscriptions, offline cache, search/read/star state and a Babylon/Havok river of papers. Full source and original sprites. |
| [T44 Menus and HUDs with the UI Designer](manual/nord/tutorials/tut-t44-ui-designer.html) | Tutorials | Design a main menu and a HUD visually, save them as ui/*.ui.json, and connect them to your game with three lines of code. |
| [T45 One style for every button, and 9-slice images](manual/nord/tutorials/tut-t45-ui-skins-9slice.html) | Tutorials | Restyle all buttons at once with a skin file, add variants and hover states, then use 9-slice images so panels and buttons stretch like in Unity or Godot. |
| [T46 Node graph — build a coin collector with no code](manual/nord/tutorials/tut-t46-node-graph-coins.html) | Tutorials | Move a player, collect coins and show a win screen using only graphs and a UI file. Then change the rules by rewiring nodes. |
| [T47 The Unity-style workflow](manual/nord/tutorials/tut-t47-unity-workflow.html) | Tutorials | New scene, Scene-view tools, a shared material, a prefab and a variant, a GameManager singleton, then Build And Run. |
| [T48 Neon Harbor, the full Unity-style showcase](manual/nord/tutorials/tut-t48-neon-harbor.html) | Tutorials | A finished 3D night harbour with a 2D HUD and minimap. Take it apart with every Unity-style editor feature: multi-object gizmos, prefabs and variants, materials, import settings, UI Designer, event sheet, graphs and a mobile export. |
| [T49 Model and paint a crate (3D Modeler)](manual/nord/tutorials/tut-t49-3d-modeler.html) | Tutorials | Build a crate from scratch in the 3D Modeler: shape it, paint its texture (also straight on the model), fix its UVs, export a GLB and put it in a 3D scene. |
| [T50 A hero that idles, walks and jumps (Animator)](manual/nord/tutorials/tut-t50-animator.html) | Tutorials | Draw an animation state machine for a sprite with parameters and transitions, test it live, and drive it from a script. |
| [T51 Ship it with a hosting preset](manual/nord/tutorials/tut-t51-hosting-presets.html) | Tutorials | Export a web build with one flag and get the deploy files for itch.io, GitHub Pages, Netlify, Vercel or Docker. |
| [T52 Find the slow part (Profiler)](manual/nord/tutorials/tut-t52-profiler.html) | Tutorials | Use the per-phase, per-script and per-component profiler, catch a slow frame with its culprit, record a session and save the profile. |
| [T53 Two players with spawn, sync and RPC](manual/nord/tutorials/tut-t53-multiplayer.html) | Tutorials | Host and join from two browser windows, spawn one ship per player, sync movement with netSync, call a function on the other player and test with fake lag. |
| [T54 Change a model in your scene (and its texture)](manual/nord/tutorials/tut-t54-change-scene-model.html) | Tutorials | Open a model that is already in your scene in the 3D Modeler as it is, change the shape and paint on its texture, then choose whether to overwrite it, keep a new model, make a prefab or a prefab variant. |
| [T02 Sprite & movement](manual/nord/tutorials/tut-t02-sprite-movement.html) | Tutorials | **Old:** Original movement tutorial teaches native NordScript. Its code is retained for older projects; the new learning path uses Unity-style input and movement. |
| [T03 Your first script](manual/nord/tutorials/tut-t03-first-script.html) | Tutorials | **Old:** Original scripting tutorial teaches the lower-case lifecycle. Use the Unity-style first-script lesson for new work. |
| [Examples (coming from Unity)](manual/nord/examples/examples.html) | Examples | Short, copy-and-run code examples for everything a Unity developer does every day, each with the C# version next to the Nord JavaScript version, plus a complete small game. |
| [1 · Your first script](manual/nord/examples/ex-first-script.html) | Examples | A script with Awake/Start/Update, Inspector fields and logging: Unity C# next to Nord JavaScript. |
| [2 · Input and movement](manual/nord/examples/ex-input-movement.html) | Examples | Keyboard, axes and actions; move by position or by physics; 2D and 3D. |
| [3 · Finding objects and talking to scripts](manual/nord/examples/ex-find-and-talk.html) | Examples | Find, tags, GetComponent, calling methods on other scripts, parents and children. |
| [3.5 · Build a clock: objects, hierarchy, materials and your first script](manual/nord/examples/ex-clock.html) | Examples | The classic first Unity exercise in Nord Engine: build a clock from a cylinder and cubes, give it pivots and materials, then write a script that turns the arms to show the real time. Same numbers and colours as the Unity version. |
| [3.6 · Build a digital clock: primitives and 3D text in the world](manual/nord/examples/ex-digital-clock.html) | Examples | Build a digital clock from primitives, put its numbers on a world-space text object (not a screen label), and write a Unity-style script that shows the real time, a blinking colon and a 12/24 hour switch. |
| [4 · GameManager and Singletons](manual/nord/examples/ex-game-manager.html) | Examples | Keep score, lives and game state in one place; other scripts call it and listen to it. Unity's singleton GameManager, step by step. |
| [5 · Spawning, prefabs and Destroy](manual/nord/examples/ex-spawn-destroy.html) | Examples | Make prefabs, spawn them at runtime, pass data in, destroy and pool them. |
| [6 · Collisions, triggers and raycasts](manual/nord/examples/ex-collisions.html) | Examples | Pick-ups, damage zones, hit detection, overlap queries and 3D raycasts. |
| [7 · Time: coroutines, Invoke, timers and tweens](manual/nord/examples/ex-time-coroutines.html) | Examples | Wait, repeat, delay, fade and ease: Unity coroutines and Invoke next to Nord's equivalents. |
| [8 · UI: HUD, buttons and menus](manual/nord/examples/ex-ui-hud.html) | Examples | Labels, bars, buttons and screens from code, or declarative .ui.json from the UI Designer. |
| [9 · Audio](manual/nord/examples/ex-audio.html) | Examples | Sound effects, music with crossfade, volume buses and event-driven sounds. |
| [9.5 · A music player and sound effects](manual/nord/examples/ex-music-player.html) | Examples | Build a playlist player with autoplay, next/previous, stop and a volume control, then add clock sounds (a tick every second and a chime on the full hour), written Unity-style. |
| [10 · Saving and loading](manual/nord/examples/ex-save-load.html) | Examples | PlayerPrefs-style settings, high scores, save slots with JSON data. |
| [11 · Scenes and persistent objects](manual/nord/examples/ex-scenes.html) | Examples | Load scenes, restart, keep objects alive between scenes and pass data along. |
| [12 · Events and messages](manual/nord/examples/ex-events.html) | Examples | Global events, per-object events, Inspector signals, UnityEvent and EventBus: who should call whom. |
| [13 · Enemy AI and state machines](manual/nord/examples/ex-ai-states.html) | Examples | Patrol, chase, attack with a simple state machine, plus the ready-made AI scripts. |
| [14 · Data assets (ScriptableObject)](manual/nord/examples/ex-data-assets.html) | Examples | Keep items, enemy stats and levels as JSON files that scripts load: the Nord version of ScriptableObjects. |
| [15 · Camera, 3D and effects](manual/nord/examples/ex-camera-3d.html) | Examples | Follow cameras, screen shake and flashes, a 3D scene with a model, lights and a third-person character. |
| [16 · Debugging and the Dev Console](manual/nord/examples/ex-debug-tools.html) | Examples | Logging with tags, the Console, errors, hot reload, the profiler and the in-game console for cheats. |
| [17 · Coin Dash: a whole small game](manual/nord/examples/ex-coin-dash.html) | Examples | Every script of a complete game (player, coins, enemies, spawner, GameManager, HUD, game over) explained, the Unity way. |
| [19 · A platformer: Jump Dash](manual/nord/examples/ex-platformer.html) | Examples | Jumping that feels good (coyote time, jump buffer, variable height), hazards, pits, a follow camera and a goal. Complete project examples/jump-dash. |
| [20 · A shooter: Star Shooter](manual/nord/examples/ex-shooter.html) | Examples | Aim with the mouse, shoot pooled bullets, waves of enemies, particles on death and a health bar. Complete project examples/star-shooter. |
| [21 · Health, damage and death](manual/nord/examples/ex-health-damage.html) | Examples | A reusable Health script, damage by events, invulnerability frames, knockback, health bars and death handling. |
| [22 · Animation: sprites and the Animator](manual/nord/examples/ex-animation.html) | Examples | Play sprite-sheet animations from code, flip by direction, drive an Animator state machine with parameters, frame events, and 3D clips. |
| [23 · Tilemaps and level design](manual/nord/examples/ex-tilemap-levels.html) | Examples | Paint a level with tiles, make tiles solid, add objects to the level, and load several levels. |
| [24 · Inventory, items and quests](manual/nord/examples/ex-inventory-quests.html) | Examples | Item data in JSON, a stacking inventory, a grid UI, equipment and a quest log driven by events. |
| [25 · Talking to NPCs: interaction and dialogue](manual/nord/examples/ex-dialogue-npc.html) | Examples | Press E near a character, branching dialogue from a JSON file with typewriter text and choices, and reacting to the answers. |
| [26 · Juice: particles, shake, hit-stop and floating text](manual/nord/examples/ex-juice-effects.html) | Examples | Make hits feel good with particle bursts, screen shake, flashes, hit-stop, squash and stretch, and numbers that float up. |
| [27 · Touch, mobile and responsive games](manual/nord/examples/ex-mobile-touch.html) | Examples | Virtual joystick and buttons, tap and swipe, screen scaling and orientation, and shipping a web app that installs on a phone. |
| [28 · Multiplayer basics](manual/nord/examples/ex-multiplayer.html) | Examples | Host and join from two windows, spawn one ship per player, move your own, and send a message to everyone. |
| [30 · C# to JavaScript: the language side by side](manual/nord/examples/ex-language.html) | Examples | Classes, inheritance, interfaces, properties, enums, generics, LINQ, events, async and null handling: the C# you know and the JavaScript that replaces it. |
| [31 · Physics recipes](manual/nord/examples/ex-physics-recipes.html) | Examples | Gravity, forces and impulses, bounce and friction, moving platforms, one-way platforms, ladders, knockback, explosions, pushing crates, raycasts. |
| [32 · Clicking, hovering and dragging objects](manual/nord/examples/ex-picking-dragging.html) | Examples | Select things with the mouse or a finger, hover highlights, drag and drop, drag-select boxes, and telling clicks on the UI from clicks on the world. |
| [33 · Options menu: volume, language, fullscreen, key rebinding](manual/nord/examples/ex-settings-menu.html) | Examples | A settings screen that remembers its values, switches language, sets volumes, toggles fullscreen and lets the player rebind keys. |
| [34 · 3D: controllers, cameras, vehicles and interaction](manual/nord/examples/ex-3d-controllers.html) | Examples | First-person, third-person, platformer and vehicle controllers from the library, click-to-move, interaction rays, lights and materials. |
| [35 · Structuring a bigger game: patterns you know from Unity](manual/nord/examples/ex-architecture.html) | Examples | Event channels, singletons and services, state machines, command/undo, data-driven design, folders and naming, so a project stays tidy as it grows. |
| [36 · Unity packages and features: what to use in Nord](manual/nord/examples/ex-unity-packages.html) | Examples | Cinemachine, TextMeshPro, Input System, DOTween, NavMesh, Timeline, Addressables, Shader Graph, Localization, Netcode and more, mapped to Nord. |
| [37 · Starting points by game type](manual/nord/examples/ex-genres.html) | Examples | Which template, example project and library scripts to start from for platformers, shooters, RPGs, puzzles, racing, tower defense, card games and more. |
| [38 · Build, publish and ship](manual/nord/examples/ex-build-publish.html) | Examples | Run, build for the web, single-file and PWA, itch.io / GitHub Pages / Netlify, Mac / Windows / Linux apps, and the checks before you ship. |
| [39 · Optimising and testing your game](manual/nord/examples/ex-optimization-testing.html) | Examples | Find slow scripts with the profiler, pool objects, cache lookups, keep assets small, and test logic and gameplay automatically. |
| [40 · Procedural content and randomness](manual/nord/examples/ex-procedural.html) | Examples | Seeded random numbers, random levels and dungeons, loot tables, noise, weighted choice, and shuffling. |
| [41 · Convert a Unity project or tutorial (for you and for AI)](manual/nord/examples/ex-unity-conversion.html) | Examples | A step-by-step playbook, mapping tables and prompts to turn any Unity tutorial or whole C# codebase into a Nord project. Written so an AI agent can follow it. |
| [42 · Unity helpers cookbook](manual/nord/examples/ex-unity-helpers.html) | Examples | Random, Color, KeyCode, mouse events, free Instantiate/Destroy, field helpers and SmoothDamp: the Unity habits that now work as-is. |
| [43 · Input actions and the Input editor](manual/nord/examples/ex-input-editor.html) | Examples | Edit your project's input map in the Project tab: bind keys by pressing them, add actions, restore the basics. |
| [44 · Vector Rocks: Asteroids on a green vector monitor](manual/nord/examples/ex-vector-rocks.html) | Examples | A whole game in Unity-style code: Asteroids with glowing phosphor lines, a monitor bezel, waves, a heartbeat that speeds up, and five power-ups. About 370 lines of MonoBehaviours, prefabs, coroutines and triggers. |
| [45 · Which platform? Editor, Mac, Windows, web, phone](manual/nord/examples/ex-platform.html) | Examples | Application.platform, isEditor, os and Cursor: do different things in the editor, on the web, in the desktop app or on a phone. |
| [46 · Pathfinding and NavMesh: moving around obstacles](manual/nord/examples/ex-pathfinding.html) | Examples | Unity's NavMeshAgent mapped to Nord: grid A* (findPath), waypoint paths and simple steering, with a runnable agent script. |
| [47 · Cutscenes and the Timeline (Unity Timeline / PlayableDirector)](manual/nord/examples/ex-cutscenes.html) | Examples | Keyframe an intro, a camera move or a door opening in the Timeline tab, play it from a script and wait for it to finish. |
| [48 · 2D lights and shadows (URP 2D Lights)](manual/nord/examples/ex-lights-2d.html) | Examples | Dark scenes with torches, flashlights and real shadows in 2D, three library scripts, plus asking "how lit is this spot?" for stealth. |
| [49 · Dungeon 1: A hero that moves](manual/nord/examples/ex-dungeon-1-hero.html) | Examples | Series part 1 of 6, Unity style. Create a project, put a hero on screen, move it with Input.GetAxis and Time.deltaTime, keep it on the screen with Mathf.Clamp. |
| [50 · Dungeon 2: Walls](manual/nord/examples/ex-dungeon-2-walls.html) | Examples | Series part 2 of 6, Unity style. Build a level from a text map with Instantiate and prefabs, give the hero a Rigidbody2D and BoxCollider2D, and move it by velocity. |
| [51 · Dungeon 3: Camera and a bigger level](manual/nord/examples/ex-dungeon-3-camera.html) | Examples | Series part 3 of 6, Unity style. A follow camera in LateUpdate with Mathf.Lerp and bounds, frame-rate independent smoothing, EventBus, and merging wall tiles into long strips. |
| [52 · Dungeon 4: Coins and score](manual/nord/examples/ex-dungeon-4-coins.html) | Examples | Series part 4 of 6, Unity style. Trigger colliders and OnTriggerEnter, a coin prefab, the built-in GameManager singleton, a HUD and restarting. |
| [53 · Dungeon 5: Enemies and health](manual/nord/examples/ex-dungeon-5-enemies.html) | Examples | Series part 5 of 6, Unity style. Wandering and chasing enemies with a coroutine, a Health component with a grace period, knockback, hearts from GameManager lives, and game over. |
| [54 · Dungeon 6: Light and shipping](manual/nord/examples/ex-dungeon-6-light.html) | Examples | Series part 6 of 6, Unity style. A dark dungeon lit by a lantern with real shadows (three library scripts, like URP 2D Lights), light queries for gameplay, and a build for the web. |
| [55 · Ember Crypt: a complete game, from art to export](manual/nord/examples/ex-ember-crypt.html) | Examples | Build a finished dark-dungeon game in Unity-style code with pixel art, an animated hero with a sword, slimes and bats with line of sight, keys and gates, real shadows, particles, sound, a title screen, pause, saved high score and a web export. |
| [56 · Shadertoy: use any shader from shadertoy.com](manual/nord/examples/ex-shadertoy.html) | Examples | Paste a Shadertoy shader and it runs inside your game: as a picture in the scene, a full-screen background, on a 3D plane or mesh, or as a post effect over the whole game. Textures, Buffer A-D, keyboard, audio, mouse and screen inputs included. |
| [57 · Unity API in Nord: the map](manual/nord/examples/ex-unity-api.html) | Examples | Every Unity command that works in Nord, in Unity's own groups, with links to the pages that explain them. Plus the honest list of what is not built yet. |
| [58 · Unity API: scripting and objects](manual/nord/examples/ex-unity-api-scripting.html) | Examples | MonoBehaviour events including OnBecameVisible and OnApplicationFocus, SetParent at run time, RequireComponent, Awaitable, PlayerPrefs, and the scene-tree commands. |
| [59 · Unity API: math types](manual/nord/examples/ex-unity-api-math.html) | Examples | Vector4, Matrix4x4, Bounds, Rect, RectInt, Ray, Ray2D, Plane, Color32, Vector2Int and Vector3Int, Random.ColorHSV, AnimationCurve and Gradient, with the Unity names and results. |
| [60 · Unity API: input](manual/nord/examples/ex-unity-api-input.html) | Examples | The classic Input class (axes, mouse, touches, sensors, location) and the New Input System (InputAction, .inputactions files, PlayerInput, Keyboard.current) in Unity names. |
| [61 · Unity API: Physics 2D](manual/nord/examples/ex-unity-api-physics2d.html) | Examples | Rigidbody2D constraints and interpolation, capsule, polygon, edge and composite colliders, every Physics2D cast and overlap, IgnoreCollision, and the nine 2D joints. |
| [62 · Unity API: Physics 3D, joints and the camera](manual/nord/examples/ex-unity-api-physics3d.html) | Examples | Physics.Raycast/SphereCast/BoxCast/CapsuleCast and their All and NonAlloc forms, Overlap and Check calls, IgnoreCollision, Rigidbody constraints, the five 3D joints and Camera.WorldToScreenPoint / ScreenPointToRay. |
| [63 · Unity API: LineRenderer, TrailRenderer, SpriteMask and SpriteShape](manual/nord/examples/ex-unity-api-rendering.html) | Examples | Lasers, ropes, trails, windows that reveal sprites and hand-drawn terrain with the Unity classes LineRenderer, TrailRenderer, SpriteMask and SpriteShapeController, in 2D and 3D. |
| [64 · Physics Lab: a bench for the Unity physics layer](manual/nord/examples/ex-physics-lab.html) | Examples | Open the Physics Lab and the Shadertoy Lab projects, run their self-tests in the browser, and see what each check proves. Also how the play-mode editing of the Unity-style editor works. |
| [18 · Migration guide: C# habits to JavaScript](manual/nord/examples/ex-migration.html) | Examples | **Old:** Earlier C# migration overview overlaps the fuller language and conversion guides. |
| [29 · The editor for Unity users](manual/nord/examples/ex-editor-for-unity-users.html) | Examples | **Old:** Earlier editor translation overview overlaps the maintained Unity-style workflow chapter and tutorial. |
| [Cheatsheets — find an answer](manual/nord/guides/cookbook.html) | Cheatsheets | Quick lookup tables for scripting, editor tasks, debugging and publishing. |
| [Mobile and on-screen touch controls](manual/nord/guides/mobile-controls.html) | Cheatsheets | Code-drawn joystick and hold buttons for any Nord 2D/3D game, with desktop pointer testing. |
| [Unity scripting cheatsheet](manual/nord/guides/cheat-sheet-unity.html) | Cheatsheets | Copy a minimal MonoBehaviour, then look up lifecycle, movement, input, objects and saving. |
| [Cheat sheet — export](manual/nord/guides/cheat-sheet-export.html) | Cheatsheets | Build, bundle and host commands on one page. |
| [UI scenes reference](manual/nord/guides/ui-scenes.html) | Cheatsheets | The .ui.json format, text, images and 9-slice, skins, and the script API. |
| [Cheat sheet — command line](manual/nord/guides/cheat-sheet-cli.html) | Cheatsheets | How to start the nord command on macOS, Windows and Linux, and every command with its common options. |
| [Glossary](manual/nord/guides/glossary.html) | Cheatsheets | Plain-language meanings of the words used in this manual. |
| [Node graph reference](manual/nord/guides/graph-reference.html) | Cheatsheets | Pins, events, flow, the full node list, the runner and the component. |
| [Keyboard shortcuts](manual/nord/guides/shortcuts.html) | Cheatsheets | Editor shortcuts (macOS). |
| [FPS Level — quick reference](manual/nord/guides/cheat-sheet-fps-level.html) | Cheatsheets | Build, select, patrol, test, stop, customise shortcuts, save and export first-person levels. |
| [Native NordScript cheatsheet](manual/nord/guides/cheat-sheet-nordjs.html) | Cheatsheets | **Old:** Native lower-case scripting reminder, useful when maintaining older tutorials and projects. |
| [Native service recipes (old)](manual/nord/guides/native-cookbook.html) | Cheatsheets | **Old:** Original service recipes use native scene and scheduler calls. Retained for maintenance; start with current Unity-style examples. |
| [API reference](manual/nord/api/api.html) | API | Nord's complete public scripting surface, components, desktop bridge and engine references. |
| [game.* namespaces](manual/nord/api/api-namespaces.html) | API | game.camera, game.physics, game.gui, game.ui, game.audio… |
| [Entity](manual/nord/api/api-entity.html) | API | A node in the scene tree. |
| [Scene](manual/nord/api/api-scene.html) | API | The running scene: entities, lifecycle, prefabs. |
| [Unity-style scripting API](manual/nord/api/api-unity.html) | API | Scripting reference for the Unity-style layer (MonoBehaviour, Transform, Vector3, Quaternion, Time, Input, Physics2D, components…) in the format of the Unity Scripting API, with the differences from C#. |
| [Game](manual/nord/api/api-game.html) | API | Owns the scene and shared services (this.game). |
| [MCP tools reference](manual/nord/api/api-mcp-tools.html) | API | Every tool of the Nord MCP servers (project, scenes, Unity conversion, 3D Modeler, 2D Sprite editor), one table per group. |
| [Input](manual/nord/api/api-input.html) | API | Action-based input (this.input). |
| [Events](manual/nord/api/api-events.html) | API | Event emitter (this.events, entity.on). |
| [Save](manual/nord/api/api-save.html) | API | Versioned save slots (this.save). |
| [Audio](manual/nord/api/api-audio.html) | API | Buses, sfx, music (this.audio). |
| [UI](manual/nord/api/api-ui.html) | API | DOM HUD/menu layer (this.ui). |
| [Scheduler](manual/nord/api/api-scheduler.html) | API | Timers and tweens (this.after/every/tween). |
| [Rng](manual/nord/api/api-rng.html) | API | Seedable random numbers (this.rng). |
| [Pool](manual/nord/api/api-pool.html) | API | Reuse objects instead of allocating a new one each time. |
| [Loader](manual/nord/api/api-loader.html) | API | Load project files safely, with caching and progress reporting. |
| [MemoryStorage](manual/nord/api/api-memorystorage.html) | API | In-memory storage for Save when browser storage is unavailable or for isolated runs. |
| [ArcadeAdapter](manual/nord/api/api-arcadeadapter.html) | API | 2D physics (Arcade) — this.physics in 2D games. |
| [MatterAdapter](manual/nord/api/api-matteradapter.html) | API | 2D physics (Matter) — this.physics when physics.engine is matter. |
| [HavokAdapter](manual/nord/api/api-havokadapter.html) | API | 3D physics (Havok) — this.physics in 3D games. |
| [Math & helpers](manual/nord/api/api-helpers.html) | API | clamp, lerp, remap, vec, ease… |
| [All Nord public exports](manual/nord/api/api-exports.html) | API | NordScript, resolveAttributes, Entity, registerComponent, components, Scene, applyOverrides, FIXED_DT, Game, I18n, Accessibility, COLORBLIND, colorMatrixValues, Multiplayer, registerNetSync, loadAddons, Timelines, bezier, sample, Effects, EFFECT_TYPES, registerEffect, Debugger, attachDebugOverlay, Events, Input, attachDom, virtualJoystick, Save, MemoryStorage, Rng, Scheduler, Pool, ease, clamp, lerp, remap, deg2rad, rad2deg, angleDiff, vec, Loader, safePath, Audio, BUSES, touchToStart, UI, THEME_CSS, UIManager, createUI, validate as validateUI, blank as blankUI, richText, NODE_TYPES, AnimatorController, validateController as validateAnimator, Graph, graphSystem, attachGraph, NODES as GRAPH_NODES, validate as validateGraph, createGame, makeStage, errorOverlay, devSceneOverride, registerCoreComponents, SKINS, THEMES, FONTS, skin, theme, fontFaceCSS, themeVars, applyTheme, CODE_CSS, EventSheet, registerPlugin, registerObjectAces, registerDataType, dataTypes, compile as compileExpression, Behavior, registerBehavior, behaviors, Shadertoy, createShadertoy, splitTabs, Awaitable |
| [Desktop bridge](manual/nord/api/api-desktop.html) | API | window.nord.desktop: fs dialog app store secret clipboard notify window menu tray shortcut shell process server http |
| [Rust public API](manual/nord/api/api-rust.html) | API | Script Ctx World Registry Input assets physics App desktop Rust declarations |
| [NordScript](manual/nord/api/api-nordscript.html) | API | **Old:** Source-generated native base-class reference. The class remains supported; new scripts normally extend MonoBehaviour. |
| [sprite](manual/nord/components/component-sprite.html) | API | A single image (or one frame of a spritesheet) drawn at the entity position. |
| [animatedSprite](manual/nord/components/component-animatedSprite.html) | API | A spritesheet with named animations. Animations are declared in the texture's `.meta.json` (`anims`). |
| [text](manual/nord/components/component-text.html) | API | World-space text (Phaser Text). For HUD text prefer `uiLabel`. |
| [tilemap](manual/nord/components/component-tilemap.html) | API | A grid of tiles from a tileset image. Loads Tiled JSON (`.tmj`/`.json`) or Nord simple maps (`layers[].data`). |
| [parallax](manual/nord/components/component-parallax.html) | API | A screen-filling background layer that scrolls slower than the camera for depth. |
| [particles](manual/nord/components/component-particles.html) | API | Particle emitter. 2D (Phaser emitter) and 3D (Babylon ParticleSystem) use the same component with tier-specific fields. |
| [camera](manual/nord/components/component-camera.html) | API | 2D: configures the main camera (zoom, follow, bounds). 3D: creates a free (first-person) or orbit camera. |
| [light](manual/nord/components/component-light.html) | API | 2D: Phaser point light (turns on the light pipeline for all sprites). 3D: point / directional / spot / hemispheric light, optional shadows. |
| [mesh](manual/nord/components/component-mesh.html) | API | A primitive 3D shape (box, sphere, cylinder, capsule, torus, plane, ground). |
| [model](manual/nord/components/component-model.html) | API | A glTF/GLB model instanced into the scene, with its animations. |
| [material](manual/nord/components/component-material.html) | API | PBR (or unlit) material applied to the meshes of this entity. |
| [skybox](manual/nord/components/component-skybox.html) | API | Cube-map sky. `path` is a folder containing px/nx/py/ny/pz/nz.png (e.g. `assets/skybox/day`). |
| [postProcess](manual/nord/components/component-postProcess.html) | API | Full-screen effects on the active camera: bloom, FXAA/MSAA, vignette, tone mapping, grain, sharpen, chromatic aberration. |
| [rigidbody](manual/nord/components/component-rigidbody.html) | API | Makes the entity a physics body. Add a `collider` for its shape. |
| [collider](manual/nord/components/component-collider.html) | API | Collision shape. Without an explicit `size` it is taken from the sprite/mesh bounds. |
| [joint](manual/nord/components/component-joint.html) | API | A Unity-style joint between this body and `connectedBody` (or the world): hinge, spring, distance, fixed, slider, wheel, target, relative, friction (2D, Matter) and hinge, fixed, spring, distance, ball (CharacterJoint), configurable (3D, Havok). |
| [trigger](manual/nord/components/component-trigger.html) | API | Shorthand for a collider with `trigger: true` — an invisible zone that fires `onTriggerEnter` / `onTriggerExit`. |
| [lineRenderer](manual/nord/components/component-lineRenderer.html) | API | A poly-line drawn as a ribbon with a width and a colour gradient (Unity's LineRenderer). |
| [trailRenderer](manual/nord/components/component-trailRenderer.html) | API | Leaves a fading trail behind a moving entity (Unity's TrailRenderer). |
| [spriteMask](manual/nord/components/component-spriteMask.html) | API | Shows or hides sprites inside its shape (Unity's SpriteMask). |
| [spriteShape](manual/nord/components/component-spriteShape.html) | API | A filled shape with an edge line from a list of points (Unity's SpriteShape: hills, platforms, pools). |
| [shadertoy](manual/nord/components/component-shadertoy.html) | API | Runs a shader written for shadertoy.com (GLSL ES 3.00 `mainImage`) as a picture in the scene or on a mesh. |
| [audioSource](manual/nord/components/component-audioSource.html) | API | Plays a clip from an entity. Use `bus` to route it (sfx / music / ui). |
| [audioListener](manual/nord/components/component-audioListener.html) | API | Marker for the entity that "hears" the game. Currently a no-op placeholder (audio is not spatialised yet). |
| [uiPanel](manual/nord/components/component-uiPanel.html) | API | A background box in the DOM UI layer. |
| [uiLabel](manual/nord/components/component-uiLabel.html) | API | Text in the DOM UI layer. |
| [uiImage](manual/nord/components/component-uiImage.html) | API | An image in the DOM UI layer. |
| [uiBar](manual/nord/components/component-uiBar.html) | API | A progress bar (0..1). |
| [uiButton](manual/nord/components/component-uiButton.html) | API | A clickable button. Emits `click` on the entity, calls `onClick()` on its scripts and, if `event` is set, `game.events.emit(event)`. |
| [path](manual/nord/components/component-path.html) | API | A list of waypoints that can be sampled by distance — for patrols, moving platforms, camera rails. |
| [spawner](manual/nord/components/component-spawner.html) | API | Spawns a prefab every `interval` seconds at the entity (plus `offset` and random `jitter`), keeping at most `max` alive. |
| [graph](manual/nord/components/component-graph.html) | API | Runs a visual-scripting graph file (`graphs/*.graph.json`) on this entity. *This entity* in the graph is the owner. Built in the Graph tab. |
| [animator](manual/nord/components/component-animator.html) | API | Unity-style state machine (`anim/*.animator.json`) that switches the clip of the `animatedSprite` (or the glTF animation of the `model`) on the same entity from parameters (float, int, bool, trigger). Built in the Animator tab; see the Animator chapter. |
| [netSync](manual/nord/components/component-netSync.html) | API | Multiplayer: the owning peer sends this entity's position (and optionally rotation, scale and chosen `vars`) to everyone else, who see it move smoothly. Owner = the player given to `net.spawn`, otherwise the host. Needs `game.net` connected; see the Multiplayer chapter. |
| [Project format](manual/nord/reference/project-format.html) | API | nord.project.json, scenes, prefabs, components, attribute types. |
| [Event sheet reference](manual/nord/reference/event-reference.html) | API | All conditions, actions, expressions and behaviors available to event sheets. |
| [Component index](manual/nord/reference/components.html) | API | All built-in components. |
| [Command line (nord)](manual/nord/reference/cli.html) | API | nord new/serve/build/check/bundle-mac… |
| [Library catalog](manual/nord/reference/library-catalog.html) | API | Every library script, prefab and kit. |
| [Templates & examples](manual/nord/reference/templates-examples.html) | API | Starter templates and example games. |
| [Rust tier spec](manual/nord/reference/rust-tier-spec.html) | API | Detailed Rust/WASM reference. |
| [Export targets spec](manual/nord/reference/export-targets-spec.html) | API | Export targets and layout. |
| [Hosting notes](manual/nord/reference/hosting-spec.html) | API | Where to host a build. |
| [Desktop apps spec](manual/nord/reference/desktop-apps-spec.html) | API | Desktop backend design, capability model, bridge. |
| [Packaging](manual/nord/reference/packaging.html) | API | macOS/Windows/Linux bundles, signing, notarisation, file types. |
| [Phaser and Babylon API downloads](manual/nord/reference/engine-docs.html) | API | Reference |
| [Upstream API downloads](manual/nord/reference/phaser-api-index.html) | API | **Old:** Superseded upstream index alias. Exact-version APIs are available as ZIP downloads from one maintained landing page. |
| [Upstream API downloads](manual/nord/reference/babylon-api-index.html) | API | **Old:** Superseded upstream index alias. Exact-version APIs are available as ZIP downloads from one maintained landing page. |
| [Upstream API downloads](manual/nord/reference/phaser-archive.html) | API | **Old:** Earlier Phaser 4.1 snapshot index does not match Nord's bundled Phaser 4.2.1. |
| [Upstream API downloads](manual/nord/reference/babylon-guides.html) | API | **Old:** Retained old guide-index alias. Use the current upstream download and official-link page. |
| [Upstream API downloads](manual/nord/reference/babylon-guide-index.html) | API | **Old:** Retained old guide-index alias. Use the current upstream download and official-link page. |
| [Appendix](manual/nord/appendix/appendix.html) | Cheatsheets | Versions, licences, troubleshooting, FAQ. |
| [Design decisions](manual/nord/appendix/decisions.html) | Cheatsheets | Architecture decision records. |
| [Known issues](manual/nord/appendix/known-issues.html) | Cheatsheets | Open bugs and unverified risks. |
| [Changelog](manual/nord/appendix/changelog.html) | Cheatsheets | What changed. |

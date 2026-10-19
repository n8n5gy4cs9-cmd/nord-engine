# Library plan — ready-made scripts, systems, assets, examples

Goal: user never starts from scratch. Every item: file(s) in `library/<category>/`, entry in `library/INDEX.json`,
attribute schema, header comment, a demo scene (batch demos in `examples/library-demos/`), listed in the manual.
Tiers: **2d**, **3d**, **any**, **rust**. "Simple" = <80 lines, "Game-ready" = complete system with attributes, events, juice.

## A. Controllers
2D: platformer (coyote time, jump buffer, variable jump, wall-slide/jump, dash) · top-down 4/8-dir · twin-stick shooter ·
click-to-move · tank · top-down car · side-scroll auto-runner · flappy · grid/tile mover (roguelike) · swim/fly · ladder climb · mouse-follow aim.
3D: FPS (headbob, sprint, crouch, jump) · third-person (orbit cam, strafe) · fly cam · orbit cam · RTS cam (pan/zoom/edge) ·
raycast vehicle · 3D platformer · click-to-move (nav) · first-person with interaction ray · spaceship 6DOF · marble/ball roll.
Camera: follow w/ lerp+deadzone · look-ahead · shake · zoom · bounds · cinematic path · split-screen (opt).

## B. Physics helpers
Spawn/pool bodies · drag/throw · pickup/carry · one-way platforms · moving platforms · conveyor · bounce pad · trigger zones ·
buoyancy/water · magnet/gravity wells · explosion force · rope/chain · hinge door · destructible crate · ragdoll-lite ·
projectile (ballistic, homing) · raycast helpers · hit-scan weapon · knockback.

## C. Gameplay systems (game-ready)
Health/damage/invulnerability · inventory (grid + stack + equip) · dialogue (branching JSON) · quest tracker · save/load slots ·
score/combo/highscore · timers/cooldowns · wave spawner · enemy AI: patrol, chase, shooter, flocking, boss phases ·
state machine · behaviour tree lite · A* pathfinding (grid) · waypoint paths · pickups/coins/powerups · checkpoints/respawn ·
doors/keys/switches/levers · day-night cycle · weather · destructible tiles · crafting · shop · XP/levels/skills · status effects ·
loot tables · procedural dungeon (BSP/cellular) · wave function lite · tilemap autotile · fog of war · minimap · turn-based grid combat · card hand · match-3 core · tower-defense core.

## D. UI (DOM/CSS + Babylon GUI + egui)
HUD (hearts, health/mana bars, score, timer, minimap frame) · main menu · pause · settings (volume/keys/fullscreen) · game over/win ·
dialogue box (typewriter) · inventory grid · tooltips · toasts/notifications · virtual joystick + touch buttons · loading screen ·
level select · leaderboard (local) · credits scroller · floating damage numbers · health bars over entities · modal/confirm · tabs/scroll lists · input rebind screen · cutscene letterbox.

## E. Utilities
Tween/easing · object pool · event bus · seeded RNG · simplex/perlin noise · grid utils · rect/circle/segment math · bezier ·
localisation (JSON) · gamepad mapper · pause-on-blur · fullscreen · FPS/debug overlay · screenshot · recorder (webm) ·
procedural sfx (jsfxr-style) · stats/telemetry (local) · cheat console · asset preloader with progress · cookie-free analytics none.

## F. FX
Particles presets (fire, smoke, sparks, explosion, rain, snow, magic, hit, dust, coin burst, confetti) · screen shake · flash ·
hit-stop · slow-mo · trail · outline/glow shader · dissolve · water shader · CRT/vhs · bloom/vignette/colour-grade (Babylon pipeline) · pixelate · parallax layers.

## G. Shaders (GLSL for Phaser pipelines / Babylon ShaderMaterial / WGSL for macroquad N/A)
Toon, hologram, dissolve, water, triplanar terrain, fresnel rim, scrolling UV, wind sway, outline pass, CRT.

## H. App kits (non-game)
Todo · notes/markdown · kanban · dashboard w/ charts (vendored tiny chart lib) · calculator · paint · audio player/visualiser ·
JSON/CSV viewer · form wizard · tile-map editor · image gallery · timer/pomodoro · file-less db (IndexedDB wrapper) · router/state mini-framework.

## I. Rust/WASM (`crates/nord-runtime-wasm/examples`, library/rust)
Platformer controller · top-down shooter · rapier physics toys · particle system · tilemap loader · UI (egui-macroquad) ·
asteroids · egui tool app (JSON editor) · egui dashboard · wasm audio synth.

## J. Templates (New Project)
Blank 2D · Blank 3D · Platformer · Top-down adventure · Shooter · Puzzle (match-3) · Tower defense · Endless runner · FPS arena ·
3D platformer · Racing · Card game · Visual novel · Idle/clicker · UI app · Rust 2D game · Rust egui app.

## K. Example projects (complete, in `examples/`, each with README)
Games 2D: Pong · Breakout · Snake · Flappy · Space shooter · Platformer (tilemap, enemies, coins, checkpoints, boss) · Top-down adventure (dialogue, inventory) ·
Tower defense · Match-3 · Endless runner · 2048 · Memory · Tetris-like · Idle clicker.
Games 3D: FPS arena · 3D platformer collectathon · Racing time-trial · Marble roll · Physics sandbox · Model viewer / showroom.
Apps: Todo · Kanban · Markdown notes · Dashboard · Paint · Audio visualiser.
Rust: Asteroids (macroquad) · Physics toys (rapier) · egui JSON tool.
Milestone for M6: ≥ 12 games + ≥ 6 apps + 3 Rust samples.

## L. Asset packs (generated placeholders first; CC0 swaps later)
Textures (tileable PBR-ish), sprites (characters, enemies, items, tiles, UI, FX), skyboxes, particle sprites, fonts (OFL), sfx (≥ 40), music (≥ 6 loops), 3D primitives & simple glb props, icons.
Catalogue lives in `ASSETS.md`.

## Authoring rules
- Original code or properly attributed ports. Commented, attribute-driven, no globals, no per-frame allocation in hot paths.
- Each script has `/** @nord {id, title, tier, category, tags, requires} */` header → `tools/build-library-index.mjs` generates INDEX.json.


## Midnight Sun Tour remake (M6-44/45)
The authoritative game stays in `tools/examples/midnight-sun-tour/`. Preserve the owner title. All other
art is documented in that game's `ASSETS.md`. Roadside activities and gigs feed the journey; Ruisrock
is a separate three-day manager with artist booking/recordings, staff, tickets, persistent facilities,
weather/capacity, and a representative walking customer simulation. Customer purchases earn stall income;
queues affect happiness. Live construction keeps the crowd and artist schedule running. The private console
uses a fixed command dispatcher, no eval, with its reference in the shipped game-root `commands.txt`.

M6-46 replaces all remaining legacy activity views with the native-pixel `retro.js` art contract.
Moose/petrol use actual raster objects; the circuit rotates its vehicles; gigs animate instruments;
space games use real sprites and the obsolete flattened 3D shim is removed. The band has title-inspired
portraits and performance/walking poses. Exact prompts and packing contracts ship in `RETRO_ART.md`.

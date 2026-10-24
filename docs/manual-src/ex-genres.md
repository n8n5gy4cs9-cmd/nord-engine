---
title: 37 · Starting points by game type
section: Examples
order: 37
summary: Which template, example project and library scripts to start from for platformers, shooters, RPGs, puzzles, racing, tower defense, card games and more.
---

Start from a template whenever the game resembles one (`nord new my-game -t <template>`, or the hub's *New project*). Templates are complete, small, readable games.

| You are making | Template (`-t`) | Example project / tutorial | Library scripts worth reading |
|---|---|---|---|
| 2D platformer | `platformer`, `es-platformer`, `level2d-platform` | [Jump Dash](ex-platformer.html), `examples/platformer`, T04 | `platformer2d.js`, `camera-follow.js`, `checkpoint.js`, `health.js`, `pickup.js`, `ladder.js`, `physics-one-way.js` |
| Top-down shooter | `shooter`, `es-topdown-shooter` | [Star Shooter](ex-shooter.html) | `twin-stick.js`, `mouse-aim.js`, `wave-spawner.js`, `physics-projectile.js`, `ai-chase.js` |
| Top-down adventure / RPG | `topdown-adventure`, `level2d-topdown`, `dungeon-two-floors` | `examples/dungeon-two-floors` | `topdown.js`, `dialogue.js`, `inventory.js`, `quests.js`, `loot-table.js`, `xp-levels.js`, `key-door.js` |
| Runner / endless | `runner`, `endless-runner`, `es-endless-runner` | [Coin Dash](ex-coin-dash.html), `examples/flappy` | `runner.js`, `flappy.js`, `ui-gameover.js`, `score.js` |
| Puzzle (grid, match-3) | `puzzle-grid`, `puzzle-match3`, `es-lights-out` | `examples/match3`, `memory`, `2048` | `grid-mover.js`, `util-grid.js` |
| Card / board game | `card-game` | `templates/card-game` | `physics-drag.js`, [dragging](ex-picking-dragging.html) |
| Tower defense | `tower-defense` | | `wave-spawner.js`, `ai-waypoints.js`, `ai-shooter.js` |
| Racing | `racing` | `examples/automies` (3D driving) | `car2d.js`, `vehicle3d.js` |
| Idle / clicker | `idle-clicker` | | `timers.js`, `save-slots.js` |
| Visual novel | `visual-novel` | | `dialogue.js`, `ui-main-menu.js` |
| 3D platformer | `platformer-3d` | T10 / T47 | `platformer3d.js`, `third-person3d.js` |
| First person | `fps-arena`, `fps-creator` | `examples/fps-arena` | `fps3d.js`, `physics-hitscan.js`, the FPS Level editor |
| Tanks / vehicles | `tank-patrol` | | `tank.js`, `ai-patrol.js` |
| Space shooter 6DOF | – | | `spaceship6dof.js` |
| Sandbox / physics toys | – | `examples/marble`, `jengatedris` | `physics-*.js` |
| Desktop tools / apps | `ui-app`, `desktop-*` | `examples/app-*` | [Desktop apps](desktop-apps.html) |
| Multiplayer | `es-multiplayer` | [Multiplayer basics](ex-multiplayer.html) | `game.net` |
| Rust games | `rust-2d-game`, `rust-bevy-game` | | [Rust / WASM](rust-wasm.html) |

## A path through the docs for a first game
1. [First script](ex-first-script.html), [Input](ex-input-movement.html), [Finding objects](ex-find-and-talk.html).
2. Pick the template above, run it, and change one thing at a time (speed, colours, a new enemy).
3. Add systems as you need them: [GameManager](ex-game-manager.html), [health](ex-health-damage.html), [spawning](ex-spawn-destroy.html), [UI](ex-ui-hud.html), [audio](ex-audio.html), [saving](ex-save-load.html).
4. [Polish](ex-juice-effects.html), [options](ex-settings-menu.html), [publish](ex-build-publish.html).

Every library script is listed with its attributes in the [Library catalog](library-catalog.html).

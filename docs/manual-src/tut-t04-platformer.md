---
title: T04 Platformer from template
section: Tutorials
order: 4
summary: Start from the platformer template and customise it with attributes.
---
**Project:** `nord new jumper -t platformer` · finished game: `examples/platformer`.

1. Play it: A/D run, Space jump, Shift dash, stomp slimes.
2. Select `Player`. Its scripts are library scripts: `platformer2d` (movement), `health`, `hero-fx`. Change `jumpForce` 420 → 520, enable `wallSlide`, enable `dash` — no code.
3. Open `scenes/main.scene.json` in the Hierarchy and look at `Level` (a [`tilemap`](component-tilemap.html)) and the parallax backgrounds.
4. Duplicate a slime (Cmd+D) and move it. Enemies use `enemy.js` (stomp-or-hurt) plus `ai-patrol` (library).
5. Add a checkpoint: Library tab → search *checkpoint* → Insert on a flag entity.

How it fits together: scripts talk by events — `enemy.js` emits `score`, the `score` script listens, `ui-hud` shows it. Read [The library](library.html). **Next:** [T05 Physics & collisions](tut-t05-physics.html).

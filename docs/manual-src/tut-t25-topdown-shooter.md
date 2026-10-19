---
title: T25 A top-down shooter from events
section: Tutorials
order: 25
summary: Open the shooter template, read how aiming, shooting, enemies and game-over are built from events, and change them.
---
**Result:** WASD moves, the mouse aims, click shoots, enemies chase you.
**Start from:** *New project → Top-down shooter (event sheet)* (also `templates/es-topdown-shooter`).

<figure class="shot"><img src="assets/screenshots/es-tpl-es-topdown-shooter-play.png" alt="The shooter template: a blue gun, red enemies and a yellow bullet" loading="lazy"><figcaption>Placeholder squares and circles: the fun is in the rules.</figcaption></figure>

## 1. Move and aim
The Player has the **8Direction** behavior (WASD) and **Bound to layout**. One event every tick sets its angle toward the mouse: `Player set-angle  angle(Player.X, Player.Y, Mouse.X, Mouse.Y)`.

## 2. Shoot
`Mouse → On click` creates a **Bullet** (a prefab with the **Bullet** behavior) at the player and sets its angle of motion to the player's angle. The prefab also has *Destroy outside layout*, so stray bullets clean themselves up.

## 3. Enemies
`Every 0.9 seconds` creates an **Enemy** at a random edge (`choose(-10, 650)`). Another event moves every enemy toward the player each tick, a little faster as your score grows: `move-at-angle … distance 70 * dt + score * 0.05`.

## 4. Hits and game over
`Bullet is-overlapping Enemy` → score +1, destroy both. `Enemy is-overlapping Player` → lives −1. When lives reach 0 a flag stops the spawner and a message waits for a click to restart.

## Try it
- Make enemies faster over time by changing `0.05`.
- Add a second enemy type with a different colour and speed.
- Slow the game on a hit: `System → Set time scale 0.3`, and set it back with a *Wait 0.2*.
